using Journali.Core.Journal;
using Journali.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Journali.Tests;

/// <summary>
/// Zugänge (Treiber). Ein Plugin fragt nach einem Zugang seiner Art statt selbst nach Adresse und Passwort. Zwei
/// Sorten: einer, der Dateien liefert (Dateisystem, später FTP und WebDAV), und einer, der nur Anmeldung ist
/// (MySQL, Solr, IXP) — bei dem hält der Treiber die Felder bereit und ist keine Schicht über der Datenbank
/// (25.09.2026).
/// </summary>
public class DriverApiTests
{
    [Fact]
    public void Der_lokale_Zugang_ist_eingebaut_und_liefert_Dateien()
    {
        var art = DriverApi.ArtVon("file");
        Assert.NotNull(art);
        Assert.True(art!.Dateien);
        // Das Dateisystem des Servers braucht keine Einrichtung: keine Felder, kein Geheimnis
        Assert.Empty(art.Felder);
        Assert.Empty(art.Geheim);
    }

    [Fact]
    public void Angeboten_wird_nur_was_traegt()
    {
        // Eine Art, die noch nicht umgesetzt ist, steht nicht in der Liste: sonst waehlt jemand sie und bekommt
        // beim ersten Klick „ist noch nicht gebaut“ (25.09.2026). Seit 28.09.2026 hat jede Art, die Dateien liefert,
        // einen Treiber, und jede Anmeldung eine Weiterleitung — ausser mcp (19.10.2026): den fragt nur der Server, über McpClient
        Assert.Equal(new[] { "file", "webdav", "ftp", "ixp", "solr", "http", "mcp" }, DriverApi.Arten.Select(a => a.Key));
        foreach (var a in DriverApi.Arten.Where(a => a.Dateien))
            Assert.NotNull(Treiber.Fuer(new DriverApi.Zugang("z", a.Key, "", new() { ["url"] = "https://example.invalid/", ["host"] = "example.invalid" }), new Dictionary<string, string>()));
        Assert.All(DriverApi.Arten.Where(a => !a.Dateien && a.Key != "mcp"), a => Assert.Contains(a.Key, DriverApi.Anmeldungen));
        Assert.DoesNotContain("mcp", DriverApi.Anmeldungen);
        Assert.Null(DriverApi.ArtVon("mysql"));
    }

    [Fact]
    public void Eine_unbekannte_Art_gibt_es_nicht()
    {
        Assert.Null(DriverApi.ArtVon("gibtsnicht"));
        Assert.Null(DriverApi.ArtVon(""));
        Assert.Null(DriverApi.ArtVon(null));
    }

    [Fact]
    public void Ein_Geheimnis_steht_nie_unter_den_offenen_Feldern()
    {
        // Die offenen Felder gehen ins Journal, das Geheimnis zum Server. Gilt fuer jede Art, die je dazukommt
        Assert.All(DriverApi.Arten, a => Assert.Empty(a.Felder.Intersect(a.Geheim)));
    }

    [Theory]
    [InlineData("")]
    [InlineData("&raw=1")]
    [InlineData("&raw=true")]
    public async Task Die_Weiterleitung_nimmt_einen_Aufruf_mit_und_ohne_raw_an(string zusatz)
    {
        // Ein Parameter „bool raw“ ohne Vorgabe weist jeden Aufruf ohne ?raw ab (400 „Required parameter“) — die Ansicht des Imports
        // ruft ohne. Ein Zugang, den es nicht gibt, kommt erst nach dem Binden der Parameter: die Antwort nennt ihn.
        var dir = Path.Combine(Path.GetTempPath(), "journali-relay-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(dir);
        var b = WebApplication.CreateBuilder();
        b.WebHost.UseUrls("http://127.0.0.1:0");
        var cat = new Catalog(new MemoryJournal()); cat.Rebuild(); cat.SeedMissing();
        b.Services.AddSingleton(cat);
        await using var app = b.Build();
        DriverApi.Map(app.MapGroup("/api"), dir, app.Environment, dir);
        await app.StartAsync();
        try
        {
            using var http = new HttpClient();
            var res = await http.GetAsync(app.Urls.First() + "/api/drivers/gibtsnicht/relay?path=%2Fdocuments" + zusatz);
            var text = await res.Content.ReadAsStringAsync();
            Assert.Contains("gibtsnicht", text);
            Assert.DoesNotContain("Required parameter", text);
        }
        finally { await app.StopAsync(); Directory.Delete(dir, true); }
    }
}
