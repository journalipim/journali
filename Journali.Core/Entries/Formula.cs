using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Journali.Core.Entries;

/// <summary>
/// Kombinierte Attribute (Taloan, 17.09.2026): ein Attribut mit <see cref="AttributeDefinition.Formula"/> hat
/// keinen eigenen Wert im Journal — die Formel ist ein kleines Skript, das beim Lesen läuft und
/// den Wert liefert. Wer damit arbeitet, ist Techniker (Taloan): also eine Skriptsprache wie
/// JavaScript/PHP, mehrzeilig, einrückbar, englische Namen — keine Excel-Einzeiler, keine
/// übersetzten Funktionsnamen.
///
/// <code>
/// // Wert eines Attributs am Knoten: $schlüssel (geerbt zählt; Text in der Sprache der Spalte)
/// h = $height
/// if (h >= 100) {
///   return `${format(h / 100, 2)} m`
/// }
/// return `${h} cm`
/// </code>
///
/// - Werte: Zahl, Text ("…" oder '…'), Vorlage `…${ausdruck}…`, true/false, null.
/// - Operatoren wie in JavaScript: + - * / % **, + verkettet, wenn eine Seite Text ist;
///   == != &lt; &lt;= &gt; &gt;=; &amp;&amp; || !; bedingung ? a : b; a ?? b (Ersatz, wenn a null ist).
/// - Anweisungen: x = …, if (…) { … } else { … }, return …; die letzte Anweisung ist das Ergebnis,
///   wenn kein return kommt. Zeilenende oder ; trennt. // Kommentar.
/// - Funktionen: round(x, n) trunc floor ceil abs min max sqrt, len upper lower trim left(s, n)
///   right(s, n) contains(s, t) replace(s, a, b) split(s, sep, i) pad(s, n) number(x) str(x)
///   format(x, n) (Zahl als Text in der Sprache der Spalte: de „1,39"), isblank(x), coalesce(a, b, …).
/// - null rechnet sich durch: $height + 1 ist null, wenn $height fehlt; Vergleiche mit null sind
///   false; ?? und isblank fangen es ab. Ergebnis null = kein Wert („—").
/// Einheiten rechnet die Formel nicht um; wer cm³ in Litern will, teilt durch 1000.
/// </summary>
public static class Formula
{
    public enum Kind { None, Number, Text, Bool }

    /// <summary>Ein Wert im Skript.</summary>
    public readonly record struct Value(Kind Kind, decimal Number, string? Text, bool Bool)
    {
        public static readonly Value None = new(Kind.None, 0, null, false);
        public static Value Of(decimal d) => new(Kind.Number, d, null, false);
        public static Value Of(string? s) => s is null ? None : new(Kind.Text, 0, s, false);
        public static Value Of(bool b) => new(Kind.Bool, 0, null, b);
        public bool IsNone => Kind == Kind.None;
        public bool Truthy => Kind switch { Kind.Number => Number != 0, Kind.Text => Text!.Length > 0, Kind.Bool => Bool, _ => false };
        public decimal? AsNumber => Kind switch
        {
            Kind.Number => Number,
            Kind.Bool => Bool ? 1 : 0,
            Kind.Text => decimal.TryParse(Text, NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? d : null,
            _ => null,
        };
        public string? AsText => Kind switch { Kind.Text => Text, Kind.Number => Format(Number), Kind.Bool => Bool ? "true" : "false", _ => null };
        public static string Format(decimal n) => n.ToString("0.############", CultureInfo.InvariantCulture);
    }

    /// <summary>Kultur zur Sprache der Spalte — für format(): de → Komma, en → Punkt, sonst neutral.</summary>
    public static CultureInfo CultureOf(string? locale)
    {
        try { return locale is { Length: > 0 } ? CultureInfo.GetCultureInfo(locale) : CultureInfo.InvariantCulture; }
        catch (CultureNotFoundException) { return CultureInfo.InvariantCulture; }
    }

    /// <summary>Prüft das Skript; liefert die Attributschlüssel, die es liest — oder eine Fehlermeldung.</summary>
    public static (string[] Keys, string? Error) Check(string formula)
    {
        try
        {
            var p = new Parser(formula);
            var prog = p.Program();
            return (prog.Keys.Distinct().ToArray(), null);
        }
        catch (FormatException e) { return ([], e.Message); }
    }

    /// <summary>Skript ausführen; None bei Fehler oder fehlendem Wert.</summary>
    public static Value Run(string formula, Func<string, Value> attribute, string? locale = null)
    {
        try
        {
            var prog = new Parser(formula).Program();
            return new Runner(attribute, CultureOf(locale)).Run(prog);
        }
        catch (Exception e) when (e is FormatException or DivideByZeroException or OverflowException or InvalidCastException or ArgumentOutOfRangeException) { return Value.None; }
    }

    // ---- Syntaxbaum ------------------------------------------------------------------------

    private abstract record Node;
    private sealed record Lit(Value V) : Node;
    private sealed record Attr(string Key) : Node;
    private sealed record Var(string Name) : Node;
    private sealed record Template(List<object> Parts) : Node;      // string oder Node
    private sealed record Unary(string Op, Node X) : Node;
    private sealed record Binary(string Op, Node L, Node R) : Node;
    private sealed record Ternary(Node C, Node A, Node B) : Node;
    private sealed record Call(string Name, List<Node> Args) : Node;
    private sealed record Assign(string Name, Node X) : Node;
    private sealed record If(Node C, List<Node> Then, List<Node>? Else) : Node;
    private sealed record Return(Node? X) : Node;

    private sealed class Prog { public List<Node> Body = new(); public List<string> Keys = new(); }

    // ---- Lexer + Parser ---------------------------------------------------------------------

    private sealed class Parser(string src)
    {
        private int _i;
        private readonly List<string> _keys = new();
        private readonly HashSet<string> _vars = new();   // zugewiesene Variablen — ein Name davor ist ein Tippfehler
        private static readonly HashSet<string> Functions = ["round", "trunc", "floor", "ceil", "abs", "min", "max", "sqrt", "len", "upper", "lower", "trim", "left", "right", "contains", "replace", "split", "pad", "number", "str", "format", "isblank", "coalesce",
            // Textformatierung (Taloan, 17.09.) — Namen wie in JavaScript, klein geschrieben
            "substr", "indexof", "startswith", "endswith", "capitalize", "title", "repeat", "padleft", "padright", "trimstart", "trimend", "squeeze", "regextest", "regexmatch", "regexreplace", "escapehtml", "striphtml", "slug", "nl2br", "count", "reverse"];

        public Prog Program()
        {
            var prog = new Prog();
            SkipSeparators();
            while (_i < src.Length)
            {
                prog.Body.Add(Statement());
                SkipSeparators();
            }
            prog.Keys = _keys;
            return prog;
        }

        private void SkipWs(bool newlines)
        {
            for (;;)
            {
                while (_i < src.Length && (src[_i] == ' ' || src[_i] == '\t' || src[_i] == '\r' || (newlines && src[_i] == '\n'))) _i++;
                if (_i + 1 < src.Length && src[_i] == '/' && src[_i + 1] == '/') { while (_i < src.Length && src[_i] != '\n') _i++; continue; }
                return;
            }
        }
        private void SkipSeparators() { for (;;) { SkipWs(true); if (_i < src.Length && src[_i] == ';') { _i++; continue; } return; } }
        private bool Peek(string s, bool newlines = true) { SkipWs(newlines); return string.CompareOrdinal(src, _i, s, 0, s.Length) == 0; }
        private bool Take(string s, bool newlines = true) { if (!Peek(s, newlines)) return false; _i += s.Length; return true; }
        private bool PeekWord(string w)
        {
            SkipWs(true);
            if (string.CompareOrdinal(src, _i, w, 0, w.Length) != 0) return false;
            var e = _i + w.Length;
            return e >= src.Length || !(char.IsLetterOrDigit(src[e]) || src[e] == '_');
        }
        private bool TakeWord(string w) { if (!PeekWord(w)) return false; _i += w.Length; return true; }
        private string Word()
        {
            SkipWs(true);
            var start = _i;
            while (_i < src.Length && (char.IsLetterOrDigit(src[_i]) || src[_i] == '_')) _i++;
            if (start == _i) throw new FormatException($"Name erwartet bei „{Rest()}“");
            return src[start.._i];
        }
        private string Rest() => src.Length > _i + 20 ? src[_i..(_i + 20)] + "…" : src[_i..];
        private FormatException Err(string what) => new($"{what} bei „{Rest()}“");

        private Node Statement()
        {
            if (TakeWord("if"))
            {
                if (!Take("(")) throw Err("„(“ nach if erwartet");
                var c = Expr();
                if (!Take(")")) throw Err("„)“ erwartet");
                var then = Block();
                List<Node>? els = null;
                if (TakeWord("else")) els = PeekWord("if") ? [Statement()] : Block();
                return new If(c, then, els);
            }
            if (TakeWord("return")) { SkipWs(false); return new Return(_i < src.Length && src[_i] != '\n' && src[_i] != ';' && src[_i] != '}' ? Expr() : null); }
            // Zuweisung: name = …  (aber nicht ==)
            var save = _i;
            SkipWs(true);
            if (_i < src.Length && (char.IsLetter(src[_i]) || src[_i] == '_'))
            {
                var name = Word();
                if (Peek("=") && !Peek("==")) { Take("="); var x = Expr(); _vars.Add(name); return new Assign(name, x); }
                _i = save;
            }
            return Expr();
        }

        private List<Node> Block()
        {
            if (!Take("{")) return [Statement()];
            var body = new List<Node>();
            SkipSeparators();
            while (!Take("}"))
            {
                if (_i >= src.Length) throw new FormatException("„}“ fehlt.");
                body.Add(Statement());
                SkipSeparators();
            }
            return body;
        }

        public Node Expr() => Ternary();
        private Node Ternary()
        {
            var c = Coalesce();
            if (!Take("?")) return c;
            var a = Expr();
            if (!Take(":")) throw Err("„:“ erwartet");
            return new Ternary(c, a, Expr());
        }
        private Node Coalesce() { var l = Or(); while (Take("??")) l = new Binary("??", l, Or()); return l; }
        private Node Or() { var l = And(); while (Take("||")) l = new Binary("||", l, And()); return l; }
        private Node And() { var l = Equality(); while (Take("&&")) l = new Binary("&&", l, Equality()); return l; }
        private Node Equality() { var l = Comparison(); for (;;) { if (Take("==")) l = new Binary("==", l, Comparison()); else if (Take("!=")) l = new Binary("!=", l, Comparison()); else return l; } }
        private Node Comparison()
        {
            var l = Additive();
            for (;;)
            {
                if (Take("<=")) l = new Binary("<=", l, Additive());
                else if (Take(">=")) l = new Binary(">=", l, Additive());
                else if (Take("<")) l = new Binary("<", l, Additive());
                else if (Take(">")) l = new Binary(">", l, Additive());
                else return l;
            }
        }
        private Node Additive()
        {
            var l = Multiplicative();
            for (;;)
            {
                if (Take("+", newlines: false)) l = new Binary("+", l, Multiplicative());
                else if (Take("-", newlines: false)) l = new Binary("-", l, Multiplicative());
                else return l;
            }
        }
        private Node Multiplicative()
        {
            var l = Power();
            for (;;)
            {
                if (Peek("**", newlines: false)) return l;
                if (Take("*", newlines: false)) l = new Binary("*", l, Power());
                else if (Take("/", newlines: false) ) l = new Binary("/", l, Power());
                else if (Take("%", newlines: false)) l = new Binary("%", l, Power());
                else return l;
            }
        }
        private Node Power() { var l = UnaryExpr(); if (Take("**", newlines: false)) return new Binary("**", l, Power()); return l; }
        private Node UnaryExpr()
        {
            if (Take("!")) return new Unary("!", UnaryExpr());
            if (Take("-")) return new Unary("-", UnaryExpr());
            if (Take("+")) return UnaryExpr();
            return Primary();
        }

        private Node Primary()
        {
            SkipWs(true);
            if (_i >= src.Length) throw new FormatException("Ausdruck endet zu früh.");
            var c = src[_i];
            if (c == '(') { _i++; var e = Expr(); if (!Take(")")) throw Err("„)“ erwartet"); return e; }
            if (c == '"' || c == '\'') return new Lit(Value.Of(StringLit(c)));
            if (c == '`') return TemplateLit();
            if (char.IsDigit(c) || (c == '.' && _i + 1 < src.Length && char.IsDigit(src[_i + 1])))
            {
                var start = _i;
                while (_i < src.Length && (char.IsDigit(src[_i]) || src[_i] == '.')) _i++;
                return new Lit(Value.Of(decimal.Parse(src[start.._i], NumberStyles.Number, CultureInfo.InvariantCulture)));
            }
            if (c == '$')
            {
                _i++;
                var key = Word();
                if (!Regex.IsMatch(key, "^[a-z][a-z0-9_]*$")) throw new FormatException($"Kein Attributschlüssel: ${key}");
                _keys.Add(key);
                return new Attr(key);
            }
            if (char.IsLetter(c) || c == '_')
            {
                var name = Word();
                switch (name)
                {
                    case "true": return new Lit(Value.Of(true));
                    case "false": return new Lit(Value.Of(false));
                    case "null": return new Lit(Value.None);
                }
                if (Take("(", newlines: false))
                {
                    name = name.ToLowerInvariant();   // startsWith und startswith sind dasselbe
                    if (!Functions.Contains(name)) throw new FormatException($"Unbekannte Funktion: {name}");
                    var args = new List<Node>();
                    if (!Take(")")) { args.Add(Expr()); while (Take(",")) args.Add(Expr()); if (!Take(")")) throw Err("„)“ erwartet"); }
                    return new Call(name, args);
                }
                if (!_vars.Contains(name)) throw new FormatException($"Unbekannte Variable: {name} — Attribute heissen $" + name + ", Variablen bekommen vorher einen Wert.");
                return new Var(name);
            }
            throw Err("Unerwartet");
        }

        private string StringLit(char quote)
        {
            var sb = new StringBuilder();
            _i++;
            while (_i < src.Length && src[_i] != quote)
            {
                if (src[_i] == '\\' && _i + 1 < src.Length) { _i++; sb.Append(src[_i] switch { 'n' => '\n', 't' => '\t', var x => x }); }
                else sb.Append(src[_i]);
                _i++;
            }
            if (_i >= src.Length) throw new FormatException("Text ohne schliessendes Anführungszeichen.");
            _i++;
            return sb.ToString();
        }

        /// <summary>`Text ${ausdruck} Text` — die Ausdrücke werden mit demselben Parser gelesen.</summary>
        private Node TemplateLit()
        {
            _i++;
            var parts = new List<object>();
            var sb = new StringBuilder();
            while (_i < src.Length && src[_i] != '`')
            {
                if (src[_i] == '$' && _i + 1 < src.Length && src[_i + 1] == '{')
                {
                    if (sb.Length > 0) { parts.Add(sb.ToString()); sb.Clear(); }
                    _i += 2;
                    parts.Add(Expr());
                    if (!Take("}")) throw Err("„}“ in der Vorlage erwartet");
                    continue;
                }
                if (src[_i] == '\\' && _i + 1 < src.Length) { _i++; sb.Append(src[_i]); _i++; continue; }
                sb.Append(src[_i]); _i++;
            }
            if (_i >= src.Length) throw new FormatException("Vorlage ohne schliessendes `.");
            _i++;
            if (sb.Length > 0) parts.Add(sb.ToString());
            return new Template(parts);
        }
    }

    // ---- Ausführung -------------------------------------------------------------------------

    private sealed class ReturnSignal(Value v) : Exception { public readonly Value Value = v; }

    private sealed class Runner(Func<string, Value> attribute, CultureInfo culture)
    {
        private readonly Dictionary<string, Value> _vars = new();

        public Value Run(Prog prog)
        {
            try
            {
                var last = Value.None;
                foreach (var s in prog.Body) last = Exec(s);
                return last;
            }
            catch (ReturnSignal r) { return r.Value; }
        }

        private Value Exec(Node n)
        {
            switch (n)
            {
                case Assign a: { var v = Eval(a.X); _vars[a.Name] = v; return v; }
                case If i:
                    if (Eval(i.C).Truthy) { Value last = Value.None; foreach (var s in i.Then) last = Exec(s); return last; }
                    if (i.Else is not null) { Value last = Value.None; foreach (var s in i.Else) last = Exec(s); return last; }
                    return Value.None;
                case Return r: throw new ReturnSignal(r.X is null ? Value.None : Eval(r.X));
                default: return Eval(n);
            }
        }

        private Value Eval(Node n) => n switch
        {
            Lit l => l.V,
            Attr a => attribute(a.Key),
            Var v => _vars.TryGetValue(v.Name, out var x) ? x : throw new FormatException($"Unbekannte Variable: {v.Name}"),
            Template t => Value.Of(string.Concat(t.Parts.Select(p => p is string s ? s : Eval((Node)p).AsText ?? ""))),
            Unary u => u.Op == "!" ? Value.Of(!Eval(u.X).Truthy) : Neg(Eval(u.X)),
            Binary b => Bin(b),
            Ternary t => Eval(t.C).Truthy ? Eval(t.A) : Eval(t.B),
            Call c => Func(c.Name, c.Args.Select(Eval).ToList()),
            _ => throw new FormatException("Anweisung an falscher Stelle."),
        };

        private static Value Neg(Value v) => v.AsNumber is { } d ? Value.Of(-d) : Value.None;

        private Value Bin(Binary b)
        {
            switch (b.Op)
            {
                case "&&": { var l = Eval(b.L); return l.Truthy ? Value.Of(Eval(b.R).Truthy) : Value.Of(false); }
                case "||": { var l = Eval(b.L); return l.Truthy ? Value.Of(true) : Value.Of(Eval(b.R).Truthy); }
                case "??": { var l = Eval(b.L); return l.IsNone ? Eval(b.R) : l; }
            }
            var x = Eval(b.L); var y = Eval(b.R);
            switch (b.Op)
            {
                case "+":
                    if (x.Kind == Kind.Text || y.Kind == Kind.Text) return x.IsNone || y.IsNone ? Value.None : Value.Of((x.AsText ?? "") + (y.AsText ?? ""));
                    return Num2(x, y, (a, c) => a + c);
                case "-": return Num2(x, y, (a, c) => a - c);
                case "*": return Num2(x, y, (a, c) => a * c);
                case "/": return Num2(x, y, (a, c) => c == 0 ? throw new DivideByZeroException() : a / c);
                case "%": return Num2(x, y, (a, c) => c == 0 ? throw new DivideByZeroException() : a % c);
                case "**": return Num2(x, y, (a, c) => (decimal)Math.Pow((double)a, (double)c));
                case "==": return Value.Of(Eq(x, y));
                case "!=": return Value.Of(!Eq(x, y));
                case "<": return Cmp(x, y, c => c < 0);
                case "<=": return Cmp(x, y, c => c <= 0);
                case ">": return Cmp(x, y, c => c > 0);
                case ">=": return Cmp(x, y, c => c >= 0);
            }
            throw new FormatException($"Operator {b.Op}");
        }
        private static Value Num2(Value x, Value y, Func<decimal, decimal, decimal> f) =>
            x.AsNumber is { } a && y.AsNumber is { } b ? Value.Of(f(a, b)) : Value.None;
        private static bool Eq(Value x, Value y)
        {
            if (x.IsNone || y.IsNone) return x.IsNone && y.IsNone;
            if (x.AsNumber is { } a && y.AsNumber is { } b && (x.Kind != Kind.Text || y.Kind != Kind.Text)) return a == b;
            return string.Equals(x.AsText, y.AsText, StringComparison.Ordinal);
        }
        private static Value Cmp(Value x, Value y, Func<int, bool> f)
        {
            if (x.IsNone || y.IsNone) return Value.Of(false);
            if (x.AsNumber is { } a && y.AsNumber is { } b && (x.Kind != Kind.Text || y.Kind != Kind.Text)) return Value.Of(f(a.CompareTo(b)));
            return Value.Of(f(string.Compare(x.AsText, y.AsText, StringComparison.Ordinal)));
        }

        /// <summary>Regulärer Ausdruck mit Zeitgrenze; null, wenn er nicht gültig ist.</summary>
        private static Regex? SafeRegex(string pattern)
        {
            try { return new Regex(pattern, RegexOptions.None, TimeSpan.FromMilliseconds(100)); } catch (ArgumentException) { return null; }
        }

        private Value Func(string name, List<Value> a)
        {
            Value A(int i) => i < a.Count ? a[i] : Value.None;
            decimal? N(int i) => A(i).AsNumber;
            string? S(int i) => A(i).AsText;
            Value Num(Func<decimal, decimal> f) => N(0) is { } d ? Value.Of(f(d)) : Value.None;
            Value Str(Func<string, string> f) => S(0) is { } s ? Value.Of(f(s)) : Value.None;
            switch (name)
            {
                case "round": return N(0) is { } r ? Value.Of(Math.Round(r, (int)(N(1) ?? 0), MidpointRounding.AwayFromZero)) : Value.None;
                case "trunc": return Num(Math.Truncate);
                case "floor": return Num(Math.Floor);
                case "ceil": return Num(Math.Ceiling);
                case "abs": return Num(Math.Abs);
                case "sqrt": return Num(d => (decimal)Math.Sqrt((double)d));
                case "min": return a.Count > 0 && a.All(v => v.AsNumber is not null) ? Value.Of(a.Min(v => v.AsNumber!.Value)) : Value.None;
                case "max": return a.Count > 0 && a.All(v => v.AsNumber is not null) ? Value.Of(a.Max(v => v.AsNumber!.Value)) : Value.None;
                case "len": return S(0) is { } s0 ? Value.Of(s0.Length) : Value.None;
                case "upper": return Str(s => s.ToUpperInvariant());
                case "lower": return Str(s => s.ToLowerInvariant());
                case "trim": return Str(s => s.Trim());
                case "left": return Str(s => s[..Math.Min(s.Length, Math.Max(0, (int)(N(1) ?? 1)))]);
                case "right": return Str(s => s[^Math.Min(s.Length, Math.Max(0, (int)(N(1) ?? 1)))..]);
                case "contains": return S(0) is { } s1 && S(1) is { } t1 ? Value.Of(s1.Contains(t1, StringComparison.OrdinalIgnoreCase)) : Value.Of(false);
                case "replace": return S(0) is { } s2 && S(1) is { } from ? Value.Of(s2.Replace(from, S(2) ?? "")) : Value.None;
                case "split": { if (S(0) is not { } s3) return Value.None; var parts = s3.Split(S(1) ?? ","); var i = (int)(N(2) ?? 0); return i >= 0 && i < parts.Length ? Value.Of(parts[i].Trim()) : Value.None; }
                case "pad": return S(0) is { } s4 ? Value.Of(s4.PadLeft((int)(N(1) ?? 0), (S(2) ?? "0").FirstOrDefault('0'))) : Value.None;
                case "number": return N(0) is { } n0 ? Value.Of(n0) : Value.None;
                case "str": return S(0) is { } s5 ? Value.Of(s5) : Value.None;
                case "format": return N(0) is { } f0 ? Value.Of(f0.ToString(a.Count > 1 && N(1) is { } dec ? "0." + new string('0', (int)dec) : "0.############", culture)) : Value.None;
                case "isblank": return Value.Of(A(0).IsNone || string.IsNullOrWhiteSpace(A(0).AsText));
                case "coalesce": return a.FirstOrDefault(v => !v.IsNone && !string.IsNullOrEmpty(v.AsText));
                // ---- Textformatierung
                case "substr": return Str(s => { var st = Math.Clamp((int)(N(1) ?? 0), 0, s.Length); var ln = N(2) is { } l ? Math.Clamp((int)l, 0, s.Length - st) : s.Length - st; return s.Substring(st, ln); });
                case "indexof": return S(0) is { } s6 && S(1) is { } t6 ? Value.Of(s6.IndexOf(t6, StringComparison.Ordinal)) : Value.None;
                case "startswith": return S(0) is { } s7 && S(1) is { } t7 ? Value.Of(s7.StartsWith(t7, StringComparison.Ordinal)) : Value.Of(false);
                case "endswith": return S(0) is { } s8 && S(1) is { } t8 ? Value.Of(s8.EndsWith(t8, StringComparison.Ordinal)) : Value.Of(false);
                case "capitalize": return Str(s => s.Length == 0 ? s : char.ToUpperInvariant(s[0]) + s[1..]);
                case "title": return Str(s => string.Join(' ', s.Split(' ').Select(w => w.Length == 0 ? w : char.ToUpperInvariant(w[0]) + w[1..].ToLowerInvariant())));
                case "repeat": return Str(s => string.Concat(Enumerable.Repeat(s, Math.Clamp((int)(N(1) ?? 1), 0, 1000))));
                case "padleft": return Str(s => s.PadLeft((int)(N(1) ?? 0), (S(2) ?? " ").FirstOrDefault(' ')));
                case "padright": return Str(s => s.PadRight((int)(N(1) ?? 0), (S(2) ?? " ").FirstOrDefault(' ')));
                case "trimstart": return Str(s => s.TrimStart());
                case "trimend": return Str(s => s.TrimEnd());
                case "squeeze": return Str(s => Regex.Replace(s.Trim(), @"\s+", " "));
                case "regextest": return S(0) is { } s9 && S(1) is { } r9 ? Value.Of(SafeRegex(r9) is { } rx9 && rx9.IsMatch(s9)) : Value.Of(false);
                case "regexmatch": { if (S(0) is not { } s10 || S(1) is not { } r10 || SafeRegex(r10) is not { } rx10) return Value.None; var mm = rx10.Match(s10); return mm.Success ? Value.Of(mm.Groups.Count > 1 ? mm.Groups[1].Value : mm.Value) : Value.None; }
                case "regexreplace": return S(0) is { } s11 && S(1) is { } r11 && SafeRegex(r11) is { } rx11 ? Value.Of(rx11.Replace(s11, S(2) ?? "")) : Value.None;
                case "escapehtml": return Str(s => s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;"));
                case "striphtml": return Str(s => Regex.Replace(Regex.Replace(s, "<[^>]+>", " "), @"\s+", " ").Trim());
                case "slug": return Str(s => Regex.Replace(s.ToLowerInvariant().Replace("ä", "ae").Replace("ö", "oe").Replace("ü", "ue").Replace("ß", "ss"), "[^a-z0-9]+", "-").Trim('-'));
                case "nl2br": return Str(s => s.Replace("\r\n", "\n").Replace("\n", "<br>"));
                case "count": return S(0) is { } s12 && S(1) is { Length: > 0 } t12 ? Value.Of((s12.Length - s12.Replace(t12, "").Length) / t12.Length) : Value.None;
                case "reverse": return Str(s => new string(s.Reverse().ToArray()));
            }
            throw new FormatException($"Unbekannte Funktion: {name}");
        }
    }
}
