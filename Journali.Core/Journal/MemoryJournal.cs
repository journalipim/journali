namespace Journali.Core.Journal;

/// <summary>
/// Journal im Arbeitsspeicher — für Sandbox und Tests. Die dauerhafte
/// Fassung (Datenbank, append-only Tabelle) kommt als eigene Klasse
/// hinter demselben <see cref="IJournal"/>.
/// </summary>
public sealed class MemoryJournal : IJournal
{
    private readonly List<Entry> _entries = new();
    private readonly object _gate = new();

    public long Head
    {
        get { lock (_gate) return _entries.Count; }
    }

    public Entry Append(string actor, string stream, string type, string payload, string? batch = null)
    {
        lock (_gate)
        {
            var entry = new Entry(_entries.Count + 1, DateTimeOffset.UtcNow, actor, stream, type, payload, batch);
            _entries.Add(entry);
            return entry;
        }
    }

    public IEnumerable<Entry> ReadAfter(long afterNumber)
    {
        Entry[] snapshot;
        lock (_gate) snapshot = _entries.ToArray();
        // Nummern sind lückenlos ab 1, also ist der Index Nummer - 1.
        for (var i = (int)Math.Max(0, afterNumber); i < snapshot.Length; i++)
            yield return snapshot[i];
    }

    public IEnumerable<Entry> ReadStream(string stream)
    {
        Entry[] snapshot;
        lock (_gate) snapshot = _entries.ToArray();
        foreach (var e in snapshot)
            if (e.Stream == stream)
                yield return e;
    }

    public IEnumerable<Entry> ReadBatch(string batch)
    {
        Entry[] snapshot;
        lock (_gate) snapshot = _entries.ToArray();
        foreach (var e in snapshot)
            if (e.Batch == batch)
                yield return e;
    }
}
