using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Übersetzungsmanagement:
/// die Einheiten einer Sprachrichtung — je Knoten × sprachabhängiges Textattribut × Kanal × Zeile der eigene Quelltext, der
/// eigene Zieltext und der Zustand: <c>missing</c> (kein Ziel), <c>stale</c> (Ziel da, aber die Quelle ist seither neuer — ⟳ wie in
/// der Zelle), <c>done</c>. Vererbte Werte gehören dem Vorfahren und tauchen dort auf. Das Plugin <c>xliff</c> macht daraus XLIFF 2.0
/// für Agenturen und CAT-Werkzeuge, liest es zurück und lässt die KI vorübersetzen.
///
/// Der Rückweg
/// entscheidet je Einheit am Fingerabdruck — und verwirft nie einen Auftrag:
/// <list type="bullet">
/// <item>Quelle seit dem Auftrag unverändert → schreiben, Marke auf jetzt: fertig.</item>
/// <item>Quelle ist weitergezogen → <b>trotzdem schreiben</b> (sie ist besser als die vorige), Marke auf die Auftragsversion:
/// die Einheit bleibt im Rückstand und geht als Differenz ins nächste Paket — nie wieder der ganze Text.</item>
/// <item>Das Ziel wurde hier von Hand geändert, seit der Auftrag hinausging → nicht überschreiben, ein Mensch sieht es an.</item>
/// </list>
/// Der Zustand kommt darum aus der <b>Marke</b> (<see cref="Translations"/>), nicht aus „wer wurde zuletzt geschrieben“: ein frisch
/// eingespielter, aber überholter Zieltext ist <c>stale</c>, nicht <c>done</c>. Ohne Marke (Bestand) gilt weiter der Zeitvergleich.
/// </summary>
public static class TranslateApi
{
    public sealed record Unit(string Id, string Node, string Label, string Role, string Attribute, string AttributeLabel, string Type, string? Channel, string? Row, string Source, string SourceHash, string? Target, string State, long SourceAt, long TargetAt)
    {
        /// <summary>Vorschlag aus dem Gedächtnis: derselbe Quelltext ist anderswo schon übersetzt (unit) oder steht im Wörterbuch (term).</summary>
        public string? Memory { get; init; }
        public string? MemoryFrom { get; init; }
    }
    private static string Norm(string s) => s.Trim().ToLowerInvariant().Replace("\r\n", "\n");

    /// <summary>Gedächtnis der Sprachrichtung: normierter Quelltext → Zieltext, aus allen fertigen Einheiten (nur gleiches Attribut zählt nicht — ein Text ist ein Text) und aus dem Wörterbuch.</summary>
    public static Dictionary<string, (string Target, string From)> Memory(ModelCatalog model, Tree tree, string from, string to)
    {
        var mem = new Dictionary<string, (string, string)>();
        var defs = model.Attributes.Values.Where(a => a.PerLocale && a.Type is AttributeTypes.Text or AttributeTypes.Html).Select(a => a.Key).ToHashSet();
        foreach (var n in tree.Nodes.Values)
            foreach (var (ax, src) in n.Values.Where(kv => defs.Contains(kv.Key.Attribute) && kv.Key.Locale == from && !string.IsNullOrWhiteSpace(kv.Value)))
            {
                var t = new Axis(ax.Attribute, to, ax.Channel, ax.Row);
                if (n.Values.TryGetValue(t, out var tv) && !string.IsNullOrWhiteSpace(tv) && n.SetAt.GetValueOrDefault(t) >= n.SetAt.GetValueOrDefault(ax)) mem.TryAdd(Norm(src), (tv, "unit"));
            }
        foreach (var term in model.Terms.Values)
            if (term.Text.TryGetValue(from, out var s) && term.Text.TryGetValue(to, out var t) && !string.IsNullOrWhiteSpace(s) && !string.IsNullOrWhiteSpace(t)) mem[Norm(s)] = (t, "term");   // Wörterbuch schlägt die Einheit
        return mem;
    }
    public sealed record ImportUnit(string Id, string? Target, string? SourceHash);
    public sealed record ImportBody(string From, string To, List<ImportUnit> Units, bool? Force, string? Order = null);

    private static readonly XNamespace X2 = "urn:oasis:names:tc:xliff:document:2.0";
    private static readonly XNamespace X1 = "urn:oasis:names:tc:xliff:document:1.2";

    /// <summary>Einheiten rechnen (gemeinsam für /units und /xliff).</summary>
    public static (IResult? Error, string From, string To, List<Unit> Units) Collect(ModelCatalog model, Tree tree, string? root, string? from, string? to, string? channel, string? attributes, string scope, int limit, Workflows? workflows = null, string? wf = null, string? wfState = null, Translations? marks = null)
    {
        from = Blank(from) ?? model.MasterLocale; to = Blank(to);
        if (from is null || to is null) return (Bad("from und to (Sprachen) fehlen."), "", "", new());
        if (!model.Locales.ContainsKey(from) || !model.Locales.ContainsKey(to)) return (Bad("Unbekannte Sprache."), "", "", new());
        if (from == to) return (Bad("Quelle und Ziel sind dieselbe Sprache."), "", "", new());
        var wanted = Blank(attributes)?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet();
        var defs = model.Attributes.Values.Where(a => a.PerLocale && a.Type is AttributeTypes.Text or AttributeTypes.Html && (wanted is null || wanted.Contains(a.Key))).ToList();
        var nodes = (Blank(root) is { } r ? (tree.Nodes.TryGetValue(r, out var rn) ? new[] { rn }.Concat(tree.DescendantsDeepestFirst(r)) : []) : tree.Nodes.Values).Where(n => n.Role != Roles.Rubric);
        // nur Knoten in einem Workflow-Zustand (27: „zur Übersetzung“) —
        if (workflows is not null && Blank(wf) is { } wfKey && workflows.All.TryGetValue(wfKey, out var wfDef) && Blank(wfState) is { } wantedState)
            nodes = nodes.Where(n => wfDef.AppliesTo(n) && workflows.StateOf(n.Id, wfDef) == wantedState);
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
                    // Zustand aus der Marke: gegen welche Quellversion ist übersetzt? Ohne Marke wie bisher über die Zeit.
                    var mark = marks?.Of(n.Id, tAxis);
                    var state = string.IsNullOrWhiteSpace(target) ? "missing"
                        : mark is { } mk ? (mk.SourceHash == Hash(source) ? "done" : "stale")
                        : sAt > tAt ? "stale" : "done";
                    if (scope == "missing" && state != "missing" || scope == "stale" && state != "stale" || scope == "open" && state == "done") continue;
                    units.Add(new Unit(UnitId(n.Id, d.Key, axis.Channel, axis.Row), n.Id, NodeRow.LabelOf(tree, model, n), n.Role, d.Key, d.Label?.GetValueOrDefault(from) ?? d.Label?.GetValueOrDefault("de") ?? d.Key, d.Type, axis.Channel, axis.Row, source, Hash(source), target, state, sAt, tAt));
                    if (units.Count >= Math.Clamp(limit, 1, 50000)) return (null, from, to, units);
                }
            }
        }
        // Gedächtnis dazu — nur für offene Einheiten
        if (units.Any(u => u.State != "done"))
        {
            var mem = Memory(model, tree, from, to);
            for (var i = 0; i < units.Count; i++)
                if (units[i].State != "done" && mem.TryGetValue(Norm(units[i].Source), out var hit) && hit.Target != units[i].Target) units[i] = units[i] with { Memory = hit.Target, MemoryFrom = hit.From };
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

    /// <summary>Den Auftrag in die Datei schreiben (Attribut am file-Element) — der Rücklauf findet ihn wieder.</summary>
    public static string WithOrder(string xml, string order)
    {
        if (string.IsNullOrEmpty(order)) return xml;
        var doc = XDocument.Parse(xml);
        foreach (var f in doc.Descendants(X2 + "file")) f.SetAttributeValue("journali-order", order);
        return doc.Declaration + Environment.NewLine + doc.ToString();
    }

    /// <summary>Der Auftrag aus einer XLIFF-Datei (Attribut am file-Element), null = frei importiert.</summary>
    public static string? OrderOf(string xml)
    {
        try { return XDocument.Parse(xml).Descendants().Select(e => e.Attribute("journali-order")?.Value).FirstOrDefault(v => !string.IsNullOrEmpty(v)); }
        catch { return null; }
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
        api.MapGet("/translate/xliff", (Catalog c, string? root = null, string? from = null, string? to = null, string? channel = null, string? attributes = null, string scope = "open", int limit = 50000, string? wf = null, string? wfState = null) =>
        {
            var (err, f, t, units, xml) = c.Lesen((model, tree) =>
            {
                var r = Collect(model, tree, root, from, to, channel, attributes, scope, limit, c.Workflows, wf, wfState, c.Translations);
                return (r.Error, r.From, r.To, r.Units.Count, r.Error is null ? ToXliff(r.From, r.To, r.Units, "journali:" + (Blank(root) ?? "*")) : "");
            });
            if (err is not null) return err;
            return Results.File(Encoding.UTF8.GetBytes(xml), "application/xliff+xml", $"journali-{f}-{t}-{DateTime.Now:yyyyMMdd-HHmm}.xlf");
        });
        // XLIFF zurück: Body = XML; Sprachen aus der Datei (to darf die URL übersteuern); dieselben Regeln wie /translate/import
        api.MapPost("/translate/xliff", async (HttpRequest req, Catalog c, string? to = null, bool force = false, string? order = null) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            string xml; using (var sr = new StreamReader(req.Body, Encoding.UTF8)) xml = await sr.ReadToEndAsync();
            var (from, fileTo, units, error) = FromXliff(xml);
            if (error is not null) return Bad(error);
            var fileOrder = OrderOf(xml);
            var target = Blank(to) ?? fileTo;
            if (from is null || target is null) return Bad("Sprachen fehlen (srcLang/trgLang bzw. to).");
            return Import(c, actor, from, target, units, force, Blank(order) ?? fileOrder);
        });

        // Einheiten: root (leer = alle Wurzeln), from/to (Sprachen), channel (leer = alle Kanäle des Attributs), attributes (Keys mit Komma, leer = alle Textattribute mit Sprachachse), scope = missing | stale | open (beide) | all
        api.MapGet("/translate/units", (Catalog c, string? root = null, string? from = null, string? to = null, string? channel = null, string? attributes = null, string scope = "open", int limit = 5000, string? wf = null, string? wfState = null) =>
            c.Lesen((model, tree) =>
            {
                var r = Collect(model, tree, root, from, to, channel, attributes, scope, limit, c.Workflows, wf, wfState, c.Translations);
                if (r.Error is not null) return r.Error;
                var units = r.Units;
                return Results.Ok(new { from = r.From, to = r.To, count = units.Count, missing = units.Count(u => u.State == "missing"), stale = units.Count(u => u.State == "stale"), done = units.Count(u => u.State == "done"), units });
            }));

        // Übersicht je Sprache (für die Ansicht): wie viele Einheiten fehlen / sind veraltet / fertig — je Zielsprache gegen den Master
        api.MapGet("/translate/status", (Catalog c, string? root = null) => c.Lesen((model, tree) =>
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
                    else if (c.Translations.Of(n.Id, t) is { } mk) { if (mk.SourceHash == Hash(n.Values.GetValueOrDefault(ax) ?? "")) done++; else stale++; }   // dieselbe Rechnung wie die Liste: die Marke
                    else if (n.SetAt.GetValueOrDefault(ax) > n.SetAt.GetValueOrDefault(t)) stale++;
                    else done++;
                }
                var out_ = c.Translations.Open.Where(o => o.To == l).ToList();   // was in dieser Sprache gerade draussen ist
                return new { locale = l, label = model.Locales[l].Label, missing, stale, done, total = sources.Count, behind = missing + stale, orders = out_.Count, outUnits = out_.Sum(o => o.Units.Count), oldest = out_.Count == 0 ? (DateTimeOffset?)null : out_.Min(o => o.Created) };
            }).ToList();
            return Results.Ok(new { from, total = sources.Count, locales });
        }));

        // Rückweg: Zieltexte schreiben — nur, wenn die Quelle noch dieselbe ist (sourceHash), sonst übergangen (force: true schreibt trotzdem)
        api.MapPost("/translate/import", (ImportBody b, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (Blank(b.From) is not { } from || Blank(b.To) is not { } to) return Bad("from und to fehlen.");
            return Import(c, actor, from, to, b.Units ?? new(), b.Force == true, b.Order);
        });

        // Das Paket schnüren (30): aus dem Rückstand wird ein Auftrag — ein Zeiger ins Journal mit den Fingerabdrücken, die hinausgehen.
        // Zwei Auslöser, ein Weg: der Job nach Zeitplan (wöchentlich, nachts) und der Übergang „Version der Mastersprache“ rufen dasselbe.
        api.MapPost("/translate/order", (HttpRequest req, Catalog c, string? root = null, string? from = null, string? to = null, string? channel = null, string? attributes = null, string scope = "open", int limit = 50000, string? wf = null, string? wfState = null, string? note = null, string? format = null) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var (err, key, count, f, t, xml) = c.With<(IResult? Error, string Key, int Count, string From, string To, string Xliff)>((model, tree, write) =>
            {
                var r = Collect(model, tree, root, from, to, channel, attributes, scope, limit, c.Workflows, wf, wfState, c.Translations);
                if (r.Error is not null) return (r.Error, "", 0, "", "", "");
                if (r.Units.Count == 0) return (Bad("Nichts im Rückstand — kein Auftrag."), "", 0, r.From, r.To, "");
                var k = Ids.TranslationOrder();
                var units = r.Units.Select(u => new OrderUnit(u.Id, u.SourceHash, string.IsNullOrEmpty(u.Target) ? null : Hash(u.Target))).ToList();
                var attrs = Blank(attributes)?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToArray();
                write(actor, Translations.Stream + k, Types.TranslationOrdered, new TranslationOrdered(r.From, r.To, units, Blank(root), Blank(channel), attrs, scope, 0, Blank(note)), null);
                return (null, k, r.Units.Count, r.From, r.To, ToXliff(r.From, r.To, r.Units, "journali:" + k));
            });
            if (err is not null) return err;
            if (Blank(format) == "xliff") return Results.File(Encoding.UTF8.GetBytes(WithOrder(xml, key)), "application/xliff+xml", $"journali-{f}-{t}-{key}.xlf");
            return Results.Ok(new { order = key, from = f, to = t, count });
        });

        // Was draussen ist und was zurückkam
        api.MapGet("/translate/orders", (Catalog c, string? state = null, int limit = 100) => c.Lesen((_, _) =>
            Results.Ok(c.Translations.Orders.Values
                .Where(o => Blank(state) is not { } s || (s == "open" ? !o.Returned : o.Returned))
                .OrderByDescending(o => o.Number).Take(Math.Clamp(limit, 1, 1000))
                .Select(o => new { order = o.Key, o.From, o.To, o.Root, o.Channel, o.Scope, o.Note, at = o.Created, o.Actor, units = o.Units.Count, o.Returned, o.ReturnedAt, o.Written, o.Behind, o.Conflicts, o.Skipped }).ToList())));
    }

    public static IResult Import(Catalog c, string actor, string from, string to, List<ImportUnit> units, bool force, string? order = null)
    {
        return c.With((model, tree, write) =>
        {
            if (!model.Locales.ContainsKey(to)) return Bad("Unbekannte Zielsprache {0}.", to);
            var ord = Blank(order) is { } ok ? c.Translations.Order(ok) : null;
            if (Blank(order) is { } want && ord is null) return Bad("Unbekannter Auftrag {0}.", want);
            int written = 0, behind = 0, conflicts = 0, unchanged = 0, skipped = 0, missing = 0; var errors = new List<string>(); var nodes = new HashSet<string>();
            foreach (var u in units)
            {
                if (!TryParse(u.Id, out var nodeId, out var attr, out var ch, out var row) || !tree.Nodes.TryGetValue(nodeId, out var n) || !model.Attributes.TryGetValue(attr, out var d)) { missing++; continue; }
                var target = (u.Target ?? "").Trim();
                if (target.Length == 0) { skipped++; continue; }
                if (!d.PerLocale) { errors.Add($"{u.Id}: {attr} ist nicht sprachabhängig"); continue; }
                var srcAxis = new Axis(attr, from, ch, row); var tgtAxis = new Axis(attr, to, ch, row);
                var source = n.Values.GetValueOrDefault(srcAxis) ?? "";
                var current = n.Values.GetValueOrDefault(tgtAxis) ?? "";
                var sent = ord?.Units.GetValueOrDefault(u.Id);
                var mark = c.Translations.Of(n.Id, tgtAxis);
                // Fall 3: hier wurde von Hand nachgebessert, seit der Auftrag hinausging — das überschreibt niemand ungefragt
                var byHand = sent?.TargetHash is { Length: > 0 } th ? Hash(current) != th
                    : mark is { } mk && n.SetAt.GetValueOrDefault(tgtAxis) > mk.At;
                if (!force && byHand && current != target && current.Length > 0)
                {
                    conflicts++; errors.Add($"{u.Id}: das Ziel wurde hier geändert, seit der Auftrag hinausging — nicht überschrieben");
                    continue;
                }
                var sourceHash = Hash(source);
                var sentHash = Blank(u.SourceHash) ?? sent?.SourceHash;
                var late = sentHash is { Length: > 0 } sh && sh != sourceHash;   // Fall 2: die Quelle ist weitergezogen
                if (current == target) unchanged++;
                else
                {
                    write(actor, n.Id, Types.AttributeSet, new AttributeSet(attr, to, ch, target, null, row), null);
                    written++; nodes.Add(n.Id);
                }
                if (late) behind++;   // bleibt im Rückstand, ob geschrieben oder nicht — die Differenz geht ins nächste Paket
                // die Marke sagt, gegen welche Quellversion dieser Zieltext übersetzt ist — bei Fall 2 die des Auftrags, nicht die von jetzt
                write(actor, n.Id, Types.TranslationMarked, new TranslationMarked(attr, to, ch, row, late ? sentHash! : sourceHash, late ? (ord?.At ?? 0) : n.SetAt.GetValueOrDefault(srcAxis), ord?.Key), null);
            }
            if (ord is not null && !ord.Returned) write(actor, Translations.Stream + ord.Key, Types.TranslationReturned, new TranslationReturned(written, behind, conflicts, skipped), null);
            return Results.Ok(new { written, behind, conflicts, unchanged, skipped, missing, order = ord?.Key, nodes = nodes.ToList(), errors = errors.Take(200).ToList() });
        });
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
