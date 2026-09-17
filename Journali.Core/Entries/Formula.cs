using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Journali.Core.Entries;

/// <summary>
/// Kombinierte Attribute (Taloan, 17.09.2026: „Volumen = Länge × Breite × Höhe",
/// „Die Vase ist {round(height / 10)} cm hoch"). Ein Attribut mit <see cref="AttributeDefinition.Formula"/>
/// hat keinen eigenen Wert im Journal; sein Wert wird beim Lesen gerechnet.
///
/// Zwei Formen, eine Sprache:
/// - Zahl-Attribut: die Formel ist ein Ausdruck — <c>length * width * height / 1000</c>.
/// - Text-Attribut: die Formel ist eine Vorlage — Text mit Ausdrücken in geschweiften Klammern:
///   <c>Die Vase ist {round(height / 10)} cm hoch</c>, <c>{name} ({color})</c>,
///   <c>{if(weight &gt; 20, "Speditionsware", "Paket")}</c>.
///
/// Die Vorlage ist Excel (Taloan, 17.09.2026: „nicht alles neu lernen — komplett an Excel orientieren"):
/// - Bezug auf ein Attribut wie auf eine Tabellenspalte: <c>[@hoehe]</c> (auch <c>@hoehe</c> oder nur <c>hoehe</c>);
///   Wert des Knotens, geerbt zählt, bei Text in der Sprache der Spalte.
/// - Operatoren wie in Excel: <c>+ - * / ^</c>, <c>&amp;</c> verkettet Text, Vergleiche <c>= &lt;&gt; &lt; &lt;= &gt; &gt;=</c>,
///   Text in "…", WAHR/FALSCH.
/// - Funktionen mit ihren Excel-Namen, deutsch oder englisch, Argumente mit <c>;</c> (oder <c>,</c>):
///   WENN/IF, UND/AND, ODER/OR, NICHT/NOT, RUNDEN/ROUND, KÜRZEN/TRUNC, GANZZAHL/INT, OBERGRENZE/CEILING,
///   MIN, MAX, ABS, LÄNGE/LEN, GROSS/UPPER, KLEIN/LOWER, GLÄTTEN/TRIM, LINKS/LEFT, RECHTS/RIGHT,
///   VERKETTEN/CONCAT, ISTLEER/ISBLANK, WENNFEHLER/IFERROR, TEXT(x; "0,00") — Zahl als Text in der
///   Sprache der Spalte (de: Komma).
/// Fehlt ein Wert, den ein Rechenschritt braucht, fehlt das Ergebnis — WENNFEHLER, ISTLEER und
/// WENN fangen es ab. Einheiten rechnet die Formel nicht um; wer cm³ in Litern will, teilt durch 1000.
/// </summary>
public static class Formula
{
    /// <summary>Ein Wert im Ausdruck: Zahl, Text oder nichts.</summary>
    public readonly record struct Value(decimal? Number, string? Text)
    {
        public static readonly Value None = new(null, null);
        public static Value Of(decimal d) => new(d, null);
        public static Value Of(string? s) => s is null ? None : new(null, s);
        public bool IsNone => Number is null && Text is null;
        public bool Truthy => Number is { } n ? n != 0 : !string.IsNullOrEmpty(Text);
        public decimal? AsNumber => Number ?? (Text is not null && decimal.TryParse(Text, NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? d : null);
        public string? AsText => Text ?? (Number is { } n ? Format(n) : null);
        public static string Format(decimal n) => n.ToString("0.############", CultureInfo.InvariantCulture);
    }

    private static readonly Regex Hole = new(@"\{([^{}]+)\}", RegexOptions.Compiled);

    /// <summary>Prüft Formel (Zahl) oder Vorlage (Text); liefert die Schlüssel, die sie braucht — oder eine Fehlermeldung.</summary>
    /// <summary>Kultur zur Sprache der Spalte — für format(): de → Komma, en → Punkt, sonst neutral.</summary>
    public static CultureInfo CultureOf(string? locale)
    {
        try { return locale is { Length: > 0 } ? CultureInfo.GetCultureInfo(locale) : CultureInfo.InvariantCulture; }
        catch (CultureNotFoundException) { return CultureInfo.InvariantCulture; }
    }

    public static (string[] Keys, string? Error) Check(string formula, bool template)
    {
        var keys = new List<string>();
        try
        {
            if (template)
            {
                var holes = Hole.Matches(formula);
                if (formula.Count(c => c == '{') != holes.Count || formula.Count(c => c == '}') != holes.Count) throw new FormatException("Geschweifte Klammern gehen nicht auf.");
                foreach (Match m in holes) { var p = new Parser(m.Groups[1].Value); p.Expr(); p.End(); keys.AddRange(p.Keys); }
            }
            else { var p = new Parser(formula); p.Expr(); p.End(); keys.AddRange(p.Keys); }
            return (keys.Distinct().ToArray(), null);
        }
        catch (FormatException e) { return ([], e.Message); }
    }

    /// <summary>Zahl-Formel rechnen; null, wenn ein Wert fehlt oder der Ausdruck nicht aufgeht.</summary>
    public static decimal? Eval(string formula, Func<string, Value> value, string? locale = null)
    {
        try { var p = new Parser(formula, value, CultureOf(locale)); var r = p.Expr(); p.End(); return r.AsNumber; }
        catch (Exception e) when (e is FormatException or MissingValue or DivideByZeroException or OverflowException) { return null; }
    }

    /// <summary>Text-Vorlage füllen; null, wenn ein Loch nicht aufgeht.</summary>
    public static string? Render(string template, Func<string, Value> value, string? locale = null)
    {
        var culture = CultureOf(locale);
        var sb = new StringBuilder();
        var last = 0;
        foreach (Match m in Hole.Matches(template))
        {
            sb.Append(template, last, m.Index - last);
            try { var p = new Parser(m.Groups[1].Value, value, culture); var r = p.Expr(); p.End(); sb.Append(r.AsText ?? throw new MissingValue()); }
            catch (Exception e) when (e is FormatException or MissingValue or DivideByZeroException or OverflowException) { return null; }
            last = m.Index + m.Length;
        }
        sb.Append(template, last, template.Length - last);
        return sb.ToString();
    }

    private sealed class MissingValue : Exception { }

    private static readonly HashSet<string> Forgiving = ["iferror", "if", "empty", "coalesce"];

    /// <summary>Rekursiver Abstieg: or → and → not → Vergleich → &amp; → + - → * / → unär → Primär.</summary>
    private sealed class Parser(string text, Func<string, Value>? value = null, CultureInfo? culture = null)
    {
        private int _i;
        public readonly List<string> Keys = new();
        private bool Checking => value is null;

        public void End() { Skip(); if (_i < text.Length) throw new FormatException($"Unerwartet: „{text[_i..]}“"); }
        private void Skip() { while (_i < text.Length && char.IsWhiteSpace(text[_i])) _i++; }
        private bool Take(string s) { Skip(); if (string.CompareOrdinal(text, _i, s, 0, s.Length) == 0) { _i += s.Length; return true; } return false; }
        private bool TakeWord(string w)
        {
            Skip();
            if (string.Compare(text, _i, w, 0, w.Length, StringComparison.OrdinalIgnoreCase) != 0) return false;
            var end = _i + w.Length;
            if (end < text.Length && (char.IsLetterOrDigit(text[end]) || text[end] == '_')) return false;
            _i = end; return true;
        }

        public Value Expr()
        {
            var v = And();
            while (TakeWord("or") || TakeWord("oder")) { var r = And(); v = Value.Of(v.Truthy || r.Truthy ? 1 : 0); }
            return v;
        }
        private Value And()
        {
            var v = Not();
            while (TakeWord("and") || TakeWord("und")) { var r = Not(); v = Value.Of(v.Truthy && r.Truthy ? 1 : 0); }
            return v;
        }
        private Value Not() => TakeWord("not") || TakeWord("nicht") ? Value.Of(Not().Truthy ? 0 : 1) : Compare();
        private Value Compare()
        {
            var v = Concat();
            foreach (var (op, f) in new (string, Func<int, bool>)[] { ("<=", c => c <= 0), (">=", c => c >= 0), ("<>", c => c != 0), ("=", c => c == 0), ("<", c => c < 0), (">", c => c > 0) })
                if (Take(op)) { var r = Concat(); return Value.Of(f(Cmp(v, r)) ? 1 : 0); }
            return v;
        }
        private static int Cmp(Value a, Value b)
        {
            if (a.IsNone || b.IsNone) throw new MissingValue();
            if (a.AsNumber is { } x && b.AsNumber is { } y) return x.CompareTo(y);
            return string.Compare(a.AsText, b.AsText, StringComparison.OrdinalIgnoreCase);
        }
        private Value Concat()
        {
            var v = Sum();
            while (Take("&")) { var r = Sum(); v = Value.Of((v.AsText ?? "") + (r.AsText ?? "")); }
            return v;
        }
        private Value Sum()
        {
            var v = Term();
            for (;;)
            {
                if (Take("+")) v = Value.Of(Num(v) + Num(Term()));
                else if (Take("-")) v = Value.Of(Num(v) - Num(Term()));
                else return v;
            }
        }
        private Value Term()
        {
            var v = Power();
            for (;;)
            {
                if (Take("*")) v = Value.Of(Num(v) * Num(Power()));
                else if (Take("/")) { var d = Num(Power()); if (d == 0 && !Checking) throw new DivideByZeroException(); v = Value.Of(Checking ? 1 : Num(v) / d); }
                else return v;
            }
        }
        private Value Power()
        {
            var v = Unary();
            while (Take("^")) { var e = Num(Unary()); v = Value.Of(Checking ? 1 : (decimal)Math.Pow((double)Num(v), (double)e)); }
            return v;
        }
        private Value Unary() => Take("-") ? Value.Of(-Num(Unary())) : Take("+") ? Unary() : Primary();
        private decimal Num(Value v) => Checking ? 1 : v.AsNumber ?? throw new MissingValue();

        private Value Primary()
        {
            Skip();
            if (_i >= text.Length) throw new FormatException("Ausdruck endet zu früh.");
            if (Take("(")) { var v = Expr(); if (!Take(")")) throw new FormatException("„)“ fehlt."); return v; }
            var c = text[_i];
            if (c == '"')
            {
                var end = text.IndexOf('"', _i + 1);
                if (end < 0) throw new FormatException("Text ohne schliessendes \".");
                var s = text[(_i + 1)..end]; _i = end + 1;
                return Value.Of(s);
            }
            if (char.IsDigit(c) || c == '.')
            {
                var start = _i;
                while (_i < text.Length && (char.IsDigit(text[_i]) || text[_i] == '.')) _i++;
                return Value.Of(decimal.Parse(text[start.._i], NumberStyles.Number, CultureInfo.InvariantCulture));
            }
            // [@schlüssel] wie ein Spaltenbezug in einer Excel-Tabelle; @schlüssel und schlüssel gehen auch
            var bracket = false;
            if (c == '[') { _i++; Skip(); bracket = true; c = _i < text.Length ? text[_i] : ' '; }
            if (c == '@') { _i++; Skip(); c = _i < text.Length ? text[_i] : ' '; }
            if (char.IsLetter(c) || c == '_')
            {
                var start = _i;
                while (_i < text.Length && (char.IsLetterOrDigit(text[_i]) || text[_i] == '_')) _i++;
                var name = text[start.._i];
                if (bracket) { if (!Take("]")) throw new FormatException("„]“ fehlt."); }
                else
                {
                    if (Take("(")) return Call(Alias(name.TrimStart('_').ToLowerInvariant()));
                    switch (name.ToLowerInvariant()) { case "wahr": case "true": return Value.Of(1); case "falsch": case "false": return Value.Of(0); }
                }
                if (!Regex.IsMatch(name, "^[a-z][a-z0-9_]*$")) throw new FormatException($"Kein Attributschlüssel: {name}");
                Keys.Add(name);
                return Checking ? Value.Of(1) : value!(name);
            }
            throw new FormatException($"Unerwartet: „{c}“");
        }

        /// <summary>Excel-Namen, deutsch und englisch, auf die eine Umsetzung.</summary>
        private static string Alias(string name) => name switch
        {
            "wenn" => "if", "und" => "and", "oder" => "or", "nicht" => "not",
            "runden" => "round", "kürzen" or "kuerzen" => "trunc", "ganzzahl" or "int" => "floor", "obergrenze" or "ceiling" => "ceil",
            "länge" or "laenge" => "len", "gross" or "groß" => "upper", "klein" => "lower", "glätten" or "glaetten" => "trim",
            "links" => "left", "rechts" => "right", "verketten" or "concat" or "concatenate" => "concat",
            "istleer" or "isblank" or "leer" => "empty", "wennfehler" or "iferror" => "iferror", "text" or "zahl" or "format" => "format",
            "erster" => "coalesce",
            _ => name,
        };

        /// <summary>TEXT(x; "0,00"): Stellen aus dem Excel-Muster zählen (Komma oder Punkt), Tausender ohne Trenner.</summary>
        private static int DecimalsOf(Value pattern)
        {
            var s = pattern.AsText ?? "0";
            var i = Math.Max(s.LastIndexOf(','), s.LastIndexOf('.'));
            return i < 0 ? 0 : s.Length - i - 1;
        }

        private Value Arg(string fn)
        {
            if (!Forgiving.Contains(fn) || Checking) return Expr();
            var save = _i;
            try { return Expr(); }
            catch (Exception e) when (e is MissingValue or DivideByZeroException) { _i = save; Skip(); SkipArg(); return Value.None; }
        }
        /// <summary>Ein Argument überlesen (bis Komma/Semikolon oder schliessende Klammer auf gleicher Tiefe).</summary>
        private void SkipArg()
        {
            var depth = 0; var inText = false;
            for (; _i < text.Length; _i++)
            {
                var ch = text[_i];
                if (ch == '"') inText = !inText;
                if (inText) continue;
                if (ch == '(') depth++;
                else if (ch == ')') { if (depth == 0) return; depth--; }
                else if ((ch == ',' || ch == ';') && depth == 0) return;
            }
        }

        private static string Cut(string s, int n, bool left) => n >= s.Length ? s : left ? s[..Math.Max(0, n)] : s[^Math.Max(0, n)..];

        private Value Call(string name)
        {
            var args = new List<Value>();
            if (!Take(")"))
            {
                // Argumente einzeln fangen: WENNFEHLER(x; ersatz) und WENN sollen mit fehlenden Werten leben
                args.Add(Arg(name));
                while (Take(",") || Take(";")) args.Add(Arg(name));
                if (!Take(")")) throw new FormatException("„)“ fehlt.");
            }
            Value A(int i) => i < args.Count ? args[i] : throw new FormatException($"{name}: Argument {i + 1} fehlt.");
            if (Checking) return name switch
            {
                "round" or "min" or "max" or "abs" or "len" or "upper" or "lower" or "trim" or "if" or "empty" or "coalesce" or "trunc" or "floor" or "ceil" or "format"
                    or "and" or "or" or "not" or "left" or "right" or "concat" or "iferror" => Value.Of(1),
                _ => throw new FormatException($"Unbekannte Funktion: {name}"),
            };
            return name switch
            {
                "round" => Value.Of(Math.Round(Num(A(0)), args.Count > 1 ? (int)Num(A(1)) : 0, MidpointRounding.AwayFromZero)),
                "min" => Value.Of(args.Select(Num).Min()),
                "max" => Value.Of(args.Select(Num).Max()),
                "abs" => Value.Of(Math.Abs(Num(A(0)))),
                "trunc" => Value.Of(Math.Truncate(Num(A(0)))),
                "floor" => Value.Of(Math.Floor(Num(A(0)))),
                "ceil" => Value.Of(Math.Ceiling(Num(A(0)))),
                // format(x; stellen): Zahl als Text in der Sprache der Spalte — de „1,39“, en „1.39“; Tausender ohne Trenner
                "format" => Value.Of(Num(A(0)).ToString(args.Count > 1 ? "0." + new string('0', A(1).Number is { } d ? (int)d : DecimalsOf(A(1))) : "0.############", culture ?? CultureInfo.InvariantCulture)),
                "and" => Value.Of(args.All(a => a.Truthy) ? 1 : 0),
                "or" => Value.Of(args.Any(a => a.Truthy) ? 1 : 0),
                "not" => Value.Of(A(0).Truthy ? 0 : 1),
                "left" => Value.Of(Cut(A(0).AsText ?? throw new MissingValue(), args.Count > 1 ? (int)Num(A(1)) : 1, true)),
                "right" => Value.Of(Cut(A(0).AsText ?? throw new MissingValue(), args.Count > 1 ? (int)Num(A(1)) : 1, false)),
                "concat" => Value.Of(string.Concat(args.Select(a => a.AsText ?? ""))),
                "iferror" => A(0).IsNone ? A(1) : A(0),
                "len" => Value.Of((A(0).AsText ?? "").Length),
                "upper" => Value.Of((A(0).AsText ?? throw new MissingValue()).ToUpperInvariant()),
                "lower" => Value.Of((A(0).AsText ?? throw new MissingValue()).ToLowerInvariant()),
                "trim" => Value.Of((A(0).AsText ?? throw new MissingValue()).Trim()),
                "if" => A(0).IsNone ? A(2) : A(0).Truthy ? A(1) : A(2),
                "empty" => Value.Of(A(0).IsNone || string.IsNullOrWhiteSpace(A(0).AsText) ? 1 : 0),
                "coalesce" => args.FirstOrDefault(a => !a.IsNone && !string.IsNullOrEmpty(a.AsText)),
                _ => throw new FormatException($"Unbekannte Funktion: {name}"),
            };
        }
    }
}
