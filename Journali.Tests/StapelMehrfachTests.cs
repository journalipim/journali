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
/// Mehrfachauswahl in Stapeln (04.10.2026): Medien in einen Ordner und Knoten in eine Rubrik über /api/batch — vorher eine Anfrage je Element.
/// </summary>
public class StapelMehrfachTests
{
    [Fact]
    public async Task Medien_in_einen_Ordner_und_Knoten_in_eine_Rubrik()
    {
        var journal = new MemoryJournal();
        var c = new Catalog(journal); c.Rebuild(); c.SeedMissing();
        string m1 = "", m2 = "", ordner = "", rubrik = "", g = "", p1 = "", v1 = "";
        c.With((_, _, write) =>
        {
            g = write("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("G", "G")), null).Stream;
            p1 = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(g), null).Stream;
            v1 = write("t", Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(p1, new() { ["color"] = "rot" }), null).Stream;
            m1 = write("t", Ids.Media(), Types.MediaCreated, new MediaCreated("a", 10, "image/png", "a.png"), null).Stream;
            m2 = write("t", Ids.Media(), Types.MediaCreated, new MediaCreated("b", 10, "image/png", "b.png"), null).Stream;
            ordner = write("t", Ids.MediaFolder(), Types.MediaFolderCreated, new MediaFolderCreated("Bilder", null), null).Stream;
            rubrik = write("t", Ids.New(Roles.Rubric), Types.RubricCreated, new RubricCreated(null, new(), "Web", "web", null), null).Stream;
            return 0;
        });
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Services.AddSingleton(c); b.Services.AddSingleton<IJournal>(journal);
        await using var app = b.Build();
        app.Use(async (ctx, next) => { ctx.Request.Headers["X-Actor"] = "u"; await next(); });
        BatchApi.Map(app.MapGroup("/api"));
        await app.StartAsync();
        using var http = new HttpClient();
        var cmds = new object[]
        {
            new { op = "media.file", args = new { media = m1, folder = ordner } },
            new { op = "media.file", args = new { media = m2, folder = ordner } },
            new { op = "rubric.place", args = new { rubric = rubrik, node = p1 } },
            new { op = "rubric.place", args = new { rubric = rubrik, node = v1 } },   // eine Variante hängt man nicht ein: Fehler, der Rest bleibt
        };
        var res = await http.PostAsJsonAsync(app.Urls.First() + "/api/batch?skipErrors=true", new { commands = cmds });
        var text = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, text);
        Assert.Equal(ordner, c.Lesen((_, _) => c.Media.All[m1].Folder));
        Assert.Equal(ordner, c.Lesen((_, _) => c.Media.All[m2].Folder));
        Assert.Equal([p1], c.Lesen((_, tree) => tree.Nodes[rubrik].Placed.ToList()));
        Assert.Contains("Varianten kommen mit dem Produkt", text);
    }
}
