using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>
/// Zieht ein Abbild auf den Stand des Journals nach: liest alles nach
/// <see cref="IProjection.LastApplied"/> und wendet es an. Das ist der
/// ganze Mechanismus hinter Delta-Export, Suchindex und Wiederaufbau.
/// </summary>
public static class Projector
{
    /// <summary>Nur bis einschliesslich Nummer <paramref name="until"/> — der Stand von damals (Versionen: „Stand bei #n“).</summary>
    public static int CatchUpUntil(IJournal journal, IProjection projection, long until)
    {
        var count = 0;
        foreach (var entry in journal.ReadAfter(projection.LastApplied))
        {
            if (entry.Number > until) break;
            projection.Apply(entry);
            count++;
        }
        return count;
    }

    /// <summary>
    /// Alle Abbilder in EINEM Durchlauf durchs Journal (Taloan, 20.09.: der Start las das Journal achtmal — mit 17 000 ETIM-Klassen
    /// à 5 KB je Lauf 75 MB, der Server „startete nicht“). Ab der kleinsten Stand-Nummer; jedes Abbild bekommt nur, was ihm fehlt.
    /// Liefert, wie viele Einträge gelesen wurden.
    /// </summary>
    public static int CatchUpAll(IJournal journal, params IProjection[] projections)
    {
        if (projections.Length == 0) return 0;
        var from = projections.Min(p => p.LastApplied);
        var count = 0;
        foreach (var entry in journal.ReadAfter(from))
        {
            foreach (var p in projections) if (p.LastApplied < entry.Number) p.Apply(entry);
            count++;
        }
        return count;
    }

    /// <summary>Wendet alle neuen Einträge an. Liefert, wie viele es waren.</summary>
    public static int CatchUp(IJournal journal, IProjection projection)
    {
        var count = 0;
        foreach (var entry in journal.ReadAfter(projection.LastApplied))
        {
            projection.Apply(entry);
            count++;
        }
        return count;
    }
}
