using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Journali.Server;

/// <summary>
/// Die Lizenz. Sie sagt, was diese Instanz darf — nicht der Administrator und schon gar nicht ein anderes Team:
/// <list type="bullet">
/// <item><c>Plan</c>: der Tarif — und damit, wie viele Einträge ins Journal gehen dürfen. Die Zahlen stehen in der
/// Tarifliste (Tarifblatt des Lizenzservers im Journal, sonst das Saatgut im Kern), nicht in der Lizenz: was „Kostenlos“
/// heißt, soll überall dasselbe bedeuten, und eine Lizenz soll es nicht umschreiben können (<see cref="TarifIn"/>).</item>
/// <item><c>CountFrom</c>: ab wann gezählt wird. Was davor im Journal steht, bleibt stehen und
/// zählt nicht mehr mit — zurücksetzen lässt sich ein Journal nicht, aber eine Lizenz darf einen Anfang setzen.</item>
/// Mehr steht nicht darin: was ein Team an KI verbraucht, geht an seinen Anbieter und nicht an journali — dort gibt
/// es nichts zu lizenzieren. Die Felder <c>AiTokensMonth</c> und <c>AiTokensDay</c> bleiben als
/// Altlast stehen und werden nicht mehr ausgewertet.
/// </list>
/// Sie liegt als <c>licence.json</c> im Datenverzeichnis, neben <c>auth.json</c> und <c>mail.json</c> — nie im Journal:
/// sie kommt von aussen und wird nicht gepflegt, sondern eingespielt. Ohne Datei gilt der Testbetrieb mit den Werten,
/// die bis hierher galten.
/// <para>Echtheit: <c>Sig</c> ist die Signatur über die Felder (ECDSA P-256, SHA-256, Base64), geprüft mit dem
/// eingebauten Schlüssel des Lizenzservers (<see cref="Core.Licensing.Aussteller"/>). Ohne passende Signatur gilt
/// Kostenlos (25.09.2026: nur Signiertes zählt). Ausgenommen ist die Testlizenz, die eine Instanz selbst anlegt: sie gilt
/// nach der Regel (Test-Tarif ab dem ersten Eintrag), nicht nach dem, was in ihr steht.</para>
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

    /// <summary>Der Tarif dieser Lizenz in der geltenden Tarifliste — <c>plan</c> nennt ihn, die Testlizenz hat den
    /// Test-Tarif; ein unbekannter gilt als Kostenlos. Seine Grenzen sind die der Instanz; was ein einzelnes Team darüber
    /// hinaus hat, steht in <see cref="Teams"/>, was zeitlich dazukommt, ist ein Limit-Schlüssel oder ein Abo am Team.</summary>
    public Core.Projections.Tarif TarifIn(Core.Projections.Tarifliste liste) => Trial == true ? liste.Test : liste.Von(Plan) ?? liste.Free;

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

    private static (bool Ok, string? Grund) Pruefe(Licence lic) => Core.Licensing.Aussteller.Pruefe(lic.Rumpf, lic.Sig);
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
    /// ihre Testlizenz selbst an: der Test-Tarif der Tarifliste für ihre Testmonate ab diesem Tag.
    /// Er kommt aus dem Journal und fährt mit jeder Sicherung mit — eine wiederhergestellte Instanz fängt den Test
    /// nicht von vorn an. Die Testlizenz gilt bis ersten Tag + Testmonate, gleich was in ihr steht.
    /// </summary>
    public Func<DateOnly?>? ErsterTag { get; set; }
    /// <summary>Die geltende Tarifliste — für den Test (Tarif und Monate). Ohne: das Saatgut.</summary>
    public Func<Core.Projections.Tarifliste>? Tarife { get; set; }
    private Core.Projections.Tarifliste Liste => Tarife?.Invoke() ?? Core.Projections.Tarife.Saat;

    /// <summary>Bis wann der Test gilt: wie beim Anlegen festgehalten, aber nie über ersten Tag + Testmonate hinaus —
    /// die Testlizenz ist nicht signiert, ein umgeschriebenes Datum verlängert nichts.</summary>
    private DateOnly? TestBis(Licence l)
    {
        if (ErsterTag?.Invoke() is not { } ab) return l.ValidUntil;
        var regel = ab.AddMonths(Liste.TestMonate).AddDays(-1);
        return l.ValidUntil is { } fest && fest < regel ? fest : regel;
    }
    private static DateOnly Heute => DateOnly.FromDateTime(DateTime.Today);

    /// <summary>
    /// Was gilt: eine Lizenz mit passender Signatur, die nicht abgelaufen ist, oder der laufende Test — sonst Kostenlos
    /// (auch, wenn sie im laufenden Betrieb abläuft).
    /// </summary>
    public Licence Lic
    {
        get
        {
            Einmal();
            var l = _stand.Lic;
            if (l.Trial == true) return TestBis(l) is { } bis && bis >= Heute ? l with { ValidUntil = bis } : Licence.Frei;
            return _stand.Geprueft && !l.Abgelaufen ? l : Licence.Frei;
        }
    }
    /// <summary>Was eingespielt oder angelegt ist — auch abgelaufen oder ohne Signatur, zum Anzeigen.</summary>
    public Licence Roh { get { Einmal(); return _stand.Lic.Trial == true ? _stand.Lic with { ValidUntil = TestBis(_stand.Lic) } : _stand.Lic; } }
    public bool Geprueft { get { Einmal(); return _stand.Lic.Trial == true ? TestBis(_stand.Lic) >= Heute : _stand.Geprueft && !_stand.Lic.Abgelaufen; } }
    public string? Grund
    {
        get
        {
            Einmal();
            if (_stand.Lic.Trial == true) return TestBis(_stand.Lic) is { } bis && bis < Heute ? $"Test abgelaufen am {bis:dd.MM.yyyy}" : null;
            return _stand.Lic.Abgelaufen ? $"abgelaufen am {_stand.Lic.ValidUntil:dd.MM.yyyy}" : _stand.Grund;
        }
    }
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
            var e = Liste.Test;
            var test = new Licence(e.Key, null, ab.AddMonths(Liste.TestMonate).AddDays(-1), e.Week, e.Month, Instance: instanz?.Id, Trial: true);
            Neu(test);
            return;
        }
        _stand = ausDatei;
    }
}
