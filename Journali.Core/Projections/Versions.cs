using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>Ein Beleg einer Version: das gerenderte Dokument (Datenblatt, Sicherheitsdatenblatt …), hash-adressiert im Medienspeicher.</summary>
public sealed class VersionDocument
{
    public required string Kind { get; init; }
    public required string MediaId { get; init; }
    public required string Sha256 { get; init; }
    public required string Mime { get; init; }
    public required string Name { get; init; }
    public long Bytes { get; init; }
    public string? Renderer { get; init; }
    public DateTimeOffset At { get; init; }
    public string Actor { get; init; } = "";
}

/// <summary>
/// Eine Version eines Knotens: ein Zeiger
/// auf den Journalstand (alles bis dahin ist der Stand — auch das Modell von damals) plus die eingefrorenen Belege, die nach
/// draussen gingen. Nichts wird kopiert, nichts gelöscht; zurückgezogen wird eine Version nur markiert.
/// </summary>
public sealed class VersionState
{
    public required string Node { get; init; }
    public required int Nr { get; init; }
    public long JournalNumber { get; init; }
    public string? Channel { get; init; }
    public string? Locale { get; init; }
    public string? Note { get; init; }
    public int RetentionYears { get; init; }
    public DateTimeOffset At { get; init; }
    public string Actor { get; init; } = "";
    public bool Withdrawn { get; set; }
    public string? WithdrawnReason { get; set; }
    public List<VersionDocument> Documents { get; } = new();
}

/// <summary>Abbild „die Versionen“: je Knoten (Strom = Knoten-Id) die Liste, aufsteigend nach Nummer.</summary>
public sealed class Versions : IProjection
{
    private readonly Dictionary<string, List<VersionState>> _byNode = new();
    public long LastApplied { get; private set; }

    public IReadOnlyList<VersionState> Of(string node) => _byNode.TryGetValue(node, out var l) ? l : Array.Empty<VersionState>();
    public VersionState? Get(string node, int nr) => Of(node).FirstOrDefault(v => v.Nr == nr);
    public int NextNr(string node) => Of(node).Count == 0 ? 1 : Of(node).Max(v => v.Nr) + 1;
    public IEnumerable<VersionState> All => _byNode.Values.SelectMany(l => l);

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        switch (entry.Type)
        {
            case Types.VersionCreated:
            {
                var d = Types.Deserialize<VersionCreated>(entry.Payload);
                if (!_byNode.TryGetValue(entry.Stream, out var list)) _byNode[entry.Stream] = list = new();
                if (list.Any(v => v.Nr == d.Nr)) break;   // Nummer ist eindeutig je Knoten
                list.Add(new VersionState { Node = entry.Stream, Nr = d.Nr, JournalNumber = d.JournalNumber, Channel = d.Channel, Locale = d.Locale, Note = d.Note, RetentionYears = d.RetentionYears, At = entry.At, Actor = entry.Actor });
                list.Sort((a, b) => a.Nr.CompareTo(b.Nr));
                break;
            }
            case Types.VersionDocumentAdded:
            {
                var d = Types.Deserialize<VersionDocumentAdded>(entry.Payload);
                if (Get(entry.Stream, d.Nr) is not { } v) break;
                v.Documents.RemoveAll(x => x.Kind == d.Kind && x.Renderer == d.Renderer);   // derselbe Erzeuger liefert dieselbe Belegart nur einmal (neuer Lauf ersetzt)
                v.Documents.Add(new VersionDocument { Kind = d.Kind, MediaId = d.MediaId, Sha256 = d.Sha256, Mime = d.Mime, Name = d.Name, Bytes = d.Bytes, Renderer = d.Renderer, At = entry.At, Actor = entry.Actor });
                break;
            }
            case Types.VersionWithdrawn:
            {
                var d = Types.Deserialize<VersionWithdrawn>(entry.Payload);
                if (Get(entry.Stream, d.Nr) is { } v) { v.Withdrawn = true; v.WithdrawnReason = d.Reason; }
                break;
            }
        }
    }
}
