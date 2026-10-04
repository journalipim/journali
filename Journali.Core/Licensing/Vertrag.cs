using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Journali.Core.Licensing;

// Was journali und der Lizenzserver miteinander austauschen.
// Beide Seiten prüfen und schreiben mit demselben Code — darum liegt er im Kern, nicht im Server. Nichts davon ist geheim:
// gesichert wird mit den Schlüsseln (Instanz, Aussteller), nicht mit dem Code.
//
// Signaturen: ECDSA P-256 über SHA-256, im Format r‖s (IEEE P1363, 64 Byte), Base64. Signiert wird immer ein Text, so wie
// er dasteht (der Rumpf) — keine Seite muss JSON gleich schreiben wie die andere.

/// <summary>Signaturen prüfen und schreiben — mit dem übergebenen Schlüssel.</summary>
public static class Signaturen
{
    /// <summary>Passt <paramref name="sig"/> zu <paramref name="rumpf"/> unter dem öffentlichen Schlüssel <paramref name="pub"/> (SubjectPublicKeyInfo, Base64)?</summary>
    public static (bool Ok, string? Grund) Pruefe(string rumpf, string? sig, string? pub)
    {
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

    /// <summary>Einen Text signieren — r‖s, Base64.</summary>
    public static string Signiere(ECDsa schluessel, string rumpf) =>
        Convert.ToBase64String(schluessel.SignData(Encoding.UTF8.GetBytes(rumpf), HashAlgorithmName.SHA256));

    /// <summary>Der öffentliche Schlüssel eines Paars als SubjectPublicKeyInfo, Base64.</summary>
    public static string Oeffentlich(ECDsa schluessel) => Convert.ToBase64String(schluessel.ExportSubjectPublicKeyInfo());

    public static readonly JsonSerializerOptions Json = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
}

/// <summary>
/// Wem journali glaubt: dem Lizenzserver. Sein öffentlicher Schlüssel ist eingebaut, nicht einstellbar — was eine Lizenz,
/// ein Schlüssel, ein Abo-Stand oder ein Tarifblatt zusagt, gilt nur mit seiner Signatur (25.09.2026: nur Signiertes
/// zählt). Eine Umgebungsvariable, die man weglassen kann, wäre ein Schalter „Prüfung aus“.
/// <para><see cref="Vertraue"/> nimmt einen weiteren Schlüssel dazu — für Tests und für einen Prüf-Aussteller in der
/// Entwicklung (der Server ruft es nur im Debug-Bau auf). Wer das in einem Release-Bau aufruft, hat den Quelltext
/// geändert; das verbietet die Lizenz von journali (LICENSE: „circumvent the license key functionality“).</para>
/// </summary>
public static class Aussteller
{
    /// <summary>
    /// Die Adresse des Lizenzservers. Sie steht hier und nicht in der Umgebung: eine Instanz soll ein Abo ohne
    /// Einrichtung auffrischen können, und der Name bleibt, während der Server dahinter wechseln darf (DNS).
    /// Sie schützt nichts — das tut <see cref="Oeffentlich"/>: wer die Anfrage woandershin lenkt, bekommt keinen
    /// Stand, den journali annimmt. Nur der Debug-Bau darf sie überschreiben (<c>JOURNALI_LIZENZSERVER</c>).
    /// </summary>
    public const string Adresse = "https://lizenz.journali.de";

    /// <summary>Der öffentliche Schlüssel des Lizenzservers (SubjectPublicKeyInfo, Base64).</summary>
    public const string Oeffentlich = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE8e7YORKhRzDQN+tBGTKCtu6ClvPuA5hgZMieASqnaZ8DzRX+mQo2rduxrGzGJOah8Xr5/BspH4p7oBvqEfm9uw==";

    private static readonly object Sperre = new();
    private static string[] _weitere = [];

    /// <summary>Einen weiteren Schlüssel annehmen (Tests, Prüf-Aussteller im Debug-Bau).</summary>
    public static void Vertraue(string pub)
    {
        if (string.IsNullOrWhiteSpace(pub)) return;
        lock (Sperre) if (!_weitere.Contains(pub.Trim())) _weitere = [.. _weitere, pub.Trim()];
    }

    /// <summary>Signiert von einem der Schlüssel, denen journali glaubt? Der Grund kommt vom eingebauten.</summary>
    public static (bool Ok, string? Grund) Pruefe(string rumpf, string? sig)
    {
        var eingebaut = Signaturen.Pruefe(rumpf, sig, Oeffentlich);
        if (eingebaut.Ok) return eingebaut;
        foreach (var pub in _weitere) if (Signaturen.Pruefe(rumpf, sig, pub).Ok) return (true, null);
        return eingebaut;
    }
}

/// <summary>
/// Das Tarifblatt holen, ohne etwas zu besitzen (26.09.2026): eine Instanz kennt sonst weder Grenzen noch Aktionen des
/// Shops, solange niemand gekauft hat. Die Anfrage nennt nur Instanz und öffentlichen Schlüssel und ist signiert; die
/// Antwort ist das signierte Blatt.
/// </summary>
public static class Tarifabruf
{
    public const string Art = "tarife";
}

/// <summary>
/// Was der Lizenzserver auf eine Tarifanfrage antwortet: das Blatt für alle, dazu was für diese eine Instanz gilt.
/// </summary>
public sealed record TarifeAntwort(Tarifblatt Blatt, Freigabe? Freigabe = null);

/// <summary>
/// Was der Lizenzserver dieser Instanz erlaubt (26.09.2026). <see cref="VonHand"/>: der Weg über kopierte Anforderungen
/// und Schlüssel. Er ist erklärungsbedürftig und setzt einen Kontakt voraus — darum gibt ihn der Support je Instanz
/// frei, und in der Oberfläche steht er erst dann. Signiert, damit ihn niemand sich selbst gibt.
/// </summary>
public sealed record Freigabe(
    string? Instance = null,
    bool VonHand = false,
    DateTimeOffset? At = null,
    /// <summary>Fingerabdruck der Anfrage — die Freigabe gehört zu genau einer.</summary>
    string? Request = null,
    string? Sig = null)
{
    public static JsonSerializerOptions Json => Signaturen.Json;
    [JsonIgnore] public string Rumpf => JsonSerializer.Serialize(this with { Sig = null }, Json);
}

/// <summary>
/// Eine Aktion des Shops: ein Rabattcode, der Satz, der dazu beim Bestellen steht, und bis wann er gilt (null: ohne Ende).
/// </summary>
public sealed record RabattZeile(string Code, string Text, DateOnly? Bis = null)
{
    /// <summary>Gilt die Aktion an diesem Tag?</summary>
    public bool Gilt(DateOnly heute) => Bis is null || Bis >= heute;
}

/// <summary>Ein Tarif, wie ihn das Tarifblatt nennt. <see cref="Plugins"/> null = alle.</summary>
/// <param name="Server">Wie viele Server auf einer Datenbank laufen dürfen (04.10.2026, pflegestruktur 41). Null = wie bisher: ein unbegrenzter Tarif
/// (Woche und Monat ohne Grenze) beliebig viele, jeder andere einen.</param>
public sealed record TarifZeile(string Key, string Label, int Rang, int Week, int Month, int PubTrees, string[]? Plugins = null, int? Server = null);

/// <summary>
/// Was im Tarifblatt steht: alle Tarife mit Grenzen, Publikationsbäumen und Plugins, dazu welcher Tarif wie viele Monate
/// als Test gilt. <see cref="Version"/> zählt hoch — eine ältere Version ersetzt nie eine neuere.
/// <para><see cref="Kauf"/> ist die Adresse des Shops (26.09.2026): eine für alle Tarife — der Shop führt ein Produkt mit
/// je Tarif und Laufzeit einer Variante, und die Variante hat keine eigene Adresse. Sie steht hier, damit eine Instanz
/// den Shop kennt, ohne dass jemand sie einträgt; wer ein Team führt, bestellt damit Kontingent, und was gekauft wird,
/// findet über den Lizenzserver zum Team zurück.</para>
/// <para><see cref="Rabatte"/> sind die Aktionen des Shops (26.09.2026): je Zeile ein Rabattcode, der Satz dazu und
/// bis wann. Der Shop kennt keinen Streichpreis — er kennt nur Codes; der Code hängt beim Bestellen an der Adresse
/// (<c>checkout[discount_code]</c>), und was er wert ist, sagt der Satz.</para>
/// </summary>
public sealed record TarifblattInhalt(long Version, DateTimeOffset Ausgestellt, string TestTarif, int TestMonate, TarifZeile[] Tarife,
    string? Kauf = null, RabattZeile[]? Rabatte = null)
{
    public static JsonSerializerOptions Json => Signaturen.Json;

    /// <summary>Was an diesem Blatt nicht stimmt — null, wenn nichts. Prüfen beide Seiten: der Lizenzserver vor dem
    /// Signieren, journali vor dem Übernehmen.</summary>
    public string? Fehler()
    {
        if (Version < 1) return "Version fehlt.";
        if (Tarife is not { Length: > 0 }) return "Keine Tarife.";
        foreach (var z in Tarife)
        {
            if (string.IsNullOrWhiteSpace(z.Key) || z.Key != z.Key.Trim().ToLowerInvariant()) return $"Tarif „{z.Key}“: Schlüssel klein, ohne Leerzeichen.";
            if (string.IsNullOrWhiteSpace(z.Label)) return $"Tarif {z.Key}: Name fehlt.";
            if (z.Week < 0 || z.Month < 0 || z.PubTrees < 0 || z.Rang < 0) return $"Tarif {z.Key}: Werte ab 0.";
            if (z.Server is < 1) return $"Tarif {z.Key}: mindestens ein Server.";
        }
        if (Tarife.Select(z => z.Key).Distinct().Count() != Tarife.Length) return "Ein Tarif steht doppelt.";
        if (Tarife.Select(z => z.Rang).Distinct().Count() != Tarife.Length) return "Zwei Tarife haben denselben Rang.";
        if (!Tarife.Any(z => z.Rang == 0)) return "Kein Tarif mit Rang 0 (Kostenlos).";
        if (!Tarife.Any(z => z.Key == TestTarif)) return $"Test-Tarif {TestTarif} fehlt.";
        if (TestMonate is < 0 or > 24) return "Testmonate: 0 bis 24.";
        if (Kauf is { Length: > 0 } k && !(Uri.TryCreate(k, UriKind.Absolute, out var u) && u.Scheme == Uri.UriSchemeHttps)) return "Kauf ist keine https-Adresse.";
        foreach (var r in Rabatte ?? [])
        {
            if (string.IsNullOrWhiteSpace(r.Code) || r.Code.Length > 64 || r.Code.Any(char.IsWhiteSpace)) return "Rabattcode: bis 64 Zeichen, ohne Leerzeichen.";
            if (string.IsNullOrWhiteSpace(r.Text) || r.Text.Length > 200) return $"Rabatt {r.Code}: ein Satz, bis 200 Zeichen.";
        }
        if (Rabatte is { Length: > 0 } && Rabatte.Select(r => r.Code).Distinct(StringComparer.OrdinalIgnoreCase).Count() != Rabatte.Length) return "Ein Rabattcode steht doppelt.";
        return null;
    }
}

/// <summary>
/// Das Tarifblatt, wie es der Lizenzserver ausliefert: der Text so, wie er signiert wurde, und die Signatur. Es kommt mit
/// jedem Abo-Stand und jedem Schlüssel zum Kopieren; journali legt eine neuere Version als Eintrag ins Journal
/// (<c>TarifeReceived</c>) — so ändern sich Grenzen, Plugins und Publikationsbäume ohne neues Image.
/// </summary>
public sealed record Tarifblatt(string Blatt, string Sig)
{
    [JsonIgnore] public TarifblattInhalt? Inhalt { get { try { return JsonSerializer.Deserialize<TarifblattInhalt>(Blatt, TarifblattInhalt.Json); } catch { return null; } } }

    /// <summary>Echt (<see cref="Aussteller"/>) und in sich stimmig? Liefert den Inhalt oder den Grund.</summary>
    public (TarifblattInhalt? Inhalt, string? Fehler) Pruefe()
    {
        var (echt, grund) = Aussteller.Pruefe(Blatt, Sig);
        if (!echt) return (null, "Tarifblatt: " + grund);
        if (Inhalt is not { } i) return (null, "Tarifblatt unlesbar.");
        return i.Fehler() is { } f ? (null, "Tarifblatt: " + f) : (i, null);
    }
}

/// <summary>
/// Eine Anforderung dieser Instanz.
/// <para>Der Weg eines Schlüssels zum Kopieren (Instanzen ohne Internet):</para>
/// <list type="number">
/// <item>Die Instanz schreibt die Anforderung (Art, Grenzen, Dauer) und signiert sie mit ihrem eigenen Schlüsselpaar.
/// Der öffentliche Schlüssel steht in der Anforderung — der Aussteller kann sie prüfen, ohne die Instanz zu kennen, und
/// merkt sich beim ersten Mal, zu welcher Kennung welcher öffentliche Schlüssel gehört.</item>
/// <item>Der Shop gibt sie frei: er signiert den Fingerabdruck (<see cref="SignedRequest.Hash"/>) mit seinem Schlüssel.</item>
/// <item>Der Aussteller prüft beide Signaturen und stellt den Schlüssel aus: mit derselben Id und dem Fingerabdruck
/// der Anforderung (<see cref="LicenceKey.Request"/>), signiert mit dem Lizenzschlüssel.</item>
/// <item>Die Instanz löst nur Schlüssel ein, zu denen sie selbst eine Anforderung hat.</item>
/// </list>
/// <para>Beim Abo (Lizenzserver) ist sie die Anfrage der Instanz: <see cref="Team"/> und der Lizenzschlüssel aus dem Shop
/// (<see cref="Key"/>) stehen darin; die Antwort ist ein <see cref="Entitlement"/> mit ihrem Fingerabdruck.</para>
/// </summary>
public sealed record KeyRequest(
    string? Id = null,
    string? Kind = null,
    string? Instance = null,
    string? Pub = null,
    string? Plan = null,
    int EntriesWeek = 0,
    int EntriesMonth = 0,
    int Days = 0,
    DateTimeOffset? Created = null,
    /// <summary>Abo: das Team, für das der Stand gilt.</summary>
    string? Team = null,
    /// <summary>Abo: der Lizenzschlüssel aus dem Shop.</summary>
    string? Key = null)
{
    public static JsonSerializerOptions Json => Signaturen.Json;
}

/// <summary>Anforderung und Signatur, so wie sie an den Shop oder den Lizenzserver geht.</summary>
public sealed record SignedRequest(string Anforderung, string Sig)
{
    /// <summary>Fingerabdruck: SHA-256 über den Rumpf, hex. Den signiert der Shop, den trägt der Schlüssel oder der Stand.</summary>
    [JsonIgnore] public string Hash => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Anforderung))).ToLowerInvariant();
    [JsonIgnore] public KeyRequest? Inhalt { get { try { return JsonSerializer.Deserialize<KeyRequest>(Anforderung, KeyRequest.Json); } catch { return null; } } }
    /// <summary>Anforderung und Signatur als ein Text — das, was kopiert und verschickt wird.</summary>
    [JsonIgnore] public string Text => JsonSerializer.Serialize(this, KeyRequest.Json);

    /// <summary>Passt die Signatur zum öffentlichen Schlüssel, der in der Anforderung steht? Das prüft auch der Aussteller.</summary>
    public (bool Ok, string? Grund) Pruefe()
    {
        if (Inhalt is not { Pub: { Length: > 0 } pub }) return (false, "Anforderung ohne öffentlichen Schlüssel");
        var (ok, grund) = Signaturen.Pruefe(Anforderung, Sig, pub);
        return ok ? (true, null) : (false, grund == "Signatur passt nicht" ? "Signatur der Anforderung passt nicht" : "Anforderung nicht prüfbar: " + grund);
    }
}

/// <summary>
/// Ein Lizenzschlüssel zum Kopieren, wie ihn der Aussteller ausstellt.
/// <para>Er nennt die Instanz, für die er gilt, aber kein Team — das wählt die IT beim Einlösen. Die Art sagt, was
/// er tut (reset oder limit), bei einem Limit auch wie viel und wie lange. <c>Request</c> ist der Fingerabdruck der
/// Anforderung, zu der er ausgestellt wurde; die Id ist die der Anforderung. Die Signatur deckt alles davon ab.</para>
/// </summary>
public sealed record LicenceKey(
    string? Id = null,
    string? Kind = null,
    string? Instance = null,
    int EntriesWeek = 0,
    int EntriesMonth = 0,
    int Days = 0,
    DateOnly? Issued = null,
    string? Request = null,
    /// <summary>Der Tarif: beim Limit das Paket, beim Reset, für welchen Tarif er gilt (pro | enterprise).</summary>
    string? Plan = null,
    string? Sig = null,
    /// <summary>Das Tarifblatt des Lizenzservers — so kommt es auch zu Instanzen ohne Internet. Hinter <c>Sig</c>, damit
    /// die Reihenfolge der übrigen Felder im Rumpf bleibt; null bei Schlüsseln von davor.</summary>
    Tarifblatt? Blatt = null)
{
    public static JsonSerializerOptions Json => Signaturen.Json;
    /// <summary>Was signiert wird: alles ausser der Signatur.</summary>
    [JsonIgnore] public string Rumpf => JsonSerializer.Serialize(this with { Sig = null }, Json);
}

/// <summary>
/// Der Stand eines Abos, wie ihn der Lizenzserver bestätigt — Antwort auf eine signierte Anfrage der
/// Instanz, signiert mit dem Lizenzschlüssel. Die Instanz legt ihn ab und fragt täglich neu.
/// <list type="bullet">
/// <item><see cref="PaidUntil"/>: bezahlt bis (Lemon Squeezy: renews_at, nach einer Kündigung ends_at).</item>
/// <item><see cref="ValidUntil"/>: so lange gilt dieser Stand ohne neue Abfrage — ausgestellt + 7 Tage. Wirksam ist der frühere von beiden.</item>
/// <item><see cref="Request"/>: Fingerabdruck der Anfrage — ein Stand gehört zu genau einer Anfrage, ein alter lässt
/// sich nicht als neuer einspielen.</item>
/// </list>
/// </summary>
public sealed record Entitlement(
    string? Instance = null,
    string? Team = null,
    string? Plan = null,
    int EntriesWeek = 0,
    int EntriesMonth = 0,
    string? Status = null,
    DateOnly? PaidUntil = null,
    DateTimeOffset? Issued = null,
    DateTimeOffset? ValidUntil = null,
    string? Request = null,
    string? Sig = null,
    /// <summary>Das Tarifblatt des Lizenzservers (null bei Ständen von davor).</summary>
    Tarifblatt? Blatt = null,
    /// <summary>Zusätzliche Server auf derselben Datenbank, die dieses Abo der Instanz gibt (04.10.2026, Zusatz „Multi-Server“). Null = keine — und nicht
    /// im Rumpf: so bleiben Stände ohne Zusatz für Instanzen von davor lesbar und ihre Signatur gleich. Hinter <c>Blatt</c>, damit die Reihenfolge bleibt.</summary>
    int? Server = null)
{
    /// <summary>So lange gilt ein Stand ohne Verbindung zum Lizenzserver.</summary>
    public static readonly TimeSpan Kulanz = TimeSpan.FromDays(7);

    public static JsonSerializerOptions Json => Signaturen.Json;
    /// <summary>Was signiert wird: alles ausser der Signatur.</summary>
    [JsonIgnore] public string Rumpf => JsonSerializer.Serialize(this with { Sig = null }, Json);

    /// <summary>Gilt der Stand zu diesem Zeitpunkt? Bezahlt und noch nicht über die Kulanz hinaus.</summary>
    public bool GiltAm(DateTimeOffset jetzt) =>
        ValidUntil is { } v && jetzt <= v && PaidUntil is { } p && DateOnly.FromDateTime(jetzt.LocalDateTime) <= p;
}

/// <summary>
/// Die Bestätigung des Lizenzservers, dass ein Schlüssel ohne Anforderung eingelöst ist (25.09.2026): ein Schlüssel, den
/// der Lizenzserver von sich aus ausstellt, wird beim Einlösen dort vermerkt — ein zweites Einlösen scheitert, auch nach
/// einer Wiederherstellung der Instanz. Antwort auf eine signierte Anfrage der Instanz (<see cref="Art"/>: Schlüssel-Id
/// in <see cref="KeyRequest.Key"/>, Team in <see cref="KeyRequest.Team"/>), signiert mit dem Lizenzschlüssel.
/// </summary>
public sealed record Einloesung(
    string? Id = null,
    string? Instance = null,
    string? Team = null,
    DateTimeOffset? At = null,
    /// <summary>Fingerabdruck der Anfrage — die Bestätigung gehört zu genau einer.</summary>
    string? Request = null,
    string? Sig = null)
{
    /// <summary>Die Art der Anfrage (<see cref="KeyRequest.Kind"/>).</summary>
    public const string Art = "einloesen";
    public static JsonSerializerOptions Json => Signaturen.Json;
    [JsonIgnore] public string Rumpf => JsonSerializer.Serialize(this with { Sig = null }, Json);
}
