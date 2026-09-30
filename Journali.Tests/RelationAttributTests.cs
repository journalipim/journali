using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Werte an einer Relation (30.09.2026): erlaubt ist jedes Attribut, das zur Gruppe des Relationstyps gehört — über seine
/// Heimatgruppe oder über eine Mitgliedschaft (n:m). Ein Attribut muss dafür nicht kopiert werden.
/// </summary>
public class RelationAttributTests
{
    private sealed class World
    {
        public MemoryJournal J = new(); public ModelCatalog Cat = new(); public Tree Tree = new(); public Relations Rel = new(); public Media Media = new();
        public World() { foreach (var s in Model.Seeds()) J.Append("system", s.Stream, s.Type, s.Payload); Catch(); }
        public void Catch() => Projector.CatchUpAll(J, Cat, Tree, Rel, Media);
        public Ctx Ctx => new() { Model = Cat, Tree = Tree, Relations = Rel, Media = Media, Write = (stream, type, payload) => { var e = J.Append("t", stream, type, Types.Serialize(payload)); Catch(); return e; } };
        public string Produkt(string gruppe)
        {
            var o = Commands.CreateProduct(Ctx, gruppe, null); Assert.Null(o.Error);
            return o.Entry!.Stream;
        }
        public void Attribut(string key, string heimat, params string[] mitglied)
        {
            J.Append("t", Model.AttributeStream + key, Types.AttributeDefined, Types.Serialize(new AttributeDefinition(key, Labels.Of(key, key), AttributeTypes.Decimal, Group: heimat)));
            if (mitglied.Length > 0) J.Append("t", Model.AttributeStream + key, Types.AttributeGroupsSet, Types.Serialize(new AttributeGroupsSet(key, mitglied)));
            Catch();
        }
    }

    private static (World w, string relation) Aufbau()
    {
        var w = new World();
        var g = Commands.CreateGroup(w.Ctx, null, Labels.Of("Mittel", "Agents")); Assert.Null(g.Error);
        var tablette = w.Produkt(g.Entry!.Stream); var vitamin = w.Produkt(g.Entry!.Stream);
        var r = Commands.CreateRelation(w.Ctx, "component", tablette, vitamin); Assert.Null(r.Error);
        return (w, r.Entry!.Stream);
    }

    [Fact]
    public void Ein_Attribut_der_Gruppe_des_Relationstyps_ist_erlaubt()
    {
        var (w, r) = Aufbau();
        Assert.Null(Commands.SetRelationAttribute(w.Ctx, r, "quantity", null, null, "6", null).Error);
        Assert.Equal("6", w.Rel.All[r].Own("quantity", null, null));
    }

    [Fact]
    public void Ein_Attribut_mit_anderer_Heimatgruppe_ist_erlaubt_wenn_es_Mitglied_der_Gruppe_ist()
    {
        var (w, r) = Aufbau();
        w.Attribut("gehalt", heimat: "naehrwerte", "naehrwerte", "relation_component");

        Assert.Null(Commands.SetRelationAttribute(w.Ctx, r, "gehalt", null, null, "1.5", null).Error);
        Assert.Equal("1.5", w.Rel.All[r].Own("gehalt", null, null));
    }

    [Fact]
    public void Ein_Relationstyp_mit_mehreren_Gruppen_nimmt_die_Attribute_aller_Gruppen()
    {
        var w = new World();
        w.J.Append("t", Model.RelationStream + "mischung", Types.RelationTypeDefined,
            Types.Serialize(new RelationTypeDefinition("mischung", Labels.Of("Mischung", "Mix"), Group: "relation_component", Groups: ["relation_component", "naehrwerte"])));
        w.Attribut("gehalt", heimat: "naehrwerte");
        w.Catch();
        var g = Commands.CreateGroup(w.Ctx, null, Labels.Of("Mittel", "Agents")); Assert.Null(g.Error);
        var r = Commands.CreateRelation(w.Ctx, "mischung", w.Produkt(g.Entry!.Stream), w.Produkt(g.Entry!.Stream)); Assert.Null(r.Error);

        Assert.Null(Commands.SetRelationAttribute(w.Ctx, r.Entry!.Stream, "quantity", null, null, "6", null).Error);   // erste Gruppe
        Assert.Null(Commands.SetRelationAttribute(w.Ctx, r.Entry!.Stream, "gehalt", null, null, "1.5", null).Error);   // zweite Gruppe
    }

    [Fact]
    public void Ein_Relationstyp_der_nur_Group_kennt_gilt_als_Menge_mit_einer_Gruppe()
    {
        var t = new RelationTypeDefinition("alt", new Labels(), Group: "relation_component");
        Assert.Equal(["relation_component"], t.AllGroups());
        Assert.Empty(new RelationTypeDefinition("keine", new Labels()).AllGroups());
        Assert.Equal(["a", "b"], new RelationTypeDefinition("neu", new Labels(), Group: "a", Groups: ["a", "b"]).AllGroups());
    }

    [Fact]
    public void Ein_Attribut_ohne_Mitgliedschaft_in_der_Gruppe_wird_abgelehnt()
    {
        var (w, r) = Aufbau();
        w.Attribut("gehalt", heimat: "naehrwerte", "naehrwerte");

        var o = Commands.SetRelationAttribute(w.Ctx, r, "gehalt", null, null, "1.5", null);
        Assert.NotNull(o.Error);
        Assert.Null(w.Rel.All[r].Own("gehalt", null, null));
    }
}
