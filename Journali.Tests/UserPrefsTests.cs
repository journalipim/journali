using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Eigene Einstellungen am Benutzer: sie stehen im Journal
// am Benutzer, folgen der Person an jeden Rechner — und ein Eintrag trägt nur, was sich ändert.
public class UserPrefsTests
{
    private static Catalog World()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) => write("t", Users.Stream + "u1", Types.UserDefined, new UserDefined("U1", null, "admin"), null));
        return c;
    }
    private static Dictionary<string, string> Prefs(Catalog c, string user = "u1") => c.With((_, _, _) => c.Users.All[user].Prefs);

    [Fact]
    public void Nur_Genanntes_wird_gesetzt_leerer_Wert_nimmt_weg()
    {
        var c = World();
        c.With((_, _, write) => write("u1", Users.Stream + "u1", Types.UserPrefsSet, new UserPrefsSet(new() { ["theme"] = "\"dark\"", ["layout"] = "\"tabs\"" }), null));
        Assert.Equal("\"dark\"", Prefs(c)["theme"]);
        Assert.Equal("\"tabs\"", Prefs(c)["layout"]);
        // die Darstellung wechseln lässt alles andere stehen — der Eintrag trägt nur den einen Schlüssel
        c.With((_, _, write) => write("u1", Users.Stream + "u1", Types.UserPrefsSet, new UserPrefsSet(new() { ["theme"] = "\"light\"" }), null));
        Assert.Equal("\"light\"", Prefs(c)["theme"]);
        Assert.Equal("\"tabs\"", Prefs(c)["layout"]);
        // leer heisst weg
        c.With((_, _, write) => write("u1", Users.Stream + "u1", Types.UserPrefsSet, new UserPrefsSet(new() { ["layout"] = "" }), null));
        Assert.False(Prefs(c).ContainsKey("layout"));
    }

    [Fact]
    public void Die_Einstellungen_ueberleben_den_Neubau_aus_dem_Journal()
    {
        var j = new MemoryJournal(); var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) =>
        {
            write("t", Users.Stream + "u1", Types.UserDefined, new UserDefined("U1", null, "admin"), null);
            write("u1", Users.Stream + "u1", Types.UserPrefsSet, new UserPrefsSet(new() { ["viewLocales"] = "[\"de\",\"fr\"]" }), null);
            return 0;
        });
        var wieder = new Catalog(j); wieder.Rebuild();
        Assert.Equal("[\"de\",\"fr\"]", wieder.With((_, _, _) => wieder.Users.All["u1"].Prefs["viewLocales"]));
    }

    [Fact]
    public void Ein_zurueckgezogener_Benutzer_nimmt_seine_Einstellungen_mit()
    {
        var c = World();
        c.With((_, _, write) => write("u1", Users.Stream + "u1", Types.UserPrefsSet, new UserPrefsSet(new() { ["theme"] = "\"dark\"" }), null));
        c.With((_, _, write) => write("t", Users.Stream + "u1", Types.UserRetired, new UserRetired(), null));
        Assert.False(c.With((_, _, _) => c.Users.All.ContainsKey("u1")));
        // und eine Einstellung ohne Benutzer legt keinen an
        c.With((_, _, write) => write("x", Users.Stream + "gibtsnicht", Types.UserPrefsSet, new UserPrefsSet(new() { ["theme"] = "\"dark\"" }), null));
        Assert.False(c.With((_, _, _) => c.Users.All.ContainsKey("gibtsnicht")));
    }
}
