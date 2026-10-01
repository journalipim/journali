using System.Net;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;

namespace Journali.Server;

/// <summary>
/// Die Anmeldung zählt Fehlversuche (01.10.2026): je Name und je Absender. Nach der Schwelle gilt eine Sperre von einer Minute, in der der Server nicht einmal
/// das Passwort prüft — ein Versuch mit bekanntem Namen kostet 210 000 Runden PBKDF2. Das Raten wird so zu einer Handvoll Versuche je Minute, und eine Flut
/// falscher Anmeldungen kostet den Server nichts. Wer sein Passwort richtig eingibt, setzt den Zähler seines Namens zurück.
/// </summary>
public sealed class LoginBremse
{
    public const int FehlversuchePerName = 8, FehlversuchePerAbsender = 30;
    public static readonly TimeSpan Fenster = TimeSpan.FromMinutes(10), Sperre = TimeSpan.FromMinutes(1);

    private readonly Dictionary<string, (int Fehler, DateTime Fenster, DateTime Bis)> _z = new();
    private readonly Func<DateTime> _jetzt;
    public LoginBremse(Func<DateTime>? jetzt = null) => _jetzt = jetzt ?? (() => DateTime.UtcNow);

    /// <summary>Wie lange dieser Schlüssel noch gesperrt ist; null = er darf versuchen.</summary>
    public TimeSpan? Gesperrt(string schluessel)
    {
        lock (_z) return _z.TryGetValue(schluessel, out var e) && e.Bis > _jetzt() ? e.Bis - _jetzt() : null;
    }

    /// <summary>Ein Versuch während der Sperre setzt sie wieder auf die volle Minute (wer weiter probiert, wartet von vorn). Wirkt nur auf einen gesperrten Schlüssel.</summary>
    public void Verlaengern(string schluessel)
    {
        lock (_z)
        {
            var jetzt = _jetzt();
            if (_z.TryGetValue(schluessel, out var e) && e.Bis > jetzt) _z[schluessel] = (e.Fehler, e.Fenster, jetzt + Sperre);
        }
    }

    public void Fehler(string schluessel, int schwelle)
    {
        lock (_z)
        {
            var jetzt = _jetzt();
            _z.TryGetValue(schluessel, out var e);
            if (e.Fenster == default || jetzt - e.Fenster > Fenster) e = (0, jetzt, default);
            e.Fehler++;
            if (e.Fehler >= schwelle) e = (0, jetzt, jetzt + Sperre);
            _z[schluessel] = e;
            if (_z.Count > 10_000) foreach (var k in _z.Where(p => p.Value.Bis < jetzt && jetzt - p.Value.Fenster > Fenster).Select(p => p.Key).ToList()) _z.Remove(k);   // Namen, die nur geraten wurden, bleiben nicht liegen
        }
    }

    public void Erfolg(string schluessel) { lock (_z) _z.Remove(schluessel); }
}

/// <summary>
/// Eine Obergrenze für Anfragen je Absender (01.10.2026): ein Eimer von 600 Anfragen, der sich mit 30 je Sekunde füllt. Eine Seite braucht einige Dutzend Anfragen
/// auf einmal, die Oberfläche fragt alle 3 Sekunden — beides liegt weit darunter; eine Flut von einer Adresse nicht. Ausgenommen ist, was vom Rechner des Servers
/// selbst kommt (Jobs und Prozesse der Plugins rufen den Server unter seiner eigenen Adresse): sie sind kein Absender im Netz.
/// </summary>
public static class Begrenzung
{
    public const int Eimer = 600, ProSekunde = 30;

    /// <summary>Der Weg, auf dem grosse Dateien ankommen dürfen: ein Medium hochladen und ein Blob ablegen. Alles andere bleibt bei der Grenze von Kestrel (30 MB).</summary>
    public static bool IstUpload(HttpRequest r) =>
        (HttpMethods.IsPost(r.Method) && r.Path.Equals("/api/media", StringComparison.OrdinalIgnoreCase))
        || (HttpMethods.IsPut(r.Method) && r.Path.StartsWithSegments("/api/media/blob", StringComparison.OrdinalIgnoreCase));

    public static RateLimitPartition<string> Partition(HttpContext ctx, Func<TokenBucketRateLimiterOptions>? optionen = null)
    {
        var von = ctx.Connection.RemoteIpAddress; var an = ctx.Connection.LocalIpAddress;
        if (von is null || IPAddress.IsLoopback(von) || (an is not null && von.Equals(an))) return RateLimitPartition.GetNoLimiter("lokal");
        return RateLimitPartition.GetTokenBucketLimiter(von.ToString(), _ => optionen?.Invoke() ?? new TokenBucketRateLimiterOptions
        {
            TokenLimit = Eimer, TokensPerPeriod = ProSekunde, ReplenishmentPeriod = TimeSpan.FromSeconds(1), QueueLimit = 0, AutoReplenishment = true,
        });
    }
}
