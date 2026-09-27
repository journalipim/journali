using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Derselbe Workflow auch für Assets (27.09.2026): gilt nur, wenn seine Rollen <c>media</c> nennen; der Zustand
/// steht am Medienstrom, ohne Vererbung; Rolle und Notizpflicht wie am Knoten; Wirkungen gelten am Medium nicht.
/// </summary>
public class MediaWorkflowTests
{
    private sealed class World
    {
        public MemoryJournal J = new(); public ModelCatalog Cat = new(); public Tree Tree = new(); public Relations Rel = new(); public Media Media = new(); public Workflows Wf = new();
        public World() { foreach (var s in Model.Seeds()) J.Append("system", s.Stream, s.Type, s.Payload); Catch(); }
        public void Catch() => Projector.CatchUpAll(J, Cat, Tree, Rel, Media, Wf);
        public Ctx Ctx(string? role = null) => new() { Model = Cat, Tree = Tree, Relations = Rel, Media = Media, Workflows = Wf, Role = role, Write = (stream, type, payload) => { var e = J.Append("t", stream, type, Types.Serialize(payload)); Catch(); return e; } };
        public string Medium()
        {
            var e = J.Append("t", Ids.Media(), Types.MediaCreated, Types.Serialize(new MediaCreated(Guid.NewGuid().ToString("N"), 10, "image/png", "a.png")));
            Catch(); return e.Stream;
        }
        /// <summary>Entwurf → Freigabe (Rolle editor) → Fertig; die Korrektur zurück braucht eine Notiz.</summary>
        public void Workflow(string[]? roles)
        {
            var d = new WorkflowDefined(Labels.Of("Bildfreigabe", "Image release"),
                [new WfState("draft", Labels.Of("Entwurf", "Draft")), new WfState("ok", Labels.Of("Freigegeben", "Released"), "pos", Final: true)],
                [new WfTransition("release", "draft", "ok", Labels.Of("freigeben", "release"), Roles: ["editor"], Effects: ["release:web"]),
                 new WfTransition("back", "ok", "draft", Labels.Of("zurück", "back"), NoteRequired: true)],
                "draft", roles);
            Assert.Null(Commands.DefineWorkflow(Ctx(), "bild", d).Error);
        }
    }

    [Fact]
    public void Nur_ausdruecklich_fuer_Assets()
    {
        var w = new World();
        w.Workflow(null);                       // leer = alle Pflegeknoten, nicht die Bilder
        Assert.False(w.Wf.All["bild"].AppliesToMedium());
        Assert.Contains("gilt nicht für Assets", Commands.WorkflowStepMedium(w.Ctx(), w.Medium(), "bild", "release", null).Error);
        w.Workflow(["product", "media"]);
        Assert.True(w.Wf.All["bild"].AppliesToMedium());
    }

    [Fact]
    public void Ein_Schritt_steht_am_Medium_und_die_Wirkung_bleibt_aus()
    {
        var w = new World(); w.Workflow(["media"]);
        var m = w.Medium();
        Assert.Equal("draft", w.Wf.StateOf(m, w.Wf.All["bild"]));
        var o = Commands.WorkflowStepMedium(w.Ctx("editor"), m, "bild", "release", null);
        Assert.Null(o.Error);
        Assert.Equal(m, o.Entry!.Stream);                                          // am Medienstrom
        Assert.Equal("ok", w.Wf.StateOf(m, w.Wf.All["bild"]));
        Assert.DoesNotContain(w.J.ReadAfter(0), e => e.Type == Types.ReleaseGranted);   // release:web ist Knotensache
    }

    [Fact]
    public void Rolle_und_Notiz_wie_am_Knoten()
    {
        var w = new World(); w.Workflow(["media"]);
        var m = w.Medium();
        Assert.Contains("darf", Commands.WorkflowStepMedium(w.Ctx("reader"), m, "bild", "release", null).Error);
        Assert.Null(Commands.WorkflowStepMedium(w.Ctx("admin"), m, "bild", "release", null).Error);
        Assert.Contains("Notiz ist Pflicht", Commands.WorkflowStepMedium(w.Ctx("editor"), m, "bild", "back", null).Error);
        Assert.Null(Commands.WorkflowStepMedium(w.Ctx("editor"), m, "bild", "back", "Logo fehlt").Error);
        Assert.Equal("Logo fehlt", w.Wf.Of(m)["bild"].Note);
    }

    [Fact]
    public void Der_Uebergang_muss_zum_Zustand_passen()
    {
        var w = new World(); w.Workflow(["media"]);
        var m = w.Medium();
        Assert.Contains("geht von ok aus", Commands.WorkflowStepMedium(w.Ctx("editor"), m, "bild", "back", "x").Error);
    }

    [Fact]
    public void Ein_zurueckgezogenes_Medium_nimmt_seinen_Zustand_mit()
    {
        var w = new World(); w.Workflow(["media"]);
        var m = w.Medium();
        Commands.WorkflowStepMedium(w.Ctx("editor"), m, "bild", "release", null);
        Assert.NotEmpty(w.Wf.Of(m));
        w.J.Append("t", m, Types.MediaRetired, Types.Serialize(new MediaRetired())); w.Catch();
        Assert.Empty(w.Wf.Of(m));
    }

    [Fact]
    public void Zustaende_fuer_Liste_und_Facette()
    {
        var w = new World(); w.Workflow(["media"]);
        var m = w.Medium();
        var c = new Catalog(w.J); c.Rebuild();
        var st = MediaWorkflowApi.States(c, c.With((_, _, _) => c.Media.All[m]));
        Assert.Equal(("bild", "draft", false), (st[0].Workflow, st[0].State, st[0].Final));
    }
}
