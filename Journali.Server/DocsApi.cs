using Journali.Core.Entries;

namespace Journali.Server;

/// <summary>
/// Dokumentensuche unter /api/docs (pflegestruktur §32).
/// Der Text der Dokumente liegt abgeleitet neben dem Journal (<see cref="DocText"/>); hier steht nur, wie man ihn
/// hineinbekommt und wieder herausfindet. Ein Treffer zeigt immer auf <b>Dokument und Knoten</b> — das ist der
/// Unterschied zu jeder allgemeinen Dokumentensuche: das PDF hängt am Produkt.
/// </summary>
public static class DocsApi
{
    /// <summary>Was ein Job wissen muss, um nur Neues zu lesen: das Medium, sein Hash und ob es schon im Index steht.</summary>
    public sealed record Pending(string Id, string Name, string Mime, string Sha256, long Bytes, bool Indexed);
    /// <summary>Was der Leser abliefert: die Abschnitte, dazu der Zustand — <c>text</c>, <c>scan</c> (keine Textebene,
    /// OCR nötig) oder <c>fehler</c> — und die Seitenzahl.</summary>
    public sealed record PutBody(string? Sha256, List<DocText.Chunk>? Chunks, string? State, int? Pages, string? Note);

    /// <summary>Was ein Erkenner wissen muss: das Medium im Zustand <c>scan</c>, sein Hash, Name, Art, Seiten.</summary>
    public sealed record Scan(string Id, string Name, string Mime, string Sha256, long Bytes, int? Pages);

    /// <summary>
    /// Die offene Postenliste der Texterkennung (27.09.2026): Dokumente, die der Leser als <c>scan</c> erkannt hat —
    /// keine Textebene, ein Bild von Text. Sie stehen im Index mit diesem Zustand, damit der Leser sie nicht in jeder
    /// Runde erneut versucht; hier holt sie der Erkenner. Auch diese Liste ist kein eigener Bestand, sondern eine Frage
    /// an den Index — ein abgebrochener Lauf lässt sie offen, der nächste findet dieselben. Liefert der Erkenner Text
    /// (<c>PUT /api/docs/{id}</c> mit <c>state: text</c>), ist der Posten erledigt; ein neuer Hash (neue Fassung) macht
    /// das Medium wieder zum Fall des Lesers, nicht des Erkenners.
    /// </summary>
    public static List<Scan> Scans(IReadOnlyDictionary<string, (string Sha, string State)> known, IEnumerable<Journali.Core.Projections.Medium> media, int limit) =>
        media.Where(m => known.TryGetValue(m.Id, out var k) && k.State == DocText.States.Scan && k.Sha == m.Sha256)
            .OrderBy(m => m.CreatedAt).Take(Math.Clamp(limit, 1, 5000))
            .Select(m => new Scan(m.Id, m.Name, m.Mime, m.Sha256, m.Bytes, null)).ToList();

    /// <summary>Womit wir umgehen können — den Rest (Bilder, Videos) liest kein Textwerkzeug.</summary>
    private static bool Readable(string mime) =>
        mime is "application/pdf" or "text/plain" or "text/html" or "text/markdown"
            or "application/msword" or "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            or "application/rtf" or "application/xml" or "text/xml";

    public static void Map(RouteGroupBuilder api)
    {
        // Stand: wie viel im Index steht und welche Dokumente noch fehlen (für den Job und die Anzeige)
        api.MapGet("/docs/status", async (Catalog c, DocText docs, bool pending = false, int limit = 500, CancellationToken ct = default) =>
        {
            if (!docs.Ready) return Results.Ok(new { ready = false, media = 0, chunks = 0L, scans = 0, errors = 0, pending = Array.Empty<Pending>() });
            var (media, chunks, scans, errors) = await docs.StatsAsync(ct);
            var known = pending ? await docs.IndexedAsync(ct) : new();
            // offen ist, was noch nie gelesen wurde oder sich seither geändert hat — ein erkannter Scan nicht (sonst
            // versuchte der Job ihn in jeder Runde erneut; er wartet auf OCR)
            var list = pending
                ? c.Read(_ => c.Media.All.Values.Where(m => Readable(m.Mime))
                    .Select(m => new Pending(m.Id, m.Name, m.Mime, m.Sha256, m.Bytes, known.TryGetValue(m.Id, out var s) && s.Sha == m.Sha256))
                    .Where(p => !p.Indexed).Take(Math.Clamp(limit, 1, 5000)).ToList())
                : [];
            return Results.Ok(new { ready = true, media, chunks, scans, errors, pending = list });
        });

        // Die Scans: was auf Texterkennung wartet. Der Erkenner holt die Liste, lädt die Datei, erkennt, und legt den
        // Text per PUT /api/docs/{id} ab — derselbe Weg wie der Leser, mit note "ocr".
        api.MapGet("/docs/scans", async (Catalog c, DocText docs, int limit = 200, CancellationToken ct = default) =>
        {
            if (!docs.Ready) return Results.Ok(new { ready = false, scans = Array.Empty<Scan>() });
            var known = await docs.IndexedAsync(ct);
            var list = c.Read(_ => Scans(known, c.Media.All.Values, limit));
            return Results.Ok(new { ready = true, scans = list });
        });

        // Text eines Dokuments ablegen — ersetzt, was da war (der Hash sagt, ob es sich überhaupt geändert hat)
        api.MapPut("/docs/{id}", async (string id, PutBody body, Catalog c, DocText docs, CancellationToken ct) =>
        {
            if (!docs.Ready) return ModelApi.Bad("Ohne Postgres gibt es keinen Dokumentindex.");
            var medium = c.Read(_ => c.Media.All.GetValueOrDefault(id));
            if (medium is null) return Results.NotFound();
            var chunks = (body.Chunks ?? []).Where(x => !string.IsNullOrWhiteSpace(x.Body)).ToList();
            var state = body.State switch { DocText.States.Scan => DocText.States.Scan, DocText.States.Error => DocText.States.Error, _ => chunks.Count > 0 ? DocText.States.Text : DocText.States.Scan };
            await docs.PutAsync(id, body.Sha256 ?? medium.Sha256, chunks, state, body.Pages, body.Note, ct);
            return Results.Ok(new { id, chunks = chunks.Count, state });
        });

        api.MapDelete("/docs/{id}", async (string id, DocText docs, CancellationToken ct) =>
            Results.Ok(new { removed = await docs.RemoveAsync(id, ct) }));

        // Gescheiterte wieder freigeben: der Job liest sie in der nächsten Runde erneut
        api.MapPost("/docs/retry", async (DocText docs, CancellationToken ct) =>
        {
            if (!docs.Ready) return ModelApi.Bad("Ohne Postgres gibt es keinen Dokumentindex.");
            return Results.Ok(new { freed = await docs.RetryFailedAsync(ct) });
        });

        // Suche: Wörter, Zahlen, Normen. under=<knoten> schränkt auf die Dokumente eines Teilbaums ein.
        api.MapGet("/docs/search", async (string q, Catalog c, DocText docs, int limit = 50, string? under = null, CancellationToken ct = default) =>
        {
            if (!docs.Ready) return Results.Ok(new { ready = false, hits = Array.Empty<object>() });
            // Medien des Teilbaums: was an den Knoten darunter hängt (Relationen zeigen auf das Medium)
            HashSet<string>? only = null;
            if (!string.IsNullOrWhiteSpace(under))
            {
                only = c.With((_, tree, _) =>
                {
                    var ids = new HashSet<string> { under };
                    var stack = new Stack<string>([under]);
                    while (stack.Count > 0) foreach (var kid in tree.Children(stack.Pop())) { if (ids.Add(kid.Id)) stack.Push(kid.Id); }
                    var media = new HashSet<string>();
                    foreach (var r in c.Relations.All.Values) if (ids.Contains(r.From)) media.Add(r.To);
                    return media;
                });
                if (only.Count == 0) return Results.Ok(new { ready = true, hits = Array.Empty<object>() });
            }
            var hits = await docs.SearchAsync(q, limit, only, ct);
            // Treffer anreichern: Name des Dokuments und die Knoten, an denen es hängt
            var view = c.With((model, tree, _) => hits.Select(h =>
            {
                var m = c.Media.All.GetValueOrDefault(h.Media);
                var nodes = c.Relations.To(h.Media)
                    .Select(r => tree.Nodes.GetValueOrDefault(r.From))
                    .Where(n => n is not null)
                    .DistinctBy(n => n!.Id)
                    .Take(5)
                    .Select(n => new { id = n!.Id, n.Role, label = NodeRow.LabelOf(tree, model, n) })
                    .ToList();
                return new
                {
                    media = h.Media, name = m?.Name ?? h.Media, mime = m?.Mime, h.Page, h.Heading,
                    snippet = h.Snippet, rank = Math.Round(h.Rank, 4), nodes,
                };
            }).ToList());
            return Results.Ok(new { ready = true, hits = view });
        });
    }
}
