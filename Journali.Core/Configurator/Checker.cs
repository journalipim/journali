using System.Globalization;

namespace Journali.Core.Configurator;

/// <summary>
/// Ein wählbares Teil, wie die Prüfung es sieht — unabhängig davon, woher es kommt (<see cref="Parts"/> baut es aus dem Baum).
/// <c>Path</c>: die Knoten, zu denen es gehört (es selbst, sein Produkt, die Gruppen darüber) — damit passt ein Selektor auf einen Teilbaum.
/// <c>Value</c>: der wirksame Wert eines Attributs oder null. <c>Resources</c>: je Ressource die Menge, positiv = stellt bereit, negativ = verbraucht.
/// </summary>
public sealed record Part(string Id, IReadOnlySet<string> Path, Func<string, string?> Value, IReadOnlyDictionary<string, decimal> Resources);

/// <summary>Ein Teil der Auswahl mit seiner Menge.</summary>
public sealed record Line(Part Part, int Amount = 1);

/// <summary><c>Kind</c>: <c>rule</c> (Verbot oder Grenze) oder <c>balance</c> (eine Ressource ist im Minus). <c>Affects</c>: die Teile der Auswahl, um die es geht.</summary>
public sealed record Violation(string Kind, string Text, IReadOnlyList<string> Affects, string? Rule = null, string? Resource = null);

/// <summary>Was eine Ressource in der Auswahl macht: bereit, verbraucht (als positive Zahl), frei = bereit − verbraucht.</summary>
public sealed record BalanceLine(decimal Provided, decimal Consumed, decimal Free);

/// <summary>Ginge dieses Teil zusätzlich in die Auswahl? Bei Nein: die Verstösse, die es neu verursachen würde.</summary>
public sealed record Candidate(string Id, bool Ok, IReadOnlyList<Violation> Reasons);

/// <summary>
/// Das Ergebnis. <c>Valid</c>: kein Verbot, keine Grenze und keine Ressource im Minus verletzt. <c>Complete</c>: nichts verlangt, das fehlt.
/// Eine unvollständige Auswahl kann zulässig sein (es fehlt nur noch etwas), eine unzulässige nicht ohne Änderung.
/// </summary>
public sealed record Evaluation(bool Valid, bool Complete, IReadOnlyList<Violation> Violations, IReadOnlyList<Violation> Missing,
    IReadOnlyDictionary<string, BalanceLine> Balance, IReadOnlyList<Candidate>? Selectable = null);

public static class Checker
{
    /// <summary>
    /// Die Auswahl gegen die Regeln prüfen. Mit <paramref name="candidates"/> sagt das Ergebnis zusätzlich zu jedem, ob es noch dazugehen könnte:
    /// es geht nicht, wenn die Auswahl damit einen Verstoss bekäme, den sie vorher nicht hatte. Was verlangt ist und fehlt, sperrt kein Teil.
    /// </summary>
    public static Evaluation Check(Definition def, IEnumerable<Line> selection, IEnumerable<Part>? candidates = null)
    {
        var lines = Merge(selection);
        var evaluation = One(def, lines);
        if (candidates is null) return evaluation;

        var before = evaluation.Violations.Select(Key).ToHashSet();
        var list = new List<Candidate>();
        foreach (var k in candidates)
        {
            var with = Merge(lines.Append(new Line(k, 1)));
            var added = One(def, with).Violations.Where(v => !before.Contains(Key(v))).ToList();
            list.Add(new Candidate(k.Id, added.Count == 0, added));
        }
        return evaluation with { Selectable = list };
    }

    static string Key(Violation v) => v.Kind + "|" + (v.Rule ?? v.Resource);

    /// <summary>Dasselbe Teil mehrfach gewählt ist ein Teil mit der Summe der Mengen.</summary>
    static List<Line> Merge(IEnumerable<Line> selection) =>
        selection.Where(z => z.Amount > 0).GroupBy(z => z.Part.Id).Select(g => new Line(g.First().Part, g.Sum(z => z.Amount))).ToList();

    static Evaluation One(Definition def, List<Line> lines)
    {
        var violations = new List<Violation>();
        var missing = new List<Violation>();

        var balance = Balance(lines);
        foreach (var (res, b) in balance.OrderBy(kv => kv.Key, StringComparer.Ordinal))
            if (b.Free < 0)
                violations.Add(new Violation("balance", $"{res}: {Display(b.Consumed)} verbraucht, nur {Display(b.Provided)} bereit.",
                    lines.Where(z => z.Part.Resources.TryGetValue(res, out var m) && m < 0).Select(z => z.Part.Id).Distinct().ToList(), Resource: res));

        foreach (var r in def.All)
        {
            if (r.Then is not { } effect) continue;
            var evidence = new HashSet<string>();
            if (r.If is { } cond && !Holds(cond, lines, balance, evidence)) continue;

            var matching = lines.Where(z => Matches(effect.Selector, z.Part)).ToList();
            var amount = matching.Sum(z => z.Amount);
            var affects = matching.Select(z => z.Part.Id).Concat(evidence).Distinct().ToList();
            var text = string.IsNullOrWhiteSpace(r.Text) ? $"Regel {r.Id}" : r.Text!;
            switch (effect.Kind)
            {
                case "forbids" when amount > 0: violations.Add(new Violation("rule", text, affects, r.Id)); break;
                case "limits" when effect.Max is { } max && amount > max: violations.Add(new Violation("rule", text, affects, r.Id)); break;
                case "requires" when amount < (effect.Min ?? 1): missing.Add(new Violation("rule", text, evidence.ToList(), r.Id)); break;
            }
        }
        return new Evaluation(violations.Count == 0, missing.Count == 0, violations, missing, balance);
    }

    /// <summary>Je Ressource, die in der Auswahl vorkommt: bereit (Summe der positiven Mengen), verbraucht (der negativen, als positive Zahl), frei.</summary>
    static Dictionary<string, BalanceLine> Balance(List<Line> lines)
    {
        var provided = new Dictionary<string, decimal>(); var consumed = new Dictionary<string, decimal>();
        foreach (var z in lines)
            foreach (var (res, m) in z.Part.Resources)
            {
                provided.TryAdd(res, 0); consumed.TryAdd(res, 0);
                if (m > 0) provided[res] += m * z.Amount; else consumed[res] += -m * z.Amount;
            }
        return provided.Keys.ToDictionary(k => k, k => new BalanceLine(provided[k], consumed[k], provided[k] - consumed[k]));
    }

    /// <summary>Trifft die Bedingung zu? <paramref name="evidence"/> sammelt die Teile, die sie wahr machen (für die Meldung).</summary>
    static bool Holds(Condition b, List<Line> lines, Dictionary<string, BalanceLine> balance, HashSet<string> evidence)
    {
        switch (b.Kind)
        {
            case "has":
            {
                var matching = lines.Where(z => Matches(b.Selector, z.Part)).ToList();
                var ok = matching.Sum(z => z.Amount) >= (b.Value is { } w ? w : 1);
                if (ok) foreach (var z in matching) evidence.Add(z.Part.Id);
                return ok;
            }
            case "count":
            {
                var matching = lines.Where(z => Matches(b.Selector, z.Part)).ToList();
                var ok = Compare(matching.Sum(z => z.Amount), b.Comparison, b.Value);
                if (ok) foreach (var z in matching) evidence.Add(z.Part.Id);
                return ok;
            }
            case "sum":
            {
                var matching = lines.Where(z => Matches(b.Selector, z.Part)).ToList();
                decimal sum = 0;
                foreach (var z in matching) if (Number(z.Part.Value(b.Attribute ?? "")) is { } v) sum += v * z.Amount;
                var ok = Compare(sum, b.Comparison, b.Value);
                if (ok) foreach (var z in matching) evidence.Add(z.Part.Id);
                return ok;
            }
            case "balance":
            {
                // Eine Ressource, die in der Auswahl nicht vorkommt, hat die Bilanz 0
                var free = balance.TryGetValue(b.Resource ?? "", out var z) ? z.Free : 0;
                return Compare(free, b.Comparison, b.Value);
            }
            case "not":
                return b.Parts is { Count: 1 } && !Holds(b.Parts[0], lines, balance, new HashSet<string>());
            case "and":
            {
                var collected = new HashSet<string>();
                foreach (var t in b.Parts ?? []) if (!Holds(t, lines, balance, collected)) return false;
                evidence.UnionWith(collected);
                return b.Parts is { Count: > 0 };
            }
            case "or":
                foreach (var t in b.Parts ?? [])
                {
                    var collected = new HashSet<string>();
                    if (Holds(t, lines, balance, collected)) { evidence.UnionWith(collected); return true; }
                }
                return false;
            default:
                return false;
        }
    }

    /// <summary>Passt das Teil auf den Selektor? Node: er steht im Pfad des Teils. Attribute: der Wert des Teils vergleicht sich wie verlangt
    /// (beide Zahlen: als Zahlen, sonst gleich oder ungleich ohne Beachtung der Gross- und Kleinschreibung; andere Vergleiche nur für Zahlen).</summary>
    public static bool Matches(Selector? s, Part t)
    {
        if (s is null) return true;
        if (!string.IsNullOrEmpty(s.Node) && !t.Path.Contains(s.Node)) return false;
        if (string.IsNullOrEmpty(s.Attribute)) return true;
        var actual = t.Value(s.Attribute);
        if (actual is null) return false;
        var wanted = s.Value ?? "";
        if (Number(actual) is { } a && Number(wanted) is { } b) return Compare(a, s.Comparison, b);
        var equal = string.Equals(actual, wanted, StringComparison.OrdinalIgnoreCase);
        return s.Comparison switch { "=" => equal, "!=" => !equal, _ => false };
    }

    static bool Compare(decimal left, string? op, decimal? right) => right is { } r && op switch
    {
        "=" => left == r, "!=" => left != r, ">" => left > r, ">=" => left >= r, "<" => left < r, "<=" => left <= r, _ => false,
    };

    static decimal? Number(string? text) =>
        decimal.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? d : null;

    static string Display(decimal d) => d.ToString("0.##", CultureInfo.InvariantCulture);
}
