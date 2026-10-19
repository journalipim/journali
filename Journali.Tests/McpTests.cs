using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Fremde Quellen des Produktberaters (19.10.2026, docs/pflegestruktur.md 43): journali fragt einen MCP-Server — der Client spricht Streamable
/// HTTP (JSON und Ereignisstrom, Sitzung, Anmeldung), die KI-Anfrage führt Werkzeugaufrufe aus und gibt die Ergebnisse zurück, am Berater stehen
/// die erlaubten Werkzeuge.
/// </summary>
[Collection("Startphase")]
public class McpTests
{
    /// <summary>Ein MCP-Server zum Prüfen: initialize vergibt eine Sitzung, tools/list antwortet als Ereignisstrom, tools/call als JSON.</summary>
    sealed class FremderServer : HttpMessageHandler
    {
        public readonly List<(string Methode, string? Sitzung, string? Auth, string? Kopf, JsonNode? Params)> Anfragen = new();
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
        {
            var nachricht = JsonNode.Parse(await req.Content!.ReadAsStringAsync(ct))!;
            var methode = nachricht["method"]!.GetValue<string>();
            Anfragen.Add((methode, req.Headers.TryGetValues("Mcp-Session-Id", out var s) ? s.First() : null, req.Headers.Authorization?.ToString(),
                req.Headers.TryGetValues("X-API-Key", out var k) ? k.First() : null, nachricht["params"]?.DeepClone()));
            var id = nachricht["id"]?.GetValue<int>();
            HttpResponseMessage Json(object o) => new(HttpStatusCode.OK) { Content = new StringContent(JsonSerializer.Serialize(o), Encoding.UTF8, "application/json") };
            switch (methode)
            {
                case "initialize":
                    var r = Json(new { jsonrpc = "2.0", id, result = new { protocolVersion = McpClient.ProtokollVersion, capabilities = new { tools = new { } }, serverInfo = new { name = "shop" } } });
                    r.Headers.Add("Mcp-Session-Id", "sitzung-1");
                    return r;
                case "notifications/initialized":
                    return new HttpResponseMessage(HttpStatusCode.Accepted);
                case "tools/list":
                    var liste = JsonSerializer.Serialize(new { jsonrpc = "2.0", id, result = new { tools = new object[] {
                        new { name = "verfuegbarkeit", description = "Bestand je Artikel", inputSchema = new { type = "object", properties = new { sku = new { type = "string" } }, required = new[] { "sku" } } },
                        new { name = "bestellen", description = "Legt eine Bestellung an", inputSchema = new { type = "object" } } } } });
                    return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent($"event: message\ndata: {liste}\n\n", Encoding.UTF8, "text/event-stream") };
                case "tools/call":
                    var sku = nachricht["params"]?["arguments"]?["sku"]?.GetValue<string>();
                    return sku == "kaputt"
                        ? Json(new { jsonrpc = "2.0", id, result = new { content = new[] { new { type = "text", text = "unbekannte SKU" } }, isError = true } })
                        : Json(new { jsonrpc = "2.0", id, result = new { content = new[] { new { type = "text", text = $"{sku}: 12 Stück am Lager" } } } });
                default:
                    return Json(new { jsonrpc = "2.0", id, error = new { code = -32601, message = "unbekannt" } });
            }
        }
    }

    static McpClient.Anmeldung Bearer(string t) => new(new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", t), null);

    [Fact]
    public async Task Der_Client_liest_die_Werkzeuge_aus_dem_Ereignisstrom_und_ruft_eines_mit_Sitzung_und_Anmeldung()
    {
        var server = new FremderServer();
        McpClient.Handler = server;
        try
        {
            var werkzeuge = await McpClient.WerkzeugeAsync("https://mcp.test/mcp", Bearer("geheim"), default);
            Assert.Equal(["verfuegbarkeit", "bestellen"], werkzeuge.Select(w => w.Name).ToArray());
            Assert.Equal("Bestand je Artikel", werkzeuge[0].Beschreibung);
            Assert.Equal("string", werkzeuge[0].Schema.GetProperty("properties").GetProperty("sku").GetProperty("type").GetString());
            Assert.Equal(["initialize", "notifications/initialized", "tools/list"], server.Anfragen.Select(a => a.Methode).ToArray());
            Assert.All(server.Anfragen, a => Assert.Equal("Bearer geheim", a.Auth));
            Assert.Null(server.Anfragen[0].Sitzung);
            Assert.Equal("sitzung-1", server.Anfragen[2].Sitzung);   // nach initialize mit der Sitzung des Servers

            var (text, fehler) = await McpClient.AufrufAsync("https://mcp.test/mcp", Bearer("geheim"), "verfuegbarkeit", JsonDocument.Parse("""{"sku":"TW-1"}""").RootElement, default);
            Assert.Equal(("TW-1: 12 Stück am Lager", false), (text, fehler));
            Assert.Equal("TW-1", server.Anfragen.Last().Params!["arguments"]!["sku"]!.GetValue<string>());
            Assert.True((await McpClient.AufrufAsync("https://mcp.test/mcp", Bearer("geheim"), "verfuegbarkeit", JsonDocument.Parse("""{"sku":"kaputt"}""").RootElement, default)).Fehler);
            // ein eigener Kopf statt Bearer
            await McpClient.WerkzeugeAsync("https://mcp.test/mcp", new McpClient.Anmeldung(null, ("X-API-Key", "k1")), default);
            Assert.Equal("k1", server.Anfragen.Last().Kopf);
        }
        finally { McpClient.Handler = null; }
    }

    [Fact]
    public void Ein_Ereignisstrom_kann_mehrere_Ereignisse_und_Zeilen_haben()
    {
        Assert.Equal(["{\"a\":1}", "{\"b\":\n2}"], McpClient.Ereignisse("event: message\ndata: {\"a\":1}\n\ndata: {\"b\":\ndata: 2}\n\n").ToArray());
    }

    [Fact]
    public async Task Die_KI_ruft_ein_Werkzeug_journali_fuehrt_es_aus_und_gibt_ihr_das_Ergebnis()
    {
        var anfragen = new List<JsonNode>();
        var antworten = new Queue<string>([
            """{"content":[{"type":"thinking","thinking":"","signature":"x"},{"type":"tool_use","id":"t1","name":"shop__verfuegbarkeit","input":{"sku":"TW-1"}}],"stop_reason":"tool_use","usage":{"input_tokens":100,"output_tokens":20}}""",
            """{"content":[{"type":"text","text":"TW-1 ist lieferbar: 12 Stück."}],"stop_reason":"end_turn","usage":{"input_tokens":150,"output_tokens":10}}""",
        ]);
        AiApi.Senden = async (req, ct) =>
        {
            anfragen.Add(JsonNode.Parse(await req.Content!.ReadAsStringAsync(ct))!);
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(antworten.Dequeue(), Encoding.UTF8, "application/json") };
        };
        var gerufen = new List<string>();
        var werkzeug = new AiApi.KiWerkzeug("shop__verfuegbarkeit", "Bestand", JsonDocument.Parse("""{"type":"object"}""").RootElement,
            (a, _) => { gerufen.Add(a.GetProperty("sku").GetString()!); return Task.FromResult(("12 Stück am Lager", false)); });
        try
        {
            var r = await AiApi.CallMitWerkzeugen("k", "claude-sonnet-5-5", "S", "Ist TW-1 lieferbar?", 600, [werkzeug], default);
            Assert.Equal("TW-1 ist lieferbar: 12 Stück.", r.Text);
            Assert.Equal(["TW-1"], gerufen);
            Assert.Equal((250, 30), (r.TokensIn, r.TokensOut));
            Assert.Equal("shop__verfuegbarkeit", anfragen[0]["tools"]![0]!["name"]!.GetValue<string>());
            // die zweite Anfrage: die Antwort der KI unverändert (mit ihrem Nachdenken), dann das Ergebnis
            var gespraech = anfragen[1]["messages"]!.AsArray();
            Assert.Equal(["user", "assistant", "user"], gespraech.Select(m => m!["role"]!.GetValue<string>()).ToArray());
            Assert.Equal("thinking", gespraech[1]!["content"]![0]!["type"]!.GetValue<string>());
            var ergebnis = gespraech[2]!["content"]![0]!;
            Assert.Equal(("tool_result", "t1", "12 Stück am Lager", false), (ergebnis["type"]!.GetValue<string>(), ergebnis["tool_use_id"]!.GetValue<string>(), ergebnis["content"]!.GetValue<string>(), ergebnis["is_error"]!.GetValue<bool>()));
        }
        finally { AiApi.Senden = null; }
    }

    [Fact]
    public async Task Hoechstens_vier_Werkzeugaufrufe_je_Anfrage()
    {
        var runde = 0;
        AiApi.Senden = (req, ct) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(++runde <= 6
                ? $$$"""{"content":[{"type":"tool_use","id":"t{{{runde}}}","name":"w","input":{}}],"stop_reason":"tool_use","usage":{}}"""
                : """{"content":[{"type":"text","text":"fertig"}],"stop_reason":"end_turn","usage":{}}""", Encoding.UTF8, "application/json"),
        });
        var n = 0;
        var w = new AiApi.KiWerkzeug("w", null, default, (_, _) => { n++; return Task.FromResult(("x", false)); });
        try
        {
            await AiApi.CallMitWerkzeugen("k", "m", null, "q", 600, [w], default);
            Assert.Equal(AiApi.MaxWerkzeugAufrufe, n);
        }
        finally { AiApi.Senden = null; }
    }

    [Fact]
    public async Task Am_Berater_stehen_die_erlaubten_Werkzeuge_seiner_Zugaenge()
    {
        var dir = Directory.CreateTempSubdirectory("mcp-berater").FullName;
        var c = new Catalog(new MemoryJournal());
        c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) =>
        {
            write("t", Plugins.Stream + "driver", Types.PluginInstalled, new PluginInstalled("1", "{}"), null);
            write("t", Plugins.Stream + "driver", Types.PluginDataSet, new PluginDataSet("zugang:shop",
                """{"key":"shop","art":"mcp","label":"Shop-System","felder":{"url":"https://mcp.test/mcp","auth":"bearer"}}"""), null);
            return 0;
        });
        Secrets.Set(dir, Secrets.ProfileKey("driver", "shop"), new() { ["secret"] = "geheim" });
        var server = new FremderServer();
        McpClient.Handler = server; AdvisorQuellen.VorratLeeren();
        try
        {
            var d = new AdvisorApi.Definition(Quellen: [new("shop", ["verfuegbarkeit"]), new("gibt-es-nicht", ["x"])]);
            var w = await AdvisorQuellen.WerkzeugeAsync(c, d, "berater", dir, default);
            Assert.Equal(["shop__verfuegbarkeit"], w.Select(x => x.Name).ToArray());   // „bestellen“ ist nicht freigegeben
            Assert.Equal("Bestand je Artikel (Quelle: Shop-System)", w[0].Beschreibung);
            var r = await w[0].Aufruf(JsonDocument.Parse("""{"sku":"TW-2"}""").RootElement, default);
            Assert.Equal("TW-2: 12 Stück am Lager", r.Text);
            Assert.Equal("Bearer geheim", server.Anfragen.Last().Auth);   // das Geheimnis aus dem Tresor, beim Server
            // die Definition trägt die Quellen
            Assert.Equal("verfuegbarkeit", AdvisorApi.Definition.Read(d.Write()).Def!.Quellen![0].Werkzeuge[0]);
            Assert.Empty(await AdvisorQuellen.WerkzeugeAsync(c, new AdvisorApi.Definition(), "berater", dir, default));
            Assert.Equal("a_b__c_d", AdvisorQuellen.Name("a.b", "c d"));
            // die Bitten an die KI nennen die Werkzeuge nur, wenn es welche gibt
            Assert.Contains(AdvisorApi.WerkzeugHinweis, AdvisorApi.Prompt("x", [], [], werkzeuge: true).System);
            Assert.DoesNotContain(AdvisorApi.WerkzeugHinweis, AdvisorApi.Prompt("x", [], []).System);
            Assert.Contains("Prüfe zuerst mit den angebotenen Werkzeugen", AdvisorApi.PromptFremd("x", [], "b", [], "de", werkzeuge: true).System);
        }
        finally { McpClient.Handler = null; AdvisorQuellen.VorratLeeren(); Directory.Delete(dir, true); }
    }
}
