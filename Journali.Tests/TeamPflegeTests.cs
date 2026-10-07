using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Ein Team muss sich pflegen lassen. Das Init Team kam aus
// dem Saatgut ohne Führung — und die Pflicht „mindestens ein Teammanager“ blockierte damit jedes Speichern, auch das
// Modell. Die Pflicht gilt beim Anlegen; eine bestehende Instanz repariert sich beim Start selbst.
public class TeamPflegeTests
{
    [Fact]
    public void Eine_Anlage_ohne_Fuehrung_holt_sie_sich_beim_Start()
    {
        var j = new MemoryJournal(); var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        Assert.Empty(c.With((_, _, _) => c.Teams.Primary!.Managers));   // Saatgut kennt noch keinen Benutzer
        // ein Administrator kommt dazu (wie beim Setup), danach ein Neustart
        c.With((_, _, write) => write("t", Users.Stream + "u1", Types.UserDefined, new UserDefined("U1", null, "admin", true, Model.InitTeam), null));
        var wieder = new Catalog(j); wieder.Rebuild(); wieder.SeedMissing();
        Assert.Equal(["u1"], wieder.With((_, _, _) => wieder.Teams.Primary!.Managers));
        Assert.True(wieder.With((_, _, _) => wieder.Teams.Leads(Model.InitTeam, "u1")));
        // und es bleibt dabei: ein zweiter Start ändert nichts mehr
        var drittes = new Catalog(j); drittes.Rebuild(); drittes.SeedMissing();
        Assert.Equal(["u1"], drittes.With((_, _, _) => drittes.Teams.Primary!.Managers));
    }

    [Fact]
    public void Wer_fuehrt_steht_auch_im_Team()
    {
        var j = new MemoryJournal(); var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) => write("t", Users.Stream + "u1", Types.UserDefined, new UserDefined("U1", null, "admin"), null));
        Assert.Null(c.With((_, _, _) => c.Users.All["u1"].Team));   // vorher teamlos
        var wieder = new Catalog(j); wieder.Rebuild(); wieder.SeedMissing();
        // die Reparatur macht ihn zum Manager — und trägt ihn ein
        Assert.Equal(["u1"], wieder.With((_, _, _) => wieder.Teams.Primary!.Managers));
        Assert.Equal(Model.InitTeam, wieder.With((_, _, _) => wieder.Users.All["u1"].Team));
        Assert.Single(wieder.With((_, _, _) => wieder.Users.All.Values.Where(u => u.Team == Model.InitTeam)));
    }

    [Fact]
    public void Ein_Leser_wird_nicht_zum_Teamleiter_gemacht()
    {
        var j = new MemoryJournal(); var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) => write("t", Users.Stream + "gast", Types.UserDefined, new UserDefined("Gast", null, "reader", true, Model.InitTeam), null));
        var wieder = new Catalog(j); wieder.Rebuild(); wieder.SeedMissing();
        Assert.Empty(wieder.With((_, _, _) => wieder.Teams.Primary!.Managers));   // ohne das Recht „Benutzer und Rollen“ führt niemand
    }
}
