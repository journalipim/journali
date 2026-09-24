using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Microsoft.AspNetCore.Http;

namespace Journali.Tests;

// Übersetzungsspeicher, Paket und Rückkehr (docs/pflegestruktur.md 30). Geprüft wird genau das, woran es in der
// Praxis scheitert: die Marke sagt, gegen welche Quellfassung übersetzt ist — und ein überholter Rücklauf wird eingespielt,
// nicht verworfen.
public class TranslationOrderTests
{
    private static (Catalog C, string P) World()
    {
        var j = new MemoryJournal(); var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        string p = "";
        c.With((_, _, write) =>
        {
            var g = write("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("Notebooks", "Notebooks")), null).Stream;
            p = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(g), null).Stream;
            write("t", p, Types.AttributeSet, new AttributeSet("name", "de", null, "Gerät X1", null), null);
            return 0;
        });
        return (c, p);
    }
    private static JsonElement Body(IResult r) => JsonDocument.Parse(JsonSerializer.Serialize(r.GetType().GetProperty("Value")!.GetValue(r))).RootElement;
    private static List<TranslateApi.Unit> Open(Catalog c, string scope = "open") =>
        c.With((m, t, _) => TranslateApi.Collect(m, t, null, "de", "en", null, null, scope, 1000, null, null, null, c.Translations).Units);

    [Fact]
    public void Der_Auftrag_ist_ein_Zeiger_und_der_Ruecklauf_schliesst_ihn()
    {
        var (c, p) = World();
        var unit = TranslateApi.UnitId(p, "name", null, null);
        var order = c.With((m, t, write) =>
        {
            var r = TranslateApi.Collect(m, t, null, "de", "en", null, null, "open", 1000, null, null, null, c.Translations);
            var k = Ids.TranslationOrder();
            write("t", Translations.Stream + k, Types.TranslationOrdered, new TranslationOrdered("de", "en", r.Units.Select(u => new OrderUnit(u.Id, u.SourceHash, null)).ToList()), null);
            return k;
        });
        Assert.Single(c.Translations.Open);
        var back = Body(TranslateApi.Import(c, "agentur", "de", "en", [new TranslateApi.ImportUnit(unit, "Device X1", null)], false, order));
        Assert.Equal(1, back.GetProperty("written").GetInt32());
        Assert.Equal(0, back.GetProperty("behind").GetInt32());
        Assert.Empty(c.Translations.Open);                                  // zurück ist zurück
        Assert.Equal(1, c.Translations.Order(order)!.Written);
        Assert.Empty(Open(c));                                              // nichts mehr im Rückstand
    }

    [Fact]
    public void Quelle_weitergezogen_Uebersetzung_wird_eingespielt_und_bleibt_im_Rueckstand()
    {
        var (c, p) = World();
        var unit = TranslateApi.UnitId(p, "name", null, null);
        var sentHash = Open(c).Single().SourceHash;
        // während der Auftrag draussen ist, schreibt die Redaktion weiter
        c.With((_, _, write) => write("t", p, Types.AttributeSet, new AttributeSet("name", "de", null, "Gerät X1 Pro", null), null).Number);
        var back = Body(TranslateApi.Import(c, "agentur", "de", "en", [new TranslateApi.ImportUnit(unit, "Device X1", sentHash)], false));
        Assert.Equal(1, back.GetProperty("written").GetInt32());            // nicht verworfen — sie ist besser als nichts
        Assert.Equal(1, back.GetProperty("behind").GetInt32());
        Assert.Equal(0, back.GetProperty("skipped").GetInt32());
        Assert.Equal("Device X1", c.With((_, t, _) => t.Nodes[p].Values[new Axis("name", "en", null, null)]));
        // und sie bleibt offen: die Marke steht auf der Auftragsfassung, nicht auf jetzt — die Differenz geht ins nächste Paket
        var still = Open(c).Single();
        Assert.Equal("stale", still.State);
        Assert.Equal("Gerät X1 Pro", still.Source);
        // die zweite Runde holt den Rückstand ein
        var second = Body(TranslateApi.Import(c, "agentur", "de", "en", [new TranslateApi.ImportUnit(unit, "Device X1 Pro", still.SourceHash)], false));
        Assert.Equal(1, second.GetProperty("written").GetInt32());
        Assert.Equal(0, second.GetProperty("behind").GetInt32());
        Assert.Empty(Open(c));
    }

    [Fact]
    public void Zieltext_von_Hand_geaendert_ist_ein_Konflikt_und_wird_nicht_ueberschrieben()
    {
        var (c, p) = World();
        var unit = TranslateApi.UnitId(p, "name", null, null);
        var hash = Open(c).Single().SourceHash;
        TranslateApi.Import(c, "agentur", "de", "en", [new TranslateApi.ImportUnit(unit, "Device X1", hash)], false);
        // der lokal Verantwortliche bessert nach
        c.With((_, _, write) => write("t", p, Types.AttributeSet, new AttributeSet("name", "en", null, "Device X1 (UK)", null), null).Number);
        var late = Body(TranslateApi.Import(c, "agentur", "de", "en", [new TranslateApi.ImportUnit(unit, "Device X1", hash)], false));
        Assert.Equal(1, late.GetProperty("conflicts").GetInt32());
        Assert.Equal(0, late.GetProperty("written").GetInt32());
        Assert.Equal("Device X1 (UK)", c.With((_, t, _) => t.Nodes[p].Values[new Axis("name", "en", null, null)]));   // die Handarbeit bleibt
        var forced = Body(TranslateApi.Import(c, "agentur", "de", "en", [new TranslateApi.ImportUnit(unit, "Device X1", hash)], true));
        Assert.Equal(1, forced.GetProperty("written").GetInt32());          // mit Ansage geht es doch
    }

    [Fact]
    public void Zehnmal_geaendert_ist_ein_Posten_nicht_zehn()
    {
        var (c, p) = World();
        var unit = TranslateApi.UnitId(p, "name", null, null);
        TranslateApi.Import(c, "agentur", "de", "en", [new TranslateApi.ImportUnit(unit, "Device X1", Open(c).Single().SourceHash)], false);
        Assert.Empty(Open(c));
        for (var i = 0; i < 10; i++) c.With((_, _, write) => write("t", p, Types.AttributeSet, new AttributeSet("name", "de", null, $"Gerät X1 Fassung {i}", null), null).Number);
        Assert.Single(Open(c));   // verglichen wird Marke gegen jetzt, nicht ein Stapel von Änderungen
        // zurück auf den übersetzten Wortlaut: kein Rückstand mehr, ohne dass jemand etwas zurücknimmt
        c.With((_, _, write) => write("t", p, Types.AttributeSet, new AttributeSet("name", "de", null, "Gerät X1", null), null).Number);
        Assert.Empty(Open(c));
    }

    [Fact]
    public void Die_Version_der_Mastersprache_schnuert_das_Paket()
    {
        var (c, p) = World();
        // zweiter Auslöser neben dem Zeitplan: ein Übergang mit der Wirkung translate:<sprache>
        var def = new WorkflowDefined(Labels.Of("Fassung", "Release"), [new("draft", Labels.Of("Entwurf", "Draft")), new("final", Labels.Of("final", "final"), null, true)],
            [new("finalize", "draft", "final", Labels.Of("final", "finalize"), null, false, ["translate:en"])], "draft", ["product"]);
        Outcome Run(Func<Ctx, Outcome> cmd) => c.With((model, tree, write) => cmd(new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Workflows = c.Workflows, Translations = c.Translations, Write = (s, t, pl) => write("t", s, t, pl, null) }));
        Assert.Null(Run(x => Commands.DefineWorkflow(x, "fassung", def)).Error);
        Assert.Null(Run(x => Commands.WorkflowStep(x, p, "fassung", "finalize", null)).Error);
        var order = Assert.Single(c.Translations.Open);
        Assert.Equal("en", order.To);
        Assert.Equal(p, order.Root);
        Assert.Single(order.Units);                                  // genau der Rückstand darunter
        // nichts offen → kein leerer Auftrag
        TranslateApi.Import(c, "agentur", "de", "en", [new TranslateApi.ImportUnit(TranslateApi.UnitId(p, "name", null, null), "Device X1", null)], false, order.Key);
        Assert.Null(Run(x => Commands.OrderTranslation(x, p, "en")).Error);
        Assert.Empty(c.Translations.Open);
    }

    [Fact]
    public void Der_Auftrag_steht_in_der_XLIFF_Datei_und_kommt_mit_ihr_zurueck()
    {
        var (c, p) = World();
        var units = Open(c);
        var xml = TranslateApi.WithOrder(TranslateApi.ToXliff("de", "en", units, "journali:*"), "20260922-1200-abcd");
        Assert.Equal("20260922-1200-abcd", TranslateApi.OrderOf(xml));
        var back = TranslateApi.FromXliff(xml);
        Assert.Null(back.Error);
        Assert.Equal(units.Count, back.Units.Count);
        Assert.Null(TranslateApi.OrderOf(TranslateApi.ToXliff("de", "en", units, "journali:*")));   // ohne Auftrag: frei importiert
    }
}
