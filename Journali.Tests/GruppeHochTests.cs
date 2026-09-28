using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Eine Gruppe, die eine Ebene höher angehängt wird, räumt die gleiche Anheftung darunter weg (28.09.2026). Der Fall:
/// die Gruppe „aus Dokument“ hing zum Testen an der Variante; der Dialog hängte sie ans Produkt — an der Variante stand
/// sie weiter als „ab hier nach unten“, obwohl sie längst geerbt war.
/// </summary>
public class GruppeHochTests
{
    private sealed class World
    {
        public MemoryJournal J = new(); public ModelCatalog Model = new(); public Tree Tree = new(); public Relations Relations = new(); public Media Media = new();
        public string G = Ids.New(Roles.Group), P = Ids.New(Roles.Product), V = Ids.New(Roles.Variant), V2 = Ids.New(Roles.Variant);
        public World()
        {
            foreach (var s in Journali.Core.Entries.Model.Seeds()) J.Append("system", s.Stream, s.Type, s.Payload);
            J.Append("t", Model_.GroupStream + "doc", Types.AttributeGroupDefined, Types.Serialize(new AttributeGroupDefinition("doc", Labels.Of("aus Dokument", "from document"))));
            J.Append("t", Model_.GroupStream + "other", Types.AttributeGroupDefined, Types.Serialize(new AttributeGroupDefinition("other", Labels.Of("Sonst", "Other"))));
            J.Append("t", G, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("G", "G"))));
            J.Append("t", P, Types.ProductCreated, Types.Serialize(new ProductCreated(G)));
            J.Append("t", V, Types.VariantCreated, Types.Serialize(new VariantCreated(P, new())));
            J.Append("t", V2, Types.VariantCreated, Types.Serialize(new VariantCreated(P, new())));
            Catch();
        }
        public void Catch() { Projector.CatchUp(J, Model); Projector.CatchUp(J, Tree); Projector.CatchUp(J, Relations); Projector.CatchUp(J, Media); }
        public Ctx Ctx => new() { Model = Model, Tree = Tree, Relations = Relations, Media = Media, Write = (s, ty, pl) => { var e = J.Append("t", s, ty, Types.Serialize(pl)); Catch(); return e; } };
        public string[] Eigene(string id) => Tree.Nodes[id].Groups;
        public string[] Wirksam(string id) => Tree.EffectiveGroups(Tree.Nodes[id]).Select(x => x.Group).ToArray();
    }
    private static class Model_ { public const string GroupStream = Journali.Core.Entries.Model.GroupStream; }

    [Fact]
    public void Eine_Ebene_hoeher_angehaengt_faellt_die_Doppelung_darunter_weg()
    {
        var w = new World();
        Assert.Null(Commands.AttachGroups(w.Ctx, w.V, ["doc"]).Error);
        Assert.Equal(["doc"], w.Eigene(w.V));

        Assert.Null(Commands.AttachGroups(w.Ctx, w.P, ["doc"]).Error);
        Assert.Empty(w.Eigene(w.V));                       // die eigene Anheftung ist weg
        Assert.Equal(["doc"], w.Wirksam(w.V));             // die Gruppe gilt weiter — geerbt vom Produkt
        Assert.Equal(["doc"], w.Eigene(w.P));
    }

    [Fact]
    public void Andere_Gruppen_am_Nachfahren_bleiben()
    {
        var w = new World();
        Commands.AttachGroups(w.Ctx, w.V, ["doc", "other"]);
        Commands.AttachGroups(w.Ctx, w.P, ["doc"]);
        Assert.Equal(["other"], w.Eigene(w.V));
        Assert.Equal(["doc", "other"], w.Wirksam(w.V).OrderBy(x => x).ToArray());
    }

    [Fact]
    public void Nur_was_neu_dazukommt_raeumt_auf()
    {
        // dieselbe Liste noch einmal ans Produkt: kein Eintrag an den Varianten
        var w = new World();
        Commands.AttachGroups(w.Ctx, w.P, ["doc"]);
        Commands.AttachGroups(w.Ctx, w.V2, ["other"]);
        var vorher = w.J.Head;
        Commands.AttachGroups(w.Ctx, w.P, ["doc"]);
        Assert.Equal(vorher + 1, w.J.Head);
        Assert.Equal(["other"], w.Eigene(w.V2));
    }

    [Fact]
    public void Was_von_oben_gilt_wird_unten_nicht_noch_einmal_angeheftet()
    {
        // Der Zustand „schon von oben — überflüssig“ entsteht gar nicht erst
        var w = new World();
        Commands.AttachGroups(w.Ctx, w.P, ["doc"]);
        Assert.Null(Commands.AttachGroups(w.Ctx, w.V, ["doc", "other"]).Error);
        Assert.Equal(["other"], w.Eigene(w.V));
        Assert.Equal(["doc", "other"], w.Wirksam(w.V).OrderBy(x => x).ToArray());
    }

    [Fact]
    public void Ein_Nachfahr_ohne_die_Gruppe_bekommt_keinen_Eintrag()
    {
        var w = new World();
        var vorher = w.J.Head;
        Commands.AttachGroups(w.Ctx, w.P, ["doc"]);
        Assert.Equal(vorher + 1, w.J.Head);                // nur das Produkt
    }
}
