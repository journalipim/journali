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
    /// <summary>
    /// Stand beim Einlösen eines Schlüssels (Taloan, 23.09.2026), je Eintragsnummer: der Tag und was an ihm bis dahin je
    /// Urheber gezählt war. Ein Reset gilt ab seinem Eintrag, nicht ab seinem Tag — was am selben Tag vorher geschah,
    /// wird damit abgezogen (<see cref="Sum(IReadOnlySet{string}, DateOnly, DateOnly, long?)"/>).
    /// </summary>
    public Dictionary<long, UsageCut> Cuts { get; } = new();

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        var day = DateOnly.FromDateTime(entry.At.ToLocalTime().DateTime);
        AllPerDay[day] = AllPerDay.GetValueOrDefault(day) + 1;
        if (entry.Type == Types.KeyRedeemed)
            Cuts[entry.Number] = new UsageCut(day, PerDayActor.TryGetValue(day, out var bisher) ? new(bisher) : new());
        if (!Kinds.Billable(entry.Kind, entry.Type)) return;
        PerDay[day] = PerDay.GetValueOrDefault(day) + 1;
        if (entry.Actor is { Length: > 0 } wer)
        {
            if (!PerDayActor.TryGetValue(day, out var je)) PerDayActor[day] = je = new();
            je[wer] = je.GetValueOrDefault(wer) + 1;
        }
    }

    public IEnumerable<KeyValuePair<DateOnly, int>> Days => PerDay.OrderBy(p => p.Key);

    /// <summary>
    /// Wie <see cref="Sum(IReadOnlySet{string}, DateOnly, DateOnly)"/>, aber erst ab dem Eintrag <paramref name="cut"/>
    /// (einem Reset): liegt sein Tag im Zeitraum, zählt von diesem Tag nur, was nach ihm kam.
    /// </summary>
    public int Sum(IReadOnlySet<string> actors, DateOnly from, DateOnly to, long? cut)
    {
        var n = Sum(actors, from, to);
        if (cut is { } c && Cuts.TryGetValue(c, out var s) && s.Day >= from && s.Day <= to)
            foreach (var (actor, count) in s.Counts) if (actors.Contains(actor)) n -= count;
        return Math.Max(0, n);
    }

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

    /// <summary>Der Anfang eines Zeitraums — nie vor dem Zählbeginn der Lizenz (Taloan, 23.09.2026).</summary>
    public static DateOnly Ab(DateOnly anfang, DateOnly? zaehltAb) => zaehltAb is { } z && z > anfang ? z : anfang;

    public int Day(DateOnly d, bool all = false) => (all ? AllPerDay : PerDay).GetValueOrDefault(d);
    public int Week(DateOnly d, bool all = false) => Between(WeekStart(d), d, all);
    public int Month(DateOnly d, bool all = false) => Between(MonthStart(d), d, all);

    /// <summary>Wie der Verlauf der Anlage, aber nur für diese Urheber — der Verlauf eines Teams.</summary>
    public IEnumerable<(DateOnly Start, int Count, int All)> History(IReadOnlySet<string> actors, string period, DateOnly today, int limit = 90)
    {
        DateOnly Key(DateOnly d) => period switch { "week" => WeekStart(d), "month" => MonthStart(d), _ => d };
        var work = new Dictionary<DateOnly, int>();
        foreach (var (d, je) in PerDayActor)
        {
            var n = 0;
            foreach (var (wer, c) in je) if (actors.Contains(wer)) n += c;
            if (n > 0) work[Key(d)] = work.GetValueOrDefault(Key(d)) + n;
        }
        return work.OrderByDescending(g => g.Key).Take(limit).Select(g => (g.Key, g.Value, g.Value));
    }

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

/// <summary>Stand beim Einlösen eines Schlüssels: der Tag und was an ihm bis dahin je Urheber gezählt war.</summary>
public sealed record UsageCut(DateOnly Day, Dictionary<string, int> Counts);

/// <summary>
/// Die Grenzen des Testbetriebs: Woche und Monat (Taloan, 22.09.2026). <b>Kein Tageslimit</b> — „macht man 3 Testimporte
/// und muss aufhören“; der Tag wird gezählt und im Verlauf gezeigt, begrenzt wird er nicht. Im Betrieb kommen die
/// Grenzen aus der Lizenz (Taloan, 23.09.2026: „die Grenzen setzt der Lizenzkey“); ohne Lizenz gelten diese hier.
/// </summary>
public static class Limits
{
    /// <summary>
    /// Was ein Joblauf dem Menschen übriglässt (Taloan, 23.09.2026: „der Job sollte das Kontingent nicht bis zum letzten
    /// Limit ausreizen, sondern ein Stück für die Anwender freilassen, sagen wir 10 %“). Ein Import im Hintergrund darf
    /// also bis 90 % gehen; die letzten 10 % gehören der Handarbeit.
    /// </summary>
    public const double JobReserve = 0.10;

    /// <summary>Die Grenze für einen Joblauf: das Kontingent ohne die Reserve.</summary>
    public static int FuerJob(int grenze) => grenze <= 0 ? grenze : (int)Math.Floor(grenze * (1 - JobReserve));

    public const int Week = 10_000;    // Tarif Kostenlos (Taloan, 24.09.2026) — bis dahin 20 000 / 100 000
    public const int Month = 50_000;
}
