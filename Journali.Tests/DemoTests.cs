using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Demo (07.10.2026): in ein leeres Journal kommt ein Beispielkatalog über den gewöhnlichen Schreibweg, dazu Rolle und Anwender demo.
/// Ein zweiter Start schreibt nichts; die Rolle hat keine Rechte der Verwaltung; das eigene Konto ist gesperrt.
/// </summary>
public class DemoTests
{
    private static Catalog Neu()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        return c;
    }

    [Fact]
    public void Ein_leeres_Journal_bekommt_den_Beispielkatalog_Rolle_und_Anwender()
    {
        var c = Neu();
        var n = Demo.Einrichten(c);
        Assert.True(n > 500, $"{n} Einträge");

        var (produkte, varianten, gruppen) = c.Lesen((_, t) => (t.Nodes.Values.Count(x => x.Role == Roles.Product), t.Nodes.Values.Count(x => x.Role == Roles.Variant), t.Nodes.Values.Count(x => x.Role == Roles.Group)));
        Assert.Equal(42, produkte);
        Assert.InRange(varianten, 84, 126);
        Assert.Equal(1 + 3 + 7, gruppen);
        Assert.True(c.Lesen((m, _) => m.Attributes.ContainsKey("luminous_flux") && m.Lists.ContainsKey("socket") && m.Units.ContainsKey("lm")));

        var rolle = c.Lesen((_, _) => c.Users.Roles[Demo.Rolle]);
        Assert.True(rolle.Rights.ToHashSet().SetEquals(Demo.Rechte));
        foreach (var verwaltung in new[] { Rights.Users, Rights.Plugins, Rights.Jobs, Rights.Storage, Rights.Team, Rights.ScriptumWrite, Rights.ScriptumRun })
            Assert.DoesNotContain(verwaltung, Auth.RightsOf(c, Demo.Rolle));
        var anwender = c.Lesen((_, _) => c.Users.All[Demo.Anwender]);
        Assert.Equal((Demo.Rolle, true, Model.InitTeam), (anwender.Role, anwender.Enabled, anwender.Team));
        Assert.Equal((Demo.Anwender, Demo.Rolle), Demo.Besucher(c));

        Assert.Equal(0, Demo.Einrichten(c));   // der nächste Start schreibt nichts
    }

    [Fact]
    public void Ein_Journal_mit_Produkten_bekommt_keinen_Katalog_dazu()
    {
        var c = Neu();
        Demo.Einrichten(c);
        var vorher = c.Head;
        c.With((_, _, write) => write("demo", Auth.Stream + Demo.Anwender, Types.UserDefined, new UserDefined("Demo", null, "admin", true, null), null));
        Assert.Equal(1, Demo.Einrichten(c));   // nur der Anwender wird zurückgestellt, kein zweiter Katalog
        Assert.Equal(vorher + 2, c.Head);
        Assert.Equal(Demo.Rolle, c.Lesen((_, _) => c.Users.All[Demo.Anwender]).Role);
    }

    [Theory]
    [InlineData("/api/auth/password", "POST", true)]
    [InlineData("/api/auth/login", "POST", true)]
    [InlineData("/API/AUTH/SETUP", "POST", true)]
    [InlineData("/api/auth/claim", "POST", true)]
    [InlineData("/api/auth/tokens", "POST", true)]
    [InlineData("/api/auth/tokens/abc", "DELETE", true)]
    [InlineData("/api/auth/tokens", "GET", false)]
    [InlineData("/api/auth/state", "GET", false)]
    [InlineData("/api/tree", "POST", false)]
    public void Das_eigene_Konto_Anmelden_und_Einrichten_sind_gesperrt(string pfad, string methode, bool gesperrt) =>
        Assert.Equal(gesperrt, Demo.Gesperrt(pfad, methode));

    [Fact]
    public void Ean_hat_die_Pruefziffer() => Assert.Equal("4006381333931", Demo.Ean("400638133393"));
}
