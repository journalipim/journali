using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Stichwörter am Asset (27.09.2026): ein vermehrbares Attribut der Gruppe <c>media</c>, dessen Werte aus einer
/// Werteliste des Modells kommen — kein Freitext, sonst stehen „Bohrer“, „bohrer“ und „Bohrer “ nebeneinander und
/// keine Facette fasst sie zusammen. Die Liste beginnt leer; neue Werte legt die Zelle an.
/// </summary>
public class MediaStichworteTests
{
    private sealed class World
    {
        public MemoryJournal J = new(); public ModelCatalog Cat = new(); public Tree Tree = new(); public Relations Rel = new(); public Media Media = new();
        public World() { foreach (var s in Model.Seeds()) J.Append("system", s.Stream, s.Type, s.Payload); Catch(); }
        public void Catch() => Projector.CatchUpAll(J, Cat, Tree, Rel, Media);
        public Outcome Run(Func<Ctx, Outcome> cmd) => cmd(new Ctx
        {
            Model = Cat, Tree = Tree, Relations = Rel, Media = Media,
            Write = (stream, type, payload) => { var e = J.Append("t", stream, type, Types.Serialize(payload)); Catch(); return e; },
        });
        public string Medium(string name = "bild.png")
        {
            var e = J.Append("t", Ids.Media(), Types.MediaCreated, Types.Serialize(new MediaCreated(Guid.NewGuid().ToString("N"), 10, "image/png", name)));
            Catch(); return e.Stream;
        }
        public string[] Stichworte(string medium) =>
            Media.All[medium].Lists.Where(kv => kv.Key.Attribute == Model.KeywordAttribute).SelectMany(kv => kv.Value).ToArray();
        public Outcome Setze(string medium, params string[] werte) =>
            Run(c => Commands.SetMediumAttribute(c, medium, Model.KeywordAttribute, null, null, null, werte));
        /// <summary>Ein Stichwort in die Werteliste — das tut in der Oberfläche „+ neuer Wert …“ in der Zelle.</summary>
        public void Wort(string wert, string de)
        {
            J.Append("t", Model.ListStream + Model.KeywordList, Types.ListValueDefined,
                Types.Serialize(new ListValueDefinition(wert, Labels.Of(de, de))));
            Catch();
        }
    }

    [Fact]
    public void Das_Saatgut_bringt_Liste_und_Attribut_mit()
    {
        var w = new World();
        var def = w.Cat.Attributes[Model.KeywordAttribute];
        Assert.Equal(Model.MediaGroup, def.Group);
        Assert.Equal(AttributeTypes.Enum, def.Type);
        Assert.Equal(Model.KeywordList, def.List);
        Assert.True(def.Multiple);
        // Die Stichwörter sind die des Kunden, nicht unsere — bis auf eines: „Text erkennen“ stellt ein Bild zur Texterkennung (34 J)
        Assert.Equal(new[] { Model.OcrKeyword }, w.Cat.Lists[Model.KeywordList].Values.Keys.ToArray());
    }

    [Fact]
    public void Mehrere_Stichwoerter_stehen_am_Medium()
    {
        var w = new World();
        var m = w.Medium();
        Assert.Empty(w.Stichworte(m));
        w.Wort("bohrer", "Bohrer"); w.Wort("metall", "Metall");
        Assert.Null(w.Setze(m, "bohrer", "metall").Error);
        Assert.Equal(["bohrer", "metall"], w.Stichworte(m));
    }

    /// <summary>Eine leere Liste löscht — wie bei jedem vermehrbaren Attribut.</summary>
    [Fact]
    public void Eine_leere_Liste_nimmt_die_Stichwoerter_weg()
    {
        var w = new World();
        var m = w.Medium();
        w.Wort("bohrer", "Bohrer");
        w.Setze(m, "bohrer");
        Assert.Null(w.Setze(m).Error);
        Assert.Empty(w.Stichworte(m));
    }

    /// <summary>Setzen ersetzt, es ergänzt nicht — das Zufügen macht die Oberfläche, indem sie die ganze Liste schickt.</summary>
    [Fact]
    public void Setzen_ersetzt_die_Liste()
    {
        var w = new World();
        var m = w.Medium();
        w.Wort("bohrer", "Bohrer"); w.Wort("metall", "Metall"); w.Wort("zubehoer", "Zubehör");
        w.Setze(m, "bohrer", "metall");
        w.Setze(m, "zubehoer");
        Assert.Equal(["zubehoer"], w.Stichworte(m));
    }

    /// <summary>
    /// Ein Stichwort, das nicht in der Werteliste steht, wird abgewiesen. Das ist der Sinn der Liste: sonst
    /// stuenden „Bohrer“ und „bohrer“ nebeneinander. Die Zelle legt einen neuen Wert an, bevor sie ihn setzt.
    /// </summary>
    [Fact]
    public void Ein_unbekanntes_Stichwort_wird_abgewiesen()
    {
        var w = new World();
        var m = w.Medium();
        Assert.Contains("Werteliste", w.Setze(m, "bohrer").Error);
        w.Wort("bohrer", "Bohrer");
        Assert.Null(w.Setze(m, "bohrer").Error);
    }

    /// <summary>Stichwörter sind Pflege und zählen darum gegen das Kontingent — anders als Mass und Herkunft.</summary>
    [Fact]
    public void Stichwoerter_zaehlen_als_Pflege()
    {
        Assert.True(Kinds.Billable(null, Types.AttributeSet));
        Assert.Equal(Kinds.Data, Kinds.Of(Types.AttributeSet));
    }

    /// <summary>Ein Attribut, das nicht zur Gruppe media gehört, steht nicht am Medium.</summary>
    [Fact]
    public void Ein_fremdes_Attribut_geht_nicht_an_ein_Medium()
    {
        var w = new World();
        var m = w.Medium();
        var o = w.Run(c => Commands.SetMediumAttribute(c, m, "weight", null, null, "3", null));
        Assert.NotNull(o.Error);
    }
}
