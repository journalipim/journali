namespace Journali.Core.Journal;

/// <summary>
/// Das Journal ist die einzige Wahrheit. Alles andere — Pflege-Tabellen,
/// Suchindex, Datenstore je Kanal — ist eine Ableitung daraus.
/// </summary>
public interface IJournal
{
    /// <summary>Hängt einen Eintrag an und vergibt die nächste Nummer. <paramref name="batch"/> verbindet die Einträge einer Aktion.</summary>
    Entry Append(string actor, string stream, string type, string payload, string? batch = null);

    /// <summary>Alle Einträge mit Nummer &gt; <paramref name="afterNumber"/>, in Reihenfolge.</summary>
    IEnumerable<Entry> ReadAfter(long afterNumber);

    /// <summary>Alle Einträge eines Stroms, in Reihenfolge.</summary>
    IEnumerable<Entry> ReadStream(string stream);

    /// <summary>Alle Einträge eines Stapels (eine Aktion: Rückzug eines Teilbaums, Import, Tabelle …), in Reihenfolge — für Rückgängig je Aktion (Taloan).</summary>
    IEnumerable<Entry> ReadBatch(string batch);

    /// <summary>Nummer des letzten Eintrags; 0 bei leerem Journal.</summary>
    long Head { get; }
}
