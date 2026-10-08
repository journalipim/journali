using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Journali.Tests;

// Der Produktberater (pflegestruktur 42): ein Besucher fragt, der Dienst des Plugins fragt hier mit seinem Token. Gezeigt wird nur, was der
// Publikationsbaum ausleitet und die Rolle sieht, an den Produkten nur die Attribute der Sicht. Geprüft über HTTP gegen die echten Endpunkte.
// In der Sammlung Startphase: die Demo (Demo.An, statisch) sperrt Berater-Token, und andere Tests schalten sie um
[Collection("Startphase")]
public class AdvisorTests
{
    sealed class Welt : IAsyncDisposable
    {
        public Catalog C = new(new MemoryJournal());
        public WebApplication App = null!;
        public HttpClient Http = new();
        public string Url => App.Urls.First();
        public string Dir = Path.Combine(Path.GetTempPath(), "advisor-" + Guid.NewGuid().ToString("N"));
        public string Medien => Path.Combine(Dir, "media");
        public Dictionary<string, string> Ids = new();
        public string Pub = "";

        /// <param name="anmeldung">mit Anwendern und der Sperre davor — sonst offen wie ein Server ohne Anwender</param>
        public static async Task<Welt> Neu(bool plugin = true, bool anmeldung = false, AdvisorApi.Definition? def = null)
        {
            var w = new Welt();
            Directory.CreateDirectory(w.Dir);
            AdvisorApi.ZaehlerLeeren();
            w.C.Rebuild(); w.C.SeedMissing();
            w.Aufbauen(plugin);
            w.Setze(def ?? w.Standard());
            if (anmeldung) w.C.With((_, _, write) => write("t", Users.Stream + "chef", Types.UserDefined, new UserDefined("Chef", null, "admin", true, Model.InitTeam), null));
            var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0");
            b.Services.AddSingleton(w.C); b.Services.AddSingleton(new Vectors(null));
            b.Services.AddSingleton(new Embedder(w.Dir, Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance) { Eingeschaltet = () => false });
            b.Services.AddSingleton<IMediaStore>(new FileMediaStore(w.Medien));
            w.App = b.Build();
            if (anmeldung) w.App.Use(Auth.Middleware(w.C, w.Dir));
            else w.App.Use(async (ctx, next) => { ctx.Request.Headers["X-Actor"] = "u"; await next(); });
            AdvisorApi.Map(w.App.MapGroup("/api"), w.Dir, w.Dir);
            await w.App.StartAsync();
            return w;
        }

        public AdvisorApi.Definition Standard() => new("Werkzeugberater", Pub, "reader", "beratung", ["de", "en"]);

        public void Setze(AdvisorApi.Definition d) =>
            C.With((_, _, write) => write("t", Plugins.Stream + AdvisorApi.Plugin, Types.PluginDataSet, new PluginDataSet(AdvisorApi.Prefix + "werkzeug", d.Write()), null));

        void Aufbauen(bool plugin) => C.With((_, _, write) =>
        {
            // ein Team mit Enterprise-Schlüssel: ohne ihn gehört das Plugin nicht zum Tarif
            write("t", Teams.Stream + "de", Types.TeamDefined, new TeamDefined("Deutschland"), null);
            var paket = C.Tarife.PaketVon("enterprise")!; var heute = DateOnly.FromDateTime(DateTime.UtcNow);
            write("t", Teams.Stream + "de", Types.KeyRedeemed, new KeyRedeemed("k-1", Schluessel.Limit, heute, heute.AddDays(29), paket.Week, paket.Month, 30, 0, "enterprise"), null);
            if (plugin)
            {
                write("t", Plugins.Stream + AdvisorApi.Plugin, Types.PluginInstalled, new PluginInstalled("1", "{}"), null);
                write("t", Plugins.Stream + AdvisorApi.Plugin, Types.PluginEnabled, new PluginEnabled(), null);
            }
            // Modell: Leistung (Zahl), wasserdicht (ja/nein), Farbe (Saat) — dazu ein internes Attribut, das die Sicht nicht nennt
            write("t", Model.GroupStream + "technik", Types.AttributeGroupDefined, new AttributeGroupDefinition("technik", Labels.Of("Technik", "Technical")), null);
            write("t", Model.GroupStream + "intern", Types.AttributeGroupDefined, new AttributeGroupDefinition("intern", Labels.Of("Intern", "Internal")), null);
            write("t", Model.AttributeStream + "leistung", Types.AttributeDefined, new AttributeDefinition("leistung", Labels.Of("Leistung", "Power"), AttributeTypes.Decimal, Unit: "W", Group: "technik", Inheritable: true), null);
            write("t", Model.AttributeStream + "wasserdicht", Types.AttributeDefined, new AttributeDefinition("wasserdicht", Labels.Of("Wasserdicht", "Waterproof"), AttributeTypes.Boolean, Group: "technik"), null);
            write("t", Model.AttributeStream + "einkauf", Types.AttributeDefined, new AttributeDefinition("einkauf", Labels.Of("Einkaufspreis", "Purchase price"), AttributeTypes.Decimal, Group: "intern"), null);
            write("t", Model.ViewStream + "beratung", Types.ViewDefined, new ViewDefinition("beratung", Labels.Of("Beratung", "Advice"), [new ViewItem("mastergroup"), new ViewItem("technik")], Roles.Product), null);

            var g = Ids["g"] = Journali.Core.Entries.Ids.New(Roles.Group);
            write("t", g, Types.GroupCreated, new GroupCreated(Model.RootNode, Labels.Of("Werkzeug", "Tools")), null);
            write("t", g, Types.GroupsAttached, new GroupsAttached(["technik", "intern"]), null);
            foreach (var (k, name, leistung, farbe, nass, frei) in new[]
            {
                ("bohr", "Bohrhammer Pro", "800", "red", "false", true),
                ("schrauber", "Akkuschrauber kompakt", "300", "blue", "true", true),
                ("schleifer", "Winkelschleifer", "1200", "red", "false", true),
                ("geheim", "Prototyp Bohrhammer", "900", "red", "false", true),        // nur für admin sichtbar
                ("neu", "Bohrhammer Neu", "850", "blue", "false", false),              // nicht freigegeben
            })
            {
                var p = Ids[k] = Journali.Core.Entries.Ids.New(Roles.Product);
                write("t", p, Types.ProductCreated, new ProductCreated(g), null);
                write("t", p, Types.AttributeSet, new AttributeSet("name", "de", null, name), null);
                write("t", p, Types.AttributeSet, new AttributeSet("name", "en", null, name + " EN"), null);
                write("t", p, Types.AttributeSet, new AttributeSet("leistung", null, null, leistung), null);
                write("t", p, Types.AttributeSet, new AttributeSet("wasserdicht", null, null, nass), null);
                write("t", p, Types.AttributeSet, new AttributeSet("einkauf", null, null, "12.50"), null);
                var v = Ids[k + "-v"] = Journali.Core.Entries.Ids.New(Roles.Variant);
                write("t", v, Types.VariantCreated, new VariantCreated(p, new()), null);
                write("t", v, Types.AttributeSet, new AttributeSet("color", null, null, farbe), null);
                write("t", v, Types.AttributeSet, new AttributeSet(Model.SkuAttribute, null, null, "SKU-" + k), null);
                if (frei) write("t", v, Types.ReleaseGranted, new ReleaseGranted("web", null), null);
            }
            write("t", Ids["geheim"], Types.NodeRestricted, new NodeRestricted(["admin"]), null);
            Pub = Journali.Core.Entries.Ids.New(Roles.Rubric);
            write("t", Pub, Types.RubricCreated, new RubricCreated(null, Labels.Of("Shop", "Shop"), "Shop", "web"), null);
            write("t", Pub, Types.NodePlaced, new NodePlaced(g), null);
            return 0;
        });

        /// <summary>Ein Bild am Produkt; <paramref name="bisGestern"/>: seine Frist ist abgelaufen.</summary>
        public string Bild(string produkt, bool bisGestern = false)
        {
            var sha = Convert.ToHexString(Guid.NewGuid().ToByteArray()).ToLowerInvariant() + Convert.ToHexString(Guid.NewGuid().ToByteArray()).ToLowerInvariant();
            var m = Journali.Core.Entries.Ids.Media();
            Directory.CreateDirectory(Path.Combine(Medien, sha[..2]));   // der Speicher legt nach den ersten zwei Zeichen ab
            File.WriteAllBytes(Path.Combine(Medien, sha[..2], sha + ".thumb"), [1, 2, 3]);
            C.With((_, _, write) =>
            {
                write("t", m, Types.MediaCreated, new MediaCreated(sha, 3, "image/png", "bild.png"), null);
                if (bisGestern) write("t", m, Types.AttributeSet, new AttributeSet(Model.ValidUntil, null, null, DateTime.Now.AddDays(-1).ToString("yyyy-MM-dd")), null);
                write("t", Journali.Core.Entries.Ids.Relation(), Types.RelationCreated, new RelationCreated("image", Ids[produkt], m), null);
                return 0;
            });
            return m;
        }

        public async Task<(HttpStatusCode Status, JsonElement Json)> Post(string pfad, string body, string? token = null)
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, Url + pfad) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
            if (token is not null) req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var r = await Http.SendAsync(req);
            var text = await r.Content.ReadAsStringAsync();
            return (r.StatusCode, text.Length > 0 ? JsonDocument.Parse(text).RootElement : default);
        }

        public async Task<(HttpStatusCode Status, JsonElement Json)> Get(string pfad, string? token = null)
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, Url + pfad);
            if (token is not null) req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var r = await Http.SendAsync(req);
            var text = await r.Content.ReadAsStringAsync();
            return (r.StatusCode, text.Length > 0 && (text.TrimStart().StartsWith('{') || text.TrimStart().StartsWith('[')) ? JsonDocument.Parse(text).RootElement : default);
        }

        public Task<(HttpStatusCode Status, JsonElement Json)> Frage(string body, string? token = null) => Post("/api/advisor/werkzeug/ask", body, token);

        public async ValueTask DisposeAsync()
        {
            await App.StopAsync(); await App.DisposeAsync(); Http.Dispose();
            try { Directory.Delete(Dir, true); } catch (IOException) { }
        }
    }

    static List<string> Namen(JsonElement j) => j.GetProperty("hits").EnumerateArray().Select(h => h.GetProperty("name").GetString()!).ToList();

    // ---- was der Berater zeigt

    [Fact]
    public async Task Ohne_Frage_zeigt_er_was_der_Baum_ausleitet_und_die_Rolle_sieht()
    {
        await using var w = await Welt.Neu();
        var (status, j) = await w.Frage("""{"q":""}""");
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(3, j.GetProperty("total").GetInt32());
        Assert.Equal(["Akkuschrauber kompakt", "Bohrhammer Pro", "Winkelschleifer"], Namen(j).Order().ToList());   // nicht der Prototyp (Rolle), nicht der neue (Freigabe)
    }

    [Fact]
    public async Task Eine_Frage_findet_ueber_die_Woerter_und_der_Name_steht_vorn()
    {
        await using var w = await Welt.Neu();
        var (_, j) = await w.Frage("""{"q":"Ich suche einen Bohrhammer"}""");
        Assert.Equal("Bohrhammer Pro", Namen(j).First());
        Assert.DoesNotContain("Prototyp Bohrhammer", Namen(j));
        Assert.DoesNotContain("Bohrhammer Neu", Namen(j));
        // ohne Vektoren sagt die Antwort, warum es nur die Wörter waren
        Assert.Equal(JsonValueKind.String, j.GetProperty("warning").ValueKind);
    }

    [Fact]
    public async Task Die_Sprache_waehlt_den_Namen_und_eine_unbekannte_faellt_auf_die_erste_zurueck()
    {
        await using var w = await Welt.Neu();
        var (_, en) = await w.Frage("""{"q":"bohrhammer","locale":"en-GB"}""");
        Assert.Equal("en", en.GetProperty("locale").GetString());
        Assert.Equal("Bohrhammer Pro EN", Namen(en).First());
        var (_, fr) = await w.Frage("""{"q":"","locale":"fr"}""");
        Assert.Equal("de", fr.GetProperty("locale").GetString());
    }

    [Fact]
    public async Task Die_Facetten_nennen_was_die_Treffer_unterscheidet_und_ein_Filter_grenzt_ein()
    {
        await using var w = await Welt.Neu();
        var (_, j) = await w.Frage("""{"q":""}""");
        var facetten = j.GetProperty("facets").EnumerateArray().ToDictionary(f => f.GetProperty("key").GetString()!);
        Assert.Contains("color", facetten.Keys);
        Assert.Contains("leistung", facetten.Keys);
        Assert.DoesNotContain("einkauf", facetten.Keys);                       // nicht in der Sicht
        var rot = facetten["color"].GetProperty("values").EnumerateArray().Single(v => v.GetProperty("value").GetString() == "red");
        Assert.Equal(2, rot.GetProperty("n").GetInt32());
        Assert.Equal("Rot", rot.GetProperty("label").GetString());
        Assert.Equal("range", facetten["leistung"].GetProperty("type").GetString());
        Assert.Equal(300m, facetten["leistung"].GetProperty("min").GetDecimal());

        var (_, nurRot) = await w.Frage("""{"q":"","filter":[{"attribute":"color","value":"red"}]}""");
        Assert.Equal(["Bohrhammer Pro", "Winkelschleifer"], Namen(nurRot).Order().ToList());
        Assert.DoesNotContain(nurRot.GetProperty("facets").EnumerateArray(), f => f.GetProperty("key").GetString() == "color");   // schon gefiltert
        Assert.Equal("Rot", nurRot.GetProperty("filter").EnumerateArray().Single().GetProperty("valueLabel").GetString());

        var (_, klein) = await w.Frage("""{"q":"","filter":[{"attribute":"leistung","op":"le","value":"800"}]}""");
        Assert.Equal(["Akkuschrauber kompakt", "Bohrhammer Pro"], Namen(klein).Order().ToList());
        // ein Filter auf ein Attribut ausserhalb der Sicht zählt nicht — er verrät nichts über interne Werte
        var (_, intern) = await w.Frage("""{"q":"","filter":[{"attribute":"einkauf","value":"99"}]}""");
        Assert.Equal(3, intern.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Eine_Karte_zeigt_nur_Werte_der_Sicht()
    {
        await using var w = await Welt.Neu();
        var (_, j) = await w.Frage("""{"q":"Winkelschleifer"}""");
        var karte = j.GetProperty("hits").EnumerateArray().First();
        var werte = karte.GetProperty("values").EnumerateArray().Select(v => v.GetProperty("key").GetString()).ToList();
        Assert.Contains("leistung", werte);
        Assert.DoesNotContain("einkauf", werte);
        Assert.Equal("1200 W", karte.GetProperty("values").EnumerateArray().Single(v => v.GetProperty("key").GetString() == "leistung").GetProperty("value").GetString());
        Assert.Equal("SKU-schleifer", w.C.Lesen((m, t) => t.KeysOf(m, t.Nodes[w.Ids["schleifer-v"]])!["sku"]));
    }

    [Fact]
    public async Task Ein_Produkt_zeigt_die_Sicht_und_eines_ausserhalb_des_Bestands_gibt_es_nicht()
    {
        await using var w = await Welt.Neu();
        var (ok, p) = await w.Get($"/api/advisor/werkzeug/product/{w.Ids["bohr"]}");
        Assert.Equal(HttpStatusCode.OK, ok);
        Assert.Equal("Bohrhammer Pro", p.GetProperty("name").GetString());
        Assert.DoesNotContain(p.GetProperty("values").EnumerateArray(), v => v.GetProperty("key").GetString() == "einkauf");
        Assert.Single(p.GetProperty("variants").EnumerateArray());
        // auch über die Id der Variante
        Assert.Equal(HttpStatusCode.OK, (await w.Get($"/api/advisor/werkzeug/product/{w.Ids["bohr-v"]}")).Status);
        foreach (var k in new[] { "geheim", "neu", "g" })
            Assert.Equal(HttpStatusCode.NotFound, (await w.Get($"/api/advisor/werkzeug/product/{w.Ids[k]}")).Status);
    }

    [Fact]
    public async Task Der_Vergleich_stellt_die_Zeilen_der_Sicht_nebeneinander()
    {
        await using var w = await Welt.Neu();
        var (status, j) = await w.Post("/api/advisor/werkzeug/compare", $$"""{"ids":["{{w.Ids["bohr"]}}","{{w.Ids["schleifer"]}}"]}""");
        Assert.Equal(HttpStatusCode.OK, status);
        var zeilen = j.GetProperty("rows").EnumerateArray().ToDictionary(z => z.GetProperty("key").GetString()!);
        Assert.Equal(["800 W", "1200 W"], zeilen["leistung"].GetProperty("values").EnumerateArray().Select(v => v.GetString()).ToArray());
        Assert.False(zeilen["leistung"].GetProperty("same").GetBoolean());
        Assert.True(zeilen["color"].GetProperty("same").GetBoolean());
        Assert.False(zeilen.ContainsKey("einkauf"));
        Assert.Equal(HttpStatusCode.BadRequest, (await w.Post("/api/advisor/werkzeug/compare", $$"""{"ids":["{{w.Ids["bohr"]}}"]}""")).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await w.Post("/api/advisor/werkzeug/compare", $$"""{"ids":["{{w.Ids["bohr"]}}","{{w.Ids["geheim"]}}"]}""")).Status);
    }

    [Fact]
    public async Task Bilder_kommen_nur_wenn_sie_heute_gelten_und_an_einem_Produkt_des_Bestands_haengen()
    {
        await using var w = await Welt.Neu();
        var gilt = w.Bild("bohr");
        var abgelaufen = w.Bild("schleifer", bisGestern: true);
        var geheim = w.Bild("geheim");
        var (_, j) = await w.Frage("""{"q":""}""");
        var bilder = j.GetProperty("hits").EnumerateArray().ToDictionary(h => h.GetProperty("name").GetString()!, h => h.GetProperty("image").ValueKind == JsonValueKind.String ? h.GetProperty("image").GetString() : null);
        Assert.Equal(gilt, bilder["Bohrhammer Pro"]);
        Assert.Null(bilder["Winkelschleifer"]);
        var r = await w.Http.GetAsync(w.Url + $"/api/advisor/werkzeug/image/{gilt}");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal([1, 2, 3], await r.Content.ReadAsByteArrayAsync());
        Assert.Equal(HttpStatusCode.NotFound, (await w.Http.GetAsync(w.Url + $"/api/advisor/werkzeug/image/{abgelaufen}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await w.Http.GetAsync(w.Url + $"/api/advisor/werkzeug/image/{geheim}")).StatusCode);
    }

    // ---- Grenzen und Fehler

    [Fact]
    public async Task Die_Tagesgrenze_gilt_am_Server()
    {
        await using var w = await Welt.Neu();
        w.Setze(w.Standard() with { Limits = new AdvisorApi.Grenzen(JeTag: 2) });
        Assert.Equal(HttpStatusCode.OK, (await w.Frage("""{"q":"a"}""")).Status);
        Assert.Equal(HttpStatusCode.OK, (await w.Frage("""{"q":"b"}""")).Status);
        var (status, j) = await w.Frage("""{"q":"c"}""");
        Assert.Equal((HttpStatusCode)429, status);
        Assert.Contains("werkzeug", j.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Eine_zu_lange_Frage_wird_abgewiesen()
    {
        await using var w = await Welt.Neu();
        var (status, _) = await w.Frage(JsonSerializer.Serialize(new { q = new string('x', AdvisorApi.MaxFrage + 1) }));
        Assert.Equal(HttpStatusCode.BadRequest, status);
    }

    [Fact]
    public async Task Ein_Berater_mit_Fehlern_antwortet_nicht_und_nennt_sie()
    {
        await using var w = await Welt.Neu();
        w.Setze(w.Standard() with { View = "gibtsnicht", Origins = ["https://shop.example/pfad"] });
        var (status, j) = await w.Frage("""{"q":""}""");
        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Contains("keine Sicht", j.GetProperty("error").GetString());
        var liste = (await w.Get("/api/advisor")).Json.EnumerateArray().Single();
        var fehler = liste.GetProperty("errors").EnumerateArray().Select(e => e.GetString()!).ToList();
        Assert.Contains("keine Sicht", fehler);
        Assert.Contains(fehler, f => f.Contains("shop.example/pfad"));
    }

    [Fact]
    public async Task Ohne_das_Plugin_gibt_es_keinen_Berater_und_einen_unbekannten_auch_nicht()
    {
        await using (var w = await Welt.Neu(plugin: false))
            Assert.Equal(HttpStatusCode.BadRequest, (await w.Frage("""{"q":""}""")).Status);
        await using var w2 = await Welt.Neu();
        Assert.Equal(HttpStatusCode.NotFound, (await w2.Post("/api/advisor/gibtsnicht/ask", """{"q":""}""")).Status);
    }

    [Fact]
    public async Task Ohne_bestaetigten_Hinweis_wirkt_das_Plugin_nicht()
    {
        await using var w = await Welt.Neu();
        var manifest = """{"key":"advisor","acknowledge":{"version":"2026-10-08","title":{"de":"Öffentlich"},"points":[{"de":"Punkt"}]}}""";
        w.C.With((_, _, write) => write("t", Plugins.Stream + AdvisorApi.Plugin, Types.PluginInstalled, new PluginInstalled("1", manifest), null));
        var (status, j) = await w.Frage("""{"q":""}""");
        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Contains("Hinweis", j.GetProperty("error").GetString());
        w.C.With((_, _, write) => write("t", Plugins.Stream + AdvisorApi.Plugin, Types.PluginAcknowledged, new PluginAcknowledged("2026-10-08", "Öffentlich"), null));
        Assert.Equal(HttpStatusCode.OK, (await w.Frage("""{"q":""}""")).Status);
    }

    // ---- das Token des Dienstes

    [Fact]
    public async Task Das_Token_erreicht_nur_die_Fragen_seines_Beraters()
    {
        await using var w = await Welt.Neu(anmeldung: true);
        var token = Auth.AdvisorTokenAusgeben(w.Dir, "werkzeug", "Dienst");
        Assert.StartsWith("ja_", token);
        Assert.Equal(HttpStatusCode.OK, (await w.Frage("""{"q":"bohrhammer"}""", token)).Status);
        Assert.Equal(HttpStatusCode.OK, (await w.Get("/api/advisor/werkzeug/info", token)).Status);
        Assert.Equal(HttpStatusCode.OK, (await w.Get($"/api/advisor/werkzeug/product/{w.Ids["bohr"]}", token)).Status);
        // nichts sonst: nicht der Baum, nicht die Definitionen, nicht die Token, nicht ein anderer Berater
        foreach (var pfad in new[] { "/api/tree", "/api/advisor", "/api/advisor/werkzeug/tokens", "/api/advisor/anderer/info", "/api/plugins/advisor/data" })
            Assert.Equal(HttpStatusCode.Forbidden, (await w.Get(pfad, token)).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await w.Post("/api/advisor/werkzeug/tokens", "{}", token)).Status);
        // ohne Token keine Antwort, mit widerrufenem auch nicht
        Assert.Equal(HttpStatusCode.Unauthorized, (await w.Frage("""{"q":""}""")).Status);
        var id = Auth.AdvisorTokens(w.Dir, "werkzeug").Single().Id;
        Assert.Equal(1, Auth.AdvisorTokenWiderrufen(w.Dir, "werkzeug", id));
        Auth.Vergessen();
        Assert.Equal(HttpStatusCode.Unauthorized, (await w.Frage("""{"q":""}""", token)).Status);
    }

    [Fact]
    public async Task Das_Token_liest_mit_der_Rolle_des_Beraters()
    {
        await using var w = await Welt.Neu(anmeldung: true);
        w.Setze(w.Standard() with { Role = "admin" });
        var token = Auth.AdvisorTokenAusgeben(w.Dir, "werkzeug", "Dienst");
        var (_, j) = await w.Frage("""{"q":""}""", token);
        Assert.Contains("Prototyp Bohrhammer", Namen(j));                     // admin sieht den Prototyp — die Freigabe gilt trotzdem
        Assert.DoesNotContain("Bohrhammer Neu", Namen(j));
    }

    [Theory]
    [InlineData("GET", "/api/advisor/werkzeug/info", true)]
    [InlineData("POST", "/api/advisor/werkzeug/ask", true)]
    [InlineData("GET", "/api/advisor/werkzeug/variant/v-1", true)]
    [InlineData("POST", "/api/advisor/werkzeug/compare", true)]
    [InlineData("GET", "/api/advisor/werkzeug/product/p-1", true)]
    [InlineData("GET", "/api/advisor/werkzeug/image/m-1", true)]
    [InlineData("GET", "/API/ADVISOR/WERKZEUG/INFO", true)]
    [InlineData("GET", "/api/advisor/werkzeug/product/p-1/x", false)]
    [InlineData("GET", "/api/advisor/werkzeug/ask", false)]
    [InlineData("POST", "/api/advisor/werkzeug/tokens", false)]
    [InlineData("GET", "/api/advisor/werkzeug", false)]
    [InlineData("GET", "/api/advisor/werkzeugx/info", false)]
    [InlineData("GET", "/api/tree", false)]
    public void Die_Wege_des_Tokens(string methode, string pfad, bool erlaubt) =>
        Assert.Equal(erlaubt, AdvisorApi.FuerToken(pfad, methode, "werkzeug"));

    [Theory]
    [InlineData("POST", "/api/advisor/werkzeug/ask", Rights.Read)]
    [InlineData("POST", "/api/advisor/werkzeug/compare", Rights.Read)]
    [InlineData("GET", "/api/advisor", Rights.Read)]
    [InlineData("POST", "/api/advisor/werkzeug/tokens", Rights.Plugins)]
    [InlineData("GET", "/api/advisor/werkzeug/tokens", Rights.Plugins)]
    [InlineData("DELETE", "/api/advisor/werkzeug/tokens/abc", Rights.Plugins)]
    public void Fragen_lesen_und_Token_verwaltet_wer_Plugins_verwaltet(string methode, string pfad, string recht)
    {
        var ctx = new DefaultHttpContext(); ctx.Request.Method = methode; ctx.Request.Path = pfad;
        Assert.Equal(recht, Auth.Needed(ctx.Request));
    }

    // ---- die Bausteine

    [Fact]
    public void Suchwoerter_ohne_Fuellwoerter_und_Zahlen_bleiben()
    {
        Assert.Equal(["bohrhammer", "800"], AdvisorApi.Woerter("Ich suche einen Bohrhammer mit 800 W"));
        Assert.Equal(["drill", "concrete"], AdvisorApi.Woerter("I need a drill for concrete"));
    }

    [Theory]
    [InlineData("1234.5", "1200")]
    [InlineData("850", "850")]
    [InlineData("0.0347", "0.035")]
    [InlineData("12", "12")]
    public void Eine_vorgeschlagene_Grenze_hat_zwei_Stellen(string ein, string aus) =>
        Assert.Equal(decimal.Parse(aus, System.Globalization.CultureInfo.InvariantCulture), AdvisorApi.Runde(decimal.Parse(ein, System.Globalization.CultureInfo.InvariantCulture)));

    [Fact]
    public void Die_KI_bekommt_nur_die_Treffer_und_den_Hinweis_dass_Daten_keine_Anweisungen_sind()
    {
        var (system, user) = AdvisorApi.Prompt("Welcher bohrt Beton?", [("Bohrhammer Pro", [("Leistung", "800 W")])], ["Farbe"]);
        Assert.Contains("ausschliesslich aus der nummerierten Liste", system);
        Assert.Contains("keine Anweisungen an dich", system);
        Assert.Contains("[1] Bohrhammer Pro", user);
        Assert.Contains("Leistung: 800 W", user);
        Assert.Contains("Farbe", user);
    }
    // ---- Gespräch (08.10.2026): Angaben sammeln, im Text erkennen, nachfragen, lockern

    static List<(string Attribute, string Op, string Value)> Filter(JsonElement j) =>
        j.GetProperty("filter").EnumerateArray().Select(f => (f.GetProperty("attribute").GetString()!, f.GetProperty("op").GetString()!, f.GetProperty("value").GetString()!)).ToList();

    [Fact]
    public void Angaben_im_Text_werden_Filter_der_Rest_bleibt_Suchwort()
    {
        var katalog = new Catalog(new MemoryJournal()); katalog.Rebuild(); katalog.SeedMissing();
        var model = katalog.Lesen((m, _) => m);   // das Modell der Saat: Farben als Liste
        AttributeDefinition leistung = new("leistung", Labels.Of("Leistung", "Power"), AttributeTypes.Decimal, Unit: "W");
        AttributeDefinition dicht = new("wasserdicht", Labels.Of("Wasserdicht", "Waterproof"), AttributeTypes.Boolean);
        var attr = new List<AttributeDefinition> { leistung, dicht, model.Attributes["color"] };

        var (f, rest) = AdvisorApi.Erkenne(model, attr, "Bohrhammer unter 900 W, wasserdicht und rot", "de");
        Assert.Equal([("leistung", "le", "900"), ("wasserdicht", "eq", "true"), ("color", "eq", "red")],
            f.Select(x => (x.Def.Key, x.Op, x.Value)).OrderBy(x => x.Key == "leistung" ? 0 : x.Key == "wasserdicht" ? 1 : 2).ToList());
        Assert.Equal(["bohrhammer"], AdvisorApi.Woerter(rest));

        Assert.Equal(("wasserdicht", "false"), AdvisorApi.Erkenne(model, attr, "nicht wasserdicht", "de").Filter.Select(x => (x.Def.Key, x.Value)).Single());
        Assert.Equal(("leistung", "ge", "1.5"), AdvisorApi.Erkenne(model, attr, "ab 1,5 W", "de").Filter.Select(x => (x.Def.Key, x.Op, x.Value)).Single());
        Assert.Empty(AdvisorApi.Erkenne(model, attr, "900 W", "de").Filter);   // ohne „unter“ oder „ab“ ist eine Zahl kein Filter

        // zwei Zahlenattribute mit derselben Einheit: nur mit Bezeichnung im Text
        AttributeDefinition laenge = new("laenge", Labels.Of("Länge", "Length"), AttributeTypes.Decimal, Unit: "cm"), breite = new("breite", Labels.Of("Breite", "Width"), AttributeTypes.Decimal, Unit: "cm");
        Assert.Empty(AdvisorApi.Erkenne(model, [laenge, breite], "bis 50 cm", "de").Filter);
        Assert.Equal("breite", AdvisorApi.Erkenne(model, [laenge, breite], "Breite bis 50 cm", "de").Filter.Single().Def.Key);
    }

    [Fact]
    public async Task Ein_Gespraech_sammelt_die_Angaben_und_jede_Eingabe_ergaenzt_sie()
    {
        await using var w = await Welt.Neu();
        var (_, eins) = await w.Frage("""{"q":"Bohrhammer"}""");
        Assert.Equal(["bohrhammer"], eins.GetProperty("words").EnumerateArray().Select(x => x.GetString()).ToList());
        // die zweite Eingabe trägt die Wörter der ersten mit; „unter 1000 W“ wird ein Filter, „rot“ auch
        var (_, zwei) = await w.Frage("""{"q":"rot und unter 1000 W","woerter":["bohrhammer"]}""");
        Assert.Equal(["Bohrhammer Pro"], Namen(zwei));
        Assert.Contains(("leistung", "le", "1000"), Filter(zwei));
        Assert.Contains(("color", "eq", "red"), Filter(zwei));
        Assert.Equal(["bohrhammer"], zwei.GetProperty("words").EnumerateArray().Select(x => x.GetString()).ToList());
    }

    [Fact]
    public async Task Ein_Wort_das_in_keinem_Produkt_steht_findet_nichts_und_wird_genannt()
    {
        await using var w = await Welt.Neu();
        var (_, j) = await w.Frage("""{"q":"auto"}""");
        Assert.Equal(0, j.GetProperty("total").GetInt32());
        Assert.Equal(["auto"], j.GetProperty("unknown").EnumerateArray().Select(x => x.GetString()).ToList());
        Assert.Empty(j.GetProperty("words").EnumerateArray());   // es wird nicht gesammelt
        Assert.False(j.GetProperty("similar").GetBoolean());
    }

    [Fact]
    public async Task Ist_nichts_mehr_uebrig_sagt_der_Berater_welche_Angabe_zu_eng_ist()
    {
        await using var w = await Welt.Neu();
        // den Akkuschrauber gibt es nur in Blau: „rot“ und „Akkuschrauber“ zusammen finden nichts
        var (_, j) = await w.Frage("""{"q":"Akkuschrauber rot"}""");
        Assert.Equal(0, j.GetProperty("total").GetInt32());
        var lockern = j.GetProperty("relax").EnumerateArray().ToList();
        // ohne „Akkuschrauber“ blieben die zwei roten, ohne „rot“ der eine Akkuschrauber — die grössere Zahl zuerst
        Assert.Equal(("word", "akkuschrauber", 2), (lockern[0].GetProperty("kind").GetString(), lockern[0].GetProperty("word").GetString(), lockern[0].GetProperty("n").GetInt32()));
        Assert.Equal(("filter", "color", 1), (lockern[1].GetProperty("kind").GetString(), lockern[1].GetProperty("attribute").GetString(), lockern[1].GetProperty("n").GetInt32()));
        // „unter 200 W“: ohne das Wort bliebe nichts — gelockert wird nur der Filter
        var (_, k) = await w.Frage("""{"q":"Akkuschrauber unter 200 W"}""");
        Assert.Equal(["filter"], k.GetProperty("relax").EnumerateArray().Select(x => x.GetProperty("kind").GetString()).ToList());
    }

    [Fact]
    public void Nach_dem_Sinn_zaehlt_nur_was_sich_vom_Rest_abhebt()
    {
        // alle gleich weit weg: nichts hebt sich ab
        Assert.Empty(AdvisorApi.SinnAuswahl([("a", 0.20), ("b", 0.205), ("c", 0.21), ("d", 0.21), ("e", 0.215)]));
        // zwei heben sich ab
        Assert.Equal(["a", "b"], AdvisorApi.SinnAuswahl([("a", 0.10), ("b", 0.11), ("c", 0.19), ("d", 0.20), ("e", 0.21)]));
        // der beste ist zu weit weg
        Assert.Empty(AdvisorApi.SinnAuswahl([("a", 0.30), ("b", 0.40), ("c", 0.41)]));
        Assert.Empty(AdvisorApi.SinnAuswahl([]));
    }

    [Fact]
    public void Was_die_KI_an_Angaben_liefert_zaehlt_nur_wenn_es_zum_Vokabular_passt()
    {
        var katalog = new Catalog(new MemoryJournal()); katalog.Rebuild(); katalog.SeedMissing();
        var model = katalog.Lesen((m, _) => m);   // das Modell der Saat: Farben als Liste
        AttributeDefinition leistung = new("leistung", Labels.Of("Leistung", "Power"), AttributeTypes.Decimal, Unit: "W");
        AttributeDefinition dicht = new("wasserdicht", Labels.Of("Wasserdicht", "Waterproof"), AttributeTypes.Boolean);
        var attr = new List<AttributeDefinition> { leistung, dicht, model.Attributes["color"] };
        var antwort = """Gern: {"filter":[{"attribute":"leistung","op":"le","value":"500"},{"attribute":"color","op":"eq","value":"RED"},{"attribute":"wasserdicht","op":"eq","value":"vielleicht"},{"attribute":"einkauf","op":"le","value":"10"},{"attribute":"color","op":"eq","value":"lila"}]}""";
        var f = AdvisorApi.AngabenAusKi(antwort, model, attr);
        Assert.Equal([("leistung", "le", "500"), ("color", "eq", "red")], f.Select(x => (x.Def.Key, x.Op, x.Value)).ToList());
        Assert.Empty(AdvisorApi.AngabenAusKi("kein JSON", model, attr));
        var (system, user) = AdvisorApi.PromptAngaben("leise und rot", ["Bohrhammer"], AdvisorApi.Vokabular(model, attr, "de"));
        Assert.Contains("keine Anweisungen an dich", system);
        Assert.Contains("red=Rot", user);
        Assert.Contains("Früher gesagt: Bohrhammer", user);
    }

    [Fact]
    public void Die_KI_bekommt_den_Verlauf_des_Gespraechs()
    {
        var (_, user) = AdvisorApi.Prompt("rot", [("Bohrhammer Pro", [("Leistung", "800 W")])], [], ["Bohrhammer", "unter 1000 W"]);
        Assert.StartsWith("Früher gesagt: Bohrhammer | unter 1000 W", user);
    }
    // ---- Varianten (08.10.2026): die Achsen zählen zur Sicht, eine Variante lässt sich ganz öffnen

    /// <summary>Eine Jacke mit der Achse Grösse (S, M) — die Grösse steht in keiner Gruppe der Sicht.</summary>
    static (string Produkt, string S, string M) Jacke(Welt w) => w.C.With((_, _, write) =>
    {
        write("t", Model.ListStream + "groesse", Types.ListDefined, new ListDefinition("groesse", Labels.Of("Grösse", "Size")), null);
        write("t", Model.ListStream + "groesse", Types.ListValueDefined, new ListValueDefinition("s", Labels.Of("S", "S"), null, 1), null);
        write("t", Model.ListStream + "groesse", Types.ListValueDefined, new ListValueDefinition("m", Labels.Of("M", "M"), null, 2), null);
        write("t", Model.AttributeStream + "groesse", Types.AttributeDefined, new AttributeDefinition("groesse", Labels.Of("Grösse", "Size"), AttributeTypes.Enum, Group: "intern", List: "groesse"), null);
        var p = Journali.Core.Entries.Ids.New(Roles.Product);
        write("t", p, Types.ProductCreated, new ProductCreated(w.Ids["g"], Axes: ["groesse"]), null);
        write("t", p, Types.AttributeSet, new AttributeSet("name", "de", null, "Regenjacke"), null);
        write("t", p, Types.AttributeSet, new AttributeSet("leistung", null, null, "0"), null);
        var ids = new List<string>();
        foreach (var g in new[] { "s", "m" })
        {
            var v = Journali.Core.Entries.Ids.New(Roles.Variant); ids.Add(v);
            write("t", v, Types.VariantCreated, new VariantCreated(p, new() { ["groesse"] = g }), null);
            write("t", v, Types.AttributeSet, new AttributeSet(Model.SkuAttribute, null, null, "JACKE-" + g.ToUpperInvariant()), null);
            write("t", v, Types.AttributeSet, new AttributeSet("color", null, null, g == "s" ? "red" : "blue"), null);
            write("t", v, Types.ReleaseGranted, new ReleaseGranted("web", null), null);
        }
        return (p, ids[0], ids[1]);
    });

    [Fact]
    public async Task Die_Achsen_zaehlen_zur_Sicht_und_benennen_die_Varianten()
    {
        await using var w = await Welt.Neu();
        var (p, _, _) = Jacke(w);
        var (_, prod) = await w.Get($"/api/advisor/werkzeug/product/{p}");
        Assert.Equal(["Regenjacke · S", "Regenjacke · M"], prod.GetProperty("variants").EnumerateArray().Select(v => v.GetProperty("name").GetString()).ToList());
        Assert.Contains(prod.GetProperty("variants")[0].GetProperty("values").EnumerateArray(), x => x.GetProperty("key").GetString() == "groesse" && x.GetProperty("value").GetString() == "S");
        // die Grösse wird Facette und Filter, obwohl die Sicht sie nicht nennt; das Einkaufsattribut bleibt draussen
        var (_, j) = await w.Frage("""{"q":"Regenjacke"}""");
        var (_, m) = await w.Frage("""{"q":"Regenjacke","filter":[{"attribute":"groesse","op":"eq","value":"m"}]}""");
        Assert.Equal(["Regenjacke"], Namen(m));
        var (_, x) = await w.Frage("""{"q":"Regenjacke","filter":[{"attribute":"einkauf","op":"le","value":"20"}]}""");
        Assert.Empty(x.GetProperty("filter").EnumerateArray());
        // im Text erkannt: „Grösse M“
        var (_, t) = await w.Frage("""{"q":"Regenjacke Grösse M"}""");
        Assert.Contains(t.GetProperty("filter").EnumerateArray(), f => f.GetProperty("attribute").GetString() == "groesse" && f.GetProperty("value").GetString() == "m");
        Assert.Empty(t.GetProperty("unknown").EnumerateArray());   // „Grösse“ ist kein Suchwort
    }

    [Fact]
    public async Task Eine_Variante_laesst_sich_ganz_oeffnen()
    {
        await using var w = await Welt.Neu();
        var (p, s, _) = Jacke(w);
        var (status, v) = await w.Get($"/api/advisor/werkzeug/variant/{s}");
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("Regenjacke · S", v.GetProperty("name").GetString());
        Assert.Equal(p, v.GetProperty("product").GetProperty("id").GetString());
        Assert.Equal("JACKE-S", v.GetProperty("keys").GetProperty("sku").GetString());
        var werte = v.GetProperty("values").EnumerateArray().ToDictionary(x => x.GetProperty("key").GetString()!, x => (x.GetProperty("value").GetString(), x.GetProperty("axis").GetBoolean()));
        Assert.Equal(("S", true), werte["groesse"]);
        Assert.Equal(("Rot", false), werte["color"]);
        Assert.Equal(("0 W", false), werte["leistung"]);   // vom Produkt geerbt
        Assert.False(werte.ContainsKey("einkauf"));
        // ein Produkt ist keine Variante, eine fremde Variante gibt es hier nicht
        Assert.Equal(HttpStatusCode.NotFound, (await w.Get($"/api/advisor/werkzeug/variant/{p}")).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await w.Get($"/api/advisor/werkzeug/variant/{w.Ids["neu-v"]}")).Status);
    }
}
