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
    public sealed record ProductRow(IReadOnlyList<Node> Rubrics, Node Product, IReadOnlyList<VariantRow> Variants, bool In, IReadOnlyList<string> Why);

    /// <summary>Entscheidung für ein Produkt: drin, wenn eine Variante drin ist. Ohne Varianten: nie (Freigabe nur an der Variante).</summary>
    public static ProductRow DecideProduct(Tree tree, ModelCatalog model, IReadOnlyList<Node> rubrics, Node product, string channel, string? market, string? locale)
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
    public static IEnumerable<ProductRow> Export(Tree tree, ModelCatalog model, Node root, string? locale = null)
    {
        var channel = root.Channel ?? "";
        var market = string.IsNullOrWhiteSpace(root.Market) ? null : root.Market;
        IEnumerable<ProductRow> Walk(Node rubric, List<Node> path)
        {
            var here = new List<Node>(path) { rubric };
            foreach (var id in rubric.Placed)
            {
                if (!tree.Nodes.TryGetValue(id, out var n)) continue;   // toter Verweis
                foreach (var row in Placed(n, here)) yield return row;
            }
            foreach (var child in tree.Children(rubric.Id).Where(c => c.Role == Roles.Rubric).OrderBy(c => c.Order ?? int.MaxValue).ThenBy(c => c.Name ?? c.Id, StringComparer.OrdinalIgnoreCase))
                foreach (var row in Walk(child, here)) yield return row;
        }
        IEnumerable<ProductRow> Placed(Node n, List<Node> path)
        {
            if (n.Role == Roles.Product) { yield return DecideProduct(tree, model, path, n, channel, market, locale); yield break; }
            if (n.Role != Roles.Group) yield break;
            // verwiesene Gruppe: ihr Aufbau als Pfad, Produkte darunter
            var here = new List<Node>(path) { n };
            foreach (var child in tree.Children(n.Id).OrderBy(c => c.Name ?? c.Id, StringComparer.OrdinalIgnoreCase))
                foreach (var row in Placed(child, here)) yield return row;
        }
        return Walk(root, []);
    }
}
