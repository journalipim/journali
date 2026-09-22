using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;

namespace Journali.Tests;

// Nutzung je Tag, Woche, Monat (Taloan, 22.09.2026: „zeige mir drei Fortschrittsbalken … und schreib die Werte fort“).
// Gezählt wird jeder Journaleintrag — Lesen und Exportieren erzeugen keine, also kosten sie nichts.
public class UsageTests
{
    private static Entry E(long n, DateTimeOffset at) => new(n, at, "t", "x", Types.AttributeSet, "{}");
    private static DateTimeOffset Local(int y, int m, int d, int h = 12) => new DateTimeOffset(new DateTime(y, m, d, h, 0, 0, DateTimeKind.Local));

    [Fact]
    public void Zaehlt_je_Tag_und_rechnet_Woche_und_Monat_daraus()
    {
        var u = new Usage();
        // Dienstag 22.09.2026 dreimal, Montag davor einmal, im Vormonat einmal
        long n = 0;
        foreach (var _ in Enumerable.Range(0, 3)) u.Apply(E(++n, Local(2026, 9, 22)));
        u.Apply(E(++n, Local(2026, 9, 21)));
        u.Apply(E(++n, Local(2026, 8, 31)));

        var heute = new DateOnly(2026, 9, 22);
        Assert.Equal(3, u.Day(heute));
        Assert.Equal(4, u.Week(heute));    // Montag 21. und Dienstag 22.
        Assert.Equal(4, u.Month(heute));   // der 31.08. gehört in den Vormonat
        Assert.Equal(5, u.LastApplied);
    }

    [Fact]
    public void Woche_beginnt_am_Montag_auch_am_Sonntag()
    {
        // Sonntag, 27.09.2026 — die Woche reicht zurück bis Montag, 21.09.
        Assert.Equal(new DateOnly(2026, 9, 21), Usage.WeekStart(new DateOnly(2026, 9, 27)));
        Assert.Equal(new DateOnly(2026, 9, 21), Usage.WeekStart(new DateOnly(2026, 9, 21)));
        Assert.Equal(new DateOnly(2026, 9, 1), Usage.MonthStart(new DateOnly(2026, 9, 27)));
    }

    [Fact]
    public void Verlauf_fasst_zusammen_neueste_zuerst()
    {
        var u = new Usage();
        long n = 0;
        u.Apply(E(++n, Local(2026, 9, 22))); u.Apply(E(++n, Local(2026, 9, 22)));
        u.Apply(E(++n, Local(2026, 9, 15)));
        u.Apply(E(++n, Local(2026, 8, 3)));

        var tage = u.History("day", new DateOnly(2026, 9, 22)).ToList();
        Assert.Equal(new DateOnly(2026, 9, 22), tage[0].Start);
        Assert.Equal(2, tage[0].Count);
        Assert.Equal(3, tage.Count);

        var wochen = u.History("week", new DateOnly(2026, 9, 22)).ToList();
        Assert.Equal(new DateOnly(2026, 9, 21), wochen[0].Start);
        Assert.Equal(2, wochen[0].Count);

        var monate = u.History("month", new DateOnly(2026, 9, 22)).ToList();
        Assert.Equal(new DateOnly(2026, 9, 1), monate[0].Start);
        Assert.Equal(3, monate[0].Count);
        Assert.Equal(1, monate[1].Count);
    }

    [Fact]
    public void Aus_dem_Journal_gebaut_zaehlt_jeder_Eintrag_genau_einmal()
    {
        var j = new MemoryJournal();
        foreach (var s in Model.Seeds()) j.Append("system", s.Stream, s.Type, s.Payload);
        var u = new Usage();
        Projector.CatchUp(j, u);
        var heute = DateOnly.FromDateTime(DateTime.Now);
        Assert.Equal(Model.Seeds().Count(), u.Day(heute));
        Assert.Equal(u.LastApplied, u.PerDay.Values.Sum());

        // zweimal nachlaufen zählt nicht doppelt
        Projector.CatchUp(j, u);
        Assert.Equal(Model.Seeds().Count(), u.Day(heute));
    }

    [Fact]
    public void Grenzen_sind_Woche_und_Monat_kein_Tag()
    {
        Assert.Equal(20_000, Limits.Week);
        Assert.Equal(100_000, Limits.Month);
        // Kein Tageslimit (Taloan, 22.09.2026) — sonst steht man nach drei Testimporten still
    }
}
