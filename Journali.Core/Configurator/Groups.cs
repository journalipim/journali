using System.Text.Json;
using System.Text.RegularExpressions;

namespace Journali.Core.Configurator;

// Konfiguratorgruppen (docs/pflegestruktur.md 40, 02.10.2026). Eine Gruppe gilt für alle Konfiguratoren; die Teile gehören mit Zeilen zu ihr.
//
//  · Gruppe: Schlüssel, Bezeichnung, und ob alle Werte in ihr gleich sein müssen. Plugin-Daten `group:<key>`.
//  · Zeile an einem Teil (Plugin-Daten `member:<knoten>`, eine Liste): nennt ihre Gruppe, optional eine Bedingung (`When`, nur über Teile der Auswahl)
//    und entweder eine Wirkung als **Mitglied** (`Provides`, `Consumes`, `Value`) oder eine **Vorgabe** an die Gruppe (`Min`, `Max`, `Values`; das Teil
//    zählt dort nicht mit). Alle Zeilen, deren Bedingung zutrifft, wirken; Zahlen derselben Gruppe addieren sich.
//  · Eine Variante ohne eigene Zeilen nimmt die ihres Produkts (allgemein: den nächsten Vorfahren, der welche hat).
//  · Eine Grenze am Konfigurator (`Definition.Limits`) ist dieselbe Vorgabe ohne Teil.

/// <summary>Eine Gruppe: Bezeichnung für Meldungen, und <c>Equal</c> = alle Werte der Mitglieder müssen gleich sein.</summary>
public sealed record GroupInfo(string? Label = null, bool? Equal = null);

/// <summary>
/// Eine Zeile an einem Teil. Mitglied: <c>Provides</c> (stellt bereit), <c>Consumes</c> (verbraucht), <c>Value</c> (der Wert in der Gruppe; ein Teil kann in
/// einer Gruppe mehrere haben). Vorgabe: <c>Min</c>, <c>Max</c> (Menge der Mitglieder), <c>Values</c> (erlaubte Werte). Beides in einer Zeile gibt es nicht.
/// </summary>
public sealed record GroupRow(string? Group = null, Condition? When = null, decimal? Provides = null, decimal? Consumes = null, string? Value = null,
    int? Min = null, int? Max = null, List<string>? Values = null)
{
    public bool IsLimit => Min is not null || Max is not null || Values is { Count: > 0 };
    public bool IsMember => Provides is not null || Consumes is not null || !string.IsNullOrWhiteSpace(Value);
}

/// <summary>Das Dokument eines Teils: seine Zeilen.</summary>
public sealed record Membership(List<GroupRow>? Rows = null);

/// <summary>Eine Grenze für eine Gruppe, die der Konfigurator selbst setzt (ohne ein Teil, das sie vorgibt).</summary>
public sealed record GroupLimit(string? Group = null, int? Min = null, int? Max = null, List<string>? Values = null);

public static class Groups
{
    public const string GroupPrefix = "group:";
    public const string MemberPrefix = "member:";
    public static readonly Regex KeyPattern = new("^[a-z][a-z0-9_-]{0,39}$", RegexOptions.Compiled);

    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = false, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };

    public static string Write(Membership m) => JsonSerializer.Serialize(m, Json);
    public static string Write(GroupInfo g) => JsonSerializer.Serialize(g, Json);

    /// <summary>Die Bezeichnung einer Gruppe für Meldungen: ihre eigene, sonst der Schlüssel.</summary>
    public static string Label(IReadOnlyDictionary<string, GroupInfo>? groups, string key) =>
        groups is not null && groups.TryGetValue(key, out var g) && !string.IsNullOrWhiteSpace(g.Label) ? g.Label! : key;

    /// <summary>Die Gruppen aus den Plugin-Daten (Name → JSON). Was sich nicht lesen lässt, kommt als Fehler zurück, nicht als leere Gruppe.</summary>
    public static (Dictionary<string, GroupInfo> Groups, List<string> Errors) ReadGroups(IEnumerable<KeyValuePair<string, string>> data)
    {
        var groups = new Dictionary<string, GroupInfo>(StringComparer.Ordinal); var errors = new List<string>();
        foreach (var (name, json) in data)
        {
            if (!name.StartsWith(GroupPrefix, StringComparison.Ordinal)) continue;
            var key = name[GroupPrefix.Length..];
            if (!KeyPattern.IsMatch(key)) { errors.Add($"Gruppe {key}: Schlüssel gilt nicht (a–z, 0–9, _ und -, beginnt mit einem Buchstaben)."); continue; }
            try { groups[key] = JsonSerializer.Deserialize<GroupInfo>(json, Json) ?? new GroupInfo(); }
            catch (JsonException e) { errors.Add($"Gruppe {key}: {e.Message}"); }
        }
        return (groups, errors);
    }

    /// <summary>
    /// Die Zeilen aller Teile aus den Plugin-Daten (Name → JSON): je Knoten seine Zeilen. Eine Zeile, die nicht stimmt, kommt als Fehler zurück und
    /// wirkt nicht; ein Dokument ohne gültige Zeile gibt es für die Prüfung nicht.
    /// </summary>
    public static (Dictionary<string, List<GroupRow>> Rows, List<string> Errors) ReadRows(IEnumerable<KeyValuePair<string, string>> data)
    {
        var rows = new Dictionary<string, List<GroupRow>>(StringComparer.Ordinal); var errors = new List<string>();
        foreach (var (name, json) in data)
        {
            if (!name.StartsWith(MemberPrefix, StringComparison.Ordinal)) continue;
            var node = name[MemberPrefix.Length..];
            Membership? m;
            try { m = JsonSerializer.Deserialize<Membership>(json, Json); }
            catch (JsonException e) { errors.Add($"Teil {node}: {e.Message}"); continue; }
            var valid = new List<GroupRow>();
            var i = 0;
            foreach (var r in m?.Rows ?? [])
            {
                i++;
                var faults = RowErrors($"Teil {node}, Zeile {i}", r);
                if (faults.Count == 0) valid.Add(r); else errors.AddRange(faults);
            }
            if (valid.Count > 0) rows[node] = valid;
        }
        return (rows, errors);
    }

    /// <summary>Was an einer Zeile nicht stimmt — leer, wenn sie wirken kann.</summary>
    public static List<string> RowErrors(string wo, GroupRow r)
    {
        var f = new List<string>();
        if (string.IsNullOrWhiteSpace(r.Group)) f.Add($"{wo}: Gruppe fehlt.");
        else if (!KeyPattern.IsMatch(r.Group)) f.Add($"{wo}: Gruppe „{r.Group}“ gilt nicht (a–z, 0–9, _ und -, beginnt mit einem Buchstaben).");
        if (r.IsLimit && r.IsMember) f.Add($"{wo}: eine Zeile ist entweder Mitglied (stellt bereit, verbraucht, Wert) oder Vorgabe (Mindest-, Höchstmenge, erlaubte Werte).");
        if (r.Provides is < 0) f.Add($"{wo}: „stellt bereit“ braucht eine Zahl ab 0.");
        if (r.Consumes is < 0) f.Add($"{wo}: „verbraucht“ braucht eine Zahl ab 0.");
        LimitErrors(wo, r.Min, r.Max, f);
        if (r.When is not null)
        {
            Definition.ConditionErrors(wo, r.When, 1, f);
            if (UsesBalance(r.When)) f.Add($"{wo}: die Bedingung darf nicht nach der Bilanz einer Gruppe fragen (nur nach Teilen der Auswahl).");
        }
        return f;
    }

    public static void LimitErrors(string wo, int? min, int? max, List<string> f)
    {
        if (min is < 0) f.Add($"{wo}: Mindestmenge braucht eine Zahl ab 0.");
        if (max is < 0) f.Add($"{wo}: Höchstmenge braucht eine Zahl ab 0.");
        if (min is { } a && max is { } b && a > b) f.Add($"{wo}: Mindestmenge {a} ist grösser als die Höchstmenge {b}.");
    }

    static bool UsesBalance(Condition c) => c.Kind == "balance" || (c.Parts?.Any(UsesBalance) ?? false);
}
