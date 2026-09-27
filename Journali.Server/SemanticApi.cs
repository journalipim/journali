using System.Text;
using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Vektoren und Sinn (27.09.2026, pflegestruktur 35): die offene Postenliste der Einbettungen für den Job des Plugins
/// <c>embed</c>, die Ablage der Vektoren, die Frage an die Dokumente mit Quellen, und ähnliche Knoten. Die Wortsuche
/// bleibt in <see cref="DocsApi"/> und nimmt dort <c>mode=semantic|hybrid</c> an.
/// <para>Die offene Postenliste ist eine Frage an die Tabellen: Abschnitte ohne Vektor zu ihrem Hash und Modell
/// (<see cref="Vectors.PendingChunksAsync"/>), Knoten, deren Text einen anderen Hash hat als der eingebettete
/// (<see cref="PendingNodes"/>). Ein abgebrochener Lauf lässt sie offen, der nächste findet dieselben.</para>
/// </summary>
public static class SemanticApi
{
    public sealed record AskBody(string? Q, string? Under, int? K, string? Locale);
    public sealed record ChunkIn(string Media, string Sha256, int Seq, float[] Vector);
    public sealed record NodeIn(string Node, string Locale, string Hash, float[] Vector);
    public sealed record EmbedBody(string? Model, List<ChunkIn>? Chunks, List<NodeIn>? Nodes, List<string>? Gone);
    /// <summary>Der Text eines Knotens mit seinem Hash — was der Job einbettet.</summary>
    public sealed record KnotenText(string Node, string Locale, string Hash, string Text);
    /// <summary>Ein Auszug für die Antwort: Dokument, Abschnitt, Seite, Überschrift, der Text.</summary>
    public sealed record Auszug(string Media, int Seq, int? Page, string? Heading, string Body);

    /// <summary>
    /// Reciprocal Rank Fusion: zwei Reihen (Wörter, Sinn) werden eine — je Reihe zählt der Platz, nicht der Wert, denn
    /// ein Volltext-Rang und ein Kosinusabstand sind nicht vergleichbar. Was in beiden Reihen vorn steht, steht vorn.
    /// Eine leere Reihe ändert die Ordnung der anderen nicht.
    /// </summary>
    public static List<((string Media, int Seq) Key, double Score)> Rrf(IEnumerable<(string Media, int Seq)> a, IEnumerable<(string Media, int Seq)> b, int k = 60)
    {
        var score = new Dictionary<(string, int), double>(); var order = new List<(string, int)>();
        void Nimm(IEnumerable<(string, int)> reihe)
        {
            var i = 0;
            foreach (var key in reihe)
            {
                if (!score.ContainsKey(key)) { score[key] = 0; order.Add(key); }
                score[key] += 1.0 / (k + ++i);
            }
        }
        Nimm(a); Nimm(b);
        return order.Select(key => (key, score[key])).OrderByDescending(x => x.Item2).ThenBy(x => order.IndexOf(x.key)).ToList();
    }

    /// <summary>Knoten, deren Text noch nicht (oder mit anderem Hash) eingebettet ist.</summary>
    public static List<KnotenText> PendingNodes(IEnumerable<KnotenText> texte, IReadOnlyDictionary<(string Node, string Locale), string> known) =>
        texte.Where(t => !known.TryGetValue((t.Node, t.Locale), out var h) || h != t.Hash).ToList();

    /// <summary>Eingebettete Knoten, die es nicht mehr gibt — ihr Vektor geht mit dem nächsten PUT.</summary>
    public static List<string> GoneNodes(IEnumerable<KnotenText> texte, IReadOnlyDictionary<(string Node, string Locale), string> known)
    {
        var da = texte.Select(t => t.Node).ToHashSet();
        return known.Keys.Select(k => k.Node).Where(n => !da.Contains(n)).Distinct().ToList();
    }

    /// <summary>Die Texte aller Pflegeknoten, je Sprache des Modells einer, mit Hash — ein Knoten mit französischen Werten
    /// wird auf Französisch gefunden, nicht nur über die Leitsprache.</summary>
    public static List<KnotenText> KnotenTexte(Catalog c) => c.With((model, tree, _) =>
    {
        var locs = model.Locales.Keys.OrderBy(x => x, StringComparer.Ordinal).ToList();
        if (locs.Count == 0) locs = [model.MasterLocale ?? "de"];
        return tree.Nodes.Values.Where(n => n.Role is Roles.Group or Roles.Product or Roles.Variant)
            .OrderBy(n => n.Id, StringComparer.Ordinal)
            .SelectMany(n => locs.Select(loc => { var t = NodeText.Of(model, tree, n, loc); return new KnotenText(n.Id, loc, NodeText.Hash(t), t); })).ToList();
    });

    /// <summary>
    /// Die Frage an die Dokumente, wie sie an die KI geht: nur aus den nummerierten Auszügen, jede Aussage mit ihrer
    /// Nummer, und ein Satz, wenn die Auszüge nichts hergeben. Die Sprache der Antwort ist die der Frage.
    /// </summary>
    public static (string System, string User) Prompt(string frage, IReadOnlyList<Auszug> auszuege, IReadOnlyDictionary<string, string> namen)
    {
        const string system = "Du beantwortest Fragen zu Produktdokumenten ausschliesslich aus den nummerierten Auszügen. " +
            "Jede Aussage trägt die Nummer ihres Auszugs in eckigen Klammern, zum Beispiel [2]. Steht die Antwort nicht in den Auszügen, sagst du das in einem Satz. " +
            "Antworte in der Sprache der Frage, knapp und sachlich, ohne Einleitung.";
        var sb = new StringBuilder("Frage: ").Append(frage).Append("\n\nAuszüge:\n");
        for (var i = 0; i < auszuege.Count; i++)
        {
            var a = auszuege[i];
            sb.Append('[').Append(i + 1).Append("] ").Append(namen.GetValueOrDefault(a.Media, a.Media));
            if (a.Page is { } p) sb.Append(", Seite ").Append(p);
            if (!string.IsNullOrWhiteSpace(a.Heading)) sb.Append(", ").Append(a.Heading);
            sb.Append(":\n").Append(a.Body.Length > 1500 ? a.Body[..1500] : a.Body).Append("\n\n");
        }
        return (system, sb.ToString().TrimEnd());
    }

    private static object KnotenView(Catalog c, IEnumerable<Vectors.KnotenTreffer> hits) => c.With((model, tree, _) =>
        hits.Where(h => tree.Nodes.ContainsKey(h.Node)).Select(h =>
        {
            var n = tree.Nodes[h.Node];
            return new { id = n.Id, role = n.Role, label = NodeRow.LabelOf(tree, model, n), path = tree.Ancestors(n).Reverse().Select(a => NodeRow.LabelOf(tree, model, a)).ToList(), score = Math.Round(1 - h.Distance, 4) };
        }).ToList());

    public static void Map(RouteGroupBuilder api, string jobsDir)
    {
        // Stand: wie viele Abschnitte und Knoten einen Vektor haben, was offen ist — die Zahlen des Systemjobs embed
        api.MapGet("/docs/embed", async (Catalog c, Vectors vectors, Embedder embedder, string? model = null, CancellationToken ct = default) =>
        {
            var m = Blank(model) ?? embedder.Model;
            if (!vectors.Ready) return Results.Ok(new { ready = false, reason = vectors.Reason, model = m, plugin = embedder.Available, pluginReason = embedder.Reason, chunks = 0L, embedded = 0L, nodes = 0L, nodesTotal = 0, offen = 0L, gelesen = 0L, total = 0L });
            var (chunks, embedded, nodesDone) = await vectors.StatsAsync(m, ct);
            var known = await vectors.NodeHashesAsync(m, ct);
            var texte = KnotenTexte(c);
            var offeneKnoten = PendingNodes(texte, known).Count;
            return Results.Ok(new { ready = true, reason = (string?)null, model = m, plugin = embedder.Available, pluginReason = embedder.Reason, indexError = vectors.IndexError,
                chunks, embedded, nodes = nodesDone, nodesTotal = texte.Count, offen = (chunks - embedded) + offeneKnoten, gelesen = embedded + nodesDone, total = chunks + texte.Count });
        });

        // Die offene Postenliste: Abschnitte und Knoten ohne Vektor zu diesem Modell — der Job holt sie in Runden
        api.MapGet("/docs/embed/pending", async (Catalog c, Vectors vectors, Embedder embedder, int limit = 64, string? model = null, CancellationToken ct = default) =>
        {
            var m = Blank(model) ?? embedder.Model;
            if (!vectors.Ready) return Results.Ok(new { ready = false, reason = vectors.Reason, model = m, chunks = Array.Empty<object>(), nodes = Array.Empty<object>(), gone = Array.Empty<string>() });
            var n = Math.Clamp(limit, 1, 1000);
            var chunks = (await vectors.PendingChunksAsync(m, n, ct)).Select(o => new { o.Media, o.Sha256, o.Seq, text = Vectors.Passage(o.Heading, o.Body) }).ToList();
            var known = await vectors.NodeHashesAsync(m, ct);
            var texte = KnotenTexte(c);
            var nodes = PendingNodes(texte, known).Take(Math.Max(0, n - chunks.Count)).ToList();
            return Results.Ok(new { ready = true, reason = (string?)null, model = m, chunks, nodes, gone = GoneNodes(texte, known) });
        });

        // Vektoren ablegen — der Job liefert, was er gerechnet hat; das Modell steht dabei
        api.MapPut("/docs/embed", async (EmbedBody body, HttpRequest req, Vectors vectors, Embedder embedder, CancellationToken ct) =>
        {
            if (Actor(req) is not { } _) return ActorMissing();
            if (!vectors.Ready) return Bad("Erweiterung vector fehlt in dieser Datenbank.");
            var m = Blank(body.Model) ?? embedder.Model;
            var chunks = await vectors.PutChunksAsync(m, (body.Chunks ?? []).Select(x => new Vectors.ChunkVector(x.Media, x.Sha256, x.Seq, x.Vector)).ToList(), ct);
            var nodes = await vectors.PutNodesAsync(m, (body.Nodes ?? []).Select(x => new Vectors.NodeVector(x.Node, x.Locale, x.Hash, x.Vector)).ToList(), body.Gone, ct);
            return Results.Ok(new { model = m, chunks, nodes });
        });

        // Die Frage an die Dokumente: die besten Abschnitte (Wörter und Sinn verschnitten) gehen als Auszüge an die KI
        // des zahlenden Teams; die Antwort nennt ihre Quellen mit Nummer, Dokument und Seite.
        api.MapPost("/docs/ask", async (AskBody body, HttpRequest req, Catalog c, DocText docs, Vectors vectors, Embedder embedder, CancellationToken ct) =>
        {
            if (Actor(req) is not { } _) return ActorMissing();
            if (Blank(body.Q) is not { } frage) return Bad("q fehlt.");
            if (!docs.Ready) return Bad("Ohne Postgres gibt es keinen Dokumentindex.");
            HashSet<string>? only = null;
            if (Blank(body.Under) is { } u) { only = DocsApi.Unter(c, u); if (only.Count == 0) return Results.Ok(new { ready = true, empty = true, answer = (string?)null, sources = Array.Empty<object>(), warning = (string?)null }); }
            var k = Math.Clamp(body.K ?? 6, 1, 20);
            var worte = await docs.SearchAsync(frage, k * 2, only, ct);
            List<Vectors.Treffer> sinn = []; string? warnung = null;
            if (!vectors.Ready) warnung = vectors.Reason;
            else if (!embedder.Available) warnung = embedder.Reason;
            else try { var (m, v) = await embedder.EmbedAsync(frage, "query", ct); sinn = await vectors.SearchChunksAsync(m, v, k * 2, only, ct); }
                catch (Exception e) { warnung = e.Message; }
            var sinnMap = sinn.ToDictionary(s => (s.Media, s.Seq)); var wortMap = worte.ToDictionary(h => (h.Media, h.Seq));
            var auszuege = new List<Auszug>();
            foreach (var (key, _) in Rrf(worte.Select(h => (h.Media, h.Seq)), sinn.Select(s => (s.Media, s.Seq))).Take(k))
            {
                if (sinnMap.TryGetValue(key, out var s)) { auszuege.Add(new Auszug(s.Media, s.Seq, s.Page, s.Heading, s.Body)); continue; }
                var w = wortMap[key];
                var ganz = await docs.ChunkAsync(w.Media, w.Seq, ct);   // der Wort-Treffer hat nur den Ausschnitt — die KI braucht den Abschnitt
                auszuege.Add(new Auszug(w.Media, w.Seq, w.Page, w.Heading, ganz?.Body ?? w.Snippet.Replace("«", "").Replace("»", "")));
            }
            if (auszuege.Count == 0) return Results.Ok(new { ready = true, empty = true, answer = (string?)null, sources = Array.Empty<object>(), warning = warnung });
            var namen = c.Read(_ => auszuege.Select(a => a.Media).Distinct().ToDictionary(id => id, id => c.Media.All.GetValueOrDefault(id)?.Name ?? id));
            var (system, user) = Prompt(frage, auszuege, namen);
            var r = await AiApi.AskAsync(req, c, jobsDir, null, null, system, user, 1500, false, 1, "docs", ct);
            if (r.Fehler is not null) return r.Fehler;
            var sources = c.With((model, tree, _) => auszuege.Select((a, i) => new
            {
                n = i + 1, media = a.Media, name = namen[a.Media], a.Page, a.Heading, a.Seq,
                nodes = c.Relations.To(a.Media).Select(rel => tree.Nodes.GetValueOrDefault(rel.From)).Where(x => x is not null).DistinctBy(x => x!.Id).Take(5)
                    .Select(x => new { id = x!.Id, x.Role, label = NodeRow.LabelOf(tree, model, x) }).ToList(),
            }).ToList());
            return Results.Ok(new { ready = true, empty = false, answer = r.Text, sources, provider = r.Provider, model = r.Model, warning = warnung });
        });

        // Knoten nach Sinn: „Klebstoff für Holz aussen“ findet, was so beschrieben ist — ohne das Wort im Namen
        api.MapGet("/nodes/semantic", async (string q, Catalog c, Vectors vectors, Embedder embedder, int limit = 20, string? locale = null, CancellationToken ct = default) =>
        {
            if (!vectors.Ready) return Results.Ok(new { ready = false, reason = vectors.Reason, hits = Array.Empty<object>() });
            if (!embedder.Available) return Results.Ok(new { ready = false, reason = embedder.Reason, hits = Array.Empty<object>() });
            var loc = Blank(locale) ?? c.ReadModel(m => m.MasterLocale) ?? "de";
            try
            {
                var (model, vec) = await embedder.EmbedAsync(q, "query", ct);
                var hits = await vectors.SearchNodesAsync(model, vec, loc, limit, null, ct);
                return Results.Ok(new { ready = true, reason = (string?)null, hits = KnotenView(c, hits) });
            }
            catch (Exception e) { return Results.Ok(new { ready = false, reason = e.Message, hits = Array.Empty<object>() }); }
        });

        // Ähnliche Knoten: aus dem eigenen Vektor, ohne neue Einbettung — known sagt, ob der Knoten schon einen hat
        api.MapGet("/nodes/{id}/similar", async (string id, Catalog c, Vectors vectors, Embedder embedder, int limit = 8, string? locale = null, CancellationToken ct = default) =>
        {
            if (!vectors.Ready) return Results.Ok(new { ready = false, reason = vectors.Reason, known = false, hits = Array.Empty<object>() });
            var loc = Blank(locale) ?? c.ReadModel(m => m.MasterLocale) ?? "de";
            var (known, hits) = await vectors.SimilarNodesAsync(embedder.Model, id, loc, limit, ct);
            return Results.Ok(new { ready = true, reason = (string?)null, known, hits = KnotenView(c, hits) });
        });
    }
}
