using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Microsoft.Extensions.Logging.Abstractions;

namespace Journali.Tests;

/// <summary>
/// „Läuft von selbst“ heisst bei einem Systemjob: er holt auf, was offen ist. Vorher lief er nur bei einem Ereignis
/// (nach dem Hochladen) — ein Rückstand aus der Zeit davor blieb liegen, und die Kachel zeigte für immer „1 876
/// offen“, obwohl der Schalter auf „an“ stand (28.09.2026).
/// </summary>
public class SystemjobNachziehenTests
{
    private static (Catalog C, JobRunner R, string Dir) Welt(params (string Job, string Plugin, bool An, string? Plan)[] jobs)
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        var dir = Path.Combine(Path.GetTempPath(), "journali-test-" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(dir);
        foreach (var (job, plugin, an, plan) in jobs)
            c.With((_, _, write) => write("test", Jobs.Stream + job, Types.JobDefined,
                new JobDefined(job, plugin, new(), plan, an, 60, null), null));
        var r = new JobRunner(c, dir, dir, NullLogger<JobRunner>.Instance);
        return (c, r, dir);
    }

    /// <summary>Was der Takt tun würde: die Jobs, die er als Kandidaten nimmt.</summary>
    private static List<string> Kandidaten(Catalog c) =>
        c.Lesen((_, _) => c.Jobs.All.Values.Where(j => j.Enabled && j.Schedule is null).Select(j => j.Key).OrderBy(x => x).ToList());

    [Fact]
    public void Ein_eingeschalteter_Systemjob_ohne_Zeitplan_ist_Kandidat()
    {
        var (c, _, _) = Welt(("derive", "derive", true, null));
        Assert.Equal(["derive"], Kandidaten(c));
    }

    [Fact]
    public void Ausgeschaltet_wird_nicht_nachgezogen()
    {
        // Der Schalter auf der Kachel ist die Bremse: aus heisst, er wartet auf den Knopf
        var (c, _, _) = Welt(("derive", "derive", false, null));
        Assert.Empty(Kandidaten(c));
    }

    [Fact]
    public void Ein_Job_mit_Zeitplan_laeuft_ueber_den_Takt_und_nicht_zweimal()
    {
        // Wer einen cron hat, wird von Tick gestartet — sonst liefe er doppelt
        var (c, _, _) = Welt(("export", "csv", true, "0 2 * * *"));
        Assert.Empty(Kandidaten(c));
    }

    [Fact]
    public void Mehrere_Systemjobs_werden_alle_betrachtet()
    {
        var (c, _, _) = Welt(("derive", "derive", true, null), ("probe", "probe", true, null), ("embed", "embed", false, null));
        Assert.Equal(["derive", "probe"], Kandidaten(c));
    }

    [Fact]
    public void Ohne_Offen_Funktion_geschieht_nichts()
    {
        // Das Programm setzt sie; in Tests und Werkzeugen bleibt sie leer — dann zieht der Takt nichts nach
        var (_, r, _) = Welt(("derive", "derive", true, null));
        Assert.Null(r.Offen);
    }

    [Fact]
    public async Task Die_Offen_Funktion_liefert_die_Zahl_der_offenen_Posten()
    {
        var (_, r, _) = Welt(("derive", "derive", true, null));
        r.Offen = plugin => Task.FromResult(plugin == "derive" ? 1876 : 0);
        Assert.Equal(1876, await r.Offen("derive"));
        Assert.Equal(0, await r.Offen("probe"));
    }
}
