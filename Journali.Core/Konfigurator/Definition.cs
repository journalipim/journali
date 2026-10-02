using System.Text.Json;

namespace Journali.Core.Konfigurator;

// Der Konfigurator: Regeln, die zu einer Auswahl von Produkten sagen, was geht. Die Regeln pflegt ein Anwender, geprüft wird auf dem Server
// (ein Shop schickt die Auswahl und bekommt zurück, was zulässig ist und was fehlt) — die Logik steht nur hier, nirgends sonst.
//
// Zwei Sorten von Regeln, die zusammen die Bedingungen einer Konfiguration beschreiben:
//  · Bilanz: Teile stellen Ressourcen bereit (ein Mainboard 3 Steckplätze) oder verbrauchen sie (eine Karte einen, und stellt drei neue bereit).
//    Jede Ressource, die in der Auswahl vorkommt, muss in der Summe ≥ 0 sein. Dazu braucht es keine Regel je Ressource.
//  · „wenn A, dann B“: Wenn eine Bedingung über die Auswahl zutrifft (hat, anzahl, summe, bilanz — verknüpfbar), folgt: verbietet, begrenzt auf
//    höchstens n, oder verlangt mindestens n. Verbot und Grenze machen die Auswahl unzulässig; was verlangt ist und fehlt, macht sie unvollständig.
//
// Eine Regel ohne Bedingung gilt immer („höchstens ein Mainboard“). Die Definition ist ein JSON-Dokument; geschrieben wird es von der Ansicht
// des Plugins, gelesen und geprüft hier.

/// <summary>Welche Teile gemeint sind: ein Knoten (Produkt, Gruppe, Variante — sein ganzer Teilbaum), ein Attributfilter, oder beides. Leer = jedes Teil.</summary>
public sealed record Selektor(string? Knoten = null, string? Attribut = null, string? Vergleich = null, string? Wert = null);

/// <summary>
/// Eine Bedingung über die Auswahl. <c>Art</c>:
/// <c>hat</c> (Selektor; <c>Wert</c> = Mindestmenge, sonst 1) · <c>anzahl</c> (Selektor, Vergleich, Wert) ·
/// <c>summe</c> (Selektor, Attribut, Vergleich, Wert: Menge × Zahlenwert des Attributs) · <c>bilanz</c> (Ressource, Vergleich, Wert: bereit − verbraucht) ·
/// <c>und</c> / <c>oder</c> (Teile) · <c>nicht</c> (ein Teil).
/// </summary>
public sealed record Bedingung(string Art, Selektor? Selektor = null, string? Attribut = null, string? Ressource = null, string? Vergleich = null,
    decimal? Wert = null, List<Bedingung>? Teile = null);

/// <summary><c>Art</c>: <c>verbietet</c> (kein passendes Teil) · <c>begrenzt</c> (höchstens <c>Hoechstens</c>) · <c>verlangt</c> (mindestens <c>Mindestens</c>, sonst 1).</summary>
public sealed record Folge(string Art, Selektor? Selektor = null, int? Mindestens = null, int? Hoechstens = null);

/// <summary>Eine Regel: Kennung (je Konfigurator einmal), der Satz, den ein Verstoss meldet, die Bedingung (leer = immer) und die Folge.</summary>
public sealed record Regel(string Id, string? Text = null, Bedingung? Wenn = null, Folge? Dann = null);

/// <summary>
/// Ein Konfigurator. <c>Wurzel</c> ist der Teilbaum, aus dem gewählt werden darf (leer = alles); <c>Ressourcen</c> das Zeilenattribut am Produkt,
/// dessen Zeilen die Spalten <c>ressource</c> (Schlüssel) und <c>menge</c> (Zahl, positiv = stellt bereit, negativ = verbraucht) haben.
/// </summary>
public sealed record Definition(string? Bezeichnung = null, string? Wurzel = null, string? Ressourcen = null, List<Regel>? Regeln = null)
{
    public const string RessourcenVorgabe = "ressourcen";
    public const int MaxTiefe = 12;
    public static readonly string[] Vergleiche = ["=", "!=", ">", ">=", "<", "<="];
    public static readonly string[] BedingungArten = ["hat", "anzahl", "summe", "bilanz", "und", "oder", "nicht"];
    public static readonly string[] FolgeArten = ["verbietet", "begrenzt", "verlangt"];

    public string RessourcenAttribut => string.IsNullOrWhiteSpace(Ressourcen) ? RessourcenVorgabe : Ressourcen!;
    public IReadOnlyList<Regel> Alle => Regeln ?? [];

    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = false, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };

    /// <summary>Aus einem JSON-Dokument lesen. Ein Dokument, das sich nicht lesen lässt, ist ein Fehler mit Meldung — keine leere Definition.</summary>
    public static (Definition? Definition, string? Fehler) Lesen(string json)
    {
        try { return (JsonSerializer.Deserialize<Definition>(json, Json) ?? new Definition(), null); }
        catch (JsonException e) { return (null, e.Message); }
    }

    public string Schreiben() => JsonSerializer.Serialize(this, Json);

    /// <summary>Was an der Definition nicht stimmt — leer, wenn sie geprüft werden kann. Jede Meldung nennt die Regel.</summary>
    public List<string> Fehler()
    {
        var f = new List<string>();
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var r in Alle)
        {
            var wo = string.IsNullOrWhiteSpace(r.Id) ? "Regel ohne Kennung" : $"Regel {r.Id}";
            if (string.IsNullOrWhiteSpace(r.Id)) f.Add($"{wo}: Kennung fehlt.");
            else if (!ids.Add(r.Id)) f.Add($"{wo}: Kennung kommt mehrfach vor.");
            if (r.Dann is null) { f.Add($"{wo}: Folge fehlt."); continue; }
            FolgeFehler(wo, r.Dann, f);
            if (r.Wenn is not null) BedingungFehler(wo, r.Wenn, 1, f);
        }
        return f;
    }

    static void FolgeFehler(string wo, Folge d, List<string> f)
    {
        if (!FolgeArten.Contains(d.Art)) { f.Add($"{wo}: Folge „{d.Art}“ gibt es nicht (verbietet, begrenzt, verlangt)."); return; }
        if (d.Selektor is null) f.Add($"{wo}: Folge ohne Selektor.");
        else SelektorFehler(wo, d.Selektor, f);
        if (d.Art == "begrenzt" && (d.Hoechstens is null or < 0)) f.Add($"{wo}: „begrenzt“ braucht eine Höchstmenge ab 0.");
        if (d.Art == "verlangt" && d.Mindestens is < 1) f.Add($"{wo}: „verlangt“ braucht eine Mindestmenge ab 1.");
    }

    static void SelektorFehler(string wo, Selektor s, List<string> f)
    {
        if (s.Attribut is null && (s.Vergleich is not null || s.Wert is not null)) f.Add($"{wo}: Selektor hat Vergleich oder Wert, aber kein Attribut.");
        if (s.Attribut is not null && (s.Vergleich is null || s.Wert is null)) f.Add($"{wo}: Selektor mit Attribut {s.Attribut} braucht Vergleich und Wert.");
        if (s.Vergleich is not null && !Vergleiche.Contains(s.Vergleich)) f.Add($"{wo}: Vergleich „{s.Vergleich}“ gibt es nicht ({string.Join(", ", Vergleiche)}).");
    }

    static void BedingungFehler(string wo, Bedingung b, int tiefe, List<string> f)
    {
        if (tiefe > MaxTiefe) { f.Add($"{wo}: Bedingung ist zu tief verschachtelt (höchstens {MaxTiefe} Ebenen)."); return; }
        if (!BedingungArten.Contains(b.Art)) { f.Add($"{wo}: Bedingung „{b.Art}“ gibt es nicht ({string.Join(", ", BedingungArten)})."); return; }
        if (b.Vergleich is not null && !Vergleiche.Contains(b.Vergleich)) f.Add($"{wo}: Vergleich „{b.Vergleich}“ gibt es nicht ({string.Join(", ", Vergleiche)}).");
        switch (b.Art)
        {
            case "hat":
                if (b.Selektor is null) f.Add($"{wo}: „hat“ braucht einen Selektor."); else SelektorFehler(wo, b.Selektor, f);
                break;
            case "anzahl":
                if (b.Selektor is null) f.Add($"{wo}: „anzahl“ braucht einen Selektor."); else SelektorFehler(wo, b.Selektor, f);
                if (b.Vergleich is null || b.Wert is null) f.Add($"{wo}: „anzahl“ braucht Vergleich und Wert.");
                break;
            case "summe":
                if (b.Selektor is null) f.Add($"{wo}: „summe“ braucht einen Selektor."); else SelektorFehler(wo, b.Selektor, f);
                if (string.IsNullOrWhiteSpace(b.Attribut)) f.Add($"{wo}: „summe“ braucht ein Attribut.");
                if (b.Vergleich is null || b.Wert is null) f.Add($"{wo}: „summe“ braucht Vergleich und Wert.");
                break;
            case "bilanz":
                if (string.IsNullOrWhiteSpace(b.Ressource)) f.Add($"{wo}: „bilanz“ braucht eine Ressource.");
                if (b.Vergleich is null || b.Wert is null) f.Add($"{wo}: „bilanz“ braucht Vergleich und Wert.");
                break;
            case "und" or "oder":
                if (b.Teile is not { Count: > 0 }) f.Add($"{wo}: „{b.Art}“ braucht Teilbedingungen.");
                else foreach (var t in b.Teile) BedingungFehler(wo, t, tiefe + 1, f);
                break;
            case "nicht":
                if (b.Teile is not { Count: 1 }) f.Add($"{wo}: „nicht“ braucht genau eine Teilbedingung.");
                else BedingungFehler(wo, b.Teile[0], tiefe + 1, f);
                break;
        }
    }
}
