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
        Assert.Contains(row.Why, w => w.StartsWith("nicht freigegeben für web"));
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

    // ---- Regel-Verweise (Taloan, 21.09.: Ersatzteilkatalog aus 20 Produktgruppen)
    private sealed class Spares
    {
        public MemoryJournal J = new(); public ModelCatalog Cat = new(); public Tree Tree = new();
        public string Master = Ids.New(Roles.Group), Katalog = Ids.New(Roles.Rubric), Rubrik = Ids.New(Roles.Rubric);
        public Dictionary<string, (string Pg, string Parts, string Part)> Pgs = new();
        public Spares()
        {
            foreach (var s in Model.Seeds()) J.Append("system", s.Stream, s.Type, s.Payload);
            J.Append("t", Model.AttributeStream + "sortimentsrolle", Types.AttributeDefined, Types.Serialize(new AttributeDefinition("sortimentsrolle", Labels.Of("Sortimentsrolle", "Assortment role"), AttributeTypes.Text, Group: "mastergroup", Inheritable: true)));
            J.Append("t", Master, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("Mastertree", "Mastertree"), "Mastertree")));
            J.Append("t", Master, Types.GroupsAttached, Types.Serialize(new GroupsAttached(["mastergroup"])));
            foreach (var pgName in new[] { "Rasenmäher", "Heckenscheren" })
            {
                var pg = Ids.New(Roles.Group); var parts = Ids.New(Roles.Group); var acc = Ids.New(Roles.Group); var part = Ids.New(Roles.Product); var v = Ids.New(Roles.Variant); var accP = Ids.New(Roles.Product);
                J.Append("t", pg, Types.GroupCreated, Types.Serialize(new GroupCreated(Master, new(), pgName)));
                J.Append("t", parts, Types.GroupCreated, Types.Serialize(new GroupCreated(pg, new(), "Ersatzteile")));
                J.Append("t", parts, Types.AttributeSet, Types.Serialize(new AttributeSet("sortimentsrolle", null, null, "ersatzteil")));   // vererbbar: gilt für alle Teile darunter
                J.Append("t", acc, Types.GroupCreated, Types.Serialize(new GroupCreated(pg, new(), "Zubehör")));
                J.Append("t", part, Types.ProductCreated, Types.Serialize(new ProductCreated(parts)));
                J.Append("t", part, Types.NodeNamed, Types.Serialize(new NodeNamed($"Teil {pgName}")));
                J.Append("t", v, Types.VariantCreated, Types.Serialize(new VariantCreated(part, new())));
                J.Append("t", v, Types.ReleaseGranted, Types.Serialize(new ReleaseGranted("print", null)));
                J.Append("t", accP, Types.ProductCreated, Types.Serialize(new ProductCreated(acc)));
                Pgs[pgName] = (pg, parts, part);
            }
            J.Append("t", Katalog, Types.RubricCreated, Types.Serialize(new RubricCreated(null, new(), "Ersatzteilkatalog", "print")));
            J.Append("t", Rubrik, Types.RubricCreated, Types.Serialize(new RubricCreated(Katalog, new(), "Ersatzteile")));
            Catch();
        }
        public void Catch() { Projector.CatchUp(J, Cat); Projector.CatchUp(J, Tree); }
        public void Rule(PubRule r) { J.Append("t", Rubrik, Types.RulePlaced, Types.Serialize(new RulePlaced(r))); Catch(); }
        public List<Publication.ProductRow> Export() => Publication.Export(Tree, Cat, Tree.Nodes[Katalog]).ToList();
    }

    [Fact]
    public void Regel_nach_Aufbau_Gruppen_namens_Ersatzteile_gegliedert_nach_Produktgruppe()
    {
        var w = new Spares();
        w.Rule(new PubRule("r1", "name", w.Master, Roles.Group, "Ersatzteile", GroupBy: "parent"));
        var groups = Rules.Expand(w.Tree, w.Cat, w.Tree.Nodes[w.Rubrik].Rules[0]);
        Assert.Equal(new[] { "Heckenscheren", "Rasenmäher" }, groups.Select(g => g.Label).ToArray());     // je Produktgruppe eine Gliederung, nach Name
        Assert.All(groups, g => Assert.Equal("Ersatzteile", Rules.LabelOf(w.Tree, w.Cat, g.Matches.Single())));
        var rows = w.Export();
        Assert.Equal(2, rows.Count);                                                                     // die zwei Ersatzteile, das Zubehör nicht
        var r = rows.Single(x => x.Product.Id == w.Pgs["Rasenmäher"].Part);
        Assert.Equal(new[] { "Ersatzteilkatalog", "Ersatzteile", "Rasenmäher", "Ersatzteile" }, r.Rubrics.Select(p => p.Label).ToArray());
        Assert.Equal("r1", r.Rule); Assert.True(r.In);
    }

    [Fact]
    public void Regel_nach_Wert_Produkte_mit_Sortimentsrolle_geerbt_flach_oder_nach_Attribut()
    {
        var w = new Spares();
        w.Rule(new PubRule("r2", "attribute", w.Master, null, null, "sortimentsrolle", "ersatzteil", "none"));
        var rows = w.Export();
        Assert.Equal(2, rows.Count);
        Assert.All(rows, r => Assert.Equal(new[] { "Ersatzteilkatalog", "Ersatzteile" }, r.Rubrics.Select(p => p.Label).ToArray()));   // flach
        // Gliederung nach Attributwert (hier derselbe Wert → eine Gliederung „ersatzteil“)
        w.Rule(new PubRule("r2", "attribute", w.Master, null, null, "sortimentsrolle", "ersatzteil", "attr:sortimentsrolle"));
        var g = Rules.Expand(w.Tree, w.Cat, w.Tree.Nodes[w.Rubrik].Rules.Single());
        Assert.Equal("ersatzteil", g.Single().Label); Assert.Equal(2, g.Single().Matches.Count);
        Assert.Equal("value", w.Export().First().Rubrics[2].Role);
    }

    [Fact]
    public void Neue_Produktgruppe_ist_automatisch_drin_Regel_entfernen_leert_die_Rubrik()
    {
        var w = new Spares();
        w.Rule(new PubRule("r1", "name", w.Master, Roles.Group, "Ersatzteile", GroupBy: "parent"));
        var pg = Ids.New(Roles.Group); var parts = Ids.New(Roles.Group); var part = Ids.New(Roles.Product);
        w.J.Append("t", pg, Types.GroupCreated, Types.Serialize(new GroupCreated(w.Master, new(), "Kettensägen")));
        w.J.Append("t", parts, Types.GroupCreated, Types.Serialize(new GroupCreated(pg, new(), "ersatzteile")));   // Gross/klein egal
        w.J.Append("t", part, Types.ProductCreated, Types.Serialize(new ProductCreated(parts)));
        w.Catch();
        Assert.Equal(3, w.Export().Count);
        w.J.Append("t", w.Rubrik, Types.RuleRemoved, Types.Serialize(new RuleRemoved("r1"))); w.Catch();
        Assert.Empty(w.Export());
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
