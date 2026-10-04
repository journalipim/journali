using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Server;

namespace Journali.Tests;

// /api/health nennt modelAt (04.10.2026): die Nummer des letzten Eintrags, der das Modell geändert hat. Die Oberfläche lädt das Modell nur dann neu —
// vorher bei jedem Eintrag irgendwo, in jedem Tab, mehrere MB.
public class ModelChangedTests
{
    [Fact]
    public void Nur_Eintraege_des_Modells_aendern_den_Stand_des_Modells()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        long nachModell = 0;
        c.With((_, _, w) => { nachModell = w("t", Model.AttributeStream + "farbe", Types.AttributeDefined, new AttributeDefinition("farbe", Labels.Of("Farbe", "Colour"), "text", Group: "mastergroup"), null).Number; return 0; });
        Assert.Equal(nachModell, c.ReadModel(m => m.Changed));
        // eine Gruppe im Baum und ein Wert: kein Modell
        c.With((_, _, w) => { w("t", "g-x", Types.GroupCreated, new GroupCreated(null, Labels.Of("X", "X")), null); return 0; });
        Assert.Equal(nachModell, c.ReadModel(m => m.Changed));
        Assert.True(c.Head > nachModell);
    }
}
