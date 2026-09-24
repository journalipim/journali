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

    public static void Map(RouteGroupBuilder api, DbZiel ziel, string dataDir, ILogger log)
    {
        api.MapGet("/backup/db", () => Results.Ok(new
        {
            host = ziel.Host, port = ziel.Port, database = ziel.Database, user = ziel.User, quelle = ziel.Quelle,
            password = ziel.Password is { Length: > 0 },
        }));

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
