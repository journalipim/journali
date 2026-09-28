using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Vorschau-Presets und Ableitungen.
/// Presets stehen im Journal (Strom media-preset:&lt;key&gt;), gerechnet wird nie im Serverprozess: das Prozess-Plugin <c>derive</c>
/// (Node + sharp) holt sich über <c>/api/media/pending</c>, was fehlt, lädt das Original, rechnet, und legt das Ergebnis mit
/// <c>PUT /api/media/{id}/derived/{preset}</c> ab — der Server speichert die Bytes unter <c>sha.&lt;preset&gt;</c> und schreibt den
/// Beleg <c>MediaDerived</c>. Nach jedem Hochladen/Holen stösst der Server den derive-Job an (<see cref="Kick"/>); fehlt der Job,
/// legt er ihn an, sobald das Plugin installiert ist. Ausliefern: <c>GET /api/media/{id}/{preset}</c>.
/// </summary>
public static class DeriveApi
{
    public sealed record PresetBody(Labels? Label, int? Width, int? Height, string? Format, int? Quality, bool? Auto);
    /// <summary>Ein Beleg je gerechneter Ableitung — die Bytes liegen schon im Speicher.</summary>
    public sealed record Beleg(string? Id, string? Preset, int Width, int Height, long Bytes, string? Fingerprint);
    public sealed record BelegeBody(List<Beleg>? Belege);
    private static readonly HashSet<string> Formats = ["webp", "jpeg", "png", "avif"];
    public const string PluginKey = "derive";

    public static void Map(RouteGroupBuilder api)
    {
        api.MapGet("/media/presets", (Catalog c) => c.Lesen((_, _) => c.Media.Presets.Values.OrderBy(p => p.Key).Select(p => View(c, p)).ToList()));
        api.MapPut("/media/presets/{key}", (string key, PresetBody b, HttpRequest req, Catalog c, JobRunner runner) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            key = key.Trim().ToLowerInvariant();
            if (!ValidKey(key)) return Bad("Key: a-z, 0-9, _.");
            if (key == "file") return Bad("„file“ ist das Original.");
            return c.With((_, _, write) =>
            {
                var cur = c.Media.Presets.GetValueOrDefault(key);
                var w = b.Width ?? cur?.Width ?? 0; var h = b.Height ?? cur?.Height ?? 0;
                var format = (b.Format ?? cur?.Format ?? "webp").Trim().ToLowerInvariant(); if (format == "jpg") format = "jpeg";
                var q = b.Quality ?? cur?.Quality ?? 82;
                if (w is < 16 or > 20000 || h is < 16 or > 20000) return Bad("Kante: 16 bis 20000 Pixel (Breite × Höhe, längste Seite wird eingepasst).");
                if (!Formats.Contains(format)) return Bad("Format: webp, jpeg, png oder avif.");
                if (q is < 1 or > 100) return Bad("Qualität: 1 bis 100.");
                var label = b.Label is { Count: > 0 } ? b.Label : cur?.Label ?? Labels.Of(key, key);
                write(actor, Media.PresetStream + key, Types.MediaPresetDefined, new MediaPresetDefined(label, w, h, format, q, b.Auto ?? cur?.Auto ?? true), null);
                // Was jetzt fehlt, rechnet der Job — niemand soll dafür eine Seite aufsuchen
                var (job, _) = Kick(c, runner, actor);
                return Results.Ok(new { preset = View(c, c.Media.Presets[key]), job });
            });
        });
        api.MapDelete("/media/presets/{key}", (string key, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (key == "thumb") return Bad("„thumb“ braucht die Bibliothek für die Kacheln.");
            return c.With((_, _, write) =>
            {
                if (!c.Media.Presets.ContainsKey(key)) return Results.NotFound();
                write(actor, Media.PresetStream + key, Types.MediaPresetRetired, new MediaPresetRetired(), null);
                return Results.Ok(new { ok = true });
            });
        });

        // Was fehlt (für das Plugin derive): je Bild und Preset — oder nur ein Preset. Höchstens `limit` Bilder je Aufruf.
        // Der Stand für die Leiste der Systemjobs: wie viele Ableitungen es geben müsste und wie viele es gibt.
        // Gezählt wird je Preset mit auto — dieselben, die der Job rechnet.
        api.MapGet("/media/derive", (Catalog c) => c.Lesen((_, _) =>
        {
            var presets = c.Media.Presets.Values.Where(p => p.Auto).ToList();
            if (presets.Count == 0) return Results.Ok(new { ready = false, reason = "Kein Preset mit auto.", total = 0L, gelesen = 0L, offen = 0L });
            var soll = (long)presets.Count * c.Media.All.Values.Count(m => m.IsRenderable);
            var offen = presets.Sum(p => (long)c.Media.Pending(p).Count());
            return Results.Ok(new { ready = true, reason = (string?)null, total = soll, gelesen = soll - offen, offen });
        }));

        api.MapGet("/media/pending", (Catalog c, string? preset = null, int limit = 200) => c.Lesen((_, _) =>
        {
            var presets = c.Media.Presets.Values.Where(p => p.Auto && (preset is null || p.Key == preset)).ToList();
            var items = new List<object>();
            foreach (var p in presets)
                foreach (var m in c.Media.Pending(p).Take(Math.Clamp(limit, 1, 2000)))
                    items.Add(new { preset = p.Key, p.Width, p.Height, p.Format, p.Quality, fingerprint = p.Fingerprint, id = m.Id, sha256 = m.Sha256, m.Name, m.Mime, m.Bytes });
            return Results.Ok(new { presets = presets.Select(p => View(c, p)).ToList(), items });
        }));

        // Ergebnis ablegen: Bytes im Body, Mass in den Köpfen X-Width/X-Height; der Server schreibt sha.<preset> und den Beleg
        api.MapPut("/media/{id}/derived/{preset}", async (string id, string preset, HttpRequest req, Catalog c, IMediaStore store, CancellationToken ct, bool beleg = true) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var (m, p) = c.Lesen((_, _) => (c.Media.All.GetValueOrDefault(id), c.Media.Presets.GetValueOrDefault(preset)));
            if (m is null || p is null) return Results.NotFound();
            if (!(req.ContentType ?? "").StartsWith("image/")) return Bad("Bild erwartet (image/…).");
            if (!int.TryParse(req.Headers["X-Width"], out var w) || !int.TryParse(req.Headers["X-Height"], out var h)) return Bad("Köpfe X-Width und X-Height fehlen.");
            var fingerprint = req.Headers["X-Fingerprint"].FirstOrDefault() ?? p.Fingerprint;
            using var buffer = new MemoryStream();
            await req.Body.CopyToAsync(buffer, ct); buffer.Position = 0;
            await store.PutAsync(m.Sha256 + "." + p.Key, buffer, ct);
            // beleg=false: nur die Bytes ablegen, den Beleg sammelt der Aufrufer und schickt ihn am Ende der Runde
            // an /media/derived. Jeder einzelne Beleg nahm sonst die Schreibsperre — bei 200 je Runde kam kein
            // Leser mehr durch, und die Kacheln standen sekundenlang still (28.09.2026)
            if (beleg) c.With((_, _, write) => write(actor, m.Id, Types.MediaDerived, new MediaDerived(p.Key, w, h, buffer.Length, fingerprint), null));
            return Results.Ok(new { ok = true, w, h, bytes = buffer.Length });
        });

        // Die Belege einer ganzen Runde in einem Zug — ein Stapel, eine Sperre
        api.MapPost("/media/derived", (BelegeBody body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (body.Belege is not { Count: > 0 }) return Results.Ok(new { geschrieben = 0 });
            var items = new List<(string, string, object)>();
            var fehlt = new List<string>();
            c.Lesen((_, _) =>
            {
                foreach (var b in body.Belege)
                {
                    var m = b.Id is { Length: > 0 } ? c.Media.All.GetValueOrDefault(b.Id) : null;
                    var p = b.Preset is { Length: > 0 } ? c.Media.Presets.GetValueOrDefault(b.Preset) : null;
                    if (m is null || p is null) { fehlt.Add($"{b.Id}/{b.Preset}"); continue; }
                    items.Add((m.Id, Types.MediaDerived, new MediaDerived(p.Key, b.Width, b.Height, b.Bytes, b.Fingerprint ?? p.Fingerprint)));
                }
                return 0;
            });
            if (items.Count > 0) c.WriteMany(actor, items);
            return Results.Ok(new { geschrieben = items.Count, fehlt });
        });

        // Ausliefern: GET /api/media/{id}/{preset} — liegt nichts vor, 404 (der Aufrufer nimmt dann /file oder wartet auf den Job)
        api.MapGet("/media/{id}/{preset}", async (string id, string preset, Catalog c, IMediaStore store, HttpResponse res, CancellationToken ct) =>
        {
            var (m, p) = c.Lesen((_, _) => (c.Media.All.GetValueOrDefault(id), c.Media.Presets.GetValueOrDefault(preset)));
            if (m is null || p is null) return Results.NotFound();
            var stream = await store.OpenAsync(m.Sha256 + "." + p.Key, ct);
            if (stream is null) return Results.NotFound(Err("Ableitung {0} liegt noch nicht vor.", preset));
            res.Headers.CacheControl = "public, max-age=31536000, immutable";
            return Results.File(stream, p.Mime);
        });

        // Von Hand anstossen (Einstellungen: „▶ jetzt rechnen“)
        api.MapPost("/media/derive", (HttpRequest req, Catalog c, JobRunner runner) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var (started, error) = Kick(c, runner, actor);
            return started is not null ? Results.Ok(new { job = started }) : Bad(error ?? "kein derive-Job");
        });
    }

    private static object View(Catalog c, MediaPreset p)
    {
        var images = c.Media.All.Values.Count(m => m.IsRenderable);
        var have = c.Media.All.Values.Count(m => m.IsRenderable && c.Media.HasDerived(m, p));
        return new { p.Key, p.Label, p.Width, p.Height, p.Format, p.Quality, p.Auto, fingerprint = p.Fingerprint, images, have, pending = images - have };
    }

    /// <summary>
    /// derive-Job anstossen — nach Hochladen/Holen und von Hand. Gibt es keinen Job zum Plugin derive, wird einer angelegt
    /// (nur von Hand, der Server stösst ihn an), sofern das Plugin installiert und an ist. Läuft er schon, ist das kein Fehler.
    /// </summary>
    public static (string? Job, string? Error) Kick(Catalog c, JobRunner runner, string actor)
    {
        var (job, pluginOn) = c.Lesen((_, _) => (c.Jobs.All.Values.FirstOrDefault(j => j.Plugin == PluginKey && j.Enabled)?.Key, c.Plugins.All.TryGetValue(PluginKey, out var p) && p.Enabled));
        if (job is null)
        {
            if (!pluginOn) return (null, "Plugin derive ist nicht installiert oder aus (⌁ Plugins).");
            c.With((_, _, write) => write(actor, Jobs.Stream + PluginKey, Types.JobDefined, new JobDefined("Vorschauen rechnen", PluginKey, new() { ["limit"] = "200" }, null, true, 120, null), null));
            job = PluginKey;
        }
        var run = runner.Start(job, "media", out var error);
        return run is not null || error == "läuft schon" ? (job, null) : (null, error);
    }
}
