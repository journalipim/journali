using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// journali-Token. Gezählt wird je Urheber;
// wem das zugerechnet wird, sagt sein Team — und dessen Zahler. KI ist ein anderes Thema und wird hier nicht begrenzt.
public class JournaliTokenTests
{
    private static Catalog Welt()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) =>
        {
            write("t", Teams.Stream + "es", Types.TeamDefined, new TeamDefined("Spanien", KeysFrom: Model.InitTeam, Managers: ["pablo"]), null);
            write("t", Users.Stream + "u1", Types.UserDefined, new UserDefined("U1", null, "admin", true, Model.InitTeam), null);
            write("t", Users.Stream + "pablo", Types.UserDefined, new UserDefined("Pablo", null, "editor", true, "es"), null);
            return 0;
        });
        return c;
    }
    /// <summary>Pflege schreiben — das zählt als journali-Token (Kinds.Billable).</summary>
    private static void Pflege(Catalog c, string actor, int mal)
    {
        var g = c.With((_, _, write) => write(actor, Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("G", "G")), null).Stream);
        for (var i = 0; i < mal; i++) c.With((_, _, write) => write(actor, g, Types.AttributeSet, new AttributeSet("name", "de", null, "x" + i, null), null).Number);
    }
    private static int Summe(Catalog c, params string[] leute)
    {
        var heute = DateOnly.FromDateTime(DateTime.Now);
        return c.ReadUsage(u => u.Sum(leute.ToHashSet(), Usage.MonthStart(heute), heute));
    }

    [Fact]
    public void Gezaehlt_wird_je_Urheber()
    {
        var c = Welt();
        Pflege(c, "u1", 3);
        Pflege(c, "pablo", 5);
        Assert.Equal(3, Summe(c, "u1"));
        Assert.Equal(5, Summe(c, "pablo"));
        Assert.Equal(8, Summe(c, "u1", "pablo"));
        Assert.Equal(0, Summe(c, "niemand"));
    }

    [Fact]
    public void Wer_ueber_ein_anderes_Team_abrechnet_zaehlt_dort_mit()
    {
        var c = Welt();
        Pflege(c, "pablo", 4);
        // Spanien rechnet über das Init Team ab — die Mitglieder beider Teams gehen auf dieselbe Rechnung
        Assert.Equal(Model.InitTeam, c.With((_, _, _) => c.Teams.Payer("es")));
        var aufRechnung = c.With((_, _, _) => c.Teams.Dependents(Model.InitTeam)
            .SelectMany(t => c.Users.All.Values.Where(u => u.Team == t)).Select(u => u.Key).ToHashSet());
        Assert.Contains("pablo", aufRechnung);
        Assert.Contains("u1", aufRechnung);
        Assert.Equal(4, Summe(c, aufRechnung.ToArray()));
    }

    [Fact]
    public void Das_Init_Team_traegt_die_Limits_jedes_weitere_beginnt_bei_null()
    {
        var c = Welt();
        var init = c.With((_, _, _) => c.Teams.Get(Model.InitTeam))!;
        Assert.Equal(Limits.Week, init.EntriesWeek);     // ohne Lizenz die Werte des Testbetriebs
        Assert.Equal(Limits.Month, init.EntriesMonth);
        var es = c.With((_, _, _) => c.Teams.Get("es"))!;
        Assert.Equal(0, es.EntriesWeek);
        Assert.Equal(0, es.EntriesMonth);
    }

    [Fact]
    public void Ansehen_zaehlt_nicht_mit()
    {
        var c = Welt();
        var vorher = Summe(c, "u1");
        c.With((_, _, write) => write("u1", Model.LocaleStream + "fr", Types.LocaleDefined, new LocaleDefinition("fr", "Französisch"), null).Number);
        Assert.Equal(vorher, Summe(c, "u1"));   // Modellpflege ist kein Tagesgeschäft
    }
}
