namespace Journali.Core.Journal;

/// <summary>
/// Das Journal ist die einzige Wahrheit. Alles andere — Pflege-Tabellen,
/// Suchindex, Datenstore je Kanal — ist eine Ableitung daraus.
/// </summary>
public interface IJournal
{
    /// <summary>Hängt einen Eintrag an und vergibt die nächste Nummer. <paramref name="batch"/> verbindet die Einträge einer Aktion;
    /// <paramref name="kind"/> ist die Art der Arbeit (<see cref="Journali.Core.Entries.Kinds"/>) — leer heisst „aus dem Typ ableiten“.</summary>
    Entry Append(string actor, string stream, string type, string payload, string? batch = null, string? kind = null);

    /// <summary>Viele Einträge in einer Transaktion (ein Stapel: etim-Freigabe mit tausenden Klassen) — eine Sperre, eine Nummernvergabe, ein Commit.</summary>
    IReadOnlyList<Entry> AppendMany(string actor, IReadOnlyList<(string Stream, string Type, string Payload)> items, string? batch = null);

    /// <summary>Alle Einträge mit Nummer &gt; <paramref name="afterNumber"/>, in Reihenfolge.</summary>
    IEnumerable<Entry> ReadAfter(long afterNumber);

    /// <summary>Alle Einträge eines Stroms, in Reihenfolge.</summary>
    IEnumerable<Entry> ReadStream(string stream);

    /// <summary>Alle Einträge eines Stapels (eine Aktion: Rückzug eines Teilbaums, Import, Tabelle …), in Reihenfolge — für Rückgängig je Aktion (Taloan).</summary>
    IEnumerable<Entry> ReadBatch(string batch);

    /// <summary>Die letzten <paramref name="limit"/> Einträge eines Typs, neueste zuerst (Taloan, 20.09.: zuletzt Zurückgezogenes zum Wiederherstellen anbieten).</summary>
    IEnumerable<Entry> ReadRecent(string type, int limit);

    /// <summary>Nummer des letzten Eintrags; 0 bei leerem Journal.</summary>
    long Head { get; }
}
