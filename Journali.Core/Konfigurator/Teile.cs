using System.Globalization;
using Journali.Core.Entries;
using Journali.Core.Projections;

namespace Journali.Core.Konfigurator;

/// <summary>Teile aus dem Baum: ein Produkt oder eine Variante, wie die Prüfung sie braucht.</summary>
public static class Teile
{
    public const string SpalteRessource = "ressource";
    public const string SpalteMenge = "menge";

    /// <summary>
    /// Das Teil zu einem Knoten. Die Ressourcen stehen in den Zeilen des Attributs <paramref name="ressourcen"/> (Spalten <c>ressource</c> und <c>menge</c>);
    /// hat eine Variante selbst keine, gelten die ihres Produkts. Gleiche Ressourcen in mehreren Zeilen werden summiert.
    /// </summary>
    public static Teil Aus(Tree tree, ModelCatalog model, Node n, string ressourcen)
    {
        var pfad = new HashSet<string>(StringComparer.Ordinal) { n.Id };
        foreach (var a in tree.Ancestors(n)) pfad.Add(a.Id);
        return new Teil(n.Id, pfad, key => tree.Resolve(model, n, key, null, null).Value, Ressourcen(tree, n, ressourcen));
    }

    static Dictionary<string, decimal> Ressourcen(Tree tree, Node n, string attribut)
    {
        var quelle = n;
        if ((!n.Rows.TryGetValue(attribut, out var zeilen) || zeilen.Count == 0) && n.Role == Roles.Variant && n.Parent is { } p && tree.Nodes.TryGetValue(p, out var produkt))
            quelle = produkt;
        var summen = new Dictionary<string, decimal>(StringComparer.Ordinal);
        if (!quelle.Rows.TryGetValue(attribut, out zeilen)) return summen;
        foreach (var row in zeilen)
        {
            var res = quelle.Own(SpalteRessource, null, null, row);
            if (string.IsNullOrWhiteSpace(res)) continue;
            if (!decimal.TryParse(quelle.Own(SpalteMenge, null, null, row), NumberStyles.Number, CultureInfo.InvariantCulture, out var menge)) continue;
            summen[res] = summen.GetValueOrDefault(res) + menge;
        }
        return summen;
    }

    /// <summary>
    /// Was gewählt werden darf: alle Varianten unter der Wurzel (leer = überall) und die Produkte, die keine haben. Ein Produkt mit Varianten
    /// wird über seine Variante gewählt.
    /// </summary>
    public static List<Teil> Waehlbare(Tree tree, ModelCatalog model, string? wurzel, string ressourcen)
    {
        var liste = new List<Teil>();
        foreach (var n in tree.Nodes.Values.OrderBy(x => x.Id, StringComparer.Ordinal))
        {
            if (n.Role != Roles.Variant && n.Role != Roles.Product) continue;
            if (n.Role == Roles.Product && tree.Children(n.Id).Any(c => c.Role == Roles.Variant)) continue;
            if (!string.IsNullOrEmpty(wurzel) && n.Id != wurzel && !tree.Ancestors(n).Any(a => a.Id == wurzel)) continue;
            liste.Add(Aus(tree, model, n, ressourcen));
        }
        return liste;
    }
}
