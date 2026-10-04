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

    /// <param name="label">Wie ein Knoten heisst. Ohne Angabe wird er jedes Mal aufgelöst; wer die Texte vieler Knoten rechnet, reicht eine gemerkte Auflösung
    /// herein: der Name hängt nicht von der Sprache ab, und die Vorfahren eines Knotens sind die seiner Nachbarn.</param>
    public static string Of(ModelCatalog model, Tree tree, Node n, string locale, Func<Node, string>? label = null)
    {
        var sb = new StringBuilder();
        Schreibe(sb, model, tree, n, locale, label);
        return sb.ToString().TrimEnd();
    }

    [ThreadStatic] private static StringBuilder? _puffer;
    [ThreadStatic] private static char[]? _zeichen;
    [ThreadStatic] private static byte[]? _bytes;

    /// <summary>
    /// Der Hash des Textes, ohne den Text als Zeichenkette zu bauen (04.10.2026): derselbe Wert wie <c>Hash(Of(…))</c>. Gemessen an 18 611 Knoten in zwei
    /// Sprachen waren die Texte zusammen 158 MB — für Stand und Postenliste der Einbettungen zählt nur der Hash; den Text braucht nur, wer eingebettet wird.
    /// Der Puffer gehört dem Thread und wird wiederverwendet.
    /// </summary>
    public static string HashOf(ModelCatalog model, Tree tree, Node n, string locale, Func<Node, string>? label = null)
    {
        var sb = _puffer ??= new StringBuilder(8192);
        sb.Clear();
        Schreibe(sb, model, tree, n, locale, label);
        return HashVon(sb);
    }

    /// <summary>Hash des Inhalts eines StringBuilders wie <c>Hash(sb.ToString().TrimEnd())</c> — ohne Zeichenkette.</summary>
    public static string HashVon(StringBuilder sb)
    {
        var len = sb.Length;
        while (len > 0 && char.IsWhiteSpace(sb[len - 1])) len--;
        var zeichen = _zeichen is { } z && z.Length >= len ? z : _zeichen = new char[Math.Max(len, 4096) * 2];
        sb.CopyTo(0, zeichen, 0, len);
        var max = Encoding.UTF8.GetMaxByteCount(len);
        var bytes = _bytes is { } b && b.Length >= max ? b : _bytes = new byte[max * 2];
        var n = Encoding.UTF8.GetBytes(zeichen, 0, len, bytes, 0);
        Span<byte> hash = stackalloc byte[32];
        SHA256.HashData(bytes.AsSpan(0, n), hash);
        return Convert.ToHexString(hash)[..16].ToLowerInvariant();
    }

    private static void Schreibe(StringBuilder sb, ModelCatalog model, Tree tree, Node n, string locale, Func<Node, string>? label)
    {
        label ??= x => NodeRow.LabelOf(tree, model, x);
        sb.Append(label(n)).Append('\n');
        var pfad = tree.Ancestors(n).Reverse().Select(label).ToList();
        sb.Append(Rolle(n.Role, locale));
        if (pfad.Count > 0) sb.Append(" · ").Append(string.Join(" › ", pfad));
        sb.Append('\n');
        foreach (var (k, v) in n.AxisValues.OrderBy(kv => kv.Key, StringComparer.Ordinal))
            sb.Append(Label(model, k, locale)).Append(": ").Append(Wert(model, k, v, locale)).Append('\n');
        // Nur die Attribute, zu denen der Knoten einen Wert hat: bei 2 400 Attributen im Modell und 4 500 Texten (Knoten × Sprache) kostete das Durchgehen
        // aller Attribute je Text über 10 Sekunden. Ohne Wert käme ohnehin nichts heraus; die Reihenfolge (nach Schlüssel) bleibt.
        var belegt = new HashSet<string>(StringComparer.Ordinal);
        foreach (var a in n.Values.Keys) belegt.Add(a.Attribute);
        foreach (var a in n.Lists.Keys) belegt.Add(a.Attribute);
        foreach (var d in belegt.Order(StringComparer.Ordinal).Select(k => model.Attributes.GetValueOrDefault(k)).OfType<AttributeDefinition>())
        {
            if (d.Type is AttributeTypes.Rows or AttributeTypes.Formula or AttributeTypes.Template) continue;
            var v = Eigen(n, d.Key, d.PerLocale ? locale : null, model.MasterLocale);
            if (string.IsNullOrWhiteSpace(v)) continue;
            sb.Append(Label(model, d.Key, locale)).Append(": ").Append(Wert(model, d.Key, v, locale));
            if (!string.IsNullOrEmpty(d.Unit)) sb.Append(' ').Append(d.Unit);
            sb.Append('\n');
        }
    }

    /// <summary>
    /// Der eigene Wert wie <c>n.Own(attribute, locale, null, null, master)</c> — ohne Kanal, Zeile und Rückfallsprachen ist die Kette immer Sprache → Leitsprache →
    /// ohne Sprache. Own legt je Aufruf eine Menge und zwei Aufzählungen an; bei 37 000 Texten mit je rund 70 Werten waren das 2,6 Millionen (04.10.2026).
    /// </summary>
    public static string? Eigen(Node n, string attribute, string? locale, string? master)
    {
        if (locale is not null)
        {
            if (Wert(n, new Axis(attribute, locale, null)) is { } v1) return v1;
            if (master is not null && master != locale && Wert(n, new Axis(attribute, master, null)) is { } v2) return v2;
        }
        return Wert(n, new Axis(attribute, null, null));

        static string? Wert(Node n, Axis a) => n.Values.TryGetValue(a, out var v) ? v : n.Lists.TryGetValue(a, out var l) ? string.Join(", ", l) : null;
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
