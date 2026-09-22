using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Freigabesteuerung (Taloan, 22.09.2026): zählt eine Wertänderung als Eingriff in Prüfung und Freigabe?
// Gruppe: auto (Pflichtfeld in der Gruppe) · immer · nie — Attribut: wie die Gruppe · immer · nie.
public class ReleaseWatchTests
{
    private static Catalog World()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) =>
        {
            write("t", Model.GroupStream + "texte", Types.AttributeGroupDefined, new AttributeGroupDefinition("texte", Labels.Of("Texte", "Texts")), null);
            write("t", Model.GroupStream + "preise", Types.AttributeGroupDefined, new AttributeGroupDefinition("preise", Labels.Of("Preise", "Prices")), null);
            // Texte: ein Pflichtfeld → auto zählt; Preise: kein Pflichtfeld → auto zählt nicht
            write("t", Model.AttributeStream + "kurztext", Types.AttributeDefined, new AttributeDefinition("kurztext", Labels.Of("Kurztext", "Short"), AttributeTypes.Text, Group: "texte", Required: new() { ["web"] = ["*"] }), null);
            write("t", Model.AttributeStream + "langtext", Types.AttributeDefined, new AttributeDefinition("langtext", Labels.Of("Langtext", "Long"), AttributeTypes.Text, Group: "texte"), null);
            write("t", Model.AttributeStream + "preis", Types.AttributeDefined, new AttributeDefinition("preis", Labels.Of("Preis", "Price"), AttributeTypes.Decimal, Group: "preise"), null);
            return 0;
        });
        return c;
    }

    [Fact]
    public void Automatisch_zaehlt_nur_Gruppen_mit_Pflichtfeld()
    {
        var c = World();
        Assert.True(c.With((m, _, _) => m.Watched("kurztext")));   // Pflichtfeld in der Gruppe
        Assert.True(c.With((m, _, _) => m.Watched("langtext")));   // dieselbe Gruppe zählt mit
        Assert.False(c.With((m, _, _) => m.Watched("preis")));     // Gruppe ohne Pflichtfeld
        Assert.False(c.With((m, _, _) => m.Watched("gibtsnicht")));
    }

    [Fact]
    public void Gruppe_immer_und_nie_schlagen_die_Automatik()
    {
        var c = World();
        c.With((m, _, write) => write("t", Model.GroupStream + "preise", Types.AttributeGroupDefined, m.Groups["preise"] with { ReleaseWatch = ReleaseWatch.Always }, null));
        Assert.True(c.With((m, _, _) => m.Watched("preis")));
        c.With((m, _, write) => write("t", Model.GroupStream + "texte", Types.AttributeGroupDefined, m.Groups["texte"] with { ReleaseWatch = ReleaseWatch.Never }, null));
        Assert.False(c.With((m, _, _) => m.Watched("kurztext")));
    }

    [Fact]
    public void Attribut_schlaegt_die_Gruppe()
    {
        var c = World();
        // in einer zählenden Gruppe ein Attribut ausnehmen (Taloan: Preis stört keine Redaktionsfreigabe)
        c.With((m, _, write) => write("t", Model.AttributeStream + "langtext", Types.AttributeDefined, m.Attributes["langtext"] with { ReleaseWatch = ReleaseWatch.Never }, null));
        Assert.False(c.With((m, _, _) => m.Watched("langtext")));
        Assert.True(c.With((m, _, _) => m.Watched("kurztext")));
        // und umgekehrt: in einer stillen Gruppe eines beobachten
        c.With((m, _, write) => write("t", Model.AttributeStream + "preis", Types.AttributeDefined, m.Attributes["preis"] with { ReleaseWatch = ReleaseWatch.Always }, null));
        Assert.True(c.With((m, _, _) => m.Watched("preis")));
    }

    [Fact]
    public void Server_prueft_die_Werte()
    {
        var c = World();
        var bad = c.With((m, _, _) => ReleaseWatch.All.Contains("vielleicht"));
        Assert.False(bad);   // nur auto, always, never sind erlaubt — der Endpunkt lehnt alles andere ab
        Assert.Equal(["auto", "always", "never"], ReleaseWatch.All);
    }
}
