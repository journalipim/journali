using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Xunit.Abstractions;

namespace Journali.Tests;

/// <summary>Die Texte der Knoten für die Einbettungen: in Teilen gerechnet, mit gemerkten Namen — und dieselben Texte wie vorher.</summary>
public class KnotenTexteTests(ITestOutputHelper aus)
{
    private static Catalog Baum(int gruppen, int produkte, int varianten)
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) =>
        {
            for (var g = 0; g < gruppen; g++)
            {
                var gid = write("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("Gruppe " + g, "Group " + g)), null).Stream;
                for (var p = 0; p < produkte; p++)
                {
                    var pid = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(gid), null).Stream;
                    write("t", pid, Types.NodeNamed, new NodeNamed("Produkt " + g + "-" + p), null);
                    for (var v = 0; v < varianten; v++) write("t", Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(pid, new()), null);
                }
            }
            return 0;
        });
        return c;
    }

    [Fact]
    public void In_Teilen_mit_gemerkten_Namen_entstehen_dieselben_Texte_wie_je_Knoten_einzeln()
    {
        var c = Baum(6, 40, 3);                                   // 6 + 240 + 720 Knoten
        var uhr = System.Diagnostics.Stopwatch.StartNew();
        var neu = SemanticApi.Berechne(c);
        var tNeu = uhr.ElapsedMilliseconds;

        uhr.Restart();
        var alt = c.Lesen((model, tree) => tree.Nodes.Values.Where(n => n.Role is Roles.Group or Roles.Product or Roles.Variant)
            .OrderBy(n => n.Id, StringComparer.Ordinal)
            .SelectMany(n => new[] { "de", "en" }.Select(loc => { var t = NodeText.Of(model, tree, n, loc); return new SemanticApi.KnotenText(n.Id, loc, NodeText.Hash(t), t); })).ToList());
        aus.WriteLine($"{neu.Count} Texte: in Teilen {tNeu} ms, je Knoten einzeln {uhr.ElapsedMilliseconds} ms");

        Assert.Equal(alt.Count, neu.Count);
        Assert.Equal(alt.Select(t => (t.Node, t.Locale, t.Hash)), neu.Select(t => (t.Node, t.Locale, t.Hash)));
        Assert.True(neu.Count >= 966 * 2);                        // alle Knoten, je Sprache einer (dazu die Wurzel)
    }
}
