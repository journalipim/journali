using System.Globalization;
using Journali.Core.Entries;
using Journali.Core.Projections;

namespace Journali.Core.Configurator;

/// <summary>Teile aus dem Baum: ein Produkt oder eine Variante, wie die Prüfung sie braucht.</summary>
public static class Parts
{
    public const string ResourceColumn = "resource";
    public const string AmountColumn = "amount";

    /// <summary>
    /// Das Teil zu einem Knoten. Die Ressourcen stehen in den Zeilen des Attributs <paramref name="resources"/> (Spalten <c>resource</c> und <c>amount</c>);
    /// hat eine Variante selbst keine, gelten die ihres Produkts. Gleiche Ressourcen in mehreren Zeilen werden summiert.
    /// </summary>
    public static Part From(Tree tree, ModelCatalog model, Node n, string resources)
    {
        var path = new HashSet<string>(StringComparer.Ordinal) { n.Id };
        foreach (var a in tree.Ancestors(n)) path.Add(a.Id);
        return new Part(n.Id, path, key => tree.Resolve(model, n, key, null, null).Value, ResourcesOf(tree, n, resources));
    }

    static Dictionary<string, decimal> ResourcesOf(Tree tree, Node n, string attribute)
    {
        var source = n;
        if ((!n.Rows.TryGetValue(attribute, out var rows) || rows.Count == 0) && n.Role == Roles.Variant && n.Parent is { } p && tree.Nodes.TryGetValue(p, out var product))
            source = product;
        var sums = new Dictionary<string, decimal>(StringComparer.Ordinal);
        if (!source.Rows.TryGetValue(attribute, out rows)) return sums;
        foreach (var row in rows)
        {
            var res = source.Own(ResourceColumn, null, null, row);
            if (string.IsNullOrWhiteSpace(res)) continue;
            if (!decimal.TryParse(source.Own(AmountColumn, null, null, row), NumberStyles.Number, CultureInfo.InvariantCulture, out var amount)) continue;
            sums[res] = sums.GetValueOrDefault(res) + amount;
        }
        return sums;
    }

    /// <summary>
    /// Was gewählt werden darf: alle Varianten unter der Wurzel (leer = überall) und die Produkte, die keine haben. Ein Produkt mit Varianten
    /// wird über seine Variante gewählt.
    /// </summary>
    public static List<Part> Candidates(Tree tree, ModelCatalog model, string? root, string resources)
    {
        var list = new List<Part>();
        foreach (var n in tree.Nodes.Values.OrderBy(x => x.Id, StringComparer.Ordinal))
        {
            if (n.Role != Roles.Variant && n.Role != Roles.Product) continue;
            if (n.Role == Roles.Product && tree.Children(n.Id).Any(c => c.Role == Roles.Variant)) continue;
            if (!string.IsNullOrEmpty(root) && n.Id != root && !tree.Ancestors(n).Any(a => a.Id == root)) continue;
            list.Add(From(tree, model, n, resources));
        }
        return list;
    }
}
