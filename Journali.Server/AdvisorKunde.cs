using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Journali.Server;

/// <summary>
/// Der angemeldete Kunde eines Shops (19.10.2026, docs/pflegestruktur.md 44, „Der Nachweis des Kunden“). journali kennt die Kunden des Shops
/// nicht: der Shop stellt einem angemeldeten Kunden einen kurzlebigen, signierten Nachweis aus (ein JWT, ES256 oder RS256), das Chat-Fenster
/// schickt ihn mit, der Dienst reicht ihn im Kopf <see cref="Kopf"/> durch. journali prüft ihn mit dem öffentlichen Schlüssel des Shops am
/// Berater; gilt er, liest der Berater mit der Sicht für Kunden (etwa mit einem anderen Preisfeld). Gespeichert wird davon nichts.
/// </summary>
public static class AdvisorKunde
{
    public const string Kopf = "X-Advisor-Customer";
    /// <summary>So lang darf ein Nachweis höchstens gelten — ab jetzt gerechnet.</summary>
    public static readonly TimeSpan MaxGueltig = TimeSpan.FromMinutes(15);
    /// <summary>So weit dürfen die Uhren von Shop und journali auseinander gehen.</summary>
    public static readonly TimeSpan Spiel = TimeSpan.FromSeconds(60);
    public const int MaxLaenge = 4096;

    /// <summary>Der Schlüssel des Shops als PEM: null, wenn er ein öffentlicher ECDSA-P-256- oder RSA-Schlüssel ist, sonst der Grund.</summary>
    public static string? SchluesselFehler(string? pem)
    {
        if (string.IsNullOrWhiteSpace(pem)) return "Schlüssel des Shops fehlt";
        if (!pem.Contains("-----BEGIN PUBLIC KEY-----", StringComparison.Ordinal) || pem.Contains("PRIVATE", StringComparison.Ordinal))
            return "Schlüssel des Shops ist kein öffentlicher Schlüssel (PEM)";
        try
        {
            using var k = Lade(pem);
            return k is ECDsa e && e.KeySize != 256 ? "Schlüssel des Shops: ECDSA nur mit P-256" : null;
        }
        catch (Exception e) when (e is CryptographicException or ArgumentException) { return "Schlüssel des Shops ist kein öffentlicher Schlüssel (PEM)"; }
    }

    private static AsymmetricAlgorithm Lade(string pem)
    {
        var e = ECDsa.Create();
        try { e.ImportFromPem(pem); return e; }
        catch (Exception x) when (x is CryptographicException or ArgumentException) { e.Dispose(); }
        var r = RSA.Create(); r.ImportFromPem(pem); return r;
    }

    /// <summary>
    /// Prüft einen Nachweis: Signatur (ES256 mit P-256 oder RS256), <c>aud</c> ist der Berater, <c>iss</c> wie am Berater (wenn dort einer steht),
    /// <c>exp</c> liegt in der Zukunft und höchstens <see cref="MaxGueltig"/> entfernt, <c>nbf</c> (wenn da) ist erreicht. Gibt <c>sub</c> zurück
    /// (die Kundennummer) oder null — dann ist der Besucher anonym.
    /// </summary>
    public static string? Pruefe(string? nachweis, string? pem, string? aussteller, string berater, DateTimeOffset jetzt)
    {
        if (string.IsNullOrEmpty(nachweis) || nachweis.Length > MaxLaenge || string.IsNullOrWhiteSpace(pem)) return null;
        var teile = nachweis.Split('.');
        if (teile.Length != 3) return null;
        try
        {
            using var kopf = JsonDocument.Parse(Base64Url(teile[0]));
            var alg = kopf.RootElement.TryGetProperty("alg", out var a) && a.ValueKind == JsonValueKind.String ? a.GetString() : null;
            var signiert = Encoding.ASCII.GetBytes(teile[0] + "." + teile[1]);
            var signatur = Base64Url(teile[2]);
            using var k = Lade(pem);
            var gilt = (alg, k) switch
            {
                ("ES256", ECDsa e) when e.KeySize == 256 => e.VerifyData(signiert, signatur, HashAlgorithmName.SHA256),
                ("RS256", RSA r) => r.VerifyData(signiert, signatur, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1),
                _ => false,   // auch alg "none" und HS256: ein Schlüssel zum Prüfen ist kein Geheimnis
            };
            if (!gilt) return null;

            using var inhalt = JsonDocument.Parse(Base64Url(teile[1]));
            var p = inhalt.RootElement;
            if (p.ValueKind != JsonValueKind.Object) return null;
            if (!p.TryGetProperty("exp", out var exp) || !exp.TryGetInt64(out var ablauf)) return null;
            var bis = DateTimeOffset.FromUnixTimeSeconds(ablauf);
            if (bis <= jetzt - Spiel || bis > jetzt + MaxGueltig + Spiel) return null;
            if (p.TryGetProperty("nbf", out var nbf) && (!nbf.TryGetInt64(out var ab) || DateTimeOffset.FromUnixTimeSeconds(ab) > jetzt + Spiel)) return null;
            var aud = p.TryGetProperty("aud", out var au) ? au : default;
            var fuerIhn = aud.ValueKind switch
            {
                JsonValueKind.String => aud.GetString() == berater,
                JsonValueKind.Array => aud.EnumerateArray().Any(x => x.ValueKind == JsonValueKind.String && x.GetString() == berater),
                _ => false,
            };
            if (!fuerIhn) return null;
            if (!string.IsNullOrWhiteSpace(aussteller) && (!p.TryGetProperty("iss", out var iss) || iss.ValueKind != JsonValueKind.String || iss.GetString() != aussteller.Trim())) return null;
            return p.TryGetProperty("sub", out var sub) && sub.ValueKind == JsonValueKind.String && sub.GetString() is { Length: > 0 and <= 200 } s ? s : null;
        }
        catch (Exception e) when (e is JsonException or FormatException or CryptographicException or ArgumentException) { return null; }
    }

    private static byte[] Base64Url(string s)
    {
        var t = s.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(t.PadRight(t.Length + (4 - t.Length % 4) % 4, '='));
    }
}
