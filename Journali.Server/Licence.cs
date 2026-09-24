using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Journali.Server;

/// <summary>
/// Die Lizenz. Sie sagt, was diese Anlage darf — nicht der Administrator und schon gar nicht ein anderes Team:
/// <list type="bullet">
/// <item><c>Plan</c>: der Tarif — und damit, wie viele Einträge ins Journal gehen dürfen. Die Zahlen stehen in
/// <see cref="Core.Projections.Tarife"/> im Kern, nicht in der Lizenz: was „Kostenlos“ heißt, soll überall dasselbe
/// bedeuten, und eine Lizenz soll es nicht umschreiben können. Zu lesen sind sie als <see cref="Week"/> und <see cref="Month"/>.</item>
/// <item><c>CountFrom</c>: ab wann gezählt wird. Was davor im Journal steht, bleibt stehen und
/// zählt nicht mehr mit — zurücksetzen lässt sich ein Journal nicht, aber eine Lizenz darf einen Anfang setzen.</item>
/// Mehr steht nicht darin: was ein Team an KI verbraucht, geht an seinen Anbieter und nicht an journali — dort gibt
/// es nichts zu lizenzieren. Die Felder <c>AiTokensMonth</c> und <c>AiTokensDay</c> bleiben als
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
    /// <summary>Altlast: bis 25.09.2026 trug die Lizenz ihre Grenzen selbst. Jetzt sagt der Tarif sie — die Felder
    /// bleiben im signierten Rumpf stehen, damit ältere Lizenzen gültig bleiben, und werden nicht mehr ausgewertet.</summary>
    int EntriesWeek = 0,
    int EntriesMonth = 0,
    DateOnly? CountFrom = null,
    long AiTokensMonth = 0,
    long AiTokensDay = 0,
    Dictionary<string, TeamLimit>? Teams = null,
    /// <summary>Für welche Instanz sie gilt (Kennung) — leer heisst: für jede (Lizenzen von vor dem 23.09.2026).</summary>
    string? Instance = null,
    /// <summary>Die Testlizenz einer neuen Instanz — von ihr selbst angelegt, nicht ausgestellt.</summary>
    bool? Trial = null,
    string? Sig = null)
{
    /// <summary>Tarif Kostenlos: ohne Lizenz, nach dem Test und wenn eine Lizenz abgelaufen ist.</summary>
    public static readonly Licence Frei = new(Core.Projections.Tarife.Free.Key);

    /// <summary>Der Tarif dieser Lizenz — <c>plan</c> nennt ihn; Lizenzen von vor den Tarifen gelten als Kostenlos.</summary>
    [JsonIgnore] public Core.Projections.Tarif Tarif => Core.Projections.Tarife.Von(Plan) ?? Core.Projections.Tarife.Free;

    /// <summary>Die Grenzen der Anlage: aus dem Tarif. Was ein einzelnes Team darüber hinaus hat, steht in
    /// <see cref="Teams"/>; was zeitlich dazukommt, ist ein Limit-Schlüssel am Team.</summary>
    [JsonIgnore] public int Week => Tarif.Week;
    [JsonIgnore] public int Month => Tarif.Month;

    [JsonIgnore] public bool Abgelaufen => ValidUntil is { } d && d < DateOnly.FromDateTime(DateTime.Today);
    /// <summary>Die Werte ohne Signatur — genau das wird signiert und geprüft. Nicht mitserialisieren: sonst ruft es sich selbst auf.</summary>
    [JsonIgnore] public string Rumpf => JsonSerializer.Serialize(this with { Sig = null }, Json);
    internal static readonly JsonSerializerOptions Json = new() { WriteIndented = true, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
}

/// <summary>Was ein einzelnes Team laut Lizenz darf — gekauft heisst: in der Lizenz genannt.</summary>
public sealed record TeamLimit(int EntriesWeek = 0, int EntriesMonth = 0);

public static class LicenceFile
{
    public static string PathOf(string dir) => Path.Combine(dir, "licence.json");

    /// <summary>Die Lizenz dieser Instanz — ohne Datei Tarif Kostenlos. Liefert dazu, ob sie geprüft ist und was dagegen spricht.</summary>
    public static (Licence Lic, bool Geprueft, string? Grund) Load(string dir)
        => File.Exists(PathOf(dir)) ? Aus(File.ReadAllText(PathOf(dir))) : (Licence.Frei, false, "keine Lizenz — Tarif Kostenlos");

    /// <summary>Aus dem JSON einer Lizenz — gleich, ob sie aus einer Datei kommt oder aus der Datenbank (LicenceStore).</summary>
    public static (Licence Lic, bool Geprueft, string? Grund) Aus(string json, string? instanz = null)
    {
        Licence? lic;
        try { lic = JsonSerializer.Deserialize<Licence>(json, Licence.Json); }
        catch (Exception e) { return (Licence.Frei, false, "Lizenz nicht lesbar: " + e.Message); }
        if (lic is null) return (Licence.Frei, false, "Lizenz leer");
        if (lic.Abgelaufen) return (lic, false, $"abgelaufen am {lic.ValidUntil:dd.MM.yyyy}");
        // Auf eine andere Instanz ausgestellt: es gilt Kostenlos
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
/// Eine Prüfung für alles, was der Lizenzgeber ausstellt — Lizenz und Schlüssel. Nur, wenn ein
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
/// Hält die Lizenz zur Laufzeit. Sie steht in der Datenbank, damit sie in jeder Sicherung mitfährt und nicht
/// verschwindet; eine Datei aus der Zeit davor wird beim ersten Lesen übernommen.
/// </summary>
public sealed class Licences(string dir, LicenceStore? store = null, Instanz? instanz = null)
{
    private (Licence Lic, bool Geprueft, string? Grund) _stand;
    public Licences(string dir) : this(dir, null, null) { }
    /// <summary>Die Kennung dieser Instanz — sie steht in jeder Lizenz, die für sie ausgestellt wird.</summary>
    public string? InstanzId => instanz?.Id;

    /// <summary>
    /// Der Tag des ersten Eintrags im Journal. Gesetzt, legt eine Instanz ohne Lizenz
    /// ihre Testlizenz selbst an: Enterprise für <see cref="Core.Projections.Tarife.TestMonate"/> Monate ab diesem Tag.
    /// Er kommt aus dem Journal und fährt mit jeder Sicherung mit — eine wiederhergestellte Instanz fängt den Test
    /// nicht von vorn an.
    /// </summary>
    public Func<DateOnly?>? ErsterTag { get; set; }

    /// <summary>Was gilt: die Lizenz — abgelaufen gilt Kostenlos (auch, wenn sie im laufenden Betrieb abläuft).</summary>
    public Licence Lic { get { Einmal(); return _stand.Lic.Abgelaufen ? Licence.Frei : _stand.Lic; } }
    /// <summary>Was eingespielt oder angelegt ist — auch abgelaufen, zum Anzeigen.</summary>
    public Licence Roh { get { Einmal(); return _stand.Lic; } }
    public bool Geprueft { get { Einmal(); return _stand.Geprueft && !_stand.Lic.Abgelaufen; } }
    public string? Grund { get { Einmal(); return _stand.Lic.Abgelaufen ? $"abgelaufen am {_stand.Lic.ValidUntil:dd.MM.yyyy}" : _stand.Grund; } }
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
        // Gar keine Lizenz: die Instanz legt ihre Testlizenz an und hält sie fest wie jede andere
        if (ausDatei.Lic == Licence.Frei && ErsterTag is { } ersterTag)
        {
            var ab = ersterTag() ?? DateOnly.FromDateTime(DateTime.Today);
            var e = Core.Projections.Tarife.Enterprise;
            var test = new Licence(e.Key, null, ab.AddMonths(Core.Projections.Tarife.TestMonate).AddDays(-1), e.Week, e.Month, Instance: instanz?.Id, Trial: true);
            Neu(test);
            return;
        }
        _stand = ausDatei;
    }
}
