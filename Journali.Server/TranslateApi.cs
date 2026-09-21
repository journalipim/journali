using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Übersetzungsmanagement (Taloan, 21.09.2026, Blick in OpenDXP: „Übersetzungsmanagement ist etwas, was wir noch gar nicht haben“):
/// die Einheiten einer Sprachrichtung — je Knoten × sprachabhängiges Textattribut × Kanal × Zeile der eigene Quelltext, der
/// eigene Zieltext und der Zustand: <c>missing</c> (kein Ziel), <c>stale</c> (Ziel da, aber die Quelle ist seither neuer — ⟳ wie in
/// der Zelle), <c>done</c>. Vererbte Werte gehören dem Vorfahren und tauchen dort auf. Das Plugin <c>xliff</c> macht daraus XLIFF 2.0
/// für Agenturen und CAT-Werkzeuge, liest es zurück und lässt die KI vorübersetzen; der Rückweg prüft den Hash der Quelle — hat
/// sich der Quelltext seit dem Export geändert, wird die Einheit übergangen, nicht überschrieben.
/// </summary>
public static class TranslateApi
{
    public sealed record Unit(string Id, string Node, string Label, string Role, string Attribute, string AttributeLabel, string Type, string? Channel, string? Row, string Source, string SourceHash, string? Target, string State, long SourceAt, long TargetAt);
    public sealed record ImportUnit(string Id, string? Target, string? SourceHash);
    public sealed record ImportBody(string From, string To, List<ImportUnit> Units, bool? Force);

    private static readonly XNamespace X2 = "urn:oasis:names:tc:xliff:document:2.0";
    private static readonly XNamespace X1 = "urn:oasis:names:tc:xliff:document:1.2";

    /// <summary>Einheiten rechnen (gemeinsam für /units und /xliff).</summary>
    public static (IResult? Error, string From, string To, List<Unit> Units) Collect(ModelCatalog model, Tree tree, string? root, string? from, string? to, string? channel, string? attributes, string scope, int limit)
    {
        from = Blank(from) ?? model.MasterLocale; to = Blank(to);
        if (from is null || to is null) return (Bad("from und to (Sprachen) fehlen."), "", "", new());
        if (!model.Locales.ContainsKey(from) || !model.Locales.ContainsKey(to)) return (Bad("Unbekannte Sprache."), "", "", new());
        if (from == to) return (Bad("Quelle und Ziel sind dieselbe Sprache."), "", "", new());
        var wanted = Blank(attributes)?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet();
        var defs = model.Attributes.Values.Where(a => a.PerLocale && a.Type is AttributeTypes.Text or AttributeTypes.Html && (wanted is null || wanted.Contains(a.Key))).ToList();
        var nodes = (Blank(root) is { } r ? (tree.Nodes.TryGetValue(r, out var rn) ? new[] { rn }.Concat(tree.DescendantsDeepestFirst(r)) : []) : tree.Nodes.Values).Where(n => n.Role != Roles.Rubric);
        var units = new List<Unit>();
        foreach (var n in nodes)
        {
            foreach (var d in defs)
            {
                foreach (var (axis, source) in n.Values.Where(kv => kv.Key.Attribute == d.Key && kv.Key.Locale == from && (channel is null || (kv.Key.Channel ?? "") == channel)).ToList())
                {
                    if (string.IsNullOrWhiteSpace(source)) continue;
                    var tAxis = new Axis(d.Key, to, axis.Channel, axis.Row);
                    n.Values.TryGetValue(tAxis, out var target);
                    var sAt = n.SetAt.GetValueOrDefault(axis); var tAt = n.SetAt.GetValueOrDefault(tAxis);
                    var state = string.IsNullOrWhiteSpace(target) ? "missing" : sAt > tAt ? "stale" : "done";
                    if (scope == "missing" && state != "missing" || scope == "stale" && state != "stale" || scope == "open" && state == "done") continue;
                    units.Add(new Unit(UnitId(n.Id, d.Key, axis.Channel, axis.Row), n.Id, NodeRow.LabelOf(tree, model, n), n.Role, d.Key, d.Label?.GetValueOrDefault(from) ?? d.Label?.GetValueOrDefault("de") ?? d.Key, d.Type, axis.Channel, axis.Row, source, Hash(source), target, state, sAt, tAt));
                    if (units.Count >= Math.Clamp(limit, 1, 50000)) return (null, from, to, units);
                }
            }
        }
        return (null, from, to, units);
    }

    /// <summary>XLIFF 2.0 aus Einheiten: eine Datei, je Einheit ein unit mit Notizen (Knoten, Attribut, Kanal, Hash der Quelle) und einem Segment.</summary>
    public static string ToXliff(string from, string to, IEnumerable<Unit> units, string original)
    {
        var file = new XElement(X2 + "file", new XAttribute("id", "journali"), new XAttribute("original", original));
        foreach (var u in units)
        {
            var notes = new XElement(X2 + "notes",
                new XElement(X2 + "note", new XAttribute("category", "node"), u.Node),
                new XElement(X2 + "note", new XAttribute("category", "attribute"), u.Attribute),
                new XElement(X2 + "note", new XAttribute("category", "sourceHash"), u.SourceHash),
                new XElement(X2 + "note", new XAttribute("category", "state"), u.State));
            if (u.Channel is not null) notes.Add(new XElement(X2 + "note", new XAttribute("category", "channel"), u.Channel));
            var seg = new XElement(X2 + "segment", new XAttribute("state", string.IsNullOrEmpty(u.Target) ? "initial" : "translated"), new XElement(X2 + "source", u.Source));
            if (!string.IsNullOrEmpty(u.Target)) seg.Add(new XElement(X2 + "target", u.Target));
            file.Add(new XElement(X2 + "unit", new XAttribute("id", u.Id), new XAttribute("name", $"{u.Label} · {u.AttributeLabel}{(u.Channel is null ? "" : " · " + u.Channel)}"), notes, seg));
        }
        var doc = new XDocument(new XDeclaration("1.0", "utf-8", null), new XElement(X2 + "xliff", new XAttribute("version", "2.0"), new XAttribute("srcLang", from), new XAttribute("trgLang", to), file));
        return doc.Declaration + Environment.NewLine + doc.ToString();
    }

    /// <summary>XLIFF lesen — 2.0 (unit/segment/target) und 1.2 (trans-unit/target); Id der Einheit aus dem id-Attribut, Hash der Quelle aus der Notiz.</summary>
    public static (string? From, string? To, List<ImportUnit> Units, string? Error) FromXliff(string xml)
    {
        XDocument doc;
        try { doc = XDocument.Parse(xml); } catch (Exception e) { return (null, null, new(), "Kein gültiges XML: " + e.Message); }
        var root = doc.Root; if (root is null) return (null, null, new(), "leer");
        var list = new List<ImportUnit>();
        if (root.Name.Namespace == X2)
        {
            foreach (var u in root.Descendants(X2 + "unit"))
            {
                var id = u.Attribute("id")?.Value; if (string.IsNullOrEmpty(id)) continue;
                var hash = u.Descendants(X2 + "note").FirstOrDefault(n => n.Attribute("category")?.Value == "sourceHash")?.Value;
                var target = string.Concat(u.Descendants(X2 + "segment").Select(s => s.Element(X2 + "target")?.Value ?? ""));
                list.Add(new ImportUnit(id, target, hash));
            }
            return (root.Attribute("srcLang")?.Value, root.Attribute("trgLang")?.Value, list, null);
        }
        if (root.Name.Namespace == X1 || root.Name.LocalName == "xliff")
        {
            var ns = root.Name.Namespace;
            var file = root.Element(ns + "file");
            foreach (var u in root.Descendants(ns + "trans-unit"))
            {
                var id = u.Attribute("id")?.Value; if (string.IsNullOrEmpty(id)) continue;
                var hash = u.Elements(ns + "note").FirstOrDefault(n => (n.Attribute("from")?.Value ?? "") == "sourceHash")?.Value;
                list.Add(new ImportUnit(id, u.Element(ns + "target")?.Value, hash));
            }
            return (file?.Attribute("source-language")?.Value, file?.Attribute("target-language")?.Value, list, null);
        }
        return (null, null, new(), "Kein XLIFF (Namensraum 2.0 oder 1.2 erwartet).");
    }

    public static void Map(RouteGroupBuilder api)
    {
        // XLIFF 2.0 herunterladen — Browser (Agentur, CAT-Werkzeug) und Job (Fach out/)
        api.MapGet("/translate/xliff", (Catalog c, string? root = null, string? from = null, string? to = null, string? channel = null, string? attributes = null, string scope = "open", int limit = 50000) =>
        {
            var (err, f, t, units, xml) = c.With((model, tree, _) =>
            {
                var r = Collect(model, tree, root, from, to, channel, attributes, scope, limit);
                return (r.Error, r.From, r.To, r.Units.Count, r.Error is null ? ToXliff(r.From, r.To, r.Units, "journali:" + (Blank(root) ?? "*")) : "");
            });
            if (err is not null) return err;
            return Results.File(Encoding.UTF8.GetBytes(xml), "application/xliff+xml", $"journali-{f}-{t}-{DateTime.Now:yyyyMMdd-HHmm}.xlf");
        });
        // XLIFF zurück: Body = XML; Sprachen aus der Datei (to darf die URL übersteuern); dieselben Regeln wie /translate/import
        api.MapPost("/translate/xliff", async (HttpRequest req, Catalog c, string? to = null, bool force = false) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            string xml; using (var sr = new StreamReader(req.Body, Encoding.UTF8)) xml = await sr.ReadToEndAsync();
            var (from, fileTo, units, error) = FromXliff(xml);
            if (error is not null) return Bad(error);
            var target = Blank(to) ?? fileTo;
            if (from is null || target is null) return Bad("Sprachen fehlen (srcLang/trgLang bzw. to).");
            return Import(c, actor, from, target, units, force);
        });

        // Einheiten: root (leer = alle Wurzeln), from/to (Sprachen), channel (leer = alle Kanäle des Attributs), attributes (Keys mit Komma, leer = alle Textattribute mit Sprachachse), scope = missing | stale | open (beide) | all
        api.MapGet("/translate/units", (Catalog c, string? root = null, string? from = null, string? to = null, string? channel = null, string? attributes = null, string scope = "open", int limit = 5000) =>
            c.With((model, tree, _) =>
            {
                var r = Collect(model, tree, root, from, to, channel, attributes, scope, limit);
                if (r.Error is not null) return r.Error;
                var units = r.Units;
                return Results.Ok(new { from = r.From, to = r.To, count = units.Count, missing = units.Count(u => u.State == "missing"), stale = units.Count(u => u.State == "stale"), done = units.Count(u => u.State == "done"), units });
            }));

        // Übersicht je Sprache (für die Ansicht): wie viele Einheiten fehlen / sind veraltet / fertig — je Zielsprache gegen den Master
        api.MapGet("/translate/status", (Catalog c, string? root = null) => c.With((model, tree, _) =>
        {
            var from = model.MasterLocale; if (from is null) return Results.Ok(new { from, locales = Array.Empty<object>() });
            var defs = model.Attributes.Values.Where(a => a.PerLocale && a.Type is AttributeTypes.Text or AttributeTypes.Html).Select(a => a.Key).ToHashSet();
            var nodes = (Blank(root) is { } r ? (tree.Nodes.TryGetValue(r, out var rn) ? new[] { rn }.Concat(tree.DescendantsDeepestFirst(r)) : []) : tree.Nodes.Values).Where(n => n.Role != Roles.Rubric).ToList();
            var sources = nodes.SelectMany(n => n.Values.Where(kv => defs.Contains(kv.Key.Attribute) && kv.Key.Locale == from && !string.IsNullOrWhiteSpace(kv.Value)).Select(kv => (n, kv.Key))).ToList();
            var locales = model.Locales.Keys.Where(l => l != from).Select(l =>
            {
                int missing = 0, stale = 0, done = 0;
                foreach (var (n, ax) in sources)
                {
                    var t = new Axis(ax.Attribute, l, ax.Channel, ax.Row);
                    if (!n.Values.TryGetValue(t, out var tv) || string.IsNullOrWhiteSpace(tv)) missing++;
                    else if (n.SetAt.GetValueOrDefault(ax) > n.SetAt.GetValueOrDefault(t)) stale++;
                    else done++;
                }
                return new { locale = l, label = model.Locales[l].Label, missing, stale, done, total = sources.Count };
            }).ToList();
            return Results.Ok(new { from, total = sources.Count, locales });
        }));

        // Rückweg: Zieltexte schreiben — nur, wenn die Quelle noch dieselbe ist (sourceHash), sonst übergangen (force: true schreibt trotzdem)
        api.MapPost("/translate/import", (ImportBody b, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (Blank(b.From) is not { } from || Blank(b.To) is not { } to) return Bad("from und to fehlen.");
            return Import(c, actor, from, to, b.Units ?? new(), b.Force == true);
        });
    }

    public static IResult Import(Catalog c, string actor, string from, string to, List<ImportUnit> units, bool force)
    {
        {
            return c.With((model, tree, write) =>
            {
                if (!model.Locales.ContainsKey(to)) return Bad($"Unbekannte Zielsprache {to}.");
                int written = 0, unchanged = 0, skipped = 0, missing = 0; var errors = new List<string>();
                foreach (var u in units)
                {
                    if (!TryParse(u.Id, out var nodeId, out var attr, out var ch, out var row) || !tree.Nodes.TryGetValue(nodeId, out var n) || !model.Attributes.TryGetValue(attr, out var d)) { missing++; continue; }
                    var target = (u.Target ?? "").Trim();
                    if (target.Length == 0) { skipped++; continue; }
                    var source = n.Values.GetValueOrDefault(new Axis(attr, from, ch, row)) ?? "";
                    if (!force && u.SourceHash is { Length: > 0 } && u.SourceHash != Hash(source)) { skipped++; errors.Add($"{u.Id}: Quelle hat sich seit dem Export geändert — übergangen"); continue; }
                    if ((n.Values.GetValueOrDefault(new Axis(attr, to, ch, row)) ?? "") == target) { unchanged++; continue; }
                    if (!d.PerLocale) { errors.Add($"{u.Id}: {attr} ist nicht sprachabhängig"); continue; }
                    write(actor, n.Id, Types.AttributeSet, new AttributeSet(attr, to, ch, target, null, row), null);
                    written++;
                }
                return Results.Ok(new { written, unchanged, skipped, missing, errors = errors.Take(200).ToList() });
            });
        }
    }

    /// <summary>Einheit: node|attribut|kanal|zeile — kanal/zeile leer erlaubt.</summary>
    public static string UnitId(string node, string attribute, string? channel, string? row) => $"{node}|{attribute}|{channel ?? ""}|{row ?? ""}";
    private static bool TryParse(string? id, out string node, out string attribute, out string? channel, out string? row)
    {
        node = attribute = ""; channel = row = null;
        var p = (id ?? "").Split('|');
        if (p.Length < 2 || p[0].Length == 0 || p[1].Length == 0) return false;
        node = p[0]; attribute = p[1]; channel = p.Length > 2 && p[2].Length > 0 ? p[2] : null; row = p.Length > 3 && p[3].Length > 0 ? p[3] : null;
        return true;
    }
    public static string Hash(string s) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s.Trim()))).ToLowerInvariant()[..16];
}
