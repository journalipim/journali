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
    /// <summary>Ein Knoten in einer Sprache mit dem Hash seines Textes — den Text selbst (was der Job einbettet) tragen nur die Posten einer Runde
    /// (<see cref="MitText"/>); für alle Knoten gemerkt waren es 158 MB.</summary>
    public sealed record KnotenText(string Node, string Locale, string Hash, string? Text = null);
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
    /// <summary>
    /// Der Text jedes Knotens, einmal je Journalstand gerechnet (27.09.2026). Vorher baute ihn jede Anfrage neu — bei
    /// 2 253 Knoten je Sprache mit Hash, und die Jobansicht fragt den Stand alle fünf Sekunden: die Instanz rechnete
    /// dauernd an derselben Liste und hielt dabei die Lesesperre, hinter der jeder Schreibvorgang wartet. Solange kein
    /// Eintrag dazukommt, ändert sich kein Text — der Stand des Journals ist darum der ganze Schlüssel.
    /// </summary>
    private static (Catalog? Von, long Head, List<KnotenText> Liste) _texte = (null, -1, []);

    private static readonly object _rechnen = new();

    /// <summary>
    /// Ströme des Modells: ein Eintrag dort kann jeden Text ändern (Bezeichnung eines Attributs, eines Listenwerts, eine Einheit, die Sprachen) — dann wird
    /// alles neu gerechnet. Ein Strom ohne Doppelpunkt ist ein Knoten; alle übrigen (Jobs, Teams, Server …) ändern keinen Text.
    /// </summary>
    public static readonly string[] ModellStroeme = [Model.LocaleStream, Model.AttributeStream, Model.ListStream, Model.FamilyStream, Model.UnitStream,
        Model.TermStream, Model.GroupStream, "settings:"];

    /// <summary>Ab so vielen neuen Einträgen wird alles neu gerechnet: die Liste der betroffenen Knoten zu lesen, kostete dann mehr.</summary>
    private const int NachrechnenBis = 20_000;

    public static List<KnotenText> KnotenTexte(Catalog c)
    {
        var head = c.Head;
        if (ReferenceEquals(_texte.Von, c) && _texte.Head == head) return _texte.Liste;
        // Nur einer rechnet; wer inzwischen wartete, findet die fertige Liste vor (Stand, Postenliste und Job fragen gleichzeitig)
        lock (_rechnen)
        {
            var alt = _texte;
            if (ReferenceEquals(alt.Von, c) && alt.Head == head) return alt.Liste;
            // Nachrechnen statt neu rechnen (04.10.2026): nur die Knoten, auf deren Strom seither ein Eintrag kam, mit ihren Nachkommen — ihr Pfad und ihr
            // Name hängen an ihm. Vorher rechnete jeder neue Journalstand alle 37 000 Texte neu.
            var betroffen = ReferenceEquals(alt.Von, c) && alt.Head >= 0 ? Betroffen(c, alt.Head, head) : null;
            var liste = betroffen is null ? Berechne(c) : Nachrechnen(c, alt.Liste, betroffen);
            _texte = (c, head, liste);
            return liste;
        }
    }

    /// <summary>Die Knoten, auf deren Strom nach <paramref name="von"/> bis <paramref name="bis"/> ein Eintrag kam — null, wenn alles neu zu rechnen ist
    /// (ein Eintrag im Modell, zu viele Einträge).</summary>
    public static HashSet<string>? Betroffen(Catalog c, long von, long bis)
    {
        var knoten = new HashSet<string>(StringComparer.Ordinal);
        var n = 0;
        foreach (var e in c.EintraegeNach(von))
        {
            if (e.Number > bis) break;
            if (++n > NachrechnenBis) return null;
            if (!e.Stream.Contains(':')) knoten.Add(e.Stream);
            else if (ModellStroeme.Any(p => e.Stream.StartsWith(p, StringComparison.Ordinal))) return null;
        }
        return knoten;
    }

    private static List<KnotenText> Nachrechnen(Catalog c, List<KnotenText> alt, HashSet<string> betroffen)
    {
        if (betroffen.Count == 0) return alt;
        // mit den Nachkommen; wer nicht mehr da ist, fällt heraus
        var neu = c.Lesen((_, tree) =>
        {
            var alle = new HashSet<string>(betroffen, StringComparer.Ordinal);
            foreach (var id in betroffen) foreach (var d in tree.DescendantsDeepestFirst(id)) alle.Add(d.Id);
            return alle;
        });
        var frisch = Berechne(c, neu);
        return alt.Where(t => !neu.Contains(t.Node)).Concat(frisch)
            .OrderBy(t => t.Node, StringComparer.Ordinal).ThenBy(t => t.Locale, StringComparer.Ordinal).ToList();
    }

    /// <summary>Knoten je Teil unter der Lesesperre. 02.10.2026: der Baum mit 18 600 Knoten brauchte 13 Sekunden an einem Stück, und ein Schreiber, der in dieser Zeit
    /// wartete, hielt jeden neuen Leser an (die Gesundheitsabfrage stand 10,5 s). In Teilen kommt der Schreiber nach einem Teil dran.</summary>
    private const int KnotenJeTeil = 100;

    /// <summary>Die Posten mit ihrem Text — für die Runde des Jobs. Der Hash kommt aus demselben Text: hat sich der Knoten seit der Liste geändert,
    /// passt er trotzdem zum Text, den der Job einbettet.</summary>
    public static List<KnotenText> MitText(Catalog c, IEnumerable<KnotenText> posten) => c.Lesen((model, tree) => posten
        .Select(p => tree.Nodes.TryGetValue(p.Node, out var n) ? NodeText.Of(model, tree, n, p.Locale) is var t ? p with { Hash = NodeText.Hash(t), Text = t } : p : null)
        .OfType<KnotenText>().ToList());

    /// <param name="nur">Nur diese Knoten (zum Nachrechnen) — ohne Angabe alle.</param>
    public static List<KnotenText> Berechne(Catalog c, IReadOnlySet<string>? nur = null)
    {
        var (locs, ids) = c.Lesen((model, tree) =>
        {
            var l = model.Locales.Keys.OrderBy(x => x, StringComparer.Ordinal).ToList();
            if (l.Count == 0) l = [model.MasterLocale ?? "de"];
            var knoten = nur is null ? tree.Nodes.Values : nur.Select(id => tree.Nodes.GetValueOrDefault(id)).OfType<Node>();
            return (l, knoten.Where(n => n.Role is Roles.Group or Roles.Product or Roles.Variant).Select(n => n.Id).Order(StringComparer.Ordinal).ToList());
        });
        var namen = new Dictionary<string, string>(StringComparer.Ordinal);   // Name je Knoten, einmal je Lauf
        long nameTicks = 0, textTicks = 0;                                     // wohin die Zeit geht: Namen auflösen oder Texte bauen (steht in der Zeile „langsam:“)
        var liste = new List<KnotenText>(ids.Count * locs.Count);
        foreach (var teil in ids.Chunk(KnotenJeTeil))
            c.Lesen((model, tree) =>
            {
                string Name(Node x)
                {
                    if (namen.TryGetValue(x.Id, out var l)) return l;
                    var t0 = System.Diagnostics.Stopwatch.GetTimestamp();
                    try { return namen[x.Id] = NodeRow.LabelOf(tree, model, x); } finally { nameTicks += System.Diagnostics.Stopwatch.GetTimestamp() - t0; }
                }
                var t1 = System.Diagnostics.Stopwatch.GetTimestamp();
                foreach (var id in teil)
                {
                    if (!tree.Nodes.TryGetValue(id, out var n)) continue;   // inzwischen entfernt
                    foreach (var loc in locs) liste.Add(new KnotenText(n.Id, loc, NodeText.HashOf(model, tree, n, loc, Name)));
                }
                textTicks += System.Diagnostics.Stopwatch.GetTimestamp() - t1;
                return 0;
            });
        Teilzeit.Notiere("names", nameTicks * 1000 / System.Diagnostics.Stopwatch.Frequency);
        Teilzeit.Notiere("texts (with names)", textTicks * 1000 / System.Diagnostics.Stopwatch.Frequency);
        return liste;
    }

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

    private static object KnotenView(Catalog c, IEnumerable<Vectors.KnotenTreffer> hits) => c.Lesen((model, tree) =>
        hits.Where(h => tree.Nodes.ContainsKey(h.Node)).Select(h =>
        {
            var n = tree.Nodes[h.Node];
            return new { id = n.Id, role = n.Role, label = NodeRow.LabelOf(tree, model, n), path = tree.Ancestors(n).Reverse().Select(a => NodeRow.LabelOf(tree, model, a)).ToList(), score = Math.Round(1 - h.Distance, 4) };
        }).ToList());

    // Der Stand der Einbettungen für die Anzeige, je Modell gemerkt: er gilt, solange das Journal auf demselben Eintrag steht und weder Vektoren
    // (PUT /docs/embed) noch Dokumenttexte (DocText) geschrieben wurden — beide verwerfen ihn. Bis 14.10.2026 galt er 20 Sekunden; der Takt des
    // JobRunners fragt aber höchstens einmal je Minute, traf ihn nie und rechnete jedes Mal gut eine Sekunde (Zählen und Hashes in der Datenbank).
    // Die Höchstdauer fängt ab, was ein anderer Server in dieselbe Datenbank schreibt.
    private static readonly Dictionary<string, (DateTime Wann, long Kopf, object Stand)> _stand = new();
    private static readonly TimeSpan StandDauer = TimeSpan.FromMinutes(10);
    public static object? StandAlt(string modell, long kopf) { lock (_stand) return _stand.TryGetValue(modell, out var e) && e.Kopf == kopf && DateTime.UtcNow - e.Wann < StandDauer ? e.Stand : null; }
    public static void StandMerken(string modell, long kopf, object stand) { lock (_stand) _stand[modell] = (DateTime.UtcNow, kopf, stand); }
    public static void StandVerwerfen() { lock (_stand) _stand.Clear(); }

    public static void Map(RouteGroupBuilder api, string jobsDir)
    {
        // Stand: wie viele Abschnitte und Knoten einen Vektor haben, was offen ist — die Zahlen des Systemjobs embed
        api.MapGet("/docs/embed", async (Catalog c, Vectors vectors, Embedder embedder, string? model = null, CancellationToken ct = default) =>
        {
            var m = Blank(model) ?? embedder.Model;
            if (!vectors.Ready) return Results.Ok(new { ready = false, reason = vectors.Reason, model = m, plugin = embedder.Available, pluginReason = embedder.Reason, chunks = 0L, embedded = 0L, nodes = 0L, nodesTotal = 0, offen = 0L, gelesen = 0L, total = 0L });
            // Der Stand dient der Anzeige (Kachel des Systemjobs, Nachziehen, Bereitschaft) und wird alle paar Sekunden gefragt: die Abfragen an die Datenbank kosten
            // gut 0,3 s, und nach jedem Schreiben ins Journal rechnete der Aufruf die Texte aller Knoten neu — unter der Lesesperre, hinter der alles andere wartet.
            // Darum gilt der Stand, bis sich etwas ändert (StandAlt). Die Postenliste des Jobs (pending) rechnet immer frisch.
            var kopf = c.Head;
            if (StandAlt(m, kopf) is { } alt) return Results.Ok(alt);
            var (chunks, embedded, nodesDone) = await Teilzeit.MessenAsync("stats", () => vectors.StatsAsync(m, ct));
            var known = await Teilzeit.MessenAsync("hashes", () => vectors.NodeHashesAsync(m, ct));
            var texte = Teilzeit.Messen("node texts", () => KnotenTexte(c));
            var offeneKnoten = Teilzeit.Messen("pending", () => PendingNodes(texte, known).Count);
            var stand = new { ready = true, reason = (string?)null, model = m, plugin = embedder.Available, pluginReason = embedder.Reason, indexError = vectors.IndexError,
                chunks, embedded, nodes = nodesDone, nodesTotal = texte.Count, offen = (chunks - embedded) + offeneKnoten, gelesen = embedded + nodesDone, total = chunks + texte.Count };
            StandMerken(m, kopf, stand);
            return Results.Ok(stand);
        });

        // Die offene Postenliste: Abschnitte und Knoten ohne Vektor zu diesem Modell — der Job holt sie in Runden
        api.MapGet("/docs/embed/pending", async (Catalog c, Vectors vectors, Embedder embedder, int limit = 64, string? model = null, CancellationToken ct = default) =>
        {
            var m = Blank(model) ?? embedder.Model;
            if (!vectors.Ready) return Results.Ok(new { ready = false, reason = vectors.Reason, model = m, chunks = Array.Empty<object>(), nodes = Array.Empty<object>(), gone = Array.Empty<string>() });
            var n = Math.Clamp(limit, 1, 1000);
            var chunks = (await Teilzeit.MessenAsync("chunks", () => vectors.PendingChunksAsync(m, n, ct))).Select(o => new { o.Media, o.Sha256, o.Seq, text = Vectors.Passage(o.Heading, o.Body) }).ToList();
            var known = await Teilzeit.MessenAsync("hashes", () => vectors.NodeHashesAsync(m, ct));
            var texte = Teilzeit.Messen("node texts", () => KnotenTexte(c));
            var nodes = Teilzeit.Messen("pending", () => MitText(c, PendingNodes(texte, known).Take(Math.Max(0, n - chunks.Count))));
            var weg = Teilzeit.Messen("removed", () => GoneNodes(texte, known));
            return Results.Ok(new { ready = true, reason = (string?)null, model = m, chunks, nodes, gone = weg });
        });

        // Vektoren ablegen — der Job liefert, was er gerechnet hat; das Modell steht dabei
        api.MapPut("/docs/embed", async (EmbedBody body, HttpRequest req, Vectors vectors, Embedder embedder, CancellationToken ct) =>
        {
            if (Actor(req) is not { } _) return ActorMissing();
            if (!vectors.Ready) return Bad("Erweiterung vector fehlt in dieser Datenbank.");
            var m = Blank(body.Model) ?? embedder.Model;
            var chunks = await vectors.PutChunksAsync(m, (body.Chunks ?? []).Select(x => new Vectors.ChunkVector(x.Media, x.Sha256, x.Seq, x.Vector)).ToList(), ct);
            var nodes = await vectors.PutNodesAsync(m, (body.Nodes ?? []).Select(x => new Vectors.NodeVector(x.Node, x.Locale, x.Hash, x.Vector)).ToList(), body.Gone, ct);
            StandVerwerfen();
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
            var sources = c.Lesen((model, tree) => auszuege.Select((a, i) => new
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
