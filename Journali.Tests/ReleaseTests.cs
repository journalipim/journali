using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Freigabe über den Workflow (Taloan, 21.09.: „als Web-Redakteur schick ich das zur Freigabe — funzt nicht“): „freigeben“ am Produkt
// gibt jede vollständige Variante für den Kanal frei; unvollständige nennen, was fehlt.
public class ReleaseTests
{
    private sealed class World
    {
        public MemoryJournal J = new(); public ModelCatalog Model = new(); public Tree Tree = new(); public Relations Relations = new(); public Media Media = new();
        public string G = Ids.New(Roles.Group), P = Ids.New(Roles.Product), V1 = Ids.New(Roles.Variant), V2 = Ids.New(Roles.Variant);
        public World()
        {
            foreach (var s in Journali.Core.Entries.Model.Seeds()) J.Append("system", s.Stream, s.Type, s.Payload);
            J.Append("t", G, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("G", "G"))));
            J.Append("t", G, Types.GroupsAttached, Types.Serialize(new GroupsAttached(["mastergroup", "logistics"])));   // name (web: alle Sprachen) und sku sind Pflicht
            J.Append("t", P, Types.ProductCreated, Types.Serialize(new ProductCreated(G)));
            J.Append("t", V1, Types.VariantCreated, Types.Serialize(new VariantCreated(P, new())));
            J.Append("t", V2, Types.VariantCreated, Types.Serialize(new VariantCreated(P, new())));
            Catch();
        }
        public void Catch() { Projector.CatchUp(J, Model); Projector.CatchUp(J, Tree); Projector.CatchUp(J, Relations); Projector.CatchUp(J, Media); }
        public Ctx Ctx => new() { Model = Model, Tree = Tree, Relations = Relations, Media = Media, Write = (s, ty, pl) => { var e = J.Append("t", s, ty, Types.Serialize(pl)); Catch(); return e; } };
        public void Fill(string v) { foreach (var l in Model.Locales.Keys) J.Append("t", v, Types.AttributeSet, Types.Serialize(new AttributeSet("name", l, null, "Name " + l))); J.Append("t", v, Types.AttributeSet, Types.Serialize(new AttributeSet("sku", null, null, "S-" + v[^4..]))); Catch(); }
    }

    [Fact]
    public void Freigabe_am_Produkt_gibt_die_vollstaendigen_Varianten_frei_und_nennt_die_anderen()
    {
        var w = new World();
        var none = Commands.GrantRelease(w.Ctx, w.P, "web", null);
        Assert.NotNull(none.Error); Assert.Contains("Keine Variante freigegeben", none.Error);
        w.Fill(w.V1);
        var one = Commands.GrantRelease(w.Ctx, w.P, "web", null);
        Assert.Null(one.Error);
        Assert.Contains(new Release("web", null), w.Tree.Nodes[w.V1].Releases);
        Assert.DoesNotContain(new Release("web", null), w.Tree.Nodes[w.V2].Releases);
        // noch einmal: nichts Neues, V2 weiter unvollständig
        var again = Commands.GrantRelease(w.Ctx, w.P, "web", null);
        Assert.NotNull(again.Error); Assert.Contains("Unvollständig", again.Error);
    }

    [Fact]
    public void Eskalation_nach_n_Tagen_duerfen_auch_andere_Rollen()
    {
        // Taloan, 21.09.: „alle Redakteure im Urlaub — jemand muss freigeben“: freigeben darf admin; nach 3 Tagen in Prüfung auch manager
        var t = new WfTransition("approve", "review", "approved", Labels.Of("freigeben", "Approve"), ["admin"], false, ["release:web"], 3, ["manager"]);
        var since = new DateTimeOffset(2026, 9, 21, 0, 0, 0, TimeSpan.Zero);
        Assert.False(Commands.Escalated(t, "manager", since, since.AddDays(2)));
        Assert.True(Commands.Escalated(t, "manager", since, since.AddDays(3)));
        Assert.False(Commands.Escalated(t, "editor", since, since.AddDays(10)));   // nicht in EscalateRoles
        var any = t with { EscalateRoles = null };
        Assert.True(Commands.Escalated(any, "editor", since, since.AddDays(3)));    // leer = jede Rolle
        Assert.False(Commands.Escalated(t with { EscalateAfterDays = null }, "manager", since, since.AddDays(30)));
    }

    [Fact]
    public void Redaktions_Workflow_freigeben_wirkt_als_Freigabe_fuer_web()
    {
        var seed = Journali.Core.Entries.Model.Seeds().Single(s => s.Stream == Workflows.Stream + "review");
        var def = Types.Deserialize<WorkflowDefined>(seed.Payload);
        Assert.Equal(["release:web"], def.Transitions.Single(t => t.Key == "approve").Effects);
        Assert.Equal(["revoke:web"], def.Transitions.Single(t => t.Key == "reopen").Effects);
    }
}
