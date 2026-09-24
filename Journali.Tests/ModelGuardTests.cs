using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Typwechsel mit Bestand: der Server
// zählt vorher, was nicht mehr passt — Typ, mehrfach → einfach, Achse weg, Werteliste.
public class ModelGuardTests
{
    [Fact]
    public void Typwechsel_zaehlt_die_Werte_die_nicht_mehr_passen()
    {
        var j = new MemoryJournal(); var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        var attr = new AttributeDefinition("groups_x", Labels.Of("Gruppen", "Groups"), AttributeTypes.Text, Group: "mastergroup", Axes: [Axes.Locale], Multiple: true);
        c.With((_, _, write) =>
        {
            write("t", Model.AttributeStream + "groups_x", Types.AttributeDefined, attr, null);
            var g = write("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("G", "G")), null).Stream;
            var p = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(g), null).Stream;
            write("t", p, Types.AttributeSet, new AttributeSet("groups_x", "de", null, null, ["Adapter", "CPU"]), null);
            write("t", p, Types.AttributeSet, new AttributeSet("groups_x", "en", null, null, ["12", "7"]), null);
            return 0;
        });
        var before = c.With((model, _, _) => model.Attributes["groups_x"]);
        // Text → ganze Zahl: die deutschen Werte passen nicht, die englischen schon
        var clash = c.With((model, _, _) => ModelApi.Clash(c, model, before, before with { Type = AttributeTypes.Integer }));
        Assert.NotNull(clash); Assert.Equal(1, clash!.Value.Count); Assert.Contains("Adapter", clash.Value.Examples[0]);
        // mehrfach → einfach: beide Achsen tragen Listen
        Assert.Equal(2, c.With((model, _, _) => ModelApi.Clash(c, model, before, before with { Multiple = false }))!.Value.Count);
        // Sprachachse weg: beide Werte hängen an einer Sprache
        Assert.Equal(2, c.With((model, _, _) => ModelApi.Clash(c, model, before, before with { Axes = null }))!.Value.Count);
        // nur die Bezeichnung: kein Konflikt
        Assert.Null(c.With((model, _, _) => ModelApi.Clash(c, model, before, before with { Label = Labels.Of("Neu", "New") })));
    }
}
