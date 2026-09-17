using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Medien unter /api (docs/pflegestruktur.md, 20): hochladen (Bytes in den Store, MediaCreated ins
/// Journal — gleiche Datei zweimal ergibt dasselbe Medium), ausliefern, Werte setzen, zurückziehen.
/// Die Zuordnung zum Knoten läuft über Relationen (POST /api/relations mit dem Medium als Ziel).
/// </summary>
public static class MediaApi
{
    public static void Map(RouteGroupBuilder api)
    {
        // Liste, neueste zuerst; q sucht in Name und Werten
        api.MapGet("/media", (Catalog c, string? q = null, int limit = 200) =>
            c.With((model, tree, _) =>
            {
                var all = c.Media.All.Values.AsEnumerable();
                if (!string.IsNullOrWhiteSpace(q))
                {
                    var s = q.Trim();
                    all = all.Where(m => m.Name.Contains(s, StringComparison.OrdinalIgnoreCase) || m.Id.Contains(s, StringComparison.OrdinalIgnoreCase)
                        || m.Values.Values.Any(v => v.Contains(s, StringComparison.OrdinalIgnoreCase)));
                }
                return all.OrderByDescending(m => m.LastNumber).Take(Math.Clamp(limit, 1, 2000)).Select(m => MediaView.Of(m, c.Relations.To(m.Id).Count())).ToList();
            }));

        api.MapGet("/media/{id}", (string id, Catalog c) =>
            c.With((_, _, _) => c.Media.All.TryGetValue(id, out var m) ? MediaView.Of(m, c.Relations.To(m.Id).Count()) : null) is { } v ? Results.Ok(v) : Results.NotFound());

        // Die Datei: Hash-adressiert und unveränderlich, darf ewig im Cache bleiben.
        api.MapGet("/media/{id}/file", (string id, Catalog c, IMediaStore store, HttpResponse res) =>
        {
            var m = c.With((_, _, _) => c.Media.All.GetValueOrDefault(id));
            if (m is null) return Results.NotFound();
            var stream = store.Open(m.Sha256);
            if (stream is null) return Results.NotFound(new { error = $"Datei {m.Sha256} fehlt im Store." });
            res.Headers.CacheControl = "public, max-age=31536000, immutable";
            return Results.File(stream, m.Mime, enableRangeProcessing: true);
        });

        // Hochladen: multipart mit Feld „file“; Kopf X-Actor wie bei jedem Befehl.
        api.MapPost("/media", async (HttpRequest req, Catalog c, IMediaStore store, CancellationToken ct) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (!req.HasFormContentType) return Bad("multipart/form-data mit Feld file erwartet.");
            var form = await req.ReadFormAsync(ct);
            var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
            if (file is null || file.Length == 0) return Bad("Datei fehlt oder ist leer.");
            var (sha, bytes) = await store.PutAsync(file.OpenReadStream(), ct);
            var mime = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType;
            var name = Path.GetFileName(file.FileName);
            var result = c.With((_, _, write) =>
            {
                if (c.Media.BySha(sha) is { } have) return (View: MediaView.Of(have, c.Relations.To(have.Id).Count()), Existed: true);
                var entry = write(actor, Ids.Media(), Types.MediaCreated, new MediaCreated(sha, bytes, mime, name), null);
                var m = c.Media.All[entry.Stream];
                return (View: MediaView.Of(m, 0), Existed: false);
            });
            return Results.Ok(new { result.View.Id, result.View.Sha256, result.View.Bytes, result.View.Mime, result.View.Name, existed = result.Existed });
        }).DisableAntiforgery();

        api.MapDelete("/media/{id}", (string id, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.RetireMedium(x, id)));
        api.MapPost("/media/{id}/attributes", (string id, AttributeSet b, HttpRequest req, Catalog c) =>
            TreeApi.Run(req, c, x => Commands.SetMediumAttribute(x, id, b.Attribute, b.Locale, b.Channel, b.Value, b.Values)));
        api.MapPut("/media/{id}/external/{system}", (string id, string system, ExternalLinked b, HttpRequest req, Catalog c) =>
            TreeApi.Run(req, c, x => Commands.LinkMediumExternal(x, id, system, b.Id)));
    }
}

/// <summary>Ein Medium in der Antwort — plus, an wie vielen Knoten es hängt.</summary>
public sealed record MediaView(string Id, string Sha256, long Bytes, string Mime, string Name, bool IsImage, List<ValueView> Values,
    Dictionary<string, string> External, int Used, int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor)
{
    public static MediaView Of(Medium m, int used) => new(m.Id, m.Sha256, m.Bytes, m.Mime, m.Name, m.IsImage, ValueView.Of(m).ToList(),
        m.External, used, m.Entries, m.LastNumber, m.LastAt, m.LastActor);
}
