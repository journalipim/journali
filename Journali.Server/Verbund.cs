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
    /// <summary>Wann das laufende Programm gebaut wurde.</summary>
    public DateTimeOffset Built => _built;
    /// <summary>Der Name eines Servers: was im Journal steht, sonst der Rechnername.</summary>
    public string NameVon(string id, string? host) => _catalog.Lesen((_, _) => _catalog.Jobs.ServerNames.GetValueOrDefault(id)) ?? host ?? id;

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

    // ---- Mehrere Server nur mit Lizenz (04.10.2026): Unlimited oder der Zusatz „Multi-Server“ ---------------------------------------------------
    private volatile bool _ohneLizenz;
    private IReadOnlySet<string> _lizenziert = new HashSet<string>();
    /// <summary>Läuft dieser Server über die erlaubte Zahl hinaus? Dann beantwortet er unter /api nur /api/health und führt keine Jobs aus.</summary>
    public bool OhneLizenz => _ohneLizenz;
    /// <summary>Wie viele Server erlaubt sind (aus dem letzten Takt).</summary>
    public int Erlaubt { get; private set; } = 1;
    /// <summary>Wie viele erreichbare Server über die erlaubte Zahl hinaus laufen (aus dem letzten Takt) — dann frischt der Hauptserver die Abos öfter auf.</summary>
    public int OhneLizenzAnzahl { get; private set; }
    public bool Lizenziert(string id) => _db is null || _lizenziert.Contains(id);

    /// <summary>
    /// Die Rangfolge der erreichbaren, nicht gesperrten Server: der festgelegte Hauptserver zuerst — er hat Vorfahrt, auch wenn er nach einem Arbeitsserver
    /// startet —, dann nach dem Start, der früheste zuerst. Die ersten <paramref name="erlaubt"/> laufen, die übrigen sind ohne Lizenz.
    /// </summary>
    public static List<string> Rangfolge(IEnumerable<Zeile> zeilen, string? main, IReadOnlySet<string> gesperrt, DateTimeOffset jetzt) =>
        zeilen.Where(z => Erreichbar(z, jetzt) && !gesperrt.Contains(z.Id))
            .OrderBy(z => z.Id == main ? 0 : 1).ThenBy(z => z.Started).ThenBy(z => z.Id, StringComparer.Ordinal).Select(z => z.Id).ToList();
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
            ALTER TABLE server_auftrag ADD COLUMN IF NOT EXISTS an TEXT;
            ALTER TABLE server ADD COLUMN IF NOT EXISTS erlaubt INTEGER;
            ALTER TABLE server ADD COLUMN IF NOT EXISTS haupt BOOLEAN NOT NULL DEFAULT false;
            ALTER TABLE server ADD COLUMN IF NOT EXISTS name TEXT;
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
            INSERT INTO server (id, host, version, built, started, puls, head, import, jobs, erlaubt, haupt, name)
                VALUES (@id, @host, @version, @built, @started, now(), @head, @import, @jobs::jsonb, @erlaubt, @haupt, @name)
            ON CONFLICT (id) DO UPDATE SET host = excluded.host, version = excluded.version, built = excluded.built, started = excluded.started,
                puls = excluded.puls, head = excluded.head, import = excluded.import, jobs = excluded.jobs, erlaubt = excluded.erlaubt, haupt = excluded.haupt, name = excluded.name
            """))
        {
            cmd.Parameters.AddWithValue("id", Id); cmd.Parameters.AddWithValue("host", Host);
            cmd.Parameters.AddWithValue("version", (object?)_version ?? DBNull.Value); cmd.Parameters.AddWithValue("built", _built);
            cmd.Parameters.AddWithValue("started", _started); cmd.Parameters.AddWithValue("head", _catalog.Head);
            cmd.Parameters.AddWithValue("import", ImportHier());
            cmd.Parameters.AddWithValue("jobs", jobs is null ? DBNull.Value : JsonSerializer.Serialize(jobs, Camel));
            // für den Einrichtungsdialog eines anderen Servers, der das Journal noch nicht lesen kann: wie viele erlaubt sind, wer Hauptserver ist, wie er heisst
            cmd.Parameters.AddWithValue("erlaubt", _catalog.ErlaubteServer); cmd.Parameters.AddWithValue("haupt", _haupt); cmd.Parameters.AddWithValue("name", NameVon(Id, Host));
            cmd.ExecuteNonQuery();
        }
        var zeilen = Lies();
        var jetzt = DateTimeOffset.UtcNow;
        _zeilen = zeilen;
        _importAnderswo = zeilen.Any(z => z.Id != Id && z.Import && Erreichbar(z, jetzt));
        Erlaubt = _catalog.ErlaubteServer;
        var rang = Rangfolge(zeilen, Festgelegt(), Gesperrte(), jetzt);
        _lizenziert = rang.Take(Erlaubt).ToHashSet();
        OhneLizenzAnzahl = rang.Count - _lizenziert.Count;
        var ohne = !_lizenziert.Contains(Id) && !Gesperrt;
        if (ohne != _ohneLizenz) Console.WriteLine(ohne ? $"journali: für einen weiteren Server fehlt die Lizenz (erlaubt: {Erlaubt}) — dieser Server beantwortet nur /api/health" : "journali: dieser Server hat wieder eine Lizenz");
        _ohneLizenz = ohne;
        _haupt = RolleKlaeren();
        // jeder Server schreibt die Logs seiner Läufe — so liest man sie von jedem Server aus
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

    /// <summary>
    /// Für den Einrichtungsdialog (04.10.2026): läuft auf dieser Datenbank schon die erlaubte Zahl von Servern? Dann liefert es den Namen des laufenden
    /// (des Hauptservers, sonst des frühesten), sonst null. Der Dialog kann das Journal noch nicht lesen — die erlaubte Zahl kommt aus den Zeilen der
    /// laufenden Server. Ist dieser Server selbst der Hauptserver (dieselbe Kennung), ist nichts belegt: er kommt zurück und hat Vorfahrt.
    /// </summary>
    public static string? Belegt(NpgsqlDataSource db, string eigeneId)
    {
        var laufend = new List<(string Id, string Name, int Erlaubt, bool Haupt, DateTimeOffset Started)>();
        try
        {
            using var cmd = db.CreateCommand(
                "SELECT id, COALESCE(name, host), COALESCE(erlaubt, 1), haupt, started FROM server WHERE puls > now() - make_interval(secs => @s) ORDER BY haupt DESC, started");
            cmd.Parameters.AddWithValue("s", Gilt.TotalSeconds);
            using var r = cmd.ExecuteReader();
            while (r.Read()) laufend.Add((r.GetString(0), r.GetString(1), r.GetInt32(2), r.GetBoolean(3), r.GetFieldValue<DateTimeOffset>(4)));
        }
        catch (PostgresException) { return null; }   // noch keine Tabelle oder Spalte: hier lief noch kein Server dieser Version
        if (laufend.Any(x => x.Id == eigeneId && x.Haupt)) return null;
        var andere = laufend.Where(x => x.Id != eigeneId).ToList();
        if (andere.Count == 0) return null;
        var erlaubt = andere.Max(x => x.Erlaubt);
        return andere.Count >= erlaubt ? andere[0].Name : null;
    }

    /// <summary>Die Server, wie der letzte Takt sie sah.</summary>
    public IReadOnlyList<Zeile> Zeilen => _zeilen;

    /// <summary>Was auf den anderen erreichbaren Servern gerade läuft — für die Jobliste (aus dem letzten Takt, ohne Anfrage).</summary>
    public IReadOnlyList<JobRunner.Laufend> LaufendAnderswo()
    {
        var jetzt = DateTimeOffset.UtcNow;
        return _zeilen.Where(z => z.Id != Id && z.Jobs is not null && Erreichbar(z, jetzt)).SelectMany(z => LaufendAus(z.Jobs!.Value)).ToList();
    }

    /// <summary>Name eines Servers aus Journal und Tabelle.</summary>
    public string NameVon(string id) => NameVon(id, _zeilen.FirstOrDefault(z => z.Id == id)?.Host);

    /// <summary>Die laufenden Jobs aus der Spalte <c>jobs</c>; Unlesbares zählt als nichts.</summary>
    public static List<JobRunner.Laufend> LaufendAus(JsonElement jobs)
    {
        try { return jobs.ValueKind == JsonValueKind.Array ? jobs.Deserialize<List<JobRunner.Laufend>>(Camel) ?? [] : []; } catch (JsonException) { return []; }
    }

    // ---- Aufträge an einen anderen Server: ein Job läuft auf seinem Server, ein Systemjob auf dem Hauptserver ----------------

    /// <summary>Kanal für den Anstoss: wer einen Auftrag einträgt, ruft NOTIFY; jeder Server wartet mit LISTEN und nimmt die an ihn.</summary>
    public const string Kanal = "journali_server";
    /// <summary>Ein Auftrag, den niemand in dieser Zeit angenommen hat, gilt nicht mehr — ein später Server startet keinen Job, den keiner mehr erwartet.</summary>
    public static readonly TimeSpan AuftragGilt = TimeSpan.FromMinutes(1);

    /// <summary>
    /// Einen Auftrag an den Server <paramref name="an"/> geben und auf die Antwort warten: <c>start</c> (mit Auslöser), <c>pause</c>, <c>resume</c>, <c>cancel</c>.
    /// Liefert das Ergebnis (bei start die Kennung des Laufs) oder den Fehler. Antwortet der Server nicht, wird der Auftrag zurückgezogen,
    /// solange er ihn nicht angenommen hat; hat er ihn angenommen, wird länger gewartet (ein Start holt vielleicht noch den Eingang über einen Zugang).
    /// </summary>
    public (string? Ergebnis, string? Fehler) Auftrag(string an, string art, string job, string? ausloeser, TimeSpan? warten = null)
    {
        if (_db is null) return (null, "Kein Hauptserver.");
        var ziel = NameVon(an);
        if (_zeilen.FirstOrDefault(z => z.Id == an) is not { } hz || !Erreichbar(hz, DateTimeOffset.UtcNow)) return (null, $"Server {ziel} antwortet nicht.");
        Tabelle();
        long id;
        using (var cmd = _db.CreateCommand("INSERT INTO server_auftrag (an, art, job, ausloeser, von) VALUES (@an, @art, @job, @ausloeser, @von) RETURNING id"))
        {
            cmd.Parameters.AddWithValue("an", an); cmd.Parameters.AddWithValue("art", art); cmd.Parameters.AddWithValue("job", job);
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
            if (!r.Read()) return (null, $"Server {ziel} antwortet nicht.");
            var (angenommen, erledigt) = (r.GetBoolean(0), r.GetBoolean(1));
            if (erledigt) return (r.IsDBNull(2) ? null : r.GetString(2), r.IsDBNull(3) ? null : r.GetString(3));
            var jetzt = DateTime.UtcNow;
            if ((!angenommen && jetzt > bis) || jetzt > spaetestens)
            {
                r.Close();
                using var weg = _db.CreateCommand("UPDATE server_auftrag SET erledigt = now(), fehler = 'zurückgezogen' WHERE id = @id AND angenommen IS NULL");
                weg.Parameters.AddWithValue("id", id);
                if (weg.ExecuteNonQuery() > 0 || jetzt > spaetestens) return (null, $"Server {ziel} antwortet nicht.");
            }
        }
    }

    /// <summary>
    /// Die offenen Aufträge an diesen Server annehmen und ausführen. Abgelaufene werden nicht ausgeführt. Liefert, wie viele angenommen wurden.
    /// </summary>
    public int Abarbeiten(Func<string, string, string?, (string? Ergebnis, string? Fehler)> ausfuehren)
    {
        if (_db is null) return 0;
        Tabelle();
        var offen = new List<(long Id, string Art, string Job, string? Ausloeser, DateTimeOffset At)>();
        using var annehmen = _db.CreateCommand(
            "UPDATE server_auftrag SET angenommen = now() WHERE id IN (SELECT id FROM server_auftrag WHERE an = @an AND angenommen IS NULL AND erledigt IS NULL ORDER BY id FOR UPDATE SKIP LOCKED) " +
            "RETURNING id, art, job, ausloeser, at");
        annehmen.Parameters.AddWithValue("an", Id);
        using (var r = annehmen.ExecuteReader())
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
    /// Der Hörer jedes Servers: wartet mit LISTEN auf einen Anstoss, höchstens 2 Sekunden, und arbeitet dann die Aufträge an ihn ab. Geht ein Anstoss
    /// verloren, findet die nächste Runde den Auftrag trotzdem — die Tabelle ist die Wahrheit.
    /// </summary>
    public async Task HoerenAsync(Func<string, string, string?, (string? Ergebnis, string? Fehler)> ausfuehren, CancellationToken stop)
    {
        NpgsqlConnection? hoer = null;
        var aufgeraeumt = DateTime.MinValue;
        while (!stop.IsCancellationRequested)
        {
            try
            {
                if (_db is null)
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
                if (_haupt && DateTime.UtcNow - aufgeraeumt > TimeSpan.FromHours(1)) { Aufraeumen(); aufgeraeumt = DateTime.UtcNow; }
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
        // Ist nur ein Server erlaubt, ist der laufende der Hauptserver (04.10.2026): läuft der festgelegte nicht, übernimmt dieser — läuft er, hat er den
        // Platz, und dieser ist ohne Lizenz (oben). Mit mehreren erlaubten Servern wechselt der Hauptserver nie von selbst (Entscheidung 2).
        var uebernehmen = Erlaubt == 1 && main is not null && main != Id;
        // ein gesperrter Server oder einer ohne Lizenz wird nicht Hauptserver — auch nicht, wenn noch keiner festgelegt ist
        if (Gesperrt || _ohneLizenz || (main is not null && main != Id && !uebernehmen)) { SperreAbgeben(); return false; }
        if (!SperreHalten()) return false;
        if (main is null)
            _catalog.With((_, _, write) => _catalog.Jobs.MainServer is null ? write("system", Jobs.ServerStream + Id, Types.ServerMainSet, new ServerMainSet(Host), null) : null);
        else if (uebernehmen)   // die Sperre ist frei: der bisherige Hauptserver läuft nicht
            _catalog.With((_, _, write) => _catalog.Jobs.MainServer != Id ? write("system", Jobs.ServerStream + Id, Types.ServerMainSet, new ServerMainSet(Host), null) : null);
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
