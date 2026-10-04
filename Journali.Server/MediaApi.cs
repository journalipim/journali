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
    /// <summary>
    /// Content-Disposition inline mit dem Namen der Datei: ein ASCII-Rückfall für alte Browser und der volle Name als
    /// UTF-8 (RFC 5987), damit Umlaute ankommen. Anführungszeichen und Zeilenumbrüche fallen weg — sie brächen den Kopf.
    /// </summary>
    public static string Inline(string? name)
    {
        var n = string.IsNullOrWhiteSpace(name) ? "file" : name.Replace('"', '\'').Replace("\r", "").Replace("\n", "");
        var ascii = new string(n.Select(ch => ch < 128 ? ch : '_').ToArray());
        return $"inline; filename=\"{ascii}\"; filename*=UTF-8''{Uri.EscapeDataString(n)}";
    }

    /// <summary>Die Stichwörter eines Mediums — der vermehrbare Wert steht in den Listen, nicht in den Werten.</summary>
    private static IEnumerable<string> Stichworte(Medium m) =>
        m.Lists.Where(kv => kv.Key.Attribute == Model.KeywordAttribute).SelectMany(kv => kv.Value).Distinct(StringComparer.Ordinal);

    /// <summary>Die Wörter eines Dateinamens, klein und ohne Endung — „DS_TE-0105_de.pdf“ wird zu ds, te, 0105, de.</summary>
    private static HashSet<string> Worte(string name)
    {
        var ohneEndung = System.IO.Path.GetFileNameWithoutExtension(name) ?? name;
        return System.Text.RegularExpressions.Regex.Split(ohneEndung.ToLowerInvariant(), @"[^\p{L}\p{N}]+")
            .Where(w => w.Length > 1).ToHashSet(StringComparer.Ordinal);
    }

    /// <summary>
    /// Der Filter der Bibliothek an einer Stelle: Liste und Facetten müssen denselben nehmen, sonst zählen die
    /// Facetten etwas anderes, als die Liste zeigt.
    /// </summary>
    private static IEnumerable<Medium> Gefiltert(Catalog c, (string? Role, bool Admin) sicht, string? q, string? folder, bool deep, int minW, int minH,
        string? plugin, DateTimeOffset? from, DateTimeOffset? to, string? keyword, bool superseded = false, string? valid = null, string? state = null)
    {
        // Abgelöste Versionen bleiben im Abbild, damit Belege und Versionen sie auflösen — die Bibliothek zeigt sie nur auf Wunsch
        var all = superseded ? c.Media.All.Values.AsEnumerable() : c.Media.Current;
        // Sichtbarkeit (27.09.2026): ein Medium in einem Ordner, den die Rolle nicht sieht, ist für sie nicht da
        all = all.Where(m => c.Media.Visible(m, sicht.Role, sicht.Admin));
        // Frist: "yes" = gilt heute, "no" = gilt heute nicht (abgelaufen oder noch nicht), "expired" = abgelaufen
        var heute = DateOnly.FromDateTime(DateTime.Now);
        if (valid == "yes") all = all.Where(m => m.GueltigAm(heute));
        else if (valid == "no") all = all.Where(m => !m.GueltigAm(heute));
        else if (valid == "expired") all = all.Where(m => m.Abgelaufen(heute));
        // Zustand: "workflow:zustand" — der wirksame Zustand des Assets in diesem Workflow (Start, wenn nie ein Schritt ging)
        if (!string.IsNullOrWhiteSpace(state) && state.IndexOf(':') is var i and > 0 && c.Workflows.All.TryGetValue(state[..i], out var wfx) && wfx.AppliesToMedium())
        {
            var soll = state[(i + 1)..];
            all = all.Where(m => c.Workflows.StateOf(m.Id, wfx) == soll);
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var s = q.Trim();
            all = all.Where(m => m.Name.Contains(s, StringComparison.OrdinalIgnoreCase) || m.Id.Contains(s, StringComparison.OrdinalIgnoreCase)
                || m.Values.Values.Any(v => v.Contains(s, StringComparison.OrdinalIgnoreCase)));
        }
        // Mass: nur was einen gelesenen Kopf hat, kann die Grenze halten — ein ungelesenes Medium fällt heraus
        if (minW > 0) all = all.Where(m => m.Probe is { } p && p.Width >= minW);
        if (minH > 0) all = all.Where(m => m.Probe is { } p && p.Height >= minH);
        // Herkunft: "-" sind die von Hand hochgeladenen, sonst der Schlüssel der Schnittstelle
        if (plugin == "-") all = all.Where(m => m.Source?.Plugin is null);
        else if (!string.IsNullOrWhiteSpace(plugin)) all = all.Where(m => string.Equals(m.Source?.Plugin, plugin, StringComparison.OrdinalIgnoreCase));
        if (from is { } f0) all = all.Where(m => m.CreatedAt >= f0);
        if (to is { } t0) all = all.Where(m => m.CreatedAt <= t0);
        // Stichwörter: mehrere mit Komma, und sie gelten zusammen — "-" sind die ohne jedes
        if (keyword == "-") all = all.Where(m => !Stichworte(m).Any());
        else if (!string.IsNullOrWhiteSpace(keyword))
        {
            var noetig = keyword.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            all = all.Where(m => { var hat = Stichworte(m).ToHashSet(StringComparer.Ordinal); return noetig.All(hat.Contains); });
        }
        if (folder == "-") all = all.Where(m => m.Folder is null);
        else if (!string.IsNullOrWhiteSpace(folder))
        {
            var set = deep ? c.Media.FolderAndBelow(folder).ToHashSet() : new HashSet<string> { folder };
            all = all.Where(m => m.Folder is { } f && set.Contains(f));
        }
        return all;
    }

    /// <summary>Eine Herkunft aus den Angaben, oder null, wenn keine gemacht wurde.</summary>
    private static MediaSourced? Herkunft(string? plugin, string? profile, string? job, string? bezug, string? from)
    {
        var h = new MediaSourced(Blank(plugin), Blank(profile), Blank(job), Blank(bezug), Blank(from));
        return h is { Plugin: null, Profile: null, Job: null, Ref: null, From: null } ? null : h;
    }

    /// <summary>Das maskierte Geheimnis aus der Anzeige („••••“) heisst: das gespeicherte behalten.</summary>
    private static MediaConfig Unmask(MediaConfig body, MediaConfig current) =>
        body.Secret is null || body.Secret.StartsWith("••") ? body with { Secret = current.Secret } : body;

    /// <summary>Die kleinste Ableitung eines Mediums, die zu ihrem Preset passt (gleicher Fingerabdruck) — Ersatz für eine fehlende Vorschau.</summary>
    public static MediaPreset? KleinsteAbleitung(Medium m, IReadOnlyDictionary<string, MediaPreset> presets) =>
        m.Derived.Where(d => presets.TryGetValue(d.Key, out var p) && p.Fingerprint == d.Value.Fingerprint)
            .OrderBy(d => Math.Max(d.Value.Width, d.Value.Height)).Select(d => presets[d.Key]).FirstOrDefault();

    /// <summary>So viele Stichwörter nennen die Facetten höchstens (die häufigsten)</summary>
    public const int StichwortFacetten = 60;

    /// <summary>Eine Seite der sortierten Liste: ab <paramref name="skip"/> höchstens <paramref name="limit"/> (1 bis 5 000)</summary>
    public static IEnumerable<T> Seite<T>(IEnumerable<T> sortiert, int skip, int limit) => sortiert.Skip(Math.Max(0, skip)).Take(Math.Clamp(limit, 1, 5000));

    /// <summary>Die häufigsten <see cref="StichwortFacetten"/> Stichwörter und dazu die gewählten (Komma-Liste), häufigste zuerst</summary>
    public static IEnumerable<KeyValuePair<string, int>> HaeufigsteStichworte(Dictionary<string, int> zaehlung, string? gewaehlt)
    {
        var wahl = (gewaehlt ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries).ToHashSet(StringComparer.Ordinal);
        return zaehlung.OrderByDescending(kv => kv.Value).ThenBy(kv => kv.Key, StringComparer.Ordinal).Where((kv, i) => i < StichwortFacetten || wahl.Contains(kv.Key));
    }

    public static void Map(RouteGroupBuilder api)
    {
        // Liste, neueste zuerst; q sucht in Name und Werten
        // Bibliothek: folder = Ordner-Id | "-" (ohne Ordner) | leer (alle); deep = mit Unterordnern; sort = recent | name | size | used | date; desc
        // skip (04.10.2026): die Bibliothek lädt seitenweise — die Gesamtzahl nennen die Facetten (total)
        api.MapGet("/media", (HttpRequest req, Catalog c, string? q = null, int limit = 200, int skip = 0, string? folder = null, bool deep = false, string? sort = null, bool? desc = null,
            int minW = 0, int minH = 0, string? plugin = null, DateTimeOffset? from = null, DateTimeOffset? to = null, string? keyword = null, bool superseded = false, string? valid = null, string? state = null) =>
            c.Lesen((model, tree) =>
            {
                var all = Gefiltert(c, Auth.Sicht(req), q, folder, deep, minW, minH, plugin, from, to, keyword, superseded, valid, state);
                var rows = all.Select(m => (m, used: c.Relations.To(m.Id).Count()));
                var down = desc ?? (sort is null or "recent" or "date" or "size" or "used" or "pixels" or "created");   // Neuestes/Grösstes/Meistgenutztes zuerst, Namen A→Z
                Func<(Medium m, int used), object> key = sort switch
                {
                    "name" => x => x.m.Name,
                    "size" => x => x.m.Bytes,
                    "used" => x => x.used,
                    "date" => x => x.m.LastAt,
                    "pixels" => x => x.m.Pixels,
                    "created" => x => x.m.CreatedAt,
                    _ => x => x.m.LastNumber,
                };
                var sorted = sort == "name"
                    ? (down ? rows.OrderByDescending(x => x.m.Name, StringComparer.OrdinalIgnoreCase) : rows.OrderBy(x => x.m.Name, StringComparer.OrdinalIgnoreCase))
                    : (down ? rows.OrderByDescending(key).ThenBy(x => x.m.Name, StringComparer.OrdinalIgnoreCase) : rows.OrderBy(key).ThenBy(x => x.m.Name, StringComparer.OrdinalIgnoreCase));
                return Seite(sorted, skip, limit).Select(x => MediaView.Of(x.m, x.used, MediaWorkflowApi.States(c, x.m))).ToList();
            }));

        // Facetten: wonach sich filtern lässt, mit Anzahl. Gezählt wird über denselben Filter wie die Liste —
        // die Zahlen gehören zu dem, was zu sehen ist, nicht zur ganzen Bibliothek.
        api.MapGet("/media/facets", (HttpRequest req, Catalog c, string? q = null, string? folder = null, bool deep = false,
            int minW = 0, int minH = 0, string? plugin = null, DateTimeOffset? from = null, DateTimeOffset? to = null, string? keyword = null,
            bool superseded = false, string? valid = null, string? state = null) =>
            c.Lesen((model, _) =>
            {
                var alle = Gefiltert(c, Auth.Sicht(req), q, folder, deep, minW, minH, plugin, from, to, keyword, superseded, valid, state).ToList();
                var liste = model.Lists.GetValueOrDefault(Model.KeywordList);
                var stichwort = new Dictionary<string, int>(StringComparer.Ordinal);
                foreach (var m in alle) foreach (var k in Stichworte(m)) stichwort[k] = stichwort.GetValueOrDefault(k) + 1;
                return Results.Ok(new
                {
                    art = new[]
                    {
                        new { key = "image", label = "Bilder", n = alle.Count(m => m.IsImage) },
                        new { key = "doc", label = "Dokumente", n = alle.Count(m => !m.IsImage) },
                    },
                    herkunft = alle.GroupBy(m => m.Source?.Plugin ?? "-").OrderByDescending(g => g.Count()).ThenBy(g => g.Key, StringComparer.Ordinal)
                        .Select(g => new { key = g.Key, n = g.Count() }).ToList(),
                    // die häufigsten 60 und die gewählten (04.10.2026) — eine Bibliothek mit tausenden Stichwörtern war eine Zeile mit tausenden Chips
                    stichworte = HaeufigsteStichworte(stichwort, keyword)
                        .Select(kv => new { key = kv.Key, label = liste?.Values.GetValueOrDefault(kv.Key)?.Label, n = kv.Value }).ToList(),
                    stichworteMehr = Math.Max(0, stichwort.Count - StichwortFacetten),
                    ohneStichwort = alle.Count(m => !Stichworte(m).Any()),
                    abgelaufen = alle.Count(m => m.Abgelaufen(DateOnly.FromDateTime(DateTime.Now))),
                    // Zustände je Workflow, der für Assets gilt — Schlüssel "workflow:zustand" für den Filter
                    zustaende = alle.SelectMany(m => MediaWorkflowApi.States(c, m)).GroupBy(s => (s.Workflow, s.State))
                        .Select(g => new { key = g.Key.Workflow + ":" + g.Key.State, workflow = g.Key.Workflow, label = g.First().Label, state = g.Key.State, stateLabel = g.First().StateLabel, color = g.First().Color, n = g.Count() })
                        .OrderBy(x => x.workflow).ThenByDescending(x => x.n).ToList(),
                    total = alle.Count,
                });
            }));

        // Vorschläge für Stichwörter an einem Medium. Bei automatischem Import verschlagwortet niemand von Hand —
        // darum schlägt der Server vor, was er sehen kann, und ein Mensch nimmt an. Erst das Annehmen ist Pflege.
        api.MapGet("/media/{id}/suggestions", (string id, Catalog c, int limit = 12) =>
            c.Lesen((model, tree) =>
            {
                if (!c.Media.All.TryGetValue(id, out var m)) return (IResult)Results.NotFound();
                var liste = model.Lists.GetValueOrDefault(Model.KeywordList);
                if (liste is null) return Results.Ok(Array.Empty<object>());
                var schon = Stichworte(m).ToHashSet(StringComparer.Ordinal);
                var treffer = new Dictionary<string, string>(StringComparer.Ordinal);   // Wert → warum

                // 1. aus dem Dateinamen: ein Wort daraus ist der Wert oder steht in einer seiner Bezeichnungen
                var worte = Worte(m.Name);
                foreach (var v in liste.Values.Values)
                {
                    if (schon.Contains(v.Value) || treffer.ContainsKey(v.Value)) continue;
                    if (worte.Contains(v.Value.ToLowerInvariant()) || v.Label.Values.Any(l => worte.Contains(l.ToLowerInvariant())))
                        treffer[v.Value] = "Dateiname";
                }
                // 2. von den Nachbarn: was an denselben Knoten hängt, ist meist dasselbe Thema
                foreach (var r in c.Relations.To(m.Id))
                    foreach (var nachbar in c.Relations.From(r.From).Select(x => c.Media.All.GetValueOrDefault(x.To)).OfType<Medium>())
                    {
                        if (nachbar.Id == m.Id) continue;
                        foreach (var k in Stichworte(nachbar))
                            if (!schon.Contains(k) && !treffer.ContainsKey(k) && liste.Values.ContainsKey(k)) treffer[k] = "am selben Knoten";
                    }

                return Results.Ok(treffer.Take(Math.Clamp(limit, 1, 100))
                    .Select(kv => new { key = kv.Key, label = liste.Values.GetValueOrDefault(kv.Key)?.Label, why = kv.Value }).ToList());
            }));

        // Medienordner
        api.MapGet("/media/folders", (HttpRequest req, Catalog c) => c.Lesen((_, _) =>
        {
            var s = Auth.Sicht(req);
            var sichtbar = c.Media.All.Values.Where(m => c.Media.Visible(m, s.Role, s.Admin)).ToList();
            var count = sichtbar.Where(m => m.Folder is not null).GroupBy(m => m.Folder!).ToDictionary(g => g.Key, g => g.Count());
            return new
            {
                total = sichtbar.Count, unfiled = sichtbar.Count(m => m.Folder is null),
                // Ordner, die die Rolle nicht sieht, fehlen — mit allem darunter; roles: die eigene Einschränkung des Ordners
                folders = c.Media.Folders.Values.Where(f => c.Media.FolderVisible(f.Id, s.Role, s.Admin)).OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase)
                    .Select(f => new { f.Id, f.Name, f.Parent, media = count.GetValueOrDefault(f.Id), roles = f.VisibleTo }).ToList(),
            };
        }));
        api.MapPut("/media/folders/{id}/roles", (string id, TreeApi.RolesBody b, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.RestrictMediaFolder(x, id, b.Roles)));
        api.MapPost("/media/folders", (FolderBody b, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.CreateMediaFolder(x, b.Name, b.Parent)));
        api.MapPut("/media/folders/{id}/name", (string id, FolderBody b, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.RenameMediaFolder(x, id, b.Name)));
        api.MapPut("/media/folders/{id}/parent", (string id, FolderBody b, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.MoveMediaFolder(x, id, b.Parent)));
        api.MapDelete("/media/folders/{id}", (string id, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.RetireMediaFolder(x, id)));
        api.MapPut("/media/{id}/folder", (string id, FolderBody b, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.FileMedium(x, id, b.Folder)));

        api.MapGet("/media/{id}", (string id, Catalog c) =>
            c.Lesen((_, _) => c.Media.All.TryGetValue(id, out var m) ? MediaView.Of(m, c.Relations.To(m.Id).Count()) : null) is { } v ? Results.Ok(v) : Results.NotFound());

        // Die Datei: Hash-adressiert und unveränderlich, darf ewig im Cache bleiben.
        // Verwendungsnachweis: an welchen Knoten dieses Asset hängt. Dieselbe Form wie die Relationen eines Knotens
        // (RelationView, Richtung „in“) — das andere Ende ist dann der Knoten. Ein Stopp (stop=true) ist keine
        // Verwendung, sondern eine Sperre; er steht mit in der Liste und die Oberfläche kennzeichnet ihn.
        // take (04.10.2026): ein Logo an allen Knoten wären zehntausende Zeilen — mit take kommen die ersten und die Gesamtzahl ({ items, total })
        api.MapGet("/media/{id}/usage", (string id, HttpRequest req, Catalog c, int? take = null) =>
            c.Lesen((model, tree) =>
            {
                if (!c.Media.All.ContainsKey(id)) return Results.NotFound();
                var alle = c.Relations.To(id).Where(r => !tree.Nodes.TryGetValue(r.From, out var nn) || tree.Visible(nn, Auth.Sicht(req).Role, Auth.Sicht(req).Admin))   // Knoten, die die Rolle nicht sieht, nennt der Nachweis nicht
                    .OrderBy(r => r.Type).ThenBy(r => r.LastNumber).ToList();
                if (take is not { } t) return Results.Ok(alle.Select(r => RelationView.Of(tree, model, c.Media, r, "in", c.Workflows)).ToList());
                return Results.Ok(new { items = alle.Take(Math.Clamp(t, 1, 5000)).Select(r => RelationView.Of(tree, model, c.Media, r, "in", c.Workflows)).ToList(), total = alle.Count });
            }));

        api.MapGet("/media/{id}/file", async (string id, Catalog c, IMediaStore store, HttpResponse res, CancellationToken ct) =>
        {
            var m = c.Lesen((_, _) => c.Media.All.GetValueOrDefault(id));
            if (m is null) return Results.NotFound();
            var stream = await store.OpenAsync(m.Sha256, ct);
            if (stream is null) return Results.NotFound(Err("Datei {0} fehlt im Store.", m.Sha256));
            res.Headers.CacheControl = "public, max-age=31536000, immutable";
            // Der Name geht mit — sonst hiesse jeder Abruf „file.pdf“, der letzte Teil der Adresse (28.09.2026)
            res.Headers.ContentDisposition = Inline(m.Name);
            return Results.File(stream, m.Mime, enableRangeProcessing: true);
        });

        // Vorschau: Schlüssel sha.thumb im Store; gibt es sie nicht, die kleinste Ableitung, die der Job derive gerechnet hat (04.10.2026) —
        // sonst rechnet der Browser sie aus dem Original (MediaThumb.vue), aber nur bei kleinen Bildern.
        api.MapGet("/media/{id}/thumb", async (string id, Catalog c, IMediaStore store, HttpResponse res, CancellationToken ct) =>
        {
            var (m, ersatz) = c.Lesen((_, _) => { var x = c.Media.All.GetValueOrDefault(id); return (x, x is null ? null : KleinsteAbleitung(x, c.Media.Presets)); });
            if (m is null) return Results.NotFound();
            var stream = await store.OpenAsync(m.Sha256 + ".thumb", ct);
            var mime = "image/webp";
            if (stream is null && ersatz is { } e) { stream = await store.OpenAsync(m.Sha256 + "." + e.Key, ct); mime = e.Mime; }
            if (stream is null) return Results.NotFound();
            res.Headers.CacheControl = "public, max-age=31536000, immutable";
            return Results.File(stream, mime);
        });
        api.MapPut("/media/{id}/thumb", async (string id, HttpRequest req, Catalog c, IMediaStore store, CancellationToken ct) =>
        {
            if (Actor(req) is null) return ActorMissing();
            var m = c.Lesen((_, _) => c.Media.All.GetValueOrDefault(id));
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
            if (key.Length == 64) { var (sha, _) = await store.PutAsync(req.Body, ct); if (sha != key) return Bad("Inhalt hat Hash {0}, nicht {1}.", sha, key); }   // der Hash ist der Schlüssel — muss stimmen
            else await store.PutAsync(key, req.Body, ct);
            return Results.Ok(new { ok = true });
        });

        // Was im Speicher liegt. Zwei Zahlen
        // sehen ähnlich aus und sind es nicht: total sind alle Assets, renderable nur die, aus denen sich eine Vorschau
        // rechnen lässt (Bild oder PDF) — daran misst sich der Stand der Ableitungen.
        api.MapGet("/media/stats", (Catalog c) => c.Lesen((_, _) =>
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
            var all = c.Lesen((_, _) => c.Media.All.Values.Select(m => (m.Id, m.Sha256, m.Name)).ToList());
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
            if (await source.ProbeAsync(ct) is { } perr) return Bad("Quelle: {0}", perr);
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
            // Herkunft: wer über eine Schnittstelle hochlädt, sagt es hier — sonst bleibt das Medium ohne Herkunft (von Hand)
            var quelle = Herkunft(form["plugin"], form["profile"], form["job"], form["ref"], form["from"]);
            var result = c.With((_, _, write) =>
            {
                if (c.Media.BySha(sha) is { } have) return (View: MediaView.Of(have, c.Relations.To(have.Id).Count()), Existed: true);
                var entry = write(actor, Ids.Media(), Types.MediaCreated, new MediaCreated(sha, bytes, mime, name), null);
                if (quelle is { } h) write(actor, entry.Stream, Types.MediaSourced, h, null);
                var m = c.Media.All[entry.Stream];
                return (View: MediaView.Of(m, 0), Existed: false);
            });
            // Der Kopf wird nicht hier gelesen: bei tausend Assets wartete der Import sonst auf tausend Lesevorgänge.
            // Der Job probe holt es nach; läuft er schon, findet er das neue Medium in seiner nächsten Runde.
            if (!result.Existed) ProbeApi.Kick(c, runner, actor);
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
            if (!res.IsSuccessStatusCode) return Bad("{0}: {1} {2}", uri.Host, (int)res.StatusCode, res.ReasonPhrase);
            if (res.Content.Headers.ContentLength > 50_000_000) return Bad("Grösser als 50 MB.");
            var (sha, bytes) = await store.PutAsync(await res.Content.ReadAsStreamAsync(ct), ct);
            if (bytes == 0) return Bad("Leere Antwort.");
            var mime = res.Content.Headers.ContentType?.MediaType ?? "application/octet-stream";
            var fromPath = Uri.UnescapeDataString(Path.GetFileName(uri.AbsolutePath));
            var name = Blank(body.Name) ?? (fromPath.Length > 0 ? fromPath : "datei");
            // Bezug ist die Adresse, von der es kam — ohne sie wäre später nicht zu sagen, woher das Bild stammt
            var quelle = Herkunft(body.Plugin, body.Profile, body.Job, Blank(body.Ref) ?? uri.ToString(), body.From);
            var result = c.With((_, _, write) =>
            {
                if (c.Media.BySha(sha) is { } have) return (View: MediaView.Of(have, c.Relations.To(have.Id).Count()), Existed: true);
                var entry = write(actor, Ids.Media(), Types.MediaCreated, new MediaCreated(sha, bytes, mime, name), null);
                if (quelle is { } h) write(actor, entry.Stream, Types.MediaSourced, h, null);
                return (View: MediaView.Of(c.Media.All[entry.Stream], 0), Existed: false);
            });
            if (!result.Existed) ProbeApi.Kick(c, runner, actor);
            if (!result.Existed && result.View.Renderable) DeriveApi.Kick(c, runner, actor);
            return Results.Ok(new { result.View.Id, result.View.Sha256, result.View.Bytes, result.View.Mime, result.View.Name, existed = result.Existed });
        });

        // Einstellungen → Storage: Treiber lesen (ohne Geheimnis), prüfen, speichern (im Tresor, nie im Journal; die anderen Server folgen binnen 10 s)
        api.MapGet("/media/store", async (SwitchableMediaStore store, Catalog c, CancellationToken ct) =>
        {
            var total = c.Lesen((_, _) => c.Media.All.Count);
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

        // Herkunft nachtragen — für Bestand, der vor dieser Version ohne sie entstand, und für Importeure, die das
        // Medium erst anlegen und dann wissen, aus welchem Profil es kam. Gesetzte Felder ergänzen, nichts wird gelöscht.
        api.MapPut("/media/{id}/source", (string id, SourceBody b, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (Herkunft(b.Plugin, b.Profile, b.Job, b.Ref, b.From) is not { } h) return Bad("Herkunft: plugin, profile, job, ref oder from.");
            return c.With((_, _, write) =>
            {
                if (!c.Media.All.ContainsKey(id)) return Results.NotFound();
                if (h.From is { } q && !c.Media.All.ContainsKey(q)) return Bad("Medium {0} unbekannt.", q);
                write(actor, id, Types.MediaSourced, h, null);
                return Results.Ok(MediaView.Of(c.Media.All[id], c.Relations.To(id).Count()));
            });
        });

        api.MapDelete("/media/{id}", (string id, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.RetireMedium(x, id)));
        // Version: dieses Medium durch ein anderes ersetzen — die Zuordnungen wandern, der Vorgänger bleibt auflösbar
        api.MapPost("/media/{id}/supersede", (string id, SupersedeBody b, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.SupersedeMedium(x, id, b.By)));
        api.MapPost("/media/{id}/attributes", (string id, AttributeSet b, HttpRequest req, Catalog c) =>
            TreeApi.Run(req, c, x => Commands.SetMediumAttribute(x, id, b.Attribute, b.Locale, b.Channel, b.Value, b.Values)));
        api.MapPut("/media/{id}/external/{system}", (string id, string system, ExternalLinked b, HttpRequest req, Catalog c) =>
            TreeApi.Run(req, c, x => Commands.LinkMediumExternal(x, id, system, b.Id)));
    }
}

/// <summary>Ein Medium in der Antwort — plus, an wie vielen Knoten es hängt.</summary>
public sealed record FetchRequest(string? Url, string? Name, string? Plugin = null, string? Profile = null, string? Job = null, string? Ref = null, string? From = null);
public sealed record FolderBody(string? Name, string? Parent, string? Folder);
public sealed record CopyRequest(MediaConfig? From);
/// <summary>Herkunft nachtragen: Schnittstelle, Profil, Job, Bezug an der Quelle, Medium der Abstammung.</summary>
public sealed record SourceBody(string? Plugin, string? Profile, string? Job, string? Ref, string? From);
/// <summary>Version: das Medium, das dieses ersetzt.</summary>
public sealed record SupersedeBody(string? By);

public sealed record MediaView(string Id, string Sha256, long Bytes, string Mime, string Name, bool IsImage, List<ValueView> Values,
    Dictionary<string, string> External, int Used, int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor, string? Folder,
    bool Renderable = false, bool HasThumb = false, MediaProbed? Probe = null, MediaSourced? Source = null,
    DateTimeOffset CreatedAt = default, string CreatedBy = "", long Pixels = 0, string? SupersededBy = null, string? Supersedes = null,
    bool Valid = true, bool Expired = false, List<MediaWorkflowApi.MediaState>? Workflow = null)
{
    /// <summary>Kachel: Bilder haben immer eine, ein PDF erst, wenn der derive-Job seine erste Seite gerechnet hat
    ///. Die Oberfläche fragt danach, statt aus dem Mime zu raten.</summary>
    public static MediaView Of(Medium m, int used, List<MediaWorkflowApi.MediaState>? workflow = null) => new(m.Id, m.Sha256, m.Bytes, m.Mime, m.Name, m.IsImage, ValueView.Of(m).ToList(),
        m.External, used, m.Entries, m.LastNumber, m.LastAt, m.LastActor, m.Folder,
        m.IsRenderable, m.IsImage || m.Derived.ContainsKey(Media.ThumbPreset),
        m.Probe, m.Source, m.CreatedAt, m.CreatedBy, m.Pixels, m.SupersededBy, m.Supersedes,
        m.GueltigAm(DateOnly.FromDateTime(DateTime.Now)), m.Abgelaufen(DateOnly.FromDateTime(DateTime.Now)), workflow);
}
