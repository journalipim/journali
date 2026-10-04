using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Vorschau eines Stapels (04.10.2026): je Schritt liest der Plan den Strom des Knotens; ein Import-Stapel hat zehntausende Schritte, der Tooltip zeigt 15.
// Mit take rechnet der Server nur diese und sagt, dass es mehr gibt.
public class StapelVorschauTests
{
    [Fact]
    public void Mit_take_nur_die_ersten_Schritte_und_der_Hinweis_auf_mehr()
    {
        var j = new MemoryJournal(); var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        var knoten = new List<string>();
        c.With((_, _, w) =>
        {
            var g = w("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("G", "G")), null).Stream;
            for (var i = 0; i < 30; i++) knoten.Add(w("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(g), null).Stream);
            return 0;
        });
        c.With((_, _, w) => { foreach (var k in knoten) w("t", k, Types.AttributeSet, new AttributeSet("name", "de", null, "x", null), "stapel-1"); return 0; });
        var (alle, teil) = c.With((model, tree, _) => (Undo.Of(j, model, tree, "stapel-1"), Undo.Of(j, model, tree, "stapel-1", 15)));
        Assert.Equal(30, alle.Steps.Count); Assert.False(alle.More);
        Assert.Equal(15, teil.Steps.Count); Assert.True(teil.More); Assert.Equal(30, teil.Entries);
    }
}
