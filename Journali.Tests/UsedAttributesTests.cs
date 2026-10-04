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

// Vor dem Umhängen prüft die Oberfläche, welche Attribute im Teilbaum Werte haben. Das sagt jetzt der Server, nur die Schlüssel:
// die ganze Tabelle eines grossen Zweigs (zehntausende Zeilen, hunderte Spalten) brachte den Browser zum Absturz (04.10.2026).
public class UsedAttributesTests
{
    [Fact]
    public async Task Der_Teilbaum_nennt_die_Attribute_mit_eigenen_Werten_auch_in_Zeilen_und_nur_seine()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, w) =>
        {
            foreach (var (key, typ, spalten) in new[] { ("farbe", "text", (string[]?)null), ("leistung", "decimal", null), ("unbenutzt", "text", null), ("fremd", "text", null),
                ("anteil", "text", null), ("teile", "rows", ["anteil"]) })
                w("t", Model.AttributeStream + key, Types.AttributeDefined, new AttributeDefinition(key, Labels.Of(key, key), typ, Group: "mastergroup", Columns: spalten), null);
            return 0;
        });
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Services.AddSingleton(c);
        await using var app = b.Build();
        app.Use(async (ctx, next) => { ctx.Request.Headers["X-Actor"] = "u"; await next(); });
        BatchApi.Map(app.MapGroup("/api")); await app.StartAsync();
        try
        {
            const string json = """
            {"commands":[
              {"op":"group.create","ref":"g","args":{"name":"Zweig"}},
              {"op":"groups.attach","args":{"node":"@g","groups":["mastergroup"]}},
              {"op":"product.create","ref":"p","args":{"group":"@g"}},
              {"op":"attribute.set","args":{"node":"@p","attribute":"farbe","value":"rot"}},
              {"op":"variant.create","ref":"v","args":{"product":"@p","axisValues":{}}},
              {"op":"attribute.set","args":{"node":"@v","attribute":"leistung","value":"45"}},
              {"op":"row.add","ref":"r1","args":{"node":"@v","attribute":"teile"}},
              {"op":"attribute.set","args":{"node":"@v","attribute":"anteil","row":"@r1","value":"x"}},
              {"op":"group.create","ref":"a","args":{"name":"Anderer Zweig"}},
              {"op":"groups.attach","args":{"node":"@a","groups":["mastergroup"]}},
              {"op":"product.create","ref":"q","args":{"group":"@a"}},
              {"op":"attribute.set","args":{"node":"@q","attribute":"fremd","value":"y"}}
            ]}
            """;
            using var http = new HttpClient();
            var res = await http.PostAsync(app.Urls.First() + "/api/batch", new StringContent(json, Encoding.UTF8, "application/json"));
            var text = await res.Content.ReadAsStringAsync();
            Assert.True(res.IsSuccessStatusCode, $"{(int)res.StatusCode}: {text}");
            var antwort = JsonDocument.Parse(text).RootElement;
            Assert.True(antwort.GetProperty("error").ValueKind == JsonValueKind.Null, antwort.GetProperty("error").ToString());
            var ids = antwort.GetProperty("results").EnumerateArray().Where(r => r.GetProperty("ref").ValueKind == JsonValueKind.String)
                .ToDictionary(r => r.GetProperty("ref").GetString()!, r => r.GetProperty("node").GetString()!);

            c.With((_, tree, _) =>
            {
                var zweig = TreeApi.UsedAttributes(tree, ids["g"], null, false)!.Value;
                Assert.Contains("farbe", zweig.Attributes); Assert.Contains("leistung", zweig.Attributes);
                Assert.Contains("teile", zweig.Attributes);                     // ein Zeilenattribut mit Zeilen
                Assert.Contains("anteil", zweig.Attributes);                    // und die Spalte darin
                Assert.DoesNotContain("unbenutzt", zweig.Attributes);
                Assert.DoesNotContain("fremd", zweig.Attributes);               // gehört zum anderen Zweig
                Assert.Equal(3, zweig.Nodes);                                   // Gruppe, Produkt, Variante
                Assert.DoesNotContain("farbe", TreeApi.UsedAttributes(tree, ids["v"], null, false)!.Value.Attributes);   // geerbt ist nicht eigen
                Assert.Null(TreeApi.UsedAttributes(tree, "gibtsnicht", null, false));
                return 0;
            });
        }
        finally { await app.StopAsync(); }
    }
}
