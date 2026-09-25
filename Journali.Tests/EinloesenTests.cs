using System.Net;
using System.Security.Cryptography;
using System.Text.Json;
using Journali.Core.Licensing;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Ein Schlüssel ohne Anforderung wird beim Lizenzserver eingelöst (25.09.2026): er vermerkt ihn und bestätigt signiert;
/// ein zweites Einlösen lehnt er ab. Ohne seine Bestätigung — nicht erreichbar, falsche Signatur, fremde Antwort — nicht.
/// </summary>
public class EinloesenTests
{
    private sealed class Lizenzserver : HttpMessageHandler
    {
        public readonly ECDsa Aussteller = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        public readonly HashSet<string> Eingeloest = [];
        public Func<Einloesung, Einloesung> Antwort = e => e;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Assert.EndsWith("/v1/einloesen", request.RequestUri!.AbsolutePath);
            var a = JsonSerializer.Deserialize<SignedRequest>(await request.Content!.ReadAsStringAsync(ct), KeyRequest.Json)!;
            Assert.True(a.Pruefe().Ok);                                              // die Instanz signiert ihre Anfrage
            var r = a.Inhalt!;
            Assert.Equal(Einloesung.Art, r.Kind);
            if (!Eingeloest.Add(r.Key!))
                return new HttpResponseMessage(HttpStatusCode.BadRequest) { Content = new StringContent(JsonSerializer.Serialize(new { error = $"Schlüssel {r.Key} ist schon eingelöst." })) };
            var e = new Einloesung(r.Key, r.Instance, r.Team, DateTimeOffset.UtcNow, a.Hash);
            e = Antwort(e with { Sig = Signaturen.Signiere(Aussteller, e.Rumpf) });
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(JsonSerializer.Serialize(e, new JsonSerializerOptions(JsonSerializerDefaults.Web))) };
        }
    }

    private static (Abos Abos, Lizenzserver Server) Welt(bool vertraut = true)
    {
        var s = new Lizenzserver();
        if (vertraut) Aussteller.Vertraue(Signaturen.Oeffentlich(s.Aussteller));
        var dir = Path.Combine(Path.GetTempPath(), "journali-einloesen-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        return (new Abos(new Instanz(null), dir, new HttpClient(s), () => "https://lizenz.example"), s);
    }

    [Fact]
    public async Task Einmal_bestaetigt_danach_abgelehnt()
    {
        var (abos, _) = Welt();
        Assert.Null(await abos.EinloesenAsync("k-1", "de"));
        Assert.Contains("schon eingelöst", await abos.EinloesenAsync("k-1", "es"));
    }

    [Fact]
    public async Task Ohne_passende_Bestaetigung_nicht()
    {
        var (fremd, _) = Welt(vertraut: false);
        Assert.Contains("Signatur", await fremd.EinloesenAsync("k-2", "de"));
        var (abos, s) = Welt();
        s.Antwort = e => { var x = e with { Team = "es", Sig = null }; return x with { Sig = Signaturen.Signiere(s.Aussteller, x.Rumpf) }; };
        Assert.Contains("nicht zu dieser Anfrage", await abos.EinloesenAsync("k-3", "de"));
        var ohne = new Abos(new Instanz(null), Path.GetTempPath(), new HttpClient(new Lizenzserver()), () => null);
        Assert.Contains("Kein Lizenzserver", await ohne.EinloesenAsync("k-4", "de"));
    }
}
