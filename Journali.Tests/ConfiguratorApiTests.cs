using System.Net;
using System.Text;
using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Konfigurator;
using Journali.Core.Projections;
using Journali.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Journali.Tests;

// Der Konfigurator als Schnittstelle: ein Shop schickt die Auswahl (Id oder SKU, Menge) und bekommt zurück, was geht. Die Regeln liegen als
// Plugin-Daten im Journal. Geprüft wird über HTTP gegen einen kleinen Server mit den echten Endpunkten, ohne die Anmeldung davor.
public class ConfiguratorApiTests
{
    // Mainboard, CPU, ein Kühler, ein Grafikkarten-Kühler 2 und ein zweiter; Regel: Kühler 1 schliesst Grafikkarten-Kühler 2 aus
    static readonly Definition Server = new("Server", null, null,
    [
        new Regel("k1-gk2", "CPU-Kühler 1 passt nicht zum Grafikkarten-Kühler 2", new Bedingung("hat", Selektor: new Selektor("kuehler1")), new Folge("verbietet", new Selektor("gkuehler2"))),
    ]);

    sealed class Welt : IAsyncDisposable
    {
        public Catalog C = new(new MemoryJournal());
        public WebApplication App = null!;
        public HttpClient Http = new();
        public string Url => App.Urls.First();
        public string Rolle = "editor";
        public Dictionary<string, string> Ids = new();     // Name → Knoten-Id
        bool _standard;

        public static async Task<Welt> Neu(bool plugin = true, bool enterprise = true, string? json = null)
        {
            var w = new Welt { _standard = json is null };
            w.C.Rebuild(); w.C.SeedMissing();
            if (enterprise) Enterprise(w.C);
            w.C.With((_, _, write) =>
            {
                if (plugin)
                {
                    write("t", Plugins.Stream + ConfiguratorApi.Plugin, Types.PluginInstalled, new PluginInstalled("1", "{}"), null);
                    write("t", Plugins.Stream + ConfiguratorApi.Plugin, Types.PluginEnabled, new PluginEnabled(), null);
                    write("t", Plugins.Stream + ConfiguratorApi.Plugin, Types.PluginDataSet, new PluginDataSet(ConfiguratorApi.Praefix + "server", json ?? Server.Schreiben()), null);
                }
                foreach (var (key, typ, spalten) in new[] { ("ressource", "text", (string[]?)null), ("menge", "decimal", null), ("ressourcen", "rows", ["ressource", "menge"]) })
                    write("t", Model.AttributeStream + key, Types.AttributeDefined, new AttributeDefinition(key, Labels.Of(key, key), typ, Group: "mastergroup", Columns: spalten), null);
                // der eindeutige Wert, über den ein Shop ein Teil nennt (die SKU der Vorlage gilt erst an Varianten)
                write("t", Model.AttributeStream + "artikelnr", Types.AttributeDefined, new AttributeDefinition("artikelnr", Labels.Of("Artikelnummer", "Item no."), "text", Group: "mastergroup", Unique: true), null);
                return 0;
            });
            var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Services.AddSingleton(w.C);
            w.App = b.Build();
            w.App.Use(async (ctx, next) => { ctx.Request.Headers["X-Actor"] = "u"; ctx.Items["role"] = w.Rolle; ctx.Items["admin"] = false; await next(); });
            BatchApi.Map(w.App.MapGroup("/api")); ConfiguratorApi.Map(w.App.MapGroup("/api"));
            await w.App.StartAsync();
            return w;
        }

        // Ein Team mit einem Enterprise-Schlüssel: der Tarif der Instanz (ohne ihn gehört das Plugin nicht dazu)
        static void Enterprise(Catalog c) => c.With((_, _, write) =>
        {
            write("t", Teams.Stream + "de", Types.TeamDefined, new TeamDefined("Deutschland"), null);
            var p = c.Tarife.PaketVon("enterprise")!; var heute = DateOnly.FromDateTime(DateTime.UtcNow);
            write("t", Teams.Stream + "de", Types.KeyRedeemed, new KeyRedeemed("k-" + Guid.NewGuid().ToString("N")[..8], Schluessel.Limit, heute, heute.AddDays(29), p.Week, p.Month, 30, 0, "enterprise"), null);
            return 0;
        });

        /// <summary>Teile eines Servers: Mainboard (+3 Steckplätze), CPU (−1 Steckplatz, −1 Kühlmittel), zwei Kühler (+1 Kühlmittel) und zwei Grafikkarten-Kühler.</summary>
        public async Task Teile()
        {
            string Zeilen(string node, params (string Res, string Menge)[] z) => string.Join(",", z.SelectMany((r, i) => new[]
            {
                $$$"""{"op":"row.add","ref":"{{{node}}}r{{{i}}}","args":{"node":"@{{{node}}}","attribute":"ressourcen"}}""",
                $$$"""{"op":"attribute.set","args":{"node":"@{{{node}}}","attribute":"ressource","row":"@{{{node}}}r{{{i}}}","value":"{{{r.Res}}}"}}""",
                $$$"""{"op":"attribute.set","args":{"node":"@{{{node}}}","attribute":"menge","row":"@{{{node}}}r{{{i}}}","value":"{{{r.Menge}}}"}}""",
            }));
            var befehle = new List<string>
            {
                """{"op":"group.create","ref":"g","args":{"name":"Server"}}""",
                """{"op":"groups.attach","args":{"node":"@g","groups":["mastergroup"]}}""",
                """{"op":"group.create","ref":"kg","args":{"parent":"@g","name":"cpukuehler"}}""",
                """{"op":"group.create","ref":"gg","args":{"parent":"@g","name":"grakakuehler"}}""",
            };
            foreach (var (name, gruppe, res) in new[]
            {
                ("board", "g", new[] { ("cpu_slot", "3"), ("pci_slot", "3") }),
                ("cpu", "g", new[] { ("cpu_slot", "-1"), ("kuehlmittel", "-1") }),
                ("kuehler1", "kg", new[] { ("kuehlmittel", "1") }),
                ("kuehler3", "kg", new[] { ("kuehlmittel", "1") }),
                ("gkuehler2", "gg", Array.Empty<(string, string)>()),
            })
            {
                befehle.Add($$$"""{"op":"product.create","ref":"{{{name}}}","args":{"group":"@{{{gruppe}}}"}}""");
                if (res.Length > 0) befehle.Add(Zeilen(name, res));
                befehle.Add($$$"""{"op":"attribute.set","args":{"node":"@{{{name}}}","attribute":"artikelnr","value":"SKU-{{{name}}}"}}""");
            }
            var json = "{\"commands\":[" + string.Join(",", befehle) + "]}";
            var res2 = await Http.PostAsync(Url + "/api/batch", new StringContent(json, Encoding.UTF8, "application/json"));
            var antwort = JsonDocument.Parse(await res2.Content.ReadAsStringAsync()).RootElement;
            Assert.True(antwort.GetProperty("error").ValueKind == JsonValueKind.Null, antwort.GetProperty("error").ToString());
            foreach (var r in antwort.GetProperty("results").EnumerateArray())
                if (r.GetProperty("ref").ValueKind == JsonValueKind.String) Ids[r.GetProperty("ref").GetString()!] = r.GetProperty("node").GetString()!;
            // Die Regel nennt die Knoten, die es jetzt gibt: Kühler 1 schliesst Grafikkarten-Kühler 2 aus
            if (_standard)
            {
                var d = new Definition("Server", null, null,
                [
                    new Regel("k1-gk2", "CPU-Kühler 1 passt nicht zum Grafikkarten-Kühler 2", new Bedingung("hat", Selektor: new Selektor(Ids["kuehler1"])), new Folge("verbietet", new Selektor(Ids["gkuehler2"]))),
                ]);
                C.With((_, _, write) => write("t", Plugins.Stream + ConfiguratorApi.Plugin, Types.PluginDataSet, new PluginDataSet(ConfiguratorApi.Praefix + "server", d.Schreiben()), null));
            }
        }

        public async Task<(HttpStatusCode Status, JsonElement Json)> Pruefe(string body, string key = "server")
        {
            var r = await Http.PostAsync(Url + $"/api/konfigurator/{key}/pruefen", new StringContent(body, Encoding.UTF8, "application/json"));
            var text = await r.Content.ReadAsStringAsync();
            return (r.StatusCode, text.Length > 0 ? JsonDocument.Parse(text).RootElement : default);
        }

        public async ValueTask DisposeAsync() { await App.StopAsync(); await App.DisposeAsync(); Http.Dispose(); }
    }

    static string[] Namen(JsonElement e, string eigenschaft) => e.GetProperty(eigenschaft).EnumerateArray().Select(x => x.GetString()!).ToArray();

    // ---- ob es den Konfigurator gibt

    [Fact]
    public async Task Ein_Konfigurator_den_es_nicht_gibt_ist_ein_404_mit_Meldung()
    {
        await using var w = await Welt.Neu();
        var (status, json) = await w.Pruefe("""{"auswahl":[]}""", "gibtsnicht");
        Assert.Equal(HttpStatusCode.NotFound, status);
        Assert.Contains("gibtsnicht", json.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Ohne_das_Plugin_gibt_es_keinen_Konfigurator()
    {
        await using var w = await Welt.Neu(plugin: false);
        var (status, json) = await w.Pruefe("""{"auswahl":[]}""");
        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Contains("konfigurator", json.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Das_Plugin_gehoert_nicht_zu_jedem_Tarif()
    {
        await using var w = await Welt.Neu(enterprise: false);                 // Kostenlos
        var (status, json) = await w.Pruefe("""{"auswahl":[]}""");
        Assert.Equal(HttpStatusCode.Forbidden, status);
        Assert.Contains("konfigurator", json.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Eine_Definition_mit_Fehlern_wird_nicht_ausgewertet_und_nennt_den_ersten()
    {
        await using var w = await Welt.Neu(json: new Definition(Regeln: [new Regel("x", null, null, new Folge("fuehrtaus", new Selektor("a")))]).Schreiben());
        var (status, json) = await w.Pruefe("""{"auswahl":[]}""");
        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Contains("fuehrtaus", json.GetProperty("error").GetString());
        var kaputt = await Welt.Neu(json: "{ kein json");
        await using var _ = kaputt;
        Assert.Equal(HttpStatusCode.BadRequest, (await kaputt.Pruefe("""{"auswahl":[]}""")).Status);
    }

    // ---- die Auswahl

    [Fact]
    public async Task Die_Auswahl_wird_ueber_Id_oder_SKU_aufgeloest_und_das_Ergebnis_nennt_die_Kennungen_des_Aufrufers()
    {
        await using var w = await Welt.Neu();
        await w.Teile();
        // das Mainboard über seine Id, die CPU über die SKU: die CPU braucht Kühlung, die fehlt
        var (status, j) = await w.Pruefe($$$"""{"auswahl":[{"id":"{{{w.Ids["board"]}}}"},{"id":"SKU-cpu","menge":1}]}""");
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.False(j.GetProperty("zulaessig").GetBoolean());
        var v = j.GetProperty("verstoesse").EnumerateArray().Single();
        Assert.Equal("bilanz", v.GetProperty("art").GetString());
        Assert.Equal("kuehlmittel", v.GetProperty("ressource").GetString());
        Assert.Equal(["SKU-cpu"], Namen(v, "betrifft"));                       // die Kennung, die der Aufrufer geschickt hat, nicht unsere Id
        Assert.Equal(["board", "cpu"], j.GetProperty("auswahl").EnumerateArray().Select(x => x.GetProperty("id").GetString() == w.Ids["board"] ? "board" : "cpu").ToArray());
        Assert.Equal(2, j.GetProperty("bilanz").GetProperty("cpu_slot").GetProperty("frei").GetInt32());

        // mit Kühler ist es zulässig
        var (_, ok) = await w.Pruefe("""{"auswahl":[{"id":"SKU-board"},{"id":"SKU-cpu"},{"id":"SKU-kuehler1"}]}""");
        Assert.True(ok.GetProperty("zulaessig").GetBoolean()); Assert.True(ok.GetProperty("vollstaendig").GetBoolean());
    }

    [Fact]
    public async Task Eine_Regel_verbietet_eine_Kombination_und_nennt_beide_Teile_mit_den_Kennungen_des_Aufrufers()
    {
        await using var w = await Welt.Neu();
        await w.Teile();
        var (_, j) = await w.Pruefe("""{"auswahl":[{"id":"SKU-kuehler1"},{"id":"SKU-gkuehler2"}]}""");
        Assert.False(j.GetProperty("zulaessig").GetBoolean());
        var v = j.GetProperty("verstoesse").EnumerateArray().Single(x => x.GetProperty("art").GetString() == "regel");
        Assert.Equal("k1-gk2", v.GetProperty("regel").GetString());
        Assert.Equal(["SKU-gkuehler2", "SKU-kuehler1"], Namen(v, "betrifft").Order().ToArray());
        var (_, andere) = await w.Pruefe("""{"auswahl":[{"id":"SKU-kuehler3"},{"id":"SKU-gkuehler2"}]}""");
        Assert.True(andere.GetProperty("zulaessig").GetBoolean());
    }

    [Fact]
    public async Task Auf_Wunsch_sagt_die_Antwort_welche_Teile_noch_dazugehen_und_warum_nicht()
    {
        await using var w = await Welt.Neu();
        await w.Teile();
        var (_, ohne) = await w.Pruefe("""{"auswahl":[{"id":"SKU-kuehler1"}]}""");
        Assert.Equal(JsonValueKind.Null, ohne.GetProperty("waehlbar").ValueKind);   // nicht verlangt: nicht gerechnet

        var (_, j) = await w.Pruefe("""{"auswahl":[{"id":"SKU-kuehler1"}],"waehlbar":true}""");
        var nach = j.GetProperty("waehlbar").EnumerateArray().ToDictionary(x => x.GetProperty("keys").GetProperty("artikelnr").GetString()!);
        Assert.False(nach["SKU-gkuehler2"].GetProperty("ok").GetBoolean());
        Assert.Equal("k1-gk2", nach["SKU-gkuehler2"].GetProperty("gruende").EnumerateArray().Single().GetProperty("regel").GetString());
        Assert.True(nach["SKU-kuehler3"].GetProperty("ok").GetBoolean());
        Assert.False(string.IsNullOrEmpty(nach["SKU-board"].GetProperty("name").GetString()));
    }

    [Theory]
    [InlineData("""{"auswahl":[{"id":"gibtsnicht"}]}""", "gibtsnicht")]
    [InlineData("""{"auswahl":[{"id":""}]}""", "Id")]
    [InlineData("""{"auswahl":[{"id":"SKU-cpu","menge":0}]}""", "Menge")]
    [InlineData("""{"auswahl":[{"id":"SKU-cpu","menge":100000}]}""", "Menge")]
    public async Task Eine_Auswahl_die_nicht_geht_wird_abgewiesen_und_sagt_warum(string body, string enthaelt)
    {
        await using var w = await Welt.Neu();
        await w.Teile();
        var (status, j) = await w.Pruefe(body);
        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Contains(enthaelt, j.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Eine_leere_Auswahl_ist_zulaessig_und_vollstaendig()
    {
        await using var w = await Welt.Neu();
        var (status, j) = await w.Pruefe("""{"auswahl":[]}""");
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.True(j.GetProperty("zulaessig").GetBoolean()); Assert.True(j.GetProperty("vollstaendig").GetBoolean());
    }

    [Fact]
    public async Task Ein_Teil_das_die_Rolle_nicht_sieht_gibt_es_fuer_sie_nicht()
    {
        await using var w = await Welt.Neu();
        await w.Teile();
        w.C.With((_, _, write) => write("t", w.Ids["cpu"], Types.NodeRestricted, new NodeRestricted(["admin"]), null));
        var (status, j) = await w.Pruefe("""{"auswahl":[{"id":"SKU-cpu"}]}""");
        Assert.Equal(HttpStatusCode.BadRequest, status);                       // dieselbe Antwort wie für ein Teil, das es nicht gibt
        Assert.Contains("SKU-cpu", j.GetProperty("error").GetString());
        w.Rolle = "admin";
        Assert.Equal(HttpStatusCode.OK, (await w.Pruefe("""{"auswahl":[{"id":"SKU-cpu"}]}""")).Status);
        // und als wählbar taucht es für den Editor nicht auf
        w.Rolle = "editor";
        var (_, j2) = await w.Pruefe("""{"auswahl":[],"waehlbar":true}""");
        Assert.DoesNotContain(j2.GetProperty("waehlbar").EnumerateArray(), x => x.GetProperty("keys").GetProperty("artikelnr").GetString() == "SKU-cpu");
    }

    // ---- lesen

    [Fact]
    public async Task Die_Liste_und_die_Definition_nennen_was_an_ihnen_nicht_stimmt()
    {
        await using var w = await Welt.Neu();
        var liste = JsonDocument.Parse(await w.Http.GetStringAsync(w.Url + "/api/konfigurator")).RootElement.EnumerateArray().Single();
        Assert.Equal("server", liste.GetProperty("key").GetString());
        Assert.Equal(1, liste.GetProperty("regeln").GetInt32()); Assert.Equal(0, liste.GetProperty("fehler").GetInt32());
        var d = JsonDocument.Parse(await w.Http.GetStringAsync(w.Url + "/api/konfigurator/server")).RootElement;
        Assert.Equal("Server", d.GetProperty("definition").GetProperty("bezeichnung").GetString());
        Assert.Empty(d.GetProperty("fehler").EnumerateArray());
        Assert.Equal(HttpStatusCode.NotFound, (await w.Http.GetAsync(w.Url + "/api/konfigurator/gibtsnicht")).StatusCode);
    }

    // ---- das Recht

    [Theory]
    [InlineData("POST", "/api/konfigurator/server/pruefen", Rights.Read)]     // ein POST, der nur liest
    [InlineData("GET", "/api/konfigurator", Rights.Read)]
    [InlineData("GET", "/api/konfigurator/server", Rights.Read)]
    public void Pruefen_braucht_nur_das_Recht_zu_lesen(string methode, string pfad, string recht)
    {
        var ctx = new DefaultHttpContext(); ctx.Request.Method = methode; ctx.Request.Path = pfad;
        Assert.Equal(recht, Auth.Needed(ctx.Request));
    }

    [Fact]
    public void Die_Definition_zu_aendern_bleibt_Pflege_der_Plugin_Daten()
    {
        var ctx = new DefaultHttpContext(); ctx.Request.Method = "PUT"; ctx.Request.Path = "/api/plugins/konfigurator/data/def:server";
        Assert.Equal(Rights.Write, Auth.Needed(ctx.Request));
    }
}
