using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Journali.Tests;

/// <summary>
/// Plugins, die nicht von journali stammen (05.10.2026): installiert wird nur mit bestätigtem Warnhinweis (?fremd=ja), und die Saat installiert sie nicht.
/// </summary>
[Collection("Startphase")]   // wie im Betrieb mit Startphase (sonst entscheidet der Tarif zuerst) — der Schalter ist statisch, darum allein
public class PluginFremdTests : IDisposable
{
    private readonly string _dir = Path.Combine(Path.GetTempPath(), "journali-fremd-" + Guid.NewGuid().ToString("N"));
    public PluginFremdTests()
    {
        Journali.Core.Licensing.Startphase.An = true;
        Directory.CreateDirectory(Path.Combine(_dir, "fremd"));
        File.WriteAllText(Path.Combine(_dir, "fremd", "plugin.json"), """{"key":"fremd","version":"1.0.0","autoInstall":true}""");
    }
    public void Dispose() => Journali.Core.Licensing.Startphase.An = false;

    [Fact]
    public async Task Installieren_nur_mit_Bestaetigung()
    {
        var journal = new MemoryJournal();
        var c = new Catalog(journal); c.Rebuild(); c.SeedMissing();
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Services.AddSingleton(c); b.Services.AddSingleton<IJournal>(journal);
        await using var app = b.Build();
        app.Use(async (ctx, next) => { ctx.Request.Headers["X-Actor"] = "anwender1"; await next(); });
        PluginApi.Map(app.MapGroup("/api"), _dir);
        await app.StartAsync();
        using var http = new HttpClient();
        var url = app.Urls.First();

        var ohne = await http.PostAsync(url + "/api/plugins/fremd/install", null);
        Assert.False(ohne.IsSuccessStatusCode);
        Assert.Contains("nicht von journali", await ohne.Content.ReadAsStringAsync());
        Assert.False(c.Lesen((_, _) => c.Plugins.All.ContainsKey("fremd")));

        Assert.True((await http.PostAsync(url + "/api/plugins/fremd/install?fremd=ja", null)).IsSuccessStatusCode);
        Assert.True(c.Lesen((_, _) => c.Plugins.All.ContainsKey("fremd")));
    }

    [Fact]
    public void Die_Saat_installiert_kein_fremdes_Plugin()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        Assert.Equal(0, PluginApi.AutoInstall(c, _dir));
        Assert.False(c.Lesen((_, _) => c.Plugins.All.ContainsKey("fremd")));
    }
}
