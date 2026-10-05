using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Microsoft.AspNetCore.Http;

namespace Journali.Tests;

// Übersetzungsmanagement: Einheiten je Sprachrichtung (fehlend, veraltet, fertig), XLIFF 2.0 hin und zurück.
// Der Rückweg verwirft seit 22.09.2026 nichts mehr — eine überholte
// Übersetzung wird eingespielt und bleibt im Rückstand; die drei Fälle stehen in TranslationOrderTests.
public class TranslateTests
{
    private static (Catalog C, string Product, string Group) World()
    {
        var j = new MemoryJournal(); var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        string g = "", p = "";
        c.With((_, _, write) =>
        {
            g = write("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("Notebooks", "Notebooks")), null).Stream;
            p = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(g), null).Stream;
            write("t", g, Types.AttributeSet, new AttributeSet("name", "de", null, "Notebooks", null), null);
            write("t", g, Types.AttributeSet, new AttributeSet("name", "en", null, "Notebooks", null), null);          // fertig
            write("t", p, Types.AttributeSet, new AttributeSet("name", "de", null, "Gerät X1", null), null);           // fehlt in en
            write("t", p, Types.AttributeSet, new AttributeSet("description", "en", "web", "old text", null), null);
            write("t", p, Types.AttributeSet, new AttributeSet("description", "de", "web", "<p>Neuer Text</p>", null), null);   // en veraltet (de danach gesetzt)
            return 0;
        });
        return (c, p, g);
    }

    private static string Body(IResult r) => JsonSerializer.Serialize(r.GetType().GetProperty("Value")!.GetValue(r));   // Ok<T>.Value — ohne HttpContext

    [Fact]
    public void Einheiten_kennen_fehlend_veraltet_fertig_und_XLIFF_geht_hin_und_zurueck()
    {
        var (c, p, g) = World();
        var r = c.With((model, tree, _) => TranslateApi.Collect(model, tree, null, "de", "en", null, null, "all", 1000));
        Assert.Null(r.Error);
        var byId = r.Units.ToDictionary(u => u.Id);
        Assert.Equal("done", byId[TranslateApi.UnitId(g, "name", null, null)].State);
        Assert.Equal("missing", byId[TranslateApi.UnitId(p, "name", null, null)].State);
        Assert.Equal("stale", byId[TranslateApi.UnitId(p, "description", "web", null)].State);
        var open = c.With((model, tree, _) => TranslateApi.Collect(model, tree, null, "de", "en", null, null, "open", 1000)).Units;
        Assert.Equal(2, open.Count);

        var xml = TranslateApi.ToXliff("de", "en", open, "journali:*");
        Assert.Contains("urn:oasis:names:tc:xliff:document:2.0", xml); Assert.Contains("Gerät X1", xml);
        var back = TranslateApi.FromXliff(xml);
        Assert.Null(back.Error); Assert.Equal("de", back.From); Assert.Equal("en", back.To); Assert.Equal(2, back.Units.Count);
        // die Agentur füllt die Ziele
        var filled = back.Units.Select(u => u with { Target = u.Id.Contains("|name|") ? "Device X1" : "<p>New text</p>" }).ToList();
        var res = Body(TranslateApi.Import(c, "agency", "de", "en", filled, false));
        var o = JsonDocument.Parse(res).RootElement;
        Assert.Equal(2, o.GetProperty("written").GetInt32()); Assert.Equal(0, o.GetProperty("skipped").GetInt32());
        Assert.Equal("Device X1", c.With((_, tree, _) => tree.Nodes[p].Values[new Axis("name", "en", null, null)]));
        Assert.Empty(c.With((model, tree, _) => TranslateApi.Collect(model, tree, null, "de", "en", null, null, "open", 1000)).Units);

        // Quelle ändert sich nach dem Export → die Einheit kommt überholt zurück: sie zählt als Rückstand (behind), nicht als verworfen
        c.With((_, _, write) => write("t", p, Types.AttributeSet, new AttributeSet("name", "de", null, "Gerät X1 Pro", null), null).Number);
        var late = Body(TranslateApi.Import(c, "agency", "de", "en", filled.Where(u => u.Id.Contains("|name|")).ToList(), false));
        Assert.Equal(1, JsonDocument.Parse(late).RootElement.GetProperty("behind").GetInt32());
        Assert.Equal(0, JsonDocument.Parse(late).RootElement.GetProperty("skipped").GetInt32());
        Assert.Single(c.With((model, tree, _) => TranslateApi.Collect(model, tree, null, "de", "en", null, null, "open", 1000, null, null, null, c.Translations)).Units);   // offen bleibt offen
        var forced = Body(TranslateApi.Import(c, "agency", "de", "en", filled.Where(u => u.Id.Contains("|name|")).Select(u => u with { Target = "Device X1 Pro" }).ToList(), true));
        Assert.Equal(1, JsonDocument.Parse(forced).RootElement.GetProperty("written").GetInt32());
        // XLIFF 1.2 wird auch gelesen
        var x12 = TranslateApi.FromXliff("""<xliff xmlns="urn:oasis:names:tc:xliff:document:1.2" version="1.2"><file source-language="de" target-language="fr"><body><trans-unit id="a|name||"><source>x</source><target>y</target></trans-unit></body></file></xliff>""");
        Assert.Equal("fr", x12.To); Assert.Single(x12.Units); Assert.Equal("y", x12.Units[0].Target);
    }

    [Fact]
    public void Eine_uebernommene_Vorübersetzung_der_KI_traegt_die_Herkunft_KI()
    {
        // KI-Verordnung Art. 50 (05.10.2026): wie Ergänzen und die Prüfansichten — die Herkunft steht maschinenlesbar am Wert
        var (c, p, g) = World();
        var units = new List<TranslateApi.ImportUnit>
        {
            new(TranslateApi.UnitId(p, "name", null, null), "Device X1", null, "ai", false),
            new(TranslateApi.UnitId(p, "description", "web", null), "<p>New text</p>", null),   // von Hand: keine Herkunft KI
        };
        TranslateApi.Import(c, "anwender1", "de", "en", units, false);
        var (ki, hand) = c.Lesen((_, tree) => (tree.Nodes[p].Sources.GetValueOrDefault(new Axis("name", "en", null, null)),
            tree.Nodes[p].Sources.GetValueOrDefault(new Axis("description", "en", "web", null))));
        Assert.NotNull(ki);
        Assert.Equal("ai", ki!.Method);
        Assert.Equal("anwender1", ki.Actor);   // wer übernommen hat
        Assert.Contains("geprüft und übernommen", ki.Note);
        Assert.Null(hand);
    }
}
