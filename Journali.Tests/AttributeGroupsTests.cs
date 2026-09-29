using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Attribut und Gruppe n:m (docs/pflegestruktur.md 36, 29.09.2026): eine Gruppe ist eine Auswahl von Attributen, kein
/// Besitz. Ein Attribut gilt überall, wo eine seiner Gruppen am Pfad hängt — ohne Kopie, mit denselben Regeln.
/// Es fällt genau eine Regel: die Beschränkung auf eine Gruppe. Pflicht, Vererbung und Vollständigkeit bleiben.
/// </summary>
public class AttributeGroupsTests
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

    private static void Gruppe(MemoryJournal j, string key, string? activeFrom = null) =>
        j.Append("t", Model.GroupStream + key, Types.AttributeGroupDefined, Types.Serialize(new AttributeGroupDefinition(key, Labels.Of(key, key), activeFrom)));

    private static void Attribut(MemoryJournal j, AttributeDefinition d) =>
        j.Append("t", Model.AttributeStream + d.Key, Types.AttributeDefined, Types.Serialize(d));

    private static void Mitglied(MemoryJournal j, string key, params string[] groups) =>
        j.Append("t", Model.AttributeStream + key, Types.AttributeGroupsSet, Types.Serialize(new AttributeGroupsSet(key, groups)));

    /// <summary>Zwei Äste, ein Attribut: die Spannungsversorgung gilt an beiden, ohne zweites Attribut.</summary>
    [Fact]
    public void Ein_Attribut_in_zwei_Gruppen_gilt_an_beiden_Aesten()
    {
        var hid = Ids.New(Roles.Group); var led = Ids.New(Roles.Group);
        var pHid = Ids.New(Roles.Product); var pLed = Ids.New(Roles.Product);
        var (_, model, tree) = Build(j =>
        {
            Gruppe(j, "zuendung"); Gruppe(j, "dimmung");
            Attribut(j, new AttributeDefinition("spannung", Labels.Of("Spannung", "Voltage"), AttributeTypes.Decimal));
            Mitglied(j, "spannung", "zuendung", "dimmung");
            j.Append("t", hid, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("HID", "HID"))));
            j.Append("t", hid, Types.GroupsAttached, Types.Serialize(new GroupsAttached(["zuendung"])));
            j.Append("t", pHid, Types.ProductCreated, Types.Serialize(new ProductCreated(hid)));
            j.Append("t", led, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("LED", "LED"))));
            j.Append("t", led, Types.GroupsAttached, Types.Serialize(new GroupsAttached(["dimmung"])));
            j.Append("t", pLed, Types.ProductCreated, Types.Serialize(new ProductCreated(led)));
        });
        Assert.Contains(model.AttributesOf("zuendung"), a => a.Key == "spannung");
        Assert.Contains(model.AttributesOf("dimmung"), a => a.Key == "spannung");
        Assert.Contains(CompletenessRules.ActiveAttributes(tree, model, tree.Nodes[pHid]), a => a.Key == "spannung");
        Assert.Contains(CompletenessRules.ActiveAttributes(tree, model, tree.Nodes[pLed]), a => a.Key == "spannung");
        // die Gruppen des Attributs stehen an einer Stelle — Zuordnung und Mitgliedschaften zusammen
        Assert.Equal(new[] { "dimmung", "zuendung" }, model.GroupsOf("spannung").ToArray());
        Assert.Contains("dimmung", model.AllGroupKeys);
    }

    /// <summary>Die Zuordnung am Attribut (<c>group</c>) zählt weiter mit: sie ist eine Mitgliedschaft unter anderen.</summary>
    [Fact]
    public void Zuordnung_und_Mitgliedschaft_gelten_zusammen()
    {
        var (_, model, _) = Build(j =>
        {
            Gruppe(j, "gehaeuse"); Gruppe(j, "dimmung");
            Attribut(j, new AttributeDefinition("breite", Labels.Of("Breite", "Width"), AttributeTypes.Decimal, Group: "gehaeuse"));
            Mitglied(j, "breite", "dimmung");
        });
        Assert.Contains(model.AttributesOf("gehaeuse"), a => a.Key == "breite");
        Assert.Contains(model.AttributesOf("dimmung"), a => a.Key == "breite");
        Assert.Equal(new[] { "dimmung", "gehaeuse" }, model.GroupsOf("breite").ToArray());
    }

    /// <summary>Ein Attribut ohne Mitgliedschaftseintrag verhält sich wie vor der Umstellung — das ist die Migration.</summary>
    [Fact]
    public void Ohne_Mitgliedschaftseintrag_gilt_die_Zuordnung_allein()
    {
        var g = Ids.New(Roles.Group); var p = Ids.New(Roles.Product);
        var (_, model, tree) = Build(j =>
        {
            Gruppe(j, "dpp"); Gruppe(j, "seo");
            Attribut(j, new AttributeDefinition("charge", Labels.Of("Charge", "Batch"), AttributeTypes.Text, Group: "dpp"));
            j.Append("t", g, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("G", "G"))));
            j.Append("t", g, Types.GroupsAttached, Types.Serialize(new GroupsAttached(["dpp", "seo"])));
            j.Append("t", p, Types.ProductCreated, Types.Serialize(new ProductCreated(g)));
        });
        Assert.Equal(new[] { "charge" }, model.AttributesOf("dpp").Select(a => a.Key).ToArray());
        Assert.Empty(model.AttributesOf("seo"));
        Assert.Equal(new[] { "dpp" }, model.GroupsOf("charge").ToArray());
        Assert.Contains(CompletenessRules.ActiveAttributes(tree, model, tree.Nodes[p]), a => a.Key == "charge");
    }

    /// <summary>Aus einer Gruppe genommen heisst: aus dieser einen. Der Eintrag setzt die ganze Menge.</summary>
    [Fact]
    public void Aus_einer_Gruppe_genommen_laesst_die_andere_unberuehrt()
    {
        var (journal, model, _) = Build(j =>
        {
            Gruppe(j, "zuendung"); Gruppe(j, "dimmung");
            Attribut(j, new AttributeDefinition("spannung", Labels.Of("Spannung", "Voltage"), AttributeTypes.Decimal));
            Mitglied(j, "spannung", "zuendung", "dimmung");
        });
        Mitglied(journal, "spannung", "dimmung");
        Projector.CatchUp(journal, model);
        Assert.Empty(model.AttributesOf("zuendung"));
        Assert.Contains(model.AttributesOf("dimmung"), a => a.Key == "spannung");
        // die letzte Mitgliedschaft lösen: das Attribut bleibt, es gilt nur nirgends mehr
        Mitglied(journal, "spannung");
        Projector.CatchUp(journal, model);
        Assert.Empty(model.AttributesOf("dimmung"));
        Assert.Empty(model.GroupsOf("spannung"));
        Assert.True(model.Attributes.ContainsKey("spannung"));
    }

    /// <summary>
    /// Pflicht und Vollständigkeit rechnen wie bisher: ein Attribut, das über zwei geltende Gruppen hereinkommt, zählt
    /// einmal. Sonst forderte dieselbe Grösse zweimal einen Wert.
    /// </summary>
    [Fact]
    public void Mehrfachmitgliedschaft_zaehlt_die_Pflicht_einmal()
    {
        var g = Ids.New(Roles.Group); var p = Ids.New(Roles.Product);
        var (_, model, tree) = Build(j =>
        {
            Gruppe(j, "zuendung"); Gruppe(j, "dimmung");
            Attribut(j, new AttributeDefinition("spannung", Labels.Of("Spannung", "Voltage"), AttributeTypes.Decimal,
                Required: new Dictionary<string, string[]> { ["web"] = ["*"] }));
            Mitglied(j, "spannung", "zuendung", "dimmung");
            j.Append("t", g, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("G", "G"))));
            j.Append("t", g, Types.GroupsAttached, Types.Serialize(new GroupsAttached(["zuendung", "dimmung"])));
            j.Append("t", p, Types.ProductCreated, Types.Serialize(new ProductCreated(g)));
        });
        var node = tree.Nodes[p];
        var aktiv = CompletenessRules.ActiveAttributes(tree, model, node).ToList();
        Assert.Single(aktiv, a => a.Key == "spannung");
        var (pflicht, fehlt) = CompletenessRules.Check(tree, model, node, aktiv, "web", "de");
        Assert.Equal(1, pflicht);
        Assert.Equal(new[] { "spannung" }, fehlt);
    }

    /// <summary>
    /// Die Gruppe entscheidet weiter, ab welchem Knotentyp erfasst wird: eine Mitgliedschaft in einer Gruppe, die erst
    /// an der Variante aktiv ist, holt das Attribut nicht ans Produkt.
    /// </summary>
    [Fact]
    public void Aktiv_ab_der_Gruppe_gilt_auch_fuer_Mitglieder()
    {
        var g = Ids.New(Roles.Group); var p = Ids.New(Roles.Product); var v = Ids.New(Roles.Variant);
        var (_, model, tree) = Build(j =>
        {
            Gruppe(j, "nurvariante", Roles.Variant);
            Attribut(j, new AttributeDefinition("farbe", Labels.Of("Farbe", "Colour"), AttributeTypes.Text));
            Mitglied(j, "farbe", "nurvariante");
            j.Append("t", g, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("G", "G"))));
            j.Append("t", g, Types.GroupsAttached, Types.Serialize(new GroupsAttached(["nurvariante"])));
            j.Append("t", p, Types.ProductCreated, Types.Serialize(new ProductCreated(g)));
            j.Append("t", v, Types.VariantCreated, Types.Serialize(new VariantCreated(p, new())));
        });
        Assert.DoesNotContain(CompletenessRules.ActiveAttributes(tree, model, tree.Nodes[p]), a => a.Key == "farbe");
        Assert.Contains(CompletenessRules.ActiveAttributes(tree, model, tree.Nodes[v]), a => a.Key == "farbe");
    }

    /// <summary>Mit dem Attribut gehen seine Mitgliedschaften; mit der Gruppe gehen ihre Mitglieder.</summary>
    [Fact]
    public void Zurueckgezogen_bleibt_keine_Mitgliedschaft()
    {
        var (journal, model, _) = Build(j =>
        {
            Gruppe(j, "zuendung"); Gruppe(j, "dimmung");
            Attribut(j, new AttributeDefinition("spannung", Labels.Of("Spannung", "Voltage"), AttributeTypes.Decimal));
            Mitglied(j, "spannung", "zuendung", "dimmung");
        });
        journal.Append("t", Model.GroupStream + "zuendung", Types.AttributeGroupRetired, Types.Serialize(new AttributeGroupRetired("zuendung")));
        Projector.CatchUp(journal, model);
        Assert.Equal(new[] { "dimmung" }, model.GroupsOf("spannung").ToArray());
        journal.Append("t", Model.AttributeStream + "spannung", Types.AttributeRetired, Types.Serialize(new AttributeRetired("spannung")));
        Projector.CatchUp(journal, model);
        Assert.Empty(model.AttributeGroups);
        Assert.Empty(model.AttributesOf("dimmung"));
    }

    /// <summary>
    /// Was die Oberfläche liest: je Attribut steht <c>groups</c> (die ganze Menge), und die Gruppenliste kennt auch eine
    /// Gruppe, die nur Mitglieder hat — sonst fehlte sie in der Auswahl.
    /// </summary>
    [Fact]
    public void Die_Ansicht_nennt_je_Attribut_seine_Gruppen()
    {
        var (_, model, _) = Build(j =>
        {
            Gruppe(j, "gehaeuse");
            Attribut(j, new AttributeDefinition("breite", Labels.Of("Breite", "Width"), AttributeTypes.Decimal, Group: "gehaeuse"));
            Mitglied(j, "breite", "dimmung");   // dimmung ist nirgends definiert: eine Gruppe, die nur Mitglieder hat
        });
        var sicht = JsonSerializer.SerializeToNode(ModelApi.View(model), new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        var attr = sicht["attributes"]!.AsArray().Single(a => a!["key"]!.GetValue<string>() == "breite")!;
        Assert.Equal(new[] { "dimmung", "gehaeuse" }, attr["groups"]!.AsArray().Select(g => g!.GetValue<string>()).ToArray());
        Assert.Equal("gehaeuse", attr["group"]!.GetValue<string>());   // die Zuordnung steht daneben
        Assert.Equal("decimal", attr["type"]!.GetValue<string>());     // und die ganze Definition
        var gruppen = sicht["groups"]!.AsArray().ToDictionary(g => g!["key"]!.GetValue<string>(), g => g!["attributes"]!.AsArray().Select(a => a!.GetValue<string>()).ToArray());
        Assert.Equal(new[] { "breite" }, gruppen["dimmung"]);
        Assert.Equal(new[] { "breite" }, gruppen["gehaeuse"]);
    }

    /// <summary>Modellieren kostet keine journali-Token — auch der neue Eintragstyp nicht.</summary>
    [Fact]
    public void Mitgliedschaft_ist_Modellieren_und_zaehlt_nicht()
    {
        Assert.Equal(Kinds.Model, Kinds.Of(Types.AttributeGroupsSet));
        Assert.False(Kinds.Billable(null, Types.AttributeGroupsSet));
    }
}
