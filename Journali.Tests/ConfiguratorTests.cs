using System.Text;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Configurator;
using Journali.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Journali.Tests;

// Der Konfigurator, Kern: eine Auswahl von Teilen gegen Regeln. Das Beispiel ist ein Server: das Mainboard stellt Steckplätze bereit, eine CPU
// verbraucht einen und braucht Kühlung, eine Erweiterungskarte verbraucht einen Steckplatz und stellt drei neue bereit, und ein CPU-Kühler schliesst
// einen Grafikkarten-Kühler aus, andere nicht.
public class ConfiguratorTests
{
    static Part T(string id, string[]? pfad = null, Dictionary<string, decimal>? res = null, Dictionary<string, string>? werte = null) =>
        new(id, new HashSet<string>([id, .. pfad ?? []]), k => werte is not null && werte.TryGetValue(k, out var v) ? v : null, res ?? new());

    static readonly Part Board = T("board", ["mainboard"], new() { ["cpu_slot"] = 3, ["pci_slot"] = 3 });
    static readonly Part Cpu = T("cpu", ["cpu"], new() { ["cpu_slot"] = -1, ["kuehlmittel"] = -1 });
    static readonly Part Kuehler1 = T("kuehler1", ["cpukuehler"], new() { ["kuehlmittel"] = 1 });
    static readonly Part Kuehler3 = T("kuehler3", ["cpukuehler"], new() { ["kuehlmittel"] = 1 });
    static readonly Part Karte = T("karte", ["erweiterung"], new() { ["pci_slot"] = 2 });                       // verbraucht 1, stellt 3 bereit: Summe der Zeilen +2
    static readonly Part Graka1 = T("graka1", ["graka"], new() { ["pci_slot"] = -1 }, new() { ["leistung"] = "300" });
    static readonly Part Graka2 = T("graka2", ["graka"], new() { ["pci_slot"] = -1 }, new() { ["leistung"] = "350" });
    static readonly Part GrakaKuehler2 = T("gkuehler2", ["grakakuehler"]);
    static readonly Part Netzteil650 = T("psu650", ["netzteil"], null, new() { ["leistung"] = "650" });
    static readonly Part Netzteil850 = T("psu850", ["netzteil"], null, new() { ["leistung"] = "850" });

    static Line Z(Part t, int menge = 1) => new(t, menge);
    static Selector Knoten(string k) => new(Node: k);

    static readonly Rule K1SchliesstGK2Aus = new("k1-gk2", "CPU-Kühler 1 passt nicht zum Grafikkarten-Kühler 2",
        new Condition("has", Selector: Knoten("kuehler1")), new Effect("forbids", Knoten("gkuehler2")));
    static readonly Rule ZweiGrakasBrauchenNetzteil = new("psu", "Ab zwei Grafikkarten ein Netzteil mit mindestens 850 W",
        new Condition("count", Selector: Knoten("graka"), Comparison: ">=", Value: 2),
        new Effect("requires", new Selector("netzteil", "leistung", ">=", "850")));
    static readonly Rule EinMainboard = new("board-max", "Höchstens ein Mainboard", null, new Effect("limits", Knoten("mainboard"), Max: 1));

    static Definition Regeln(params Rule[] r) => new(Rules: [.. r]);

    // ---- Bilanz

    [Fact]
    public void Eine_Auswahl_deren_Ressourcen_aufgehen_ist_zulaessig_und_vollstaendig()
    {
        var e = Checker.Check(Regeln(), [Z(Board), Z(Cpu), Z(Kuehler1)]);
        Assert.True(e.Valid); Assert.True(e.Complete);
        Assert.Equal(2, e.Balance["cpu_slot"].Free);
        Assert.Equal(0, e.Balance["kuehlmittel"].Free);
        Assert.Equal(new BalanceLine(3, 1, 2), e.Balance["cpu_slot"]);
    }

    [Fact]
    public void Eine_CPU_ohne_Kuehlung_ist_unzulaessig_und_nennt_die_Ressource_und_das_Teil()
    {
        var e = Checker.Check(Regeln(), [Z(Board), Z(Cpu)]);
        Assert.False(e.Valid);
        var v = Assert.Single(e.Violations);
        Assert.Equal("balance", v.Kind); Assert.Equal("kuehlmittel", v.Resource);
        Assert.Equal(["cpu"], v.Affects);
    }

    [Fact]
    public void Mehr_CPUs_als_Steckplaetze_sind_unzulaessig()
    {
        var e = Checker.Check(Regeln(), [Z(Board), Z(Cpu, 4), Z(Kuehler1, 4)]);
        Assert.False(e.Valid);
        Assert.Contains(e.Violations, v => v.Resource == "cpu_slot");
    }

    [Fact]
    public void Eine_Karte_die_einen_Steckplatz_braucht_und_drei_bereitstellt_vergroessert_die_Bilanz()
    {
        var e = Checker.Check(Regeln(), [Z(Board), Z(Karte)]);
        Assert.Equal(5, e.Balance["pci_slot"].Free);   // 3 vom Mainboard, +2 netto
        // vier Grafikkarten brauchen vier Steckplätze: das Mainboard allein hat drei
        Assert.False(Checker.Check(Regeln(), [Z(Board), Z(Graka1, 2), Z(Graka2, 2)]).Valid);
        Assert.True(Checker.Check(Regeln(), [Z(Board), Z(Karte), Z(Graka1, 2), Z(Graka2, 2)]).Valid);
    }

    // ---- wenn A, dann B

    [Fact]
    public void Ein_CPU_Kuehler_schliesst_einen_Grafikkarten_Kuehler_aus_andere_nicht()
    {
        var d = Regeln(K1SchliesstGK2Aus);
        var e = Checker.Check(d, [Z(Kuehler1), Z(GrakaKuehler2)]);
        Assert.False(e.Valid);
        var v = Assert.Single(e.Violations);
        Assert.Equal("k1-gk2", v.Rule); Assert.Equal("CPU-Kühler 1 passt nicht zum Grafikkarten-Kühler 2", v.Text);
        Assert.Contains("kuehler1", v.Affects); Assert.Contains("gkuehler2", v.Affects);
        Assert.True(Checker.Check(d, [Z(Kuehler3), Z(GrakaKuehler2)]).Valid);
    }

    [Fact]
    public void Was_verlangt_ist_und_fehlt_macht_die_Auswahl_unvollstaendig_nicht_unzulaessig()
    {
        var d = Regeln(ZweiGrakasBrauchenNetzteil);
        Assert.True(Checker.Check(d, [Z(Board), Z(Graka1)]).Complete);                 // Bedingung trifft nicht zu
        var ohne = Checker.Check(d, [Z(Board), Z(Graka1), Z(Graka2)]);
        Assert.True(ohne.Valid); Assert.False(ohne.Complete);
        Assert.Equal("psu", Assert.Single(ohne.Missing).Rule);
        Assert.False(Checker.Check(d, [Z(Board), Z(Graka1), Z(Graka2), Z(Netzteil650)]).Complete);   // ein Netzteil, aber das falsche
        Assert.True(Checker.Check(d, [Z(Board), Z(Graka1), Z(Graka2), Z(Netzteil850)]).Complete);
    }

    [Fact]
    public void Eine_Regel_ohne_Bedingung_gilt_immer()
    {
        var d = Regeln(EinMainboard);
        Assert.True(Checker.Check(d, [Z(Board)]).Valid);
        Assert.False(Checker.Check(d, [Z(Board, 2)]).Valid);                          // dasselbe Teil zweimal: Menge 2
        Assert.False(Checker.Check(d, [Z(Board), Z(T("board2", ["mainboard"]))]).Valid);
    }

    [Fact]
    public void Dasselbe_Teil_mehrfach_in_der_Auswahl_zaehlt_mit_der_Summe_der_Mengen()
    {
        var e = Checker.Check(Regeln(EinMainboard), [Z(Board), Z(Board)]);
        Assert.False(e.Valid);
        Assert.Equal(6, e.Balance["cpu_slot"].Provided);
    }

    [Fact]
    public void Bedingungen_lassen_sich_verknuepfen_und_summieren()
    {
        // wenn (Grafikkarte und nicht Netzteil 850) oder die Leistung der Grafikkarten über 500 liegt → verbietet Netzteil 650
        var d = Regeln(new Rule("psu-klein", "Netzteil zu klein",
            new Condition("and", Parts: [new Condition("has", Selector: Knoten("graka")), new Condition("sum", Selector: Knoten("graka"), Attribute: "leistung", Comparison: ">", Value: 500)]),
            new Effect("forbids", new Selector("netzteil", "leistung", "<", "850"))));
        Assert.True(Checker.Check(d, [Z(Board), Z(Graka1), Z(Netzteil650)]).Valid);              // 300 W: unter der Schwelle
        Assert.False(Checker.Check(d, [Z(Board), Z(Graka1), Z(Graka2), Z(Netzteil650)]).Valid);   // 650 W
        Assert.True(Checker.Check(d, [Z(Board), Z(Graka1), Z(Graka2), Z(Netzteil850)]).Valid);

        var nicht = Regeln(new Rule("ohne-psu", "Ohne Netzteil",
            new Condition("not", Parts: [new Condition("has", Selector: Knoten("netzteil"))]), new Effect("forbids", Knoten("graka"))));
        Assert.False(Checker.Check(nicht, [Z(Board), Z(Graka1)]).Valid);
        Assert.True(Checker.Check(nicht, [Z(Board), Z(Graka1), Z(Netzteil650)]).Valid);
    }

    [Fact]
    public void Die_Bilanz_einer_Ressource_ist_eine_Bedingung()
    {
        // Sind keine Steckplätze mehr frei, ist eine Grafikkarte verboten — die Bilanz ist dann die der ganzen Auswahl
        var d = Regeln(new Rule("voll", "Keine Steckplätze mehr", new Condition("balance", Resource: "pci_slot", Comparison: "<=", Value: 0), new Effect("forbids", Knoten("graka"))));
        Assert.True(Checker.Check(d, [Z(Board), Z(Graka1, 2)]).Valid);                    // einer frei
        Assert.False(Checker.Check(d, [Z(Board), Z(Graka1, 3)]).Valid);                   // null frei
        Assert.True(Checker.Check(d, [Z(Board), Z(Graka1, 3), Z(Karte)]).Valid);          // die Karte schafft Platz
        // eine Ressource, die in der Auswahl nicht vorkommt, hat die Bilanz 0
        Assert.False(Checker.Check(d, [Z(Graka1)]).Valid);                                // (und ist ausserdem im Minus)
    }

    // ---- was noch dazugehen könnte

    [Fact]
    public void Waehlbar_sagt_zu_jedem_Teil_ob_es_dazugehen_koennte_und_warum_nicht()
    {
        var d = Regeln(K1SchliesstGK2Aus, ZweiGrakasBrauchenNetzteil);
        var e = Checker.Check(d, [Z(Board), Z(Kuehler1)], [GrakaKuehler2, Kuehler3, Graka1, Cpu]);
        var nach = e.Selectable!.ToDictionary(w => w.Id);
        Assert.False(nach["gkuehler2"].Ok);
        Assert.Equal("k1-gk2", Assert.Single(nach["gkuehler2"].Reasons).Rule);
        Assert.True(nach["kuehler3"].Ok);
        Assert.True(nach["graka1"].Ok);                                                        // ein Steckplatz frei, eine Grafikkarte, nichts verlangt
        Assert.True(nach["cpu"].Ok);                                                           // ein Kühler da: Kühlmittel reicht
    }

    [Fact]
    public void Waehlbar_nennt_nur_neue_Verstoesse_und_sperrt_nichts_wegen_fehlender_Teile()
    {
        var d = Regeln(ZweiGrakasBrauchenNetzteil);
        // zwei Grafikkarten ohne Netzteil: unvollständig, aber das Netzteil und eine dritte Grafikkarte sind wählbar (letztere, solange Steckplätze reichen)
        var e = Checker.Check(d, [Z(Board), Z(Graka1), Z(Graka2)], [Netzteil850, Netzteil650]);
        Assert.All(e.Selectable!, w => Assert.True(w.Ok));
        // schon verletzt: ein Verstoss, den die Auswahl vorher hatte, sperrt keine anderen Teile
        var schonKaputt = Checker.Check(Regeln(EinMainboard), [Z(Board, 2)], [Cpu]);
        Assert.False(schonKaputt.Selectable![0].Ok);                                              // die CPU ohne Kühlung ist ein neuer Verstoss
        Assert.Contains(schonKaputt.Selectable[0].Reasons, g => g.Resource == "kuehlmittel");
        Assert.DoesNotContain(schonKaputt.Selectable[0].Reasons, g => g.Rule == "board-max");
    }

    // ---- die Definition

    [Fact]
    public void Eine_Definition_geht_als_JSON_hin_und_zurueck()
    {
        var d = new Definition("Server", "g-server", "resources", [K1SchliesstGK2Aus, ZweiGrakasBrauchenNetzteil, EinMainboard]);
        var (zurueck, fehler) = Definition.Read(d.Write());
        Assert.Null(fehler);
        Assert.Equal(3, zurueck!.All.Count);
        Assert.Equal("psu", zurueck.All[1].Id);
        Assert.Equal("netzteil", zurueck.All[1].Then!.Selector!.Node);
        Assert.Equal(">=", zurueck.All[1].If!.Comparison);
        Assert.Empty(zurueck.Errors());
        // und das Ergebnis ist dasselbe wie mit der Definition im Speicher
        Assert.False(Checker.Check(zurueck, [Z(Kuehler1), Z(GrakaKuehler2)]).Valid);
    }

    [Fact]
    public void Ein_Dokument_das_sich_nicht_lesen_laesst_ist_ein_Fehler()
    {
        var (d, fehler) = Definition.Read("{ keine Definition");
        Assert.Null(d); Assert.False(string.IsNullOrEmpty(fehler));
    }

    [Fact]
    public void Die_Pruefung_der_Definition_nennt_jede_Regel_mit_dem_was_fehlt()
    {
        var d = new Definition(Rules:
        [
            new Rule("a", null, new Condition("gibtsnicht"), new Effect("forbids", Knoten("x"))),
            new Rule("a", null, null, new Effect("limits", Knoten("x"))),                                         // Kennung doppelt, keine Höchstmenge
            new Rule("c", null, new Condition("count", Selector: Knoten("x")), new Effect("requires", null, Min: 0)),   // kein Vergleich, kein Selektor, Mindestmenge 0
            new Rule("d", null, new Condition("and"), new Effect("fuehrtaus", Knoten("x"))),
            new Rule("e", null, new Condition("has", Selector: new Selector("x", "farbe", "ungefaehr", "rot")), new Effect("forbids", new Selector(Value: "rot"))),
            new Rule("", null, null, null),
        ]);
        var f = d.Errors();
        Assert.Contains(f, m => m.StartsWith("Regel a:") && m.Contains("gibtsnicht"));
        Assert.Contains(f, m => m.StartsWith("Regel a:") && m.Contains("mehrfach"));
        Assert.Contains(f, m => m.StartsWith("Regel a:") && m.Contains("Höchstmenge"));
        Assert.Contains(f, m => m.StartsWith("Regel c:") && m.Contains("Vergleich und Wert"));
        Assert.Contains(f, m => m.StartsWith("Regel c:") && m.Contains("Selektor"));
        Assert.Contains(f, m => m.StartsWith("Regel c:") && m.Contains("Mindestmenge"));
        Assert.Contains(f, m => m.StartsWith("Regel d:") && m.Contains("Teilbedingungen"));
        Assert.Contains(f, m => m.StartsWith("Regel d:") && m.Contains("fuehrtaus"));
        Assert.Contains(f, m => m.StartsWith("Regel e:") && m.Contains("ungefaehr"));
        Assert.Contains(f, m => m.StartsWith("Regel e:") && m.Contains("kein Attribut"));
        Assert.Contains(f, m => m.Contains("Kennung fehlt"));
        Assert.Contains(f, m => m.Contains("Folge fehlt"));
    }

    [Fact]
    public void Eine_zu_tief_verschachtelte_Bedingung_wird_gemeldet_nicht_ausgewertet()
    {
        var b = new Condition("has", Selector: Knoten("x"));
        for (var i = 0; i < Definition.MaxDepth + 2; i++) b = new Condition("not", Parts: [b]);
        var f = new Definition(Rules: [new Rule("tief", null, b, new Effect("forbids", Knoten("x")))]).Errors();
        Assert.Contains(f, m => m.Contains("zu tief"));
    }

    // ---- aus dem Baum

    [Fact]
    public async Task Teile_entstehen_aus_dem_Baum_mit_Ressourcen_Pfad_und_Werten()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, w) =>
        {
            w("t", Model.AttributeStream + "resource", Types.AttributeDefined, new AttributeDefinition("resource", Labels.Of("Ressource", "Resource"), "text", Group: "mastergroup"), null);
            w("t", Model.AttributeStream + "amount", Types.AttributeDefined, new AttributeDefinition("amount", Labels.Of("Menge", "Amount"), "decimal", Group: "mastergroup"), null);
            w("t", Model.AttributeStream + "resources", Types.AttributeDefined, new AttributeDefinition("resources", Labels.Of("Ressourcen", "Resources"), "rows", Group: "mastergroup", Columns: ["resource", "amount"]), null);
            w("t", Model.AttributeStream + "leistung", Types.AttributeDefined, new AttributeDefinition("leistung", Labels.Of("Leistung", "Power"), "decimal", Group: "mastergroup"), null);
            return 0;
        });
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Services.AddSingleton(c);
        await using var app = b.Build();
        app.Use(async (ctx, next) => { ctx.Request.Headers["X-Actor"] = "u"; await next(); });
        BatchApi.Map(app.MapGroup("/api")); await app.StartAsync();
        string antwort;
        try
        {
            // Gruppe „Server“ mit zwei Produkten: ein Mainboard (ohne Varianten) und eine Karte mit zwei Varianten; die Ressourcen stehen am Produkt
            const string json = """
            {"commands":[
              {"op":"group.create","ref":"g","args":{"name":"Server"}},
              {"op":"groups.attach","args":{"node":"@g","groups":["mastergroup"]}},
              {"op":"product.create","ref":"board","args":{"group":"@g"}},
              {"op":"row.add","ref":"r1","args":{"node":"@board","attribute":"resources"}},
              {"op":"attribute.set","args":{"node":"@board","attribute":"resource","row":"@r1","value":"pci_slot"}},
              {"op":"attribute.set","args":{"node":"@board","attribute":"amount","row":"@r1","value":"3"}},
              {"op":"row.add","ref":"r2","args":{"node":"@board","attribute":"resources"}},
              {"op":"attribute.set","args":{"node":"@board","attribute":"resource","row":"@r2","value":"pci_slot"}},
              {"op":"attribute.set","args":{"node":"@board","attribute":"amount","row":"@r2","value":"1"}},
              {"op":"attribute.set","args":{"node":"@board","attribute":"leistung","value":"45"}},
              {"op":"product.create","ref":"karte","args":{"group":"@g"}},
              {"op":"row.add","ref":"r3","args":{"node":"@karte","attribute":"resources"}},
              {"op":"attribute.set","args":{"node":"@karte","attribute":"resource","row":"@r3","value":"pci_slot"}},
              {"op":"attribute.set","args":{"node":"@karte","attribute":"amount","row":"@r3","value":"-1"}},
              {"op":"variant.create","ref":"k1","args":{"product":"@karte","axisValues":{}}},
              {"op":"variant.create","ref":"k2","args":{"product":"@karte","axisValues":{}}},
              {"op":"group.create","ref":"andere","args":{"name":"Andere"}},
              {"op":"product.create","ref":"fremd","args":{"group":"@andere"}}
            ]}
            """;
            using var http = new HttpClient();
            var res = await http.PostAsync(app.Urls.First() + "/api/batch", new StringContent(json, Encoding.UTF8, "application/json"));
            antwort = await res.Content.ReadAsStringAsync();
            Assert.Contains("\"error\":null", antwort);
        }
        finally { await app.StopAsync(); }

        c.With((model, tree, _) =>
        {
            var gruppe = tree.Nodes.Values.Single(n => n.Role == "group" && n.Name == "Server");
            var board = tree.Children(gruppe.Id).Single(n => n.Role == "product" && !tree.Children(n.Id).Any());
            var karte = tree.Children(gruppe.Id).Single(n => n.Role == "product" && tree.Children(n.Id).Any());
            var variante = tree.Children(karte.Id).First();

            var t = Parts.From(tree, model, board, "resources");
            Assert.Equal(4, t.Resources["pci_slot"]);                      // zwei Zeilen derselben Ressource: summiert
            Assert.Contains(gruppe.Id, t.Path); Assert.Contains(board.Id, t.Path);
            Assert.Equal("45", t.Value("leistung"));
            Assert.Null(t.Value("gibtsnicht"));

            var v = Parts.From(tree, model, variante, "resources");
            Assert.Equal(-1, v.Resources["pci_slot"]);                     // die Variante hat keine eigenen Zeilen: die ihres Produkts gelten
            Assert.Contains(karte.Id, v.Path); Assert.Contains(gruppe.Id, v.Path);

            // Wählbar: Mainboard (hat keine Varianten) und die beiden Varianten, nicht das Produkt mit Varianten — und nur unter der Wurzel
            var unter = Parts.Candidates(tree, model, gruppe.Id, "resources").Select(x => x.Id).ToHashSet();
            Assert.Equal(3, unter.Count);
            Assert.Contains(board.Id, unter); Assert.DoesNotContain(karte.Id, unter);
            Assert.True(Parts.Candidates(tree, model, null, "resources").Count == 4);   // überall: dazu das Produkt aus der anderen Gruppe
            Assert.True(Parts.Candidates(tree, model, board.Id, "resources").Count == 1);

            // und die Prüfung rechnet damit
            var e = Checker.Check(new Definition(), [new Line(t), new Line(v, 5)]);
            Assert.False(e.Valid);                                       // vier Steckplätze, fünf Karten
            Assert.True(Checker.Check(new Definition(), [new Line(t), new Line(v, 4)]).Valid);
            return 0;
        });
    }
}
