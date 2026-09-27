using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Vektoren (27.09.2026, pflegestruktur 35): was ohne Datenbank und ohne Modell zu prüfen ist — die Verschneidung
/// zweier Reihen, die Schreibweise für pgvector, der Text eines Knotens und sein Hash, die offene Postenliste der
/// Knoten, das Protokoll zum vorgehaltenen Prozess, die Frage an die KI, und dass embed ein Systemjob ist.
/// </summary>
public class VektorenTests
{
    [Fact]
    public void Rrf_stellt_nach_vorn_was_in_beiden_Reihen_vorn_steht()
    {
        var a = new[] { ("m1", 0), ("m2", 0), ("m3", 1) };
        var b = new[] { ("m2", 0), ("m4", 0), ("m1", 0) };
        var r = SemanticApi.Rrf(a, b);
        Assert.Equal(("m2", 0), r[0].Key);   // Platz 2 und Platz 1
        Assert.Equal(("m1", 0), r[1].Key);   // Platz 1 und Platz 3
        Assert.Equal(4, r.Count);
        Assert.True(r[0].Score > r[1].Score && r[1].Score > r[2].Score);
    }

    [Fact]
    public void Rrf_mit_leerer_Reihe_laesst_die_Ordnung_wie_sie_ist()
    {
        var a = new[] { ("m1", 0), ("m2", 3), ("m3", 1) };
        Assert.Equal(a, SemanticApi.Rrf(a, []).Select(x => x.Key));
        Assert.Equal(a, SemanticApi.Rrf([], a).Select(x => x.Key));
    }

    [Fact]
    public void Die_Schreibweise_fuer_pgvector_hat_Punkt_und_Klammern()
    {
        var alt = System.Globalization.CultureInfo.CurrentCulture;
        System.Globalization.CultureInfo.CurrentCulture = new System.Globalization.CultureInfo("de-DE");
        try { Assert.Equal("[0.5,-1,0.25]", Vectors.Literal([0.5f, -1f, 0.25f])); }
        finally { System.Globalization.CultureInfo.CurrentCulture = alt; }
        Assert.Equal("Titel\nText", Vectors.Passage("Titel", "Text"));
        Assert.Equal("Text", Vectors.Passage(null, "Text"));
    }

    [Fact]
    public void Der_Text_eines_Knotens_nennt_Name_Rolle_Pfad_und_Werte_mit_Bezeichnung_und_Einheit()
    {
        var j = new MemoryJournal();
        foreach (var s in Model.Seeds()) j.Append("system", s.Stream, s.Type, s.Payload);
        foreach (var s in Model.TreeSeeds()) j.Append("system", s.Stream, s.Type, s.Payload);
        j.Append("t", Model.RootNode, Types.AttributeSet, Types.Serialize(new AttributeSet("weight", null, null, "1.2")));
        j.Append("t", Model.RootNode, Types.AttributeSet, Types.Serialize(new AttributeSet("color", null, null, "blue")));
        j.Append("t", Model.RootNode, Types.AttributeSet, Types.Serialize(new AttributeSet("description", "de", null, "<p>Ein <b>Klebstoff</b> für Holz.</p>")));
        var model = new ModelCatalog(); var tree = new Tree();
        Projector.CatchUpAll(j, model, tree);
        var text = NodeText.Of(model, tree, tree.Nodes[Model.RootNode], "de");
        Assert.StartsWith("MasterTree\nProduktgruppe\n", text);
        Assert.Contains("Gewicht: 1.2 kg", text);
        Assert.Contains("Farbe: Blau", text);                       // der Listenwert als Bezeichnung
        Assert.Contains("Beschreibung: Ein Klebstoff für Holz.", text);   // HTML ohne Tags
        Assert.DoesNotContain("<", text);
        // der Hash ändert sich mit dem Text, und nur mit ihm
        Assert.Equal(NodeText.Hash(text), NodeText.Hash(text));
        Assert.NotEqual(NodeText.Hash(text), NodeText.Hash(text + "x"));
        Assert.Equal(16, NodeText.Hash(text).Length);
    }

    [Fact]
    public void Offen_sind_Knoten_ohne_Vektor_oder_mit_anderem_Hash_weg_sind_die_ohne_Knoten()
    {
        var texte = new List<SemanticApi.KnotenText> { new("p1", "de", "aaa", "x"), new("p2", "de", "bbb", "y"), new("p3", "de", "ccc", "z") };
        var known = new Dictionary<(string, string), string> { [("p1", "de")] = "aaa", [("p2", "de")] = "alt", [("p9", "de")] = "weg" };
        Assert.Equal(["p2", "p3"], SemanticApi.PendingNodes(texte, known).Select(t => t.Node));
        Assert.Equal(["p9"], SemanticApi.GoneNodes(texte, known));
    }

    [Fact]
    public void Das_Protokoll_zum_Einbetter_ist_eine_Zeile_JSON_hin_und_zurueck()
    {
        Assert.Equal("""{"text":"Klebstoff","kind":"query"}""", Embedder.Request("Klebstoff", "query"));
        var r = Embedder.Parse("""{"model":"m","dims":3,"vector":[0.1,0.2,0.3]}""")!;
        Assert.Equal("m", r.Model); Assert.Equal(3, r.Vector!.Length); Assert.Null(r.Error);
        Assert.Equal("kaputt", Embedder.Parse("""{"error":"kaputt"}""")!.Error);
        Assert.Null(Embedder.Parse(""));
    }

    [Fact]
    public void Die_Frage_an_die_KI_nummeriert_die_Auszuege_mit_Dokument_und_Seite()
    {
        var auszuege = new List<SemanticApi.Auszug> { new("m1", 0, 4, "Technische Daten", "Viskosität 3500 mPas"), new("m2", 2, null, null, "Offene Zeit 20 Minuten") };
        var (system, user) = SemanticApi.Prompt("Wie zäh ist der Klebstoff?", auszuege, new Dictionary<string, string> { ["m1"] = "datenblatt.pdf" });
        Assert.Contains("[1] datenblatt.pdf, Seite 4, Technische Daten:\nViskosität 3500 mPas", user);
        Assert.Contains("[2] m2:\nOffene Zeit 20 Minuten", user);
        Assert.StartsWith("Frage: Wie zäh ist der Klebstoff?", user);
        Assert.Contains("ausschliesslich aus den nummerierten Auszügen", system);
    }

    [Fact]
    public void Embed_ist_ein_Systemjob_und_in_jedem_Tarif_erlaubt()
    {
        Assert.Contains("embed", Tarife.Systemjobs);
        Assert.True(Tarife.Free.Erlaubt("embed"));
    }
}
