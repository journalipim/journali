using System.Globalization;

namespace Journali.Core.Licensing;

/// <summary>
/// Der Nutzungsbericht (05.10.2026): was eine Instanz einmal im Monat an den Lizenzserver meldet — nur, wenn ein Administrator es eingeschaltet
/// hat (Eintrag <c>UsageReportsSet</c>). Er enthält je Monat die Einträge nach Art, die Version und eine zufällige Kennung, die beim ersten
/// Einschalten entsteht: keine Namen, keine Inhalte, keine Lizenz und nicht die Kennung der Instanz. Er ist nicht signiert — eine Signatur mit dem
/// Schlüssel der Instanz machte ihn zuordenbar.
/// <para>Beide Seiten nutzen diesen Code: journali schreibt den Bericht, der Lizenzserver prüft ihn mit <see cref="Fehler"/>.</para>
/// </summary>
public sealed record Nutzungsbericht(string Id, string? Version, IReadOnlyList<BerichtMonat> Monate)
{
    public const int MaxMonate = 120, MaxArten = 16;

    /// <summary>Was an dem Bericht nicht stimmt — null, wenn er angenommen werden kann.</summary>
    public static string? Fehler(Nutzungsbericht? b)
    {
        if (b is null) return "Kein Bericht.";
        if (!Guid.TryParseExact(b.Id ?? "", "N", out _)) return "Kennung ungültig.";
        if (b.Version is { Length: > 32 }) return "Version zu lang.";
        if (b.Monate is null || b.Monate.Count > MaxMonate) return "Zu viele Monate.";
        foreach (var m in b.Monate)
        {
            if (m?.Monat is null || !DateOnly.TryParseExact(m.Monat + "-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)) return "Monat ungültig.";
            if (m.Arten is null || m.Arten.Count > MaxArten) return "Zu viele Arten.";
            foreach (var (k, v) in m.Arten) if (k.Length is 0 or > 32 || v < 0) return "Art ungültig.";
        }
        return null;
    }
}

/// <summary>Ein Monat im Bericht: <c>JJJJ-MM</c> und die Einträge je Art (<c>data</c>, <c>model</c> …).</summary>
public sealed record BerichtMonat(string Monat, IReadOnlyDictionary<string, int> Arten);
