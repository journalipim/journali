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
                ssl = new { modus = ziel.Ssl, verschluesselt, version },   // modus: was eingestellt ist; verschluesselt: was die Verbindung tatsächlich ist
            });
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
