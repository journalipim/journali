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
    public static int CatchUpAll(IJournal journal, params IProjection[] projections) => CatchUpAll(journal, out _, projections);

    /// <summary>Wie oben, dazu die Zeiten: Lesen aus dem Journal und Anwenden je Abbild (Millisekunden) — für den Start und die Frage, wo es hängt.</summary>
    public static int CatchUpAll(IJournal journal, out Timing timing, params IProjection[] projections) => CatchUpAll(journal, out timing, null, projections);

    /// <summary>
    /// Wie oben, dazu ein Fortschritt: alle 1000 Einträge (Anzahl gelesen, Nummer des letzten) — damit der Start nicht
    /// minutenlang stumm ist (Taloan, 21.09.: „damit man sieht, ob was vorangeht“).
    /// </summary>
    public static int CatchUpAll(IJournal journal, out Timing timing, Action<int, long>? progress, params IProjection[] projections)
    {
        timing = new Timing();
        if (projections.Length == 0) return 0;
        var from = projections.Min(p => p.LastApplied);
        var count = 0;
        var apply = new long[projections.Length];
        var sw = System.Diagnostics.Stopwatch.StartNew();
        long last = 0;
        foreach (var entry in journal.ReadAfter(from))
        {
            var t0 = sw.ElapsedTicks; timing.ReadTicks += t0 - last;
            for (var i = 0; i < projections.Length; i++)
            {
                var p = projections[i];
                if (p.LastApplied >= entry.Number) continue;
                var a = sw.ElapsedTicks; p.Apply(entry); apply[i] += sw.ElapsedTicks - a;
            }
            last = sw.ElapsedTicks;
            count++;
            if (progress is not null && count % 1000 == 0) progress(count, entry.Number);
        }
        for (var i = 0; i < projections.Length; i++) timing.Apply[projections[i].GetType().Name] = apply[i] * 1000 / System.Diagnostics.Stopwatch.Frequency;
        timing.ReadMs = timing.ReadTicks * 1000 / System.Diagnostics.Stopwatch.Frequency;
        return count;
    }

    public sealed class Timing
    {
        public long ReadTicks;
        public long ReadMs;
        public Dictionary<string, long> Apply { get; } = new();
        public override string ToString() => $"lesen {ReadMs} ms · anwenden " + string.Join(", ", Apply.OrderByDescending(kv => kv.Value).Select(kv => $"{kv.Key} {kv.Value} ms"));
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
