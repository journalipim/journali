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

    private static readonly JsonSerializerOptions Camel = new(JsonSerializerDefaults.Web);
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
        return _haupt = RolleKlaeren();
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
