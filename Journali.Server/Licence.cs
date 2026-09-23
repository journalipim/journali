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
/// <item><c>CountFrom</c>: ab wann gezählt wird (Taloan, 23.09.2026). Was davor im Journal steht, bleibt stehen und
/// zählt nicht mehr mit — zurücksetzen lässt sich ein Journal nicht, aber eine Lizenz darf einen Anfang setzen.</item>
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
    DateOnly? CountFrom = null,
    long AiTokensMonth = 0,
    long AiTokensDay = 0,
    Dictionary<string, TeamLimit>? Teams = null,
    /// <summary>Für welche Instanz sie gilt (Kennung) — leer heisst: für jede (Lizenzen von vor dem 23.09.2026).</summary>
    string? Instance = null,
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

    /// <summary>Die Lizenz dieser Instanz — ohne Datei der Testbetrieb. Liefert dazu, ob sie geprüft ist und was dagegen spricht.</summary>
    public static (Licence Lic, bool Geprueft, string? Grund) Load(string dir)
        => File.Exists(PathOf(dir)) ? Aus(File.ReadAllText(PathOf(dir))) : (Licence.Frei, false, "keine Lizenz — Testbetrieb");

    /// <summary>Aus dem JSON einer Lizenz — gleich, ob sie aus einer Datei kommt oder aus der Datenbank (LicenceStore).</summary>
    public static (Licence Lic, bool Geprueft, string? Grund) Aus(string json, string? instanz = null)
    {
        Licence? lic;
        try { lic = JsonSerializer.Deserialize<Licence>(json, Licence.Json); }
        catch (Exception e) { return (Licence.Frei, false, "Lizenz nicht lesbar: " + e.Message); }
        if (lic is null) return (Licence.Frei, false, "Lizenz leer");
        if (lic.Abgelaufen) return (lic, false, $"abgelaufen am {lic.ValidUntil:dd.MM.yyyy}");
        // Auf eine andere Instanz ausgestellt: es gilt der Testbetrieb (Taloan, 23.09.2026 — sonst würde aus einer
        // Sicherung und drei Wiederherstellungen aus einer Lizenz vier)
        if (lic.Instance is { Length: > 0 } fuer && instanz is { Length: > 0 } hier && !string.Equals(fuer, hier, StringComparison.OrdinalIgnoreCase))
            return (Licence.Frei, false, $"ausgestellt für eine andere Instanz ({fuer})");
        var (ok, grund) = Pruefe(lic);
        return (lic, ok, grund);
    }

    public static void Save(string dir, Licence lic) { Directory.CreateDirectory(dir); File.WriteAllText(PathOf(dir), JsonSerializer.Serialize(lic, Licence.Json)); }

    /// <summary>Signatur prüfen — nur, wenn ein öffentlicher Schlüssel hinterlegt ist. Ohne ihn: gelesen, aber ungeprüft.</summary>
    private static (bool Ok, string? Grund) Pruefe(Licence lic) => Signatur.Pruefe(lic.Rumpf, lic.Sig);
}

/// <summary>
/// Eine Prüfung für alles, was der Lizenzgeber ausstellt — Lizenz und Schlüssel (Taloan, 23.09.2026). Nur, wenn ein
/// öffentlicher Schlüssel hinterlegt ist (<c>JOURNALI_LICENCE_KEY</c>); ohne ihn: gelesen, aber ungeprüft.
/// </summary>
public static class Signatur
{
    public static (bool Ok, string? Grund) Pruefe(string rumpf, string? sig)
    {
        var pub = Environment.GetEnvironmentVariable("JOURNALI_LICENCE_KEY");
        if (string.IsNullOrWhiteSpace(pub)) return (false, "ungeprüft — kein öffentlicher Schlüssel hinterlegt");
        if (string.IsNullOrWhiteSpace(sig)) return (false, "keine Signatur");
        try
        {
            using var ecdsa = ECDsa.Create();
            ecdsa.ImportSubjectPublicKeyInfo(Convert.FromBase64String(pub), out _);
            return ecdsa.VerifyData(Encoding.UTF8.GetBytes(rumpf), Convert.FromBase64String(sig), HashAlgorithmName.SHA256)
                ? (true, null) : (false, "Signatur passt nicht");
        }
        catch (Exception e) { return (false, "Signatur nicht prüfbar: " + e.Message); }
    }
}

/// <summary>
/// Hält die Lizenz zur Laufzeit. Sie steht in der Datenbank (Taloan, 23.09.2026: „jegliche eingespielte Lizenz kommt
/// signiert und verschlüsselt in einen Container — die DB"), damit sie in jeder Sicherung mitfährt und nicht
/// verschwindet; eine Datei aus der Zeit davor wird beim ersten Lesen übernommen.
/// </summary>
public sealed class Licences(string dir, LicenceStore? store = null, Instanz? instanz = null)
{
    private (Licence Lic, bool Geprueft, string? Grund) _stand;
    public Licences(string dir) : this(dir, null, null) { }
    /// <summary>Die Kennung dieser Instanz — sie steht in jeder Lizenz, die für sie ausgestellt wird.</summary>
    public string? InstanzId => instanz?.Id;

    public Licence Lic { get { Einmal(); return _stand.Lic; } }
    public bool Geprueft { get { Einmal(); return _stand.Geprueft; } }
    public string? Grund { get { Einmal(); return _stand.Grund; } }
    public string Dir => dir;
    /// <summary>Wo sie liegt — für die Anzeige und die Betriebsdoku.</summary>
    public string Ort => store?.Ready == true ? "Datenbank" : "Datei";

    private bool _gelesen;
    private void Einmal() { if (!_gelesen) { _gelesen = true; Lies(); } }

    public void Neu(Licence lic, string actor = "system")
    {
        var json = JsonSerializer.Serialize(lic, Licence.Json);
        if (store?.Ready == true) store.Schreib(json, actor);
        else LicenceFile.Save(dir, lic);
        _stand = LicenceFile.Aus(json, instanz?.Id);
        _gelesen = true;
    }

    public void Lies()
    {
        _gelesen = true;
        if (store?.Ready == true && store.Lies() is { Length: > 0 } json) { _stand = LicenceFile.Aus(json, instanz?.Id); return; }
        // noch nichts in der Datenbank: eine Datei von früher übernehmen, dann steht sie dort
        var ausDatei = LicenceFile.Load(dir);
        if (store?.Ready == true && ausDatei.Lic != Licence.Frei)
        {
            store.Schreib(JsonSerializer.Serialize(ausDatei.Lic, Licence.Json), "system");
            try { File.Delete(LicenceFile.PathOf(dir)); } catch { }
        }
        _stand = ausDatei;
    }
}
