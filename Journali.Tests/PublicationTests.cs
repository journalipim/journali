using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;

namespace Journali.Tests;

// Ausleitungsregel (Taloan, 21.09.: „bau die Ausleitungsregel mit Markt und Freigabe“): Freigabe je Kanal (mit Fallback), Markt in den
// Verkaufsländern (geerbt, mit Fallback-Kette), Produkt drin, wenn eine Variante drin ist.
public class PublicationTests
{
    private sealed class World
    {
        public MemoryJournal J = new(); public ModelCatalog Cat = new(); public Tree Tree = new();
        public string Root = Ids.New(Roles.Group), Product = Ids.New(Roles.Product), V1 = Ids.New(Roles.Variant), V2 = Ids.New(Roles.Variant);
        public string Web = Ids.New(Roles.Rubric), Rubric = Ids.New(Roles.Rubric);
        public World(string? market = null)
        {
            foreach (var s in Model.Seeds()) J.Append("system", s.Stream, s.Type, s.Payload);
            // Märkte de, ch (Fallback de), at (Fallback ch → de)
            J.Append("t", Model.ListStream + Publication.MarketList, Types.ListValueDefined, Types.Serialize(new ListValueDefinition("de", Labels.Of("Deutschland", "Germany"))));
            J.Append("t", Model.ListStream + Publication.MarketList, Types.ListValueDefined, Types.Serialize(new ListValueDefinition("ch", Labels.Of("Schweiz", "Switzerland"), new() { [Publication.FallbackColumn] = "de" })));
            J.Append("t", Model.ListStream + Publication.MarketList, Types.ListValueDefined, Types.Serialize(new ListValueDefinition("at", Labels.Of("Österreich", "Austria"), new() { [Publication.FallbackColumn] = "ch" })));
            J.Append("t", Root, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("Notebooks", "Notebooks"))));
            J.Append("t", Product, Types.ProductCreated, Types.Serialize(new ProductCreated(Root)));
            J.Append("t", V1, Types.VariantCreated, Types.Serialize(new VariantCreated(Product, new())));
            J.Append("t", V2, Types.VariantCreated, Types.Serialize(new VariantCreated(Product, new())));
            J.Append("t", Web, Types.RubricCreated, Types.Serialize(new RubricCreated(null, new(), "Web", "web", market)));
            J.Append("t", Rubric, Types.RubricCreated, Types.Serialize(new RubricCreated(Web, new(), "Laptops")));
            J.Append("t", Rubric, Types.NodePlaced, Types.Serialize(new NodePlaced(Product)));
            Catch();
        }
        public void Catch() { Projector.CatchUp(J, Cat); Projector.CatchUp(J, Tree); }
        public void Release(string variant, string channel = "web") { J.Append("t", variant, Types.ReleaseGranted, Types.Serialize(new ReleaseGranted(channel, null))); Catch(); }
        public void Markets(string node, params string[] m) { J.Append("t", node, Types.AttributeSet, Types.Serialize(new AttributeSet(Publication.MarketsAttribute, null, null, null, m))); Catch(); }
        public List<Publication.ProductRow> Export() => Publication.Export(Tree, Cat, Tree.Nodes[Web]).ToList();
    }

    [Fact]
    public void Ohne_Freigabe_ist_nichts_drin_und_der_Grund_steht_dabei()
    {
        var w = new World();
        var rows = w.Export();
        var row = Assert.Single(rows);
        Assert.False(row.In);
        Assert.Contains("nicht freigegeben für web", row.Why);
        Assert.Equal(2, row.Variants.Count);
        Assert.All(row.Variants, v => Assert.False(v.Verdict.In));
    }

    [Fact]
    public void Eine_freigegebene_Variante_bringt_das_Produkt_in_die_Ausleitung()
    {
        var w = new World(); w.Release(w.V1);
        var row = Assert.Single(w.Export());
        Assert.True(row.In);
        Assert.True(row.Variants.Single(v => v.Variant.Id == w.V1).Verdict.In);
        Assert.False(row.Variants.Single(v => v.Variant.Id == w.V2).Verdict.In);
    }

    [Fact]
    public void Markt_des_Baums_muss_in_den_Verkaufslaendern_stehen_leer_heisst_ueberall()
    {
        var w = new World("ch"); w.Release(w.V1);
        Assert.True(w.Export().Single().In);                     // keine Verkaufsländer gesetzt = überall
        w.Markets(w.V1, "fr");                                   // nur fr — ch steht nicht drin, auch nicht über die Kette ch → de
        var row = w.Export().Single();
        Assert.False(row.In); Assert.Contains(row.Why, s => s.StartsWith("Markt ch nicht in den Verkaufsländern"));
        w.Markets(w.V1, "fr", "ch");
        Assert.True(w.Export().Single().In);
    }

    [Fact]
    public void Verkaufslaender_erben_von_der_Gruppe()
    {
        var w = new World("ch"); w.Release(w.V1);
        w.Markets(w.Root, "fr");                                 // an der Gruppe: gilt für alles darunter
        Assert.False(w.Export().Single().In);
        w.Markets(w.Root, "ch");
        Assert.True(w.Export().Single().In);
    }

    [Fact]
    public void Markt_Fallback_ein_Markt_bekommt_das_Sortiment_seines_Fallback_Markts()
    {
        var w = new World("at"); w.Release(w.V1);
        w.Markets(w.V1, "de");                                   // at → ch → de: de reicht
        Assert.True(w.Export().Single().In);
        Assert.Equal(new[] { "at", "ch", "de" }, Publication.MarketChain(w.Cat, "at").ToArray());
        w.Markets(w.V1, "fr");
        Assert.False(w.Export().Single().In);
    }

    [Fact]
    public void Kanal_Fallback_zaehlt_fuer_die_Freigabe()
    {
        // Kanal shop mit Fallback web: eine Freigabe für web gilt auch für den Baum von shop
        var w = new World();
        w.J.Append("t", Model.ChannelStream + "shop", Types.ChannelDefined, Types.Serialize(new ChannelDefinition("shop", Labels.Of("Shop", "Shop"), Fallback: "web")));
        var shop = Ids.New(Roles.Rubric);
        w.J.Append("t", shop, Types.RubricCreated, Types.Serialize(new RubricCreated(null, new(), "Shop", "shop")));
        w.J.Append("t", shop, Types.NodePlaced, Types.Serialize(new NodePlaced(w.Product)));
        w.Release(w.V1, "web");
        var row = Publication.Export(w.Tree, w.Cat, w.Tree.Nodes[shop]).Single();
        Assert.True(row.In);
    }

    [Fact]
    public void Verwiesene_Gruppe_bringt_ihre_Produkte_mit_Pfad()
    {
        var w = new World(); w.Release(w.V1);
        var r2 = Ids.New(Roles.Rubric);
        w.J.Append("t", r2, Types.RubricCreated, Types.Serialize(new RubricCreated(w.Web, new(), "Alles")));
        w.J.Append("t", r2, Types.NodePlaced, Types.Serialize(new NodePlaced(w.Root)));   // die Gruppe als Verweis
        w.Catch();
        var rows = w.Export();
        Assert.Equal(2, rows.Count);                                        // einmal über „Laptops“, einmal über „Alles › Notebooks“
        var viaGroup = rows.Single(r => r.Rubrics.Any(x => x.Id == w.Root));
        Assert.Equal(new[] { w.Web, r2, w.Root }, viaGroup.Rubrics.Select(x => x.Id).ToArray());
        Assert.True(viaGroup.In);
    }

    [Fact]
    public void Produkt_ohne_Variante_ist_nie_drin()
    {
        var w = new World();
        var p2 = Ids.New(Roles.Product);
        w.J.Append("t", p2, Types.ProductCreated, Types.Serialize(new ProductCreated(w.Root)));
        w.J.Append("t", w.Rubric, Types.NodePlaced, Types.Serialize(new NodePlaced(p2)));
        w.Catch();
        var row = w.Export().Single(r => r.Product.Id == p2);
        Assert.False(row.In); Assert.Contains("keine Variante", row.Why[0]);
    }
}
