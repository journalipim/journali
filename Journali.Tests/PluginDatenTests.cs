using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Plugin-Daten (30.09.2026): was schon genau so im Journal steht, wird nicht noch einmal geschrieben — das Journal wächst nur,
/// und ein Plugin, das seine Daten bei jedem Einlesen neu schickt, füllte es mit Gleichem.
/// </summary>
public class PluginDatenTests
{
    private static Catalog Welt() { var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing(); return c; }
    private static void Setze(Catalog c, string name, string? wert) => c.With((_, _, write) => write("t", Plugins.Stream + "p", Types.PluginDataSet, new PluginDataSet(name, wert), null));

    [Fact]
    public void Derselbe_Wert_ist_unveraendert_ein_anderer_nicht()
    {
        var c = Welt();
        Setze(c, "a", """{"x":1}""");
        Assert.True(PluginApi.Unveraendert(c, "p", "a", """{"x":1}"""));
        Assert.False(PluginApi.Unveraendert(c, "p", "a", """{"x":2}"""));
        Assert.False(PluginApi.Unveraendert(c, "p", "neu", """{"x":1}"""));
        Assert.False(PluginApi.Unveraendert(c, "gibtsnicht", "a", """{"x":1}"""));
    }

    [Fact]
    public void Ein_leerer_Wert_meint_weg_und_ist_gleich_wenn_es_den_Datensatz_nicht_gibt()
    {
        var c = Welt();
        Assert.True(PluginApi.Unveraendert(c, "p", "a", null));
        Assert.True(PluginApi.Unveraendert(c, "p", "a", ""));
        Setze(c, "a", "[]");
        Assert.False(PluginApi.Unveraendert(c, "p", "a", null));
        Setze(c, "a", null);
        Assert.True(PluginApi.Unveraendert(c, "p", "a", null));
    }
}
