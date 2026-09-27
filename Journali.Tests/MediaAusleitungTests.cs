using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Die Sicht der Ausleitung (27.09.2026): ein Medium geht mit, wenn es heute gilt und freigegeben ist. Freigegeben heisst:
/// jeder Workflow, der für Assets gilt, steht am Medium in einem Endzustand; ohne Medien-Workflow ist alles frei, und der
/// Startzustand ist es nicht — das ist der Sinn eines Freigabe-Workflows für Bilder.
/// </summary>
public class MediaAusleitungTests
{
    private sealed class World
    {
        public MemoryJournal J = new(); public ModelCatalog Cat = new(); public Tree Tree = new(); public Relations Rel = new(); public Media Media = new(); public Workflows Wf = new();
        public World()
        {
            foreach (var s in Model.Seeds()) J.Append("system", s.Stream, s.Type, s.Payload);
            foreach (var s in Model.TreeSeeds()) J.Append("system", s.Stream, s.Type, s.Payload);
            J.Append("t", "m-1", Types.MediaCreated, Types.Serialize(new MediaCreated("s1", 1, "image/png", "a.png")));
            J.Append("t", "m-2", Types.MediaCreated, Types.Serialize(new MediaCreated("s2", 1, "image/png", "b.png")));
            J.Append("t", "r-1", Types.RelationCreated, Types.Serialize(new RelationCreated("image", Model.RootNode, "m-1")));
            J.Append("t", "r-2", Types.RelationCreated, Types.Serialize(new RelationCreated("image", Model.RootNode, "m-2")));
            Catch();
        }
        public void Catch() => Projector.CatchUpAll(J, Cat, Tree, Rel, Media, Wf);
        public void Bildfreigabe(string[] roles) => J.Append("t", Workflows.Stream + "bild", Types.WorkflowDefined, Types.Serialize(new WorkflowDefined(Labels.Of("Bildfreigabe", "Image release"),
            [new WfState("draft", Labels.Of("Entwurf", "Draft")), new WfState("ok", Labels.Of("Freigegeben", "Released"), "pos", Final: true)],
            [new WfTransition("release", "draft", "ok", Labels.Of("freigeben", "release"))], "draft", roles)));
        public RelationView Sicht(string rel) => RelationView.Of(Tree, Cat, Media, Rel.All[rel], "out", Wf);
    }

    [Fact]
    public void Ohne_Medien_Workflow_ist_jedes_Medium_freigegeben()
    {
        var w = new World();
        Assert.True(MediaWorkflowApi.Freigegeben(w.Wf, w.Media.All["m-1"]));
        w.Bildfreigabe(["product"]);   // ein Workflow nur für Knoten zählt am Medium nicht
        w.Catch();
        Assert.True(MediaWorkflowApi.Freigegeben(w.Wf, w.Media.All["m-1"]));
        Assert.True(w.Sicht("r-1").Other.Released);
        Assert.True(RelationView.Ausleitbar(w.Sicht("r-1").Other));
    }

    [Fact]
    public void Mit_Medien_Workflow_ist_nur_der_Endzustand_frei()
    {
        var w = new World();
        w.Bildfreigabe(["product", "media"]);
        w.J.Append("t", "m-1", Types.WorkflowStateSet, Types.Serialize(new WorkflowStateSet("bild", "ok", "release")));
        w.Catch();
        Assert.True(MediaWorkflowApi.Freigegeben(w.Wf, w.Media.All["m-1"]));    // freigegeben
        Assert.False(MediaWorkflowApi.Freigegeben(w.Wf, w.Media.All["m-2"]));   // Start ist nicht final
        Assert.True(w.Sicht("r-1").Other.Released);
        Assert.False(w.Sicht("r-2").Other.Released);
        Assert.True(RelationView.Ausleitbar(w.Sicht("r-1").Other));
        Assert.False(RelationView.Ausleitbar(w.Sicht("r-2").Other));
        // ohne Workflows in der Sicht (Aufrufer von früher) bleibt Released wahr — niemand verliert etwas
        Assert.True(RelationView.Of(w.Tree, w.Cat, w.Media, w.Rel.All["r-2"], "out").Other.Released);
    }

    [Fact]
    public void Abgelaufen_ist_nicht_ausleitbar_auch_wenn_freigegeben()
    {
        var w = new World();
        w.J.Append("t", "m-1", Types.AttributeSet, Types.Serialize(new AttributeSet(Model.ValidUntil, null, null, "2000-01-01")));
        w.Catch();
        var e = w.Sicht("r-1").Other;
        Assert.True(e.Released); Assert.False(e.Valid);
        Assert.False(RelationView.Ausleitbar(e));
        // ein Knoten als anderes Ende geht immer mit
        Assert.True(RelationView.Ausleitbar(new RelationEnd("p-1", Roles.Product, "x", false, Valid: false, Released: false)));
    }
}
