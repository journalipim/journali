using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Journali.Core.Entries;
using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Der Text eines Knotens, wie ihn ein Einbettungsmodell aufnimmt (27.09.2026, pflegestruktur 35): Name, Rolle, Pfad,
/// dann je Attribut Bezeichnung und Wert in einer Sprache — Listenwerte als Bezeichnung, HTML ohne Tags, Einheit
/// dahinter. Derselbe Text, aus dem das Plugin <c>rag</c> sein Markdown macht, nur ohne Auszeichnung. Sein Hash sagt,
/// ob der Knoten neu einzubetten ist: ändert sich ein Wert, ändert sich der Text, ändert sich der Hash.
/// </summary>
public static partial class NodeText
{
    [GeneratedRegex("<[^>]+>")] private static partial Regex Tags();
    [GeneratedRegex(@"\s+")] private static partial Regex Spaces();

    public static string Of(ModelCatalog model, Tree tree, Node n, string locale)
    {
        var sb = new StringBuilder();
        sb.Append(NodeRow.LabelOf(tree, model, n)).Append('\n');
        var pfad = tree.Ancestors(n).Reverse().Select(a => NodeRow.LabelOf(tree, model, a)).ToList();
        sb.Append(Rolle(n.Role, locale));
        if (pfad.Count > 0) sb.Append(" · ").Append(string.Join(" › ", pfad));
        sb.Append('\n');
        foreach (var (k, v) in n.AxisValues.OrderBy(kv => kv.Key, StringComparer.Ordinal))
            sb.Append(Label(model, k, locale)).Append(": ").Append(Wert(model, k, v, locale)).Append('\n');
        foreach (var d in model.Attributes.Values.OrderBy(a => a.Key, StringComparer.Ordinal))
        {
            if (d.Type is AttributeTypes.Rows or AttributeTypes.Formula or AttributeTypes.Template) continue;
            var v = n.Own(d.Key, d.PerLocale ? locale : null, null, null, model.MasterLocale);
            if (string.IsNullOrWhiteSpace(v)) continue;
            sb.Append(Label(model, d.Key, locale)).Append(": ").Append(Wert(model, d.Key, v, locale));
            if (!string.IsNullOrEmpty(d.Unit)) sb.Append(' ').Append(d.Unit);
            sb.Append('\n');
        }
        return sb.ToString().TrimEnd();
    }

    /// <summary>Kurzer Hash des Textes — als Vergleich, ob neu einzubetten ist.</summary>
    public static string Hash(string text) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)))[..16].ToLowerInvariant();

    private static string Rolle(string role, string locale) => (role, locale.StartsWith("de")) switch
    {
        (Roles.Group, true) => "Produktgruppe", (Roles.Product, true) => "Produkt", (Roles.Variant, true) => "Variante",
        (Roles.Group, false) => "Product group", (Roles.Product, false) => "Product", (Roles.Variant, false) => "Variant",
        _ => role,
    };

    private static string Label(ModelCatalog model, string key, string locale) =>
        model.Attributes.TryGetValue(key, out var d) && (d.Label.GetValueOrDefault(locale) ?? d.Label.GetValueOrDefault(model.MasterLocale ?? "de") ?? d.Label.Values.FirstOrDefault()) is { Length: > 0 } l ? l : key;

    private static string Wert(ModelCatalog model, string key, string raw, string locale)
    {
        if (!model.Attributes.TryGetValue(key, out var d)) return raw;
        if (d.Type == AttributeTypes.Enum && d.List is { } lk && model.Lists.TryGetValue(lk, out var list))
            return string.Join(", ", raw.Split(',').Select(x => x.Trim()).Where(x => x.Length > 0)
                .Select(x => list.Values.TryGetValue(x, out var lv) && (lv.Label.GetValueOrDefault(locale) ?? lv.Label.Values.FirstOrDefault()) is { Length: > 0 } l ? l : x));
        if (d.Type == AttributeTypes.Html) return Spaces().Replace(Tags().Replace(raw, " "), " ").Trim();
        if (d.Type == AttributeTypes.Boolean) return raw == "true" ? (locale.StartsWith("de") ? "ja" : "yes") : (locale.StartsWith("de") ? "nein" : "no");
        return raw;
    }
}
