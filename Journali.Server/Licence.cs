using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Journali.Server;

/// <summary>
/// Die Lizenz (Taloan, 23.09.2026: „die Grenzen setzt der Lizenzkey“ · „selbst wenn Team B über Team A abrechnet, kann A
/// nichts limitieren“). Sie sagt, was diese Anlage darf — nicht der Administrator und schon gar nicht ein anderes Team:
/// <list type="bullet">
/// <item><c>EntriesWeek</c>, <c>EntriesMonth</c>: wie viele Einträge ins Journal gehen dürfen.</item>
/// Mehr steht nicht darin: was ein Team an KI verbraucht, geht an seinen Anbieter und nicht an journali — dort gibt
/// es nichts zu lizenzieren (Taloan, 23.09.2026). Die Felder <c>AiTokensMonth</c> und <c>AiTokensDay</c> bleiben als
/// Altlast stehen und werden nicht mehr ausgewertet.
/// </list>
/// Sie liegt als <c>licence.json</c> im Datenverzeichnis, neben <c>auth.json</c> und <c>mail.json</c> — nie im Journal:
/// sie kommt von aussen und wird nicht gepflegt, sondern eingespielt. Ohne Datei gilt der Testbetrieb mit den Werten,
/// die bis hierher galten.
/// <para>Echtheit: <c>Sig</c> ist die Signatur über die Felder (ECDSA P-256, SHA-256, Base64). Geprüft wird sie, sobald
/// ein öffentlicher Schlüssel dasteht (<c>JOURNALI_LICENCE_KEY</c>, Base64 einer SubjectPublicKeyInfo). Fehlt er, wird
/// die Lizenz gelesen, aber als <c>ungeprüft</c> ausgewiesen — niemand soll glauben, hier sei etwas gesichert.</para>
/// </summary>
public sealed record Licence(
    string? Plan = null,
    string? Holder = null,
    DateOnly? ValidUntil = null,
    int EntriesWeek = 0,
    int EntriesMonth = 0,
    long AiTokensMonth = 0,
    long AiTokensDay = 0,
    Dictionary<string, TeamLimit>? Teams = null,
    string? Sig = null)
{
    /// <summary>Testbetrieb: was bis zur ersten Lizenz galt (Journali.Core Limits) — Einträge ja, KI nein.</summary>
    public static readonly Licence Frei = new("Testbetrieb", null, null, Core.Projections.Limits.Week, Core.Projections.Limits.Month);

    [JsonIgnore] public bool Abgelaufen => ValidUntil is { } d && d < DateOnly.FromDateTime(DateTime.Today);
    /// <summary>Die Werte ohne Signatur — genau das wird signiert und geprüft. Nicht mitserialisieren: sonst ruft es sich selbst auf.</summary>
    [JsonIgnore] public string Rumpf => JsonSerializer.Serialize(this with { Sig = null }, Json);
    internal static readonly JsonSerializerOptions Json = new() { WriteIndented = true, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
}

/// <summary>Was ein einzelnes Team laut Lizenz darf (Taloan, 23.09.2026: „es kann entweder eigene Limits kaufen oder
/// über ein anderes Team deren Limits mitnutzen“) — gekauft heisst: in der Lizenz genannt.</summary>
public sealed record TeamLimit(int EntriesWeek = 0, int EntriesMonth = 0);

public static class LicenceFile
{
    public static string PathOf(string dir) => Path.Combine(dir, "licence.json");

    /// <summary>Die Lizenz dieser Anlage — ohne Datei der Testbetrieb. Liefert dazu, ob sie geprüft ist und was dagegen spricht.</summary>
    public static (Licence Lic, bool Geprueft, string? Grund) Load(string dir)
    {
        if (!File.Exists(PathOf(dir))) return (Licence.Frei, false, "keine Lizenz — Testbetrieb");
        Licence? lic;
        try { lic = JsonSerializer.Deserialize<Licence>(File.ReadAllText(PathOf(dir)), Licence.Json); }
        catch (Exception e) { return (Licence.Frei, false, "Lizenz nicht lesbar: " + e.Message); }
        if (lic is null) return (Licence.Frei, false, "Lizenz leer");
        if (lic.Abgelaufen) return (lic, false, $"abgelaufen am {lic.ValidUntil:dd.MM.yyyy}");
        var (ok, grund) = Pruefe(lic);
        return (lic, ok, grund);
    }

    public static void Save(string dir, Licence lic) { Directory.CreateDirectory(dir); File.WriteAllText(PathOf(dir), JsonSerializer.Serialize(lic, Licence.Json)); }

    /// <summary>Signatur prüfen — nur, wenn ein öffentlicher Schlüssel hinterlegt ist. Ohne ihn: gelesen, aber ungeprüft.</summary>
    private static (bool Ok, string? Grund) Pruefe(Licence lic)
    {
        var pub = Environment.GetEnvironmentVariable("JOURNALI_LICENCE_KEY");
        if (string.IsNullOrWhiteSpace(pub)) return (false, "ungeprüft — kein öffentlicher Schlüssel hinterlegt");
        if (string.IsNullOrWhiteSpace(lic.Sig)) return (false, "keine Signatur in der Lizenz");
        try
        {
            using var ecdsa = ECDsa.Create();
            ecdsa.ImportSubjectPublicKeyInfo(Convert.FromBase64String(pub), out _);
            return ecdsa.VerifyData(Encoding.UTF8.GetBytes(lic.Rumpf), Convert.FromBase64String(lic.Sig), HashAlgorithmName.SHA256)
                ? (true, null) : (false, "Signatur passt nicht");
        }
        catch (Exception e) { return (false, "Signatur nicht prüfbar: " + e.Message); }
    }
}

/// <summary>Hält die Lizenz zur Laufzeit — einmal gelesen, beim Einspielen ausgetauscht.</summary>
public sealed class Licences(string dir)
{
    private (Licence Lic, bool Geprueft, string? Grund) _stand = LicenceFile.Load(dir);
    public Licence Lic => _stand.Lic;
    public bool Geprueft => _stand.Geprueft;
    public string? Grund => _stand.Grund;
    public string Dir => dir;
    public void Neu(Licence lic) { LicenceFile.Save(dir, lic); _stand = LicenceFile.Load(dir); }
    public void Lies() => _stand = LicenceFile.Load(dir);
}
