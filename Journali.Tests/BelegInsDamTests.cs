using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Ein erzeugter Beleg (Datenblatt) ist ein reguläres Asset (27.09.2026): Herkunft, Ordner „Belege“, Zuordnung am
/// Knoten — im selben Zug wie der Eintrag an der Version. Bis dahin hing er nur an der Version und erschien am
/// Produkt nicht.
/// </summary>
public class BelegInsDamTests
{
    private sealed class World
    {
        public MemoryJournal J = new(); public ModelCatalog Cat = new(); public Tree Tree = new(); public Relations Rel = new(); public Media Media = new();
        public World() { foreach (var s in Model.Seeds()) J.Append("system", s.Stream, s.Type, s.Payload); Catch(); }
        public void Catch() => Projector.CatchUpAll(J, Cat, Tree, Rel, Media);
        public Ctx Ctx => new() { Model = Cat, Tree = Tree, Relations = Rel, Media = Media, Write = (stream, type, payload) => { var e = J.Append("t", stream, type, Types.Serialize(payload)); Catch(); return e; } };
        public string Produkt()
        {
            var g = Commands.CreateGroup(Ctx, null, Labels.Of("Bohrer", "Drills")); Assert.Null(g.Error);
            var o = Commands.CreateProduct(Ctx, g.Entry!.Stream, null); Assert.Null(o.Error);
            return o.Entry!.Stream;
        }
        public Medium Medium(string name, string mime)
        {
            var e = J.Append("t", Ids.Media(), Types.MediaCreated, Types.Serialize(new MediaCreated(Guid.NewGuid().ToString("N"), 10, mime, name)));
            Catch(); return Media.All[e.Stream];
        }
        public string? OrdnerName(Medium m) => m.Folder is { } f ? Media.Folders[f].Name : null;
    }

    [Fact]
    public void Der_Beleg_bekommt_Herkunft_Ordner_und_Zuordnung()
    {
        var w = new World();
        var p = w.Produkt();
        var m = w.Medium("datenblatt.pdf", "application/pdf");
        var hinweise = VersionApi.BelegInsDam(w.Ctx, p, 1, m, "datasheet");
        Assert.Empty(hinweise);

        m = w.Media.All[m.Id];
        Assert.Equal("datasheet", m.Source!.Plugin);
        Assert.Equal($"version:{p}/1", m.Source.Ref);
        Assert.Equal(VersionApi.BelegOrdner, w.OrdnerName(m));
        var r = Assert.Single(w.Rel.From(p));
        Assert.Equal(("document", m.Id), (r.Type, r.To));
    }

    [Fact]
    public void Ein_Bild_wird_als_Bild_zugeordnet()
    {
        var w = new World();
        var p = w.Produkt();
        var m = w.Medium("rendering.png", "image/png");
        VersionApi.BelegInsDam(w.Ctx, p, 1, m, "datasheet");
        Assert.Equal("image", Assert.Single(w.Rel.From(p)).Type);
    }

    /// <summary>Der Ordner wird einmal angelegt; ein zweiter Beleg findet ihn.</summary>
    [Fact]
    public void Der_Ordner_Belege_entsteht_nur_einmal()
    {
        var w = new World();
        var p = w.Produkt();
        VersionApi.BelegInsDam(w.Ctx, p, 1, w.Medium("a.pdf", "application/pdf"), "datasheet");
        VersionApi.BelegInsDam(w.Ctx, p, 2, w.Medium("b.pdf", "application/pdf"), "datasheet");
        Assert.Single(w.Media.SubFolders(null).Where(f => f.Name == VersionApi.BelegOrdner));
    }

    /// <summary>Wer den Beleg schon in einen Ordner gelegt hat, behält ihn dort.</summary>
    [Fact]
    public void Ein_gewaehlter_Ordner_bleibt()
    {
        var w = new World();
        var p = w.Produkt();
        var m = w.Medium("a.pdf", "application/pdf");
        var eigener = Commands.CreateMediaFolder(w.Ctx, "Marketing", null).Entry!.Stream;
        Commands.FileMedium(w.Ctx, m.Id, eigener);
        VersionApi.BelegInsDam(w.Ctx, p, 1, w.Media.All[m.Id], "datasheet");
        Assert.Equal("Marketing", w.OrdnerName(w.Media.All[m.Id]));
    }

    /// <summary>Ein zweiter Lauf zur selben Version: die Zuordnung gibt es schon, und das ist kein Fehler.</summary>
    [Fact]
    public void Eine_bestehende_Zuordnung_ist_kein_Fehler()
    {
        var w = new World();
        var p = w.Produkt();
        var m = w.Medium("a.pdf", "application/pdf");
        Assert.Empty(VersionApi.BelegInsDam(w.Ctx, p, 1, m, "datasheet"));
        Assert.Empty(VersionApi.BelegInsDam(w.Ctx, p, 1, w.Media.All[m.Id], "datasheet"));
        Assert.Single(w.Rel.From(p));
    }

    /// <summary>Herkunft und Zuordnung des Belegs kosten kein Kontingent über das hinaus, was der Beleg ohnehin kostet.</summary>
    [Fact]
    public void Die_Herkunft_zaehlt_nicht_die_Zuordnung_schon()
    {
        Assert.Equal(Kinds.Ops, Kinds.Of(Types.MediaSourced));
        Assert.Equal(Kinds.Data, Kinds.Of(Types.RelationCreated));   // eine Zuordnung ist Pflege — wie von Hand
    }
}
