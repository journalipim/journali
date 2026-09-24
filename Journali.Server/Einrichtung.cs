using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using Npgsql;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>Wie es um die Datenbank steht — und warum nicht.</summary>
public enum DbLage { Ok, Keine, Unerreichbar, Abgewiesen, Rechte, Fehler }

/// <summary>
/// Wohin der Server sich verbindet: eine Verbindungszeichenfolge <b>ohne</b> Passwort, das Passwort daneben, und woher
/// beides kommt — aus <c>db.json</c> im Datenverzeichnis (gespeichert im Einrichtungsdialog) oder aus der Umgebung
/// (<c>JOURNALI_DB</c>, <c>JOURNALI_DB_PASSWORD</c>, appsettings, user-secrets).
/// </summary>
public sealed record DbZiel
{
    public const string AusDatei = "datei", AusUmgebung = "umgebung";
    public string Verbindung { get; }
    public string? Password { get; }
    public string Quelle { get; }

    public DbZiel(string verbindung, string? password, string quelle)
    {
        var b = new NpgsqlConnectionStringBuilder(verbindung);
        Password = string.IsNullOrEmpty(password) ? (string.IsNullOrEmpty(b.Password) ? null : b.Password) : password;
        b.Password = null;   // das Passwort steht nie in der Zeichenfolge, die gespeichert oder gezeigt wird
        Verbindung = b.ConnectionString;
        Quelle = quelle;
    }

    private NpgsqlConnectionStringBuilder B => new(Verbindung);
    public string Host => B.Host ?? "";
    public int Port => B.Port;
    public string Database => B.Database ?? "";
    public string User => B.Username ?? "";

    /// <summary>Die vollständige Zeichenfolge zum Verbinden; <paramref name="timeout"/> in Sekunden für Prüfungen.</summary>
    public string ConnectionString(int? timeout = null)
    {
        var b = new NpgsqlConnectionStringBuilder(Verbindung) { Password = Password };
        if (timeout is { } t) b.Timeout = t;
        return b.ConnectionString;
    }

    /// <summary>Dieselben Zusätze (SSL usw.), andere Adresse; ein leeres Passwort behält das bisherige.</summary>
    public static DbZiel Aus(DbZiel? bisher, string host, int port, string database, string user, string? password, string quelle)
    {
        var b = new NpgsqlConnectionStringBuilder(bisher?.Verbindung ?? "") { Host = host, Port = port, Database = database, Username = user };
        var gleich = bisher is not null && bisher.Host == host && bisher.User == user;
        return new DbZiel(b.ConnectionString, string.IsNullOrEmpty(password) && gleich ? bisher!.Password : password, quelle);
    }
}

/// <summary><c>db.json</c> im Datenverzeichnis: die Verbindung aus dem Einrichtungsdialog. Sie gilt vor der Umgebung.</summary>
public static class DbZielDatei
{
    private const string Zweck = "db";
    private sealed record Roh(string Connection, string? Password, DateTimeOffset? At);
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    public static string PathOf(string dir) => Path.Combine(dir, "db.json");

    public static DbZiel? Lies(string dir)
    {
        var p = PathOf(dir);
        if (!File.Exists(p)) return null;
        try
        {
            var r = JsonSerializer.Deserialize<Roh>(File.ReadAllText(p), Json);
            if (r is null || string.IsNullOrWhiteSpace(r.Connection)) return null;
            var pw = r.Password is { Length: > 0 } enc ? Verschluesselung.Von(Convert.FromBase64String(enc), Zweck) : null;
            return new DbZiel(r.Connection, pw, DbZiel.AusDatei);
        }
        catch (Exception e) when (e is JsonException or FormatException or CryptographicException) { return null; }
    }

    public static void Schreib(string dir, DbZiel z)
    {
        Directory.CreateDirectory(dir);
        var roh = new Roh(z.Verbindung, z.Password is { Length: > 0 } pw ? Convert.ToBase64String(Verschluesselung.Zu(pw, Zweck)) : null, DateTimeOffset.UtcNow);
        var p = PathOf(dir);
        File.WriteAllText(p, JsonSerializer.Serialize(roh, Json));
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(p, UnixFileMode.UserRead | UnixFileMode.UserWrite);
    }

    public static void Verwerfen(string dir) { if (File.Exists(PathOf(dir))) File.Delete(PathOf(dir)); }

    /// <summary>Aus der Umgebung: <c>JOURNALI_DB</c>, das Passwort aus <c>JOURNALI_DB_PASSWORD</c> oder — im Paket — aus der
    /// Datei <c>JOURNALI_DB_PASSWORD_FILE</c>, die der erste Start erzeugt.</summary>
    public static DbZiel? Umgebung(IConfiguration cfg)
    {
        if (cfg["JOURNALI_DB"] is not { Length: > 0 } cs) return null;
        var pw = cfg["JOURNALI_DB_PASSWORD"];
        if (string.IsNullOrEmpty(pw) && cfg["JOURNALI_DB_PASSWORD_FILE"] is { Length: > 0 } f && File.Exists(f)) pw = File.ReadAllText(f).Trim();
        return new DbZiel(cs, pw, DbZiel.AusUmgebung);
    }

    /// <summary>Was gilt: der Dialog vor der Umgebung — ein korrigiertes Passwort bleibt über den Neustart.</summary>
    public static DbZiel? Effektiv(string dir, IConfiguration cfg) => Lies(dir) ?? Umgebung(cfg);
}

/// <summary>
/// Der Einrichtungscode: solange etwas eingerichtet werden muss (Datenbank, erster Administrator, Passwort eines
/// Administrators), verlangt der Server ihn. Er steht in der Konsole des Servers und in <c>einrichtungscode.txt</c> im
/// Datenverzeichnis — wer ihn sieht, hat ohnehin Zugang zum Server. So kann niemand, der nur den Port erreicht, die
/// Verbindung umlenken oder sich zum Administrator machen.
/// </summary>
public static class Einrichtungscode
{
    private const string Zeichen = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static string? _code;
    private static readonly object Gate = new();
    private static readonly SemaphoreSlim Tor = new(1, 1);

    public static string PathOf(string dir) => Path.Combine(dir, "einrichtungscode.txt");
    public static bool Offen => _code is not null;

    /// <summary>Der Code dieses Laufs — beim ersten Aufruf erzeugt und abgelegt.</summary>
    public static string Aktiv(string dir)
    {
        lock (Gate)
        {
            if (_code is not null) return _code;
            var z = RandomNumberGenerator.GetItems<char>(Zeichen, 8);
            _code = $"{new string(z, 0, 4)}-{new string(z, 4, 4)}";
            try { Directory.CreateDirectory(dir); File.WriteAllText(PathOf(dir), _code + Environment.NewLine); } catch { }
            return _code;
        }
    }

    /// <summary>Prüfen — einer nach dem anderen, ein falscher kostet eine Sekunde. Ohne offenen Code: falsch.</summary>
    public static async Task<bool> PruefeAsync(string? eingabe)
    {
        await Tor.WaitAsync();
        try
        {
            var soll = _code;
            var ok = soll is not null && eingabe is not null
                && CryptographicOperations.FixedTimeEquals(System.Text.Encoding.UTF8.GetBytes(Norm(soll)), System.Text.Encoding.UTF8.GetBytes(Norm(eingabe)));
            if (!ok) await Task.Delay(1000);
            return ok;
        }
        finally { Tor.Release(); }
    }

    public static void Erledigt(string dir)
    {
        lock (Gate) { _code = null; try { if (File.Exists(PathOf(dir))) File.Delete(PathOf(dir)); } catch { } }
    }

    internal static string Norm(string s) => new(s.ToUpperInvariant().Where(ch => ch is not ('-' or ' ')).ToArray());
    /// <summary>Für Tests: einen bekannten Code setzen.</summary>
    public static void Setze(string? code) { lock (Gate) _code = code; }
}

/// <summary>
/// Der Weg zur Datenbank beim Start. Steht die Verbindung, geht es sofort weiter. Sonst läuft auf derselben Adresse eine
/// schlanke Einrichtungsstufe: die Oberfläche und drei Endpunkte (Stand, Prüfen, Speichern). Ist die Datenbank nur nicht
/// erreichbar, versucht die Stufe es alle fünf Sekunden neu und geht selbst weiter, wenn sie zurück ist — aber nur, bis
/// jemand im Dialog prüft oder speichert; ab dann gilt, was dort steht. Ein falsches Passwort wird nicht wiederholt.
/// </summary>
public static class Einrichtung
{
    public sealed record DbBody(string? Host, int? Port, string? Database, string? User, string? Password, string? Code);
    public sealed record CodeBody(string? Code);

    /// <summary>Was ein Fehler beim Verbinden bedeutet: Lage, Grund (Schlüssel für die Oberfläche) und der Text dahinter.</summary>
    public static (DbLage Lage, string Grund, string Detail) Einordnen(Exception e) => e switch
    {
        PostgresException p when p.SqlState is "28P01" or "28000" => (DbLage.Abgewiesen, "auth", $"{p.SqlState}: {p.MessageText}"),
        PostgresException p when p.SqlState == "42501" => (DbLage.Rechte, "rights", $"{p.SqlState}: {p.MessageText}"),
        PostgresException p => (DbLage.Fehler, "error", $"{p.SqlState}: {p.MessageText}"),
        _ when Socket(e) is { } s => (DbLage.Unerreichbar, s.SocketErrorCode switch
        {
            SocketError.HostNotFound or SocketError.NoData or SocketError.TryAgain => "host",
            SocketError.ConnectionRefused => "port",
            SocketError.TimedOut => "timeout",
            _ => "port",
        }, s.Message),
        TimeoutException or NpgsqlException { InnerException: TimeoutException } => (DbLage.Unerreichbar, "timeout", e.InnerException?.Message ?? e.Message),
        NpgsqlException { IsTransient: true } => (DbLage.Unerreichbar, "timeout", e.Message),
        _ => (DbLage.Fehler, "error", e.Message),
    };
    private static SocketException? Socket(Exception? e) { for (; e is not null; e = e.InnerException) if (e is SocketException s) return s; return null; }

    /// <summary>Verbinden und die Datenbank anlegen, wenn sie fehlt — fünf Sekunden Zeit.</summary>
    public static (DbLage Lage, string Grund, string Detail) Pruefe(DbZiel z)
    {
        try { PostgresJournal.EnsureDatabase(z.ConnectionString(5)); return (DbLage.Ok, "", ""); }
        catch (Exception e) { return Einordnen(e); }
    }

    public static string LageKey(DbLage l) => l switch
    {
        DbLage.Ok => "ok", DbLage.Keine => "keine", DbLage.Unerreichbar => "unerreichbar",
        DbLage.Abgewiesen => "abgewiesen", DbLage.Rechte => "rechte", _ => "fehler",
    };

    /// <summary>Der Zustand der Stufe — geteilt zwischen Endpunkten und dem Wiederholen im Hintergrund.</summary>
    public sealed class Stufe(string dataDir, IConfiguration cfg, DbZiel? ziel, (DbLage Lage, string Grund, string Detail) erst)
    {
        private readonly object _gate = new();
        public DbZiel? Ziel { get; private set; } = ziel;
        public DbLage Lage { get; private set; } = erst.Lage;
        public string Grund { get; private set; } = erst.Grund;
        public string Detail { get; private set; } = erst.Detail;
        public int Versuch { get; private set; } = ziel is null ? 0 : 1;
        /// <summary>Wiederholt der Server von selbst? Nur bei „nicht erreichbar“, und nur, bis jemand im Dialog etwas tut.</summary>
        public bool Auto { get; private set; } = true;
        public TaskCompletionSource<DbZiel> Fertig { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public object Stand() { lock (_gate) return new
        {
            lage = LageKey(Lage), grund = Grund, detail = Detail, versuch = Versuch, auto = Auto && Lage == DbLage.Unerreichbar,
            quelle = Ziel?.Quelle, ziel = Ziel is null ? null : new { host = Ziel.Host, port = Ziel.Port, database = Ziel.Database, user = Ziel.User, password = Ziel.Password is { Length: > 0 } },
        }; }

        /// <summary>Ein Versuch im Hintergrund — nur, solange niemand eingegriffen hat und die Datenbank bloss nicht erreichbar war.</summary>
        public void Automatisch()
        {
            DbZiel z;
            lock (_gate) { if (!Auto || Ziel is null || Lage != DbLage.Unerreichbar || Fertig.Task.IsCompleted) return; z = Ziel; Versuch++; }
            var r = Pruefe(z);
            lock (_gate)
            {
                if (!Auto || !ReferenceEquals(z, Ziel)) return;   // in der Zwischenzeit hat jemand eingegriffen
                (Lage, Grund, Detail) = r;
                if (r.Lage == DbLage.Ok) Fertig.TrySetResult(z);
            }
        }

        /// <summary>Aus dem Dialog: Automatik aus, das Ziel ist ab jetzt, was dort steht.</summary>
        public DbZiel Uebernimm(DbBody b)
        {
            lock (_gate) { Auto = false; return DbZiel.Aus(Ziel, b.Host!.Trim(), b.Port!.Value, b.Database!.Trim(), b.User!.Trim(), b.Password, DbZiel.AusDatei); }
        }

        public (DbLage Lage, string Grund, string Detail) Versuche(DbZiel z, bool speichern)
        {
            var r = Pruefe(z);
            lock (_gate)
            {
                if (speichern || r.Lage == DbLage.Ok) { Ziel = z; }
                (Lage, Grund, Detail) = r; Versuch++;
                if (speichern && r.Lage == DbLage.Ok) { DbZielDatei.Schreib(dataDir, z); Fertig.TrySetResult(z); }
            }
            return r;
        }

        /// <summary>Gespeicherte Verbindung verwerfen: es gilt wieder die Umgebung, die Automatik läuft wieder.</summary>
        public void Verwerfen()
        {
            DbZielDatei.Verwerfen(dataDir);
            var z = DbZielDatei.Umgebung(cfg);
            (DbLage Lage, string Grund, string Detail) r = z is null ? (DbLage.Keine, "none", "") : Pruefe(z);
            lock (_gate)
            {
                Ziel = z; (Lage, Grund, Detail) = r; Auto = true; Versuch = z is null ? 0 : 1;
                if (r.Lage == DbLage.Ok) Fertig.TrySetResult(z!);
            }
        }
    }

    /// <summary>
    /// Die Verbindung, mit der der Server arbeitet — sofort, wenn sie steht; sonst nach der Einrichtungsstufe.
    /// </summary>
    public static async Task<DbZiel> VerbindenAsync(string[] args, WebApplicationBuilder main, string dataDir)
    {
        var ziel = DbZielDatei.Effektiv(dataDir, main.Configuration);
        var erst = ziel is null ? (DbLage.Keine, "none", "") : Pruefe(ziel);
        if (erst.Item1 == DbLage.Ok) return ziel!;

        var stufe = new Stufe(dataDir, main.Configuration, ziel, erst);
        var code = Einrichtungscode.Aktiv(dataDir);
        Console.Error.WriteLine(ziel is null
            ? "journali: keine Datenbank eingerichtet"
            : $"journali: Datenbank {ziel.Host}:{ziel.Port}/{ziel.Database} — {LageKey(erst.Item1)} ({erst.Item3})");

        var b = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            Args = args, ContentRootPath = main.Environment.ContentRootPath, WebRootPath = main.Environment.WebRootPath, EnvironmentName = main.Environment.EnvironmentName,
        });
        b.Logging.ClearProviders();
        b.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping);
        var app = b.Build();
        Map(app, stufe);
        await app.StartAsync();
        Console.WriteLine($"journali: Einrichtung unter {string.Join(", ", app.Urls)} — Einrichtungscode {code} (auch in {Einrichtungscode.PathOf(dataDir)})");

        using var ende = new CancellationTokenSource();
        var wiederholen = Task.Run(async () =>
        {
            while (!ende.IsCancellationRequested)
            {
                try { await Task.Delay(5000, ende.Token); } catch (OperationCanceledException) { break; }
                stufe.Automatisch();
            }
        });
        var fertig = await stufe.Fertig.Task;
        ende.Cancel();
        await Task.Delay(500);   // die Antwort auf „Speichern“ soll noch hinausgehen
        await app.StopAsync();
        await app.DisposeAsync();
        Console.WriteLine($"journali: Datenbank {fertig.Host}:{fertig.Port}/{fertig.Database} verbunden");
        return fertig;
    }

    private static void Map(WebApplication app, Stufe stufe)
    {
        var api = app.MapGroup("/api");
        api.MapGet("/health", () => Results.Json(new { setup = "db", error = "Datenbank nicht verbunden." }, statusCode: 503));
        api.MapGet("/auth/state", () => Results.Ok(new { dbSetup = true, enabled = false, setup = false }));
        api.MapGet("/setup/state", () => Results.Ok(stufe.Stand()));

        api.MapPost("/setup/db/test", async (DbBody body) =>
        {
            if (Ungueltig(body) is { } fehler) return fehler;
            if (!await Einrichtungscode.PruefeAsync(body.Code)) return Bad("Einrichtungscode falsch.");
            var r = stufe.Versuche(stufe.Uebernimm(body), speichern: false);
            return Results.Ok(new { ok = r.Lage == DbLage.Ok, lage = LageKey(r.Lage), grund = r.Grund, detail = r.Detail });
        });
        api.MapPost("/setup/db", async (DbBody body) =>
        {
            if (Ungueltig(body) is { } fehler) return fehler;
            if (!await Einrichtungscode.PruefeAsync(body.Code)) return Bad("Einrichtungscode falsch.");
            var r = stufe.Versuche(stufe.Uebernimm(body), speichern: true);
            return Results.Ok(new { ok = r.Lage == DbLage.Ok, lage = LageKey(r.Lage), grund = r.Grund, detail = r.Detail });
        });
        api.MapPost("/setup/db/reset", async (CodeBody body) =>
        {
            if (!await Einrichtungscode.PruefeAsync(body.Code)) return Bad("Einrichtungscode falsch.");
            stufe.Verwerfen();
            return Results.Ok(stufe.Stand());
        });
        // alles andere unter /api: noch keine Datenbank
        api.Map("/{**rest}", () => Results.Json(new { error = "Datenbank nicht verbunden.", template = "Datenbank nicht verbunden.", args = Array.Empty<string>(), db = false }, statusCode: 503));

        var statisch = new StaticFileOptions { OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "no-cache" };
        app.UseDefaultFiles();
        app.UseStaticFiles(statisch);
        app.MapFallbackToFile("index.html", statisch);
    }

    private static IResult? Ungueltig(DbBody b)
    {
        if (string.IsNullOrWhiteSpace(b.Host)) return Bad("Host fehlt.");
        if (b.Port is not (>= 1 and <= 65535)) return Bad("Port: 1 bis 65535.");
        if (string.IsNullOrWhiteSpace(b.Database)) return Bad("Datenbank fehlt.");
        if (string.IsNullOrWhiteSpace(b.User)) return Bad("Anmeldename fehlt.");
        return null;
    }
}
