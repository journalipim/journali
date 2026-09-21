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
/// Medien und Relationen (Taloan, 18.09.): <c>media:any</c> (hat Medien) · <c>media:image</c> / <c>media:document</c> (Relationstyp) ·
/// <c>media:*.pdf</c> oder <c>media:logo</c> (Name des Mediums, * beliebig) · <c>rel:any</c> / <c>rel:accessory</c> (Relation dieses Typs, ein- oder ausgehend) ·
/// <c>rel:accessory=250R</c> / <c>rel:any=p-0f58</c> (der Partner der Relation: Name, SKU, Id oder Wert enthält …, * beliebig).
/// <c>folder:Wakol</c> (Taloan, 21.09.: ein Medium des Knotens liegt in diesem Medienordner oder darunter — Name mit *, Pfad mit /, oder Id) · <c>folder:none</c> (ohne Ordner).
/// Ein Minus davor verneint (Taloan: „das Gegenteil“): <c>-empty:function</c>, <c>-role:variant</c>, <c>-Wort</c>.
/// </summary>
public sealed class Query
{
    public List<(string Key, string Value, bool Not)> Terms { get; } = new();
    public List<(string Word, bool Not)> Words { get; } = new();

    public static Query Parse(string q)
    {
        var query = new Query();
        foreach (Match m in Regex.Matches(q, "\"[^\"]*\"|\\S+"))
        {
            var t = m.Value.Trim('"');
            var not = t.StartsWith('-') && t.Length > 1; if (not) t = t[1..];
            var i = t.IndexOf(':');
            if (i > 0 && i < t.Length - 0 && Regex.IsMatch(t[..i], "^[a-z]+$")) query.Terms.Add((t[..i], t[(i + 1)..], not));
            else if (t.Length > 0) query.Words.Add((t, not));
        }
        return query;
    }

    public bool HasTerms => Terms.Count > 0;

    /// <summary>Muster mit * zu einem regulären Ausdruck; ohne * ist es „enthält“.</summary>
    public static Regex Pattern(string p) =>
        new("^" + Regex.Escape(p).Replace("\\*", ".*") + "$", RegexOptions.IgnoreCase | RegexOptions.Singleline);

    /// <summary>Trifft der Knoten alle Bedingungen? Liefert die Fundstelle für die Anzeige.</summary>
    public string? Match(Tree tree, ModelCatalog model, Node n, Relations? relations = null, Media? media = null)
    {
        string? hit = null;
        foreach (var (key, value, not) in Terms)
        {
            var (ok, h) = Term(tree, model, n, key, value, relations, media);
            if (ok == not) return null;   // trifft, soll aber nicht — oder umgekehrt
            hit ??= not ? $"¬ {key}:{value}" : h;
        }
        foreach (var (w, not) in Words)
        {
            var h = tree.SearchOne(n, w);
            if ((h is not null) == not) return null;
            hit ??= not ? $"¬ {w}" : h;
        }
        return hit ?? n.Id;
    }

    /// <summary>Eine Bedingung: trifft sie, und was zeigt man als Fundstelle?</summary>
    private static (bool Ok, string? Hit) Term(Tree tree, ModelCatalog model, Node n, string key, string value, Relations? relations, Media? media)
    {
        string? hit = null;
        {
            switch (key)
            {
                case "media":
                {
                    // media:any | media:<relationstyp> | media:<namensmuster> — Medien hängen über Relationen am Knoten (Ziel m-…)
                    if (relations is null || media is null) return (false, null);
                    // ein Stopp (stop=true) ist kein Medium des Knotens — dort steht es gerade NICHT zur Verfügung (Taloan, 18.09.)
                    var mine = relations.From(n.Id).Where(r => media.All.ContainsKey(r.To) && !(r.Values.TryGetValue(new Axis("stop", null, null), out var st) && st == "true")).Select(r => (Rel: r, Medium: media.All[r.To])).ToList();
                    if (mine.Count == 0) return (false, null);
                    if (value.Length == 0 || value.Equals("any", StringComparison.OrdinalIgnoreCase)) { hit ??= $"🖼 {mine.Count} Medien"; break; }
                    var byType = mine.Where(x => string.Equals(x.Rel.Type, value, StringComparison.OrdinalIgnoreCase)).ToList();
                    if (byType.Count > 0) { hit ??= $"🖼 {value}: {byType[0].Medium.Name}"; break; }
                    var rx = value.Contains('*') ? Pattern(value) : null;
                    var byName = mine.FirstOrDefault(x => rx is null ? x.Medium.Name.Contains(value, StringComparison.OrdinalIgnoreCase) : rx.IsMatch(x.Medium.Name));
                    if (byName.Medium is null) return (false, null);
                    hit ??= $"🖼 {byName.Medium.Name}";
                    break;
                }
                case "folder":
                {
                    // folder:<name|pfad|id> | folder:none — ein (nicht unterbundenes) Medium des Knotens liegt in dem Ordner oder darunter
                    if (relations is null || media is null) return (false, null);
                    var mine = relations.From(n.Id).Where(r => media.All.ContainsKey(r.To) && !(r.Values.TryGetValue(new Axis("stop", null, null), out var st) && st == "true")).Select(r => media.All[r.To]).ToList();
                    if (mine.Count == 0) return (false, null);
                    if (value.Length == 0 || value.Equals("none", StringComparison.OrdinalIgnoreCase))
                    {
                        var loose = mine.FirstOrDefault(m => m.Folder is null);
                        if (loose is null) return (false, null);
                        hit ??= $"📁 ohne Ordner: {loose.Name}"; break;
                    }
                    var rx = value.Contains('*') ? Pattern(value) : null;
                    var wanted = media.Folders.Values.Where(f =>
                        string.Equals(f.Id, value, StringComparison.OrdinalIgnoreCase)
                        || (rx is null ? string.Equals(f.Name, value, StringComparison.OrdinalIgnoreCase) : rx.IsMatch(f.Name))
                        || string.Equals(string.Join("/", media.PathOf(f.Id).Select(x => x.Name)), value.Trim('/'), StringComparison.OrdinalIgnoreCase)).ToList();
                    if (wanted.Count == 0) return (false, null);
                    var set = wanted.SelectMany(f => media.FolderAndBelow(f.Id)).ToHashSet();
                    var inside = mine.FirstOrDefault(m => m.Folder is { } f && set.Contains(f));
                    if (inside is null) return (false, null);
                    hit ??= $"📁 {string.Join(" › ", media.PathOf(inside.Folder).Select(x => x.Name))}: {inside.Name}";
                    break;
                }
                case "rel":
                {
                    // rel:any | rel:<typ> | rel:<typ>=<partner> — Relationen zu anderen Knoten (nicht Medien), ein- oder ausgehend;
                    // der Partner ist das andere Ende: Name, SKU, Id oder ein Wert enthält den Text (mit * als Muster auf Name/Id)
                    if (relations is null) return (false, null);
                    var eq = value.IndexOf('=');
                    var type = eq < 0 ? value : value[..eq];
                    var partner = eq < 0 ? null : value[(eq + 1)..];
                    var any = type.Length == 0 || type.Equals("any", StringComparison.OrdinalIgnoreCase);
                    var all = relations.From(n.Id).Concat(relations.To(n.Id)).Where(r => media is null || !media.All.ContainsKey(r.To)).ToList();
                    var rels = any ? all : all.Where(r => string.Equals(r.Type, type, StringComparison.OrdinalIgnoreCase)).ToList();
                    if (rels.Count == 0) return (false, null);
                    if (partner is { Length: > 0 })
                    {
                        var rx = partner.Contains('*') ? Pattern(partner) : null;
                        foreach (var r in rels)
                        {
                            var otherId = r.From == n.Id ? r.To : r.From;
                            if (!tree.Nodes.TryGetValue(otherId, out var other)) continue;
                            var found = rx is null ? tree.SearchOne(other, partner)
                                : (rx.IsMatch(other.Id) || (other.Name is { } nm && rx.IsMatch(nm)) || other.Label.Values.Any(rx.IsMatch) ? other.Name ?? other.Id : null);
                            if (found is not null) { hit ??= $"⇄ {r.Type} {(r.From == n.Id ? "→" : "←")} {found}"; return (true, hit); }
                        }
                        return (false, null);
                    }
                    hit ??= $"⇄ {rels.Count} {(any ? "Relationen" : type)}";
                    break;
                }
                case "attr":
                {
                    // attr:<key> | attr:<key>=<muster> | attr:<key>= (leer)
                    var eq = value.IndexOf('=');
                    var attr = eq < 0 ? value : value[..eq];
                    var pattern = eq < 0 ? null : value[(eq + 1)..];
                    var own = n.Values.Where(kv => kv.Key.Attribute == attr).Select(kv => kv.Value)
                        .Concat(n.Lists.Where(kv => kv.Key.Attribute == attr).Select(kv => string.Join(", ", kv.Value))).ToList();
                    if (n.Rows.TryGetValue(attr, out var rows) && rows.Count > 0) own.Add($"{rows.Count} Zeilen");
                    if (pattern is null) { if (own.Count == 0) return (false, null); hit ??= $"{attr}: {Snip(own[0])}"; break; }
                    if (pattern.Length == 0) { if (own.Count > 0) return (false, null); hit ??= $"{attr}: leer"; break; }
                    var rx = pattern.Contains('*') ? Pattern(pattern) : null;
                    var found = own.FirstOrDefault(v => rx is null ? v.Contains(pattern, StringComparison.OrdinalIgnoreCase) : rx.IsMatch(v));
                    if (found is null) return (false, null);
                    hit ??= $"{attr}: {Snip(found)}";
                    break;
                }
                case "empty":
                {
                    // empty:<key> | empty:<key>/<locale> — auch geerbt nichts
                    var slash = value.IndexOf('/');
                    var attr = slash < 0 ? value : value[..slash];
                    var locale = slash < 0 ? null : value[(slash + 1)..];
                    if (!model.Attributes.TryGetValue(attr, out var def)) return (false, null);
                    if (tree.Resolve(n, attr, def.PerLocale ? locale : null, null, def.Inheritable).Value is not null) return (false, null);
                    hit ??= $"{value} fehlt";
                    break;
                }
                case "incomplete":
                {
                    var active = CompletenessRules.ActiveAttributes(tree, model, n).ToList();
                    var slash = value.IndexOf('/');
                    var channel = slash < 0 ? value : value[..slash];
                    var locale = slash < 0 ? null : value[(slash + 1)..];
                    if (!model.Channels.ContainsKey(channel)) return (false, null);
                    var (req, missing) = CompletenessRules.Check(tree, model, n, active, channel, locale);
                    if (req == 0 || missing.Length == 0) return (false, null);
                    hit ??= $"{value}: fehlt {string.Join(", ", missing.Take(3))}{(missing.Length > 3 ? " …" : "")}";
                    break;
                }
                case "role":
                    if (!string.Equals(n.Role, value, StringComparison.OrdinalIgnoreCase)) return (false, null);
                    break;
                case "status":
                    if (!string.Equals(n.Status, value, StringComparison.OrdinalIgnoreCase)) return (false, null);
                    break;
                case "group":
                    if (!tree.EffectiveGroups(n).Any(g => string.Equals(g.Group, value, StringComparison.OrdinalIgnoreCase))) return (false, null);
                    break;
                case "under":
                    if (!tree.Ancestors(n).Any(a => a.Id == value) && n.Id != value) return (false, null);
                    break;
                case "by":
                    if (!n.LastActor.Contains(value, StringComparison.OrdinalIgnoreCase)) return (false, null);
                    hit ??= $"👤 {n.LastActor}";
                    break;
                case "since":
                {
                    if (!DateTimeOffset.TryParse(value, out var since)) return (false, null);
                    if (n.LastAt < since) return (false, null);
                    hit ??= $"geändert {n.LastAt:dd.MM. HH:mm}";
                    break;
                }
                default:
                    return (false, null);   // unbekannter Schlüssel: nichts trifft — der Nutzer sieht es an 0 Treffern
            }
        }
        return (true, hit);
    }

    private static string Snip(string v)
    {
        var plain = Regex.Replace(v, "<[^>]+>", " ").Trim();
        return plain.Length > 60 ? plain[..60] + "…" : plain;
    }
}
