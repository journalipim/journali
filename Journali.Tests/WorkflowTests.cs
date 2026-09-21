using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Workflows (27, Taloan 21.09.2026): Zustände und Übergänge aus dem Journal, Schritt nur vom richtigen Zustand, Rolle, Notiz-Pflicht,
// Wirkungen (release/status), Aufgaben, Suche wf:.
public class WorkflowTests
{
    private sealed class World
    {
        public MemoryJournal J = new(); public Catalog C; public string Product, Variant;
        public World()
        {
            C = new Catalog(J); C.Rebuild(); C.SeedMissing();
            string g = "", p = "", v = "";
            C.With((_, _, write) =>
            {
                g = write("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("G", "G")), null).Stream;
                p = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(g), null).Stream;
                v = write("t", Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(p, new()), null).Stream;
                write("t", v, Types.AttributeSet, new AttributeSet("name", "de", null, "V", null), null);
                return 0;
            });
            Product = p; Variant = v;
        }
        public Outcome Run(Func<Ctx, Outcome> cmd, string? role = null) => C.With((model, tree, write) => cmd(new Ctx { Model = model, Tree = tree, Relations = C.Relations, Media = C.Media, Workflows = C.Workflows, Role = role, Write = (s, t, p) => write("t", s, t, p, null) }));
        public string State(string wf, string node) => C.With((_, _, _) => C.Workflows.StateOf(node, C.Workflows.All[wf]));
    }

    [Fact]
    public void Saatgut_Redaktion_Schritte_Rolle_Notiz_und_Wirkung()
    {
        var w = new World();
        Assert.Contains("review", w.C.With((_, _, _) => w.C.Workflows.All.Keys)); Assert.Contains("translation", w.C.With((_, _, _) => w.C.Workflows.All.Keys));
        Assert.Equal("draft", w.State("review", w.Variant));
        // falscher Übergang vom Start
        Assert.NotNull(w.Run(c => Commands.WorkflowStep(c, w.Variant, "review", "approve", null)).Error);
        Assert.Null(w.Run(c => Commands.WorkflowStep(c, w.Variant, "review", "submit", null)).Error);
        Assert.Equal("review", w.State("review", w.Variant));
        // Korrekturschleife: Notiz Pflicht
        Assert.Contains("Notiz", w.Run(c => Commands.WorkflowStep(c, w.Variant, "review", "reject", "  ")).Error);
        Assert.Null(w.Run(c => Commands.WorkflowStep(c, w.Variant, "review", "reject", "Bild fehlt")).Error);
        Assert.Equal("rework", w.State("review", w.Variant));
        Assert.Equal("Bild fehlt", w.C.With((_, _, _) => w.C.Workflows.Of(w.Variant)["review"].Note));
        Assert.Null(w.Run(c => Commands.WorkflowStep(c, w.Variant, "review", "resubmit", null)).Error);
        // freigeben dürfen nur admin (Saatgut): editor nein, admin ja, offen (ohne Benutzer) ja
        Assert.Contains("darf", w.Run(c => Commands.WorkflowStep(c, w.Variant, "review", "approve", null), role: "editor").Error);
        Assert.Null(w.Run(c => Commands.WorkflowStep(c, w.Variant, "review", "approve", null), role: "admin").Error);
        Assert.Equal("approved", w.State("review", w.Variant));
        // eigener Workflow mit Wirkungen: freigeben setzt Freigabe web und Status aktiv
        var def = new WorkflowDefined(Labels.Of("Shop", "Shop"), [new("open", Labels.Of("offen", "open")), new("live", Labels.Of("live", "live"), null, true)],
            [new("go", "open", "live", Labels.Of("live schalten", "go live"), null, false, ["release:web", "status:active"])], "open", ["variant"]);
        Assert.Null(w.Run(c => Commands.DefineWorkflow(c, "shop", def)).Error);
        Assert.NotNull(w.Run(c => Commands.WorkflowStep(c, w.Product, "shop", "go", null)).Error);   // gilt nur für Varianten
        Assert.Null(w.Run(c => Commands.WorkflowStep(c, w.Variant, "shop", "go", null)).Error);
        w.C.With((_, tree, _) => { var n = tree.Nodes[w.Variant]; Assert.Equal(Statuses.Active, n.Status); Assert.Contains(n.Releases, r => r.Channel == "web"); return 0; });
        // Suche wf:
        var hits = w.C.With((model, tree, _) => tree.Query(model, "wf:shop=live", w.C.Relations, w.C.Media, w.C.Workflows).Select(h => h.Node.Id).ToList());
        Assert.Equal([w.Variant], hits);
        Assert.Empty(w.C.With((model, tree, _) => tree.Query(model, "wf:rework", w.C.Relations, w.C.Media, w.C.Workflows).ToList()));
        // ungültige Definition
        Assert.NotNull(w.Run(c => Commands.DefineWorkflow(c, "bad", def with { Transitions = [new("x", "open", "nirgends", Labels.Of("x", "x"))] })).Error);
        Assert.NotNull(w.Run(c => Commands.DefineWorkflow(c, "bad", def with { Transitions = [new("x", "open", "live", Labels.Of("x", "x"), null, false, ["explode:now"])] })).Error);
    }
}
