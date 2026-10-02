using System.Text;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Konfigurator;
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
public class KonfiguratorTests
{
    static Teil T(string id, string[]? pfad = null, Dictionary<string, decimal>? res = null, Dictionary<string, string>? werte = null) =>
        new(id, new HashSet<string>([id, .. pfad ?? []]), k => werte is not null && werte.TryGetValue(k, out var v) ? v : null, res ?? new());

    static readonly Teil Board = T("board", ["mainboard"], new() { ["cpu_slot"] = 3, ["pci_slot"] = 3 });
    static readonly Teil Cpu = T("cpu", ["cpu"], new() { ["cpu_slot"] = -1, ["kuehlmittel"] = -1 });
    static readonly Teil Kuehler1 = T("kuehler1", ["cpukuehler"], new() { ["kuehlmittel"] = 1 });
    static readonly Teil Kuehler3 = T("kuehler3", ["cpukuehler"], new() { ["kuehlmittel"] = 1 });
    static readonly Teil Karte = T("karte", ["erweiterung"], new() { ["pci_slot"] = 2 });                       // verbraucht 1, stellt 3 bereit: Summe der Zeilen +2
    static readonly Teil Graka1 = T("graka1", ["graka"], new() { ["pci_slot"] = -1 }, new() { ["leistung"] = "300" });
    static readonly Teil Graka2 = T("graka2", ["graka"], new() { ["pci_slot"] = -1 }, new() { ["leistung"] = "350" });
    static readonly Teil GrakaKuehler2 = T("gkuehler2", ["grakakuehler"]);
    static readonly Teil Netzteil650 = T("psu650", ["netzteil"], null, new() { ["leistung"] = "650" });
    static readonly Teil Netzteil850 = T("psu850", ["netzteil"], null, new() { ["leistung"] = "850" });

    static Zeile Z(Teil t, int menge = 1) => new(t, menge);
    static Selektor Knoten(string k) => new(Knoten: k);

    static readonly Regel K1SchliesstGK2Aus = new("k1-gk2", "CPU-Kühler 1 passt nicht zum Grafikkarten-Kühler 2",
        new Bedingung("hat", Selektor: Knoten("kuehler1")), new Folge("verbietet", Knoten("gkuehler2")));
    static readonly Regel ZweiGrakasBrauchenNetzteil = new("psu", "Ab zwei Grafikkarten ein Netzteil mit mindestens 850 W",
        new Bedingung("anzahl", Selektor: Knoten("graka"), Vergleich: ">=", Wert: 2),
        new Folge("verlangt", new Selektor("netzteil", "leistung", ">=", "850")));
    static readonly Regel EinMainboard = new("board-max", "Höchstens ein Mainboard", null, new Folge("begrenzt", Knoten("mainboard"), Hoechstens: 1));

    static Definition Regeln(params Regel[] r) => new(Regeln: [.. r]);

    // ---- Bilanz

    [Fact]
    public void Eine_Auswahl_deren_Ressourcen_aufgehen_ist_zulaessig_und_vollstaendig()
    {
        var e = Pruefer.Pruefe(Regeln(), [Z(Board), Z(Cpu), Z(Kuehler1)]);
        Assert.True(e.Zulaessig); Assert.True(e.Vollstaendig);
        Assert.Equal(2, e.Bilanz["cpu_slot"].Frei);
        Assert.Equal(0, e.Bilanz["kuehlmittel"].Frei);
        Assert.Equal(new Bilanzzeile(3, 1, 2), e.Bilanz["cpu_slot"]);
    }

    [Fact]
    public void Eine_CPU_ohne_Kuehlung_ist_unzulaessig_und_nennt_die_Ressource_und_das_Teil()
    {
        var e = Pruefer.Pruefe(Regeln(), [Z(Board), Z(Cpu)]);
        Assert.False(e.Zulaessig);
        var v = Assert.Single(e.Verstoesse);
        Assert.Equal("bilanz", v.Art); Assert.Equal("kuehlmittel", v.Ressource);
        Assert.Equal(["cpu"], v.Betrifft);
    }

    [Fact]
    public void Mehr_CPUs_als_Steckplaetze_sind_unzulaessig()
    {
        var e = Pruefer.Pruefe(Regeln(), [Z(Board), Z(Cpu, 4), Z(Kuehler1, 4)]);
        Assert.False(e.Zulaessig);
        Assert.Contains(e.Verstoesse, v => v.Ressource == "cpu_slot");
    }

    [Fact]
    public void Eine_Karte_die_einen_Steckplatz_braucht_und_drei_bereitstellt_vergroessert_die_Bilanz()
    {
        var e = Pruefer.Pruefe(Regeln(), [Z(Board), Z(Karte)]);
        Assert.Equal(5, e.Bilanz["pci_slot"].Frei);   // 3 vom Mainboard, +2 netto
        // vier Grafikkarten brauchen vier Steckplätze: das Mainboard allein hat drei
        Assert.False(Pruefer.Pruefe(Regeln(), [Z(Board), Z(Graka1, 2), Z(Graka2, 2)]).Zulaessig);
        Assert.True(Pruefer.Pruefe(Regeln(), [Z(Board), Z(Karte), Z(Graka1, 2), Z(Graka2, 2)]).Zulaessig);
    }

    // ---- wenn A, dann B

    [Fact]
    public void Ein_CPU_Kuehler_schliesst_einen_Grafikkarten_Kuehler_aus_andere_nicht()
    {
        var d = Regeln(K1SchliesstGK2Aus);
        var e = Pruefer.Pruefe(d, [Z(Kuehler1), Z(GrakaKuehler2)]);
        Assert.False(e.Zulaessig);
        var v = Assert.Single(e.Verstoesse);
        Assert.Equal("k1-gk2", v.Regel); Assert.Equal("CPU-Kühler 1 passt nicht zum Grafikkarten-Kühler 2", v.Text);
        Assert.Contains("kuehler1", v.Betrifft); Assert.Contains("gkuehler2", v.Betrifft);
        Assert.True(Pruefer.Pruefe(d, [Z(Kuehler3), Z(GrakaKuehler2)]).Zulaessig);
    }

    [Fact]
    public void Was_verlangt_ist_und_fehlt_macht_die_Auswahl_unvollstaendig_nicht_unzulaessig()
    {
        var d = Regeln(ZweiGrakasBrauchenNetzteil);
        Assert.True(Pruefer.Pruefe(d, [Z(Board), Z(Graka1)]).Vollstaendig);                 // Bedingung trifft nicht zu
        var ohne = Pruefer.Pruefe(d, [Z(Board), Z(Graka1), Z(Graka2)]);
        Assert.True(ohne.Zulaessig); Assert.False(ohne.Vollstaendig);
        Assert.Equal("psu", Assert.Single(ohne.Fehlt).Regel);
        Assert.False(Pruefer.Pruefe(d, [Z(Board), Z(Graka1), Z(Graka2), Z(Netzteil650)]).Vollstaendig);   // ein Netzteil, aber das falsche
        Assert.True(Pruefer.Pruefe(d, [Z(Board), Z(Graka1), Z(Graka2), Z(Netzteil850)]).Vollstaendig);
    }

    [Fact]
    public void Eine_Regel_ohne_Bedingung_gilt_immer()
    {
        var d = Regeln(EinMainboard);
        Assert.True(Pruefer.Pruefe(d, [Z(Board)]).Zulaessig);
        Assert.False(Pruefer.Pruefe(d, [Z(Board, 2)]).Zulaessig);                          // dasselbe Teil zweimal: Menge 2
        Assert.False(Pruefer.Pruefe(d, [Z(Board), Z(T("board2", ["mainboard"]))]).Zulaessig);
    }

    [Fact]
    public void Dasselbe_Teil_mehrfach_in_der_Auswahl_zaehlt_mit_der_Summe_der_Mengen()
    {
        var e = Pruefer.Pruefe(Regeln(EinMainboard), [Z(Board), Z(Board)]);
        Assert.False(e.Zulaessig);
        Assert.Equal(6, e.Bilanz["cpu_slot"].Bereit);
    }

    [Fact]
    public void Bedingungen_lassen_sich_verknuepfen_und_summieren()
    {
        // wenn (Grafikkarte und nicht Netzteil 850) oder die Leistung der Grafikkarten über 500 liegt → verbietet Netzteil 650
        var d = Regeln(new Regel("psu-klein", "Netzteil zu klein",
            new Bedingung("und", Teile: [new Bedingung("hat", Selektor: Knoten("graka")), new Bedingung("summe", Selektor: Knoten("graka"), Attribut: "leistung", Vergleich: ">", Wert: 500)]),
            new Folge("verbietet", new Selektor("netzteil", "leistung", "<", "850"))));
        Assert.True(Pruefer.Pruefe(d, [Z(Board), Z(Graka1), Z(Netzteil650)]).Zulaessig);              // 300 W: unter der Schwelle
        Assert.False(Pruefer.Pruefe(d, [Z(Board), Z(Graka1), Z(Graka2), Z(Netzteil650)]).Zulaessig);   // 650 W
        Assert.True(Pruefer.Pruefe(d, [Z(Board), Z(Graka1), Z(Graka2), Z(Netzteil850)]).Zulaessig);

        var nicht = Regeln(new Regel("ohne-psu", "Ohne Netzteil",
            new Bedingung("nicht", Teile: [new Bedingung("hat", Selektor: Knoten("netzteil"))]), new Folge("verbietet", Knoten("graka"))));
        Assert.False(Pruefer.Pruefe(nicht, [Z(Board), Z(Graka1)]).Zulaessig);
        Assert.True(Pruefer.Pruefe(nicht, [Z(Board), Z(Graka1), Z(Netzteil650)]).Zulaessig);
    }

    [Fact]
    public void Die_Bilanz_einer_Ressource_ist_eine_Bedingung()
    {
        // Sind keine Steckplätze mehr frei, ist eine Grafikkarte verboten — die Bilanz ist dann die der ganzen Auswahl
        var d = Regeln(new Regel("voll", "Keine Steckplätze mehr", new Bedingung("bilanz", Ressource: "pci_slot", Vergleich: "<=", Wert: 0), new Folge("verbietet", Knoten("graka"))));
        Assert.True(Pruefer.Pruefe(d, [Z(Board), Z(Graka1, 2)]).Zulaessig);                    // einer frei
        Assert.False(Pruefer.Pruefe(d, [Z(Board), Z(Graka1, 3)]).Zulaessig);                   // null frei
        Assert.True(Pruefer.Pruefe(d, [Z(Board), Z(Graka1, 3), Z(Karte)]).Zulaessig);          // die Karte schafft Platz
        // eine Ressource, die in der Auswahl nicht vorkommt, hat die Bilanz 0
        Assert.False(Pruefer.Pruefe(d, [Z(Graka1)]).Zulaessig);                                // (und ist ausserdem im Minus)
    }

    // ---- was noch dazugehen könnte

    [Fact]
    public void Waehlbar_sagt_zu_jedem_Teil_ob_es_dazugehen_koennte_und_warum_nicht()
    {
        var d = Regeln(K1SchliesstGK2Aus, ZweiGrakasBrauchenNetzteil);
        var e = Pruefer.Pruefe(d, [Z(Board), Z(Kuehler1)], [GrakaKuehler2, Kuehler3, Graka1, Cpu]);
        var nach = e.Waehlbar!.ToDictionary(w => w.Id);
        Assert.False(nach["gkuehler2"].Ok);
        Assert.Equal("k1-gk2", Assert.Single(nach["gkuehler2"].Gruende).Regel);
        Assert.True(nach["kuehler3"].Ok);
        Assert.True(nach["graka1"].Ok);                                                        // ein Steckplatz frei, eine Grafikkarte, nichts verlangt
        Assert.True(nach["cpu"].Ok);                                                           // ein Kühler da: Kühlmittel reicht
    }

    [Fact]
    public void Waehlbar_nennt_nur_neue_Verstoesse_und_sperrt_nichts_wegen_fehlender_Teile()
    {
        var d = Regeln(ZweiGrakasBrauchenNetzteil);
        // zwei Grafikkarten ohne Netzteil: unvollständig, aber das Netzteil und eine dritte Grafikkarte sind wählbar (letztere, solange Steckplätze reichen)
        var e = Pruefer.Pruefe(d, [Z(Board), Z(Graka1), Z(Graka2)], [Netzteil850, Netzteil650]);
        Assert.All(e.Waehlbar!, w => Assert.True(w.Ok));
        // schon verletzt: ein Verstoss, den die Auswahl vorher hatte, sperrt keine anderen Teile
        var schonKaputt = Pruefer.Pruefe(Regeln(EinMainboard), [Z(Board, 2)], [Cpu]);
        Assert.False(schonKaputt.Waehlbar![0].Ok);                                              // die CPU ohne Kühlung ist ein neuer Verstoss
        Assert.Contains(schonKaputt.Waehlbar[0].Gruende, g => g.Ressource == "kuehlmittel");
        Assert.DoesNotContain(schonKaputt.Waehlbar[0].Gruende, g => g.Regel == "board-max");
    }

    // ---- die Definition

    [Fact]
    public void Eine_Definition_geht_als_JSON_hin_und_zurueck()
    {
        var d = new Definition("Server", "g-server", "ressourcen", [K1SchliesstGK2Aus, ZweiGrakasBrauchenNetzteil, EinMainboard]);
        var (zurueck, fehler) = Definition.Lesen(d.Schreiben());
        Assert.Null(fehler);
        Assert.Equal(3, zurueck!.Alle.Count);
        Assert.Equal("psu", zurueck.Alle[1].Id);
        Assert.Equal("netzteil", zurueck.Alle[1].Dann!.Selektor!.Knoten);
        Assert.Equal(">=", zurueck.Alle[1].Wenn!.Vergleich);
        Assert.Empty(zurueck.Fehler());
        // und das Ergebnis ist dasselbe wie mit der Definition im Speicher
        Assert.False(Pruefer.Pruefe(zurueck, [Z(Kuehler1), Z(GrakaKuehler2)]).Zulaessig);
    }

    [Fact]
    public void Ein_Dokument_das_sich_nicht_lesen_laesst_ist_ein_Fehler()
    {
        var (d, fehler) = Definition.Lesen("{ keine Definition");
        Assert.Null(d); Assert.False(string.IsNullOrEmpty(fehler));
    }

    [Fact]
    public void Die_Pruefung_der_Definition_nennt_jede_Regel_mit_dem_was_fehlt()
    {
        var d = new Definition(Regeln:
        [
            new Regel("a", null, new Bedingung("gibtsnicht"), new Folge("verbietet", Knoten("x"))),
            new Regel("a", null, null, new Folge("begrenzt", Knoten("x"))),                                         // Kennung doppelt, keine Höchstmenge
            new Regel("c", null, new Bedingung("anzahl", Selektor: Knoten("x")), new Folge("verlangt", null, Mindestens: 0)),   // kein Vergleich, kein Selektor, Mindestmenge 0
            new Regel("d", null, new Bedingung("und"), new Folge("fuehrtaus", Knoten("x"))),
            new Regel("e", null, new Bedingung("hat", Selektor: new Selektor("x", "farbe", "ungefaehr", "rot")), new Folge("verbietet", new Selektor(Wert: "rot"))),
            new Regel("", null, null, null),
        ]);
        var f = d.Fehler();
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
        var b = new Bedingung("hat", Selektor: Knoten("x"));
        for (var i = 0; i < Definition.MaxTiefe + 2; i++) b = new Bedingung("nicht", Teile: [b]);
        var f = new Definition(Regeln: [new Regel("tief", null, b, new Folge("verbietet", Knoten("x")))]).Fehler();
        Assert.Contains(f, m => m.Contains("zu tief"));
    }

    // ---- aus dem Baum

    [Fact]
    public async Task Teile_entstehen_aus_dem_Baum_mit_Ressourcen_Pfad_und_Werten()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, w) =>
        {
            w("t", Model.AttributeStream + "ressource", Types.AttributeDefined, new AttributeDefinition("ressource", Labels.Of("Ressource", "Resource"), "text", Group: "mastergroup"), null);
            w("t", Model.AttributeStream + "menge", Types.AttributeDefined, new AttributeDefinition("menge", Labels.Of("Menge", "Amount"), "decimal", Group: "mastergroup"), null);
            w("t", Model.AttributeStream + "ressourcen", Types.AttributeDefined, new AttributeDefinition("ressourcen", Labels.Of("Ressourcen", "Resources"), "rows", Group: "mastergroup", Columns: ["ressource", "menge"]), null);
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
              {"op":"row.add","ref":"r1","args":{"node":"@board","attribute":"ressourcen"}},
              {"op":"attribute.set","args":{"node":"@board","attribute":"ressource","row":"@r1","value":"pci_slot"}},
              {"op":"attribute.set","args":{"node":"@board","attribute":"menge","row":"@r1","value":"3"}},
              {"op":"row.add","ref":"r2","args":{"node":"@board","attribute":"ressourcen"}},
              {"op":"attribute.set","args":{"node":"@board","attribute":"ressource","row":"@r2","value":"pci_slot"}},
              {"op":"attribute.set","args":{"node":"@board","attribute":"menge","row":"@r2","value":"1"}},
              {"op":"attribute.set","args":{"node":"@board","attribute":"leistung","value":"45"}},
              {"op":"product.create","ref":"karte","args":{"group":"@g"}},
              {"op":"row.add","ref":"r3","args":{"node":"@karte","attribute":"ressourcen"}},
              {"op":"attribute.set","args":{"node":"@karte","attribute":"ressource","row":"@r3","value":"pci_slot"}},
              {"op":"attribute.set","args":{"node":"@karte","attribute":"menge","row":"@r3","value":"-1"}},
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

            var t = Teile.Aus(tree, model, board, "ressourcen");
            Assert.Equal(4, t.Ressourcen["pci_slot"]);                      // zwei Zeilen derselben Ressource: summiert
            Assert.Contains(gruppe.Id, t.Pfad); Assert.Contains(board.Id, t.Pfad);
            Assert.Equal("45", t.Wert("leistung"));
            Assert.Null(t.Wert("gibtsnicht"));

            var v = Teile.Aus(tree, model, variante, "ressourcen");
            Assert.Equal(-1, v.Ressourcen["pci_slot"]);                     // die Variante hat keine eigenen Zeilen: die ihres Produkts gelten
            Assert.Contains(karte.Id, v.Pfad); Assert.Contains(gruppe.Id, v.Pfad);

            // Wählbar: Mainboard (hat keine Varianten) und die beiden Varianten, nicht das Produkt mit Varianten — und nur unter der Wurzel
            var unter = Teile.Waehlbare(tree, model, gruppe.Id, "ressourcen").Select(x => x.Id).ToHashSet();
            Assert.Equal(3, unter.Count);
            Assert.Contains(board.Id, unter); Assert.DoesNotContain(karte.Id, unter);
            Assert.True(Teile.Waehlbare(tree, model, null, "ressourcen").Count == 4);   // überall: dazu das Produkt aus der anderen Gruppe
            Assert.True(Teile.Waehlbare(tree, model, board.Id, "ressourcen").Count == 1);

            // und die Prüfung rechnet damit
            var e = Pruefer.Pruefe(new Definition(), [new Zeile(t), new Zeile(v, 5)]);
            Assert.False(e.Zulaessig);                                       // vier Steckplätze, fünf Karten
            Assert.True(Pruefer.Pruefe(new Definition(), [new Zeile(t), new Zeile(v, 4)]).Zulaessig);
            return 0;
        });
    }
}
