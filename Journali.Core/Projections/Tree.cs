using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>Die Achsen eines Werts: Attribut × Sprache × Kanal, bei vermehrbaren Attributen × Zeile. Null = gilt für alle.</summary>
public readonly record struct Axis(string Attribute, string? Locale, string? Channel, string? Row = null);

public readonly record struct Release(string Channel, string? Locale);

/// <summary>Ein Knoten im Baum: Produktgruppe, Produkt oder Variante — mit allem, was sein Strom ergibt.</summary>
/// <summary>Beleg eines Werts: Quelle (URL oder Text), Titel, Notiz, Weg (web | ai | rule | import | manual), Prüfdatum, Eintrag und Akteur.</summary>
public sealed record ValueSource(string Source, string? Title, string? Note, string Method, string CheckedAt, long Number, string Actor);

public sealed class Node
{
    public required string Id { get; init; }
    public required string Role { get; init; }
    public string? Parent { get; set; }
    public int? Order { get; set; }   // Platz unter den Geschwistern (NodeOrdered); null = alphabetisch
    public Labels Label { get; set; } = new();                 // Gruppe, Altlast (je Sprache) — der Name kommt daraus, wenn keiner gesetzt ist
    /// <summary>Eigener Name im Baum (NodeNamed; bei Gruppen aus GroupCreated/GroupRenamed). Null = die Automatik benennt.</summary>
    public string? Name { get; set; }
    /// <summary>Das Sternchen: Attribut, das ab hier nach unten benennt. Null = das der Vorfahren gilt.</summary>
    public string? LabelAttribute { get; set; }
    public string? Family { get; set; }                        // Produkt
    public string[] Axes { get; set; } = [];                   // Produkt: wonach es variiert
    public Dictionary<string, string> AxisValues { get; } = new(); // Variante
    public string Status { get; set; } = Statuses.Draft;
    /// <summary>Nummer des Eintrags, der den Status setzte — 0 heisst: nie gesetzt. Nötig, seit auch Gruppen einen
    /// Status haben dürfen: <see cref="Status"/> ist mit „draft“ vorbelegt, und eine Gruppe, die nie
    /// jemand angefasst hat, ist kein Entwurf — sie hat schlicht keinen.</summary>
    public long StatusAt { get; set; }
    /// <summary>Hat dieser Knoten einen eigenen Status? Produkte und Varianten immer (sie beginnen als Entwurf),
    /// Gruppen erst, wenn jemand einen setzt.</summary>
    public bool HasStatus => Role != Roles.Group || StatusAt > 0;
    public Dictionary<string, string> External { get; } = new();   // Quellsystem → Kennung dort
    /// <summary>Attributgruppen, die hier angehängt sind; die Definition vererbt sich nach unten.</summary>
    public string[] Groups { get; set; } = [];
    public Dictionary<Axis, string> Values { get; } = new();
    /// <summary>Je Achse die Nummer des Eintrags, der den Wert zuletzt setzte — für „zu überarbeiten“ gegen die Mastersprache.</summary>
    public Dictionary<Axis, long> SetAt { get; } = new();
    public Dictionary<Axis, ValueSource> Sources { get; } = new();   // Beleg je Wert (ValueSourced)
    public Dictionary<Axis, string[]> Lists { get; } = new();
    /// <summary>Vermehrbare Attribute: Zeilen in Reihenfolge je Attribut.</summary>
    public Dictionary<string, List<string>> Rows { get; } = new();
    public HashSet<string> Categories { get; } = new();
    public HashSet<Release> Releases { get; } = new();
    /// <summary>Rubrik-Wurzel: Kanal und Markt des Publikationsbaums.</summary>
    public string? Channel { get; set; }
    public string? Market { get; set; }
    public string? Source { get; set; }   // Rubrik: die Pflegegruppe, aus der sie kopiert wurde — ihre Werte sind dort, hier nur zu lesen
    public long? Stand { get; set; }      // Rubrik: eingefroren bei Journalnummer (PubStandSet); null = live
    /// <summary>Rubrik: die hier per Verweis hängenden Pflegeknoten, in Reihenfolge.</summary>
    public List<string> Placed { get; } = new();
    public Dictionary<string, string> PlacedNames { get; } = new();   // Anzeigename je Verweis (PlaceNamed) — intern, nie Ausgabe
    public List<PubRule> Rules { get; } = new();                        // Regel-Verweise (RulePlaced) — beim Lesen aufgelöst, Rules.cs
    public long LastNumber { get; set; }
    public DateTimeOffset LastAt { get; set; }
    public string LastActor { get; set; } = "";
    public int Entries { get; set; }

    /// <summary>
    /// Eigener Wert auf der Achse, sonst weniger spezifisch — nur dieser Knoten. Kette je Achse: eigener Wert →
    /// Master → Stern; der Kanal fällt zuerst, dann die Sprache. Ohne Master (null) nur eigen → Stern. Listen zählen als Wert (verbunden mit Komma).
    /// </summary>
    public string? Own(string attribute, string? locale, string? channel, string? row = null, string? masterLocale = null, string? masterChannel = null, IReadOnlyDictionary<string, string>? localeFallback = null, IReadOnlyDictionary<string, string>? channelFallback = null)
    {
        foreach (var axis in Fallback(attribute, locale, channel, row, masterLocale, masterChannel, localeFallback, channelFallback))
        {
            if (Values.TryGetValue(axis, out var v)) return v;
            if (Lists.TryGetValue(axis, out var l)) return string.Join(", ", l);
        }
        return null;
    }

    /// <summary>Die Achsen in der Reihenfolge, in der sie gelten: je Achse Wert → Fallback(s) → Master → Stern, Kanal innen, Sprache aussen — ohne Doppelte.</summary>
    public static IEnumerable<Axis> Fallback(string attribute, string? locale, string? channel, string? row, string? masterLocale = null, string? masterChannel = null, IReadOnlyDictionary<string, string>? localeFallback = null, IReadOnlyDictionary<string, string>? channelFallback = null)
    {
        var seen = new HashSet<Axis>();
        foreach (var l in Chain(locale, masterLocale, localeFallback))
            foreach (var c in Chain(channel, masterChannel, channelFallback))
            {
                var axis = new Axis(attribute, l, c, row);
                if (seen.Add(axis)) yield return axis;
            }
    }

    /// <summary>Wert → Fallback → dessen Fallback … (ohne Kreis, höchstens 8) → Master → Stern.</summary>
    public static IEnumerable<string?> Chain(string? value, string? master, IReadOnlyDictionary<string, string>? fallback = null)
    {
        yield return value;
        if (value is null) yield break;
        var seen = new HashSet<string> { value };
        var cur = value;
        for (var i = 0; i < 8 && fallback is not null && fallback.TryGetValue(cur, out var fb) && seen.Add(fb); i++) { yield return fb; cur = fb; }
        if (master is not null && seen.Add(master)) yield return master;
        yield return null;
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
    private readonly Dictionary<string, Node> _retired = new();   // zurückgezogen, mit allem, was sie hatten — für NodeRestored

    public long LastApplied { get; private set; }
    /// <summary>Mastersprache und Masterkanal, mitgelesen aus settings:* — die Fallback-Kette von <see cref="Resolve"/> braucht sie.</summary>
    public string? MasterLocale { get; private set; }
    public string? MasterChannel { get; private set; }
    /// <summary>Fallback je Sprache / je Kanal (LocaleDefined.Fallback, ChannelDefined.Fallback), mitgelesen wie die Master.</summary>
    public Dictionary<string, string> LocaleFallback { get; } = new();
    public Dictionary<string, string> ChannelFallback { get; } = new();

    public IReadOnlyDictionary<string, Node> Nodes => _nodes;
    /// <summary>Zurückgezogene Knoten (Papierkorb): lassen sich zurückholen, solange der Vater da ist.</summary>
    public IReadOnlyDictionary<string, Node> Retired => _retired;
    /// <summary>Zurückgezogene Kinder eines Knotens — zum Zurückholen eines Teilbaums von oben nach unten.</summary>
    public IEnumerable<Node> RetiredChildren(string id) => _retired.Values.Where(n => n.Parent == id);

    /// <summary>Gab es diesen Knoten je (auch wenn zurückgezogen)? Damit das Saatgut ihn nicht wieder anlegt.</summary>
    public bool EverCreated(string id) => _ever.Contains(id);

    public IEnumerable<Node> Children(string? parent) =>
        _children.TryGetValue(parent ?? "", out var ids) ? ids.Select(id => _nodes[id]) : [];

    /// <summary>Wurzeln des Pflegebaums (ohne Publikationsbäume).</summary>
    public IEnumerable<Node> Roots => Children(null).Where(n => n.Role != Roles.Rubric);
    /// <summary>Die Publikationsbäume: Rubriken ohne Vater.</summary>
    public IEnumerable<Node> PubTrees => Children(null).Where(n => n.Role == Roles.Rubric);
    private readonly Dictionary<string, HashSet<string>> _placedIn = new();
    /// <summary>Rubriken, in denen ein Pflegeknoten hängt.</summary>
    public IEnumerable<Node> PlacedIn(string nodeId) => _placedIn.TryGetValue(nodeId, out var s) ? s.Select(id => _nodes.GetValueOrDefault(id)).OfType<Node>() : [];
    /// <summary>Die Wurzel des Publikationsbaums einer Rubrik.</summary>
    public Node PubTreeOf(Node rubric) { var n = rubric; while (n.Parent is { } p && _nodes.TryGetValue(p, out var up)) n = up; return n; }
    /// <summary>Wirksamer Stand einer Rubrik: der eigene, sonst der der nächsten Rubrik darüber; null = live. Liefert auch, welche Rubrik ihn setzt.</summary>
    public (long? Stand, Node? From) StandOf(Node rubric) { for (var n = rubric; n is not null; n = n.Parent is { } p && _nodes.TryGetValue(p, out var up) ? up : null) if (n.Stand is { } s) return (s, n); return (null, null); }

    /// <summary>Der Pfad von den Eltern bis zur Wurzel.</summary>
    public IEnumerable<Node> Ancestors(Node node)
    {
        for (var p = node.Parent; p is not null && _nodes.TryGetValue(p, out var n); p = n.Parent)
            yield return n;
    }

    /// <summary>
    /// Wert am Knoten oder — wenn <paramref name="inheritable"/> — von oben geerbt; liefert auch, woher. Je Knoten die ganze Fallback-Kette
    /// (Master, Stern), erst dann der nächste Vorfahr. <paramref name="masters"/> = false: ohne Master — für die Vollständigkeit, die je Sprache
    /// und Kanal zählt.
    /// </summary>
    public (string? Value, Node? From) Resolve(Node node, string attribute, string? locale, string? channel, bool inheritable = true, bool masters = true)
    {
        var ml = masters ? MasterLocale : null; var mc = masters ? MasterChannel : null;
        if (node.Own(attribute, locale, channel, null, ml, mc, LocaleFallback, ChannelFallback) is { } own) return (own, node);
        if (!inheritable) return (null, null);
        foreach (var a in Ancestors(node))
            if (a.Own(attribute, locale, channel, null, ml, mc, LocaleFallback, ChannelFallback) is { } v) return (v, a);
        return (null, null);
    }

    /// <summary>
    /// Freigabe (Sortiment) für Kanal × Sprache: eigene Freigabe (genau oder für alle Sprachen), sonst die des Fallback-Kanals
    ///. Kein Master-Fallback — eine Freigabe für web ist keine für print.
    /// Liefert den Kanal, über den sie gilt (null = keine).
    /// </summary>
    public string? ReleasedVia(Node node, string channel, string? locale)
    {
        foreach (var c in Node.Chain(channel, null, ChannelFallback))
        {
            if (c is null) break;
            if (node.Releases.Contains(new Release(c, locale)) || (locale is not null && node.Releases.Contains(new Release(c, null)))) return c;
        }
        return null;
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
        return def.IsTemplate ? Render(model, node, script, locale, depth) : Evaluate(model, node, script, locale, out _, depth);
    }

    /// <summary>Vorlage im Kontext des Knotens bauen (Template.cs): {key} wie in der Formel aufgelöst, dazu Zahl und Einheit für |2 und |unit.</summary>
    public string? Render(ModelCatalog model, Node node, string? template, string? locale, int depth = 0)
    {
        if (string.IsNullOrWhiteSpace(template)) return null;
        Entries.Template.Slot slot(string key)
        {
            var v = ValueOf(model, node, key, locale, depth);
            if (v.IsNone) return Entries.Template.Slot.None;
            var unit = model.Attributes.TryGetValue(key, out var d) && d.Unit is { Length: > 0 } u ? (model.Units.TryGetValue(u, out var ud) ? ud.Key : u) : null;
            return new Entries.Template.Slot(v.AsText, v.Kind == Entries.Formula.Kind.Number ? v.Number : null, unit);
        }
        return Entries.Template.Render(template, slot, locale);
    }

    /// <summary>Ein beliebiges Skript im Kontext des Knotens rechnen — der Editor zeigt so das momentane Ergebnis beim Tippen.</summary>
    public string? Evaluate(ModelCatalog model, Node node, string? script, string? locale, out string? error, int depth = 0)
    {
        error = null;
        if (string.IsNullOrWhiteSpace(script)) return null;
        return Entries.Formula.Run(script, key => ValueOf(model, node, key, locale, depth), locale, out error).AsText;
    }

    /// <summary>Wert eines Attributs für Formel und Vorlage: geerbt zählt, Zahl als Zahl, Werteliste als Label der Sprache, gerechnete Attribute gerechnet.</summary>
    private Entries.Formula.Value ValueOf(ModelCatalog model, Node node, string key, string? locale, int depth)
    {
        if (!model.Attributes.TryGetValue(key, out var d)) return Entries.Formula.Value.None;
        var raw = d.IsComputed ? Compute(model, node, d, locale, depth + 1) : Resolve(model, node, key, d.PerLocale ? locale : null, null).Value;
        if (raw is null) return Entries.Formula.Value.None;
        if (d.Type is AttributeTypes.Integer or AttributeTypes.Decimal && decimal.TryParse(raw, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var n)) return Entries.Formula.Value.Of(n);
        if (d.Type == AttributeTypes.Enum && model.Lists.TryGetValue(d.List ?? "", out var list) && list.Values.TryGetValue(raw, out var lv) && lv.Label.GetValueOrDefault(locale ?? "de") is { Length: > 0 } label) return Entries.Formula.Value.Of(label);
        return Entries.Formula.Value.Of(raw);
    }

    /// <summary>Die Attributgruppen, die hier gelten: am Knoten und an allen Vorfahren angehängt — von der Wurzel her, mit Herkunft.</summary>
    public List<(string Group, Node From)> EffectiveGroups(Node node)
    {
        var chain = Ancestors(node).Reverse().Append(node).ToList();
        var seen = new HashSet<string>();
        var result = new List<(string, Node)>();
        foreach (var n in chain)
            foreach (var g in n.Groups)
                if (seen.Add(g)) result.Add((g, n));
        // Publikationsbäume: eine Gruppe an einer Rubrik gilt für alles, was darunter verwiesen ist — der Web-Redakteur hängt
        // „SEO“ an seinen Baum und pflegt es dort; ein Print-Baum ohne die Gruppe kennt sie nicht. Verweis am Knoten selbst oder an einem Vorfahren.
        if (node.Role != Roles.Rubric)
            foreach (var n in chain)
                foreach (var rubric in PlacedIn(n.Id))
                    foreach (var r in Ancestors(rubric).Reverse().Append(rubric))
                        foreach (var g in r.Groups)
                            if (seen.Add(g)) result.Add((g, r));
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
    /// <summary>Suche mit Bedingungen: alle Knoten, die die Zeile erfüllen, mit Fundstelle.</summary>
    public IEnumerable<(Node Node, string Hit)> Query(ModelCatalog model, string q, Relations? relations = null, Media? media = null, Workflows? workflows = null)
    {
        var query = Projections.Query.Parse(q);
        if (!query.HasTerms) { foreach (var h in Search(q)) yield return h; yield break; }
        foreach (var n in _nodes.Values)
            if (query.Match(this, model, n, relations, media, workflows) is { } hit) yield return (n, hit);
    }

    /// <summary>Ein Knoten gegen einen Suchtext: Fundstelle oder null.</summary>
    public string? SearchOne(Node n, string q)
    {
        if (n.Id.Contains(q, StringComparison.OrdinalIgnoreCase)) return n.Id;
        if (n.Name is { } nm && nm.Contains(q, StringComparison.OrdinalIgnoreCase)) return nm;
        if (n.Label.Values.FirstOrDefault(l => l.Contains(q, StringComparison.OrdinalIgnoreCase)) is { } l) return l;
        if (n.AxisValues.Values.FirstOrDefault(v => v.Contains(q, StringComparison.OrdinalIgnoreCase)) is { } av) return av;
        var hit = n.Values.FirstOrDefault(kv => kv.Value.Contains(q, StringComparison.OrdinalIgnoreCase));
        if (hit.Key.Attribute is not null) return $"{hit.Key.Attribute}: {Snippet(hit.Value, q)}";
        var list = n.Lists.FirstOrDefault(kv => kv.Value.Any(v => v.Contains(q, StringComparison.OrdinalIgnoreCase)));
        if (list.Key.Attribute is not null) return $"{list.Key.Attribute}: {string.Join(", ", list.Value)}";
        return null;
    }

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

    /// <summary>Alle Knoten mit diesem eigenen Wert auf dem Stern (ohne Sprache, ohne Kanal) oder als Achsenwert — Eindeutigkeitsprüfung
    /// für jedes Attribut mit dem Merkmal unique; Achsenwerte zählen mit, weil eine Achse eindeutig sein kann (SKU als Achse).</summary>
    public IEnumerable<Node> WithOwnValue(string attribute, string value)
    {
        var ax = new Axis(attribute, null, null);
        return _nodes.Values.Where(n => (n.Values.TryGetValue(ax, out var s) && s == value) || (n.AxisValues.TryGetValue(attribute, out var a) && a == value));
    }
    /// <summary>Die Schlüssel eines Knotens: eigener Wert (oder Achsenwert) je eindeutigem Attribut, das einen hat; null, wenn keiner.</summary>
    public Dictionary<string, string>? KeysOf(ModelCatalog model, Node n)
    {
        Dictionary<string, string>? keys = null;
        foreach (var a in model.UniqueAttributes)
        {
            var v = n.Own(a.Key, null, null) ?? n.AxisValues.GetValueOrDefault(a.Key);
            if (!string.IsNullOrEmpty(v)) (keys ??= new())[a.Key] = v;
        }
        return keys;
    }

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        if (entry.Type == Types.MasterLocaleDefined) { MasterLocale = Types.Deserialize<MasterLocaleDefined>(entry.Payload).Code; return; }
        if (entry.Type == Types.MasterChannelDefined) { MasterChannel = Types.Deserialize<MasterChannelDefined>(entry.Payload).Key; return; }
        if (entry.Type == Types.LocaleDefined) { var d = Types.Deserialize<LocaleDefinition>(entry.Payload); if (d.Fallback is { } f && f != d.Code) LocaleFallback[d.Code] = f; else LocaleFallback.Remove(d.Code); return; }
        if (entry.Type == Types.ChannelDefined) { var d = Types.Deserialize<ChannelDefinition>(entry.Payload); if (d.Fallback is { } f && f != d.Key) ChannelFallback[d.Key] = f; else ChannelFallback.Remove(d.Key); return; }

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
            case Types.RubricCreated:
                var rc = Types.Deserialize<RubricCreated>(entry.Payload);
                n = Create(entry, Roles.Rubric, rc.Parent);
                n.Label = rc.Label;
                n.Name = string.IsNullOrWhiteSpace(rc.Name) ? TextOf(rc.Label) : rc.Name.Trim();
                n.Channel = rc.Channel; n.Market = rc.Market; n.Source = rc.Source;
                break;
            case Types.NodeRestored:
                // zurück ins Abbild, wie er war — Kennungen wieder eintragen, ausser ein anderer hat sie inzwischen
                if (!_retired.Remove(entry.Stream, out n)) return;
                _nodes[n.Id] = n;
                Link(n);
                foreach (var (sys, ext) in n.External.ToList()) if (!_external.TryAdd((sys, ext), n.Id)) n.External.Remove(sys);
                foreach (var p in n.Placed) { if (!_placedIn.TryGetValue(p, out var rs)) _placedIn[p] = rs = new(); rs.Add(n.Id); }
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
            case Types.PubTreeSet:
                var ps = Types.Deserialize<PubTreeSet>(entry.Payload);
                n.Channel = ps.Channel; n.Market = ps.Market;
                break;
            case Types.PubStandSet:
                n.Stand = Types.Deserialize<PubStandSet>(entry.Payload).JournalNumber;
                break;
            case Types.NodePlaced:
                var np = Types.Deserialize<NodePlaced>(entry.Payload);
                n.Placed.Remove(np.Node);
                if (np.Order is { } o && o >= 0 && o < n.Placed.Count) n.Placed.Insert(o, np.Node); else n.Placed.Add(np.Node);
                if (!_placedIn.TryGetValue(np.Node, out var set)) _placedIn[np.Node] = set = new();
                set.Add(n.Id);
                break;
            case Types.RulePlaced:
                var rp = Types.Deserialize<RulePlaced>(entry.Payload).Rule;
                n.Rules.RemoveAll(r => r.Id == rp.Id); n.Rules.Add(rp);
                break;
            case Types.RuleRemoved:
                n.Rules.RemoveAll(r => r.Id == Types.Deserialize<RuleRemoved>(entry.Payload).Id);
                break;
            case Types.PlaceNamed:
                var pn = Types.Deserialize<PlaceNamed>(entry.Payload);
                if (string.IsNullOrWhiteSpace(pn.Name)) n.PlacedNames.Remove(pn.Node); else n.PlacedNames[pn.Node] = pn.Name.Trim();
                break;
            case Types.NodeUnplaced:
                var nu = Types.Deserialize<NodeUnplaced>(entry.Payload);
                n.Placed.Remove(nu.Node); n.PlacedNames.Remove(nu.Node);
                if (_placedIn.TryGetValue(nu.Node, out var s2)) s2.Remove(n.Id);
                break;
            case Types.ProductAxesSet:
                n.Axes = Types.Deserialize<ProductAxesSet>(entry.Payload).Axes.Distinct().ToArray();
                // vorhandene Varianten: neue Achse ← eigener Wert des Attributs; entfallene Achse weg
                foreach (var v in Children(n.Id).Where(x => x.Role == Roles.Variant))
                {
                    foreach (var ax in n.Axes) if (!v.AxisValues.ContainsKey(ax) && v.Values.TryGetValue(new Axis(ax, null, null), out var own) && own.Length > 0) v.AxisValues[ax] = own;
                    foreach (var k in v.AxisValues.Keys.Where(k => !n.Axes.Contains(k)).ToList()) v.AxisValues.Remove(k);
                }
                // doppelte vollständige Kombinationen (nur mit force zugelassen): die betroffenen Varianten verlieren ihre Achsenzuordnung — Werte bleiben, sie „zählen nicht“, bis sie unterscheidbar sind
                if (n.Axes.Length > 0)
                    foreach (var grp in Children(n.Id).Where(v => v.Role == Roles.Variant && n.Axes.All(a => v.AxisValues.ContainsKey(a))).GroupBy(v => string.Join("\u0001", n.Axes.Select(a => v.AxisValues[a]))).Where(g => g.Count() > 1))
                        foreach (var v in grp) v.AxisValues.Clear();
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
            case Types.NodeOrdered:
                n.Order = Types.Deserialize<NodeOrdered>(entry.Payload).Order;
                break;
            case Types.NodeRetired:
                Unlink(n);
                foreach (var p in n.Placed) if (_placedIn.TryGetValue(p, out var rs)) rs.Remove(n.Id);
                foreach (var (sys, ext) in n.External) _external.Remove((sys, ext));
                _nodes.Remove(n.Id);
                _retired[n.Id] = n;
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
                n.StatusAt = entry.Number;
                break;
            case Types.GroupsAttached:
                n.Groups = Types.Deserialize<GroupsAttached>(entry.Payload).Groups.Distinct().ToArray();
                break;
            case Types.AttributeSet:
                var a = Types.Deserialize<AttributeSet>(entry.Payload);
                var axis = new Axis(a.Attribute, a.Locale, a.Channel, a.Row);
                // Leer = eigener Wert weg, der Fallback gilt wieder.
                if (a.Values is { } list)
                {
                    if (list.Length == 0) n.Lists.Remove(axis); else n.Lists[axis] = list;
                }
                else if (string.IsNullOrEmpty(a.Value)) n.Values.Remove(axis);
                else n.Values[axis] = a.Value;
                if (n.Values.ContainsKey(axis) || n.Lists.ContainsKey(axis)) n.SetAt[axis] = entry.Number; else n.SetAt.Remove(axis);
                // Achsenattribut an einer Variante: der Wert ist ihr Achsenwert, sobald das Produkt die Achse hat
                if (n.Role == Roles.Variant && a.Locale is null && a.Channel is null && a.Row is null && n.Parent is { } pp && _nodes.TryGetValue(pp, out var prod) && prod.Axes.Contains(a.Attribute))
                { if (string.IsNullOrEmpty(a.Value)) n.AxisValues.Remove(a.Attribute); else n.AxisValues[a.Attribute] = a.Value; }
                break;
            case Types.ValueSourced:
                var vs = Types.Deserialize<ValueSourced>(entry.Payload);
                var sax = new Axis(vs.Attribute, vs.Locale, vs.Channel, vs.Row);
                // Leere Quelle nimmt den Beleg weg — ausser bei „angefragt“: da ist „bei wem“ noch offen, der Zustand zählt trotzdem
                // (Test Beleg_pending_bleibt_auch_ohne_Quelle: ✓ ohne Namen liess die Anfrage stumm verschwinden)
                if (string.IsNullOrWhiteSpace(vs.Source) && vs.Method != "pending") n.Sources.Remove(sax);
                else n.Sources[sax] = new ValueSource((vs.Source ?? "").Trim(), vs.Title, vs.Note, vs.Method ?? "manual", string.IsNullOrWhiteSpace(vs.CheckedAt) ? entry.At.ToString("yyyy-MM-dd") : vs.CheckedAt, entry.Number, entry.Actor);
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
                foreach (var k in n.Sources.Keys.Where(k => k.Row == rr.Row).ToList()) n.Sources.Remove(k);
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
