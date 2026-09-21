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
    public void Stand_eingefroren_liest_die_Pflege_wie_damals()
    {
        // Taloan, 21.09. („A“): Katalog schliesst → Stand einfrieren; was danach in der Pflege passiert, ist im Katalog nicht drin —
        // Freigabe zurückgenommen: eingefroren trotzdem drin; neues Produkt: eingefroren „noch nicht vorhanden“; live sieht beides
        var w = new World(); w.Release(w.V1);
        var head = w.J.Head;
        w.J.Append("t", w.Web, Types.PubStandSet, Types.Serialize(new PubStandSet(head)));
        w.J.Append("t", w.V1, Types.ReleaseRevoked, Types.Serialize(new ReleaseRevoked("web", null)));
        var p2 = Ids.New(Roles.Product); var v3 = Ids.New(Roles.Variant);
        w.J.Append("t", p2, Types.ProductCreated, Types.Serialize(new ProductCreated(w.Root)));
        w.J.Append("t", v3, Types.VariantCreated, Types.Serialize(new VariantCreated(p2, new())));
        w.J.Append("t", v3, Types.ReleaseGranted, Types.Serialize(new ReleaseGranted("web", null)));
        w.J.Append("t", w.Rubric, Types.NodePlaced, Types.Serialize(new NodePlaced(p2)));
        w.Catch();
        (ModelCatalog, Tree) At(long n) { var m = new ModelCatalog(); var tr = new Tree(); Projector.CatchUpUntil(w.J, m, n); Projector.CatchUpUntil(w.J, tr, n); return (m, tr); }
        var frozen = Publication.Export(w.Tree, w.Cat, w.Tree.Nodes[w.Web], null, At).ToList();
        Assert.True(frozen.Single(r => r.Product.Id == w.Product).In);                       // wie am Stichtag freigegeben
        Assert.Equal(head, frozen.Single(r => r.Product.Id == w.Product).Stand);
        var late = frozen.Single(r => r.Product.Id == p2);
        Assert.False(late.In); Assert.Contains("noch nicht vorhanden", late.Why[0]);
        var live = Publication.Export(w.Tree, w.Cat, w.Tree.Nodes[w.Web]).ToList();          // ohne at: live
        Assert.False(live.Single(r => r.Product.Id == w.Product).In);
        Assert.True(live.Single(r => r.Product.Id == p2).In);
        // Stand aufheben → live
        w.J.Append("t", w.Web, Types.PubStandSet, Types.Serialize(new PubStandSet(null))); w.Catch();
        Assert.Null(w.Tree.StandOf(w.Tree.Nodes[w.Rubric]).Stand);
        Assert.False(Publication.Export(w.Tree, w.Cat, w.Tree.Nodes[w.Web], null, At).Single(r => r.Product.Id == w.Product).In);
    }

    [Fact]
    public void Stand_gilt_ab_der_Rubrik_nach_unten_und_die_naechste_uebersteuert()
    {
        var w = new World();
        var sub = Ids.New(Roles.Rubric);
        w.J.Append("t", sub, Types.RubricCreated, Types.Serialize(new RubricCreated(w.Rubric, new(), "Unten")));
        w.J.Append("t", w.Web, Types.PubStandSet, Types.Serialize(new PubStandSet(5)));
        w.J.Append("t", sub, Types.PubStandSet, Types.Serialize(new PubStandSet(9)));
        w.Catch();
        Assert.Equal((5L, w.Web), (w.Tree.StandOf(w.Tree.Nodes[w.Rubric]).Stand, w.Tree.StandOf(w.Tree.Nodes[w.Rubric]).From!.Id));
        Assert.Equal((9L, sub), (w.Tree.StandOf(w.Tree.Nodes[sub]).Stand, w.Tree.StandOf(w.Tree.Nodes[sub]).From!.Id));
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
