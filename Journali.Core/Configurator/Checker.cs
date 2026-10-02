using System.Globalization;

namespace Journali.Core.Configurator;

/// <summary>
/// Ein wählbares Teil, wie die Prüfung es sieht — unabhängig davon, woher es kommt (<see cref="Parts"/> baut es aus dem Baum).
/// <c>Path</c>: die Knoten, zu denen es gehört (es selbst, sein Produkt, die Gruppen darüber) — damit passt ein Selektor auf einen Teilbaum.
/// <c>Value</c>: der wirksame Wert eines Attributs oder null. <c>Rows</c>: seine Zeilen in Konfiguratorgruppen (Groups.cs).
/// <c>Resources</c>: der ältere Weg, je Gruppe eine Menge (positiv = stellt bereit, negativ = verbraucht); eine Gruppe, die <c>Rows</c> nennen, geht vor.
/// </summary>
public sealed record Part(string Id, IReadOnlySet<string> Path, Func<string, string?> Value, IReadOnlyDictionary<string, decimal> Resources, IReadOnlyList<GroupRow>? Rows = null);

/// <summary>Ein Teil der Auswahl mit seiner Menge.</summary>
public sealed record Line(Part Part, int Amount = 1);

/// <summary>
/// <c>Kind</c>: <c>rule</c> (Verbot oder Grenze einer Regel), <c>balance</c> (die Summe einer Gruppe ist im Minus), <c>equal</c> (die Werte einer Gruppe sind
/// nicht gleich), <c>max</c> (zu viele Teile in einer Gruppe), <c>value</c> (ein Wert, den die Gruppe nicht erlaubt), <c>min</c> (zu wenige Teile; steht unter
/// „fehlt“). <c>Affects</c>: die Teile der Auswahl, um die es geht. <c>Group</c>: der Schlüssel der Gruppe.
/// </summary>
public sealed record Violation(string Kind, string Text, IReadOnlyList<string> Affects, string? Rule = null, string? Group = null);

/// <summary>Was die Summe einer Gruppe in der Auswahl macht: bereit, verbraucht (als positive Zahl), frei = bereit − verbraucht.</summary>
public sealed record BalanceLine(decimal Provided, decimal Consumed, decimal Free);

/// <summary>Eine Gruppe in der Auswahl: Zahl der Mitglieder (nach Menge), die Vorgabe (Mindest-, Höchstmenge, erlaubte Werte; null = keine) und die vorkommenden Werte.</summary>
public sealed record GroupLine(int Count, int? Min, int? Max, IReadOnlyList<string>? Allowed, IReadOnlyList<string> Values);

/// <summary>Ginge dieses Teil zusätzlich in die Auswahl? Bei Nein: die Verstösse, die es neu verursachen würde. <c>Lifts</c>: Gruppen im Minus, deren Summe es anhebt.</summary>
public sealed record Candidate(string Id, bool Ok, IReadOnlyList<Violation> Reasons, IReadOnlyList<string>? Lifts = null);

/// <summary>
/// Das Ergebnis. <c>Valid</c>: kein Verbot, keine Grenze, keine Gruppe im Minus oder mit falschen Werten oder zu vielen Teilen. <c>Complete</c>: nichts verlangt,
/// das fehlt (auch die Mindestmenge einer Gruppe). Eine unvollständige Auswahl kann zulässig sein (es fehlt nur noch etwas), eine unzulässige nicht ohne Änderung.
/// </summary>
public sealed record Evaluation(bool Valid, bool Complete, IReadOnlyList<Violation> Violations, IReadOnlyList<Violation> Missing,
    IReadOnlyDictionary<string, BalanceLine> Balance, IReadOnlyList<Candidate>? Selectable = null, IReadOnlyDictionary<string, GroupLine>? Groups = null);

public static class Checker
{
    /// <summary>
    /// Die Auswahl gegen die Regeln prüfen. Mit <paramref name="candidates"/> sagt das Ergebnis zusätzlich zu jedem, ob es noch dazugehen könnte:
    /// es geht nicht, wenn die Auswahl damit einen Verstoss bekäme, den sie vorher nicht hatte. Was verlangt ist und fehlt, sperrt kein Teil —
    /// und ebenso keine Summe im Minus: ein weiteres Teil kann sie beheben, das Ergebnis nennt (<c>Lifts</c>), welches Teil welche Gruppe anhebt.
    /// </summary>
    public static Evaluation Check(Definition def, IEnumerable<Line> selection, IEnumerable<Part>? candidates = null, IReadOnlyDictionary<string, GroupInfo>? groups = null)
    {
        var lines = Merge(selection);
        var evaluation = One(def, lines, groups);
        if (candidates is null) return evaluation;

        var before = evaluation.Violations.Select(Key).ToHashSet();
        var list = new List<Candidate>();
        foreach (var k in candidates)
        {
            var with = Merge(lines.Append(new Line(k, 1)));
            var after = One(def, with, groups);
            var added = after.Violations.Where(v => v.Kind != "balance" && !before.Contains(Key(v))).ToList();
            var lifts = evaluation.Balance.Where(kv => kv.Value.Free < 0 && after.Balance.TryGetValue(kv.Key, out var n) && n.Free > kv.Value.Free).Select(kv => kv.Key).OrderBy(x => x, StringComparer.Ordinal).ToList();
            list.Add(new Candidate(k.Id, added.Count == 0, added, lifts));
        }
        return evaluation with { Selectable = list };
    }

    static string Key(Violation v) => v.Kind + "|" + (v.Rule ?? v.Group);

    /// <summary>Dasselbe Teil mehrfach gewählt ist ein Teil mit der Summe der Mengen.</summary>
    static List<Line> Merge(IEnumerable<Line> selection) =>
        selection.Where(z => z.Amount > 0).GroupBy(z => z.Part.Id).Select(g => new Line(g.First().Part, g.Sum(z => z.Amount))).ToList();

    /// <summary>Was die Teile einer Gruppe in der Auswahl ergeben, gesammelt über alle Zeilen, die zutreffen.</summary>
    sealed class Acc
    {
        public decimal Provided, Consumed; public bool Numbers;
        public readonly HashSet<string> Members = new(StringComparer.Ordinal); public int Count;
        public readonly HashSet<string> Consumers = new(StringComparer.Ordinal);
        public readonly Dictionary<string, (string Shown, HashSet<string> Parts)> Values = new(StringComparer.Ordinal);
        public int? Min, Max;
        public readonly List<List<string>> Allowed = [];
        public readonly HashSet<string> Setters = new(StringComparer.Ordinal);
    }

    static Evaluation One(Definition def, List<Line> lines, IReadOnlyDictionary<string, GroupInfo>? groups)
    {
        var violations = new List<Violation>();
        var missing = new List<Violation>();

        // Die Gruppen: alle Zeilen, die zutreffen, wirken — Zahlen derselben Gruppe addieren sich
        var acc = new SortedDictionary<string, Acc>(StringComparer.Ordinal);
        Acc A(string g) { if (!acc.TryGetValue(g, out var a)) acc[g] = a = new Acc(); return a; }
        foreach (var z in lines)
            foreach (var r in Applied(z.Part, lines))
            {
                if (string.IsNullOrWhiteSpace(r.Group)) continue;
                var a = A(r.Group!);
                if (r.IsLimit) { Limit(a, r.Min, r.Max, r.Values); a.Setters.Add(z.Part.Id); continue; }
                if (a.Members.Add(z.Part.Id)) a.Count += z.Amount;
                if (r.Provides is { } p) { a.Provided += p * z.Amount; a.Numbers = true; }
                if (r.Consumes is { } k) { a.Consumed += k * z.Amount; a.Numbers = true; if (k > 0) a.Consumers.Add(z.Part.Id); }
                if (!string.IsNullOrWhiteSpace(r.Value))
                {
                    var n = Norm(r.Value);
                    if (!a.Values.TryGetValue(n, out var v)) a.Values[n] = v = (r.Value.Trim(), new HashSet<string>(StringComparer.Ordinal));
                    v.Parts.Add(z.Part.Id);
                }
            }
        foreach (var l in def.AllLimits) if (!string.IsNullOrWhiteSpace(l.Group)) Limit(A(l.Group!), l.Min, l.Max, l.Values);

        var balance = new Dictionary<string, BalanceLine>(StringComparer.Ordinal);
        var summary = new Dictionary<string, GroupLine>(StringComparer.Ordinal);
        foreach (var (g, a) in acc)
        {
            var label = Groups.Label(groups, g);
            if (a.Numbers)
            {
                var b = new BalanceLine(a.Provided, a.Consumed, a.Provided - a.Consumed);
                balance[g] = b;
                if (b.Free < 0) violations.Add(new Violation("balance", $"{label}: {Display(b.Consumed)} verbraucht, nur {Display(b.Provided)} bereit.", a.Consumers.OrderBy(x => x, StringComparer.Ordinal).ToList(), Group: g));
            }
            if (groups is not null && groups.TryGetValue(g, out var info) && info.Equal == true && a.Values.Count > 1)
                violations.Add(new Violation("equal", $"{label}: verschiedene Werte ({string.Join(", ", Shown(a))}), erlaubt ist einer.", a.Values.Values.SelectMany(v => v.Parts).Distinct().OrderBy(x => x, StringComparer.Ordinal).ToList(), Group: g));
            if (a.Max is { } max && a.Count > max)
                violations.Add(new Violation("max", $"{label}: {a.Count} Teile, höchstens {max}.", a.Members.OrderBy(x => x, StringComparer.Ordinal).ToList(), Group: g));
            if (a.Min is { } min && a.Count < min)
                missing.Add(new Violation("min", $"{label}: {a.Count} Teile, mindestens {min}.", a.Setters.OrderBy(x => x, StringComparer.Ordinal).ToList(), Group: g));

            List<string>? allowed = null;
            if (a.Allowed.Count > 0)
            {
                var keep = a.Allowed[0].Select(Norm).ToHashSet(StringComparer.Ordinal);
                foreach (var more in a.Allowed.Skip(1)) keep.IntersectWith(more.Select(Norm));
                allowed = a.Allowed[0].Where(w => keep.Contains(Norm(w))).Select(w => w.Trim()).Distinct(StringComparer.Ordinal).ToList();
                var wrong = a.Values.Where(kv => !keep.Contains(kv.Key)).ToList();
                if (wrong.Count > 0)
                    violations.Add(new Violation("value", $"{label}: {(wrong.Count == 1 ? "Wert" : "Werte")} {string.Join(", ", wrong.Select(kv => kv.Value.Shown))} nicht erlaubt, erlaubt {(allowed.Count == 0 ? "ist nichts" : "sind " + string.Join(", ", allowed))}.",
                        wrong.SelectMany(kv => kv.Value.Parts).Distinct().OrderBy(x => x, StringComparer.Ordinal).ToList(), Group: g));
            }
            summary[g] = new GroupLine(a.Count, a.Min, a.Max, allowed, Shown(a));
        }

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
        return new Evaluation(violations.Count == 0, missing.Count == 0, violations, missing, balance, null, summary);
    }

    /// <summary>Die Vorgaben einer Gruppe zusammen: das höchste Minimum, das niedrigste Maximum, jede Liste erlaubter Werte (gilt die Schnittmenge).</summary>
    static void Limit(Acc a, int? min, int? max, List<string>? values)
    {
        if (min is { } lo) a.Min = a.Min is { } m1 ? Math.Max(m1, lo) : lo;
        if (max is { } hi) a.Max = a.Max is { } m2 ? Math.Min(m2, hi) : hi;
        if (values is { Count: > 0 }) a.Allowed.Add(values);
    }

    /// <summary>Die Zeilen eines Teils, die in dieser Auswahl gelten: ohne Bedingung oder mit einer, die zutrifft. Dazu der ältere Weg über <c>Resources</c>.</summary>
    static IEnumerable<GroupRow> Applied(Part part, List<Line> lines)
    {
        var own = new HashSet<string>(StringComparer.Ordinal);
        foreach (var r in part.Rows ?? [])
        {
            if (!string.IsNullOrWhiteSpace(r.Group)) own.Add(r.Group!);
            // Die Bedingung fragt nur nach Teilen der Auswahl — eine Bilanz kennt sie nicht (sonst gäbe es einen Kreis)
            if (r.When is null || Holds(r.When, lines, new Dictionary<string, BalanceLine>(), new HashSet<string>())) yield return r;
        }
        foreach (var (g, m) in part.Resources)
            if (!own.Contains(g)) yield return m >= 0 ? new GroupRow(g, Provides: m) : new GroupRow(g, Consumes: -m);
    }

    static IReadOnlyList<string> Shown(Acc a) => a.Values.Values.Select(v => v.Shown).OrderBy(x => x, StringComparer.Ordinal).ToList();

    /// <summary>Werte vergleichen: Zahlen als Zahlen (8 = 8,0), sonst ohne Beachtung der Gross- und Kleinschreibung.</summary>
    static string Norm(string v)
    {
        var t = v.Trim();
        return Number(t) is { } d ? d.ToString("0.############################", CultureInfo.InvariantCulture) : t.ToLowerInvariant();
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
