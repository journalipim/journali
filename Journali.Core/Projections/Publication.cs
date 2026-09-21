using Journali.Core.Entries;

namespace Journali.Core.Projections;

/// <summary>
/// Ausleitung eines Publikationsbaums (Taloan, 21.09.2026: „bau die Ausleitungsregel mit Markt und Freigabe“).
/// Der Baum (Wurzel-Rubrik) nennt Kanal und optional Markt. Was darin steht (Rubriken, Verweise auf Produkte und Gruppen),
/// ist die Maximalstruktur; die Regel sagt je Verkaufbarem, ob es in die Ausleitung kommt — mit Grund, wenn nicht:
///   1. Freigabe: die Variante ist für den Kanal freigegeben (ReleaseGranted; Kanal-Fallback zählt, docs/pflegestruktur.md).
///      Ein Produkt ist drin, wenn mindestens eine Variante drin ist; ohne Varianten ist es nie drin (Freigabe nur an der Variante).
///   2. Markt: Attribut <c>markets</c> (Liste <c>market</c>, mehrfach, vererbbar) am Verkaufbaren — geerbt zählt. Leer = überall.
///      Sonst muss der Markt des Baums darin stehen, oder ein Markt seiner Fallback-Kette (Spalte <c>fallback</c> der Liste:
///      ein Markt bekommt das Sortiment seines Fallback-Markts, solange er nichts Eigenes sagt). Baum ohne Markt = kein Marktfilter.
/// </summary>
public static class Publication
{
    public const string MarketsAttribute = "markets";
    public const string MarketList = "market";
    public const string FallbackColumn = "fallback";

    /// <summary>Marktkette: der Markt, dann sein Fallback, dessen Fallback … (ohne Kreis, höchstens 8).</summary>
    public static IEnumerable<string> MarketChain(ModelCatalog model, string? market)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var m = market; m is not null && seen.Add(m) && seen.Count <= 8;)
        {
            yield return m;
            m = model.Lists.TryGetValue(MarketList, out var list) && list.Values.TryGetValue(m, out var v) && v.Extra is { } x && x.TryGetValue(FallbackColumn, out var f) && !string.IsNullOrWhiteSpace(f) ? f.Trim() : null;
        }
    }

    public sealed record Verdict(bool In, IReadOnlyList<string> Why)
    {
        public static readonly Verdict Yes = new(true, []);
    }

    /// <summary>Entscheidung für eine Variante: Freigabe für den Kanal (mit Fallback), Markt in den Verkaufsländern (geerbt, mit Fallback-Kette).</summary>
    public static Verdict DecideVariant(Tree tree, ModelCatalog model, Node variant, string channel, string? market, string? locale)
    {
        var why = new List<string>();
        if (tree.ReleasedVia(variant, channel, locale) is null) why.Add($"nicht freigegeben für {channel}{(locale is null ? "" : "/" + locale)}");
        if (market is not null)
        {
            var raw = tree.Resolve(model, variant, MarketsAttribute, null, null).Value;
            var have = (raw ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (have.Length > 0 && !MarketChain(model, market).Any(m => have.Contains(m, StringComparer.OrdinalIgnoreCase)))
                why.Add($"Markt {market} nicht in den Verkaufsländern ({string.Join(", ", have)})");
        }
        return why.Count == 0 ? Verdict.Yes : new(false, why);
    }

    public sealed record VariantRow(Node Variant, Verdict Verdict);
    /// <summary>Ein Glied des Pfads: Rubrik, verwiesener Pflegeknoten, oder eine von einer Regel erzeugte Gliederung (Id leer bei Attributwert).</summary>
    public sealed record PathItem(string Id, string Role, string Label, string? Rule = null)
    {
        public static PathItem Of(Tree tree, ModelCatalog model, Node n, string? rule = null) => new(n.Id, n.Role, Rules.LabelOf(tree, model, n), rule);
    }
    public sealed record ProductRow(IReadOnlyList<PathItem> Rubrics, Node Product, IReadOnlyList<VariantRow> Variants, bool In, IReadOnlyList<string> Why, long? Stand = null, string? Rule = null);

    /// <summary>Entscheidung für ein Produkt: drin, wenn eine Variante drin ist. Ohne Varianten: nie (Freigabe nur an der Variante).</summary>
    public static ProductRow DecideProduct(Tree tree, ModelCatalog model, IReadOnlyList<PathItem> rubrics, Node product, string channel, string? market, string? locale)
    {
        var variants = tree.Children(product.Id).Where(v => v.Role == Roles.Variant).Select(v => new VariantRow(v, DecideVariant(tree, model, v, channel, market, locale))).ToList();
        if (variants.Count == 0) return new(rubrics, product, variants, false, ["keine Variante — Freigabe gibt es nur an der Variante"]);
        var any = variants.Any(v => v.Verdict.In);
        // Gründe des Produkts: jeder Grund einmal, mit „n von m Varianten“, wenn er nicht alle betrifft
        var why = any ? [] : variants.SelectMany(v => v.Verdict.Why).GroupBy(w => w)
            .Select(g => g.Count() == variants.Count ? g.Key : $"{g.Key} ({g.Count()} von {variants.Count} Varianten)").ToList();
        return new(rubrics, product, variants, any, why);
    }

    /// <summary>
    /// Die Ausleitung eines Baums: Rubriken in Baumfolge, darin die Verweise — ein Produkt direkt, eine verwiesene Gruppe mit allen Produkten darunter
    /// (Pflegebaum-Aufbau als Unterrubriken). Jedes Produkt einmal je Rubrik, in der es hängt.
    /// </summary>
    /// <param name="at">Stand bei #n (Taloan, 21.09.2026, „A“): liefert Modell und Baum von damals; eingefrorene Rubriken entscheiden damit —
    /// Freigaben, Verkaufsländer, Varianten wie am Stichtag. Ohne <paramref name="at"/> zählt ein Stand nicht (live).</param>
    public static IEnumerable<ProductRow> Export(Tree tree, ModelCatalog model, Node root, string? locale = null, Func<long, (ModelCatalog Model, Tree Tree)>? at = null)
    {
        var channel = root.Channel ?? "";
        var market = string.IsNullOrWhiteSpace(root.Market) ? null : root.Market;
        // Modell und Baum für einen Stand: eingefroren → von damals, sonst live
        (ModelCatalog M, Tree T) Src(long? stand) => stand is { } s && at is not null ? at(s) : (model, tree);
        IEnumerable<ProductRow> Walk(Node rubric, List<PathItem> path, long? stand)
        {
            var here = new List<PathItem>(path) { PathItem.Of(tree, model, rubric) };
            if (rubric.Stand is { } own) stand = own;
            foreach (var id in rubric.Placed)
            {
                if (!tree.Nodes.TryGetValue(id, out var n)) continue;   // toter Verweis
                foreach (var row in Placed(n, here, stand, null)) yield return row;
            }
            // Regel-Verweise (Taloan, 21.09.): Treffer im Baum des Stands, gegliedert; die Gliederung wird Pfadglied
            foreach (var rule in rubric.Rules)
            {
                var (m, tr) = Src(stand);
                foreach (var g in Rules.Expand(tr, m, rule))
                {
                    var gp = new List<PathItem>(here);
                    if (g.Key.Length > 0) gp.Add(g.Node is { } gn ? PathItem.Of(tr, m, gn, rule.Id) : new PathItem("", "value", g.Label, rule.Id));
                    foreach (var hit in g.Matches)
                        foreach (var row in Placed(tree.Nodes.GetValueOrDefault(hit.Id) ?? hit, gp, stand, rule.Id)) yield return row;
                }
            }
            foreach (var child in tree.Children(rubric.Id).Where(c => c.Role == Roles.Rubric).OrderBy(c => c.Order ?? int.MaxValue).ThenBy(c => c.Name ?? c.Id, StringComparer.OrdinalIgnoreCase))
                foreach (var row in Walk(child, here, stand)) yield return row;
        }
        IEnumerable<ProductRow> Placed(Node n, List<PathItem> path, long? stand, string? rule)
        {
            var (m, tr) = Src(stand);
            if (n.Role == Roles.Product)
            {
                if (stand is { } s && at is not null)
                {
                    // eingefroren: das Produkt, wie es bei #s war — gab es das Produkt damals nicht, ist es draussen
                    if (!tr.Nodes.TryGetValue(n.Id, out var then)) { yield return new ProductRow(path, n, [], false, [$"bei Stand #{s} noch nicht vorhanden"], s, rule); yield break; }
                    yield return DecideProduct(tr, m, path, then, channel, market, locale) with { Product = n, Stand = s, Rule = rule }; yield break;
                }
                yield return DecideProduct(tree, model, path, n, channel, market, locale) with { Rule = rule }; yield break;
            }
            if (n.Role != Roles.Group) yield break;
            // verwiesene Gruppe: ihr Aufbau als Pfad, Produkte darunter — eingefroren: der Aufbau von damals
            if (!tr.Nodes.TryGetValue(n.Id, out var g)) yield break;
            var here = new List<PathItem>(path) { PathItem.Of(tr, m, g, rule) };
            foreach (var child in tr.Children(g.Id).OrderBy(c => Rules.LabelOf(tr, m, c), StringComparer.OrdinalIgnoreCase))
                foreach (var row in Placed(tree.Nodes.GetValueOrDefault(child.Id) ?? child, here, stand, rule)) yield return row;
        }
        return Walk(root, [], null);
    }
}
