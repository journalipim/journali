using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Journali.Core.Entries;

namespace Journali.Server;

/// <summary>
/// Eingabefilter der Demo (07.10.2026): was ein Besucher als Text schreibt — Werte, Namen von Knoten und Rubriken, Übersetzungen, Belege —, darf
/// keinen Link, keine E-Mail-Adresse, keine Telefonnummer und keinen Begriff der Sperrliste enthalten und nicht länger als <see cref="MaxText"/>
/// Zeichen sein. Geprüft wird beim Schreiben (<see cref="Catalog.Eingabefilter"/>), nur Einträge der Arten Datenpflege, Struktur und Ausleitung;
/// Modell, Einrichtung und Betrieb schreibt in der Demo kein Besucher.
/// <para>Die Sperrliste liegt nicht im Repo, sondern beim Betrieb der Demo (<c>JOURNALI_DEMO_SPERRLISTE</c>, eine Zeile je Begriff, # für
/// Kommentare). Verglichen wird nach Vereinfachung (<see cref="Normal"/>): klein, ohne Akzente, Ziffern und Zeichen wie Buchstaben gelesen
/// (0 → o, 1 → i, 3 → e, 4 → a, 5 → s, 7 → t, @ → a, $ → s), ohne alles zwischen den Buchstaben — „N.a-z 1“ wird zu „nazi“.</para>
/// </summary>
public sealed class Eingabefilter
{
    public const int MaxText = 2000;

    private static readonly Regex Link = new(@"https?://|www\.|\.onion\b|\b[\w-]+\.(de|com|net|org|info|io|ru|cn|xyz|top|biz|me|to|cc|tk|shop|online|site|link)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(200));
    private static readonly Regex Mail = new(@"[\w.+-]+@[\w-]+\.[\w.-]+", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(200));
    // mit + oder mit Trennzeichen zwischen den Gruppen — eine GTIN (nur Ziffern) ist keine Telefonnummer
    private static readonly Regex Telefon = new(@"\+\d[\d\s/().-]{6,}\d|\b0\d{2,5}[\s/-]+\d{3,}([\s/-]+\d+)*", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(200));

    private readonly string[] _begriffe;
    public int Begriffe => _begriffe.Length;

    public Eingabefilter(IEnumerable<string> begriffe) =>
        _begriffe = begriffe.Select(Normal).Where(b => b.Length >= 3).Distinct().ToArray();

    /// <summary>Die Sperrliste aus einer Datei: eine Zeile je Begriff, leere Zeilen und Zeilen mit # zählen nicht. Ohne Datei: nur Links, Kontaktdaten, Länge.</summary>
    public static Eingabefilter AusDatei(string? pfad) =>
        new(pfad is { Length: > 0 } && File.Exists(pfad)
            ? File.ReadAllLines(pfad).Select(l => l.Trim()).Where(l => l.Length > 0 && !l.StartsWith('#'))
            : []);

    /// <summary>Ist dieser Eintrag unzulässig? Geprüft werden alle Texte in den Nutzdaten der Arten Datenpflege, Struktur und Ausleitung.</summary>
    public bool Unzulaessig(string type, string payload)
    {
        if (Kinds.Of(type) is not (Kinds.Data or Kinds.Structure or Kinds.Publish)) return false;
        using var doc = JsonDocument.Parse(payload);
        return Texte(doc.RootElement).Any(Unzulaessig);
    }

    public bool Unzulaessig(string text)
    {
        if (text.Length > MaxText) return true;
        if (Link.IsMatch(text) || Mail.IsMatch(text) || Telefon.IsMatch(text)) return true;
        if (_begriffe.Length == 0) return false;
        var n = Normal(text);
        return _begriffe.Any(n.Contains);
    }

    /// <summary>Klein, ohne Akzente, Ziffern und Zeichen wie Buchstaben, nur Buchstaben — so wird verglichen.</summary>
    public static string Normal(string s)
    {
        var sb = new StringBuilder(s.Length);
        foreach (var ch in s.Normalize(NormalizationForm.FormKD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
            var c = char.ToLowerInvariant(ch) switch { '0' => 'o', '1' => 'i', '3' => 'e', '4' => 'a', '5' => 's', '7' => 't', '@' => 'a', '$' => 's', 'ß' => 's', var x => x };
            if (char.IsLetter(c)) sb.Append(c);
        }
        return sb.ToString();
    }

    private static IEnumerable<string> Texte(JsonElement e)
    {
        switch (e.ValueKind)
        {
            case JsonValueKind.String: yield return e.GetString() ?? ""; break;
            case JsonValueKind.Array: foreach (var x in e.EnumerateArray()) foreach (var t in Texte(x)) yield return t; break;
            case JsonValueKind.Object: foreach (var p in e.EnumerateObject()) foreach (var t in Texte(p.Value)) yield return t; break;
        }
    }
}
