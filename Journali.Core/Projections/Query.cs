using System.Text.RegularExpressions;
using Journali.Core.Entries;

namespace Journali.Core.Projections;

/// <summary>
/// Suche mit Bedingungen (docs/pflegestruktur.md, Taloan 17.09.2026): eine Zeile aus
/// Chips <c>key:value</c> und freiem Text, alles UND. Englische Schlüssel:
/// <c>attr:function</c> (eigener Wert da) · <c>attr:function=*sku*</c> (Muster, * beliebig) ·
/// <c>attr:function=</c> (kein eigener Wert) · <c>empty:name/en</c> (auch geerbt nichts) ·
/// <c>incomplete:web</c> · <c>role:variant</c> · <c>status:active</c> · <c>group:logistics</c> (gilt hier) ·
/// <c>under:&lt;id&gt;</c> · <c>by:Taloan</c> · <c>since:2026-09-10</c> · Text wie bisher.
/// </summary>
public sealed class Query
{
    public List<(string Key, string Value)> Terms { get; } = new();
    public List<string> Words { get; } = new();

    public static Query Parse(string q)
    {
        var query = new Query();
        foreach (Match m in Regex.Matches(q, "\"[^\"]*\"|\\S+"))
        {
            var t = m.Value.Trim('"');
            var i = t.IndexOf(':');
            if (i > 0 && i < t.Length - 0 && Regex.IsMatch(t[..i], "^[a-z]+$")) query.Terms.Add((t[..i], t[(i + 1)..]));
            else if (t.Length > 0) query.Words.Add(t);
        }
        return query;
    }

    public bool HasTerms => Terms.Count > 0;

    /// <summary>Muster mit * zu einem regulären Ausdruck; ohne * ist es „enthält“.</summary>
    public static Regex Pattern(string p) =>
        new("^" + Regex.Escape(p).Replace("\\*", ".*") + "$", RegexOptions.IgnoreCase | RegexOptions.Singleline);

    /// <summary>Trifft der Knoten alle Bedingungen? Liefert die Fundstelle für die Anzeige.</summary>
    public string? Match(Tree tree, ModelCatalog model, Node n)
    {
        string? hit = null;
        foreach (var (key, raw) in Terms)
        {
            var value = raw;
            switch (key)
            {
                case "attr":
                {
                    // attr:<key> | attr:<key>=<muster> | attr:<key>= (leer)
                    var eq = value.IndexOf('=');
                    var attr = eq < 0 ? value : value[..eq];
                    var pattern = eq < 0 ? null : value[(eq + 1)..];
                    var own = n.Values.Where(kv => kv.Key.Attribute == attr).Select(kv => kv.Value)
                        .Concat(n.Lists.Where(kv => kv.Key.Attribute == attr).Select(kv => string.Join(", ", kv.Value))).ToList();
                    if (n.Rows.TryGetValue(attr, out var rows) && rows.Count > 0) own.Add($"{rows.Count} Zeilen");
                    if (pattern is null) { if (own.Count == 0) return null; hit ??= $"{attr}: {Snip(own[0])}"; break; }
                    if (pattern.Length == 0) { if (own.Count > 0) return null; hit ??= $"{attr}: leer"; break; }
                    var rx = pattern.Contains('*') ? Pattern(pattern) : null;
                    var found = own.FirstOrDefault(v => rx is null ? v.Contains(pattern, StringComparison.OrdinalIgnoreCase) : rx.IsMatch(v));
                    if (found is null) return null;
                    hit ??= $"{attr}: {Snip(found)}";
                    break;
                }
                case "empty":
                {
                    // empty:<key> | empty:<key>/<locale> — auch geerbt nichts
                    var slash = value.IndexOf('/');
                    var attr = slash < 0 ? value : value[..slash];
                    var locale = slash < 0 ? null : value[(slash + 1)..];
                    if (!model.Attributes.TryGetValue(attr, out var def)) return null;
                    if (tree.Resolve(n, attr, def.PerLocale ? locale : null, null, def.Inheritable).Value is not null) return null;
                    hit ??= $"{value} fehlt";
                    break;
                }
                case "incomplete":
                {
                    var active = CompletenessRules.ActiveAttributes(tree, model, n).ToList();
                    var slash = value.IndexOf('/');
                    var channel = slash < 0 ? value : value[..slash];
                    var locale = slash < 0 ? null : value[(slash + 1)..];
                    if (!model.Channels.ContainsKey(channel)) return null;
                    var (req, missing) = CompletenessRules.Check(tree, model, n, active, channel, locale);
                    if (req == 0 || missing.Length == 0) return null;
                    hit ??= $"{value}: fehlt {string.Join(", ", missing.Take(3))}{(missing.Length > 3 ? " …" : "")}";
                    break;
                }
                case "role":
                    if (!string.Equals(n.Role, value, StringComparison.OrdinalIgnoreCase)) return null;
                    break;
                case "status":
                    if (!string.Equals(n.Status, value, StringComparison.OrdinalIgnoreCase)) return null;
                    break;
                case "group":
                    if (!tree.EffectiveGroups(n).Any(g => string.Equals(g.Group, value, StringComparison.OrdinalIgnoreCase))) return null;
                    break;
                case "under":
                    if (!tree.Ancestors(n).Any(a => a.Id == value) && n.Id != value) return null;
                    break;
                case "by":
                    if (!n.LastActor.Contains(value, StringComparison.OrdinalIgnoreCase)) return null;
                    hit ??= $"👤 {n.LastActor}";
                    break;
                case "since":
                {
                    if (!DateTimeOffset.TryParse(value, out var since)) return null;
                    if (n.LastAt < since) return null;
                    hit ??= $"geändert {n.LastAt:dd.MM. HH:mm}";
                    break;
                }
                default:
                    return null;   // unbekannter Schlüssel: nichts trifft — der Nutzer sieht es an 0 Treffern
            }
        }
        foreach (var w in Words)
        {
            var h = tree.SearchOne(n, w);
            if (h is null) return null;
            hit ??= h;
        }
        return hit ?? n.Id;
    }

    private static string Snip(string v)
    {
        var plain = Regex.Replace(v, "<[^>]+>", " ").Trim();
        return plain.Length > 60 ? plain[..60] + "…" : plain;
    }
}
