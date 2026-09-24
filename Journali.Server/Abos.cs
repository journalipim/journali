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
/// eine signierte Anfrage an <c>JOURNALI_LIZENZSERVER</c> und bekommt einen signierten Stand zurück, der als
/// <see cref="Types.EntitlementReceived"/> ins Journal des Teams geht. Täglich wird aufgefrischt.
/// <para>Geprüft wird die Antwort gegen die Anfrage (Fingerabdruck, Instanz, Team) und — wenn <c>JOURNALI_LICENCE_KEY</c>
/// gesetzt ist — die Signatur des Lizenzservers. Ohne ihn wird der Stand angenommen, aber als ungeprüft vermerkt, wie
/// bei der Lizenz. Der Shop-Schlüssel liegt beim Server (<c>jobs/secrets.json</c>, <c>abo:&lt;team&gt;</c>), nie im Journal.</para>
/// </summary>
public sealed class Abos(Instanz instanz, string jobsDir, HttpClient http, Func<string?> lizenzserver, Func<string?> ausstellerPub, TimeProvider? uhr = null)
{
    public static string SecretKey(string team) => "abo:" + team;
    /// <summary>Nach so langer Zeit wird der Stand eines Teams neu geholt.</summary>
    public static readonly TimeSpan Auffrischen = TimeSpan.FromHours(20);

    private DateTimeOffset Jetzt => (uhr ?? TimeProvider.System).GetUtcNow();

    /// <summary>Ist ein Lizenzserver eingestellt?</summary>
    public bool Eingestellt => !string.IsNullOrWhiteSpace(lizenzserver());

    /// <summary>Anfrage schicken, Antwort prüfen, Stand ins Journal. Liefert den Stand oder den Grund, warum nicht.</summary>
    public async Task<(EntitlementReceived? Stand, string? Fehler)> VerbindenAsync(Catalog c, string team, string key, string actor, CancellationToken ct = default)
    {
        var adresse = lizenzserver();
        if (string.IsNullOrWhiteSpace(adresse)) return (null, "Kein Lizenzserver eingestellt (JOURNALI_LIZENZSERVER).");
        key = key.Trim();
        if (key.Length is < 8 or > 100) return (null, "Kein Lizenzschlüssel.");
        var zahler = c.With((_, _, _) => c.Teams.Get(team) is null ? null : c.Teams.Payer(team));
        if (zahler is null) return (null, $"Team „{team}“ gibt es nicht.");
        if (zahler != team) return (null, "Das Team rechnet über ein anderes Team ab.");

        var r = new KeyRequest("a-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(8)).ToLowerInvariant(), "abo", instanz.Id, instanz.PublicKey,
            Created: Jetzt, Team: team, Key: key);
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
        var pub = ausstellerPub();
        var (echt, _) = Signaturen.Pruefe(e.Rumpf, e.Sig, pub);
        if (!echt && !string.IsNullOrWhiteSpace(pub)) return (null, "Die Signatur des Lizenzservers passt nicht.");

        var stand = new EntitlementReceived(e.Instance, e.Team, e.Plan, e.EntriesWeek, e.EntriesMonth, e.Status ?? "", e.PaidUntil.Value,
            e.Issued.Value, e.ValidUntil.Value, e.Request, e.Sig, echt);
        c.With((_, _, write) => write(actor, Teams.Stream + team, Types.EntitlementReceived, stand, null));
        Secrets.Set(jobsDir, SecretKey(team), new() { ["key"] = key });
        return (stand, null);
    }

    /// <summary>Alle Teams mit Abo, deren Stand älter als <see cref="Auffrischen"/> ist, neu fragen. Liefert, wie viele es waren.</summary>
    public async Task<int> AuffrischenAsync(Catalog c, CancellationToken ct = default)
    {
        if (!Eingestellt) return 0;
        var teams = c.With((_, _, _) => c.Teams.All.Values.Select(t => (t.Key, t.Abo?.Issued)).ToList());
        var n = 0;
        foreach (var (team, zuletzt) in teams)
        {
            if (zuletzt is { } z && Jetzt - z < Auffrischen) continue;
            if (!Secrets.Get(jobsDir, SecretKey(team)).TryGetValue("key", out var key) || string.IsNullOrWhiteSpace(key)) continue;
            var (_, fehler) = await VerbindenAsync(c, team, key, "system", ct);
            if (fehler is null) n++;
            else Console.WriteLine($"journali: Abo {team} nicht aufgefrischt — {fehler}");
        }
        return n;
    }
}
