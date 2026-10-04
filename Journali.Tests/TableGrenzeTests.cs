using System.Net;
using System.Text;
using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Journali.Tests;

// /api/nodes/{id}/table und die Grösse (04.10.2026): ein Zweig mit 17 782 Zeilen × 783 Spalten waren 1 GB JSON, der Browser stürzte ab.
// Seiten (take, skip, total, next), children=false (nur der Knoten), sparse (nur Zellen mit Wert), und ohne Seiten eine Grenze mit Meldung.
[Collection("TableGrenze")]
public class TableGrenzeTests
{
    sealed class Welt : IAsyncDisposable
    {
        public WebApplication App = null!;
        public HttpClient Http = new();
        public Dictionary<string, string> Ids = new();
        public string Url => App.Urls.First();

        public static async Task<Welt> Neu()
        {
            var journal = new MemoryJournal();
            var c = new Catalog(journal); c.Rebuild(); c.SeedMissing();
            c.With((_, _, w) =>
            {
                foreach (var key in new[] { "farbe", "leer1", "leer2" })
                    w("t", Model.AttributeStream + key, Types.AttributeDefined, new AttributeDefinition(key, Labels.Of(key, key), "text", Group: "mastergroup"), null);
                w("t", Model.AttributeStream + "gewicht_x", Types.AttributeDefined, new AttributeDefinition("gewicht_x", Labels.Of("g", "g"), "decimal", Group: "mastergroup"), null);
                return 0;
            });
            var w = new Welt();
            var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Services.AddSingleton(c); b.Services.AddSingleton<IJournal>(journal);
            w.App = b.Build();
            w.App.Use(async (ctx, next) => { ctx.Request.Headers["X-Actor"] = "u"; await next(); });
            BatchApi.Map(w.App.MapGroup("/api")); TreeApi.Map(w.App.MapGroup("/api"));
            await w.App.StartAsync();
            // eine Gruppe mit fünf Produkten; farbe nur an zweien
            var cmds = new List<string> { """{"op":"group.create","ref":"g","args":{"name":"Zweig"}}""", """{"op":"groups.attach","args":{"node":"@g","groups":["mastergroup"]}}""" };
            for (var i = 1; i <= 5; i++) cmds.Add($$$"""{"op":"product.create","ref":"p{{{i}}}","args":{"group":"@g"}}""");
            cmds.Add("""{"op":"attribute.set","args":{"node":"@p1","attribute":"farbe","value":"rot"}}""");
            cmds.Add("""{"op":"attribute.set","args":{"node":"@p3","attribute":"farbe","value":"blau"}}""");
            var res = await w.Http.PostAsync(w.Url + "/api/batch", new StringContent("{\"commands\":[" + string.Join(",", cmds) + "]}", Encoding.UTF8, "application/json"));
            var j = JsonDocument.Parse(await res.Content.ReadAsStringAsync()).RootElement;
            Assert.True(j.GetProperty("error").ValueKind == JsonValueKind.Null, j.ToString());
            foreach (var r in j.GetProperty("results").EnumerateArray())
                if (r.GetProperty("ref").ValueKind == JsonValueKind.String) w.Ids[r.GetProperty("ref").GetString()!] = r.GetProperty("node").GetString()!;
            return w;
        }

        public async Task<(HttpStatusCode Status, JsonElement Json)> Get(string pfad)
        {
            var r = await Http.GetAsync(Url + pfad);
            var t = await r.Content.ReadAsStringAsync();
            return (r.StatusCode, t.Length > 0 ? JsonDocument.Parse(t).RootElement : default);
        }

        public async ValueTask DisposeAsync() { await App.StopAsync(); await App.DisposeAsync(); Http.Dispose(); }
    }

    static string[] Ids(JsonElement t) => t.GetProperty("rows").EnumerateArray().Select(r => r.GetProperty("row").GetProperty("id").GetString()!).ToArray();

    [Fact]
    public async Task Seitenweise_lesen_nennt_total_und_next_und_die_Seiten_ergeben_zusammen_die_ganze_Tabelle()
    {
        await using var w = await Welt.Neu();
        var g = w.Ids["g"];
        var (_, ganz) = await w.Get($"/api/nodes/{g}/table");
        Assert.Equal(5, ganz.GetProperty("total").GetInt32());
        Assert.Equal(JsonValueKind.Null, ganz.GetProperty("next").ValueKind);

        var gelesen = new List<string>();
        int? skip = 0;
        var seiten = 0;
        while (skip is { } s)
        {
            var (status, t) = await w.Get($"/api/nodes/{g}/table?take=2&skip={s}");
            Assert.Equal(HttpStatusCode.OK, status);
            gelesen.AddRange(Ids(t));
            skip = t.GetProperty("next").ValueKind == JsonValueKind.Null ? null : t.GetProperty("next").GetInt32();
            seiten++;
        }
        Assert.Equal(3, seiten);
        Assert.Equal(Ids(ganz), gelesen.ToArray());
    }

    [Fact]
    public async Task Children_false_liefert_nur_den_Knoten_selbst()
    {
        await using var w = await Welt.Neu();
        var (_, t) = await w.Get($"/api/nodes/{w.Ids["p1"]}/table?self=true&children=false");
        Assert.Equal([w.Ids["p1"]], Ids(t));
        var (_, g) = await w.Get($"/api/nodes/{w.Ids["g"]}/table?self=true&children=false");
        Assert.Equal([w.Ids["g"]], Ids(g));                                   // nicht die fünf Kinder dazu
    }

    [Fact]
    public async Task Sparse_laesst_leere_Zellen_und_die_inaktiven_Spalten_weg()
    {
        await using var w = await Welt.Neu();
        var (_, voll) = await w.Get($"/api/nodes/{w.Ids["g"]}/table?attributes=farbe,leer1,leer2");
        var (_, knapp) = await w.Get($"/api/nodes/{w.Ids["g"]}/table?attributes=farbe,leer1,leer2&sparse=true");
        var vollP2 = voll.GetProperty("rows").EnumerateArray().First(r => r.GetProperty("row").GetProperty("id").GetString() == w.Ids["p2"]);
        Assert.True(vollP2.GetProperty("values").TryGetProperty("leer1", out _));
        var knappZeilen = knapp.GetProperty("rows").EnumerateArray().ToDictionary(r => r.GetProperty("row").GetProperty("id").GetString()!);
        Assert.Empty(knappZeilen[w.Ids["p2"]].GetProperty("values").EnumerateObject());
        Assert.Equal("rot", knappZeilen[w.Ids["p1"]].GetProperty("values").GetProperty("farbe").GetProperty("value").GetString());
        Assert.Equal(JsonValueKind.Null, knappZeilen[w.Ids["p1"]].GetProperty("inactive").ValueKind);
        Assert.Equal(3, knapp.GetProperty("columns").GetArrayLength());       // die Spalten bleiben
    }

    [Fact]
    public async Task Ohne_Seiten_lehnt_der_Server_eine_zu_grosse_Tabelle_mit_Meldung_ab_mit_Seiten_nicht()
    {
        await using var w = await Welt.Neu();
        var vorher = TreeApi.MaxCells;
        TreeApi.MaxCells = 4;                                                 // 5 Zeilen × 3 Spalten = 15 Zellen
        try
        {
            var (status, j) = await w.Get($"/api/nodes/{w.Ids["g"]}/table?attributes=farbe,leer1,leer2");
            Assert.Equal(HttpStatusCode.BadRequest, status);
            Assert.Equal("Tabelle zu gross: {0} Zeilen × {1} Spalten, höchstens {2} Zellen je Abruf.", j.GetProperty("template").GetString());
            Assert.Contains("5", j.GetProperty("error").GetString());
            // seitenweise geht es: take wird auf höchstens MaxCells / Spalten geklemmt
            var (ok, t) = await w.Get($"/api/nodes/{w.Ids["g"]}/table?attributes=farbe,leer1,leer2&take=100");
            Assert.Equal(HttpStatusCode.OK, ok);
            Assert.Single(t.GetProperty("rows").EnumerateArray());             // 4 / 3 = 1 Zeile je Seite
            Assert.Equal(1, t.GetProperty("next").GetInt32());
        }
        finally { TreeApi.MaxCells = vorher; }
    }

    [Fact]
    public async Task Types_waehlt_die_Spalten_nach_ihrem_Typ()
    {
        await using var w = await Welt.Neu();
        var (_, t) = await w.Get($"/api/nodes/{w.Ids["g"]}/table?attributes=farbe,leer1,gewicht_x&types=text");
        Assert.Equal(["farbe", "leer1"], t.GetProperty("columns").EnumerateArray().Select(x => x.GetProperty("key").GetString()).ToArray());
        var (_, alle) = await w.Get($"/api/nodes/{w.Ids["g"]}/table?types=decimal");
        Assert.Contains("gewicht_x", alle.GetProperty("columns").EnumerateArray().Select(x => x.GetProperty("key").GetString()));
        Assert.DoesNotContain("farbe", alle.GetProperty("columns").EnumerateArray().Select(x => x.GetProperty("key").GetString()));
    }

    [Fact]
    public async Task Als_POST_nimmt_die_Tabelle_die_Spalten_aus_dem_Rumpf_und_braucht_nur_das_Recht_zu_lesen()
    {
        await using var w = await Welt.Neu();
        var res = await w.Http.PostAsync(w.Url + $"/api/nodes/{w.Ids["g"]}/table", new StringContent("""{"attributes":["farbe"],"sparse":true,"take":2,"skip":0}""", Encoding.UTF8, "application/json"));
        var t = JsonDocument.Parse(await res.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(["farbe"], t.GetProperty("columns").EnumerateArray().Select(x => x.GetProperty("key").GetString()).ToArray());
        Assert.Equal(2, t.GetProperty("rows").GetArrayLength()); Assert.Equal(2, t.GetProperty("next").GetInt32()); Assert.Equal(5, t.GetProperty("total").GetInt32());
        var ctx = new Microsoft.AspNetCore.Http.DefaultHttpContext(); ctx.Request.Method = "POST"; ctx.Request.Path = "/api/nodes/x/table";
        Assert.Equal(Rights.Read, Auth.Needed(ctx.Request));
    }
}
