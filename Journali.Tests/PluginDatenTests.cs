using System.Text;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Journali.Tests;

/// <summary>
/// Plugin-Daten (30.09.2026): was schon genau so im Journal steht, wird nicht noch einmal geschrieben — das Journal wächst nur,
/// und ein Plugin, das seine Daten bei jedem Einlesen neu schickt, füllte es mit Gleichem.
/// </summary>
public class PluginDatenTests
{
    private static Catalog Welt() { var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing(); return c; }
    private static void Setze(Catalog c, string name, string? wert) => c.With((_, _, write) => write("t", Plugins.Stream + "p", Types.PluginDataSet, new PluginDataSet(name, wert), null));

    [Fact]
    public void Derselbe_Wert_ist_unveraendert_ein_anderer_nicht()
    {
        var c = Welt();
        Setze(c, "a", """{"x":1}""");
        Assert.True(PluginApi.Unveraendert(c, "p", "a", """{"x":1}"""));
        Assert.False(PluginApi.Unveraendert(c, "p", "a", """{"x":2}"""));
        Assert.False(PluginApi.Unveraendert(c, "p", "neu", """{"x":1}"""));
        Assert.False(PluginApi.Unveraendert(c, "gibtsnicht", "a", """{"x":1}"""));
    }

    [Fact]
    public void Ein_leerer_Wert_meint_weg_und_ist_gleich_wenn_es_den_Datensatz_nicht_gibt()
    {
        var c = Welt();
        Assert.True(PluginApi.Unveraendert(c, "p", "a", null));
        Assert.True(PluginApi.Unveraendert(c, "p", "a", ""));
        Setze(c, "a", "[]");
        Assert.False(PluginApi.Unveraendert(c, "p", "a", null));
        Setze(c, "a", null);
        Assert.True(PluginApi.Unveraendert(c, "p", "a", null));
    }

    [Fact]
    public async Task Sammel_PUT_mit_null_nimmt_Datensaetze_zurueck()
    {
        // Zurücksetzen einer Bibliothek (04.10.2026): tausende Datensätze in einem Stapel statt einem DELETE je Datensatz
        var journal = new MemoryJournal();
        var c = new Catalog(journal); c.Rebuild(); c.SeedMissing();
        Setze(c, "class:a", "{}"); Setze(c, "class:b", "{}"); Setze(c, "bleibt", "{}");
        var bld = WebApplication.CreateBuilder(); bld.WebHost.UseUrls("http://127.0.0.1:0"); bld.Services.AddSingleton(c); bld.Services.AddSingleton<IJournal>(journal);
        await using var app = bld.Build();
        app.Use(async (ctx, next) => { ctx.Request.Headers["X-Actor"] = "u"; await next(); });
        PluginApi.Map(app.MapGroup("/api"), Path.GetTempPath());
        await app.StartAsync();
        using var http = new HttpClient();
        var res = await http.PutAsync(app.Urls.First() + "/api/plugins/p/data", new StringContent("{\"class:a\":null,\"class:b\":null,\"gibtsnicht\":null}", Encoding.UTF8, "application/json"));
        var text = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, text);
        Assert.Equal(["bleibt"], c.Lesen((_, _) => c.Plugins.All["p"].Data.Keys.ToList()));
        Assert.Contains("\"count\":2", text);
    }
}
