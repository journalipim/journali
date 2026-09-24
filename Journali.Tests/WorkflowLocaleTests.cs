using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Workflow je Sprache (docs/pflegestruktur.md 30).
public class WorkflowLocaleTests
{
    private sealed class World
    {
        public Catalog C; public string Variant;
        public World()
        {
            C = new Catalog(new MemoryJournal()); C.Rebuild(); C.SeedMissing();
            string g = "", p = "", v = "";
            C.With((_, _, write) =>
            {
                write("t", Model.LocaleStream + "fr", Types.LocaleDefined, new LocaleDefinition("fr", "Französisch"), null);
                g = write("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("G", "G")), null).Stream;
                p = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(g), null).Stream;
                v = write("t", Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(p, new()), null).Stream;
                write("t", v, Types.AttributeSet, new AttributeSet("name", "de", null, "V", null), null);
                return 0;
            });
            Variant = v;
        }
        public Outcome Run(Func<Ctx, Outcome> cmd, string? role = null) => C.With((model, tree, write) => cmd(new Ctx { Model = model, Tree = tree, Relations = C.Relations, Media = C.Media, Workflows = C.Workflows, Role = role, Write = (s, t, p) => write("t", s, t, p, null) }));
        public string State(string wf, string? locale = null) => C.With((_, _, _) => C.Workflows.StateOf(Variant, C.Workflows.All[wf], locale));
    }

    [Fact]
    public void Der_Uebersetzungsworkflow_laeuft_je_Sprache()
    {
        var w = new World();
        Assert.True(w.C.With((_, _, _) => w.C.Workflows.All["translation"].PerLocale));
        Assert.Null(w.Run(c => Commands.WorkflowStep(c, w.Variant, "translation", "request", null, "fr")).Error);
        Assert.Equal("to_translate", w.State("translation", "fr"));
        Assert.Equal("none", w.State("translation", "en"));      // die anderen Sprachen sind unberührt
        Assert.Equal("none", w.State("translation"));            // und der Knoten selbst auch
        Assert.Null(w.Run(c => Commands.WorkflowStep(c, w.Variant, "translation", "done", null, "fr")).Error);
        Assert.Equal("translated", w.State("translation", "fr"));
        Assert.Contains("fr", w.C.With((_, _, _) => w.C.Workflows.LocalesAt(w.Variant, w.C.Workflows.All["translation"])));
    }

    [Fact]
    public void Ohne_PerLocale_bleibt_alles_wie_bisher()
    {
        var w = new World();
        Assert.False(w.C.With((_, _, _) => w.C.Workflows.All["review"].PerLocale));
        Assert.Contains("nicht je Sprache", w.Run(c => Commands.WorkflowStep(c, w.Variant, "review", "submit", null, "fr")).Error);
        Assert.Null(w.Run(c => Commands.WorkflowStep(c, w.Variant, "review", "submit", null)).Error);
        Assert.Equal("review", w.State("review"));
        Assert.Equal("review", w.State("review", "fr"));   // ein Workflow ohne Sprachen gilt für alle Sprachen gleich
    }

    [Fact]
    public void Die_Wirkung_trifft_nur_diese_Sprache()
    {
        var w = new World();
        // eigener Sprach-Workflow mit Freigabe als Wirkung — die Freigabe gibt es längst je Kanal und Sprache (Tree.Release)
        var def = new WorkflowDefined(Labels.Of("Lokal", "Local"), [new("open", Labels.Of("offen", "open")), new("live", Labels.Of("live", "live"), null, true)],
            [new("go", "open", "live", Labels.Of("freigeben", "release"), null, false, ["release:web"]),
             new("stop", "live", "open", Labels.Of("zurückziehen", "revoke"), null, false, ["revoke:web"])], "open", ["variant"], null, PerLocale: true);
        Assert.Null(w.Run(c => Commands.DefineWorkflow(c, "local", def)).Error);
        Assert.Null(w.Run(c => Commands.WorkflowStep(c, w.Variant, "local", "go", null, "fr")).Error);
        w.C.With((_, tree, _) =>
        {
            var n = tree.Nodes[w.Variant];
            Assert.Contains(new Release("web", "fr"), n.Releases);
            Assert.DoesNotContain(new Release("web", "en"), n.Releases);
            Assert.DoesNotContain(new Release("web", null), n.Releases);   // Deutsch geht hinaus, Französisch wartet — und umgekehrt
            return 0;
        });
        Assert.Null(w.Run(c => Commands.WorkflowStep(c, w.Variant, "local", "stop", null, "fr")).Error);
        Assert.DoesNotContain(new Release("web", "fr"), w.C.With((_, tree, _) => tree.Nodes[w.Variant].Releases));
        Assert.NotNull(w.Run(c => Commands.WorkflowStep(c, w.Variant, "local", "go", null, "xx")).Error);   // unbekannte Sprache
    }
}
