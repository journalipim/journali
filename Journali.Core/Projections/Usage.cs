using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>
/// Nutzung: wie viele Einträge an welchem Tag ins Journal gingen (Taloan, 22.09.2026: „zeige mir in den Einstellungen
/// einen Fortschrittsbalken — täglich, wöchentlich, monatlich“). Gezählt wird, was geschrieben wird; Lesen und
/// Exportieren kosten nichts (die Endpunkte schreiben nicht). Woche und Monat werden aus den Tagen gerechnet, die
/// Historie steht damit von selbst da — auch rückwirkend für ein bestehendes Journal, ohne einen einzigen eigenen
/// Eintrag. Der Tag ist die Ortszeit des Servers, die Woche beginnt am Montag.
/// </summary>
public sealed class Usage : IProjection
{
    /// <summary>Protokoll der Jobläufe — Betrieb, keine Pflege: zählt nicht mit (Taloan, 22.09.2026: „Sicherung kostet nix“).
    /// Was ein Job an Daten schreibt (ein Import seine <c>AttributeSet</c>), zählt weiterhin.</summary>
    public static readonly IReadOnlySet<string> Free = new HashSet<string>
    {
        Types.JobRunStarted, Types.JobRunFinished, Types.JobFileConsumed, Types.JobFileWritten,
    };

    public long LastApplied { get; private set; }

    /// <summary>Einträge je Tag (Ortszeit), aufsteigend abrufbar über <see cref="Days"/>.</summary>
    public Dictionary<DateOnly, int> PerDay { get; } = new();

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        if (Free.Contains(entry.Type)) return;
        var day = DateOnly.FromDateTime(entry.At.ToLocalTime().DateTime);
        PerDay[day] = PerDay.GetValueOrDefault(day) + 1;
    }

    public IEnumerable<KeyValuePair<DateOnly, int>> Days => PerDay.OrderBy(p => p.Key);

    /// <summary>Montag der Woche, in der <paramref name="d"/> liegt.</summary>
    public static DateOnly WeekStart(DateOnly d) => d.AddDays(-(((int)d.DayOfWeek + 6) % 7));
    public static DateOnly MonthStart(DateOnly d) => new(d.Year, d.Month, 1);

    /// <summary>Summe von <paramref name="from"/> bis einschliesslich <paramref name="to"/>.</summary>
    public int Between(DateOnly from, DateOnly to)
    {
        var n = 0;
        foreach (var (d, c) in PerDay) if (d >= from && d <= to) n += c;
        return n;
    }

    public int Day(DateOnly d) => PerDay.GetValueOrDefault(d);
    public int Week(DateOnly d) => Between(WeekStart(d), d);
    public int Month(DateOnly d) => Between(MonthStart(d), d);

    /// <summary>Abgeschlossene Perioden für den Verlauf: je Tag, Woche oder Monat eine Zeile (neueste zuerst).</summary>
    public IEnumerable<(DateOnly Start, int Count)> History(string period, DateOnly today, int limit = 90)
    {
        var groups = new Dictionary<DateOnly, int>();
        foreach (var (d, c) in PerDay)
        {
            var key = period switch { "week" => WeekStart(d), "month" => MonthStart(d), _ => d };
            groups[key] = groups.GetValueOrDefault(key) + c;
        }
        return groups.OrderByDescending(g => g.Key).Take(limit).Select(g => (g.Key, g.Value));
    }
}

/// <summary>
/// Die Grenzen: Woche und Monat (Taloan, 22.09.2026). <b>Kein Tageslimit</b> — „macht man 3 Testimporte und muss
/// aufhören“; der Tag wird gezählt und im Verlauf gezeigt, begrenzt wird er nicht. Vorerst Annahmen zum Messen,
/// was eine Einzelperson wirklich braucht — keine Lizenz, keine Sperre.
/// </summary>
public static class Limits
{
    public const int Week = 20_000;
    public const int Month = 100_000;
}
