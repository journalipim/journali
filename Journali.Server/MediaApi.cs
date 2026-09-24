using Journali.Core.Entries;
using Journali.Core.Projections;
using Npgsql;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Medien unter /api (docs/pflegestruktur.md, 20): hochladen (Bytes in den Store, MediaCreated ins
/// Journal — gleiche Datei zweimal ergibt dasselbe Medium), ausliefern, Werte setzen, zurückziehen.
/// Die Zuordnung zum Knoten läuft über Relationen (POST /api/relations mit dem Medium als Ziel).
/// </summary>
public static class MediaApi
{
    /// <summary>Das maskierte Geheimnis aus der Anzeige („••••“) heisst: das gespeicherte behalten.</summary>
    private static MediaConfig Unmask(MediaConfig body, MediaConfig current) =>
        body.Secret is null || body.Secret.StartsWith("••") ? body with { Secret = current.Secret } : body;

    public static void Map(RouteGroupBuilder api)
    {
        // Liste, neueste zuerst; q sucht in Name und Werten
        // Bibliothek: folder = Ordner-Id | "-" (ohne Ordner) | leer (alle); deep = mit Unterordnern; sort = recent | name | size | used | date; desc
        api.MapGet("/media", (Catalog c, string? q = null, int limit = 200, string? folder = null, bool deep = false, string? sort = null, bool? desc = null) =>
            c.With((model, tree, _) =>
            {
                var all = c.Media.All.Values.AsEnumerable();
                if (!string.IsNullOrWhiteSpace(q))
                {
                    var s = q.Trim();
                    all = all.Where(m => m.Name.Contains(s, StringComparison.OrdinalIgnoreCase) || m.Id.Contains(s, StringComparison.OrdinalIgnoreCase)
                        || m.Values.Values.Any(v => v.Contains(s, StringComparison.OrdinalIgnoreCase)));
                }
                if (folder == "-") all = all.Where(m => m.Folder is null);
                else if (!string.IsNullOrWhiteSpace(folder))
                {
                    var set = deep ? c.Media.FolderAndBelow(folder).ToHashSet() : new HashSet<string> { folder };
                    all = all.Where(m => m.Folder is { } f && set.Contains(f));
                }
                var rows = all.Select(m => (m, used: c.Relations.To(m.Id).Count()));
                var down = desc ?? (sort is null or "recent" or "date" or "size" or "used");   // Neuestes/Grösstes/Meistgenutztes zuerst, Namen A→Z
                Func<(Medium m, int used), object> key = sort switch
                {
                    "name" => x => x.m.Name,
                    "size" => x => x.m.Bytes,
                    "used" => x => x.used,
                    "date" => x => x.m.LastAt,
                    _ => x => x.m.LastNumber,
                };
                var sorted = sort == "name"
                    ? (down ? rows.OrderByDescending(x => x.m.Name, StringComparer.OrdinalIgnoreCase) : rows.OrderBy(x => x.m.Name, StringComparer.OrdinalIgnoreCase))
                    : (down ? rows.OrderByDescending(key).ThenBy(x => x.m.Name, StringComparer.OrdinalIgnoreCase) : rows.OrderBy(key).ThenBy(x => x.m.Name, StringComparer.OrdinalIgnoreCase));
                return sorted.Take(Math.Clamp(limit, 1, 5000)).Select(x => MediaView.Of(x.m, x.used)).ToList();
            }));

        // Medienordner
        api.MapGet("/media/folders", (Catalog c) => c.With((_, _, _) =>
        {
            var count = c.Media.All.Values.Where(m => m.Folder is not null).GroupBy(m => m.Folder!).ToDictionary(g => g.Key, g => g.Count());
            return new
            {
                total = c.Media.All.Count, unfiled = c.Media.All.Values.Count(m => m.Folder is null),
                folders = c.Media.Folders.Values.OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase).Select(f => new { f.Id, f.Name, f.Parent, media = count.GetValueOrDefault(f.Id) }).ToList(),
            };
        }));
        api.MapPost("/media/folders", (FolderBody b, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.CreateMediaFolder(x, b.Name, b.Parent)));
        api.MapPut("/media/folders/{id}/name", (string id, FolderBody b, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.RenameMediaFolder(x, id, b.Name)));
        api.MapPut("/media/folders/{id}/parent", (string id, FolderBody b, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.MoveMediaFolder(x, id, b.Parent)));
        api.MapDelete("/media/folders/{id}", (string id, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.RetireMediaFolder(x, id)));
        api.MapPut("/media/{id}/folder", (string id, FolderBody b, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.FileMedium(x, id, b.Folder)));

        api.MapGet("/media/{id}", (string id, Catalog c) =>
            c.With((_, _, _) => c.Media.All.TryGetValue(id, out var m) ? MediaView.Of(m, c.Relations.To(m.Id).Count()) : null) is { } v ? Results.Ok(v) : Results.NotFound());

        // Die Datei: Hash-adressiert und unveränderlich, darf ewig im Cache bleiben.
        api.MapGet("/media/{id}/file", async (string id, Catalog c, IMediaStore store, HttpResponse res, CancellationToken ct) =>
        {
            var m = c.With((_, _, _) => c.Media.All.GetValueOrDefault(id));
            if (m is null) return Results.NotFound();
            var stream = await store.OpenAsync(m.Sha256, ct);
            if (stream is null) return Results.NotFound(new { error = $"Datei {m.Sha256} fehlt im Store." });
            res.Headers.CacheControl = "public, max-age=31536000, immutable";
            return Results.File(stream, m.Mime, enableRangeProcessing: true);
        });

        // Vorschau: Schlüssel sha.thumb im Store; rechnet der erste Betrachter (MediaThumb.vue) und legt sie per PUT ab.
        api.MapGet("/media/{id}/thumb", async (string id, Catalog c, IMediaStore store, HttpResponse res, CancellationToken ct) =>
        {
            var m = c.With((_, _, _) => c.Media.All.GetValueOrDefault(id));
            if (m is null) return Results.NotFound();
            var stream = await store.OpenAsync(m.Sha256 + ".thumb", ct);
            if (stream is null) return Results.NotFound();
            res.Headers.CacheControl = "public, max-age=31536000, immutable";
            return Results.File(stream, "image/webp");
        });
        api.MapPut("/media/{id}/thumb", async (string id, HttpRequest req, Catalog c, IMediaStore store, CancellationToken ct) =>
        {
            if (Actor(req) is null) return ActorMissing();
            var m = c.With((_, _, _) => c.Media.All.GetValueOrDefault(id));
            if (m is null) return Results.NotFound();
            if (req.ContentLength > 400_000) return Bad("Vorschau höchstens 400 KB.");
            if (!(req.ContentType ?? "").StartsWith("image/")) return Bad("Vorschau: image/webp erwartet.");
            await store.PutAsync(m.Sha256 + ".thumb", req.Body, ct);
            return Results.Ok(new { ok = true });
        });

        // Blobs nach Schlüssel — für Werkzeuge und Kopierläufe zwischen Instanzen; kein Journal-Eintrag.
        api.MapMethods("/media/blob/{key}", new[] { "GET", "HEAD" }, async (string key, IMediaStore store, HttpResponse res, CancellationToken ct) =>
        {
            if (!MediaStores.ValidKey(key)) return Results.NotFound();
            var stream = await store.OpenAsync(key, ct);
            if (stream is null) return Results.NotFound();
            res.Headers.CacheControl = "public, max-age=31536000, immutable";
            return Results.File(stream, "application/octet-stream");
        });
        api.MapPut("/media/blob/{key}", async (string key, HttpRequest req, IMediaStore store, CancellationToken ct) =>
        {
            if (Actor(req) is null) return ActorMissing();
            if (!MediaStores.ValidKey(key)) return Bad("Schlüssel: sha256[.suffix]");
            if (key.Length == 64) { var (sha, _) = await store.PutAsync(req.Body, ct); if (sha != key) return Bad($"Inhalt hat Hash {sha}, nicht {key}."); }   // der Hash ist der Schlüssel — muss stimmen
            else await store.PutAsync(key, req.Body, ct);
            return Results.Ok(new { ok = true });
        });

        // Was im Speicher liegt. Zwei Zahlen
        // sehen ähnlich aus und sind es nicht: total sind alle Assets, renderable nur die, aus denen sich eine Vorschau
        // rechnen lässt (Bild oder PDF) — daran misst sich der Stand der Ableitungen.
        api.MapGet("/media/stats", (Catalog c) => c.With((_, _, _) =>
        {
            var alle = c.Media.All.Values.ToList();
            static string Art(string mime) =>
                mime.StartsWith("image/", StringComparison.OrdinalIgnoreCase) ? "Bild"
                : mime.Equals("application/pdf", StringComparison.OrdinalIgnoreCase) ? "PDF"
                : mime.StartsWith("video/", StringComparison.OrdinalIgnoreCase) ? "Video"
                : mime.StartsWith("audio/", StringComparison.OrdinalIgnoreCase) ? "Audio"
                : mime.StartsWith("text/", StringComparison.OrdinalIgnoreCase) ? "Text" : "Datei";
            var ableitungen = alle.SelectMany(m => m.Derived.Values).ToList();
            return new
            {
                total = alle.Count,
                bytes = alle.Sum(m => m.Bytes),
                renderable = alle.Count(m => m.IsRenderable),
                images = alle.Count(m => m.IsImage),
                unfiled = alle.Count(m => m.Folder is null),
                unused = alle.Count(m => !c.Relations.To(m.Id).Any()),
                shared = alle.GroupBy(m => m.Sha256).Count(g => g.Count() > 1),
                derived = new { count = ableitungen.Count, bytes = ableitungen.Sum(d => d.Bytes) },
                kinds = alle.GroupBy(m => Art(m.Mime)).Select(g => new { art = g.Key, count = g.Count(), bytes = g.Sum(m => m.Bytes) }).OrderByDescending(x => x.bytes).ToList(),
                largest = alle.OrderByDescending(m => m.Bytes).Take(5).Select(m => new { m.Id, m.Name, m.Bytes }).ToList(),
            };
        }));

        // Fehlbestand: Assets, deren Bytes im Store fehlen (z. B. zweite Instanz ohne Ursprung, oder Treiber gewechselt ohne Kopierlauf)
        api.MapGet("/media/missing", async (Catalog c, IMediaStore store, CancellationToken ct) =>
        {
            var all = c.With((_, _, _) => c.Media.All.Values.Select(m => (m.Id, m.Sha256, m.Name)).ToList());
            var missing = new List<object>();
            foreach (var (mid, sha, name) in all) if (!await store.ExistsAsync(sha, ct)) missing.Add(new { id = mid, sha256 = sha, name });
            return Results.Ok(new { total = all.Count, missing });
        });
        // Kopierlauf zwischen Treibern: alles aus `from` (Angabe wie JOURNALI_MEDIA), was hier fehlt
        api.MapPost("/media/copy", async (CopyRequest body, HttpRequest req, SwitchableMediaStore store, CancellationToken ct) =>
        {
            if (Actor(req) is null) return ActorMissing();
            if (body.From is null) return Bad("from: Einstellung des Quell-Speichers (driver, path | bucket, endpoint, key, secret, region)");
            IMediaStore source;
            try { source = store.Build(Unmask(body.From, store.Config)); } catch (Exception e) { return Bad(e.Message); }
            if (await source.ProbeAsync(ct) is { } perr) return Bad($"Quelle: {perr}");
            var log = new List<string>();
            var (copied, skipped, failed) = await MediaStores.CopyAsync(source, store, ct, k => { if (log.Count < 200) log.Add(k); });
            return Results.Ok(new { from = source.Kind, to = store.Kind, copied, skipped, failed, log });
        });

        // Hochladen: multipart mit Feld „file“; Kopf X-Actor wie bei jedem Befehl.
        api.MapPost("/media", async (HttpRequest req, Catalog c, IMediaStore store, JobRunner runner, CancellationToken ct) =>
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
            if (!result.Existed && result.View.Renderable) DeriveApi.Kick(c, runner, actor);   // Vorschauen rechnen lassen
            return Results.Ok(new { result.View.Id, result.View.Sha256, result.View.Bytes, result.View.Mime, result.View.Name, existed = result.Existed });
        }).DisableAntiforgery();

        // Von einer URL holen (Import: Bilder der Quelle als Assets). Nur http(s); 50 MB; Name aus dem Pfad, wenn keiner mitkommt.
        api.MapPost("/media/fetch", async (FetchRequest body, HttpRequest req, Catalog c, IMediaStore store, IHttpClientFactory http, JobRunner runner, CancellationToken ct) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (!Uri.TryCreate(body.Url, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https")) return Bad("url: http(s)-Adresse erwartet.");
            var client = http.CreateClient("media");
            using var res = await client.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!res.IsSuccessStatusCode) return Bad($"{uri.Host}: {(int)res.StatusCode} {res.ReasonPhrase}");
            if (res.Content.Headers.ContentLength > 50_000_000) return Bad("Grösser als 50 MB.");
            var (sha, bytes) = await store.PutAsync(await res.Content.ReadAsStreamAsync(ct), ct);
            if (bytes == 0) return Bad("Leere Antwort.");
            var mime = res.Content.Headers.ContentType?.MediaType ?? "application/octet-stream";
            var fromPath = Uri.UnescapeDataString(Path.GetFileName(uri.AbsolutePath));
            var name = Blank(body.Name) ?? (fromPath.Length > 0 ? fromPath : "datei");
            var result = c.With((_, _, write) =>
            {
                if (c.Media.BySha(sha) is { } have) return (View: MediaView.Of(have, c.Relations.To(have.Id).Count()), Existed: true);
                var entry = write(actor, Ids.Media(), Types.MediaCreated, new MediaCreated(sha, bytes, mime, name), null);
                return (View: MediaView.Of(c.Media.All[entry.Stream], 0), Existed: false);
            });
            if (!result.Existed && result.View.Renderable) DeriveApi.Kick(c, runner, actor);
            return Results.Ok(new { result.View.Id, result.View.Sha256, result.View.Bytes, result.View.Mime, result.View.Name, existed = result.Existed });
        });

        // Einstellungen → Storage: Treiber lesen (ohne Geheimnis), prüfen, speichern (media.json im Datenverzeichnis, nie im Journal)
        api.MapGet("/media/store", async (SwitchableMediaStore store, Catalog c, CancellationToken ct) =>
        {
            var total = c.With((_, _, _) => c.Media.All.Count);
            return Results.Ok(new { kind = store.Kind, config = store.Config.Masked(), total, error = await store.ProbeAsync(ct) });
        });
        api.MapPost("/media/store/probe", async (MediaConfig body, SwitchableMediaStore store, CancellationToken ct) =>
        {
            var cfg = Unmask(body, store.Config);
            try { var s = store.Build(cfg); return Results.Ok(new { kind = s.Kind, error = await s.ProbeAsync(ct) }); }
            catch (Exception e) { return Results.Ok(new { kind = cfg.Spec, error = e.Message }); }
        });
        api.MapPut("/media/store", async (MediaConfig body, HttpRequest req, SwitchableMediaStore store, JobRunner runner, CancellationToken ct) =>
        {
            if (Actor(req) is null) return ActorMissing();
            var cfg = Unmask(body, store.Config);
            if (await store.SwitchAsync(cfg, ct) is { } error) return Bad(error);
            MediaConfigFile.Save(runner.Dir, cfg);
            return Results.Ok(new { kind = store.Kind, config = store.Config.Masked() });
        });

        api.MapDelete("/media/{id}", (string id, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.RetireMedium(x, id)));
        api.MapPost("/media/{id}/attributes", (string id, AttributeSet b, HttpRequest req, Catalog c) =>
            TreeApi.Run(req, c, x => Commands.SetMediumAttribute(x, id, b.Attribute, b.Locale, b.Channel, b.Value, b.Values)));
        api.MapPut("/media/{id}/external/{system}", (string id, string system, ExternalLinked b, HttpRequest req, Catalog c) =>
            TreeApi.Run(req, c, x => Commands.LinkMediumExternal(x, id, system, b.Id)));
    }
}

/// <summary>Ein Medium in der Antwort — plus, an wie vielen Knoten es hängt.</summary>
public sealed record FetchRequest(string? Url, string? Name);
public sealed record FolderBody(string? Name, string? Parent, string? Folder);
public sealed record CopyRequest(MediaConfig? From);

public sealed record MediaView(string Id, string Sha256, long Bytes, string Mime, string Name, bool IsImage, List<ValueView> Values,
    Dictionary<string, string> External, int Used, int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor, string? Folder,
    bool Renderable = false, bool HasThumb = false)
{
    /// <summary>Kachel: Bilder haben immer eine, ein PDF erst, wenn der derive-Job seine erste Seite gerechnet hat
    ///. Die Oberfläche fragt danach, statt aus dem Mime zu raten.</summary>
    public static MediaView Of(Medium m, int used) => new(m.Id, m.Sha256, m.Bytes, m.Mime, m.Name, m.IsImage, ValueView.Of(m).ToList(),
        m.External, used, m.Entries, m.LastNumber, m.LastAt, m.LastActor, m.Folder,
        m.IsRenderable, m.IsImage || m.Derived.ContainsKey(Media.ThumbPreset));
}
