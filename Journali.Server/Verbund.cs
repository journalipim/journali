using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Projections;
using Npgsql;

namespace Journali.Server;

/// <summary>
/// Die Server auf derselben Datenbank (pflegestruktur 41): wer dieser Server ist, welche Rolle er hat und was die anderen tun.
/// <para>Die Entscheidungen (Hauptserver, gesperrt) stehen im Journal und kommen über das Abbild der Jobs. Der flüchtige Zustand — Puls,
/// Version, Stand, ob ein Import läuft, welche Jobs laufen — steht in der Tabelle <c>server</c> neben dem Journal, wie die Präsenz.</para>
/// <para>Hauptserver ist, wer im Journal festgelegt ist <b>und</b> die Sperre <c>pg_try_advisory_lock</c> hält. Die Sperre hängt an einer eigenen
/// Verbindung: endet der Prozess oder bricht die Verbindung ab, gibt Postgres sie frei. So gibt es nie zwei Hauptserver, auch nicht für die
/// Sekunden, in denen ein neu festgelegter auf den bisherigen wartet.</para>
/// <para>Ohne Datenbank (Tests, Sandbox) gibt es nur diesen Server, und er ist Hauptserver.</para>
/// </summary>
public sealed class Verbund : IDisposable
{
    /// <summary>So lange gilt ein Puls. Der Takt pulst alle 2 Sekunden.</summary>
    public static readonly TimeSpan Gilt = TimeSpan.FromSeconds(30);
    /// <summary>Schlüssel der Sperre des Hauptservers („journali“ als Zahl).</summary>
    public const long SperrSchluessel = 0x6A6F75726E616C69;

    public sealed record Zeile(string Id, string Host, string? Version, DateTimeOffset? Built, DateTimeOffset Started, DateTimeOffset Puls, long Head, bool Import, JsonElement? Jobs);

    /// <summary>So stehen die laufenden Jobs in der Spalte <c>jobs</c>: Felder klein geschrieben, wie die Oberfläche sie liest.</summary>
    public static readonly JsonSerializerOptions Camel = new(JsonSerializerDefaults.Web);
    private readonly NpgsqlDataSource? _db;
    private readonly Catalog _catalog;
    private readonly string? _version;
    private readonly DateTimeOffset _built, _started = DateTimeOffset.UtcNow;
    private NpgsqlConnection? _sperre;          // hält die Sperre des Hauptservers, solange sie offen ist
    private bool _tabelle;
    private volatile bool _haupt;
    private volatile bool _importAnderswo;
    private List<Zeile> _zeilen = [];

    public string Id { get; }
    public string Host { get; }

    /// <summary>Läuft auf diesem Server gerade ein Import? (setzt der Aufrufer, meist der JobRunner)</summary>
    public Func<bool> ImportHier { get; set; } = () => false;
    /// <summary>Welche Jobs auf diesem Server laufen — als JSON für die Tabelle (setzt der JobRunner).</summary>
    public Func<object?> JobsHier { get; set; } = () => null;
    /// <summary>Die Logs der laufenden Läufe (Job, Lauf, Datei) — der Hauptserver schreibt sie im Takt in die Datenbank.</summary>
    public Func<IEnumerable<(string Key, string Run, string Pfad)>> LogsHier { get; set; } = () => [];

    public Verbund(NpgsqlDataSource? db, Catalog catalog, string dataDir, string? version, DateTime built, string? host = null)
    {
        _db = db; _catalog = catalog; _version = version; _built = new DateTimeOffset(built, TimeSpan.Zero);
        Id = KennungIn(dataDir);
        Host = host ?? Environment.MachineName;
        _haupt = db is null;
    }

    /// <summary>Die Kennung dieses Servers: <c>server.json</c> im Datenverzeichnis, beim ersten Start erzeugt. Der Rechnername kann sich ändern, sie nicht.</summary>
    public static string KennungIn(string dataDir)
    {
        var pfad = Path.Combine(dataDir, "server.json");
        try
        {
            if (File.Exists(pfad) && JsonDocument.Parse(File.ReadAllText(pfad)).RootElement.TryGetProperty("id", out var i) && i.GetString() is { Length: > 0 } id) return id;
        }
        catch (Exception) { }   // unlesbar: neu
        var neu = "srv-" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(6)).ToLowerInvariant();
        Directory.CreateDirectory(dataDir);
        File.WriteAllText(pfad, JsonSerializer.Serialize(new { id = neu }));
        return neu;
    }

    /// <summary>Ist dieser Server Hauptserver (festgelegt und Halter der Sperre)? Ohne Datenbank immer.</summary>
    public bool IstHaupt => _haupt;
    /// <summary>Ist dieser Server gesperrt?</summary>
    public bool Gesperrt => _catalog.Lesen((_, _) => _catalog.Jobs.BlockedServers.Contains(Id));
    /// <summary>Läuft auf einem anderen erreichbaren Server ein Import? Aus dem letzten Puls, ohne Anfrage an die Datenbank.</summary>
    public bool ImportAnderswo => _importAnderswo;

    public string? Festgelegt() => _catalog.Lesen((_, _) => _catalog.Jobs.MainServer);
    public IReadOnlySet<string> Gesperrte() => _catalog.Lesen((_, _) => _catalog.Jobs.BlockedServers.ToHashSet());
    public static bool Erreichbar(Zeile z, DateTimeOffset jetzt) => jetzt - z.Puls < Gilt;

    private void Tabelle()
    {
        if (_tabelle || _db is null) return;
        using var cmd = _db.CreateCommand("""
            CREATE TABLE IF NOT EXISTS server (
                id      TEXT PRIMARY KEY,
                host    TEXT        NOT NULL,
                version TEXT,
                built   TIMESTAMPTZ,
                started TIMESTAMPTZ NOT NULL,
                puls    TIMESTAMPTZ NOT NULL,
                head    BIGINT      NOT NULL DEFAULT 0,
                import  BOOLEAN     NOT NULL DEFAULT false,
                jobs    JSONB
            );
            CREATE TABLE IF NOT EXISTS server_auftrag (
                id         BIGSERIAL PRIMARY KEY,
                art        TEXT        NOT NULL,
                job        TEXT        NOT NULL,
                ausloeser  TEXT,
                von        TEXT        NOT NULL,
                at         TIMESTAMPTZ NOT NULL DEFAULT now(),
                angenommen TIMESTAMPTZ,
                erledigt   TIMESTAMPTZ,
                ergebnis   TEXT,
                fehler     TEXT
            );
            CREATE TABLE IF NOT EXISTS job_protokoll (
                job    TEXT        NOT NULL,
                run    TEXT        NOT NULL,
                server TEXT        NOT NULL,
                text   TEXT        NOT NULL,
                at     TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (job, run)
            );
            """);
        cmd.ExecuteNonQuery();
        _tabelle = true;
    }

    /// <summary>
    /// Ein Takt: den eigenen Puls schreiben, die anderen lesen, die Rolle klären. Liefert, ob dieser Server danach Hauptserver ist.
    /// Fehler (Datenbank weg) lassen die Rolle, wie sie ist, ausser die Verbindung der Sperre bricht ab — dann ist er es nicht mehr.
    /// </summary>
    public bool Takt()
    {
        if (_db is null) { _zeilen = [new Zeile(Id, Host, _version, _built, _started, DateTimeOffset.UtcNow, _catalog.Head, ImportHier(), null)]; return _haupt = true; }
        Tabelle();
        var jobs = JobsHier();
        using (var cmd = _db.CreateCommand("""
            INSERT INTO server (id, host, version, built, started, puls, head, import, jobs) VALUES (@id, @host, @version, @built, @started, now(), @head, @import, @jobs::jsonb)
            ON CONFLICT (id) DO UPDATE SET host = excluded.host, version = excluded.version, built = excluded.built, started = excluded.started,
                puls = excluded.puls, head = excluded.head, import = excluded.import, jobs = excluded.jobs
            """))
        {
            cmd.Parameters.AddWithValue("id", Id); cmd.Parameters.AddWithValue("host", Host);
            cmd.Parameters.AddWithValue("version", (object?)_version ?? DBNull.Value); cmd.Parameters.AddWithValue("built", _built);
            cmd.Parameters.AddWithValue("started", _started); cmd.Parameters.AddWithValue("head", _catalog.Head);
            cmd.Parameters.AddWithValue("import", ImportHier());
            cmd.Parameters.AddWithValue("jobs", jobs is null ? DBNull.Value : JsonSerializer.Serialize(jobs, Camel));
            cmd.ExecuteNonQuery();
        }
        var zeilen = Lies();
        var jetzt = DateTimeOffset.UtcNow;
        _zeilen = zeilen;
        _importAnderswo = zeilen.Any(z => z.Id != Id && z.Import && Erreichbar(z, jetzt));
        _haupt = RolleKlaeren();
        if (_haupt)
            foreach (var (job, run, pfad) in LogsHier())
                try { Protokoll(job, run, pfad); } catch (IOException) { }   // die Datei wird gerade geschrieben: im nächsten Takt
        return _haupt;
    }

    private List<Zeile> Lies()
    {
        if (_db is null) return _zeilen;
        Tabelle();
        using var cmd = _db.CreateCommand("SELECT id, host, version, built, started, puls, head, import, jobs::text FROM server ORDER BY host, id");
        using var r = cmd.ExecuteReader();
        var liste = new List<Zeile>();
        while (r.Read())
            liste.Add(new Zeile(r.GetString(0), r.GetString(1), r.IsDBNull(2) ? null : r.GetString(2), r.IsDBNull(3) ? null : r.GetFieldValue<DateTimeOffset>(3),
                r.GetFieldValue<DateTimeOffset>(4), r.GetFieldValue<DateTimeOffset>(5), r.GetInt64(6), r.GetBoolean(7),
                r.IsDBNull(8) ? null : JsonDocument.Parse(r.GetString(8)).RootElement.Clone()));
        return liste;
    }

    /// <summary>Die Server, wie der letzte Takt sie sah.</summary>
    public IReadOnlyList<Zeile> Zeilen => _zeilen;

    /// <summary>Was auf dem Hauptserver gerade läuft — für die Jobliste eines Arbeitsservers (aus dem letzten Takt, ohne Anfrage).</summary>
    public IReadOnlyList<JobRunner.Laufend> LaufendAmHaupt()
    {
        var main = Festgelegt();
        if (main is null || _zeilen.FirstOrDefault(z => z.Id == main) is not { Jobs: { } jobs } z || !Erreichbar(z, DateTimeOffset.UtcNow)) return [];
        return LaufendAus(jobs);
    }

    /// <summary>Die laufenden Jobs aus der Spalte <c>jobs</c>; Unlesbares zählt als nichts.</summary>
    public static List<JobRunner.Laufend> LaufendAus(JsonElement jobs)
    {
        try { return jobs.ValueKind == JsonValueKind.Array ? jobs.Deserialize<List<JobRunner.Laufend>>(Camel) ?? [] : []; } catch (JsonException) { return []; }
    }

    // ---- Aufträge an den Hauptserver (Entscheidung 3) ------------------------------------------------------------

    /// <summary>Kanal für den Anstoss: wer einen Auftrag einträgt, ruft NOTIFY; der Hauptserver wartet mit LISTEN.</summary>
    public const string Kanal = "journali_server";
    /// <summary>Ein Auftrag, den niemand in dieser Zeit angenommen hat, gilt nicht mehr — ein später Hauptserver startet keinen Job, den keiner mehr erwartet.</summary>
    public static readonly TimeSpan AuftragGilt = TimeSpan.FromMinutes(1);

    /// <summary>
    /// Einen Auftrag an den Hauptserver geben und auf die Antwort warten: <c>start</c> (mit Auslöser), <c>pause</c>, <c>resume</c>, <c>cancel</c>.
    /// Liefert das Ergebnis (bei start die Kennung des Laufs) oder den Fehler. Antwortet der Hauptserver nicht, wird der Auftrag zurückgezogen,
    /// solange er ihn nicht angenommen hat; hat er ihn angenommen, wird länger gewartet (ein Start holt vielleicht noch den Eingang über einen Zugang).
    /// </summary>
    public (string? Ergebnis, string? Fehler) Auftrag(string art, string job, string? ausloeser, TimeSpan? warten = null)
    {
        if (_db is null) return (null, "Kein Hauptserver.");
        var main = Festgelegt();
        if (main is null || _zeilen.FirstOrDefault(z => z.Id == main) is not { } hz || !Erreichbar(hz, DateTimeOffset.UtcNow)) return (null, "Der Hauptserver antwortet nicht.");
        Tabelle();
        long id;
        using (var cmd = _db.CreateCommand("INSERT INTO server_auftrag (art, job, ausloeser, von) VALUES (@art, @job, @ausloeser, @von) RETURNING id"))
        {
            cmd.Parameters.AddWithValue("art", art); cmd.Parameters.AddWithValue("job", job);
            cmd.Parameters.AddWithValue("ausloeser", (object?)ausloeser ?? DBNull.Value); cmd.Parameters.AddWithValue("von", Id);
            id = (long)cmd.ExecuteScalar()!;
        }
        using (var cmd = _db.CreateCommand($"NOTIFY {Kanal}")) cmd.ExecuteNonQuery();
        var bis = DateTime.UtcNow + (warten ?? TimeSpan.FromSeconds(5));
        var spaetestens = DateTime.UtcNow + TimeSpan.FromSeconds(30);
        while (true)
        {
            Thread.Sleep(100);
            using var cmd = _db.CreateCommand("SELECT angenommen IS NOT NULL, erledigt IS NOT NULL, ergebnis, fehler FROM server_auftrag WHERE id = @id");
            cmd.Parameters.AddWithValue("id", id);
            using var r = cmd.ExecuteReader();
            if (!r.Read()) return (null, "Der Hauptserver antwortet nicht.");
            var (angenommen, erledigt) = (r.GetBoolean(0), r.GetBoolean(1));
            if (erledigt) return (r.IsDBNull(2) ? null : r.GetString(2), r.IsDBNull(3) ? null : r.GetString(3));
            var jetzt = DateTime.UtcNow;
            if ((!angenommen && jetzt > bis) || jetzt > spaetestens)
            {
                r.Close();
                using var weg = _db.CreateCommand("UPDATE server_auftrag SET erledigt = now(), fehler = 'zurückgezogen' WHERE id = @id AND angenommen IS NULL");
                weg.Parameters.AddWithValue("id", id);
                if (weg.ExecuteNonQuery() > 0 || jetzt > spaetestens) return (null, "Der Hauptserver antwortet nicht.");
            }
        }
    }

    /// <summary>
    /// Auf dem Hauptserver: offene Aufträge annehmen und ausführen. Abgelaufene werden nicht ausgeführt. Liefert, wie viele ausgeführt wurden.
    /// </summary>
    public int Abarbeiten(Func<string, string, string?, (string? Ergebnis, string? Fehler)> ausfuehren)
    {
        if (_db is null || !_haupt) return 0;
        Tabelle();
        var offen = new List<(long Id, string Art, string Job, string? Ausloeser, DateTimeOffset At)>();
        using (var cmd = _db.CreateCommand(
            "UPDATE server_auftrag SET angenommen = now() WHERE id IN (SELECT id FROM server_auftrag WHERE angenommen IS NULL AND erledigt IS NULL ORDER BY id FOR UPDATE SKIP LOCKED) " +
            "RETURNING id, art, job, ausloeser, at"))
        using (var r = cmd.ExecuteReader())
            while (r.Read()) offen.Add((r.GetInt64(0), r.GetString(1), r.GetString(2), r.IsDBNull(3) ? null : r.GetString(3), r.GetFieldValue<DateTimeOffset>(4)));
        foreach (var a in offen.OrderBy(a => a.Id))
        {
            (string? Ergebnis, string? Fehler) e;
            if (DateTimeOffset.UtcNow - a.At > AuftragGilt) e = (null, "abgelaufen");
            else try { e = ausfuehren(a.Art, a.Job, a.Ausloeser); } catch (Exception ex) { e = (null, ex.Message); }
            using var cmd = _db.CreateCommand("UPDATE server_auftrag SET erledigt = now(), ergebnis = @e, fehler = @f WHERE id = @id");
            cmd.Parameters.AddWithValue("id", a.Id); cmd.Parameters.AddWithValue("e", (object?)e.Ergebnis ?? DBNull.Value); cmd.Parameters.AddWithValue("f", (object?)e.Fehler ?? DBNull.Value);
            cmd.ExecuteNonQuery();
        }
        return offen.Count;
    }

    /// <summary>
    /// Der Hörer des Hauptservers: wartet mit LISTEN auf einen Anstoss, höchstens 2 Sekunden, und arbeitet dann ab. Geht ein Anstoss verloren, findet
    /// die nächste Runde den Auftrag trotzdem — die Tabelle ist die Wahrheit. Auf einem Arbeitsserver wartet die Schleife nur.
    /// </summary>
    public async Task HoerenAsync(Func<string, string, string?, (string? Ergebnis, string? Fehler)> ausfuehren, CancellationToken stop)
    {
        NpgsqlConnection? hoer = null;
        var aufgeraeumt = DateTime.MinValue;
        while (!stop.IsCancellationRequested)
        {
            try
            {
                if (_db is null || !_haupt)
                {
                    if (hoer is not null) { await hoer.DisposeAsync(); hoer = null; }
                    await Task.Delay(TimeSpan.FromSeconds(2), stop);
                    continue;
                }
                if (hoer is not { State: System.Data.ConnectionState.Open })
                {
                    if (hoer is not null) await hoer.DisposeAsync();
                    hoer = await _db.OpenConnectionAsync(stop);
                    Tabelle();
                    await using var listen = new NpgsqlCommand($"LISTEN {Kanal}", hoer);
                    await listen.ExecuteNonQueryAsync(stop);
                }
                Abarbeiten(ausfuehren);
                if (DateTime.UtcNow - aufgeraeumt > TimeSpan.FromHours(1)) { Aufraeumen(); aufgeraeumt = DateTime.UtcNow; }
                await hoer.WaitAsync(TimeSpan.FromSeconds(2), stop);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception)
            {
                if (hoer is not null) { try { await hoer.DisposeAsync(); } catch (Exception) { } hoer = null; }
                try { await Task.Delay(TimeSpan.FromSeconds(2), stop); } catch (OperationCanceledException) { break; }
            }
        }
        if (hoer is not null) await hoer.DisposeAsync();
    }

    /// <summary>Erledigte Aufträge nach einem Tag, Protokolle nach 30 Tagen löschen — das Log selbst liegt beim Hauptserver als Datei.</summary>
    private void Aufraeumen()
    {
        if (_db is null) return;
        using var cmd = _db.CreateCommand("DELETE FROM server_auftrag WHERE at < now() - interval '1 day'; DELETE FROM job_protokoll WHERE at < now() - interval '30 days';");
        cmd.ExecuteNonQuery();
    }

    // ---- Protokolle der Läufe: das Log steht als Datei beim Hauptserver und als Kopie in der Datenbank ---------------

    /// <summary>So viel vom Ende eines Logs geht in die Datenbank.</summary>
    public const int ProtokollMax = 1 << 20;
    private readonly Dictionary<(string, string), long> _geschrieben = new();

    /// <summary>Das Log eines Laufs in die Tabelle schreiben, wenn es sich seit dem letzten Mal geändert hat (Hauptserver; im Takt und am Ende des Laufs).</summary>
    public void Protokoll(string job, string run, string pfad)
    {
        if (_db is null || !File.Exists(pfad)) return;
        long laenge;
        try { laenge = new FileInfo(pfad).Length; } catch (IOException) { return; }
        lock (_geschrieben) { if (_geschrieben.TryGetValue((job, run), out var war) && war == laenge) return; _geschrieben[(job, run)] = laenge; }
        string text;
        using (var fs = new FileStream(pfad, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
        {
            if (fs.Length > ProtokollMax) fs.Seek(-ProtokollMax, SeekOrigin.End);
            using var sr = new StreamReader(fs);
            text = sr.ReadToEnd();
        }
        if (laenge > ProtokollMax) text = "… " + text[(text.IndexOf('\n') + 1)..];   // ab der ersten ganzen Zeile
        Tabelle();
        using var cmd = _db.CreateCommand(
            "INSERT INTO job_protokoll (job, run, server, text, at) VALUES (@job, @run, @server, @text, now()) " +
            "ON CONFLICT (job, run) DO UPDATE SET text = excluded.text, server = excluded.server, at = excluded.at");
        cmd.Parameters.AddWithValue("job", job); cmd.Parameters.AddWithValue("run", run); cmd.Parameters.AddWithValue("server", Id); cmd.Parameters.AddWithValue("text", text);
        cmd.ExecuteNonQuery();
    }

    /// <summary>Am Ende eines Laufs: ein letztes Mal schreiben und die Länge vergessen.</summary>
    public void ProtokollFertig(string job, string run, string pfad)
    {
        Protokoll(job, run, pfad);
        lock (_geschrieben) _geschrieben.Remove((job, run));
    }

    /// <summary>Das Log eines Laufs aus der Tabelle (für einen Arbeitsserver, der die Datei nicht hat). Null = keins.</summary>
    public string? ProtokollLesen(string job, string run)
    {
        if (_db is null) return null;
        Tabelle();
        using var cmd = _db.CreateCommand("SELECT text FROM job_protokoll WHERE job = @job AND run = @run");
        cmd.Parameters.AddWithValue("job", job); cmd.Parameters.AddWithValue("run", run);
        return cmd.ExecuteScalar() as string;
    }

    /// <summary>
    /// Festgelegt und Sperre gehalten = Hauptserver. Ist keiner festgelegt, legt sich fest, wer die Sperre bekommt (Entscheidung 1). Ist ein anderer
    /// festgelegt, gibt dieser Server die Sperre ab. Ein gesperrter Server ist nie Hauptserver.
    /// </summary>
    private bool RolleKlaeren()
    {
        var main = Festgelegt();
        if (Gesperrt || (main is not null && main != Id)) { SperreAbgeben(); return false; }
        if (!SperreHalten()) return false;
        if (main is null)
            _catalog.With((_, _, write) => _catalog.Jobs.MainServer is null ? write("system", Jobs.ServerStream + Id, Types.ServerMainSet, new ServerMainSet(Host), null) : null);
        return Festgelegt() == Id;
    }

    /// <summary>Hält dieser Server die Sperre (oder bekommt er sie jetzt)? Eine abgebrochene Verbindung zählt als verloren.</summary>
    private bool SperreHalten()
    {
        try
        {
            if (_sperre is { State: System.Data.ConnectionState.Open })
            {
                using var ping = new NpgsqlCommand("SELECT 1", _sperre);
                ping.ExecuteScalar();
                return true;
            }
        }
        catch (Exception) { SperreAbgeben(); }
        var conn = _db!.OpenConnection();
        using var cmd = new NpgsqlCommand("SELECT pg_try_advisory_lock(@k)", conn);
        cmd.Parameters.AddWithValue("k", SperrSchluessel);
        if (cmd.ExecuteScalar() is true) { _sperre = conn; return true; }
        conn.Dispose();
        return false;
    }

    private void SperreAbgeben()
    {
        if (_sperre is null) return;
        // Ausdrücklich freigeben: die Verbindung geht zurück in den Pool, und dort hielte sie die Sperre, bis sie jemand wieder öffnet
        try { using var cmd = new NpgsqlCommand("SELECT pg_advisory_unlock(@k)", _sperre); cmd.Parameters.AddWithValue("k", SperrSchluessel); cmd.ExecuteScalar(); } catch (Exception) { }
        try { _sperre.Dispose(); } catch (Exception) { }
        _sperre = null;
    }

    /// <summary>Einen Server aus der Tabelle entfernen (nur, wer nicht erreichbar ist). Was im Journal über ihn steht, bleibt.</summary>
    public bool Entfernen(string id)
    {
        if (_db is null) return false;
        Tabelle();
        using var cmd = _db.CreateCommand("DELETE FROM server WHERE id = @id AND puls < now() - make_interval(secs => @s)");
        cmd.Parameters.AddWithValue("id", id); cmd.Parameters.AddWithValue("s", Gilt.TotalSeconds);
        var n = cmd.ExecuteNonQuery();
        if (n > 0) _zeilen = Lies();
        return n > 0;
    }

    public void Dispose()
    {
        SperreAbgeben();
        // Beim Beenden: der Puls endet, die anderen sehen den Server nach 30 Sekunden als nicht erreichbar. Die Zeile bleibt für die Liste.
    }
}
