using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Ein Team muss sich pflegen lassen (Taloan, 23.09.2026: „lässt sich immer noch nicht einstellen“). Das Init Team kam aus
// dem Saatgut ohne Führung — und die Pflicht „mindestens ein Teammanager“ blockierte damit jedes Speichern, auch das
// Modell. Die Pflicht gilt beim Anlegen; eine bestehende Anlage repariert sich beim Start selbst.
public class TeamPflegeTests
{
    [Fact]
    public void Eine_Anlage_ohne_Fuehrung_holt_sie_sich_beim_Start()
    {
        var j = new MemoryJournal(); var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        Assert.Empty(c.With((_, _, _) => c.Teams.Primary!.Managers));   // Saatgut kennt noch keinen Benutzer
        // ein Administrator kommt dazu (wie beim Setup), danach ein Neustart
        c.With((_, _, write) => write("t", Users.Stream + "taloan", Types.UserDefined, new UserDefined("Taloan", null, "admin", true, Model.InitTeam), null));
        var wieder = new Catalog(j); wieder.Rebuild(); wieder.SeedMissing();
        Assert.Equal(["taloan"], wieder.With((_, _, _) => wieder.Teams.Primary!.Managers));
        Assert.True(wieder.With((_, _, _) => wieder.Teams.Leads(Model.InitTeam, "taloan")));
        // und es bleibt dabei: ein zweiter Start ändert nichts mehr
        var drittes = new Catalog(j); drittes.Rebuild(); drittes.SeedMissing();
        Assert.Equal(["taloan"], drittes.With((_, _, _) => drittes.Teams.Primary!.Managers));
    }

    [Fact]
    public void Wer_fuehrt_steht_auch_im_Team()
    {
        var j = new MemoryJournal(); var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) => write("t", Users.Stream + "taloan", Types.UserDefined, new UserDefined("Taloan", null, "admin"), null));
        Assert.Null(c.With((_, _, _) => c.Users.All["taloan"].Team));   // vorher teamlos
        var wieder = new Catalog(j); wieder.Rebuild(); wieder.SeedMissing();
        // die Reparatur macht ihn zum Manager — und trägt ihn ein (Taloan, 23.09.2026: „Init Team · 0 · niemand“)
        Assert.Equal(["taloan"], wieder.With((_, _, _) => wieder.Teams.Primary!.Managers));
        Assert.Equal(Model.InitTeam, wieder.With((_, _, _) => wieder.Users.All["taloan"].Team));
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
