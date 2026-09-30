using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>
/// Eine Relation: Kante von einem Knoten zu einem anderen, mit Typ aus dem Modell und —
/// wie ein Knoten — eigenen Werten (attributierte Relation: Menge, Slot, Reihenfolge …).
/// Eigener Strom <c>r-…</c> (docs/pflegestruktur.md, 18).
/// </summary>
public sealed class Relation
{
    public required string Id { get; init; }
    public required string Type { get; init; }
    public required string From { get; init; }
    public required string To { get; init; }
    public Dictionary<Axis, string> Values { get; } = new();
    public Dictionary<Axis, string[]> Lists { get; } = new();
    public Dictionary<Axis, long> SetAt { get; } = new();
    public Dictionary<Axis, string> Units { get; } = new();   // Einheit, in der ein Zahlenwert eingegeben wurde (AttributeSet.Unit)
    public Dictionary<string, string> External { get; } = new();
    public long LastNumber { get; set; }
    public DateTimeOffset LastAt { get; set; }
    public string LastActor { get; set; } = "";
    public int Entries { get; set; }

    /// <summary>Eigener Wert auf der Achse, sonst weniger spezifisch (Kanal weg, dann Sprache weg) — wie <see cref="Node.Own"/>.</summary>
    public string? Own(string attribute, string? locale, string? channel)
    {
        foreach (var axis in new[] { new Axis(attribute, locale, channel), new Axis(attribute, locale, null), new Axis(attribute, null, null) }.Distinct())
        {
            if (Values.TryGetValue(axis, out var v)) return v;
            if (Lists.TryGetValue(axis, out var l)) return string.Join(", ", l);
        }
        return null;
    }
}

/// <summary>
/// Abbild „die Relationen": alle Kanten mit Werten, je Knoten ausgehend und eingehend.
/// Ein zurückgezogener Knoten lässt seine Kanten stehen — sie zeigen dann ins Leere (verwaist),
/// bis jemand sie zurückzieht. Reagiert nur auf Relations-Ströme; Knoten-Ströme gehen vorbei.
/// </summary>
public sealed class Relations : IProjection
{
    private readonly Dictionary<string, Relation> _all = new();
    private readonly Dictionary<string, HashSet<string>> _from = new();
    private readonly Dictionary<string, HashSet<string>> _to = new();
    private readonly Dictionary<(string System, string Id), string> _external = new();

    public long LastApplied { get; private set; }

    public IReadOnlyDictionary<string, Relation> All => _all;

    public IEnumerable<Relation> From(string nodeId) => _from.TryGetValue(nodeId, out var s) ? s.Select(id => _all[id]) : [];
    public IEnumerable<Relation> To(string nodeId) => _to.TryGetValue(nodeId, out var s) ? s.Select(id => _all[id]) : [];
    public IEnumerable<Relation> OfType(string type) => _all.Values.Where(r => r.Type == type);

    public Relation? ByExternal(string system, string id) =>
        _external.TryGetValue((system, id), out var rid) && _all.TryGetValue(rid, out var r) ? r : null;

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        Relation r;
        if (entry.Type == Types.RelationCreated)
        {
            var rc = Types.Deserialize<RelationCreated>(entry.Payload);
            r = new Relation { Id = entry.Stream, Type = rc.Type, From = rc.From, To = rc.To };
            _all[entry.Stream] = r;
            Index(_from, r.From, r.Id);
            Index(_to, r.To, r.Id);
        }
        else
        {
            if (!_all.TryGetValue(entry.Stream, out r!)) return;   // keine Relation: übergehen
            switch (entry.Type)
            {
                case Types.RelationRetired:
                    _all.Remove(r.Id);
                    _from.GetValueOrDefault(r.From)?.Remove(r.Id);
                    _to.GetValueOrDefault(r.To)?.Remove(r.Id);
                    foreach (var (sys, ext) in r.External) _external.Remove((sys, ext));
                    return;
                case Types.AttributeSet:
                    var a = Types.Deserialize<AttributeSet>(entry.Payload);
                    var axis = new Axis(a.Attribute, a.Locale, a.Channel, a.Row);
                    if (a.Values is { } list) { if (list.Length == 0) r.Lists.Remove(axis); else r.Lists[axis] = list; }
                    else if (string.IsNullOrEmpty(a.Value)) r.Values.Remove(axis);
                    else r.Values[axis] = a.Value;
                    if (r.Values.ContainsKey(axis) || r.Lists.ContainsKey(axis)) r.SetAt[axis] = entry.Number; else r.SetAt.Remove(axis);
                    if (r.Values.ContainsKey(axis) && !string.IsNullOrEmpty(a.Unit)) r.Units[axis] = a.Unit; else r.Units.Remove(axis);
                    break;
                case Types.ExternalLinked:
                    var el = Types.Deserialize<ExternalLinked>(entry.Payload);
                    if (r.External.TryGetValue(el.System, out var old)) _external.Remove((el.System, old));
                    r.External[el.System] = el.Id;
                    _external[(el.System, el.Id)] = r.Id;
                    break;
                case Types.ExternalUnlinked:
                    var eu = Types.Deserialize<ExternalUnlinked>(entry.Payload);
                    if (r.External.Remove(eu.System, out var gone)) _external.Remove((eu.System, gone));
                    break;
            }
        }
        r.LastNumber = entry.Number;
        r.LastAt = entry.At;
        r.LastActor = entry.Actor;
        r.Entries++;
    }

    private static void Index(Dictionary<string, HashSet<string>> map, string key, string id)
    {
        if (!map.TryGetValue(key, out var set)) map[key] = set = new();
        set.Add(id);
    }
}
