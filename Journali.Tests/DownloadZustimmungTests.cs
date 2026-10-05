using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Journali.Tests;

/// <summary>
/// Plugins, die beim ersten Lauf eine Datei aus dem Netz holen (05.10.2026): der Server schaltet sie nur mit Zustimmung ein (?download=ja), und der
/// Einbetter für Suchfragen startet nicht, solange das Plugin aus ist — sonst holte er das Modell, ohne dass jemand zugestimmt hat.
/// </summary>
[Collection("Startphase")]   // der Schalter ist statisch: wie im Betrieb mit Startphase, darum allein
public class DownloadZustimmungTests : IDisposable
{
    public DownloadZustimmungTests() => Journali.Core.Licensing.Startphase.An = true;
    public void Dispose() => Journali.Core.Licensing.Startphase.An = false;

    [Fact]
    public async Task Ohne_Zustimmung_bleibt_ein_Plugin_mit_Download_aus()
    {
        var journal = new MemoryJournal();
        var c = new Catalog(journal); c.Rebuild(); c.SeedMissing();
        c.With((_, _, w) =>
        {
            w("t", Plugins.Stream + "dl", Types.PluginInstalled, new PluginInstalled("1.0.0", """{"key":"dl","version":"1.0.0","download":{"from":"cdn.jsdelivr.net"}}"""), null);
            return w("t", Plugins.Stream + "ohne", Types.PluginInstalled, new PluginInstalled("1.0.0", """{"key":"ohne","version":"1.0.0"}"""), null);
        });
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Services.AddSingleton(c); b.Services.AddSingleton<IJournal>(journal);
        await using var app = b.Build();
        app.Use(async (ctx, next) => { ctx.Request.Headers["X-Actor"] = "u"; await next(); });
        PluginApi.Map(app.MapGroup("/api"), Path.GetTempPath());
        await app.StartAsync();
        using var http = new HttpClient();
        var url = app.Urls.First();
        bool An(string k) => c.Lesen((_, _) => c.Plugins.All[k].Enabled);

        var nein = await http.PostAsync(url + "/api/plugins/dl/enable", null);
        Assert.False(nein.IsSuccessStatusCode);
        Assert.Contains("Zustimmung", await nein.Content.ReadAsStringAsync());
        Assert.False(An("dl"));

        Assert.True((await http.PostAsync(url + "/api/plugins/dl/enable?download=ja", null)).IsSuccessStatusCode);
        Assert.True(An("dl"));

        Assert.True((await http.PostAsync(url + "/api/plugins/ohne/enable", null)).IsSuccessStatusCode);   // ohne Download: wie bisher
        Assert.True(An("ohne"));
    }

    [Fact]
    public void Der_Einbetter_startet_nicht_solange_das_Plugin_aus_ist()
    {
        var e = new Embedder(Path.GetTempPath(), Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance) { Eingeschaltet = () => false };
        Assert.False(e.Available);
        Assert.Equal("Plugin embed ist aus.", e.Reason);
        Assert.ThrowsAsync<InvalidOperationException>(() => e.EmbedAsync("frage")).Wait();
    }
}
