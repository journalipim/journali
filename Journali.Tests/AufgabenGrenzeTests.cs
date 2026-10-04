using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Aufgaben (04.10.2026): das limit brach nur die Schleife der Sprachen ab, die Knoten liefen weiter, und gekürzt wurde vor dem Ordnen. Jetzt: die ältesten
// zuerst, höchstens limit.
public class AufgabenGrenzeTests
{
    [Fact]
    public void Die_Aufgaben_sind_die_aeltesten_und_hoechstens_limit()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        var varianten = new List<string>();
        c.With((_, _, write) =>
        {
            var g = write("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("G", "G")), null).Stream;
            var p = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(g), null).Stream;
            for (var i = 0; i < 5; i++) varianten.Add(write("t", Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(p, new()), null).Stream);
            return 0;
        });
        Outcome Run(Func<Ctx, Outcome> cmd) => c.With((model, tree, write) => cmd(new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Workflows = c.Workflows, Write = (s, t, pl) => write("t", s, t, pl, null) }));
        var def = new WorkflowDefined(Labels.Of("Prüfen", "Check"), [new("open", Labels.Of("offen", "open")), new("check", Labels.Of("prüfen", "check")), new("done", Labels.Of("fertig", "done"), null, true)],
            [new("submit", "open", "check", Labels.Of("einreichen", "submit")), new("ok", "check", "done", Labels.Of("ok", "ok"))], "open", ["variant"]);
        Assert.Null(Run(x => Commands.DefineWorkflow(x, "pruefen", def)).Error);
        foreach (var v in varianten) Assert.Null(Run(x => Commands.WorkflowStep(x, v, "pruefen", "submit", null)).Error);   // nacheinander: die erste ist die älteste
        var zwei = c.With((model, tree, _) => WorkflowApi.Aufgaben(c, model, tree, null, null, "pruefen", null, 2));
        Assert.Equal(2, zwei.Count);
        var knoten = zwei.Select(o => (string)o.GetType().GetProperty("node")!.GetValue(o)!).ToList();
        Assert.Equal(varianten.Take(2), knoten);
        Assert.Equal(5, c.With((model, tree, _) => WorkflowApi.Aufgaben(c, model, tree, null, null, "pruefen", null, 500)).Count);
    }
}
