using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Das Init Team trägt die Limits der Lizenz. In einer Anlage, die älter ist als die Limits, stand
// dort 0/0, während die Lizenz 20.000/100.000 sagte — die Reparatur lief nie, weil sie an LicenceDir hing und das
// Saatgut vor dessen Zuweisung startete. Sie hängt jetzt an nichts mehr und lässt sich auch später aufrufen.
public class LimitsAusLizenzTests
{
    /// <summary>Eine Anlage wie vor den Limits: Init Team ohne Zuteilung.</summary>
    private static MemoryJournal Altanlage()
    {
        var j = new MemoryJournal();
        var c = new Catalog(j); c.Rebuild();
        c.With((_, _, write) => write("t", Teams.Stream + Model.InitTeam, Types.TeamDefined, new TeamDefined("Init Team"), null));
        return j;
    }

    [Fact]
    public void Ein_Team_ohne_Zuteilung_bekommt_sie_beim_Start()
    {
        var j = Altanlage();
        var c = new Catalog(j); c.Rebuild();
        Assert.Equal(0, c.With((_, _, _) => c.Teams.Primary!.EntriesWeek));
        c.SeedMissing();
        Assert.Equal(Limits.Week, c.With((_, _, _) => c.Teams.Primary!.EntriesWeek));
        Assert.Equal(Limits.Month, c.With((_, _, _) => c.Teams.Primary!.EntriesMonth));
    }

    [Fact]
    public void Ein_zweiter_Start_aendert_nichts_mehr()
    {
        var j = Altanlage();
        var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        var stand = j.Head;
        var wieder = new Catalog(j); wieder.Rebuild(); wieder.SeedMissing();
        Assert.Equal(stand, j.Head);   // nichts geschrieben
        Assert.Equal(Limits.Week, wieder.With((_, _, _) => wieder.Teams.Primary!.EntriesWeek));
    }

    [Fact]
    public void Die_Lizenz_gewinnt_auch_gegen_eingetippte_Werte()
    {
        // „Es gibt hier nichts einzustellen! Die Limits ergeben sich aus der Lizenz“
        var j = Altanlage();
        var c = new Catalog(j); c.Rebuild();
        c.With((_, _, write) => write("u1", Teams.Stream + Model.InitTeam, Types.TeamDefined, new TeamDefined("Init Team", EntriesWeek: 500, EntriesMonth: 900), null));
        c.SeedMissing();
        Assert.Equal(Limits.Week, c.With((_, _, _) => c.Teams.Primary!.EntriesWeek));
        Assert.Equal(Limits.Month, c.With((_, _, _) => c.Teams.Primary!.EntriesMonth));
    }

    [Fact]
    public void Ein_zweites_Team_bekommt_nichts()
    {
        var j = Altanlage();
        var c = new Catalog(j); c.Rebuild();
        c.With((_, _, write) => write("u1", Teams.Stream + "es", Types.TeamDefined, new TeamDefined("Spanien"), null));
        c.SeedMissing();
        Assert.Equal(Limits.Week, c.With((_, _, _) => c.Teams.Get(Model.InitTeam)!.EntriesWeek));
        Assert.Equal(0, c.With((_, _, _) => c.Teams.Get("es")!.EntriesWeek));   // jedes weitere Team startet bei 0
    }
}
