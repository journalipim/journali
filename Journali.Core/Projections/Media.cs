using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>
/// Ein Medium (docs/pflegestruktur.md, 20): die Datei liegt ausserhalb, adressiert über ihren
/// SHA-256; im Journal stehen nur Hash, Grösse, Typ, Name — und wie bei Knoten und Relationen
/// eigene Werte (Alt-Text, Rechte, Quelle). Strom <c>m-…</c>. Unveränderlich: ein neues Bild ist
/// ein neues Medium. Die Zuordnung zum Knoten ist eine Relation (18) mit dem Medium als Ziel.
/// </summary>
public sealed class Medium
{
    public required string Id { get; init; }
    public required string Sha256 { get; init; }
    public required long Bytes { get; init; }
    public required string Mime { get; init; }
    public required string Name { get; init; }
    public Dictionary<Axis, string> Values { get; } = new();
    public Dictionary<Axis, string[]> Lists { get; } = new();
    public Dictionary<Axis, long> SetAt { get; } = new();
    public Dictionary<string, string> External { get; } = new();
    public long LastNumber { get; set; }
    public DateTimeOffset LastAt { get; set; }
    public string LastActor { get; set; } = "";
    public int Entries { get; set; }
    public bool IsImage => Mime.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
}

/// <summary>Abbild „die Medien": alle Medien, Index nach Hash (gleiche Datei zweimal = ein Medium) und externer Kennung.</summary>
public sealed class Media : IProjection
{
    private readonly Dictionary<string, Medium> _all = new();
    private readonly Dictionary<string, string> _bySha = new();
    private readonly Dictionary<(string System, string Id), string> _external = new();

    public long LastApplied { get; private set; }

    public IReadOnlyDictionary<string, Medium> All => _all;

    public Medium? BySha(string sha256) => _bySha.TryGetValue(sha256, out var id) && _all.TryGetValue(id, out var m) ? m : null;

    public Medium? ByExternal(string system, string id) =>
        _external.TryGetValue((system, id), out var mid) && _all.TryGetValue(mid, out var m) ? m : null;

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        Medium m;
        if (entry.Type == Types.MediaCreated)
        {
            var mc = Types.Deserialize<MediaCreated>(entry.Payload);
            m = new Medium { Id = entry.Stream, Sha256 = mc.Sha256, Bytes = mc.Bytes, Mime = mc.Mime, Name = mc.Name };
            _all[entry.Stream] = m;
            _bySha[mc.Sha256] = m.Id;
        }
        else
        {
            if (!_all.TryGetValue(entry.Stream, out m!)) return;   // kein Medium: übergehen
            switch (entry.Type)
            {
                case Types.MediaRetired:
                    _all.Remove(m.Id);
                    if (_bySha.GetValueOrDefault(m.Sha256) == m.Id) _bySha.Remove(m.Sha256);
                    foreach (var (sys, ext) in m.External) _external.Remove((sys, ext));
                    return;
                case Types.AttributeSet:
                    var a = Types.Deserialize<AttributeSet>(entry.Payload);
                    var axis = new Axis(a.Attribute, a.Locale, a.Channel, a.Row);
                    if (a.Values is { } list) { if (list.Length == 0) m.Lists.Remove(axis); else m.Lists[axis] = list; }
                    else if (string.IsNullOrEmpty(a.Value)) m.Values.Remove(axis);
                    else m.Values[axis] = a.Value;
                    if (m.Values.ContainsKey(axis) || m.Lists.ContainsKey(axis)) m.SetAt[axis] = entry.Number; else m.SetAt.Remove(axis);
                    break;
                case Types.ExternalLinked:
                    var el = Types.Deserialize<ExternalLinked>(entry.Payload);
                    if (m.External.TryGetValue(el.System, out var old)) _external.Remove((el.System, old));
                    m.External[el.System] = el.Id;
                    _external[(el.System, el.Id)] = m.Id;
                    break;
                case Types.ExternalUnlinked:
                    var eu = Types.Deserialize<ExternalUnlinked>(entry.Payload);
                    if (m.External.Remove(eu.System, out var gone)) _external.Remove((eu.System, gone));
                    break;
            }
        }
        m.LastNumber = entry.Number;
        m.LastAt = entry.At;
        m.LastActor = entry.Actor;
        m.Entries++;
    }
}
