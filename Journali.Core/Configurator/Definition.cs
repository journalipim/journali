using System.Text.Json;

namespace Journali.Core.Configurator;

// Der Konfigurator: Regeln, die zu einer Auswahl von Produkten sagen, was geht. Die Regeln pflegt ein Anwender, geprüft wird auf dem Server
// (ein Shop schickt die Auswahl und bekommt zurück, was zulässig ist und was fehlt) — die Logik steht nur hier, nirgends sonst.
//
// Zwei Sorten von Regeln, die zusammen die Bedingungen einer Konfiguration beschreiben:
//  · Bilanz: Teile stellen Ressourcen bereit (ein Mainboard 3 Steckplätze) oder verbrauchen sie (eine Karte einen, und stellt drei neue bereit).
//    Jede Ressource, die in der Auswahl vorkommt, muss in der Summe ≥ 0 sein. Dazu braucht es keine Regel je Ressource.
//  · „wenn A, dann B“: Wenn eine Bedingung über die Auswahl zutrifft (has, count, sum, balance — verknüpfbar), folgt: forbids, limits auf
//    höchstens n, oder requires mindestens n. Verbot und Grenze machen die Auswahl unzulässig; was verlangt ist und fehlt, macht sie unvollständig.
//  · Gruppen (Groups.cs, docs/pflegestruktur.md 40): die Teile gehören mit Zeilen zu Konfiguratorgruppen; jede Gruppe hat eine Summe (Bilanz), kann
//    gleiche Werte verlangen, und Teile oder der Konfigurator geben ihr Mindest- und Höchstmenge und erlaubte Werte vor. „Ressource“ in einer
//    Bedingung `balance` ist der Schlüssel einer Gruppe (der alte Name bleibt, er steht im Journal).
//
// Eine Regel ohne Bedingung gilt immer („höchstens ein Mainboard“). Die Definition ist ein JSON-Dokument mit englischen Namen, geschrieben
// von der Ansicht des Plugins, gelesen und geprüft hier. Die Namen stehen im Journal und gelten damit für immer.

/// <summary>Welche Teile gemeint sind: ein Knoten (Produkt, Gruppe, Variante — sein ganzer Teilbaum), ein Attributfilter, oder beides. Leer = jedes Teil.</summary>
public sealed record Selector(string? Node = null, string? Attribute = null, string? Comparison = null, string? Value = null);

/// <summary>
/// Eine Bedingung über die Auswahl. <c>Kind</c>:
/// <c>has</c> (Selector; <c>Value</c> = Mindestmenge, sonst 1) · <c>count</c> (Selector, Comparison, Value) ·
/// <c>sum</c> (Selector, Attribute, Comparison, Value: Menge × Zahlenwert des Attributs) · <c>balance</c> (Resource, Comparison, Value: bereit − verbraucht) ·
/// <c>and</c> / <c>or</c> (Parts) · <c>not</c> (ein Teil).
/// </summary>
public sealed record Condition(string Kind, Selector? Selector = null, string? Attribute = null, string? Resource = null, string? Comparison = null,
    decimal? Value = null, List<Condition>? Parts = null);

/// <summary><c>Kind</c>: <c>forbids</c> (kein passendes Teil) · <c>limits</c> (höchstens <c>Max</c>) · <c>requires</c> (mindestens <c>Min</c>, sonst 1).</summary>
public sealed record Effect(string Kind, Selector? Selector = null, int? Min = null, int? Max = null);

/// <summary>Eine Regel: Kennung (je Konfigurator einmal), der Satz, den ein Verstoss meldet, die Bedingung (leer = immer) und die Folge.</summary>
public sealed record Rule(string Id, string? Text = null, Condition? If = null, Effect? Then = null);

/// <summary>
/// Ein Konfigurator. <c>Root</c> ist der Teilbaum, aus dem gewählt werden darf (leer = alles); <c>Resources</c> das Zeilenattribut am Produkt,
/// dessen Zeilen die Spalten <c>resource</c> (Schlüssel einer Gruppe) und <c>amount</c> (Zahl, positiv = stellt bereit, negativ = verbraucht) haben —
/// der Weg vor den Zeilen an den Teilen, er gilt weiter. <c>Limits</c>: Grenzen für Gruppen, die dieser Konfigurator selbst setzt.
/// </summary>
public sealed record Definition(string? Label = null, string? Root = null, string? Resources = null, List<Rule>? Rules = null, List<GroupLimit>? Limits = null)
{
    public const string DefaultResources = "resources";
    public const int MaxDepth = 12;
    public static readonly string[] Comparisons = ["=", "!=", ">", ">=", "<", "<="];
    public static readonly string[] ConditionKinds = ["has", "count", "sum", "balance", "and", "or", "not"];
    public static readonly string[] EffectKinds = ["forbids", "limits", "requires"];

    public string ResourcesAttribute => string.IsNullOrWhiteSpace(Resources) ? DefaultResources : Resources!;
    public IReadOnlyList<Rule> All => Rules ?? [];
    public IReadOnlyList<GroupLimit> AllLimits => Limits ?? [];

    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = false, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };

    /// <summary>Aus einem JSON-Dokument lesen. Ein Dokument, das sich nicht lesen lässt, ist ein Fehler mit Meldung — keine leere Definition.</summary>
    public static (Definition? Definition, string? Error) Read(string json)
    {
        try { return (JsonSerializer.Deserialize<Definition>(json, Json) ?? new Definition(), null); }
        catch (JsonException e) { return (null, e.Message); }
    }

    public string Write() => JsonSerializer.Serialize(this, Json);

    /// <summary>Was an der Definition nicht stimmt — leer, wenn sie geprüft werden kann. Jede Meldung nennt die Regel.</summary>
    public List<string> Errors()
    {
        var f = new List<string>();
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var r in All)
        {
            var wo = string.IsNullOrWhiteSpace(r.Id) ? "Regel ohne Kennung" : $"Regel {r.Id}";
            if (string.IsNullOrWhiteSpace(r.Id)) f.Add($"{wo}: Kennung fehlt.");
            else if (!ids.Add(r.Id)) f.Add($"{wo}: Kennung kommt mehrfach vor.");
            if (r.Then is null) { f.Add($"{wo}: Folge fehlt."); continue; }
            EffectErrors(wo, r.Then, f);
            if (r.If is not null) ConditionErrors(wo, r.If, 1, f);
        }
        var i = 0;
        foreach (var l in AllLimits)
        {
            i++;
            var wol = string.IsNullOrWhiteSpace(l.Group) ? $"Grenze {i}" : $"Grenze {l.Group}";
            if (string.IsNullOrWhiteSpace(l.Group)) f.Add($"{wol}: Gruppe fehlt.");
            else if (!Groups.KeyPattern.IsMatch(l.Group)) f.Add($"{wol}: Gruppe „{l.Group}“ gilt nicht.");
            if (l.Min is null && l.Max is null && l.Values is not { Count: > 0 }) f.Add($"{wol}: weder Mindest- noch Höchstmenge noch erlaubte Werte.");
            Groups.LimitErrors(wol, l.Min, l.Max, f);
        }
        return f;
    }

    static void EffectErrors(string wo, Effect d, List<string> f)
    {
        if (!EffectKinds.Contains(d.Kind)) { f.Add($"{wo}: Folge „{d.Kind}“ gibt es nicht ({string.Join(", ", EffectKinds)})."); return; }
        if (d.Selector is null) f.Add($"{wo}: Folge ohne Selektor.");
        else SelectorErrors(wo, d.Selector, f);
        if (d.Kind == "limits" && (d.Max is null or < 0)) f.Add($"{wo}: „limits“ braucht eine Höchstmenge ab 0.");
        if (d.Kind == "requires" && d.Min is < 1) f.Add($"{wo}: „requires“ braucht eine Mindestmenge ab 1.");
    }

    public static void SelectorErrors(string wo, Selector s, List<string> f)
    {
        if (s.Attribute is null && (s.Comparison is not null || s.Value is not null)) f.Add($"{wo}: Selektor hat Vergleich oder Wert, aber kein Attribut.");
        if (s.Attribute is not null && (s.Comparison is null || s.Value is null)) f.Add($"{wo}: Selektor mit Attribut {s.Attribute} braucht Vergleich und Wert.");
        if (s.Comparison is not null && !Comparisons.Contains(s.Comparison)) f.Add($"{wo}: Vergleich „{s.Comparison}“ gibt es nicht ({string.Join(", ", Comparisons)}).");
    }

    public static void ConditionErrors(string wo, Condition b, int depth, List<string> f)
    {
        if (depth > MaxDepth) { f.Add($"{wo}: Bedingung ist zu tief verschachtelt (höchstens {MaxDepth} Ebenen)."); return; }
        if (!ConditionKinds.Contains(b.Kind)) { f.Add($"{wo}: Bedingung „{b.Kind}“ gibt es nicht ({string.Join(", ", ConditionKinds)})."); return; }
        if (b.Comparison is not null && !Comparisons.Contains(b.Comparison)) f.Add($"{wo}: Vergleich „{b.Comparison}“ gibt es nicht ({string.Join(", ", Comparisons)}).");
        switch (b.Kind)
        {
            case "has":
                if (b.Selector is null) f.Add($"{wo}: „has“ braucht einen Selektor."); else SelectorErrors(wo, b.Selector, f);
                break;
            case "count":
                if (b.Selector is null) f.Add($"{wo}: „count“ braucht einen Selektor."); else SelectorErrors(wo, b.Selector, f);
                if (b.Comparison is null || b.Value is null) f.Add($"{wo}: „count“ braucht Vergleich und Wert.");
                break;
            case "sum":
                if (b.Selector is null) f.Add($"{wo}: „sum“ braucht einen Selektor."); else SelectorErrors(wo, b.Selector, f);
                if (string.IsNullOrWhiteSpace(b.Attribute)) f.Add($"{wo}: „sum“ braucht ein Attribut.");
                if (b.Comparison is null || b.Value is null) f.Add($"{wo}: „sum“ braucht Vergleich und Wert.");
                break;
            case "balance":
                if (string.IsNullOrWhiteSpace(b.Resource)) f.Add($"{wo}: „balance“ braucht eine Ressource.");
                if (b.Comparison is null || b.Value is null) f.Add($"{wo}: „balance“ braucht Vergleich und Wert.");
                break;
            case "and" or "or":
                if (b.Parts is not { Count: > 0 }) f.Add($"{wo}: „{b.Kind}“ braucht Teilbedingungen.");
                else foreach (var t in b.Parts) ConditionErrors(wo, t, depth + 1, f);
                break;
            case "not":
                if (b.Parts is not { Count: 1 }) f.Add($"{wo}: „not“ braucht genau eine Teilbedingung.");
                else ConditionErrors(wo, b.Parts[0], depth + 1, f);
                break;
        }
    }
}
