using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Journali.Tests;

/// <summary>
/// Hinweise zum Betrieb (05.10.2026): bestätigt wird die geltende Version; der Eintrag trägt Version, Wortlaut, wer und wann.
/// </summary>
public class BetriebshinweisTests
{
    [Fact]
    public async Task Bestaetigt_wird_die_geltende_Version_mit_Wortlaut_im_Journal()
    {
        var journal = new MemoryJournal();
        var c = new Catalog(journal); c.Rebuild(); c.SeedMissing();
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Services.AddSingleton(c); b.Services.AddSingleton<IJournal>(journal);
        await using var app = b.Build();
        app.Use(async (ctx, next) => { ctx.Request.Headers["X-Actor"] = "admin"; await next(); });
        BetriebshinweisApi.Map(app.MapGroup("/api"));
        await app.StartAsync();
        using var http = new HttpClient();
        var url = app.Urls.First();

        Assert.Contains("\"acknowledged\":null", await http.GetStringAsync(url + "/api/notice"));
        Assert.False((await http.PostAsync(url + "/api/notice/acknowledge?version=2000-01-01", null)).IsSuccessStatusCode);   // eine andere Version zählt nicht
        Assert.Null(BetriebshinweisApi.Bestaetigt(journal));

        Assert.True((await http.PostAsync(url + "/api/notice/acknowledge?version=" + BetriebshinweisApi.Version, null)).IsSuccessStatusCode);
        var e = journal.ReadStream(BetriebshinweisApi.Stream).Single();
        var p = Types.Deserialize<NoticeAcknowledged>(e.Payload);
        Assert.Equal(BetriebshinweisApi.Version, p.Version);
        Assert.Contains("Sicherung, Aufbewahrung und die Probe der Wiederherstellung liegen beim Betreiber.", p.Text);
        Assert.Equal("admin", e.Actor);
        Assert.Equal(Kinds.Setup, Kinds.Of(e.Type));
        Assert.Contains($"\"acknowledged\":\"{BetriebshinweisApi.Version}\"", await http.GetStringAsync(url + "/api/notice"));

        Assert.True((await http.PostAsync(url + "/api/notice/acknowledge?version=" + BetriebshinweisApi.Version, null)).IsSuccessStatusCode);
        Assert.Single(journal.ReadStream(BetriebshinweisApi.Stream));   // ein zweites Mal schreibt nichts
    }
}
