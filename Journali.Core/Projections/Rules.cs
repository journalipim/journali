using Journali.Core.Entries;

namespace Journali.Core.Projections;

/// <summary>
/// Regel-Verweise (Taloan, 21.09.2026: Ersatzteilkatalog aus 20 Produktgruppen — „alles, worauf das zutrifft“ statt 20 Handgriffe).
/// Eine Rubrik trägt Regeln (<see cref="PubRule"/>, Eintrag <c>RulePlaced</c>); beim Lesen füllt sich die Rubrik:
///   Art <c>name</c>:      Gruppen (oder Produkte) unter <c>under</c>, deren Name gleich <c>name</c> ist — eine getroffene Gruppe kommt mit allem darunter.
///   Art <c>attribute</c>: Produkte unter <c>under</c>, deren wirksamer Wert (geerbt zählt) von <c>attribute</c> gleich <c>value</c> ist
///                         (bei Listen: enthält).
/// Gliederung <c>groupBy</c>: <c>none</c> flach · <c>parent</c> nach dem Vater des Treffers (die Produktgruppe darüber) ·
/// <c>attr:&lt;key&gt;</c> nach einem Attributwert des Treffers. Das Ergebnis ist Abbild, nichts wird kopiert.
/// </summary>
public static class Rules
{
    public sealed record Match(Node Node, string GroupKey, string GroupLabel, Node? GroupNode);
    public sealed record Group(string Key, string Label, Node? Node, IReadOnlyList<Node> Matches);

    /// <summary>Treffer einer Regel im Baum — Gruppen (Art name, Rolle group) oder Produkte, gegliedert.</summary>
    public static IReadOnlyList<Group> Expand(Tree tree, ModelCatalog model, PubRule rule)
    {
        var under = string.IsNullOrWhiteSpace(rule.Under) ? null : rule.Under;
        if (under is not null && !tree.Nodes.ContainsKey(under)) return [];
        var role = string.IsNullOrWhiteSpace(rule.Role) ? (rule.Kind == "attribute" ? Roles.Product : Roles.Group) : rule.Role;
        var pool = under is null ? tree.Nodes.Values.Where(n => n.Role != Roles.Rubric) : tree.DescendantsDeepestFirst(under).Reverse();
        IEnumerable<Node> hits = pool.Where(n => n.Role == role);
        if (rule.Kind == "attribute")
        {
            var attr = rule.Attribute ?? ""; var want = (rule.Value ?? "").Trim();
            hits = hits.Where(n => Has(tree.Resolve(model, n, attr, null, null).Value, want));
        }
        else
        {
            var want = (rule.Name ?? "").Trim();
            hits = hits.Where(n => string.Equals(LabelOf(tree, model, n), want, StringComparison.OrdinalIgnoreCase));
        }
        // Gliederung
        var groups = new Dictionary<string, (string Label, Node? Node, List<Node> Matches)>();
        var order = new List<string>();
        foreach (var n in hits)
        {
            string key, label; Node? gnode = null;
            var by = rule.GroupBy ?? "none";
            if (by == "parent") { gnode = n.Parent is { } p && tree.Nodes.TryGetValue(p, out var pn) ? pn : null; key = gnode?.Id ?? ""; label = gnode is null ? "" : LabelOf(tree, model, gnode); }
            else if (by.StartsWith("attr:")) { var v = tree.Resolve(model, n, by[5..], null, null).Value ?? ""; key = "v:" + v; label = v; }
            else { key = ""; label = ""; }
            if (!groups.TryGetValue(key, out var g)) { groups[key] = g = (label, gnode, new()); order.Add(key); }
            g.Matches.Add(n);
        }
        return order.OrderBy(k => groups[k].Label, StringComparer.OrdinalIgnoreCase).Select(k => new Group(k, groups[k].Label, groups[k].Node, groups[k].Matches.OrderBy(m => LabelOf(tree, model, m), StringComparer.OrdinalIgnoreCase).ToList())).ToList();
    }

    private static bool Has(string? value, string want) =>
        !string.IsNullOrEmpty(value) && value.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).Any(v => string.Equals(v, want, StringComparison.OrdinalIgnoreCase));

    /// <summary>Sichtbarer Name im Kern: fester Name, sonst der Wert des Beschriftungsattributs (erstes am Pfad), sonst die Id.</summary>
    public static string LabelOf(Tree tree, ModelCatalog model, Node n)
    {
        if (!string.IsNullOrWhiteSpace(n.Name)) return n.Name;
        foreach (var (attr, _) in tree.LabelAttributesOf(n))
        {
            var v = tree.Resolve(model, n, attr, model.MasterLocale ?? "de", null).Value;
            if (!string.IsNullOrWhiteSpace(v)) return v;
        }
        if (n.Role == Roles.Variant && n.AxisValues.Count > 0) return string.Join(" · ", n.AxisValues.Values);
        return n.Id;
    }
}
