using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Licensing;
using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Das Abo eines Teams über den Lizenzserver (Taloan, 24.09.2026: „jetzt bauen wir den Lizenzserver“ — Abo je Team, ohne
/// Verbindung gilt der letzte Stand 7 Tage). Der Lizenzschlüssel aus dem Shop kommt ins eine Feld; die Instanz schickt
/// eine signierte Anfrage an den eingebauten Lizenzserver (<see cref="Aussteller.Adresse"/>) und bekommt einen
/// signierten Stand zurück, der als
/// <see cref="Types.EntitlementReceived"/> ins Journal des Teams geht. Täglich wird aufgefrischt.
/// <para>Geprüft wird die Antwort gegen die Anfrage (Fingerabdruck, Instanz, Team) und die Signatur des Lizenzservers
/// (<see cref="Aussteller"/>, eingebaut) — ohne passende Signatur wird nichts übernommen (25.09.2026). Das Tarifblatt,
/// das mit dem Stand kommt, geht als eigener Eintrag ins Journal, wenn es neuer ist. Der Shop-Schlüssel liegt beim
/// Server (<c>jobs/secrets.json</c>, <c>abo:&lt;team&gt;</c>), nie im Journal.</para>
/// <para>Ein Kauf aus der Oberfläche trägt keinen Schlüssel (26.09.2026): wer ein Team führt, bestellt im Shop, Instanz
/// und Team hängen am Buy-Link, und der Lizenzserver behält den Schlüssel. Die Anfrage geht dann ohne Schlüssel
/// hinaus — der Lizenzserver findet das Abo über Instanz und Team.</para>
/// </summary>
public sealed class Abos(Instanz instanz, string jobsDir, HttpClient http, Func<string?> lizenzserver, TimeProvider? uhr = null)
{
    public static string SecretKey(string team) => "abo:" + team;
    /// <summary>Nach so langer Zeit wird der Stand eines Teams neu geholt.</summary>
    public static readonly TimeSpan Auffrischen = TimeSpan.FromHours(20);

    private DateTimeOffset? _blattGeholt;

    private DateTimeOffset Jetzt => (uhr ?? TimeProvider.System).GetUtcNow();

    /// <summary>Ist ein Lizenzserver eingestellt?</summary>
    public bool Eingestellt => !string.IsNullOrWhiteSpace(lizenzserver());

    /// <summary>
    /// Anfrage schicken, Antwort prüfen, Stand ins Journal. Liefert den Stand oder den Grund, warum nicht.
    /// <para><paramref name="key"/> darf leer sein: dann fragt die Instanz nur mit Instanz und Team, und der
    /// Lizenzserver nimmt den Schlüssel, den er aus dem Kauf behalten hat.</para>
    /// </summary>
    public async Task<(EntitlementReceived? Stand, string? Fehler)> VerbindenAsync(Catalog c, string team, string? key, string actor, CancellationToken ct = default)
    {
        var adresse = lizenzserver();
        if (string.IsNullOrWhiteSpace(adresse)) return (null, "Kein Lizenzserver eingebaut.");
        key = key?.Trim() ?? "";
        if (key.Length > 0 && key.Length is < 8 or > 100) return (null, "Kein Lizenzschlüssel.");
        var zahler = c.With((_, _, _) => c.Teams.Get(team) is null ? null : c.Teams.Payer(team));
        if (zahler is null) return (null, $"Team „{team}“ gibt es nicht.");
        if (zahler != team) return (null, "Das Team rechnet über ein anderes Team ab.");

        var r = new KeyRequest("a-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(8)).ToLowerInvariant(), "abo", instanz.Id, instanz.PublicKey,
            Created: Jetzt, Team: team, Key: key.Length > 0 ? key : null);
        var rumpf = JsonSerializer.Serialize(r, KeyRequest.Json);
        var anfrage = new SignedRequest(rumpf, Convert.ToBase64String(instanz.Signiere(rumpf)));

        HttpResponseMessage res;
        try { res = await http.PostAsync(new Uri(new Uri(adresse.TrimEnd('/') + "/"), "v1/stand"), new StringContent(anfrage.Text, Encoding.UTF8, "application/json"), ct); }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException) { return (null, "Lizenzserver nicht erreichbar: " + ex.Message); }
        var text = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            try { if (JsonDocument.Parse(text).RootElement.TryGetProperty("error", out var f)) return (null, f.GetString()); } catch (JsonException) { }
            return (null, $"Lizenzserver: {(int)res.StatusCode}");
        }

        Entitlement? e;
        try { e = JsonSerializer.Deserialize<Entitlement>(text, new JsonSerializerOptions(JsonSerializerDefaults.Web)); }
        catch (JsonException) { return (null, "Antwort des Lizenzservers unlesbar."); }
        if (e is null) return (null, "Antwort des Lizenzservers leer.");
        if (e.Request != anfrage.Hash) return (null, "Die Antwort gehört nicht zu dieser Anfrage.");
        if (e.Instance != instanz.Id || e.Team != team) return (null, "Die Antwort gilt für eine andere Instanz oder ein anderes Team.");
        if (e.Plan is null || e.PaidUntil is null || e.Issued is null || e.ValidUntil is null) return (null, "Die Antwort ist unvollständig.");
        if (!Aussteller.Pruefe(e.Rumpf, e.Sig).Ok) return (null, "Die Signatur des Lizenzservers passt nicht.");

        // erst das Tarifblatt: der Stand nennt einen Tarif, den das Blatt vielleicht erst einführt
        c.NimmTarifblatt(e.Blatt, actor);
        var stand = new EntitlementReceived(e.Instance, e.Team, e.Plan, e.EntriesWeek, e.EntriesMonth, e.Status ?? "", e.PaidUntil.Value,
            e.Issued.Value, e.ValidUntil.Value, e.Request, e.Sig, true);
        c.With((_, _, write) => write(actor, Teams.Stream + team, Types.EntitlementReceived, stand, null));
        if (key.Length > 0) Secrets.Set(jobsDir, SecretKey(team), new() { ["key"] = key });
        return (stand, null);
    }

    /// <summary>Ein Team sofort neu fragen — mit dem gemerkten Shop-Schlüssel, und ohne ihn, wenn keiner hinterlegt ist
    /// (nach einem Kauf aus der Oberfläche und nach einem Eingriff in der Verwaltung soll niemand 20 Stunden warten).</summary>
    public async Task<(EntitlementReceived? Stand, string? Fehler)> AuffrischenAsync(Catalog c, string team, string actor, CancellationToken ct = default) =>
        await VerbindenAsync(c, team, Secrets.Get(jobsDir, SecretKey(team)).GetValueOrDefault("key"), actor, ct);

    /// <summary>
    /// Einen Schlüssel ohne Anforderung beim Lizenzserver einlösen: er vermerkt ihn für diese Instanz und dieses Team und
    /// bestätigt signiert. Liefert null, wenn er bestätigt hat, sonst den Grund. Ohne Bestätigung wird nicht eingelöst.
    /// </summary>
    public async Task<string?> EinloesenAsync(string keyId, string team, CancellationToken ct = default)
    {
        var adresse = lizenzserver();
        if (string.IsNullOrWhiteSpace(adresse)) return "Kein Lizenzserver eingebaut.";
        var r = new KeyRequest("e-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(8)).ToLowerInvariant(), Einloesung.Art, instanz.Id, instanz.PublicKey,
            Created: Jetzt, Team: team, Key: keyId);
        var rumpf = JsonSerializer.Serialize(r, KeyRequest.Json);
        var anfrage = new SignedRequest(rumpf, Convert.ToBase64String(instanz.Signiere(rumpf)));
        HttpResponseMessage res;
        try { res = await http.PostAsync(new Uri(new Uri(adresse.TrimEnd('/') + "/"), "v1/einloesen"), new StringContent(anfrage.Text, Encoding.UTF8, "application/json"), ct); }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException) { return "Lizenzserver nicht erreichbar: " + ex.Message; }
        var text = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            try { if (JsonDocument.Parse(text).RootElement.TryGetProperty("error", out var f)) return f.GetString(); } catch (JsonException) { }
            return $"Lizenzserver: {(int)res.StatusCode}";
        }
        Einloesung? e;
        try { e = JsonSerializer.Deserialize<Einloesung>(text, new JsonSerializerOptions(JsonSerializerDefaults.Web)); }
        catch (JsonException) { return "Antwort des Lizenzservers unlesbar."; }
        if (e is null || e.Request != anfrage.Hash || e.Id != keyId || e.Instance != instanz.Id || e.Team != team) return "Die Antwort gehört nicht zu dieser Anfrage.";
        if (!Aussteller.Pruefe(e.Rumpf, e.Sig).Ok) return "Die Signatur des Lizenzservers passt nicht.";
        return null;
    }

    /// <summary>
    /// Das Tarifblatt holen, ohne Abo und ohne Schlüssel (26.09.2026): eine frische Anlage kennt sonst weder die Tarife
    /// des Shops noch seine Aktionen, weil sie den Lizenzserver erst beim ersten Kauf fragen würde. Die Anfrage nennt
    /// Instanz und öffentlichen Schlüssel, sonst nichts. Übernommen wird nur ein neueres Blatt mit gültiger Signatur.
    /// </summary>
    public async Task<string?> TarifblattAsync(Catalog c, CancellationToken ct = default)
    {
        var adresse = lizenzserver();
        if (string.IsNullOrWhiteSpace(adresse)) return "Kein Lizenzserver eingebaut.";
        var r = new KeyRequest("t-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(8)).ToLowerInvariant(), Tarifabruf.Art, instanz.Id, instanz.PublicKey, Created: Jetzt);
        var rumpf = JsonSerializer.Serialize(r, KeyRequest.Json);
        var anfrage = new SignedRequest(rumpf, Convert.ToBase64String(instanz.Signiere(rumpf)));
        HttpResponseMessage res;
        try { res = await http.PostAsync(new Uri(new Uri(adresse.TrimEnd('/') + "/"), "v1/tarife"), new StringContent(anfrage.Text, Encoding.UTF8, "application/json"), ct); }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException) { return "Lizenzserver nicht erreichbar: " + ex.Message; }
        var text = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            try { if (JsonDocument.Parse(text).RootElement.TryGetProperty("error", out var f)) return f.GetString(); } catch (JsonException) { }
            return $"Lizenzserver: {(int)res.StatusCode}";
        }
        Tarifblatt? b;
        try { b = JsonSerializer.Deserialize<Tarifblatt>(text, new JsonSerializerOptions(JsonSerializerDefaults.Web)); }
        catch (JsonException) { return "Antwort des Lizenzservers unlesbar."; }
        if (b is null) return "Antwort des Lizenzservers leer.";
        _blattGeholt = Jetzt;
        c.NimmTarifblatt(b, "system");
        return null;
    }

    /// <summary>Alle Teams mit Abo, deren Stand älter als <see cref="Auffrischen"/> ist, neu fragen. Liefert, wie viele es waren.</summary>
    public async Task<int> AuffrischenAsync(Catalog c, CancellationToken ct = default)
    {
        if (!Eingestellt) return 0;
        // Das Tarifblatt zuerst, auch ohne Abo — aber nur, wenn die Anlage registriert ist oder ohnehin ein Abo hat:
        // wer nicht registriert ist, schickt nichts hinaus (26.09.2026).
        var darf = c.Registriert == true || c.With((_, _, _) => c.Teams.All.Values.Any(x => x.Abo is not null));
        if (darf && (_blattGeholt is not { } zuvor || Jetzt - zuvor >= Auffrischen))
            if (await TarifblattAsync(c, ct) is { } fehler) Console.WriteLine($"journali: Tarifblatt nicht geholt — {fehler}");
        var teams = c.With((_, _, _) => c.Teams.All.Values.Select(t => (t.Key, t.Abo?.Issued)).ToList());
        var n = 0;
        foreach (var (team, zuletzt) in teams)
        {
            if (zuletzt is { } z && Jetzt - z < Auffrischen) continue;
            var key = Secrets.Get(jobsDir, SecretKey(team)).GetValueOrDefault("key");
            // Ohne Schlüssel nur die Teams, die schon einen Stand haben: ihr Kauf liegt beim Lizenzserver
            if (string.IsNullOrWhiteSpace(key) && zuletzt is null) continue;
            var (_, fehler) = await VerbindenAsync(c, team, key, "system", ct);
            if (fehler is null) n++;
            else Console.WriteLine($"journali: Abo {team} nicht aufgefrischt — {fehler}");
        }
        return n;
    }
}
