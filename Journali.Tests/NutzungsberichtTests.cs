using System.Net;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Licensing;
using Journali.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Journali.Tests;

/// <summary>
/// Nutzungsberichte (05.10.2026): aus als Voreinstellung; das Einschalten steht mit Wortlaut im Journal, die Kennung bleibt über Aus und An dieselbe,
/// gesendet wird nur eingeschaltet und einmal im Monat — je Monat die Einträge nach Art, keine Namen.
/// </summary>
public class NutzungsberichtTests
{
    [Fact]
    public async Task Einschalten_steht_im_Journal_und_die_Kennung_bleibt()
    {
        var journal = new MemoryJournal();
        var c = new Catalog(journal); c.Rebuild(); c.SeedMissing();
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Services.AddSingleton(c); b.Services.AddSingleton<IJournal>(journal);
        await using var app = b.Build();
        app.Use(async (ctx, next) => { ctx.Request.Headers["X-Actor"] = "admin"; await next(); });
        NutzungsberichtApi.Map(app.MapGroup("/api"), "1.2.3");
        await app.StartAsync();
        using var http = new HttpClient();
        var url = app.Urls.First();

        Assert.False(NutzungsberichtApi.Stand(journal).An);   // Voreinstellung: aus
        Assert.Contains("\"on\":false", await http.GetStringAsync(url + "/api/usage/report"));

        Assert.True((await http.PostAsync(url + "/api/usage/report?on=true", null)).IsSuccessStatusCode);
        var an = NutzungsberichtApi.Stand(journal);
        Assert.True(an.An);
        Assert.Equal("admin", an.Wer);
        var eintrag = journal.ReadStream(NutzungsberichtApi.Stream).Last();
        Assert.Equal(NutzungsberichtApi.Text, Types.Deserialize<UsageReportsSet>(eintrag.Payload).Text);   // der Wortlaut, den der Administrator gesehen hat
        Assert.Equal(Kinds.Setup, Kinds.Of(eintrag.Type));

        Assert.True((await http.PostAsync(url + "/api/usage/report?on=false", null)).IsSuccessStatusCode);
        Assert.False(NutzungsberichtApi.Stand(journal).An);
        Assert.True((await http.PostAsync(url + "/api/usage/report?on=true", null)).IsSuccessStatusCode);
        Assert.Equal(an.Id, NutzungsberichtApi.Stand(journal).Id);   // dieselbe Kennung: der Lizenzserver ersetzt den Bericht
        Assert.Contains(an.Id!, await http.GetStringAsync(url + "/api/usage/report"));
    }

    private sealed class Empfang : HttpMessageHandler
    {
        public readonly List<(string Url, string Rumpf)> Angekommen = [];
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
        {
            Angekommen.Add((req.RequestUri!.ToString(), await req.Content!.ReadAsStringAsync(ct)));
            return new HttpResponseMessage(HttpStatusCode.OK);
        }
    }

    [Fact]
    public async Task Gesendet_wird_nur_eingeschaltet_und_einmal_im_Monat()
    {
        var journal = new MemoryJournal();
        var c = new Catalog(journal); c.Rebuild(); c.SeedMissing();
        var dir = Path.Combine(Path.GetTempPath(), "journali-bericht-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(dir);
        var empfang = new Empfang();
        using var http = new HttpClient(empfang);
        var heute = new DateOnly(2026, 10, 5);

        Assert.Null(await NutzungsberichtApi.SendenAsync(c, journal, http, "https://lizenz.example", dir, "1.2.3", heute));
        Assert.Empty(empfang.Angekommen);   // aus: nichts geht hinaus

        var id = Guid.NewGuid().ToString("N");
        c.With((_, _, w) => w("admin", NutzungsberichtApi.Stream, Types.UsageReportsSet, new UsageReportsSet(true, id, NutzungsberichtApi.Text), null));
        Assert.Equal("usage report sent", await NutzungsberichtApi.SendenAsync(c, journal, http, "https://lizenz.example/", dir, "1.2.3", heute));
        Assert.Null(await NutzungsberichtApi.SendenAsync(c, journal, http, "https://lizenz.example", dir, "1.2.3", heute.AddDays(3)));   // derselbe Monat
        Assert.Equal("usage report sent", await NutzungsberichtApi.SendenAsync(c, journal, http, "https://lizenz.example", dir, "1.2.3", new DateOnly(2026, 11, 1)));

        Assert.Equal(2, empfang.Angekommen.Count);
        var (ziel, rumpf) = empfang.Angekommen[0];
        Assert.Equal("https://lizenz.example/v1/bericht", ziel);
        Assert.Contains(id, rumpf);
        Assert.Contains("\"version\":\"1.2.3\"", rumpf);
        Assert.DoesNotContain("admin", rumpf);   // kein Name
        var bericht = System.Text.Json.JsonSerializer.Deserialize<Nutzungsbericht>(rumpf, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));
        Assert.Null(Nutzungsbericht.Fehler(bericht));   // der Lizenzserver nimmt ihn an
        Assert.True(bericht!.Monate[0].Arten[Kinds.Setup] >= 1);
    }

    [Fact]
    public void Der_Lizenzserver_nimmt_nur_einen_gueltigen_Bericht_an()
    {
        var gut = new Nutzungsbericht(Guid.NewGuid().ToString("N"), "1.2.3", [new BerichtMonat("2026-10", new Dictionary<string, int> { ["data"] = 3 })]);
        Assert.Null(Nutzungsbericht.Fehler(gut));
        Assert.NotNull(Nutzungsbericht.Fehler(null));
        Assert.NotNull(Nutzungsbericht.Fehler(gut with { Id = "keine-kennung" }));
        Assert.NotNull(Nutzungsbericht.Fehler(gut with { Version = new string('x', 40) }));
        Assert.NotNull(Nutzungsbericht.Fehler(gut with { Monate = [new BerichtMonat("Oktober", new Dictionary<string, int>())] }));
        Assert.NotNull(Nutzungsbericht.Fehler(gut with { Monate = [new BerichtMonat("2026-10", new Dictionary<string, int> { ["data"] = -1 })] }));
        Assert.NotNull(Nutzungsbericht.Fehler(gut with { Monate = Enumerable.Range(0, 121).Select(i => new BerichtMonat("2026-10", new Dictionary<string, int>())).ToList() }));
    }
}
