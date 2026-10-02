using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

namespace Journali.Tests;

// Ein Lauf, der an den Tasker abgegeben wird, gehört dem, der ihn abgegeben hat. Sonst liefe ein Import als Job
// am Kontingent vorbei: der Urheber `job:<key>` ist kein Anwender, und die Sperre greift nur bei Anwendern.
public class UebergabeTests
{
    private static Catalog Welt()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) =>
        {
            write("t", Users.Stream + "frei", Types.UserDefined, new UserDefined("Frei", null, "editor"), null);                       // kein Team
            write("t", Users.Stream + "u1", Types.UserDefined, new UserDefined("U1", null, "editor", true, Model.InitTeam), null);
            return 0;
        });
        return c;
    }

    private static bool Schreibt(Catalog c, string actor)
    {
        try { c.With((_, _, write) => write(actor, "n-test", Types.AttributeSet, new AttributeSet("name", "de", null, "x"), null)); return true; }
        catch (KeinKontingentException) { return false; }
    }

    private static void Job(Catalog c, string key, string? owner) =>
        c.With((_, _, write) => write("t", Jobs.Stream + key, Types.JobDefined,
            new JobDefined("Import", "solr", null, null, true, 180, null, null, null, owner), null));

    [Fact]
    public void Der_Lauf_geht_auf_das_Kontingent_seines_Eigentuemers()
    {
        var c = Welt();
        Job(c, "solr_import", "u1"); // u1 hat ein Team mit Kontingent
        Assert.True(Schreibt(c, "job:solr_import"));
    }

    [Fact]
    public void Wer_selbst_kein_Kontingent_hat_bekommt_auch_keins_ueber_einen_Job()
    {
        var c = Welt();
        Job(c, "solr_import", "frei");                       // Frei ist in keinem Team
        Assert.False(Schreibt(c, "job:solr_import"));
        Assert.False(Schreibt(c, "frei"));                   // von Hand geht es ebenso wenig
    }

    [Fact]
    public void Ein_Job_ohne_Eigentuemer_bleibt_wie_bisher_frei()
    {
        // Geplante Jobs (Sicherung, Ableitungen) gehören niemandem — sie laufen weiter
        var c = Welt();
        Job(c, "sicherung", null);
        Assert.True(Schreibt(c, "job:sicherung"));
    }

    [Fact]
    public void Der_Eigentuemer_steht_am_Job_und_ueberlebt_den_Neuaufbau()
    {
        var j = new MemoryJournal();
        var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        Job(c, "solr_import", "u1");
        Assert.Equal("u1", c.With((_, _, _) => c.Jobs.All["solr_import"].Owner));
        var wieder = new Catalog(j); wieder.Rebuild();
        Assert.Equal("u1", wieder.With((_, _, _) => wieder.Jobs.All["solr_import"].Owner));
    }

    // Die Rolle des abgegebenen Laufs ist die des Anfragenden: ein Import mit neuen Attributen braucht das Recht „model“,
    // und der Job lief bisher als „editor“, auch für einen Administrator. Eine am Job gesetzte Rolle hebt nicht über den Anfragenden hinaus.
    private static async Task<string?> Abgeben(string? bisher, string? rolleDesAnfragenden)
    {
        var dir = Path.Combine(Path.GetTempPath(), "journali-uebergabe-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(dir);
        var c = Welt();
        c.With((_, _, write) => { write("t", Plugins.Stream + "solr", Types.PluginInstalled, new PluginInstalled("1", "{}"), null); return write("t", Plugins.Stream + "solr", Types.PluginEnabled, new PluginEnabled(), null); });
        if (bisher is not null) c.With((_, _, write) => write("t", Jobs.Stream + "solr_import", Types.JobDefined, new JobDefined("Import", "solr", null, null, true, 180, null, null, bisher, "u1"), null));
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0");
        b.Services.AddSingleton(c);
        await using var app = b.Build();
        var runner = new JobRunner(c, dir, dir, NullLogger<JobRunner>.Instance);
        app.Use(async (ctx, next) => { ctx.Request.Headers["X-Actor"] = "u1"; if (rolleDesAnfragenden is not null) ctx.Items["role"] = rolleDesAnfragenden; await next(); });
        JobApi.Map(app.MapGroup("/api"), runner);
        await app.StartAsync();
        try
        {
            using var http = new HttpClient();
            // der Lauf selbst scheitert hier (kein Prozess im Plugin) — der Job ist vorher geschrieben
            await http.PostAsync(app.Urls.First() + "/api/jobs/solr_import/uebergabe", new StringContent("{\"service\":\"solr\",\"params\":{}}", System.Text.Encoding.UTF8, "application/json"));
            return c.With((_, _, _) => c.Jobs.All.GetValueOrDefault("solr_import")?.Role);
        }
        finally { await app.StopAsync(); Directory.Delete(dir, true); }
    }

    [Fact]
    public async Task Ein_abgegebener_Lauf_hat_die_Rolle_des_Anfragenden() => Assert.Equal("admin", await Abgeben(null, "admin"));

    [Fact]
    public async Task Eine_am_Job_gesetzte_hoehere_Rolle_gilt_nicht_fuer_einen_anderen_Anfragenden() => Assert.Equal("editor", await Abgeben("admin", "editor"));

    [Fact]
    public async Task Ohne_Anmeldung_bleibt_die_Rolle_am_Job_wie_sie_war() => Assert.Equal("admin", await Abgeben("admin", null));
}
