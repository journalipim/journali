using System.Security.Cryptography;
using System.Text.Json;
using Journali.Core.Licensing;

namespace Journali.Tests;

// Was journali und der Lizenzserver austauschen — beide Seiten nutzen denselben Kern.
public class VertragTests
{
    private static readonly DateTimeOffset Jetzt = new(2026, 9, 24, 12, 0, 0, TimeSpan.Zero);

    private static (Entitlement E, string Pub) Ausgestellt(DateOnly bezahltBis)
    {
        using var aussteller = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var e = new Entitlement("inst", "init", "enterprise", 200_000, 1_000_000, "active", bezahltBis, Jetzt, Jetzt + Entitlement.Kulanz, "abc");
        return (e with { Sig = Signaturen.Signiere(aussteller, e.Rumpf) }, Signaturen.Oeffentlich(aussteller));
    }

    [Fact]
    public void Ein_Stand_reist_als_JSON_und_bleibt_pruefbar()
    {
        var (e, pub) = Ausgestellt(new DateOnly(2026, 10, 24));
        var angekommen = JsonSerializer.Deserialize<Entitlement>(JsonSerializer.Serialize(e, Entitlement.Json), Entitlement.Json)!;
        Assert.Equal((true, (string?)null), Signaturen.Pruefe(angekommen.Rumpf, angekommen.Sig, pub));
        var gefaelscht = angekommen with { Plan = "unlimited" };
        Assert.False(Signaturen.Pruefe(gefaelscht.Rumpf, gefaelscht.Sig, pub).Ok);
    }

    [Fact]
    public void Ein_Stand_gilt_bis_zum_frueheren_von_bezahlt_und_Kulanz()
    {
        var (e, _) = Ausgestellt(new DateOnly(2026, 10, 24));
        Assert.True(e.GiltAm(Jetzt));
        Assert.True(e.GiltAm(Jetzt.AddDays(6)));
        Assert.False(e.GiltAm(Jetzt.AddDays(8)));                            // 7 Tage ohne Verbindung — dann Kostenlos
        var (gekuendigt, _) = Ausgestellt(new DateOnly(2026, 9, 26));
        Assert.True(gekuendigt.GiltAm(Jetzt));
        Assert.False(gekuendigt.GiltAm(Jetzt.AddDays(3)));                   // bezahlt bis 26.09. — danach nicht mehr
    }

    [Fact]
    public void Eine_Abo_Anfrage_traegt_Team_und_Schluessel()
    {
        using var instanz = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var r = new KeyRequest("n-1", "abo", "inst", Signaturen.Oeffentlich(instanz), Created: Jetzt, Team: "init", Key: "EE43440D-BC39-46E9-82E7-78EF3F1F8B9C");
        var rumpf = JsonSerializer.Serialize(r, KeyRequest.Json);
        var s = new SignedRequest(rumpf, Signaturen.Signiere(instanz, rumpf));
        Assert.True(s.Pruefe().Ok);
        Assert.Equal(("init", "EE43440D-BC39-46E9-82E7-78EF3F1F8B9C"), (s.Inhalt!.Team, s.Inhalt.Key));
        Assert.False((s with { Anforderung = s.Anforderung.Replace("init", "es") }).Pruefe().Ok);
    }
}
