using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Journali.Core.Licensing;

// Was journali und der Lizenzserver miteinander austauschen (Taloan, 24.09.2026: „jetzt bauen wir den Lizenzserver“).
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
    string? Sig = null)
{
    public static JsonSerializerOptions Json => Signaturen.Json;
    /// <summary>Was signiert wird: alles ausser der Signatur.</summary>
    [JsonIgnore] public string Rumpf => JsonSerializer.Serialize(this with { Sig = null }, Json);
}

/// <summary>
/// Der Stand eines Abos, wie ihn der Lizenzserver bestätigt (Taloan, 24.09.2026) — Antwort auf eine signierte Anfrage der
/// Instanz, signiert mit dem Lizenzschlüssel. Die Instanz legt ihn ab und fragt täglich neu.
/// <list type="bullet">
/// <item><see cref="PaidUntil"/>: bezahlt bis (Lemon Squeezy: renews_at, nach einer Kündigung ends_at).</item>
/// <item><see cref="ValidUntil"/>: so lange gilt dieser Stand ohne neue Abfrage — ausgestellt + 7 Tage (Taloan: „ohne
/// Verbindung gilt der letzte Stand 7 Tage“). Wirksam ist der frühere von beiden.</item>
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
    string? Sig = null)
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
