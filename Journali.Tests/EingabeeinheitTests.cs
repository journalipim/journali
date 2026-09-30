using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Eingabeeinheit (30.09.2026): der Wert steht im Journal immer in der Einheit des Attributs, der Eintrag merkt sich dazu, in welcher
/// Einheit er eingegeben wurde („20 g“). Die Pflege zeigt ihn danach wieder so.
/// </summary>
public class EingabeeinheitTests
{
    private sealed class World
    {
        public MemoryJournal J = new(); public ModelCatalog Cat = new(); public Tree Tree = new(); public Relations Rel = new(); public Media Media = new();
        public World() { foreach (var s in Model.Seeds()) J.Append("system", s.Stream, s.Type, s.Payload); Catch(); }
        public void Catch() => Projector.CatchUpAll(J, Cat, Tree, Rel, Media);
        public Ctx Ctx => new() { Model = Cat, Tree = Tree, Relations = Rel, Media = Media, Write = (stream, type, payload) => { var e = J.Append("t", stream, type, Types.Serialize(payload)); Catch(); return e; } };
        public void Attribut(AttributeDefinition d) { J.Append("t", Model.AttributeStream + d.Key, Types.AttributeDefined, Types.Serialize(d)); Catch(); }
    }

    /// <summary>Ein Produkt mit dem Attribut "gewicht" (decimal, Einheit g) und einem Text- und einem Zahlenattribut ohne Einheit.</summary>
    private static (World w, string produkt) Aufbau()
    {
        var w = new World();
        w.Attribut(new("gewicht", Labels.Of("Gewicht", "Weight"), AttributeTypes.Decimal, Unit: "g", Group: "technik"));
        w.Attribut(new("farbe", Labels.Of("Farbe", "Colour"), AttributeTypes.Text, Group: "technik"));
        w.Attribut(new("anzahl", Labels.Of("Anzahl", "Count"), AttributeTypes.Integer, Group: "technik"));
        var g = Commands.CreateGroup(w.Ctx, null, Labels.Of("Mittel", "Agents")); Assert.Null(g.Error);
        var p = Commands.CreateProduct(w.Ctx, g.Entry!.Stream, null); Assert.Null(p.Error);
        Assert.Null(Commands.AttachGroups(w.Ctx, p.Entry!.Stream, ["technik"]).Error);
        return (w, p.Entry!.Stream);
    }
    private static readonly Axis Gewicht = new("gewicht", null, null);

    [Fact]
    public void Der_Eintrag_merkt_sich_die_Einheit_der_Eingabe_der_Wert_bleibt_in_der_des_Attributs()
    {
        var (w, p) = Aufbau();
        Assert.Null(Commands.SetAttribute(w.Ctx, p, "gewicht", null, null, "20000", null, null, "kg").Error);   // 20 kg, gespeichert als 20000 g
        var n = w.Tree.Nodes[p];
        Assert.Equal("20000", n.Values[Gewicht]);
        Assert.Equal("kg", n.Units[Gewicht]);
        Assert.Equal("kg", ValueView.Of(n).Single(v => v.Attribute == "gewicht").Unit);
    }

    [Fact]
    public void Ein_neuer_Wert_ohne_Einheit_nimmt_den_Hinweis_weg()
    {
        var (w, p) = Aufbau();
        Commands.SetAttribute(w.Ctx, p, "gewicht", null, null, "20000", null, null, "kg");
        Assert.Null(Commands.SetAttribute(w.Ctx, p, "gewicht", null, null, "500", null, null).Error);
        Assert.False(w.Tree.Nodes[p].Units.ContainsKey(Gewicht), "ohne Angabe gilt die Einheit des Attributs");
    }

    [Fact]
    public void Die_Einheit_des_Attributs_selbst_braucht_keinen_Hinweis()
    {
        var (w, p) = Aufbau();
        Assert.Null(Commands.SetAttribute(w.Ctx, p, "gewicht", null, null, "500", null, null, "g").Error);
        Assert.False(w.Tree.Nodes[p].Units.ContainsKey(Gewicht));
    }

    [Fact]
    public void Der_Wert_leeren_nimmt_den_Hinweis_mit()
    {
        var (w, p) = Aufbau();
        Commands.SetAttribute(w.Ctx, p, "gewicht", null, null, "20000", null, null, "kg");
        Assert.Null(Commands.SetAttribute(w.Ctx, p, "gewicht", null, null, "", null, null, "kg").Error);
        Assert.False(w.Tree.Nodes[p].Units.ContainsKey(Gewicht));
    }

    [Fact]
    public void Eine_Einheit_einer_anderen_Grösse_wird_abgelehnt()
    {
        var (w, p) = Aufbau();
        Assert.NotNull(Commands.SetAttribute(w.Ctx, p, "gewicht", null, null, "5", null, null, "cm").Error);      // Länge statt Masse
        Assert.NotNull(Commands.SetAttribute(w.Ctx, p, "gewicht", null, null, "5", null, null, "gibtsnicht").Error);
        Assert.False(w.Tree.Nodes[p].Values.ContainsKey(Gewicht), "nichts wurde geschrieben");
    }

    [Fact]
    public void Ein_Attribut_ohne_Einheit_nimmt_keine_Eingabeeinheit()
    {
        var (w, p) = Aufbau();
        Assert.NotNull(Commands.SetAttribute(w.Ctx, p, "anzahl", null, null, "5", null, null, "kg").Error);
        Assert.NotNull(Commands.SetAttribute(w.Ctx, p, "farbe", null, null, "rot", null, null, "kg").Error);
    }

    [Fact]
    public void Auch_ein_Relationswert_merkt_sich_die_Einheit()
    {
        var (w, p) = Aufbau();
        w.Attribut(new("einwaage", Labels.Of("Einwaage", "Weight in"), AttributeTypes.Decimal, Unit: "g", Group: "relation_component"));
        var g = w.Tree.Nodes[p].Parent!;
        var q = Commands.CreateProduct(w.Ctx, g, null); Assert.Null(q.Error);
        var r = Commands.CreateRelation(w.Ctx, "component", p, q.Entry!.Stream); Assert.Null(r.Error);

        Assert.Null(Commands.SetRelationAttribute(w.Ctx, r.Entry!.Stream, "einwaage", null, null, "20000", null, "kg").Error);
        var rel = w.Rel.All[r.Entry!.Stream];
        Assert.Equal("20000", rel.Values[new Axis("einwaage", null, null)]);
        Assert.Equal("kg", rel.Units[new Axis("einwaage", null, null)]);
        Assert.Equal("kg", ValueView.Of(rel).Single(v => v.Attribute == "einwaage").Unit);

        Assert.NotNull(Commands.SetRelationAttribute(w.Ctx, r.Entry!.Stream, "einwaage", null, null, "5", null, "cm").Error);
    }

    [Fact]
    public void Ein_aelterer_Eintrag_ohne_Einheit_gilt_unveraendert()
    {
        var alt = Types.Deserialize<AttributeSet>("{\"attribute\":\"gewicht\",\"locale\":null,\"channel\":null,\"value\":\"5\"}");
        Assert.Null(alt.Unit);
        var neu = Types.Deserialize<AttributeSet>(Types.Serialize(new AttributeSet("gewicht", null, null, "5", null, null, "kg")));
        Assert.Equal("kg", neu.Unit);
    }
}
