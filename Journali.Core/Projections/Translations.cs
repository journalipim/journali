using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>Die Marke an einer Zielachse: gegen diese Quellversion ist übersetzt (Fingerabdruck und Journalnummer der Quelle),
/// gesetzt bei <see cref="At"/>, aus welchem Auftrag.</summary>
public readonly record struct TranslationMark(string SourceHash, long SourceAt, long At, string? Order);

/// <summary>Ein Paket, das hinausging (docs/pflegestruktur.md 30): Sprachrichtung, Umfang, Stand — und je Einheit die
/// Fingerabdrücke von Quelle und Ziel, wie sie beim Schnüren waren. Der Rücklauf rechnet dagegen.</summary>
public sealed class TranslationOrder
{
    public required string Key { get; init; }
    public string From { get; set; } = "";
    public string To { get; set; } = "";
    public string? Root { get; set; }
    public string? Channel { get; set; }
    public string[]? Attributes { get; set; }
    public string? Scope { get; set; }
    public string? Note { get; set; }
    /// <summary>Stand des Journals beim Schnüren — der Auftrag ist ein Zeiger, keine Kopie.</summary>
    public long At { get; set; }
    public long Number { get; set; }
    public DateTimeOffset Created { get; set; }
    public string Actor { get; set; } = "";
    public Dictionary<string, OrderUnit> Units { get; } = new();
    public bool Returned { get; set; }
    public DateTimeOffset? ReturnedAt { get; set; }
    public int Written { get; set; }
    public int Behind { get; set; }
    public int Conflicts { get; set; }
    public int Skipped { get; set; }
}

/// <summary>
/// Abbild der Übersetzung (docs/pflegestruktur.md 30). Zwei Dinge stehen hier: die <b>Marken</b> (je Knoten und Zielachse: gegen welche Quellversion ist
/// übersetzt) und die <b>Aufträge</b> (Strom <c>translation:&lt;key&gt;</c>). Der „Übersetzungsspeicher“ ist kein
/// Behälter — er ist die Frage „Marke gegen jetzt“, und darum ist zehnmal geändert ein Posten, nicht zehn.
/// </summary>
public sealed class Translations : IProjection
{
    public const string Stream = "translation:";
    private readonly Dictionary<string, Dictionary<Axis, TranslationMark>> _marks = new();   // Knoten → Zielachse → Marke
    private readonly Dictionary<string, TranslationOrder> _orders = new();
    public long LastApplied { get; private set; }

    /// <summary>Die Marke an einer Zielachse (Attribut, Zielsprache, Kanal, Zeile) — null = nie übersetzt worden.</summary>
    public TranslationMark? Of(string node, Axis target) =>
        _marks.TryGetValue(node, out var d) && d.TryGetValue(target, out var m) ? m : null;

    public IReadOnlyDictionary<Axis, TranslationMark> MarksOf(string node) =>
        _marks.TryGetValue(node, out var d) ? d : new Dictionary<Axis, TranslationMark>();

    public IReadOnlyDictionary<string, TranslationOrder> Orders => _orders;
    /// <summary>Was draussen ist: geschnürt, aber noch nicht zurück.</summary>
    public IEnumerable<TranslationOrder> Open => _orders.Values.Where(o => !o.Returned);
    public TranslationOrder? Order(string key) => _orders.GetValueOrDefault(key);

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        if (entry.Stream.StartsWith(Stream, StringComparison.Ordinal))
        {
            var key = entry.Stream[Stream.Length..];
            switch (entry.Type)
            {
                case Types.TranslationOrdered:
                {
                    var d = Types.Deserialize<TranslationOrdered>(entry.Payload);
                    var o = new TranslationOrder { Key = key, From = d.From, To = d.To, Root = d.Root, Channel = d.Channel, Attributes = d.Attributes, Scope = d.Scope, Note = d.Note, At = d.At == 0 ? entry.Number : d.At, Number = entry.Number, Created = entry.At, Actor = entry.Actor };
                    foreach (var u in d.Units ?? new()) o.Units[u.Id] = u;
                    _orders[key] = o;
                    break;
                }
                case Types.TranslationReturned:
                {
                    if (!_orders.TryGetValue(key, out var o)) break;
                    var r = Types.Deserialize<TranslationReturned>(entry.Payload);
                    o.Returned = true; o.ReturnedAt = entry.At;
                    o.Written += r.Written; o.Behind += r.Behind; o.Conflicts += r.Conflicts; o.Skipped += r.Skipped;
                    if (r.Note is { Length: > 0 }) o.Note = r.Note;
                    break;
                }
            }
            return;
        }
        switch (entry.Type)
        {
            case Types.TranslationMarked:
            {
                var m = Types.Deserialize<TranslationMarked>(entry.Payload);
                if (!_marks.TryGetValue(entry.Stream, out var d)) _marks[entry.Stream] = d = new();
                d[new Axis(m.Attribute, m.Locale, m.Channel, m.Row)] = new TranslationMark(m.SourceHash, m.SourceAt, entry.Number, m.Order);
                break;
            }
            case Types.NodeRetired:
                _marks.Remove(entry.Stream);
                break;
        }
    }
}
