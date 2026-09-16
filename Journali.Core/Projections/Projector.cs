using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>
/// Zieht ein Abbild auf den Stand des Journals nach: liest alles nach
/// <see cref="IProjection.LastApplied"/> und wendet es an. Das ist der
/// ganze Mechanismus hinter Delta-Export, Suchindex und Wiederaufbau.
/// </summary>
public static class Projector
{
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
