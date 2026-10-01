using System.Net;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Schutz gegen Probieren und Überfluten (01.10.2026): die Anmeldung zählt Fehlversuche und sperrt, bevor sie das Passwort prüft (210 000 Runden PBKDF2 je Versuch);
/// eine Obergrenze je Absender; ein Aufruf ohne Sitzung nimmt nur einen kleinen Körper; grosse Dateien (Videos) kommen nur auf dem Weg der Medien an.
/// </summary>
public class SchutzTests
{
    private sealed class Uhr { public DateTime Jetzt = new(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc); }

    [Fact]
    public void Nach_acht_Fehlversuchen_ist_der_Name_eine_Minute_gesperrt()
    {
        var uhr = new Uhr(); var b = new LoginBremse(() => uhr.Jetzt);
        for (var i = 0; i < LoginBremse.FehlversuchePerName - 1; i++) { b.Fehler("u:taloan", LoginBremse.FehlversuchePerName); Assert.Null(b.Gesperrt("u:taloan")); }
        b.Fehler("u:taloan", LoginBremse.FehlversuchePerName);
        Assert.Equal(LoginBremse.Sperre, b.Gesperrt("u:taloan"));
        Assert.Null(b.Gesperrt("u:anna"));                                   // ein anderer Name ist nicht betroffen
        uhr.Jetzt += TimeSpan.FromSeconds(59); Assert.NotNull(b.Gesperrt("u:taloan"));
        uhr.Jetzt += TimeSpan.FromSeconds(2); Assert.Null(b.Gesperrt("u:taloan"));   // nach der Minute darf er wieder
    }

    [Fact]
    public void Eine_richtige_Anmeldung_setzt_den_Zaehler_zurueck_und_alte_Fehler_verfallen()
    {
        var uhr = new Uhr(); var b = new LoginBremse(() => uhr.Jetzt);
        for (var i = 0; i < 7; i++) b.Fehler("u:taloan", 8);
        b.Erfolg("u:taloan");
        for (var i = 0; i < 7; i++) b.Fehler("u:taloan", 8);
        Assert.Null(b.Gesperrt("u:taloan"));   // 7 + 7 Fehler mit einem Erfolg dazwischen sperren nicht
        uhr.Jetzt += LoginBremse.Fenster + TimeSpan.FromSeconds(1);   // Fehler ausserhalb des Fensters zählen nicht mit
        b.Fehler("u:taloan", 8); Assert.Null(b.Gesperrt("u:taloan"));
    }

    [Fact]
    public void Der_Absender_wird_spaeter_gesperrt_als_der_Name()
    {
        var uhr = new Uhr(); var b = new LoginBremse(() => uhr.Jetzt);
        for (var i = 0; i < LoginBremse.FehlversuchePerAbsender - 1; i++) b.Fehler("ip:1.2.3.4", LoginBremse.FehlversuchePerAbsender);
        Assert.Null(b.Gesperrt("ip:1.2.3.4"));
        b.Fehler("ip:1.2.3.4", LoginBremse.FehlversuchePerAbsender);
        Assert.NotNull(b.Gesperrt("ip:1.2.3.4"));
    }

    [Fact]
    public void Geratene_Namen_fuellen_den_Speicher_nicht_unbegrenzt()
    {
        var uhr = new Uhr(); var b = new LoginBremse(() => uhr.Jetzt);
        for (var i = 0; i < 10_001; i++) b.Fehler("u:x" + i, 8);
        uhr.Jetzt += LoginBremse.Fenster + TimeSpan.FromMinutes(1);
        b.Fehler("u:neu", 8);   // räumt auf
        Assert.Null(b.Gesperrt("u:x0"));
    }

    private static HttpContext Von(string? remote, string? lokal)
    {
        var ctx = new DefaultHttpContext();
        ctx.Connection.RemoteIpAddress = remote is null ? null : IPAddress.Parse(remote);
        ctx.Connection.LocalIpAddress = lokal is null ? null : IPAddress.Parse(lokal);
        return ctx;
    }

    [Theory]
    [InlineData("127.0.0.1", "127.0.0.1")]
    [InlineData("::1", "::1")]
    [InlineData("192.168.1.5", "192.168.1.5")]      // ein Prozess des Servers ruft ihn unter seiner eigenen Adresse
    public void Was_vom_Rechner_des_Servers_kommt_wird_nicht_begrenzt(string remote, string lokal)
    {
        var p = Begrenzung.Partition(Von(remote, lokal));
        using var l = p.Factory(p.PartitionKey);
        for (var i = 0; i < 5000; i++) Assert.True(l.AttemptAcquire().IsAcquired);
    }

    [Fact]
    public void Ein_Absender_im_Netz_hat_einen_Eimer_dann_kommt_429()
    {
        Func<TokenBucketRateLimiterOptions> klein = () => new TokenBucketRateLimiterOptions { TokenLimit = 5, TokensPerPeriod = 1, ReplenishmentPeriod = TimeSpan.FromHours(1), QueueLimit = 0, AutoReplenishment = false };
        var p = Begrenzung.Partition(Von("203.0.113.9", "10.0.0.2"), klein);
        using var l = p.Factory(p.PartitionKey);
        for (var i = 0; i < 5; i++) Assert.True(l.AttemptAcquire().IsAcquired);
        Assert.False(l.AttemptAcquire().IsAcquired);   // die sechste Anfrage in dem Augenblick ist zu viel
        Assert.Equal("203.0.113.9", p.PartitionKey);
        Assert.NotEqual(p.PartitionKey, Begrenzung.Partition(Von("203.0.113.10", "10.0.0.2")).PartitionKey);   // jeder Absender hat seinen eigenen Eimer
    }

    [Fact]
    public void Der_Eimer_ist_gross_genug_fuer_eine_Seite_mit_vielen_Kacheln()
    {
        Assert.True(Begrenzung.Eimer >= 600);
        Assert.True(Begrenzung.ProSekunde >= 30);   // die Oberfläche fragt alle 3 Sekunden
    }

    [Theory]
    [InlineData("POST", "/api/media", true)]
    [InlineData("POST", "/API/Media", true)]
    [InlineData("PUT", "/api/media/blob/abc.thumb", true)]
    [InlineData("GET", "/api/media", false)]
    [InlineData("POST", "/api/media/fetch", false)]
    [InlineData("POST", "/api/nodes", false)]
    [InlineData("PUT", "/api/model/attributes/x", false)]
    public void Nur_der_Weg_der_Medien_nimmt_grosse_Dateien_an(string methode, string pfad, bool upload)
    {
        var ctx = new DefaultHttpContext(); ctx.Request.Method = methode; ctx.Request.Path = pfad;
        Assert.Equal(upload, Begrenzung.IstUpload(ctx.Request));
    }

    private sealed class Grenze : IHttpMaxRequestBodySizeFeature
    {
        public bool IsReadOnly => false;
        public long? MaxRequestBodySize { get; set; } = 30_000_000;
    }

    [Theory]
    [InlineData("/api/auth/login")]
    [InlineData("/api/auth/setup")]
    [InlineData("/api/health")]
    public void Ein_Aufruf_ohne_Sitzung_nimmt_nur_einen_kleinen_Koerper(string pfad)
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, w) => w("system", Users.Stream + "taloan", Types.UserDefined, new UserDefined("Taloan", null, "admin", true), null));
        var ctx = new DefaultHttpContext(); ctx.Request.Path = pfad; ctx.Request.Method = "POST";
        var g = new Grenze(); ctx.Features.Set<IHttpMaxRequestBodySizeFeature>(g);
        Auth.Middleware(c, Path.GetTempPath())(ctx, () => Task.CompletedTask).GetAwaiter().GetResult();
        Assert.Equal(Auth.KoerperOhneSitzung, g.MaxRequestBodySize);
    }
}
