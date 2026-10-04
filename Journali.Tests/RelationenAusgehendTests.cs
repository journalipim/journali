using System.Net.Http.Json;
using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Journali.Tests;

/// <summary>
/// POST /api/relations/out (04.10.2026): die ausgehenden Relationen bestimmter Knoten im Format von /relations/tree — das Relationenblatt beim
/// Import fragt nur die Knoten, die die Datei nennt, nicht mehr den ganzen Baum ab der Wurzel.
/// </summary>
public class RelationenAusgehendTests
{
    [Fact]
    public async Task Nur_die_genannten_Knoten_nur_ausgehend()
    {
        var journal = new MemoryJournal();
        var c = new Catalog(journal); c.Rebuild(); c.SeedMissing();
        string p1 = "", p2 = "", p3 = "", rel = "";
        c.With((_, _, write) =>
        {
            var g = write("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("G", "G")), null).Stream;
            p1 = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(g), null).Stream;
            p2 = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(g), null).Stream;
            p3 = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(g), null).Stream;
            rel = write("t", Ids.Relation(), Types.RelationCreated, new RelationCreated("accessory", p1, p2), null).Stream;
            write("t", rel, Types.AttributeSet, new AttributeSet("quantity", null, null, "3", null), null);
            write("t", Ids.Relation(), Types.RelationCreated, new RelationCreated("accessory", p3, p1), null);   // ein anderer Ausgang: fehlt
            return 0;
        });
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Services.AddSingleton(c); b.Services.AddSingleton<IJournal>(journal);
        await using var app = b.Build();
        RelationApi.Map(app.MapGroup("/api"));
        await app.StartAsync();
        using var http = new HttpClient();
        var res = await http.PostAsJsonAsync(app.Urls.First() + "/api/relations/out", new { nodes = new[] { p1, p2, "gibtsnicht", p1 } });
        var j = JsonDocument.Parse(await res.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal([p1], j.EnumerateObject().Select(x => x.Name).ToList());   // p2 hat keine ausgehende, p3 ist nicht gefragt
        var r = j.GetProperty(p1)[0];
        Assert.Equal(rel, r.GetProperty("id").GetString());
        Assert.Equal("out", r.GetProperty("direction").GetString());
        Assert.Equal(p2, r.GetProperty("other").GetProperty("id").GetString());
        Assert.Equal("3", r.GetProperty("values").GetProperty("quantity").GetProperty("value").GetString());
        // dasselbe Format wie /relations/tree
        var baum = JsonDocument.Parse(await http.GetStringAsync(app.Urls.First() + "/api/nodes/" + p1 + "/relations/tree?deep=false")).RootElement;
        Assert.Equal(r.GetRawText(), baum.GetProperty(p1).EnumerateArray().First(x => x.GetProperty("direction").GetString() == "out").GetRawText());
    }
}
