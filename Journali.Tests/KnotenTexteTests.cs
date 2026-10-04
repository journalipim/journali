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

    /// <summary>Der Hash ohne Zeichenkette ist derselbe wie der über den Text: sonst bettete der Job nach dem Wechsel alle Knoten neu ein.</summary>
    [Theory]
    [InlineData("")]
    [InlineData("Produkt\nVariante · Gruppe › Produkt\nGröße: 42 mm\n")]
    [InlineData("Ünïcödé 😀 und Leerzeichen am Ende  \n \t\n")]
    [InlineData("   ")]
    public void Der_Hash_ohne_Zeichenkette_ist_der_ueber_den_Text(string text)
    {
        var sb = new System.Text.StringBuilder(text);
        Assert.Equal(NodeText.Hash(text.TrimEnd()), NodeText.HashVon(sb));
        var lang = new System.Text.StringBuilder(); for (var i = 0; i < 3000; i++) lang.Append("Wert ").Append(i).Append(" äöü 😀\n");   // grösser als der Puffer am Anfang
        Assert.Equal(NodeText.Hash(lang.ToString().TrimEnd()), NodeText.HashVon(lang));
    }

    private static List<(string, string, string)> Hashes(IEnumerable<SemanticApi.KnotenText> l) => l.Select(t => (t.Node, t.Locale, t.Hash)).ToList();

    /// <summary>Nachrechnen (04.10.2026): nach einem Wert, einem neuen Namen und einer Änderung im Modell dasselbe wie alles neu gerechnet.</summary>
    [Fact]
    public void Nachgerechnet_ist_dasselbe_wie_alles_neu()
    {
        var c = Baum(3, 5, 2);
        Assert.Equal(Hashes(SemanticApi.Berechne(c)), Hashes(SemanticApi.KnotenTexte(c)));
        var (produkt, variante) = c.Lesen((_, tree) => { var v = tree.Nodes.Values.First(n => n.Role == Roles.Variant); return (v.Parent!, v.Id); });
        var vorher = SemanticApi.KnotenTexte(c).Where(t => t.Node == variante).Select(t => t.Hash).ToList();

        // ein Wert an der Variante: nur sie
        c.With((_, _, w) => w("t", variante, Types.AttributeSet, new AttributeSet("name", "de", null, "Stiefel 43"), null));
        Assert.Equal(new HashSet<string> { variante }, SemanticApi.Betroffen(c, c.Head - 1, c.Head));
        var nach = SemanticApi.KnotenTexte(c);
        Assert.Equal(Hashes(SemanticApi.Berechne(c)), Hashes(nach));
        Assert.NotEqual(vorher[0], nach.First(t => t.Node == variante && t.Locale == "de").Hash);

        // ein neuer Name am Produkt: der Pfad der Varianten darunter ändert sich mit
        c.With((_, _, w) => w("t", produkt, Types.NodeNamed, new NodeNamed("Stiefel"), null));
        Assert.Equal(Hashes(SemanticApi.Berechne(c)), Hashes(SemanticApi.KnotenTexte(c)));

        // ein Eintrag im Modell: alles neu
        c.With((model, _, w) => w("t", Model.AttributeStream + "name", Types.AttributeDefined, model.Attributes["name"] with { Label = Labels.Of("Bezeichnung", "Title") }, null));
        Assert.Null(SemanticApi.Betroffen(c, c.Head - 1, c.Head));
        Assert.Equal(Hashes(SemanticApi.Berechne(c)), Hashes(SemanticApi.KnotenTexte(c)));

        // ein Eintrag, der keinen Text ändert (Team, Job …): nichts nachzurechnen
        c.With((_, _, w) => w("t", Teams.Stream + "de", Types.TeamDefined, new TeamDefined("DE"), null));
        Assert.Empty(SemanticApi.Betroffen(c, c.Head - 1, c.Head)!);
    }

    /// <summary>Der schnelle Nachschlag ist derselbe wie Node.Own ohne Kanal, Zeile und Rückfallsprachen.</summary>
    [Fact]
    public void Eigen_ist_dasselbe_wie_Own()
    {
        var c = Baum(1, 2, 2);
        var v = c.Lesen((_, tree) => tree.Nodes.Values.First(n => n.Role == Roles.Variant).Id);
        c.With((_, _, w) =>
        {
            w("t", v, Types.AttributeSet, new AttributeSet("name", "de", null, "Stiefel"), null);
            w("t", v, Types.AttributeSet, new AttributeSet("name", null, null, "ohne Sprache"), null);
            return w("t", v, Types.AttributeSet, new AttributeSet("sku", null, null, "ST-1"), null);
        });
        c.Lesen((model, tree) =>
        {
            var n = tree.Nodes[v];
            foreach (var a in new[] { "name", "sku", "gibtsnicht" })
                foreach (var loc in new[] { "de", "en", "fr", null })
                    Assert.Equal(n.Own(a, loc, null, null, model.MasterLocale), NodeText.Eigen(n, a, loc, model.MasterLocale));
            return 0;
        });
    }

    /// <summary>
    /// Jeder Strom der eingebauten Vorgaben ist eingeordnet: ein Modellstrom (ein Eintrag dort rechnet alle Texte neu), ein Knoten (ohne Doppelpunkt) oder einer,
    /// der keinen Text ändert. Kommt ein neuer hinzu, entscheidet dieser Test, wohin er gehört — sonst blieben Texte nach einer Modelländerung alt.
    /// </summary>
    [Fact]
    public void Jeder_Strom_der_Vorgaben_ist_eingeordnet()
    {
        string[] ohneText = [Model.ChannelStream, Model.StatusStream, Model.ViewStream, Model.RelationStream, "workflow:", "media-preset:"];
        var offen = Model.Seeds().Concat(Model.TreeSeeds()).Select(s => s.Stream).Distinct()
            .Where(s => s.Contains(':') && !SemanticApi.ModellStroeme.Any(p => s.StartsWith(p, StringComparison.Ordinal)) && !ohneText.Any(p => s.StartsWith(p, StringComparison.Ordinal)))
            .ToList();
        Assert.Empty(offen);
    }
}
