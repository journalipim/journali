using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Journali.Tests;

/// <summary>
/// Plugins mit Hinweis (05.10.2026, Manifest: acknowledge — etwa Rechtsinhalt): eingeschaltet wird nur mit der bestätigten Version, die Bestätigung
/// steht im Journal (wer, wann, Version, Wortlaut), und die Saat schaltet ein solches Plugin nicht von selbst ein.
/// </summary>
[Collection("Startphase")]   // wie im Betrieb mit Startphase (sonst entscheidet der Tarif zuerst) — der Schalter ist statisch, darum allein
public class PluginHinweisTests : IDisposable
{
    public PluginHinweisTests() => Journali.Core.Licensing.Startphase.An = true;
    public void Dispose() => Journali.Core.Licensing.Startphase.An = false;

    private const string Manifest = """{"key":"recht","version":"1.0.0","acknowledge":{"version":"2026-10-05","title":{"de":"Hilfsmittel, keine Rechtsberatung"},"points":[{"de":"Keine Rechtsberatung."},{"de":"Keine Gewähr."}]}}""";

    [Fact]
    public async Task Einschalten_nur_mit_bestaetigtem_Hinweis_und_die_Bestaetigung_steht_im_Journal()
    {
        var journal = new MemoryJournal();
        var c = new Catalog(journal); c.Rebuild(); c.SeedMissing();
        c.With((_, _, w) => w("t", Plugins.Stream + "recht", Types.PluginInstalled, new PluginInstalled("1.0.0", Manifest), null));
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Services.AddSingleton(c); b.Services.AddSingleton<IJournal>(journal);
        await using var app = b.Build();
        app.Use(async (ctx, next) => { ctx.Request.Headers["X-Actor"] = "anwender1"; await next(); });
        PluginApi.Map(app.MapGroup("/api"), Path.GetTempPath());
        await app.StartAsync();
        using var http = new HttpClient();
        var url = app.Urls.First();
        PluginState Zustand() => c.Lesen((_, _) => c.Plugins.All["recht"]);

        var ohne = await http.PostAsync(url + "/api/plugins/recht/enable", null);
        Assert.False(ohne.IsSuccessStatusCode);
        Assert.Contains("Hinweis", await ohne.Content.ReadAsStringAsync());
        Assert.False(Zustand().Enabled);
        Assert.False((await http.PostAsync(url + "/api/plugins/recht/enable?hinweis=2026-01-01", null)).IsSuccessStatusCode);   // eine andere Version zählt nicht

        Assert.True((await http.PostAsync(url + "/api/plugins/recht/enable?hinweis=2026-10-05", null)).IsSuccessStatusCode);
        Assert.True(Zustand().Enabled);
        Assert.Equal(("2026-10-05", "anwender1"), (Zustand().Acknowledged, Zustand().AcknowledgedBy));
        var eintrag = journal.ReadStream(Plugins.Stream + "recht").Last(e => e.Type == Types.PluginAcknowledged);
        var p = Types.Deserialize<PluginAcknowledged>(eintrag.Payload);
        Assert.Equal("Hilfsmittel, keine Rechtsberatung\nKeine Rechtsberatung.\nKeine Gewähr.", p.Text);   // der Wortlaut, den der Anwender gesehen hat
        Assert.Equal("anwender1", eintrag.Actor);
    }

    [Fact]
    public async Task Ein_schon_eingeschaltetes_Plugin_bestaetigt_den_Hinweis_nachtraeglich()
    {
        var journal = new MemoryJournal();
        var c = new Catalog(journal); c.Rebuild(); c.SeedMissing();
        c.With((_, _, w) => { w("t", Plugins.Stream + "recht", Types.PluginInstalled, new PluginInstalled("1.0.0", Manifest), null); return w("t", Plugins.Stream + "recht", Types.PluginEnabled, new PluginEnabled(), null); });
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Services.AddSingleton(c); b.Services.AddSingleton<IJournal>(journal);
        await using var app = b.Build();
        app.Use(async (ctx, next) => { ctx.Request.Headers["X-Actor"] = "anwender1"; await next(); });
        PluginApi.Map(app.MapGroup("/api"), Path.GetTempPath());
        await app.StartAsync();
        using var http = new HttpClient();
        Assert.False((await http.PostAsync(app.Urls.First() + "/api/plugins/recht/acknowledge", null)).IsSuccessStatusCode);
        Assert.True((await http.PostAsync(app.Urls.First() + "/api/plugins/recht/acknowledge?hinweis=2026-10-05", null)).IsSuccessStatusCode);
        Assert.Equal("2026-10-05", c.Lesen((_, _) => c.Plugins.All["recht"].Acknowledged));
    }

    [Fact]
    public void Die_Saat_installiert_ein_Plugin_mit_Hinweis_ohne_es_einzuschalten()
    {
        var dir = Path.Combine(Path.GetTempPath(), "journali-hinweis-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(dir, "recht")); Directory.CreateDirectory(Path.Combine(dir, "frei"));
        File.WriteAllText(Path.Combine(dir, "recht", "plugin.json"), Manifest.Replace("\"version\":\"1.0.0\",", "\"version\":\"1.0.0\",\"autoInstall\":true,"));
        File.WriteAllText(Path.Combine(dir, "frei", "plugin.json"), """{"key":"frei","version":"1.0.0","autoInstall":true}""");
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        PluginApi.AutoInstall(c, dir, auchFremde: true);   // die Plugins hier tragen kein Siegel von journali
        Assert.False(c.Lesen((_, _) => c.Plugins.All["recht"].Enabled));
        Assert.True(c.Lesen((_, _) => c.Plugins.All["frei"].Enabled));
        Assert.NotNull(PluginApi.Hinweis(System.Text.Json.JsonDocument.Parse(Manifest).RootElement));
    }
}
