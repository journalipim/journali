using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Journali.Core.Entries;

/// <summary>
/// Vorlagen-Attribute: Textbausteine aus Attributen,
/// ohne KI und ohne Skript — für Redakteure, nicht Techniker. Der Wert des Attributs am Knoten ist die
/// Vorlage (je Sprache, wenn so definiert), das Ergebnis wird beim Lesen gebaut wie bei der Formel.
///
/// <code>
/// {name} mit {cpu}[, {ram} GB RAM][, {ssd|unit} SSD][ · {weight|1|unit}]
/// </code>
///
/// - <c>{key}</c>: Wert des Attributs am Knoten — geerbt zählt, Text in der Sprache der Spalte,
///   Werteliste zeigt ihr Label, Formel/Vorlage ihr Ergebnis.
/// - Zusätze mit <c>|</c>, beliebig verkettet: <c>|unit</c> hängt die Einheit an (kg, cm),
///   <c>|0</c> <c>|1</c> <c>|2</c> Nachkommastellen in der Sprache (de 1,5), <c>|upper</c> <c>|lower</c>
///   <c>|capitalize</c>, <c>|plain</c> nimmt HTML-Tags weg.
/// - <c>[ … ]</c>: der Abschnitt fällt ganz weg, wenn darin ein Platzhalter leer ist — so bleibt kein
///   „, GB RAM“ übrig. Abschnitte dürfen ineinander liegen.
/// - <c>\{ \[ \\</c> für die Zeichen selbst. Zeilenumbrüche bleiben; doppelte Leerzeichen, die durch
///   weggefallene Abschnitte entstehen, werden zu einem. Leeres Ergebnis = kein Wert („—“).
/// </summary>
public static class Template
{
    /// <summary>Ein aufgelöster Wert für die Vorlage: Text, bei Zahlen dazu die Zahl, und die Einheit des Attributs.</summary>
    public readonly record struct Slot(string? Text, decimal? Number, string? Unit)
    {
        public static readonly Slot None = new(null, null, null);
        public bool IsEmpty => string.IsNullOrWhiteSpace(Text);
    }

    private static readonly Regex Placeholder = new(@"\{([A-Za-z_][A-Za-z0-9_]*)((?:\|[A-Za-z0-9]+)*)\}", RegexOptions.Compiled);

    /// <summary>Prüft die Vorlage; liefert die Attributschlüssel, die sie liest — oder eine Fehlermeldung.</summary>
    public static (string[] Keys, string? Error) Check(string template)
    {
        var keys = new List<string>();
        var depth = 0;
        for (var i = 0; i < template.Length; i++)
        {
            var ch = template[i];
            if (ch == '\\') { i++; continue; }
            if (ch == '[') depth++;
            else if (ch == ']') { if (--depth < 0) return ([], $"„]“ ohne „[“ an Stelle {i + 1}"); }
            else if (ch == '{')
            {
                var m = Placeholder.Match(template, i);
                if (!m.Success || m.Index != i) return ([], $"Platzhalter an Stelle {i + 1}: {{schlüssel}} oder {{schlüssel|unit|2}} erwartet");
                if (!keys.Contains(m.Groups[1].Value)) keys.Add(m.Groups[1].Value);
                foreach (var mod in m.Groups[2].Value.Split('|', StringSplitOptions.RemoveEmptyEntries))
                    if (!IsModifier(mod)) return ([], $"Unbekannter Zusatz |{mod} — erlaubt: unit, 0–6 (Nachkommastellen), upper, lower, capitalize, plain");
                i += m.Length - 1;
            }
            else if (ch == '}') return ([], $"„}}“ ohne „{{“ an Stelle {i + 1}");
        }
        if (depth > 0) return ([], "„[“ ohne „]“");
        return (keys.ToArray(), null);
    }

    private static bool IsModifier(string m) => m is "unit" or "upper" or "lower" or "capitalize" or "plain" || (m.Length == 1 && char.IsDigit(m[0]) && m[0] <= '6');

    /// <summary>Baut den Text; null, wenn nichts übrig bleibt.</summary>
    public static string? Render(string template, Func<string, Slot> slot, string? locale)
    {
        var (text, _) = Segment(template, 0, slot, locale, out _);
        // doppelte Leerzeichen aus weggefallenen Abschnitten, Leerraum vor Satzzeichen, Zeilenenden
        text = Regex.Replace(text, "[ \t]{2,}", " ");
        text = Regex.Replace(text, @" +([,.;:!?])", "$1");
        text = string.Join("\n", text.Split('\n').Select(l => l.Trim())).Trim();
        return text.Length == 0 ? null : text;
    }

    /// <summary>Ein Abschnitt bis zum passenden „]“ (oder Ende): Text und ob ein Platzhalter darin leer war.</summary>
    private static (string Text, bool Missing) Segment(string t, int start, Func<string, Slot> slot, string? locale, out int end)
    {
        var sb = new StringBuilder();
        var missing = false;
        var i = start;
        for (; i < t.Length; i++)
        {
            var ch = t[i];
            if (ch == '\\' && i + 1 < t.Length) { sb.Append(t[++i]); continue; }
            if (ch == ']') break;
            if (ch == '[')
            {
                var (inner, innerMissing) = Segment(t, i + 1, slot, locale, out var e);
                if (!innerMissing) sb.Append(inner);
                i = e;
                continue;
            }
            if (ch == '{')
            {
                var m = Placeholder.Match(t, i);
                if (m.Success && m.Index == i)
                {
                    var s = slot(m.Groups[1].Value);
                    if (s.IsEmpty) missing = true;
                    else sb.Append(Apply(s, m.Groups[2].Value, locale));
                    i += m.Length - 1;
                    continue;
                }
            }
            sb.Append(ch);
        }
        end = i;
        return (sb.ToString(), missing);
    }

    private static string Apply(Slot s, string mods, string? locale)
    {
        var text = s.Text ?? "";
        var unit = false;
        foreach (var mod in mods.Split('|', StringSplitOptions.RemoveEmptyEntries))
        {
            switch (mod)
            {
                case "unit": unit = true; break;
                case "upper": text = text.ToUpperInvariant(); break;
                case "lower": text = text.ToLowerInvariant(); break;
                case "capitalize": text = text.Length > 0 ? char.ToUpperInvariant(text[0]) + text[1..] : text; break;
                case "plain": text = Regex.Replace(text, "<[^>]+>", " ").Replace("&nbsp;", " "); text = Regex.Replace(text, @"\s+", " ").Trim(); break;
                default:
                    if (s.Number is { } n) text = n.ToString("F" + mod, Formula.CultureOf(locale));
                    break;
            }
        }
        return unit && !string.IsNullOrEmpty(s.Unit) ? $"{text} {s.Unit}" : text;
    }
}
