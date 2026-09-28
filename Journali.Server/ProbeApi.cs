using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Die Köpfe der Dateien lesen — Mass in Pixeln, Auflösung, Farbraum, Transparenz (<see cref="MediaProbe"/>).
/// Gelesen wird im Server, weil es keine Bibliothek braucht; angestossen wird es als <b>Job</b> (Plugin
/// <c>probe</c>), damit der Tasker ihn führt: anhalten, fortsetzen, abbrechen, nach Zeitplan laufen lassen.
/// Ein Import von tausend Assets wartet darauf nicht — er legt die Medien an, der Job liest danach.
/// <para><b>Die offene Postenliste ist kein eigener Bestand</b>, sondern eine Frage an das Abbild:
/// <see cref="Media.Unprobed"/> sind die Medien ohne <c>MediaProbed</c>. Deshalb ist eine Wiederaufnahme
/// nichts, was gebaut werden müsste — ein abgebrochener oder abgestürzter Lauf lässt die offenen Posten offen,
/// und der nächste Lauf findet genau dieselben. Es gibt keinen Zustand, der mit dem Prozess stirbt. Dasselbe
/// Muster trägt schon die Ableitungen (<see cref="Media.Pending"/>).</para>
/// <para>Ein Format, das der Leser nicht kennt — ein ZIP, eine Tabelle, auch ein PDF —, bekommt seinen Eintrag
/// trotzdem, mit Mass 0 × 0. Sonst bliebe es für immer offen und jeder Lauf läse es erneut. Was einmal 0 × 0
/// bekam, liest nur <c>again=true</c> wieder: das ist der Weg, wenn eine neue Fassung mehr Formate kennt.</para>
/// </summary>
public static class ProbeApi
{
    public const string PluginKey = "probe";

    public static void Map(RouteGroupBuilder api)
    {
        // Wie viele Posten offen sind, und wie viele nur 0 × 0 bekamen (unbekanntes Format)
        api.MapGet("/media/probe", (Catalog c) => c.Lesen((_, _) => Results.Ok(new
        {
            offen = c.Media.Unprobed().Count(),
            unbekannt = c.Media.Unknown().Count(),
            gelesen = c.Media.All.Values.Count(m => m.Probe is { Width: > 0 }),
            total = c.Media.All.Count,
        })));

        // Eine Runde lesen. Der Job ruft das in Schleife, bis offen = 0; von Hand geht es auch.
        api.MapPost("/media/probe", async (HttpRequest req, Catalog c, IMediaStore store, int limit = 200, bool again = false, CancellationToken ct = default) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var n = Math.Clamp(limit, 1, 5000);
            var offen = c.Lesen((_, _) => (again ? c.Media.Unknown() : c.Media.Unprobed()).Take(n).Select(m => (m.Id, m.Sha256)).ToList());
            int gelesen = 0, unbekannt = 0, fehlt = 0;
            // Erst alle Köpfe lesen — das dauert und braucht keine Sperre —, dann in einem Zug schreiben. Einzeln
            // geschrieben nahm jeder der 200 Posten die Schreibsperre und schrieb einzeln in die Datenbank; dazwischen
            // kam kein Leser mehr durch, und die Oberfläche stand sekundenlang (27.09.2026 gemessen: bis 19 s).
            var gemessen = new List<(string Id, MediaProbed Probe)>();
            foreach (var (id, sha) in offen)
            {
                ct.ThrowIfCancellationRequested();
                var probe = await KopfAsync(store, sha, ct);
                if (probe is null) { fehlt++; continue; }
                gemessen.Add((id, probe));
            }
            if (gemessen.Count > 0)
                c.With((_, _, write) =>
                {
                    foreach (var (id, probe) in gemessen)
                    {
                        if (!c.Media.All.TryGetValue(id, out var m)) { fehlt++; continue; }   // inzwischen zurückgezogen
                        if (m.Probe is { Width: > 0 }) { gelesen++; continue; }               // ein anderer Lauf war schneller
                        write(actor, id, Types.MediaProbed, probe, null);
                        if (probe.Width > 0) gelesen++; else unbekannt++;
                    }
                    return 0;
                });
            return c.Lesen((_, _) => Results.Ok(new { gelesen, unbekannt, fehlt, offen = again ? c.Media.Unknown().Count() : c.Media.Unprobed().Count() }));
        });

        // Von Hand anstossen (Einstellungen → Assets); der Server tut es nach jedem Hochladen selbst
        api.MapPost("/media/probe/run", (HttpRequest req, Catalog c, JobRunner runner) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var (job, error) = Kick(c, runner, actor);
            return job is not null ? Results.Ok(new { job }) : Bad(error ?? "kein probe-Job");
        });
    }

    private enum Ergebnis { Gelesen, Unbekannt, Fehlt }

    /// <summary>
    /// Einen Kopf lesen und festhalten, was darin stand. Gelesen wird aus dem Store, nicht aus der Anfrage:
    /// derselbe Weg gilt dann fürs Hochladen, fürs Holen und fürs Nachlesen im Bestand.
    /// </summary>
    /// <summary>Den Kopf einer Datei lesen und ausmessen — ohne Sperre, das dauert. Null: die Bytes fehlen im Store.</summary>
    private static async Task<MediaProbed?> KopfAsync(IMediaStore store, string sha, CancellationToken ct)
    {
        byte[] kopf;
        try
        {
            var stream = await store.OpenAsync(sha, ct);
            if (stream is null) return null;   // Bytes fehlen im Store — /api/media/missing zeigt das
            await using (stream) kopf = await MediaProbe.KopfAsync(stream, ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (IOException) { return null; }
        // Unbekanntes Format: 0 × 0 halten wir fest, damit der Posten nicht offen bleibt
        return MediaProbe.Lies(kopf) ?? new MediaProbed(0, 0);
    }

    private static async Task<Ergebnis> EinsAsync(Catalog c, IMediaStore store, string id, string sha, string actor, CancellationToken ct)
    {
        if (await KopfAsync(store, sha, ct) is not { } probe) return Ergebnis.Fehlt;
        return c.With((_, _, write) =>
        {
            if (!c.Media.All.TryGetValue(id, out var m)) return Ergebnis.Fehlt;   // inzwischen zurückgezogen
            if (m.Probe is { Width: > 0 }) return Ergebnis.Gelesen;               // ein anderer Lauf war schneller
            write(actor, id, Types.MediaProbed, probe, null);
            return probe.Width > 0 ? Ergebnis.Gelesen : Ergebnis.Unbekannt;
        });
    }

    /// <summary>
    /// Den probe-Job anstossen — nach Hochladen und Holen, und von Hand. Gibt es keinen, wird einer angelegt,
    /// sofern das Plugin installiert und an ist. Läuft er schon, ist das kein Fehler: er findet die neuen Posten
    /// in seiner nächsten Runde. Derselbe Weg wie bei den Ableitungen (<see cref="DeriveApi.Kick"/>).
    /// </summary>
    public static (string? Job, string? Error) Kick(Catalog c, JobRunner runner, string actor)
    {
        var (job, pluginOn) = c.Lesen((_, _) => (c.Jobs.All.Values.FirstOrDefault(j => j.Plugin == PluginKey && j.Enabled)?.Key,
            c.Plugins.All.TryGetValue(PluginKey, out var p) && p.Enabled));
        if (job is null)
        {
            if (!pluginOn) return (null, "Plugin probe ist nicht installiert oder aus (⌁ Plugins).");
            c.With((_, _, write) => write(actor, Jobs.Stream + PluginKey, Types.JobDefined,
                new JobDefined("Bildmasse lesen", PluginKey, new() { ["limit"] = "200" }, null, true, 120, null), null));
            job = PluginKey;
        }
        var run = runner.Start(job, "media", out var error);
        return run is not null || error == "läuft schon" ? (job, null) : (null, error);
    }
}
