using System.Text.RegularExpressions;

namespace Journali.Server;

/// <summary>
/// HTML-Werte (07.10.2026): was Skript ausführen könnte, wird beim Speichern abgewiesen — Skript-, Rahmen- und Objekt-Tags, Ereignisattribute
/// (on…), javascript:-Adressen, srcdoc und HTML als data:-Adresse. Ein HTML-Wert ist Text mit Auszeichnung, kein Programm; wer nur pflegen darf,
/// soll im Browser eines anderen nichts ausführen. Die Oberfläche bereinigt zusätzlich beim Anzeigen (web/src/html-sicher.js).
/// </summary>
public static partial class HtmlPruefung
{
    [GeneratedRegex(@"<\s*/?\s*(script|iframe|frame|frameset|object|embed|applet|style|link|meta|base|form|svg|math|template)\b|[\s/""'](on[a-z]+)\s*=|javascript\s*:|vbscript\s*:|srcdoc\s*=|data\s*:\s*text/html",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 200)]
    private static partial Regex Gefahr();

    /// <summary>Enthält der Wert etwas, das im Browser ausgeführt werden könnte?</summary>
    public static bool Unsicher(string? html) => !string.IsNullOrEmpty(html) && Gefahr().IsMatch(System.Net.WebUtility.HtmlDecode(html));
}
