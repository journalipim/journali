using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;

namespace Journali.Tests;

// Kern ohne Server: Journal im Speicher füllen, Abbilder bauen, ablesen. Die Fälle sind die, die in der Bedienung
// schiefgingen (Taloan, 21.09.: „Use Cases durchtesten — dafür bist du da“).
public class TreeTests
{
    private static (MemoryJournal journal, ModelCatalog model, Tree tree) Build(Action<MemoryJournal> fill)
    {
        var journal = new MemoryJournal();
        foreach (var s in Model.Seeds()) journal.Append("system", s.Stream, s.Type, s.Payload);
        fill(journal);
        var model = new ModelCatalog(); Projector.CatchUp(journal, model);
        var tree = new Tree(); Projector.CatchUp(journal, tree);
        return (journal, model, tree);
    }

    private static void Define(MemoryJournal j, AttributeDefinition d) =>
        j.Append("t", Model.AttributeStream + d.Key, Types.AttributeDefined, Types.Serialize(d));

    [Fact]
    public void Geltung_am_Vater_gesetzt_erbt_das_Produkt_und_die_Variante()
    {
        // Batteriepass (dpp_scope = [battery], vererbbar, Liste) an der Gruppe „HP EliteBook“ — das Produkt darunter
        // sagt „battery“, die Variante auch, und beide wissen, woher (Taloan, 21.09.: Prüfung sagte „gilt hier nicht“)
        var g = Ids.New(Roles.Group); var p = Ids.New(Roles.Product); var v = Ids.New(Roles.Variant);
        var (_, model, tree) = Build(j =>
        {
            Define(j, new AttributeDefinition("dpp_scope", Labels.Of("Geltung", "scope"), AttributeTypes.Enum, Group: "dpp", List: "dpp_scope", Multiple: true, Inheritable: true));
            j.Append("t", g, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("HP EliteBook", "HP EliteBook"))));
            j.Append("t", p, Types.ProductCreated, Types.Serialize(new ProductCreated(g)));
            j.Append("t", v, Types.VariantCreated, Types.Serialize(new VariantCreated(p, new())));
            j.Append("t", g, Types.AttributeSet, Types.Serialize(new AttributeSet("dpp_scope", null, null, null, ["battery"])));
        });
        var (value, from) = tree.Resolve(model, tree.Nodes[p], "dpp_scope", null, null);
        Assert.Equal("battery", value); Assert.Equal(g, from!.Id);
        (value, from) = tree.Resolve(model, tree.Nodes[v], "dpp_scope", null, null);
        Assert.Equal("battery", value); Assert.Equal(g, from!.Id);
        // eigener Wert schlägt den geerbten; leer setzen (leere Liste) nimmt den eigenen weg, der Vater gilt wieder
    }

    [Fact]
    public void Eigene_Liste_schlaegt_die_geerbte_und_leer_nimmt_sie_wieder_weg()
    {
        var g = Ids.New(Roles.Group); var p = Ids.New(Roles.Product);
        var (journal, model, tree) = Build(j =>
        {
            Define(j, new AttributeDefinition("dpp_scope", Labels.Of("Geltung", "scope"), AttributeTypes.Enum, Group: "dpp", List: "dpp_scope", Multiple: true, Inheritable: true));
            j.Append("t", g, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("G", "G"))));
            j.Append("t", p, Types.ProductCreated, Types.Serialize(new ProductCreated(g)));
            j.Append("t", g, Types.AttributeSet, Types.Serialize(new AttributeSet("dpp_scope", null, null, null, ["battery"])));
            j.Append("t", p, Types.AttributeSet, Types.Serialize(new AttributeSet("dpp_scope", null, null, null, ["hazmat", "battery"])));
        });
        Assert.Equal("hazmat, battery", tree.Resolve(model, tree.Nodes[p], "dpp_scope", null, null).Value);
        journal.Append("t", p, Types.AttributeSet, Types.Serialize(new AttributeSet("dpp_scope", null, null, null, [])));
        Projector.CatchUp(journal, tree);
        var (value, from) = tree.Resolve(model, tree.Nodes[p], "dpp_scope", null, null);
        Assert.Equal("battery", value); Assert.Equal(g, from!.Id);
    }

    [Fact]
    public void Nicht_vererbbares_Attribut_bleibt_am_Knoten()
    {
        var g = Ids.New(Roles.Group); var p = Ids.New(Roles.Product);
        var (_, model, tree) = Build(j =>
        {
            j.Append("t", g, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("G", "G"))));
            j.Append("t", p, Types.ProductCreated, Types.Serialize(new ProductCreated(g)));
            j.Append("t", g, Types.AttributeSet, Types.Serialize(new AttributeSet("weight", null, null, "1.0")));
        });
        Assert.Null(tree.Resolve(model, tree.Nodes[p], "weight", null, null).Value);
        Assert.Equal("1.0", tree.Resolve(model, tree.Nodes[g], "weight", null, null).Value);
    }

    [Fact]
    public void Gruppe_am_Vater_angehaengt_gilt_darunter()
    {
        // GroupsAttached dpp an der Gruppe → das Produkt darunter hat die Attribute der Gruppe aktiv
        var g = Ids.New(Roles.Group); var p = Ids.New(Roles.Product);
        var (_, model, tree) = Build(j =>
        {
            j.Append("t", Model.GroupStream + "dpp", Types.AttributeGroupDefined, Types.Serialize(new AttributeGroupDefinition("dpp", Labels.Of("DPP", "DPP"))));
            Define(j, new AttributeDefinition("dpp_batch", Labels.Of("Charge", "Batch"), AttributeTypes.Text, Group: "dpp"));
            j.Append("t", g, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("G", "G"))));
            j.Append("t", p, Types.ProductCreated, Types.Serialize(new ProductCreated(g)));
            j.Append("t", g, Types.GroupsAttached, Types.Serialize(new GroupsAttached(["dpp"])));
        });
        Assert.Contains(CompletenessRules.ActiveAttributes(tree, model, tree.Nodes[p]), a => a.Key == "dpp_batch");
        Assert.Contains(tree.EffectiveGroups(tree.Nodes[p]), e => e.Group == "dpp");
    }

    [Fact]
    public void Platz_unter_den_Geschwistern_kommt_aus_NodeOrdered()
    {
        // Reihenfolge per Ziehen (Taloan, 21.09.): NodeOrdered setzt den Platz, ohne Eintrag bleibt er leer (alphabetisch in der Oberfläche)
        var root = Ids.New(Roles.Rubric); var a = Ids.New(Roles.Rubric); var b = Ids.New(Roles.Rubric);
        var (journal, _, tree) = Build(j =>
        {
            j.Append("t", root, Types.RubricCreated, Types.Serialize(new RubricCreated(null, new(), "Web", "web")));
            j.Append("t", a, Types.RubricCreated, Types.Serialize(new RubricCreated(root, new(), "Anfang")));
            j.Append("t", b, Types.RubricCreated, Types.Serialize(new RubricCreated(root, new(), "Ende")));
        });
        Assert.Null(tree.Nodes[a].Order); Assert.Null(tree.Nodes[b].Order);
        journal.Append("t", b, Types.NodeOrdered, Types.Serialize(new NodeOrdered(0)));
        journal.Append("t", a, Types.NodeOrdered, Types.Serialize(new NodeOrdered(1)));
        Projector.CatchUp(journal, tree);
        Assert.Equal(0, tree.Nodes[b].Order); Assert.Equal(1, tree.Nodes[a].Order);
        Assert.Equal(new[] { b, a }, tree.Children(root).OrderBy(n => n.Order).Select(n => n.Id).ToArray());
    }

    [Fact]
    public void Beleg_pending_bleibt_auch_ohne_Wert()
    {
        // „angefragt bei herbert bis 2026-10-04“ am leeren Wert — der Beleg steht, der Wert nicht (Taloan, 21.09.: „wo ist der Herbert“)
        var g = Ids.New(Roles.Group); var p = Ids.New(Roles.Product); var v = Ids.New(Roles.Variant);
        var (_, _, tree) = Build(j =>
        {
            j.Append("t", g, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("G", "G"))));
            j.Append("t", p, Types.ProductCreated, Types.Serialize(new ProductCreated(g)));
            j.Append("t", v, Types.VariantCreated, Types.Serialize(new VariantCreated(p, new())));
            j.Append("t", v, Types.ValueSourced, Types.Serialize(new ValueSourced("dpp_batch", null, null, null, "herbert", null, null, "pending", "2026-10-04")));
        });
        var n = tree.Nodes[v];
        Assert.Null(n.Own("dpp_batch", null, null));
        var s = n.Sources[new Axis("dpp_batch", null, null, null)];
        Assert.Equal("pending", s.Method); Assert.Equal("herbert", s.Source); Assert.Equal("2026-10-04", s.CheckedAt);
    }

    [Fact]
    public void Beleg_pending_bleibt_auch_ohne_Quelle()
    {
        // ✓ ohne „bei wem“ (falscher Klick, Taloan 21.09.: „was, wenn man mal was Falsches anklickt“): die Anfrage bleibt, die Quelle ist leer —
        // vorher nahm die leere Quelle den Beleg stumm weg, die Oberfläche zeigte trotzdem ⏳
        var g = Ids.New(Roles.Group); var p = Ids.New(Roles.Product);
        var (journal, _, tree) = Build(j =>
        {
            j.Append("t", g, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("G", "G"))));
            j.Append("t", p, Types.ProductCreated, Types.Serialize(new ProductCreated(g)));
            j.Append("t", p, Types.ValueSourced, Types.Serialize(new ValueSourced("dpp_batch", null, null, null, null, null, null, "pending", "2026-10-04")));
        });
        var s = tree.Nodes[p].Sources[new Axis("dpp_batch", null, null, null)];
        Assert.Equal("pending", s.Method); Assert.Equal("", s.Source); Assert.Equal("2026-10-04", s.CheckedAt);
        // leere Quelle ohne pending (manual) nimmt den Beleg weg — wie bisher
        journal.Append("t", p, Types.ValueSourced, Types.Serialize(new ValueSourced("dpp_batch", null, null, null, null)));
        Projector.CatchUp(journal, tree);
        Assert.False(tree.Nodes[p].Sources.ContainsKey(new Axis("dpp_batch", null, null, null)));
    }
}
