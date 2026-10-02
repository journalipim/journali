using System.Text;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Journali.Tests;

// „Gilt das Attribut an diesem Knoten?“ ohne die Attribute der Gruppen aufzuzählen (IstAktiv) muss dasselbe sagen wie die Aufzählung
// (ActiveAttributes). Der Import fragt es je Befehl: mit 1 500 Attributen in den Gruppen kostete die Aufzählung 40-mal so lange.
public class IstAktivTests
{
    [Fact]
    public async Task IstAktiv_sagt_dasselbe_wie_die_Aufzaehlung_der_aktiven_Attribute()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        var rnd = new Random(7);
        string[] gruppen = ["ga", "gb", "gc", "gd"];                      // gd: nur an Attributen genannt, nicht definiert
        string?[] heimat = ["ga", "gb", "gc", "gd", null];
        string[]?[] stufen = [null, ["product"], ["variant", "product"], ["group"], ["variant"]];
        c.With((_, _, w) =>
        {
            w("t", Model.GroupStream + "ga", Types.AttributeGroupDefined, new AttributeGroupDefinition("ga", Labels.Of("A", "A")), null);
            w("t", Model.GroupStream + "gb", Types.AttributeGroupDefined, new AttributeGroupDefinition("gb", Labels.Of("B", "B"), "product"), null);
            w("t", Model.GroupStream + "gc", Types.AttributeGroupDefined, new AttributeGroupDefinition("gc", Labels.Of("C", "C"), "variant"), null);
            w("t", Model.AttributeStream + "sel", Types.AttributeDefined, new AttributeDefinition("sel", Labels.Of("Sel", "Sel"), "text", Group: "ga"), null);
            for (var i = 0; i < 60; i++)
            {
                var key = "a" + i;
                var bedingung = rnd.Next(4) == 0 ? new AttributeCondition("sel", ["ja"]) : null;
                w("t", Model.AttributeStream + key, Types.AttributeDefined,
                    new AttributeDefinition(key, Labels.Of(key, key), "text", Group: heimat[rnd.Next(heimat.Length)], Levels: stufen[rnd.Next(stufen.Length)], When: bedingung), null);
                if (rnd.Next(3) == 0) w("t", Model.AttributeStream + key, Types.AttributeGroupsSet, new AttributeGroupsSet(key, gruppen.OrderBy(_ => rnd.Next()).Take(1 + rnd.Next(3)).ToArray()), null);
            }
            return 0;
        });
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Services.AddSingleton(c);
        await using var app = b.Build();
        app.Use(async (ctx, next) => { ctx.Request.Headers["X-Actor"] = "u"; await next(); });
        BatchApi.Map(app.MapGroup("/api")); await app.StartAsync();
        try
        {
            using var http = new HttpClient();
            for (var s = 0; s < 6; s++)
            {
                var sb = new StringBuilder("{\"commands\":[{\"op\":\"group.create\",\"ref\":\"g\",\"args\":{\"name\":\"G" + s + "\"}}");
                string An(string node) => rnd.Next(2) == 0 ? "" : ",{\"op\":\"groups.attach\",\"args\":{\"node\":\"" + node + "\",\"groups\":[" + string.Join(",", gruppen.OrderBy(_ => rnd.Next()).Take(1 + rnd.Next(3)).Select(x => "\"" + x + "\"")) + "]}}";
                sb.Append(An("@g"));
                for (var p = 0; p < 3; p++)
                {
                    sb.Append(",{\"op\":\"product.create\",\"ref\":\"p" + p + "\",\"args\":{\"group\":\"@g\"}}").Append(An("@p" + p));
                    for (var v = 0; v < 3; v++) sb.Append(",{\"op\":\"variant.create\",\"ref\":\"v" + p + v + "\",\"args\":{\"product\":\"@p" + p + "\",\"axisValues\":{}}}").Append(An("@v" + p + v));
                }
                sb.Append("]}");
                var res = await http.PostAsync(app.Urls.First() + "/api/batch?skipErrors=true", new StringContent(sb.ToString(), Encoding.UTF8, "application/json"));
                Assert.True(res.IsSuccessStatusCode);
            }
            // „sel“ an einigen Knoten auf ja: die Bedingung greift dort
            var ja = c.With((_, t, _) => t.Nodes.Values.Where(n => rnd.Next(3) == 0).Select(n => n.Id).ToList());
            var sw = new StringBuilder("{\"commands\":[");
            sw.Append(string.Join(",", ja.Select(id => "{\"op\":\"attribute.set\",\"args\":{\"node\":\"" + id + "\",\"attribute\":\"sel\",\"value\":\"ja\"}}")));
            await http.PostAsync(app.Urls.First() + "/api/batch?skipErrors=true", new StringContent(sw + "]}", Encoding.UTF8, "application/json"));
        }
        finally { await app.StopAsync(); }

        var (verglichen, aktive) = c.With((m, t, _) =>
        {
            int n = 0, a = 0;
            foreach (var node in t.Nodes.Values)
            {
                var aufgezaehlt = CompletenessRules.ActiveAttributes(t, m, node).Select(x => x.Key).ToHashSet();
                foreach (var def in m.Attributes.Values)
                {
                    n++; if (aufgezaehlt.Contains(def.Key)) a++;
                    Assert.True(aufgezaehlt.Contains(def.Key) == CompletenessRules.IstAktiv(t, m, node, def), $"{node.Role} {node.Id}: {def.Key}");
                }
            }
            return (n, a);
        });
        Assert.True(verglichen > 1000);
        Assert.InRange(aktive, 100, verglichen - 100);                  // beide Antworten kommen vor: kein Vergleich von lauter Nein
    }
}
