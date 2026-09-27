using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;

namespace Journali.Tests;

// Kern ohne Server: Journal im Speicher füllen, Abbilder bauen, ablesen. Die Fälle sind die, die in der Bedienung
// schiefgingen.
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

    /// <summary>
    /// Ausdrücklich leer (27.09.2026): „wenn ich den geerbten Wert mit nichts überschreiben will, wird das nicht
    /// gespeichert“ — ein leerer <see cref="AttributeSet"/> nimmt nur den eigenen Wert weg, danach gilt der geerbte
    /// wieder. <see cref="AttributeCleared"/> setzt einen eigenen leeren Wert: er bricht die Vererbung.
    /// </summary>
    [Fact]
    public void Ausdruecklich_leer_bricht_die_Vererbung()
    {
        var g = Ids.New(Roles.Group); var p = Ids.New(Roles.Product);
        var (journal, model, tree) = Build(j =>
        {
            Define(j, new AttributeDefinition("name", Labels.Of("Name", "Name"), AttributeTypes.Text, Group: "basis", Inheritable: true));
            j.Append("t", g, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("Gruppe", "Group"))));
            j.Append("t", p, Types.ProductCreated, Types.Serialize(new ProductCreated(g)));
            j.Append("t", g, Types.AttributeSet, Types.Serialize(new AttributeSet("name", null, null, "geerbt")));
        });
        Assert.Equal(("geerbt", g), Lies(tree, model, p));

        // ausdrücklich leer: der eigene Wert ist "" — der geerbte gilt nicht mehr
        journal.Append("t", p, Types.AttributeCleared, Types.Serialize(new AttributeCleared("name", null, null)));
        tree = Neu(journal);
        Assert.Equal(("", p), Lies(tree, model, p));
        Assert.Equal("", tree.Nodes[p].Own("name", null, null));

        // der leere AttributeSet nimmt ihn wieder weg — dann erbt der Knoten wie zuvor
        journal.Append("t", p, Types.AttributeSet, Types.Serialize(new AttributeSet("name", null, null, "")));
        tree = Neu(journal);
        Assert.Equal(("geerbt", g), Lies(tree, model, p));

        // und ein richtiger Wert hebt ein ausdrückliches Leer auf
        journal.Append("t", p, Types.AttributeCleared, Types.Serialize(new AttributeCleared("name", null, null)));
        journal.Append("t", p, Types.AttributeSet, Types.Serialize(new AttributeSet("name", null, null, "eigen")));
        tree = Neu(journal);
        Assert.Equal(("eigen", p), Lies(tree, model, p));
    }

    /// <summary>Ein ausdrücklich leerer Wert zählt nicht als gefüllt — sonst wäre die Vollständigkeit geschönt.</summary>
    [Fact]
    public void Ausdruecklich_leer_ist_nicht_gefuellt()
    {
        var g = Ids.New(Roles.Group); var p = Ids.New(Roles.Product);
        var (journal, model, tree) = Build(j =>
        {
            Define(j, new AttributeDefinition("name", Labels.Of("Name", "Name"), AttributeTypes.Text, Group: "basis", Inheritable: true,
                Required: new Dictionary<string, string[]> { ["web"] = ["*"] }));
            j.Append("t", g, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("Gruppe", "Group"))));
            j.Append("t", p, Types.ProductCreated, Types.Serialize(new ProductCreated(g)));
            j.Append("t", g, Types.AttributeSet, Types.Serialize(new AttributeSet("name", null, null, "geerbt")));
            j.Append("t", p, Types.AttributeCleared, Types.Serialize(new AttributeCleared("name", null, null)));
        });
        var def = model.Attributes["name"];
        Assert.Contains("name", CompletenessRules.Check(tree, model, tree.Nodes[p], [def], "web", null).Missing);
        Assert.DoesNotContain("name", CompletenessRules.Check(tree, model, tree.Nodes[g], [def], "web", null).Missing);
    }

    /// <summary>Das Abbild aus dem Journal neu bauen — nach einem angehängten Eintrag.</summary>
    private static Tree Neu(MemoryJournal j) { var t = new Tree(); Projector.CatchUp(j, t); return t; }

    /// <summary>Wirksamer Wert und woher er kommt.</summary>
    private static (string?, string?) Lies(Tree tree, ModelCatalog model, string node)
    {
        var (v, from) = tree.Resolve(model, tree.Nodes[node], "name", null, null);
        return (v, from?.Id);
    }

    [Fact]
    public void Geltung_am_Vater_gesetzt_erbt_das_Produkt_und_die_Variante()
    {
        // Batteriepass (dpp_scope = [battery], vererbbar, Liste) an der Gruppe „HP EliteBook“ — das Produkt darunter
        // sagt „battery“, die Variante auch, und beide wissen, woher
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
        // Reihenfolge per Ziehen: NodeOrdered setzt den Platz, ohne Eintrag bleibt er leer (alphabetisch in der Oberfläche)
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
    public void Gruppe_an_der_Rubrik_gilt_fuer_die_Verweise_darunter()
    {
        // Web-Redakteur hängt „seo“ an seinen Baum: das verwiesene Produkt und seine Variante bekommen die Gruppe — mit Herkunft Rubrik;
        // ein zweiter Baum ohne die Gruppe (Print) kennt sie nicht; die Pflegegruppe kommt zuerst
        var g = Ids.New(Roles.Group); var p = Ids.New(Roles.Product); var v = Ids.New(Roles.Variant);
        var web = Ids.New(Roles.Rubric); var laptops = Ids.New(Roles.Rubric); var print = Ids.New(Roles.Rubric);
        var (_, model, tree) = Build(j =>
        {
            j.Append("t", Model.GroupStream + "seo", Types.AttributeGroupDefined, Types.Serialize(new AttributeGroupDefinition("seo", Labels.Of("SEO", "SEO"))));
            Define(j, new AttributeDefinition("seo_title", Labels.Of("SEO-Titel", "SEO title"), AttributeTypes.Text, Group: "seo", Axes: [Axes.Locale, Axes.Channel]));
            j.Append("t", g, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("G", "G"))));
            j.Append("t", g, Types.GroupsAttached, Types.Serialize(new GroupsAttached(["mastergroup"])));
            j.Append("t", p, Types.ProductCreated, Types.Serialize(new ProductCreated(g)));
            j.Append("t", v, Types.VariantCreated, Types.Serialize(new VariantCreated(p, new())));
            j.Append("t", web, Types.RubricCreated, Types.Serialize(new RubricCreated(null, new(), "Web", "web")));
            j.Append("t", web, Types.GroupsAttached, Types.Serialize(new GroupsAttached(["seo"])));
            j.Append("t", laptops, Types.RubricCreated, Types.Serialize(new RubricCreated(web, new(), "Laptops")));
            j.Append("t", laptops, Types.NodePlaced, Types.Serialize(new NodePlaced(g)));   // die Gruppe als Verweis — das Produkt hängt über sie drin
            j.Append("t", print, Types.RubricCreated, Types.Serialize(new RubricCreated(null, new(), "Print", "print")));
            j.Append("t", print, Types.NodePlaced, Types.Serialize(new NodePlaced(p)));
        });
        var eff = tree.EffectiveGroups(tree.Nodes[p]);
        Assert.Equal(new[] { "mastergroup", "seo" }, eff.Select(e => e.Group).ToArray());
        Assert.Equal(web, eff.Single(e => e.Group == "seo").From.Id);
        Assert.Contains(tree.EffectiveGroups(tree.Nodes[v]), e => e.Group == "seo");
        Assert.Contains(CompletenessRules.ActiveAttributes(tree, model, tree.Nodes[p]), a => a.Key == "seo_title");
        // die Rubrik selbst: nur ihre eigenen Gruppen, keine Rückkopplung über Verweise
        Assert.Equal(new[] { "seo" }, tree.EffectiveGroups(tree.Nodes[laptops]).Select(e => e.Group).ToArray());
    }

    [Fact]
    public void Kopierte_Rubrik_kennt_ihre_Quelle_alte_Eintraege_ohne()
    {
        var g = Ids.New(Roles.Group); var web = Ids.New(Roles.Rubric); var copy = Ids.New(Roles.Rubric); var old = Ids.New(Roles.Rubric);
        var (_, _, tree) = Build(j =>
        {
            j.Append("t", g, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("Schaumklebstoffe", "Foam adhesives"))));
            j.Append("t", web, Types.RubricCreated, Types.Serialize(new RubricCreated(null, new(), "Web", "web")));
            j.Append("t", copy, Types.RubricCreated, Types.Serialize(new RubricCreated(web, new(), "Schaumklebstoffe", Source: g)));
            j.Append("t", old, Types.RubricCreated, "{\"parent\":\"" + web + "\",\"label\":{},\"name\":\"Alt\"}");   // Eintrag von vor dem Feld
        });
        Assert.Equal(g, tree.Nodes[copy].Source);
        Assert.Null(tree.Nodes[old].Source);
    }

    [Fact]
    public void Arbeitsname_eines_Verweises_bleibt_intern_und_geht_mit_dem_Verweis()
    {
        var g = Ids.New(Roles.Group); var web = Ids.New(Roles.Rubric);
        var (journal, _, tree) = Build(j =>
        {
            j.Append("t", g, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("Ersatzteile", "Spare parts"))));
            j.Append("t", web, Types.RubricCreated, Types.Serialize(new RubricCreated(null, new(), "Katalog", "print")));
            j.Append("t", web, Types.NodePlaced, Types.Serialize(new NodePlaced(g)));
            j.Append("t", web, Types.PlaceNamed, Types.Serialize(new PlaceNamed(g, "Rasenmäher")));
        });
        Assert.Equal("Rasenmäher", tree.Nodes[web].PlacedNames[g]);
        Assert.Equal("Ersatzteile", tree.Nodes[g].Name);                       // die Pflegegruppe heisst weiter, wie sie heisst
        journal.Append("t", web, Types.PlaceNamed, Types.Serialize(new PlaceNamed(g, "")));
        Projector.CatchUp(journal, tree);
        Assert.False(tree.Nodes[web].PlacedNames.ContainsKey(g));            // leer = Pflegename
        journal.Append("t", web, Types.PlaceNamed, Types.Serialize(new PlaceNamed(g, "Rasenmäher")));
        journal.Append("t", web, Types.NodeUnplaced, Types.Serialize(new NodeUnplaced(g)));
        Projector.CatchUp(journal, tree);
        Assert.False(tree.Nodes[web].PlacedNames.ContainsKey(g));            // Verweis weg, Name weg
    }

    [Fact]
    public void Fallback_Sprache_mit_Wert_zaehlt_als_vollstaendig_Master_nicht()
    {
        // „wenn eine Fallback-Sprache eingerichtet ist und die einen Wert hat, darf das kein Blocker sein“ — fr-ch → fr-fr zählt;
        // der Master (de) zählt nicht (17.09.: eine fehlende Übersetzung ist fehlend, auch wenn der Master sie hätte)
        var g = Ids.New(Roles.Group); var p = Ids.New(Roles.Product); var v = Ids.New(Roles.Variant);
        var (_, model, tree) = Build(j =>
        {
            j.Append("t", Model.LocaleStream + "fr-fr", Types.LocaleDefined, Types.Serialize(new LocaleDefinition("fr-fr", "Französisch (FR)")));
            j.Append("t", Model.LocaleStream + "fr-ch", Types.LocaleDefined, Types.Serialize(new LocaleDefinition("fr-ch", "Französisch (CH)", "fr-fr")));
            j.Append("t", g, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("G", "G"))));
            j.Append("t", g, Types.GroupsAttached, Types.Serialize(new GroupsAttached(["mastergroup", "logistics"])));
            j.Append("t", p, Types.ProductCreated, Types.Serialize(new ProductCreated(g)));
            j.Append("t", v, Types.VariantCreated, Types.Serialize(new VariantCreated(p, new())));
            j.Append("t", v, Types.AttributeSet, Types.Serialize(new AttributeSet("sku", null, null, "S-1")));
            j.Append("t", v, Types.AttributeSet, Types.Serialize(new AttributeSet("name", "de", null, "Name de")));
            j.Append("t", v, Types.AttributeSet, Types.Serialize(new AttributeSet("name", "fr-fr", null, "Nom")));
        });
        var (_, missing) = CompletenessRules.Check(tree, model, tree.Nodes[v], CompletenessRules.ActiveAttributes(tree, model, tree.Nodes[v]).ToList(), "web", null);
        Assert.DoesNotContain("name/fr-ch", missing);   // über Fallback fr-fr da
        Assert.Contains("name/en", missing);            // nur über den Master da — fehlt
    }

    [Fact]
    public void Beleg_pending_bleibt_auch_ohne_Wert()
    {
        // „angefragt bei herbert bis 2026-10-04“ am leeren Wert — der Beleg steht, der Wert nicht
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
        // ✓ ohne „bei wem“ (falscher Klick): die Anfrage bleibt, die Quelle ist leer —
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
