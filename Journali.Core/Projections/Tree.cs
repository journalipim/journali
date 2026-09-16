using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>Die Achsen eines Werts: Attribut × Sprache × Kanal. Null = gilt für alle.</summary>
public readonly record struct Axis(string Attribute, string? Locale, string? Channel);

public readonly record struct Release(string Channel, string? Locale);

/// <summary>Ein Knoten im Baum: Produktgruppe, Produkt oder Variante — mit allem, was sein Strom ergibt.</summary>
public sealed class Node
{
    public required string Id { get; init; }
    public required string Role { get; init; }
    public string? Parent { get; set; }
    public Labels Label { get; set; } = new();                 // Gruppe
    public string? Family { get; set; }                        // Produkt
    public string[] Axes { get; set; } = [];                   // Produkt: wonach es variiert
    public Dictionary<string, string> AxisValues { get; } = new(); // Variante
    public string Status { get; set; } = Statuses.Draft;
    public Dictionary<Axis, string> Values { get; } = new();
    public Dictionary<Axis, string[]> Lists { get; } = new();
    public HashSet<string> Categories { get; } = new();
    public HashSet<Release> Releases { get; } = new();
    public long LastNumber { get; set; }
    public DateTimeOffset LastAt { get; set; }
    public string LastActor { get; set; } = "";
    public int Entries { get; set; }

    /// <summary>Eigener Wert auf der Achse, sonst weniger spezifisch (Kanal weg, dann Sprache weg) — nur dieser Knoten.</summary>
    public string? Own(string attribute, string? locale, string? channel)
    {
        if (Values.TryGetValue(new Axis(attribute, locale, channel), out var v)) return v;
        if (channel is not null && Values.TryGetValue(new Axis(attribute, locale, null), out v)) return v;
        if ((locale is not null || channel is not null) && Values.TryGetValue(new Axis(attribute, null, null), out v)) return v;
        return null;
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

    public long LastApplied { get; private set; }

    public IReadOnlyDictionary<string, Node> Nodes => _nodes;

    public IEnumerable<Node> Children(string? parent) =>
        _children.TryGetValue(parent ?? "", out var ids) ? ids.Select(id => _nodes[id]) : [];

    public IEnumerable<Node> Roots => Children(null);

    /// <summary>Der Pfad von den Eltern bis zur Wurzel.</summary>
    public IEnumerable<Node> Ancestors(Node node)
    {
        for (var p = node.Parent; p is not null && _nodes.TryGetValue(p, out var n); p = n.Parent)
            yield return n;
    }

    /// <summary>Wert am Knoten oder von oben geerbt; liefert auch, woher.</summary>
    public (string? Value, Node? From) Resolve(Node node, string attribute, string? locale, string? channel)
    {
        if (node.Own(attribute, locale, channel) is { } own) return (own, node);
        foreach (var a in Ancestors(node))
            if (a.Own(attribute, locale, channel) is { } v) return (v, a);
        return (null, null);
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

    private void ApplyToNode(Node n, Entry entry)
    {
        switch (entry.Type)
        {
            case Types.GroupRenamed:
                n.Label = Types.Deserialize<GroupRenamed>(entry.Payload).Label;
                break;
            case Types.NodeMoved:
                Unlink(n);
                n.Parent = Types.Deserialize<NodeMoved>(entry.Payload).Parent;
                Link(n);
                break;
            case Types.NodeRetired:
                Unlink(n);
                _nodes.Remove(n.Id);
                break;
            case Types.StatusSet:
                n.Status = Types.Deserialize<StatusSet>(entry.Payload).Status;
                break;
            case Types.AttributeSet:
                var a = Types.Deserialize<AttributeSet>(entry.Payload);
                var axis = new Axis(a.Attribute, a.Locale, a.Channel);
                // Leer = eigener Wert weg, der Rückfall gilt wieder.
                if (a.Values is { } list)
                {
                    if (list.Length == 0) n.Lists.Remove(axis); else n.Lists[axis] = list;
                }
                else if (string.IsNullOrEmpty(a.Value)) n.Values.Remove(axis);
                else n.Values[axis] = a.Value;
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
