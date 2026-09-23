using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>
/// Nutzung: wie viele Einträge an welchem Tag ins Journal gingen (Taloan, 22.09.2026: „zeige mir in den Einstellungen
/// einen Fortschrittsbalken — täglich, wöchentlich, monatlich“). Gezählt wird, was geschrieben wird; Lesen und
/// Exportieren kosten nichts (die Endpunkte schreiben nicht). Woche und Monat werden aus den Tagen gerechnet, die
/// Historie steht damit von selbst da — auch rückwirkend für ein bestehendes Journal, ohne einen einzigen eigenen
/// Eintrag. Der Tag ist die Ortszeit des Servers, die Woche beginnt am Montag.
/// <para>Was zählt, entscheidet die <b>Art</b> des Eintrags (<see cref="Kinds"/>, Spalte <c>kind</c>): Datenpflege und
/// Ausleitung zählen, Modellierung, Struktur, Referenzdaten, Einrichtung und Betrieb nicht. Einträge ohne Art —
/// alles von vor der Spalte — werden über ihren Typ eingeordnet.</para>
/// </summary>
public sealed class Usage : IProjection
{
    public long LastApplied { get; private set; }

    /// <summary>Tagesgeschäft je Tag (Ortszeit) — das, was zählt.</summary>
    public Dictionary<DateOnly, int> PerDay { get; } = new();
    /// <summary>Alle Einträge je Tag, auch Modell, Struktur, Kataloge und Betrieb — zum Vergleich in der Anzeige.</summary>
    public Dictionary<DateOnly, int> AllPerDay { get; } = new();
    /// <summary>Tagesgeschäft je Tag und Urheber (Taloan, 23.09.2026): daraus wird, was ein Team verbraucht hat. Das Team
    /// steht nicht im Eintrag — es kann wechseln; wer heute zu wem gehört, sagt das Abbild der Benutzer.</summary>
    public Dictionary<DateOnly, Dictionary<string, int>> PerDayActor { get; } = new();

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        var day = DateOnly.FromDateTime(entry.At.ToLocalTime().DateTime);
        AllPerDay[day] = AllPerDay.GetValueOrDefault(day) + 1;
        if (!Kinds.Billable(entry.Kind, entry.Type)) return;
        PerDay[day] = PerDay.GetValueOrDefault(day) + 1;
        if (entry.Actor is { Length: > 0 } wer)
        {
            if (!PerDayActor.TryGetValue(day, out var je)) PerDayActor[day] = je = new();
            je[wer] = je.GetValueOrDefault(wer) + 1;
        }
    }

    public IEnumerable<KeyValuePair<DateOnly, int>> Days => PerDay.OrderBy(p => p.Key);

    /// <summary>Was diese Urheber von <paramref name="from"/> bis <paramref name="to"/> verbraucht haben.</summary>
    public int Sum(IReadOnlySet<string> actors, DateOnly from, DateOnly to)
    {
        var n = 0;
        foreach (var (day, je) in PerDayActor)
        {
            if (day < from || day > to) continue;
            foreach (var (actor, count) in je) if (actors.Contains(actor)) n += count;
        }
        return n;
    }

    /// <summary>Montag der Woche, in der <paramref name="d"/> liegt.</summary>
    public static DateOnly WeekStart(DateOnly d) => d.AddDays(-(((int)d.DayOfWeek + 6) % 7));
    public static DateOnly MonthStart(DateOnly d) => new(d.Year, d.Month, 1);

    /// <summary>Summe von <paramref name="from"/> bis einschliesslich <paramref name="to"/>; <paramref name="all"/> nimmt alles statt nur das Tagesgeschäft.</summary>
    public int Between(DateOnly from, DateOnly to, bool all = false)
    {
        var n = 0;
        foreach (var (d, c) in (all ? AllPerDay : PerDay)) if (d >= from && d <= to) n += c;
        return n;
    }

    public int Day(DateOnly d, bool all = false) => (all ? AllPerDay : PerDay).GetValueOrDefault(d);
    public int Week(DateOnly d, bool all = false) => Between(WeekStart(d), d, all);
    public int Month(DateOnly d, bool all = false) => Between(MonthStart(d), d, all);

    /// <summary>Abgeschlossene Perioden für den Verlauf: je Tag, Woche oder Monat eine Zeile (neueste zuerst).</summary>
    public IEnumerable<(DateOnly Start, int Count, int All)> History(string period, DateOnly today, int limit = 90)
    {
        DateOnly Key(DateOnly d) => period switch { "week" => WeekStart(d), "month" => MonthStart(d), _ => d };
        var work = new Dictionary<DateOnly, int>();
        var all = new Dictionary<DateOnly, int>();
        foreach (var (d, c) in PerDay) work[Key(d)] = work.GetValueOrDefault(Key(d)) + c;
        foreach (var (d, c) in AllPerDay) all[Key(d)] = all.GetValueOrDefault(Key(d)) + c;
        return all.OrderByDescending(g => g.Key).Take(limit).Select(g => (g.Key, work.GetValueOrDefault(g.Key), g.Value));
    }
}

/// <summary>
/// Die Grenzen des Testbetriebs: Woche und Monat (Taloan, 22.09.2026). <b>Kein Tageslimit</b> — „macht man 3 Testimporte
/// und muss aufhören“; der Tag wird gezählt und im Verlauf gezeigt, begrenzt wird er nicht. Im Betrieb kommen die
/// Grenzen aus der Lizenz (Taloan, 23.09.2026: „die Grenzen setzt der Lizenzkey“); ohne Lizenz gelten diese hier.
/// </summary>
public static class Limits
{
    public const int Week = 20_000;
    public const int Month = 100_000;
}
