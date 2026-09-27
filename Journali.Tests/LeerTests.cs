using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Einen geerbten Wert mit nichts überschreiben (27.09.2026): der ganze Weg, wie ihn die Oberfläche geht —
// Commands.ClearAttribute schreibt AttributeCleared, das Abbild macht daraus einen eigenen leeren Wert, und der bricht
// die Vererbung. Zurück führt derselbe Weg wie bisher: ein leerer AttributeSet.
public class LeerTests
{
    private sealed class Welt
    {
        public readonly MemoryJournal J = new();
        public readonly Catalog C;
        public readonly string Produkt, Variante;

        public Welt()
        {
            C = new Catalog(J); C.Rebuild(); C.SeedMissing();
            string g = "", p = "", v = "";
            C.With((_, _, write) =>
            {
                write("t", Model.AttributeStream + "hinweis", Types.AttributeDefined,
                    new AttributeDefinition("hinweis", Labels.Of("Hinweis", "Note"), AttributeTypes.Text, Group: "mastergroup", Inheritable: true), null);
                write("t", Model.AttributeStream + "maerkte", Types.AttributeDefined,
                    new AttributeDefinition("maerkte", Labels.Of("Märkte", "Markets"), AttributeTypes.Text, Group: "mastergroup", Inheritable: true, Multiple: true), null);
                g = write("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("G", "G")), null).Stream;
                p = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(g), null).Stream;
                v = write("t", Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(p, new()), null).Stream;
                return 0;
            });
            Produkt = p; Variante = v;
            var att = Run(c => Commands.AttachGroups(c, g, ["mastergroup"]));
            if (att.Error is not null) throw new Exception(att.Error);
        }

        public Ctx Ctx(ModelCatalog model, Tree tree, Catalog.Writer write) =>
            new() { Model = model, Tree = tree, Relations = C.Relations, Media = C.Media, Workflows = C.Workflows, Write = (s, t, p) => write("t", s, t, p, null) };
        public Outcome Run(Func<Ctx, Outcome> cmd) => C.With((model, tree, write) => cmd(Ctx(model, tree, write)));
        public Outcome Setze(string node, string attr, string? wert) => Run(c => Commands.SetAttribute(c, node, attr, null, null, wert, null, null));
        public Outcome SetzeListe(string node, string attr, string[]? werte) => Run(c => Commands.SetAttribute(c, node, attr, null, null, null, werte, null));
        public Outcome Leere(string node, string attr) => Run(c => Commands.ClearAttribute(c, node, attr, null, null));
        /// <summary>Was am Knoten gilt und woher — genau das zeigt die Zelle.</summary>
        public (string? Wert, string? Von) Gilt(string node, string attr) =>
            C.Lesen((model, tree) => { var (v, from) = tree.Resolve(model, tree.Nodes[node], attr, null, null); return (v, from?.Id); });
    }

    [Fact]
    public void Ein_geerbter_Wert_laesst_sich_mit_nichts_ueberschreiben()
    {
        var w = new Welt();
        Assert.Null(w.Setze(w.Produkt, "hinweis", "gilt für alle").Error);
        Assert.Equal(("gilt für alle", w.Produkt), w.Gilt(w.Variante, "hinweis"));

        // das tut die Zelle, wenn man sie leert und oben etwas steht
        Assert.Null(w.Leere(w.Variante, "hinweis").Error);
        Assert.Equal(("", w.Variante), w.Gilt(w.Variante, "hinweis"));

        // und das tut das ↓ an der Attributzeile: eigener Wert weg, der geerbte gilt wieder
        Assert.Null(w.Setze(w.Variante, "hinweis", "").Error);
        Assert.Equal(("gilt für alle", w.Produkt), w.Gilt(w.Variante, "hinweis"));
    }

    [Fact]
    public void Ein_eigener_Wert_hebt_das_Leere_auf_und_umgekehrt()
    {
        var w = new Welt();
        w.Setze(w.Produkt, "hinweis", "oben");
        w.Leere(w.Variante, "hinweis");
        Assert.Equal("", w.Gilt(w.Variante, "hinweis").Wert);

        Assert.Null(w.Setze(w.Variante, "hinweis", "eigen").Error);
        Assert.Equal(("eigen", w.Variante), w.Gilt(w.Variante, "hinweis"));

        Assert.Null(w.Leere(w.Variante, "hinweis").Error);
        Assert.Equal(("", w.Variante), w.Gilt(w.Variante, "hinweis"));
    }

    /// <summary>Ein mehrfaches Attribut: die Liste kommt von oben, und hier soll keine gelten.</summary>
    [Fact]
    public void Auch_eine_geerbte_Liste_laesst_sich_leeren()
    {
        var w = new Welt();
        Assert.Null(w.SetzeListe(w.Produkt, "maerkte", ["de", "ch"]).Error);
        Assert.Equal(("de, ch", w.Produkt), w.Gilt(w.Variante, "maerkte"));

        Assert.Null(w.Leere(w.Variante, "maerkte").Error);
        Assert.Equal(("", w.Variante), w.Gilt(w.Variante, "maerkte"));

        // eine leere Liste dagegen nimmt den eigenen Stand weg — der geerbte gilt wieder
        Assert.Null(w.SetzeListe(w.Variante, "maerkte", []).Error);
        Assert.Equal(("de, ch", w.Produkt), w.Gilt(w.Variante, "maerkte"));
    }

    /// <summary>Aus dem Journal neu gebaut steht dasselbe da — sonst wäre der Eintrag nur die halbe Wahrheit.</summary>
    [Fact]
    public void Nach_dem_Neuaufbau_gilt_dasselbe()
    {
        var w = new Welt();
        w.Setze(w.Produkt, "hinweis", "oben");
        w.Leere(w.Variante, "hinweis");

        var neu = new Catalog(w.J); neu.Rebuild();
        var (wert, von) = neu.Lesen((model, tree) => { var (v, f) = tree.Resolve(model, tree.Nodes[w.Variante], "hinweis", null, null); return (v, f?.Id); });
        Assert.Equal(("", w.Variante), (wert, von));
    }

    /// <summary>Was nicht geht: ein Attribut, das hier gar nicht gilt — dieselbe Prüfung wie beim Setzen.</summary>
    [Fact]
    public void Ein_Attribut_ausserhalb_seiner_Gruppe_wird_abgewiesen()
    {
        var w = new Welt();
        var o = w.Run(c => Commands.ClearAttribute(c, w.Variante, "gibtsnicht", null, null));
        Assert.Contains("Unbekanntes Attribut", o.Error);
    }
}
