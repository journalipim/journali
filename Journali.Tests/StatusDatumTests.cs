using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Status mit Geltungsdatum (28.09.2026): ein Status gilt ab einem Tag — in der Zukunft (ein Produkt läuft zum
/// Jahreswechsel aus) wie in der Vergangenheit (ein Stand wird nachgetragen). Kein neuer Eintragstyp, keine Uhr im
/// Journal: <see cref="StatusSet"/> trägt den Tag, das Abbild rechnet daraus, was heute gilt.
/// </summary>
public class StatusDatumTests
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
        public Node Produkt => Tree.Nodes[P];
    }
    private static readonly DateOnly Heute = DateOnly.FromDateTime(DateTime.UtcNow);
    private static string Tag(int tage) => Heute.AddDays(tage).ToString("yyyy-MM-dd");

    [Fact]
    public void Ohne_Datum_gilt_der_Status_sofort()
    {
        var w = new World();
        Assert.Null(Commands.SetStatus(w.Ctx, w.P, "active").Error);
        Assert.Equal("active", w.Produkt.Status);
        Assert.Null(w.Produkt.StatusAb);      // niemand hat einen Tag gewählt — dann steht auch keiner da
        Assert.Null(w.Produkt.StatusGeplant);
    }

    [Fact]
    public void Ein_Status_in_der_Zukunft_gilt_noch_nicht_steht_aber_fest()
    {
        var w = new World();
        Commands.SetStatus(w.Ctx, w.P, "active");
        Assert.Null(Commands.SetStatus(w.Ctx, w.P, "discontinued", Tag(95)).Error);

        Assert.Equal("active", w.Produkt.Status);
        var geplant = w.Produkt.StatusGeplant;
        Assert.NotNull(geplant);
        Assert.Equal("discontinued", geplant!.Value.Status);
        Assert.Equal(Heute.AddDays(95), geplant.Value.Ab);
        // und am Stichtag gilt er
        Assert.Equal("discontinued", w.Produkt.StatusAm(Heute.AddDays(95)));
        Assert.Equal("active", w.Produkt.StatusAm(Heute.AddDays(94)));
    }

    [Fact]
    public void Ein_nachgetragener_Stand_gilt_ab_seinem_Tag_rueckwaerts()
    {
        var w = new World();
        Assert.Null(Commands.SetStatus(w.Ctx, w.P, "active", Tag(-400)).Error);
        Assert.Equal("active", w.Produkt.Status);
        Assert.Equal(Heute.AddDays(-400), w.Produkt.StatusAb);
        Assert.Equal("draft", w.Produkt.StatusAm(Heute.AddDays(-401)));   // davor gab es ihn nicht
    }

    [Fact]
    public void Ein_heute_gesetzter_Status_hebt_einen_Plan_fuer_naechstes_Jahr_nicht_auf()
    {
        // Die Stufen stehen nach ihrem Tag, nicht nach der Reihenfolge der Einträge: wer morgens das Auslaufen zum
        // Jahreswechsel einträgt und mittags „aktiv“ setzt, hat den Plan nicht gelöscht
        var w = new World();
        Commands.SetStatus(w.Ctx, w.P, "discontinued", Tag(95));
        Commands.SetStatus(w.Ctx, w.P, "active");

        Assert.Equal("active", w.Produkt.Status);
        Assert.Equal("discontinued", w.Produkt.StatusAm(Heute.AddDays(95)));
        Assert.Equal("discontinued", w.Produkt.StatusGeplant?.Status);
    }

    [Fact]
    public void Am_selben_Tag_gilt_der_juengere_Eintrag()
    {
        var w = new World();
        Commands.SetStatus(w.Ctx, w.P, "discontinued", Tag(30));
        Commands.SetStatus(w.Ctx, w.P, "active", Tag(30));
        Assert.Equal("active", w.Produkt.StatusAm(Heute.AddDays(30)));
    }

    [Fact]
    public void Mehrere_Stufen_bilden_einen_Lebenslauf()
    {
        var w = new World();
        Commands.SetStatus(w.Ctx, w.P, "draft", Tag(-200));
        Commands.SetStatus(w.Ctx, w.P, "active", Tag(-100));
        Commands.SetStatus(w.Ctx, w.P, "discontinued", Tag(200));

        Assert.Equal("draft", w.Produkt.StatusAm(Heute.AddDays(-150)));
        Assert.Equal("active", w.Produkt.StatusAm(Heute.AddDays(-50)));
        Assert.Equal("active", w.Produkt.Status);
        Assert.Equal("discontinued", w.Produkt.StatusAm(Heute.AddDays(300)));
        Assert.Equal(3, w.Produkt.StatusStufen.Count);
    }

    [Fact]
    public void Ein_unmoegliches_Datum_wird_abgewiesen()
    {
        var w = new World();
        var bad = Commands.SetStatus(w.Ctx, w.P, "active", "31.13.2026");
        Assert.NotNull(bad.Error);
        Assert.Equal("draft", w.Produkt.Status);
    }

    [Fact]
    public void Eine_Gruppe_hat_erst_einen_Status_wenn_er_gilt()
    {
        // Eine Gruppe, die niemand angefasst hat, ist kein Entwurf — sie hat schlicht keinen. Das bleibt so,
        // wenn ihr erster Status erst nächstes Jahr gilt
        var w = new World();
        Assert.False(w.Tree.Nodes[w.G].HasStatus);
        Commands.SetStatus(w.Ctx, w.G, "active", Tag(60));
        Assert.False(w.Tree.Nodes[w.G].HasStatus);
        Assert.Equal("active", w.Tree.Nodes[w.G].StatusAm(Heute.AddDays(60)));
    }

    [Fact]
    public void Zuruecknehmen_raeumt_auch_die_Stufe_in_der_Zukunft_weg()
    {
        // Ein Rückgängig, das nur „aktiv ab heute“ schriebe, liesse das Auslaufen zum Jahreswechsel stehen —
        // es gilt ja erst dann. Darum bekommt derselbe Tag zurück, was dort ohne den Eintrag gegolten hätte
        var w = new World();
        Commands.SetStatus(w.Ctx, w.P, "active");
        Commands.SetStatus(w.Ctx, w.P, "discontinued", Tag(95));

        var plan = Undo.LetzterAmKnoten(w.J, w.Model, w.Tree, w.P);
        Assert.Single(plan.Steps);
        foreach (var step in plan.Steps) w.J.Append("t", step.Stream, step.Kind, step.Payload!);
        w.Catch();

        Assert.Equal("active", w.Produkt.Status);
        Assert.Equal("active", w.Produkt.StatusAm(Heute.AddDays(95)));
        Assert.Null(w.Produkt.StatusGeplant);
    }

    [Fact]
    public void Der_Plan_geht_in_die_Rohdaten_und_kommt_zurueck()
    {
        var w = new World();
        Commands.SetStatus(w.Ctx, w.P, "active");
        Commands.SetStatus(w.Ctx, w.P, "discontinued", Tag(95));

        var roh = TransferApi.Raw(w.Tree, w.Produkt, deep: false);
        Assert.Equal("active", roh.Status);
        var stufe = Assert.Single(roh.StatusPlan!);
        Assert.Equal("discontinued", stufe.Status);
        Assert.Equal(Tag(95), stufe.From);
    }
}
