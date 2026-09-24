using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Spiegel und Schnappschuss: zwei Dateien, die den Start schnell machen und sonst nichts bedeuten (Taloan, 24.09.2026:
/// „habe ich dann eine 3-GB-Postgres und daneben noch mal einen 3-GB-Cache?“ — ja, und deshalb soll man es abschalten
/// können, ohne an die Umgebung zu gehen). Die Einstellung steht in <c>betrieb.json</c> und gilt ab dem nächsten Start;
/// die Dateien selbst lassen sich sofort wegwerfen — beide sind Kopien, keine Wahrheit.
/// </summary>
public static class BetriebApi
{
    public sealed record Body(bool? JournalCache, bool? Snapshot);

    public static void Map(RouteGroupBuilder api, string dataDir, string cachePath, string snapshotPath, IConfiguration cfg)
    {
        static object Datei(string pfad) => new
        {
            pfad = Path.GetFileName(pfad),
            da = File.Exists(pfad),
            bytes = File.Exists(pfad) ? new FileInfo(pfad).Length : 0L,
            at = File.Exists(pfad) ? File.GetLastWriteTimeUtc(pfad) : (DateTime?)null,
        };

        api.MapGet("/betrieb", () =>
        {
            var b = BetriebConfigFile.Effektiv(dataDir, cfg);
            return Results.Ok(new
            {
                b.JournalCache,
                b.Snapshot,
                eingestellt = BetriebConfigFile.Load(dataDir) is not null,   // false = aus der Umgebung
                spiegel = Datei(cachePath),
                schnappschuss = Datei(snapshotPath),
            });
        });

        api.MapPut("/betrieb", (Body body, HttpRequest req) =>
        {
            if (Actor(req) is null) return ActorMissing();
            var jetzt = BetriebConfigFile.Effektiv(dataDir, cfg);
            BetriebConfigFile.Save(dataDir, new BetriebConfig(body.JournalCache ?? jetzt.JournalCache, body.Snapshot ?? jetzt.Snapshot));
            return Results.Ok(new { gespeichert = true });
        });

        // Wegwerfen: beim nächsten Start wird neu gelesen. Der Spiegel wird ohnehin gegen die Datenbank geprüft.
        api.MapDelete("/betrieb/{was}", (string was, HttpRequest req) =>
        {
            if (Actor(req) is null) return ActorMissing();
            var pfad = was switch { "spiegel" => cachePath, "schnappschuss" => snapshotPath, _ => null };
            if (pfad is null) return Bad("spiegel oder schnappschuss.");
            if (!File.Exists(pfad)) return Results.Ok(new { weg = false });
            try { File.Delete(pfad); return Results.Ok(new { weg = true }); }
            catch (IOException e) { return Bad($"Die Datei ist in Benutzung: {e.Message}"); }
        });
    }
}
