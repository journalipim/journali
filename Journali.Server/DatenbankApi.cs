using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// ⚙ Einstellungen → ⇅ B&amp;R → Datenbank: womit dieser Server verbunden ist — und das Passwort, für wer die Datenbank
/// selbst sichern will (pg_dump). Im Paket erzeugt es der erste Start; kennen muss es trotzdem ein Administrator.
/// Unter /api/backup, also nur mit dem Recht „Anwender und Rollen“; das Passwort nur nach erneuter Eingabe des eigenen.
/// </summary>
public static class DatenbankApi
{
    public sealed record ZeigenBody(string? Password);
    public sealed record SslBody(string? Modus);
    public sealed record SslErgebnis(bool Ok, bool? Verschluesselt, string? Version, string? Fehler);

    /// <summary>Verbindet sich mit dem Ziel und fragt Postgres, ob die Verbindung verschlüsselt ist — die Probe vor dem Speichern.</summary>
    public static async Task<SslErgebnis> ProbeAsync(DbZiel z, CancellationToken ct)
    {
        try
        {
            await using var quelle = Npgsql.NpgsqlDataSource.Create(z.ConnectionString(5));
            var (v, version) = await VerbindungAsync(quelle, ct);
            return new SslErgebnis(true, v, version, null);
        }
        catch (Exception e) { return new SslErgebnis(false, null, null, e.Message.Split('\n')[0]); }
    }

    /// <summary>
    /// Die Verschlüsselung der Verbindung ändern: erst probieren, dann in <c>db.json</c> schreiben — gilt nach dem nächsten Start des Servers. Scheitert die Probe
    /// (etwa „Require“ gegen einen Server ohne SSL), bleibt alles, wie es war: sonst fände der Server beim Start keine Datenbank mehr. Kommt die Verbindung aus der
    /// Umgebung des Servers, ändert sich hier nichts: db.json überstimmte sie still.
    /// </summary>
    public enum SslFehler { Keiner, Umgebung, Modus, Probe }

    public static async Task<(SslFehler Fehler, string Modus, string Detail, object? Wert)> SslSetzenAsync(DbZiel ziel, string dataDir, string? modus, Func<DbZiel, CancellationToken, Task<SslErgebnis>> probe, CancellationToken ct)
    {
        if (ziel.Quelle != DbZiel.AusDatei) return (SslFehler.Umgebung, "", "", null);
        if (string.IsNullOrWhiteSpace(modus) || !DbZiel.SslGueltig(modus)) return (SslFehler.Modus, "", "", null);
        var neu = DbZiel.Aus(ziel, ziel.Host, ziel.Port, ziel.Database, ziel.User, null, DbZiel.AusDatei, modus);
        var r = await probe(neu, ct);
        if (!r.Ok) return (SslFehler.Probe, neu.Ssl, r.Fehler ?? "", null);   // nichts wird gespeichert
        DbZielDatei.Schreib(dataDir, neu);
        return (SslFehler.Keiner, neu.Ssl, "", new { modus = neu.Ssl, verschluesselt = r.Verschluesselt, version = r.Version, neustart = true });
    }

    /// <summary>Ist diese Verbindung zur Datenbank verschlüsselt? Aus Sicht von Postgres (<c>pg_stat_ssl</c>), nicht aus der Einstellung. Null, wenn die Frage scheitert.</summary>
    public static async Task<(bool? Verschluesselt, string? Version)> VerbindungAsync(Npgsql.NpgsqlDataSource db, CancellationToken ct)
    {
        try
        {
            await using var cmd = db.CreateCommand("select ssl, version from pg_stat_ssl where pid = pg_backend_pid()");
            await using var r = await cmd.ExecuteReaderAsync(ct);
            return await r.ReadAsync(ct) ? (r.GetBoolean(0), r.IsDBNull(1) ? null : r.GetString(1)) : (null, null);
        }
        catch (Exception) { return (null, null); }
    }

    public static void Map(RouteGroupBuilder api, DbZiel ziel, string dataDir, ILogger log, Npgsql.NpgsqlDataSource db)
    {
        api.MapGet("/backup/db", async (CancellationToken ct) =>
        {
            var (verschluesselt, version) = await VerbindungAsync(db, ct);
            return Results.Ok(new
            {
                host = ziel.Host, port = ziel.Port, database = ziel.Database, user = ziel.User, quelle = ziel.Quelle,
                password = ziel.Password is { Length: > 0 },
                // modus: womit der Server läuft; verschluesselt: was die Verbindung tatsächlich ist; vorgemerkt: was in db.json steht und beim nächsten Start gilt;
                // aenderbar: nur wenn die Verbindung aus db.json kommt (aus der Umgebung gilt JOURNALI_DB)
                ssl = new { modus = ziel.Ssl, verschluesselt, version, vorgemerkt = DbZielDatei.Lies(dataDir)?.Ssl is { } v && v != ziel.Ssl ? v : null, aenderbar = ziel.Quelle == DbZiel.AusDatei },
            });
        });

        api.MapPut("/backup/db/ssl", async (SslBody body, CancellationToken ct) =>
        {
            var r = await SslSetzenAsync(ziel, dataDir, body.Modus, ProbeAsync, ct);
            switch (r.Fehler)
            {
                case SslFehler.Umgebung: return Bad("Die Verbindung kommt aus der Umgebung des Servers — der Modus gehört in JOURNALI_DB (SSL Mode=…).");
                case SslFehler.Modus: return Bad("Verschlüsselung: Disable, Prefer, Require, VerifyCA oder VerifyFull.");
                case SslFehler.Probe: return Bad("Mit {0} lässt sich keine Verbindung herstellen: {1}", r.Modus, r.Detail);
            }
            log.LogInformation("Verschlüsselung der Datenbankverbindung auf {Modus} gestellt (gilt nach dem nächsten Start)", body.Modus);
            return Results.Ok(r.Wert);
        });

        api.MapPost("/backup/db/password", (ZeigenBody body, HttpContext ctx, Catalog c) =>
        {
            if (!Auth.Enabled(c)) return Bad("Die Anzeige verlangt eine Anmeldung.");
            if (ctx.Items["user"] is not string wer || !Auth.PasswortStimmt(dataDir, wer, body.Password ?? ""))
            {
                Thread.Sleep(300);
                return Bad("Passwort falsch.");
            }
            log.LogInformation("Datenbankpasswort angezeigt für {User}", wer);
            return Results.Ok(new { password = ziel.Password });
        });
    }
}
