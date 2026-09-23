using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Status als Vokabular im Modell (Taloan, 22.09.2026): frei benennbar, je Sprache; SetStatus nimmt nur, was das Modell kennt;
// die Saat bringt draft/active/discontinued, zurückgezogene sät sie nicht wieder.
public class StatusTests
{
    private sealed class World
    {
        public MemoryJournal J = new(); public ModelCatalog Model = new(); public Tree Tree = new(); public Relations Relations = new(); public Media Media = new();
        public string G = Ids.New(Roles.Group), P = Ids.New(Roles.Product);
        public World()
        {
            foreach (var s in Journali.Core.Entries.Model.Seeds()) J.Append("system", s.Stream, s.Type, s.Payload);
            J.Append("t", G, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("G", "G"))));
            J.Append("t", P, Types.ProductCreated, Types.Serialize(new ProductCreated(G)));
            Catch();
        }
        public void Catch() { Projector.CatchUp(J, Model); Projector.CatchUp(J, Tree); Projector.CatchUp(J, Relations); Projector.CatchUp(J, Media); }
        public Ctx Ctx => new() { Model = Model, Tree = Tree, Relations = Relations, Media = Media, Write = (s, ty, pl) => { var e = J.Append("t", s, ty, Types.Serialize(pl)); Catch(); return e; } };
    }

    [Fact]
    public void Saat_bringt_die_drei_Status_in_Reihenfolge()
    {
        var w = new World();
        Assert.Equal(["draft", "active", "discontinued"], w.Model.StatusesOrdered.Select(s => s.Key).ToArray());
        Assert.Equal("Entwurf", w.Model.Statuses["draft"].Label["de"]);
    }

    [Fact]
    public void SetStatus_nimmt_nur_Status_des_Modells_und_neue_kommen_per_StatusDefined()
    {
        var w = new World();
        var bad = Commands.SetStatus(w.Ctx, w.P, "review");
        Assert.NotNull(bad.Error); Assert.Contains("draft, active, discontinued", bad.Error);
        // Taloans Beispiel: SAP 300 → Überprüfung, 501 → Verkauf weltweit
        w.J.Append("t", Journali.Core.Entries.Model.StatusStream + "review", Types.StatusDefined, Types.Serialize(new StatusDefinition("review", Labels.Of("Überprüfung", "Review"), "warn", "◐", 15)));
        w.J.Append("t", Journali.Core.Entries.Model.StatusStream + "sale_world", Types.StatusDefined, Types.Serialize(new StatusDefinition("sale_world", Labels.Of("Verkauf weltweit", "Sale worldwide"), "pos", "●", 25)));
        w.Catch();
        Assert.Equal(["draft", "review", "active", "sale_world", "discontinued"], w.Model.StatusesOrdered.Select(s => s.Key).ToArray());
        Assert.Null(Commands.SetStatus(w.Ctx, w.P, "review").Error);
        Assert.Equal("review", w.Tree.Nodes[w.P].Status);
        Assert.Null(Commands.SetStatus(w.Ctx, w.G, "review").Error);   // auch eine Gruppe darf einen tragen (23.09.2026)
    }

    [Fact]
    public void Zurueckgezogener_Status_verschwindet_aus_dem_Modell_bleibt_aber_bekannt()
    {
        var w = new World();
        w.J.Append("t", Journali.Core.Entries.Model.StatusStream + "discontinued", Types.StatusRetired, Types.Serialize(new StatusRetired("discontinued")));
        w.Catch();
        Assert.False(w.Model.Statuses.ContainsKey("discontinued"));
        Assert.Contains("discontinued", w.Model.StatusEver);   // SeedMissing sät ihn nicht wieder
        Assert.NotNull(Commands.SetStatus(w.Ctx, w.P, "discontinued").Error);
    }

    // Status an der Gruppe (Taloan, 23.09.2026: „neue Produktgruppe, Markteinführung: redaktionell kann alles freigegeben
    // sein, vorbereitet, trotzdem noch kein Verkaufsstart“). Er gilt für die Gruppe selbst und vererbt sich nicht —
    // „der Status ist kein Workflow-Kriterium, sondern lediglich ein Attribut, das wir weitergeben“ (Taloan).
    [Fact]
    public void Eine_Gruppe_hat_erst_einen_Status_wenn_jemand_ihn_setzt()
    {
        var w = new World();
        var g = w.Tree.Nodes[w.G];
        Assert.False(g.HasStatus);
        Assert.Equal(Statuses.Draft, g.Status);   // vorbelegt, nicht gesetzt: die Oberfläche zeigt „–“
        Assert.True(w.Tree.Nodes[w.P].HasStatus, "ein Produkt hat immer einen");

        Assert.Null(Commands.SetStatus(w.Ctx, w.G, "active").Error);
        Assert.True(w.Tree.Nodes[w.G].HasStatus);
        Assert.Equal("active", w.Tree.Nodes[w.G].Status);
    }

    [Fact]
    public void Der_Status_der_Gruppe_faerbt_nicht_auf_die_Produkte_ab()
    {
        var w = new World();
        Assert.Null(Commands.SetStatus(w.Ctx, w.G, "discontinued").Error);
        Assert.Equal(Statuses.Draft, w.Tree.Nodes[w.P].Status);          // das Produkt bleibt, wo es war
        Assert.Null(Commands.SetStatus(w.Ctx, w.P, "active").Error);     // und darf woanders stehen als seine Gruppe
        Assert.Equal("discontinued", w.Tree.Nodes[w.G].Status);
        Assert.Equal("active", w.Tree.Nodes[w.P].Status);
    }
}
