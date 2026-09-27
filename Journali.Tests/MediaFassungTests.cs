using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Fassungen (27.09.2026): ein Medium bleibt unveränderlich, „dieses ersetzt jenes“ ist ein Eintrag am Vorgänger.
/// Die Zuordnungen wandern mit ihren Werten an den Nachfolger, der Vorgänger bleibt im Abbild — die Ausleitung von
/// damals muss ihn auflösen — und die Bibliothek bietet ihn nicht mehr an.
/// </summary>
public class MediaFassungTests
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
        public string Medium(string name = "bild.png")
        {
            var e = J.Append("t", Ids.Media(), Types.MediaCreated, Types.Serialize(new MediaCreated(Guid.NewGuid().ToString("N"), 10, "image/png", name)));
            Catch(); return e.Stream;
        }
        public string Zuordnung(string knoten, string medium, string? position = null)
        {
            var o = Commands.CreateRelation(Ctx, "image", knoten, medium); Assert.Null(o.Error);
            if (position is not null) Assert.Null(Commands.SetRelationAttribute(Ctx, o.Entry!.Stream, "position", null, null, position, null).Error);
            return o.Entry!.Stream;
        }
        public Outcome Ersetze(string alt, string? neu) => Commands.SupersedeMedium(Ctx, alt, neu);
    }

    [Fact]
    public void Die_Zuordnungen_wandern_mit_ihren_Werten()
    {
        var w = new World();
        var p = w.Produkt();
        var alt = w.Medium("v1.png"); var neu = w.Medium("v2.png");
        var r = w.Zuordnung(p, alt, position: "2");

        Assert.Null(w.Ersetze(alt, neu).Error);

        var jetzt = Assert.Single(w.Rel.From(p));
        Assert.Equal(neu, jetzt.To);
        Assert.NotEqual(r, jetzt.Id);                                     // eine neue Relation, das Ziel einer Relation ändert sich nie
        Assert.Equal("2", jetzt.Own("position", null, null));             // der Wert ist mitgewandert
        Assert.False(w.Rel.All.ContainsKey(r));                           // die alte ist gelöst
    }

    [Fact]
    public void Der_Vorgaenger_bleibt_im_Abbild_aber_nicht_in_der_Bibliothek()
    {
        var w = new World();
        var alt = w.Medium("v1.png"); var neu = w.Medium("v2.png");
        w.Ersetze(alt, neu);

        Assert.True(w.Media.All.ContainsKey(alt));                        // Belege und Versionen lösen ihn weiter auf
        Assert.DoesNotContain(w.Media.Current, m => m.Id == alt);         // die Bibliothek bietet ihn nicht mehr an
        Assert.Contains(w.Media.Current, m => m.Id == neu);
    }

    [Fact]
    public void Die_Abstammung_ist_in_beide_Richtungen_lesbar()
    {
        var w = new World();
        var alt = w.Medium("v1.png"); var neu = w.Medium("v2.png");
        w.Ersetze(alt, neu);

        Assert.Equal(neu, w.Media.All[alt].SupersededBy);
        Assert.Equal(alt, w.Media.All[neu].Supersedes);
        Assert.Equal(alt, w.Media.All[neu].Source!.From);                 // dieselbe Herkunft wie bei einem Zuschnitt
    }

    [Fact]
    public void Nur_einmal_und_nicht_auf_sich_selbst()
    {
        var w = new World();
        var a = w.Medium("a.png"); var b = w.Medium("b.png"); var c = w.Medium("c.png");
        Assert.Contains("nicht selbst", w.Ersetze(a, a).Error);
        Assert.Null(w.Ersetze(a, b).Error);
        Assert.Contains("schon ersetzt", w.Ersetze(a, c).Error);          // a ist vergeben
        Assert.Contains("selbst schon ersetzt", w.Ersetze(c, a).Error);   // a taugt nicht mehr als Nachfolger
        Assert.Null(w.Ersetze(b, c).Error);                               // die Kette a → b → c
        Assert.Equal(c, w.Media.All[b].SupersededBy);
    }

    [Fact]
    public void Ein_unbekannter_Nachfolger_wird_abgewiesen()
    {
        var w = new World();
        var a = w.Medium();
        Assert.Contains("gibt es nicht", w.Ersetze(a, "m-gibtsnicht").Error);
        Assert.Contains("gibt es nicht", w.Ersetze(a, null).Error);
        Assert.True(w.Ersetze("m-weg", a).NotFound);
    }

    /// <summary>Hängt der Nachfolger am Knoten schon, entsteht keine zweite Zuordnung — die alte wird trotzdem gelöst.</summary>
    [Fact]
    public void Eine_bestehende_Zuordnung_am_Nachfolger_bleibt_einfach()
    {
        var w = new World();
        var p = w.Produkt();
        var alt = w.Medium("v1.png"); var neu = w.Medium("v2.png");
        w.Zuordnung(p, alt); w.Zuordnung(p, neu);
        Assert.Null(w.Ersetze(alt, neu).Error);
        var r = Assert.Single(w.Rel.From(p));
        Assert.Equal(neu, r.To);
    }

    /// <summary>Der Neubau aus dem Journal ergibt dasselbe Bild — auch die Rückrichtung am Nachfolger.</summary>
    [Fact]
    public void Nach_dem_Neubau_steht_alles_wieder_da()
    {
        var w = new World();
        var alt = w.Medium("v1.png"); var neu = w.Medium("v2.png");
        w.Ersetze(alt, neu);
        var frisch = new Media();
        Projector.CatchUpAll(w.J, new ModelCatalog(), new Tree(), new Relations(), frisch);
        Assert.Equal(neu, frisch.All[alt].SupersededBy);
        Assert.Equal(alt, frisch.All[neu].Supersedes);
    }

    [Fact]
    public void Ersetzen_ist_Pflege_und_zaehlt()
    {
        Assert.True(Kinds.Billable(null, Types.MediaSuperseded));
        Assert.Equal(Kinds.Data, Kinds.Of(Types.MediaSuperseded));
    }
}
