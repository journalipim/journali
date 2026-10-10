using System.Globalization;
using System.Text;

namespace Journali.Server;

/// <summary>
/// Ein einfaches PDF ohne Paket (10.10.2026), dieselbe Satzweise wie <c>tools/pdf_einfach.py</c>: A4, Helvetica (normal und fett, WinAnsi),
/// Überschriften, Absätze, Aufzählungen und zweispaltige Tabellen, Kopf- und Fusszeile je Seite. Für die Unterlagen der Demo
/// (<see cref="Demo.Tannwald"/>) — der Dokumentindex liest daraus Abschnitte mit Seite und Überschrift wie aus jedem PDF mit Textebene.
/// Kein Zeitstempel: dieselben Bausteine ergeben dieselben Bytes.
/// </summary>
public sealed class PdfEinfach
{
    private const double SeiteB = 595, SeiteH = 842, Links = 56, Rechts = 56, Oben = 64, Unten = 64;
    private const double Breite = SeiteB - Links - Rechts;

    // Breiten der Helvetica in 1/1000 em (Standardwerte der Schrift); fehlende Zeichen rechnen mit 556
    private static readonly Dictionary<char, int> W = new()
    {
        [' '] = 278, ['!'] = 278, ['"'] = 355, ['#'] = 556, ['$'] = 556, ['%'] = 889, ['&'] = 667, ['\''] = 191, ['('] = 333, [')'] = 333, ['*'] = 389, ['+'] = 584,
        [','] = 278, ['-'] = 333, ['.'] = 278, ['/'] = 278, [':'] = 278, [';'] = 278, ['<'] = 584, ['='] = 584, ['>'] = 584, ['?'] = 556, ['@'] = 1015,
        ['A'] = 667, ['B'] = 667, ['C'] = 722, ['D'] = 722, ['E'] = 667, ['F'] = 611, ['G'] = 778, ['H'] = 722, ['I'] = 278, ['J'] = 500, ['K'] = 667, ['L'] = 556,
        ['M'] = 833, ['N'] = 722, ['O'] = 778, ['P'] = 667, ['Q'] = 778, ['R'] = 722, ['S'] = 667, ['T'] = 611, ['U'] = 722, ['V'] = 667, ['W'] = 944, ['X'] = 667,
        ['Y'] = 667, ['Z'] = 611, ['['] = 278, ['\\'] = 278, [']'] = 278, ['_'] = 556, ['a'] = 556, ['b'] = 556, ['c'] = 500, ['d'] = 556, ['e'] = 556, ['f'] = 278,
        ['g'] = 556, ['h'] = 556, ['i'] = 222, ['j'] = 222, ['k'] = 500, ['l'] = 222, ['m'] = 833, ['n'] = 556, ['o'] = 556, ['p'] = 556, ['q'] = 556, ['r'] = 333,
        ['s'] = 500, ['t'] = 278, ['u'] = 556, ['v'] = 500, ['w'] = 722, ['x'] = 500, ['y'] = 500, ['z'] = 500, ['ä'] = 556, ['ö'] = 556, ['ü'] = 556, ['Ä'] = 667,
        ['Ö'] = 778, ['Ü'] = 722, ['ß'] = 611, ['–'] = 556, ['—'] = 1000, ['„'] = 333, ['“'] = 333, ['”'] = 333, ['•'] = 350, ['°'] = 400, ['²'] = 333, ['×'] = 584,
        ['€'] = 556, ['…'] = 1000, ['’'] = 222, ['‘'] = 222, ['|'] = 260,
    };
    private static readonly Dictionary<char, byte> Win = new()
    {
        ['€'] = 0x80, ['‚'] = 0x82, ['„'] = 0x84, ['…'] = 0x85, ['‘'] = 0x91, ['’'] = 0x92, ['“'] = 0x93, ['”'] = 0x94, ['•'] = 0x95, ['–'] = 0x96, ['—'] = 0x97, ['™'] = 0x99,
    };

    private readonly string _titel, _kopf;
    private readonly List<List<byte[]>> _seiten = [];
    private double _y;

    public PdfEinfach(string titel, string kopf)
    {
        _titel = titel; _kopf = kopf;
        NeueSeite();
    }

    public static double TextBreite(string text, double groesse, bool fett = false) =>
        text.Sum(ch => W.GetValueOrDefault(ch, 556)) * groesse / 1000 * (fett ? 1.06 : 1.0);

    private static byte[] Bytes(string text)
    {
        var aus = new List<byte>();
        foreach (var ch in text)
        {
            var b = Win.TryGetValue(ch, out var w) ? w : ch < 256 ? (byte)ch : (byte)'?';
            if (b is 0x28 or 0x29 or 0x5C) aus.Add(0x5C);   // ( ) \ maskieren
            aus.Add(b);
        }
        return [.. aus];
    }

    public static List<string> Umbrechen(string text, double groesse, double maxBreite, bool fett = false)
    {
        var zeilen = new List<string>(); var zeile = "";
        foreach (var wort in text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
        {
            var probe = (zeile + " " + wort).Trim();
            if (TextBreite(probe, groesse, fett) <= maxBreite || zeile.Length == 0) zeile = probe;
            else { zeilen.Add(zeile); zeile = wort; }
        }
        if (zeile.Length > 0) zeilen.Add(zeile);
        return zeilen;
    }

    /// <summary>Zahl wie Python sie schreibt: 8 bleibt 8, 10.5 bleibt 10.5.</summary>
    private static string Zahl(double v) => v.ToString("R", CultureInfo.InvariantCulture);
    private static string F1(double v) => v.ToString("F1", CultureInfo.InvariantCulture);
    private static byte[] A(string s) => Encoding.ASCII.GetBytes(s);

    // ---- Seite und Zeichnen
    private void NeueSeite()
    {
        _seiten.Add([]);
        _y = SeiteH - Oben;
        Text(Links, SeiteH - 36, _kopf, 8, false, grau: true);
        Text(Links, 36, $"{_titel} · Seite {_seiten.Count}", 8, false, grau: true);
        _seiten[^1].Add(A($"0.8 G 0.5 w {F1(Links)} {F1(SeiteH - 44)} m {F1(SeiteB - Rechts)} {F1(SeiteH - 44)} l S\n"));
    }

    private void Text(double x, double y, string text, double groesse, bool fett, bool grau = false) =>
        _seiten[^1].Add([.. A((grau ? "0.45 g " : "0 g ") + "BT /" + (fett ? "F2" : "F1") + $" {Zahl(groesse)} Tf {F1(x)} {F1(y)} Td ("), .. Bytes(text), .. A(") Tj ET\n")]);

    private void Platz(double hoehe) { if (_y - hoehe < Unten) NeueSeite(); }

    // ---- Bausteine
    public void H1(string text)
    {
        var zeilen = Umbrechen(text, 20, Breite, true);
        Platz(zeilen.Count * 25 + 12);
        foreach (var z in zeilen) { _y -= 25; Text(Links, _y, z, 20, true); }
        _y -= 14;
    }

    public void H2(string text)
    {
        var zeilen = Umbrechen(text, 13.5, Breite, true);
        Platz(zeilen.Count * 18 + 40);   // eine Überschrift steht nie allein am Seitenende
        _y -= 8;
        foreach (var z in zeilen) { _y -= 18; Text(Links, _y, z, 13.5, true); }
        _y -= 4;
    }

    public void P(string text, double groesse = 10.5, bool fett = false)
    {
        foreach (var z in Umbrechen(text, groesse, Breite, fett))
        {
            Platz(groesse * 1.45);
            _y -= groesse * 1.45;
            Text(Links, _y, z, groesse, fett);
        }
        _y -= 6;
    }

    public void Punkte(IEnumerable<string> eintraege, double groesse = 10.5)
    {
        foreach (var e in eintraege)
        {
            var zeilen = Umbrechen(e, groesse, Breite - 14);
            for (var i = 0; i < zeilen.Count; i++)
            {
                Platz(groesse * 1.45);
                _y -= groesse * 1.45;
                if (i == 0) Text(Links + 2, _y, "•", groesse, false);
                Text(Links + 14, _y, zeilen[i], groesse, false);
            }
        }
        _y -= 6;
    }

    public void Tabelle(IEnumerable<(string Links, string Rechts)> zeilen, double linksBreite = 170, double groesse = 10)
    {
        foreach (var (k, v) in zeilen)
        {
            var lz = Umbrechen(k, groesse, linksBreite - 8, true);
            var rz = Umbrechen(v, groesse, Breite - linksBreite);
            var h = Math.Max(lz.Count, rz.Count) * groesse * 1.4 + 5;
            Platz(h);
            var y0 = _y;
            for (var i = 0; i < lz.Count; i++) Text(Links, y0 - (i + 1) * groesse * 1.4, lz[i], groesse, true);
            for (var i = 0; i < rz.Count; i++) Text(Links + linksBreite, y0 - (i + 1) * groesse * 1.4, rz[i], groesse, false);
            _y = y0 - h;
            _seiten[^1].Add(A($"0.85 G 0.4 w {F1(Links)} {F1(_y + 2)} m {F1(SeiteB - Rechts)} {F1(_y + 2)} l S\n"));
        }
        _y -= 8;
    }

    // ---- Ausgabe
    public byte[] Pdf()
    {
        var objekte = new List<byte[]>();
        int Neu(byte[] inhalt) { objekte.Add(inhalt); return objekte.Count; }
        var katalog = Neu([]);   // 1: wird unten gesetzt
        var seiten = Neu([]);    // 2
        var f1 = Neu(A("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
        var f2 = Neu(A("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));
        var kids = new List<int>();
        foreach (var s in _seiten)
        {
            var strom = s.SelectMany(x => x).ToArray();
            var inhalt = Neu([.. A($"<< /Length {strom.Length} >>\nstream\n"), .. strom, .. A("endstream")]);
            kids.Add(Neu(A($"<< /Type /Page /Parent {seiten} 0 R /MediaBox [0 0 {SeiteB:0} {SeiteH:0}] /Resources << /Font << /F1 {f1} 0 R /F2 {f2} 0 R >> >> /Contents {inhalt} 0 R >>")));
        }
        objekte[katalog - 1] = A($"<< /Type /Catalog /Pages {seiten} 0 R >>");
        objekte[seiten - 1] = A($"<< /Type /Pages /Kids [{string.Join(" ", kids.Select(k => $"{k} 0 R"))}] /Count {kids.Count} >>");
        var info = Neu([.. A("<< /Title ("), .. Bytes(_titel), .. A(") /Producer (journali Demo-Daten) >>")]);
        using var aus = new MemoryStream();
        aus.Write([.. A("%PDF-1.4\n%"), 0xE2, 0xE3, 0xCF, 0xD3, (byte)'\n']);
        var lagen = new List<long>();
        for (var i = 0; i < objekte.Count; i++)
        {
            lagen.Add(aus.Position);
            aus.Write(A($"{i + 1} 0 obj\n")); aus.Write(objekte[i]); aus.Write(A("\nendobj\n"));
        }
        var xref = aus.Position;
        aus.Write(A($"xref\n0 {objekte.Count + 1}\n0000000000 65535 f \n"));
        foreach (var l in lagen) aus.Write(A($"{l:D10} 00000 n \n"));
        aus.Write(A($"trailer\n<< /Size {objekte.Count + 1} /Root {katalog} 0 R /Info {info} 0 R >>\nstartxref\n{xref}\n%%EOF\n"));
        return aus.ToArray();
    }
}
