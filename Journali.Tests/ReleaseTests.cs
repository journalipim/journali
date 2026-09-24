using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Freigabe über den Workflow: „freigeben“ am Produkt
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
        Assert.NotNull(none.Error); Assert.Contains("Keine Variante konnte freigegeben werden", none.Error);
        w.Fill(w.V1);
        var one = Commands.GrantRelease(w.Ctx, w.P, "web", null);
        Assert.Null(one.Error);
        Assert.Contains(new Release("web", null), w.Tree.Nodes[w.V1].Releases);
        Assert.DoesNotContain(new Release("web", null), w.Tree.Nodes[w.V2].Releases);
        // noch einmal: nichts Neues — V1 ist frei, das zählt („schon freigegeben“, kein Fehler für den Workflow)
        var again = Commands.GrantRelease(w.Ctx, w.P, "web", null);
        Assert.NotNull(again.Error); Assert.Contains("schon", again.Error);
    }

    [Fact]
    public void Schritt_mit_Freigabe_bleibt_aus_wenn_keine_Variante_vollstaendig_ist()
    {
        // „Schritt gegangen, Wirkung nicht“ ist kein Zustand — freigeben ohne vollständige Variante → der Knoten bleibt in Prüfung
        var w = new World(); var wfs = new Workflows(); Projector.CatchUp(w.J, wfs);
        var ctx = () => new Ctx { Model = w.Model, Tree = w.Tree, Relations = w.Relations, Media = w.Media, Workflows = wfs, Write = (s, ty, pl) => { var e = w.J.Append("t", s, ty, Types.Serialize(pl)); w.Catch(); Projector.CatchUp(w.J, wfs); return e; } };
        Assert.Null(Commands.WorkflowStep(ctx(), w.P, "review", "submit", null).Error);
        var r = Commands.WorkflowStep(ctx(), w.P, "review", "approve", null);
        Assert.NotNull(r.Error); Assert.Contains("scheitert an", r.Error); Assert.Contains("Name (name) fehlt in → ", r.Error);
        Assert.Equal("review", wfs.StateOf(w.P, wfs.All["review"]));                    // nicht gegangen
        w.Fill(w.V1);
        Assert.Null(Commands.WorkflowStep(ctx(), w.P, "review", "approve", null).Error);
        Assert.Equal("approved", wfs.StateOf(w.P, wfs.All["review"]));
        Assert.Contains(new Release("web", null), w.Tree.Nodes[w.V1].Releases);         // Wirkung eingetreten
    }

    [Fact]
    public void Produktzustand_bleibt_die_Ausleitung_folgt_den_Varianten()
    {
        // „die Produktseite darf nicht raus, wenn keine Variante freigegeben ist — das muss aus den Daten kommen“:
        // der Workflow-Zustand am Produkt bleibt redaktionell, die Ausleitung leitet aus den Varianten ab — ohne Freigabe weg, mit Freigabe wieder da
        var w = new World(); var wfs = new Workflows(); Projector.CatchUp(w.J, wfs);
        var ctx = () => new Ctx { Model = w.Model, Tree = w.Tree, Relations = w.Relations, Media = w.Media, Workflows = wfs, Write = (s, ty, pl) => { var e = w.J.Append("t", s, ty, Types.Serialize(pl)); w.Catch(); Projector.CatchUp(w.J, wfs); return e; } };
        w.Fill(w.V1); w.Fill(w.V2);
        Assert.Null(Commands.WorkflowStep(ctx(), w.P, "review", "submit", null).Error);
        Assert.Null(Commands.WorkflowStep(ctx(), w.P, "review", "approve", null).Error);
        var web = Ids.New(Roles.Rubric); w.J.Append("t", web, Types.RubricCreated, Types.Serialize(new RubricCreated(null, new(), "Web", "web"))); w.J.Append("t", web, Types.NodePlaced, Types.Serialize(new NodePlaced(w.P))); w.Catch();
        bool Out() => Publication.Export(w.Tree, w.Model, w.Tree.Nodes[web]).Single().In;
        Assert.True(Out());
        Assert.Null(Commands.RevokeRelease(ctx(), w.V1, "web", null).Error); Assert.Null(Commands.RevokeRelease(ctx(), w.V2, "web", null).Error);
        Assert.Equal("approved", wfs.StateOf(w.P, wfs.All["review"]));   // Zustand bleibt
        Assert.False(Out());                                               // Seite geht nicht raus
        Assert.Null(Commands.GrantRelease(ctx(), w.V1, "web", null).Error);
        Assert.True(Out());                                                // wieder da — niemand musste am Produkt etwas tun
    }

    [Fact]
    public void Variante_im_eigenen_Weg_gibt_der_Vater_nicht_frei()
    {
        // „ein Produkt mit einer Variante, die nicht freigegeben ist, kann ich auch nicht freigeben“ — Variante in Entwurf (wieder geöffnet):
        // freigeben am Produkt bleibt aus und nennt sie; erst wenn die Variante ihren Weg zu Ende geht, geht das Produkt
        var w = new World(); var wfs = new Workflows(); Projector.CatchUp(w.J, wfs);
        var ctx = () => new Ctx { Model = w.Model, Tree = w.Tree, Relations = w.Relations, Media = w.Media, Workflows = wfs, Write = (s, ty, pl) => { var e = w.J.Append("t", s, ty, Types.Serialize(pl)); w.Catch(); Projector.CatchUp(w.J, wfs); return e; } };
        w.Fill(w.V1); w.Fill(w.V2);
        Assert.Null(Commands.WorkflowStep(ctx(), w.V1, "review", "submit", null).Error);
        Assert.Null(Commands.WorkflowStep(ctx(), w.V1, "review", "approve", null).Error);
        Assert.Null(Commands.WorkflowStep(ctx(), w.V1, "review", "reopen", "xs").Error);      // Variante bewusst zurück, Freigabe weg
        Assert.Null(Commands.WorkflowStep(ctx(), w.V2, "review", "submit", null).Error);      // V2 in Prüfung
        Assert.Null(Commands.WorkflowStep(ctx(), w.P, "review", "submit", null).Error);
        var r = Commands.WorkflowStep(ctx(), w.P, "review", "approve", null);
        Assert.NotNull(r.Error); Assert.Contains("Entwurf", r.Error); Assert.Contains("Prüfung", r.Error);
        Assert.DoesNotContain(new Release("web", null), w.Tree.Nodes[w.V1].Releases);          // nichts überfahren
        Assert.Null(Commands.WorkflowStep(ctx(), w.V2, "review", "approve", null).Error);     // V2 fertig → das Produkt darf
        Assert.Null(Commands.WorkflowStep(ctx(), w.P, "review", "approve", null).Error);
        Assert.DoesNotContain(new Release("web", null), w.Tree.Nodes[w.V1].Releases);          // V1 bleibt, wie der Redakteur sie gelassen hat
    }

    [Fact]
    public void Variante_ohne_eigenen_Schritt_folgt_dem_Produkt()
    {
        // „alle Varianten zeigen Entwurf“, obwohl das Produkt freigegeben ist — ohne eigenen Eintrag gilt der Zustand des Vaters
        var w = new World(); var wfs = new Workflows(); Projector.CatchUp(w.J, wfs);
        var wf = wfs.All["review"]; string? parentOf(string id) => w.Tree.Nodes.GetValueOrDefault(id)?.Parent;
        Assert.Equal(("draft", null), wfs.StateOf(w.V1, wf, parentOf));
        w.J.Append("t", w.P, Types.WorkflowStateSet, Types.Serialize(new WorkflowStateSet("review", "approved", "approve", null))); Projector.CatchUp(w.J, wfs);
        Assert.Equal(("approved", w.P), wfs.StateOf(w.V1, wf, parentOf));           // vom Produkt
        w.J.Append("t", w.V1, Types.WorkflowStateSet, Types.Serialize(new WorkflowStateSet("review", "rework", "reject", "x"))); Projector.CatchUp(w.J, wfs);
        Assert.Equal(("rework", null), wfs.StateOf(w.V1, wf, parentOf));            // eigener Schritt schlägt den Vater
        Assert.Equal(("approved", w.P), wfs.StateOf(w.V2, wf, parentOf));           // die andere folgt weiter
        // eigenen Zustand aufheben → erbt wieder
        w.J.Append("t", w.V1, Types.WorkflowStateSet, Types.Serialize(new WorkflowStateSet("review", null, null, "↑ erbt"))); Projector.CatchUp(w.J, wfs);
        Assert.Null(wfs.Own(w.V1, wf));
        Assert.Equal(("approved", w.P), wfs.StateOf(w.V1, wf, parentOf));
    }

    [Fact]
    public void Eskalation_nach_n_Tagen_duerfen_auch_andere_Rollen()
    {
        // „alle Redakteure im Urlaub — jemand muss freigeben“: freigeben darf admin; nach 3 Tagen in Prüfung auch manager
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
