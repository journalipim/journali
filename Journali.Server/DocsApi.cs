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
    public sealed record PutBody(string? Sha256, List<DocText.Chunk>? Chunks, string? State, int? Pages, string? Note, List<DocText.Table>? Tables = null);

    /// <summary>Was der Leser an Tabellen abliefert, bereinigt: nur Tabellen mit Zeilen, nur Zeilen mit zwei Zellen —
    /// eine Zeile mit einer Zelle ist Text, kein Schlüssel/Wert (27.09.2026).</summary>
    public static List<DocText.Table> Tabellen(IEnumerable<DocText.Table>? tables) =>
        (tables ?? []).Select(t => t with { Rows = (t.Rows ?? []).Where(r => r is { Length: >= 2 } && !string.IsNullOrWhiteSpace(r[0])).ToList() })
            .Where(t => t.Rows.Count > 0).Select((t, i) => t with { Seq = i }).ToList();

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
        media.Where(m => IstScan(known, m))
            .OrderBy(m => m.CreatedAt).Take(Math.Clamp(limit, 1, 5000))
            .Select(m => new Scan(m.Id, m.Name, m.Mime, m.Sha256, m.Bytes, null)).ToList();

    /// <summary>Wartet auf Texterkennung: ein Dokument, das der Leser als <c>scan</c> kennt — oder ein Bild mit dem Stichwort
    /// „Text erkennen“ (<see cref="Model.OcrKeyword"/>), solange der Index es nicht zu seinem Hash erkannt oder verworfen hat.
    /// Bilder stehen sonst nie im Index (<see cref="Readable"/>); das Stichwort stellt eines ausdrücklich hinein (34 J).</summary>
    public static bool IstScan(IReadOnlyDictionary<string, (string Sha, string State)> known, Journali.Core.Projections.Medium m)
    {
        var bekannt = known.TryGetValue(m.Id, out var k) && k.Sha == m.Sha256;
        if (bekannt && k.State == DocText.States.Scan) return true;
        return ZurErkennung(m) && !bekannt;
    }

    /// <summary>Ein Bild, das ausdrücklich zur Texterkennung steht: Stichwort <c>ocr</c> am Medium.</summary>
    public static bool ZurErkennung(Journali.Core.Projections.Medium m) =>
        m.Mime.StartsWith("image/") && m.Lists.Where(kv => kv.Key.Attribute == Model.KeywordAttribute).SelectMany(kv => kv.Value).Contains(Model.OcrKeyword);

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
            var (media, chunks, scansIndex, errors) = await docs.StatsAsync(ct);
            var known = await docs.IndexedAsync(ct);
            // dazu die Bilder mit Stichwort „Text erkennen“, die der Index noch nicht kennt — sie zählen als Scan
            var scans = scansIndex + c.Read(_ => c.Media.All.Values.Count(m => ZurErkennung(m) && !(known.TryGetValue(m.Id, out var k) && k.Sha == m.Sha256)));
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
            var tables = Tabellen(body.Tables);
            await docs.PutAsync(id, body.Sha256 ?? medium.Sha256, chunks, state, body.Pages, body.Note, tables, ct);
            return Results.Ok(new { id, chunks = chunks.Count, state, tables = tables.Count });
        });

        // Die Tabellen eines Dokuments (34 L): für den Dialog am Knoten. state null = noch nicht gelesen (oder eine
        // neue Fassung seit dem Lesen) — der Dialog stösst den Job an und fragt nach.
        api.MapGet("/docs/{id}/tables", async (string id, Catalog c, DocText docs, CancellationToken ct) =>
        {
            if (!docs.Ready) return Results.Ok(new { ready = false, state = (string?)null, tables = Array.Empty<DocText.Table>() });
            var medium = c.Read(_ => c.Media.All.GetValueOrDefault(id));
            if (medium is null) return Results.NotFound();
            var (state, sha, tables) = await docs.TablesAsync(id, ct);
            var aktuell = sha == medium.Sha256;
            return Results.Ok(new { ready = true, state = aktuell ? state : null, tables = aktuell ? tables : [] });
        });

        api.MapDelete("/docs/{id}", async (string id, DocText docs, Vectors vectors, CancellationToken ct) =>
            Results.Ok(new { removed = await docs.RemoveAsync(id, ct) + await vectors.RemoveMediaAsync(id, ct) }));

        // Gescheiterte wieder freigeben: der Job liest sie in der nächsten Runde erneut
        api.MapPost("/docs/retry", async (DocText docs, CancellationToken ct) =>
        {
            if (!docs.Ready) return ModelApi.Bad("Ohne Postgres gibt es keinen Dokumentindex.");
            return Results.Ok(new { freed = await docs.RetryFailedAsync(ct) });
        });

        // Suche: Wörter, Zahlen, Normen — mode=text (Vorgabe). mode=semantic sucht nach Sinn über die Vektoren (35),
        // mode=hybrid verschneidet beides (RRF: der Platz je Reihe zählt, nicht der Wert). under=<knoten> schränkt auf
        // die Dokumente eines Teilbaums ein. warning sagt, warum es beim Sinn nicht ging — die Wörter kommen trotzdem.
        api.MapGet("/docs/search", async (string q, Catalog c, DocText docs, Vectors vectors, Embedder embedder, int limit = 50, string? under = null, string mode = "text", CancellationToken ct = default) =>
        {
            if (!docs.Ready) return Results.Ok(new { ready = false, hits = Array.Empty<object>() });
            HashSet<string>? only = null;
            if (!string.IsNullOrWhiteSpace(under))
            {
                only = Unter(c, under);
                if (only.Count == 0) return Results.Ok(new { ready = true, mode, warning = (string?)null, hits = Array.Empty<object>() });
            }
            var n = Math.Clamp(limit, 1, 500);
            var worte = mode == "semantic" ? [] : await docs.SearchAsync(q, n, only, ct);
            List<Vectors.Treffer> sinn = []; string? warnung = null;
            if (mode is "semantic" or "hybrid")
            {
                if (!vectors.Ready) warnung = vectors.Reason;
                else if (!embedder.Available) warnung = embedder.Reason;
                else try { var (model, vec) = await embedder.EmbedAsync(q, "query", ct); sinn = await vectors.SearchChunksAsync(model, vec, n, only, ct); }
                    catch (Exception e) { warnung = e.Message; }
            }
            var wortMap = worte.ToDictionary(h => (h.Media, h.Seq)); var sinnMap = sinn.ToDictionary(x => (x.Media, x.Seq));
            var reihe = SemanticApi.Rrf(worte.Select(h => (h.Media, h.Seq)), sinn.Select(x => (x.Media, x.Seq))).Take(n).ToList();
            var view = c.Lesen((model, tree) => reihe.Select(r =>
            {
                wortMap.TryGetValue(r.Key, out var w); sinnMap.TryGetValue(r.Key, out var x);
                return HitView(c, model, tree, r.Key.Media, r.Key.Seq, w?.Page ?? x?.Page, w?.Heading ?? x?.Heading, w?.Snippet ?? Ausschnitt(x!.Body), w?.Rank ?? 0, x is null ? null : Math.Round(1 - x.Distance, 4));
            }).ToList());
            return Results.Ok(new { ready = true, mode, warning = warnung, hits = view });
        });

        // Der Text eines Dokuments, wie der Index ihn hat — für den Export (Plugin rag) und zum Nachlesen
        api.MapGet("/docs/{id}/text", async (string id, Catalog c, DocText docs, CancellationToken ct) =>
        {
            if (!docs.Ready) return Results.Ok(new { ready = false, state = (string?)null, chunks = Array.Empty<DocText.Chunk>() });
            if (c.Read(_ => c.Media.All.GetValueOrDefault(id)) is not { } medium) return Results.NotFound();
            var (state, sha, chunks) = await docs.ChunksAsync(id, ct);
            var aktuell = sha == medium.Sha256;
            return Results.Ok(new { ready = true, state = aktuell ? state : null, chunks = aktuell ? chunks : [] });
        });
    }

    /// <summary>Die Medien eines Teilbaums: was an den Knoten darunter hängt (Relationen zeigen auf das Medium).</summary>
    public static HashSet<string> Unter(Catalog c, string under) => c.Lesen((_, tree) =>
    {
        var ids = new HashSet<string> { under };
        var stack = new Stack<string>([under]);
        while (stack.Count > 0) foreach (var kid in tree.Children(stack.Pop())) { if (ids.Add(kid.Id)) stack.Push(kid.Id); }
        var media = new HashSet<string>();
        foreach (var r in c.Relations.All.Values) if (ids.Contains(r.From)) media.Add(r.To);
        return media;
    });

    /// <summary>Der Anfang eines Abschnitts als Ausschnitt — die Sinnsuche hat keine Fundstellen zu markieren.</summary>
    public static string Ausschnitt(string body, int max = 240) => body.Length <= max ? body : body[..max].TrimEnd() + " …";

    /// <summary>Ein Treffer zeigt immer auf Dokument und Knoten: Name des Dokuments und die Knoten, an denen es hängt.</summary>
    public static object HitView(Catalog c, Journali.Core.Projections.ModelCatalog model, Journali.Core.Projections.Tree tree, string media, int seq, int? page, string? heading, string snippet, double rank, double? score)
    {
        var m = c.Media.All.GetValueOrDefault(media);
        var nodes = c.Relations.To(media)
            .Select(r => tree.Nodes.GetValueOrDefault(r.From))
            .Where(n => n is not null)
            .DistinctBy(n => n!.Id)
            .Take(5)
            .Select(n => new { id = n!.Id, n.Role, label = NodeRow.LabelOf(tree, model, n) })
            .ToList();
        return new { media, name = m?.Name ?? media, mime = m?.Mime, seq, page, heading, snippet, rank = Math.Round(rank, 4), score, nodes };
    }
}
