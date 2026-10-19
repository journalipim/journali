using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Journali.Server;

namespace Journali.Tests;

// Der Nachweis eines angemeldeten Kunden (19.10.2026, pflegestruktur 44): ein JWT des Shops, geprüft mit seinem öffentlichen Schlüssel.
// Gilt er nicht, ist der Besucher anonym — der Test prüft, dass jede Abweichung dahin führt.
public class AdvisorKundeTests
{
    static readonly DateTimeOffset Jetzt = new(2026, 10, 19, 12, 0, 0, TimeSpan.Zero);

    static string B(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    /// <summary>Ein Nachweis wie vom Shop: Kopf, Inhalt, Signatur mit seinem privaten Schlüssel.</summary>
    public static string Jwt(AsymmetricAlgorithm k, string alg, object inhalt)
    {
        var kopf = B(JsonSerializer.SerializeToUtf8Bytes(new { alg, typ = "JWT" }));
        var body = B(JsonSerializer.SerializeToUtf8Bytes(inhalt));
        var daten = Encoding.ASCII.GetBytes(kopf + "." + body);
        var sig = k switch
        {
            ECDsa e => e.SignData(daten, HashAlgorithmName.SHA256),
            RSA r => r.SignData(daten, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1),
            _ => throw new ArgumentException("Schlüssel"),
        };
        return kopf + "." + body + "." + B(sig);
    }

    static object Inhalt(string aud = "shop", long? exp = null, string? iss = null, object? nbf = null) =>
        iss is null && nbf is null ? new { sub = "K-1001", aud, exp = exp ?? Jetzt.AddMinutes(10).ToUnixTimeSeconds() }
        : nbf is null ? new { sub = "K-1001", aud, exp = exp ?? Jetzt.AddMinutes(10).ToUnixTimeSeconds(), iss }
        : (object)new { sub = "K-1001", aud, exp = exp ?? Jetzt.AddMinutes(10).ToUnixTimeSeconds(), iss, nbf };

    [Fact]
    public void ES256_gilt_und_nennt_die_Kundennummer()
    {
        using var k = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var pem = k.ExportSubjectPublicKeyInfoPem();
        Assert.Null(AdvisorKunde.SchluesselFehler(pem));
        Assert.Equal("K-1001", AdvisorKunde.Pruefe(Jwt(k, "ES256", Inhalt()), pem, null, "shop", Jetzt));
        // aud als Liste
        Assert.Equal("K-1001", AdvisorKunde.Pruefe(Jwt(k, "ES256", new { sub = "K-1001", aud = new[] { "anderer", "shop" }, exp = Jetzt.AddMinutes(5).ToUnixTimeSeconds() }), pem, null, "shop", Jetzt));
    }

    [Fact]
    public void RS256_gilt()
    {
        using var k = RSA.Create(2048);
        var pem = k.ExportSubjectPublicKeyInfoPem();
        Assert.Null(AdvisorKunde.SchluesselFehler(pem));
        Assert.Equal("K-1001", AdvisorKunde.Pruefe(Jwt(k, "RS256", Inhalt()), pem, null, "shop", Jetzt));
    }

    [Fact]
    public void Jede_Abweichung_macht_den_Besucher_anonym()
    {
        using var k = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        using var fremd = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var pem = k.ExportSubjectPublicKeyInfoPem();
        string? P(string jwt, string? iss = null) => AdvisorKunde.Pruefe(jwt, pem, iss, "shop", Jetzt);

        Assert.Null(P(Jwt(k, "ES256", Inhalt(aud: "anderer"))));                                       // für einen anderen Berater
        Assert.Null(P(Jwt(k, "ES256", Inhalt(exp: Jetzt.AddMinutes(-5).ToUnixTimeSeconds()))));         // abgelaufen
        Assert.Null(P(Jwt(k, "ES256", Inhalt(exp: Jetzt.AddHours(2).ToUnixTimeSeconds()))));            // gilt zu lange
        Assert.Null(P(Jwt(k, "ES256", new { sub = "K-1001", aud = "shop" })));                            // ohne Ablauf
        Assert.Null(P(Jwt(k, "ES256", Inhalt()), iss: "https://shop.example"));                           // Aussteller verlangt, fehlt
        Assert.Null(P(Jwt(k, "ES256", Inhalt(iss: "https://anderer.example")), iss: "https://shop.example"));
        Assert.Equal("K-1001", P(Jwt(k, "ES256", Inhalt(iss: "https://shop.example")), iss: "https://shop.example"));
        Assert.Null(P(Jwt(k, "ES256", Inhalt(iss: "x", nbf: Jetzt.AddMinutes(5).ToUnixTimeSeconds()))));  // noch nicht gültig
        Assert.Null(P(Jwt(fremd, "ES256", Inhalt())));                                                    // ein anderer Schlüssel
        Assert.Null(P(Jwt(k, "RS256", Inhalt())));                                                        // alg passt nicht zum Schlüssel

        // verändert: ein anderer Inhalt mit der alten Signatur
        var echt = Jwt(k, "ES256", Inhalt()).Split('.');
        var anders = B(JsonSerializer.SerializeToUtf8Bytes(new { sub = "K-9999", aud = "shop", exp = Jetzt.AddMinutes(10).ToUnixTimeSeconds() }));
        Assert.Null(P(echt[0] + "." + anders + "." + echt[2]));
        // alg none: ohne Signatur
        var ohne = B(JsonSerializer.SerializeToUtf8Bytes(new { alg = "none" })) + "." + echt[1] + ".";
        Assert.Null(P(ohne));
        foreach (var kaputt in new[] { "", "a.b", "a.b.c", "x.y.z.w", new string('a', 5000) }) Assert.Null(P(kaputt));
    }

    [Fact]
    public void Nur_ein_oeffentlicher_Schluessel_gilt_am_Berater()
    {
        using var k = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        // ein privater Schlüssel gehört nicht ins Journal — dort lässt sich nichts löschen
        Assert.NotNull(AdvisorKunde.SchluesselFehler(k.ExportPkcs8PrivateKeyPem()));
        Assert.NotNull(AdvisorKunde.SchluesselFehler(null));
        Assert.NotNull(AdvisorKunde.SchluesselFehler("-----BEGIN PUBLIC KEY-----\nkaputt\n-----END PUBLIC KEY-----"));
        using var p384 = ECDsa.Create(ECCurve.NamedCurves.nistP384);
        Assert.NotNull(AdvisorKunde.SchluesselFehler(p384.ExportSubjectPublicKeyInfoPem()));
    }
}
