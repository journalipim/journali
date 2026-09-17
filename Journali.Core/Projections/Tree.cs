using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>Die Achsen eines Werts: Attribut × Sprache × Kanal, bei vermehrbaren Attributen × Zeile. Null = gilt für alle.</summary>
public readonly record struct Axis(string Attribute, string? Locale, string? Channel, string? Row = null);

public readonly record struct Release(string Channel, string? Locale);

/// <summary>Ein Knoten im Baum: Produktgruppe, Produkt oder Variante — mit allem, was sein Strom ergibt.</summary>
public sealed class Node
{
    public required string Id { get; init; }
    public required string Role { get; init; }
    public string? Parent { get; set; }
    public Labels Label { get; set; } = new();                 // Gruppe, Altlast (je Sprache) — der Name kommt daraus, wenn keiner gesetzt ist
    /// <summary>Eigener Name im Baum (NodeNamed; bei Gruppen aus GroupCreated/GroupRenamed). Null = die Automatik benennt.</summary>
    public string? Name { get; set; }
    /// <summary>Das Sternchen: Attribut, das ab hier nach unten benennt. Null = das der Vorfahren gilt.</summary>
    public string? LabelAttribute { get; set; }
    public string? Family { get; set; }                        // Produkt
    public string[] Axes { get; set; } = [];                   // Produkt: wonach es variiert
    public Dictionary<string, string> AxisValues { get; } = new(); // Variante
    public string Status { get; set; } = Statuses.Draft;
    public Dictionary<string, string> External { get; } = new();   // Quellsystem → Kennung dort
    /// <summary>Attributgruppen, die hier angehängt sind; die Definition vererbt sich nach unten.</summary>
    public string[] Groups { get; set; } = [];
    public Dictionary<Axis, string> Values { get; } = new();
    /// <summary>Je Achse die Nummer des Eintrags, der den Wert zuletzt setzte — für „zu überarbeiten“ gegen die Mastersprache.</summary>
    public Dictionary<Axis, long> SetAt { get; } = new();
    public Dictionary<Axis, string[]> Lists { get; } = new();
    /// <summary>Vermehrbare Attribute: Zeilen in Reihenfolge je Attribut.</summary>
    public Dictionary<string, List<string>> Rows { get; } = new();
    public HashSet<string> Categories { get; } = new();
    public HashSet<Release> Releases { get; } = new();
    public long LastNumber { get; set; }
    public DateTimeOffset LastAt { get; set; }
    public string LastActor { get; set; } = "";
    public int Entries { get; set; }

    /// <summary>Eigener Wert auf der Achse, sonst weniger spezifisch (Kanal weg, dann Sprache weg) — nur dieser Knoten. Listen zählen als Wert (verbunden mit Komma).</summary>
    public string? Own(string attribute, string? locale, string? channel, string? row = null)
    {
        foreach (var axis in Fallback(attribute, locale, channel, row))
        {
            if (Values.TryGetValue(axis, out var v)) return v;
            if (Lists.TryGetValue(axis, out var l)) return string.Join(", ", l);
        }
        return null;
    }

    private static IEnumerable<Axis> Fallback(string attribute, string? locale, string? channel, string? row)
    {
        yield return new Axis(attribute, locale, channel, row);
        if (channel is not null) yield return new Axis(attribute, locale, null, row);
        if (locale is not null || channel is not null) yield return new Axis(attribute, null, null, row);
    }
}

/// <summary>
/// Abbild „der Baum": alle Knoten mit Eltern, Werten, Kategorien, Freigaben.
/// Vererbung läuft den Pfad hinauf (docs/pflegestruktur.md, 5). Wird beim
/// Start aus dem Journal gebaut und danach synchron mit jedem Eintrag nachgezogen.
/// Einträge auf Strömen ohne Anlege-Eintrag werden übergangen.
/// </summary>
public sealed class Tree : IProjection
{
    private readonly Dictionary<string, Node> _nodes = new();
    private readonly Dictionary<string, HashSet<string>> _children = new();
    private readonly Dictionary<(string System, string Id), string> _external = new();
    private readonly HashSet<string> _ever = new();   // je angelegt — auch zurückgezogene, fürs Saatgut

    public long LastApplied { get; private set; }

    public IReadOnlyDictionary<string, Node> Nodes => _nodes;

    /// <summary>Gab es diesen Knoten je (auch wenn zurückgezogen)? Damit das Saatgut ihn nicht wieder anlegt.</summary>
    public bool EverCreated(string id) => _ever.Contains(id);

    public IEnumerable<Node> Children(string? parent) =>
        _children.TryGetValue(parent ?? "", out var ids) ? ids.Select(id => _nodes[id]) : [];

    public IEnumerable<Node> Roots => Children(null);

    /// <summary>Der Pfad von den Eltern bis zur Wurzel.</summary>
    public IEnumerable<Node> Ancestors(Node node)
    {
        for (var p = node.Parent; p is not null && _nodes.TryGetValue(p, out var n); p = n.Parent)
            yield return n;
    }

    /// <summary>Wert am Knoten oder — wenn <paramref name="inheritable"/> — von oben geerbt; liefert auch, woher.</summary>
    public (string? Value, Node? From) Resolve(Node node, string attribute, string? locale, string? channel, bool inheritable = true)
    {
        if (node.Own(attribute, locale, channel) is { } own) return (own, node);
        if (!inheritable) return (null, null);
        foreach (var a in Ancestors(node))
            if (a.Own(attribute, locale, channel) is { } v) return (v, a);
        return (null, null);
    }

    /// <summary>Wert mit der Vererbungsregel des Attributs aus dem Modell.</summary>
    public (string? Value, Node? From) Resolve(ModelCatalog model, Node node, string attribute, string? locale, string? channel) =>
        Resolve(node, attribute, locale, channel, model.Attributes.TryGetValue(attribute, out var d) && d.Inheritable);

    /// <summary>
    /// Formel-Attribut rechnen: das Skript ist der Wert am Knoten (eigen oder geerbt, je Sprache, wenn das
    /// Attribut so definiert ist); die $schlüssel darin werden wie Werte aufgelöst — geerbt zählt, Text in
    /// der Sprache, Wertelisten mit Label; eine Formel darf eine andere lesen (ohne Kreis, Tiefe 8).
    /// Null, wenn kein Skript da ist oder ein Wert fehlt.
    /// </summary>
    public string? Compute(ModelCatalog model, Node node, AttributeDefinition def, string? locale, int depth = 0)
    {
        if (!def.IsComputed || depth > 8) return null;
        var script = Resolve(model, node, def.Key, def.PerLocale ? locale : null, null).Value;
        return Evaluate(model, node, script, locale, out _, depth);
    }

    /// <summary>Ein beliebiges Skript im Kontext des Knotens rechnen — der Editor zeigt so das momentane Ergebnis beim Tippen (Taloan, 17.09.).</summary>
    public string? Evaluate(ModelCatalog model, Node node, string? script, string? locale, out string? error, int depth = 0)
    {
        error = null;
        if (string.IsNullOrWhiteSpace(script)) return null;
        Entries.Formula.Value value(string key)
        {
            if (!model.Attributes.TryGetValue(key, out var d)) return Entries.Formula.Value.None;
            var raw = d.IsComputed ? Compute(model, node, d, locale, depth + 1) : Resolve(model, node, key, d.PerLocale ? locale : null, null).Value;
            if (raw is null) return Entries.Formula.Value.None;
            if (d.Type is AttributeTypes.Integer or AttributeTypes.Decimal && decimal.TryParse(raw, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var n)) return Entries.Formula.Value.Of(n);
            if (d.Type == AttributeTypes.Enum && model.Lists.TryGetValue(d.List ?? "", out var list) && list.Values.TryGetValue(raw, out var lv) && lv.Label.GetValueOrDefault(locale ?? "de") is { Length: > 0 } label) return Entries.Formula.Value.Of(label);
            return Entries.Formula.Value.Of(raw);
        }
        return Entries.Formula.Run(script, value, locale, out error).AsText;
    }

    /// <summary>Die Attributgruppen, die hier gelten: am Knoten und an allen Vorfahren angehängt — von der Wurzel her, mit Herkunft.</summary>
    public List<(string Group, Node From)> EffectiveGroups(Node node)
    {
        var chain = Ancestors(node).Reverse().Append(node);
        var seen = new HashSet<string>();
        var result = new List<(string, Node)>();
        foreach (var n in chain)
            foreach (var g in n.Groups)
                if (seen.Add(g)) result.Add((g, n));
        return result;
    }

    /// <summary>
    /// Alle Sternchen am Pfad, das nächste zuerst: am Knoten selbst, dann die Vorfahren hinauf.
    /// Der Name nimmt das erste, dessen Attribut an der Rolle gilt und hier einen Wert hat (NodeRow.LabelOf).
    /// </summary>
    public IEnumerable<(string Attribute, Node From)> LabelAttributesOf(Node node)
    {
        if (node.LabelAttribute is not null) yield return (node.LabelAttribute, node);
        foreach (var a in Ancestors(node))
            if (a.LabelAttribute is not null) yield return (a.LabelAttribute, a);
    }

    /// <summary>Knoten, an denen dieses Attribut das Sternchen trägt — die Sperre fürs Zurückziehen des Attributs.</summary>
    public IEnumerable<Node> WithLabelAttribute(string attribute) => _nodes.Values.Where(n => n.LabelAttribute == attribute);

    /// <summary>Knoten zu einer externen Kennung, falls verknüpft.</summary>
    public Node? ByExternal(string system, string id) =>
        _external.TryGetValue((system, id), out var nodeId) && _nodes.TryGetValue(nodeId, out var n) ? n : null;

    /// <summary>Suche über Label, SKU, Id und alle eigenen Werte — ohne Index, gut bis einige zehntausend Knoten.</summary>
    public IEnumerable<(Node Node, string Hit)> Search(string q)
    {
        foreach (var n in _nodes.Values)
        {
            if (n.Id.Contains(q, StringComparison.OrdinalIgnoreCase)) { yield return (n, n.Id); continue; }
            if (n.Name is { } nm && nm.Contains(q, StringComparison.OrdinalIgnoreCase)) { yield return (n, nm); continue; }
            if (n.Label.Values.FirstOrDefault(l => l.Contains(q, StringComparison.OrdinalIgnoreCase)) is { } l) { yield return (n, l); continue; }
            if (n.AxisValues.Values.FirstOrDefault(v => v.Contains(q, StringComparison.OrdinalIgnoreCase)) is { } av) { yield return (n, av); continue; }
            var hit = n.Values.FirstOrDefault(kv => kv.Value.Contains(q, StringComparison.OrdinalIgnoreCase));
            if (hit.Key.Attribute is not null) { yield return (n, $"{hit.Key.Attribute}: {Snippet(hit.Value, q)}"); continue; }
            var list = n.Lists.FirstOrDefault(kv => kv.Value.Any(v => v.Contains(q, StringComparison.OrdinalIgnoreCase)));
            if (list.Key.Attribute is not null) yield return (n, $"{list.Key.Attribute}: {string.Join(", ", list.Value)}");
        }
    }

    private static string Snippet(string text, string q)
    {
        var plain = System.Text.RegularExpressions.Regex.Replace(text, "<[^>]+>", " ");
        var i = plain.IndexOf(q, StringComparison.OrdinalIgnoreCase);
        var start = Math.Max(0, i - 30);
        var s = plain.Substring(start, Math.Min(plain.Length - start, q.Length + 60)).Trim();
        return (start > 0 ? "…" : "") + s + (start + s.Length < plain.Length ? "…" : "");
    }

    /// <summary>Alle Nachfahren, tiefste zuerst — die Reihenfolge fürs Zurückziehen.</summary>
    public IEnumerable<Node> DescendantsDeepestFirst(string id)
    {
        foreach (var child in Children(id).ToList())
        {
            foreach (var d in DescendantsDeepestFirst(child.Id)) yield return d;
            yield return child;
        }
    }

    /// <summary>Alle Varianten mit dieser SKU — zur Eindeutigkeitsprüfung.</summary>
    public IEnumerable<Node> BySku(string sku) =>
        _nodes.Values.Where(n => n.Role == Roles.Variant && n.Values.TryGetValue(new Axis(Model.SkuAttribute, null, null), out var s) && s == sku);

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;

        Node? n;
        switch (entry.Type)
        {
            case Types.GroupCreated:
                var g = Types.Deserialize<GroupCreated>(entry.Payload);
                n = Create(entry, Roles.Group, g.Parent);
                n.Label = g.Label;
                n.Name = string.IsNullOrWhiteSpace(g.Name) ? TextOf(g.Label) : g.Name.Trim();
                break;
            case Types.ProductCreated:
                var pc = Types.Deserialize<ProductCreated>(entry.Payload);
                n = Create(entry, Roles.Product, pc.Group);
                n.Family = pc.Family;
                n.Axes = pc.Axes ?? [];
                break;
            case Types.VariantCreated:
                var vc = Types.Deserialize<VariantCreated>(entry.Payload);
                n = Create(entry, Roles.Variant, vc.Product);
                foreach (var (k, v) in vc.AxisValues) n.AxisValues[k] = v;
                break;
            default:
                if (!_nodes.TryGetValue(entry.Stream, out n)) return;   // kein Knoten: übergehen
                ApplyToNode(n, entry);
                break;
        }

        n.LastNumber = entry.Number;
        n.LastAt = entry.At;
        n.LastActor = entry.Actor;
        n.Entries++;
    }

    private Node Create(Entry entry, string role, string? parent)
    {
        _ever.Add(entry.Stream);
        var n = new Node { Id = entry.Stream, Role = role, Parent = parent };
        _nodes[entry.Stream] = n;
        Link(n);
        return n;
    }

    private void Link(Node n)
    {
        var key = n.Parent ?? "";
        if (!_children.TryGetValue(key, out var set)) _children[key] = set = new();
        set.Add(n.Id);
    }

    private void Unlink(Node n)
    {
        if (_children.TryGetValue(n.Parent ?? "", out var set)) set.Remove(n.Id);
    }

    /// <summary>Altlast-Label je Sprache als ein Name: de, sonst die erste gefüllte Sprache.</summary>
    private static string? TextOf(Labels label) =>
        label.GetValueOrDefault("de") is { Length: > 0 } de ? de : label.Values.FirstOrDefault(v => v.Length > 0);

    private void ApplyToNode(Node n, Entry entry)
    {
        switch (entry.Type)
        {
            case Types.GroupRenamed:
                n.Label = Types.Deserialize<GroupRenamed>(entry.Payload).Label;
                n.Name = TextOf(n.Label);
                break;
            case Types.ProductAxesSet:
                n.Axes = Types.Deserialize<ProductAxesSet>(entry.Payload).Axes.Distinct().ToArray();
                break;
            case Types.NodeNamed:
                var nn = Types.Deserialize<NodeNamed>(entry.Payload).Name;
                n.Name = string.IsNullOrWhiteSpace(nn) ? null : nn.Trim();
                break;
            case Types.LabelAttributeSet:
                var la = Types.Deserialize<LabelAttributeSet>(entry.Payload).Attribute;
                n.LabelAttribute = string.IsNullOrWhiteSpace(la) ? null : la.Trim();
                break;
            case Types.NodeMoved:
                Unlink(n);
                n.Parent = Types.Deserialize<NodeMoved>(entry.Payload).Parent;
                Link(n);
                break;
            case Types.NodeRetired:
                Unlink(n);
                foreach (var (sys, ext) in n.External) _external.Remove((sys, ext));
                _nodes.Remove(n.Id);
                break;
            case Types.ExternalLinked:
                var el = Types.Deserialize<ExternalLinked>(entry.Payload);
                if (n.External.TryGetValue(el.System, out var old)) _external.Remove((el.System, old));
                n.External[el.System] = el.Id;
                _external[(el.System, el.Id)] = n.Id;
                break;
            case Types.ExternalUnlinked:
                var eu = Types.Deserialize<ExternalUnlinked>(entry.Payload);
                if (n.External.Remove(eu.System, out var gone)) _external.Remove((eu.System, gone));
                break;
            case Types.StatusSet:
                n.Status = Types.Deserialize<StatusSet>(entry.Payload).Status;
                break;
            case Types.GroupsAttached:
                n.Groups = Types.Deserialize<GroupsAttached>(entry.Payload).Groups.Distinct().ToArray();
                break;
            case Types.AttributeSet:
                var a = Types.Deserialize<AttributeSet>(entry.Payload);
                var axis = new Axis(a.Attribute, a.Locale, a.Channel, a.Row);
                // Leer = eigener Wert weg, der Rückfall gilt wieder.
                if (a.Values is { } list)
                {
                    if (list.Length == 0) n.Lists.Remove(axis); else n.Lists[axis] = list;
                }
                else if (string.IsNullOrEmpty(a.Value)) n.Values.Remove(axis);
                else n.Values[axis] = a.Value;
                if (n.Values.ContainsKey(axis) || n.Lists.ContainsKey(axis)) n.SetAt[axis] = entry.Number; else n.SetAt.Remove(axis);
                break;
            case Types.RowAdded:
                var ra = Types.Deserialize<RowAdded>(entry.Payload);
                if (!n.Rows.TryGetValue(ra.Attribute, out var rows)) n.Rows[ra.Attribute] = rows = new();
                if (!rows.Contains(ra.Row)) rows.Add(ra.Row);
                break;
            case Types.RowRemoved:
                var rr = Types.Deserialize<RowRemoved>(entry.Payload);
                if (n.Rows.TryGetValue(rr.Attribute, out var rl)) rl.Remove(rr.Row);
                foreach (var k in n.Values.Keys.Where(k => k.Row == rr.Row).ToList()) n.Values.Remove(k);
                foreach (var k in n.Lists.Keys.Where(k => k.Row == rr.Row).ToList()) n.Lists.Remove(k);
                break;
            case Types.RowOrdered:
                var ro = Types.Deserialize<RowOrdered>(entry.Payload);
                if (n.Rows.TryGetValue(ro.Attribute, out var ol))
                {
                    // Genannte in der neuen Reihenfolge, ungenannte hinten dran.
                    var known = ol.ToHashSet();
                    var ordered = ro.Rows.Where(known.Contains).Distinct().ToList();
                    ordered.AddRange(ol.Where(r => !ordered.Contains(r)));
                    ol.Clear(); ol.AddRange(ordered);
                }
                break;
            case Types.CategoryAssigned:
                n.Categories.Add(Types.Deserialize<CategoryAssigned>(entry.Payload).Category);
                break;
            case Types.CategoryRemoved:
                n.Categories.Remove(Types.Deserialize<CategoryRemoved>(entry.Payload).Category);
                break;
            case Types.ReleaseGranted:
                var gr = Types.Deserialize<ReleaseGranted>(entry.Payload);
                n.Releases.Add(new Release(gr.Channel, gr.Locale));
                break;
            case Types.ReleaseRevoked:
                var rv = Types.Deserialize<ReleaseRevoked>(entry.Payload);
                n.Releases.Remove(new Release(rv.Channel, rv.Locale));
                break;
        }
    }
}
