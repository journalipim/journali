using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Journali.Tests;

/// <summary>
/// /api/nodes/{id}/media-below (04.10.2026): welche Nachfahren dasselbe Medium fest zugeordnet haben und wie viele schon erben — eine Anfrage
/// statt einer je Nachfahre.
/// </summary>
public class MedienDarunterTests
{
    [Fact]
    public async Task Gleiches_Medium_wird_gefunden_gestoppte_und_andere_nicht_geerbte_werden_gezaehlt()
    {
        var journal = new MemoryJournal();
        var c = new Catalog(journal); c.Rebuild(); c.SeedMissing();
        string product = "", v1 = "", v2 = "", v3 = "", gleich = "";
        c.With((_, _, write) =>
        {
            var root = write("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("G", "G")), null).Stream;
            product = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(root), null).Stream;
            v1 = write("t", Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(product, new() { ["color"] = "rot" }), null).Stream;
            v2 = write("t", Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(product, new() { ["color"] = "blau" }), null).Stream;
            v3 = write("t", Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(product, new() { ["color"] = "gelb" }), null).Stream;
            var bild = write("t", Ids.Media(), Types.MediaCreated, new MediaCreated("abc", 10, "image/png", "bild.png"), null).Stream;
            var anderes = write("t", Ids.Media(), Types.MediaCreated, new MediaCreated("def", 10, "image/png", "anderes.png"), null).Stream;
            var eigen = write("t", Ids.Relation(), Types.RelationCreated, new RelationCreated("image", product, bild), null).Stream;
            write("t", eigen, Types.AttributeSet, new AttributeSet("inherit", null, null, "true", null), null);
            gleich = write("t", Ids.Relation(), Types.RelationCreated, new RelationCreated("image", v1, bild), null).Stream;            // v1: dasselbe fest → lösen
            var stop = write("t", Ids.Relation(), Types.RelationCreated, new RelationCreated("image", v2, bild), null).Stream;           // v2: gestoppt → bleibt
            write("t", stop, Types.AttributeSet, new AttributeSet("stop", null, null, "true", null), null);
            write("t", Ids.Relation(), Types.RelationCreated, new RelationCreated("image", v3, anderes), null);                         // v3: anderes Bild, erbt
            return 0;
        });
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Services.AddSingleton(c); b.Services.AddSingleton<IJournal>(journal);
        await using var app = b.Build();
        RelationApi.Map(app.MapGroup("/api"));
        await app.StartAsync();
        using var http = new HttpClient();
        var j = JsonDocument.Parse(await http.GetStringAsync(app.Urls.First() + "/api/nodes/" + product + "/media-below")).RootElement;
        Assert.Equal(3, j.GetProperty("below").GetInt32());
        var retire = j.GetProperty("retire").EnumerateArray().ToList();
        Assert.Single(retire);
        Assert.Equal(gleich, retire[0].GetProperty("relation").GetString());
        Assert.Equal(v1, retire[0].GetProperty("node").GetProperty("id").GetString());
        Assert.Equal(1, j.GetProperty("already").GetInt32());   // v3 erbt das Bild des Produkts; v2 hat es gestoppt
        Assert.Equal(System.Net.HttpStatusCode.NotFound, (await http.GetAsync(app.Urls.First() + "/api/nodes/gibtsnicht/media-below")).StatusCode);
    }
}
