using System.IO.Compression;

namespace Journali.Server;

/// <summary>
/// Bilder der Demo (07.10.2026): einfache Darstellungen der Leuchten und Lampen, im Code gezeichnet — kein fremdes Foto, keine Datei im
/// Repo, kein Paket. Gezeichnet wird mit Abstandsfunktionen (je Bildpunkt: wie weit ist der Rand?) und weicher Kante, geschrieben als PNG.
/// Je Leuchtenart eine Grundform; die Form der Familie (rund, eckig, flach …) ändert Proportionen, die Farbe das Gehäuse, die
/// Farbtemperatur das Licht.
/// </summary>
public static class DemoBilder
{
    public const int Groesse = 600;

    /// <param name="Art">decke, wand, tisch, pendel, weg, strahler, lampe</param>
    /// <param name="Form">rund, eckig, flach, oval, schmal, breit</param>
    /// <param name="Farbe">Schlüssel der Liste color (white, black …); bei Lampen leer</param>
    /// <param name="Sockel">bei Lampen e27, e14 oder gu10</param>
    public sealed record Wunsch(string Art, string Form, string? Farbe, int Kelvin, string? Sockel = null)
    {
        public string Name => string.Join("-", new[] { Art, Form, Farbe ?? Sockel, Kelvin + "k" }.Where(x => !string.IsNullOrEmpty(x))) + ".png";
    }

    public static byte[] Png(Wunsch w)
    {
        var l = new Leinwand(Groesse);
        Zeichne(l, w);
        return l.Png();
    }

    private readonly record struct Rgb(float R, float G, float B)
    {
        public static Rgb Hex(int v) => new(((v >> 16) & 255) / 255f, ((v >> 8) & 255) / 255f, (v & 255) / 255f);
        public Rgb Mal(float f) => new(Math.Clamp(R * f, 0, 1), Math.Clamp(G * f, 0, 1), Math.Clamp(B * f, 0, 1));
    }

    private static Rgb Gehaeuse(string? farbe) => farbe switch
    {
        "white" => Rgb.Hex(0xF4F4F1), "black" => Rgb.Hex(0x26272A), "anthracite" => Rgb.Hex(0x3B4146), "silver" => Rgb.Hex(0xB4B8B9),
        "gold" => Rgb.Hex(0xC9A54E), "grey" => Rgb.Hex(0x8E9396), _ => Rgb.Hex(0xB4B8B9),
    };

    private static Rgb Licht(int kelvin) => kelvin switch
    {
        <= 2700 => Rgb.Hex(0xFFD49A), <= 3000 => Rgb.Hex(0xFFE2B0), _ => Rgb.Hex(0xFFF5E2),
    };

    /// <summary>Breite und Höhe je Form der Familie.</summary>
    private static (float W, float H) Proportion(string form) => form switch
    {
        "flach" => (1.2f, 0.6f), "oval" => (1.3f, 0.85f), "schmal" => (0.6f, 1.2f), "breit" => (1.5f, 0.8f), _ => (1f, 1f),
    };

    private static bool Eckig(string form) => form is "eckig" or "schmal" or "breit" or "flach";

    private static void Zeichne(Leinwand l, Wunsch w)
    {
        var gehaeuse = Gehaeuse(w.Farbe);
        var licht = Licht(w.Kelvin);
        var (fw, fh) = Proportion(w.Form);
        var diffusor = new Rgb(1, 0.98f, 0.94f);
        const float M = Groesse / 2f;
        switch (w.Art)
        {
            case "decke":
            {
                var bw = 170 * fw; var bh = 60 * fh + 20;
                l.Leuchten(M, 250 + bh, bw * 1.3f, 260, licht, 0.55f);
                l.Fuelle(Eckig(w.Form) ? Box(M, 200 + bh / 2, bw, bh / 2, 10) : Ellipse(M, 200, bw, bh), gehaeuse);
                l.Fuelle(Eckig(w.Form) ? Box(M, 200 + bh - 6, bw - 14, 8, 4) : Ellipse(M, 200 + bh * 0.75f, bw * 0.7f, bh * 0.22f), diffusor, 0);
                l.Fuelle(Box(M, 100, M + 10, 100, 0), Rgb.Hex(0xDADDE1), 0.05f);   // Decke
                break;
            }
            case "wand":
            {
                l.Leuchten(M, 140, 150 * fw, 150, licht, 0.5f);
                l.Leuchten(M, 460, 150 * fw, 150, licht, 0.5f);
                l.Fuelle(Box(M, M, 46 * fw, 70 * fh, 8), gehaeuse.Mal(0.85f));
                l.Fuelle(Eckig(w.Form) ? Box(M, M, 110 * fw, 120 * fh, 14) : Ellipse(M, M, 115 * fw, 125 * fh), gehaeuse);
                if (Eckig(w.Form))
                {
                    l.Fuelle(Box(M, M - 120 * fh + 6, 90 * fw, 5, 3), diffusor, 0);
                    l.Fuelle(Box(M, M + 120 * fh - 6, 90 * fw, 5, 3), diffusor, 0);
                }
                else l.Fuelle(Ellipse(M, M, 80 * fw, 8), diffusor, 0);   // Lichtfuge quer
                break;
            }
            case "tisch":
            {
                l.Fuelle(Ellipse(M, 548, 170 * fw, 18), Rgb.Hex(0xC9CDD2), 0);   // Schatten
                l.Leuchten(M, 380, 170 * fw, 150, licht, 0.55f);
                l.Fuelle(Ellipse(M, 530, 90 * fw, 20), gehaeuse);
                l.Fuelle(Kapsel(M, 528, M, 300, 7), gehaeuse.Mal(0.9f));
                l.Fuelle(Eckig(w.Form) ? Box(M, 245, 120 * fw, 75 * fh, 6) : Trapez(M, 170, 320, 70 * fw, 135 * fw), gehaeuse);
                l.Fuelle(Ellipse(M, Eckig(w.Form) ? 245 + 75 * fh : 320, (Eckig(w.Form) ? 110 : 125) * fw, 9), diffusor, 0);
                break;
            }
            case "pendel":
            {
                l.Fuelle(Box(M, 14, 42, 14, 5), gehaeuse.Mal(0.9f));
                l.Fuelle(Kapsel(M, 20, M, 230, 2.5f), Rgb.Hex(0x3A3D40), 0);
                l.Leuchten(M, 420, 220 * fw, 170, licht, 0.55f);
                if (Eckig(w.Form)) l.Fuelle(Trapez(M, 225, 225 + 130 * fh, 60 * fw, 150 * fw), gehaeuse);
                else l.Fuelle(Schnitt(Ellipse(M, 360, 155 * fw, 140 * fh), Unterhalb(360, false)), gehaeuse);
                l.Fuelle(Ellipse(M, Eckig(w.Form) ? 225 + 130 * fh : 360, (Eckig(w.Form) ? 140 : 145) * fw, 10), diffusor, 0);
                break;
            }
            case "weg":
            {
                l.Fuelle(Ellipse(M, 560, 140, 18), Rgb.Hex(0xC9CDD2), 0);
                l.Leuchten(M, 210, 170, 130, licht, 0.5f);
                l.Fuelle(Box(M, 400, 34 * fw, 155, 6), gehaeuse);
                l.Fuelle(Eckig(w.Form) ? Box(M, 200, 62 * fw, 40 * fh, 8) : Ellipse(M, 200, 64 * fw, 42 * fh), gehaeuse);
                l.Fuelle(Box(M, 232 + 8 * fh, 52 * fw, 9, 4), diffusor, 0);
                l.Fuelle(Box(M, 552, 70, 8, 3), gehaeuse.Mal(0.8f));
                break;
            }
            case "strahler":
            {
                l.Fuelle(Ellipse(M, 560, 150, 16), Rgb.Hex(0xC9CDD2), 0);
                l.Leuchten(M, 290, 280 * fw, 230, licht, 0.45f);
                l.Fuelle(Box(M, 545, 90, 12, 4), gehaeuse.Mal(0.85f));
                var buegel = 150 * fw + 16;   // Bügel aussen am Gehäuse, unten zusammengeführt
                l.Fuelle(Kapsel(M - buegel, 290, M - buegel, 470, 9), gehaeuse.Mal(0.85f));
                l.Fuelle(Kapsel(M + buegel, 290, M + buegel, 470, 9), gehaeuse.Mal(0.85f));
                l.Fuelle(Kapsel(M - buegel, 470, M + buegel, 470, 9), gehaeuse.Mal(0.85f));
                l.Fuelle(Kapsel(M, 470, M, 540, 9), gehaeuse.Mal(0.85f));
                l.Fuelle(Box(M, 290, 150 * fw, 110 * fh, Eckig(w.Form) ? 12 : 40), gehaeuse);
                l.Fuelle(Box(M, 290, 126 * fw, 88 * fh, Eckig(w.Form) ? 8 : 34), Mischen(diffusor, licht, 0.5f), 0);
                break;
            }
            default:   // lampe
            {
                var glas = Mischen(diffusor, licht, 0.55f);
                var metall = Rgb.Hex(0xB9BCBE);
                if (w.Sockel == "gu10")
                {
                    l.Leuchten(M, 170, 260, 200, licht, 0.5f);
                    l.Fuelle(Trapez(M, 170, 390, 150, 70), Rgb.Hex(0xEDEDEA));
                    l.Fuelle(Ellipse(M, 172, 150, 24), glas, 0);
                    foreach (var x in new[] { M - 32, M + 32 })
                    {
                        l.Fuelle(Kapsel(x, 388, x, 440, 6), metall);
                        l.Fuelle(Kreis(x, 446, 11), metall);
                    }
                }
                else
                {
                    var klein = w.Sockel == "e14";
                    var gw = klein ? 0.7f : 1f;
                    l.Leuchten(M, 220, 240 * gw, 240, licht, 0.5f);
                    l.Fuelle(klein ? Ellipse(M, 230, 88, 150) : Kreis(M, 230, 140), glas, 0.08f);
                    l.Fuelle(Trapez(M, klein ? 360 : 345, 420, 92 * gw, 60 * gw), Rgb.Hex(0xEDEDEA));
                    l.Fuelle(Box(M, 460, 58 * gw, 42, 8), metall);
                    for (var i = 0; i < 3; i++) l.Fuelle(Box(M, 434 + 22 * i, 58 * gw, 2.2f, 1), metall.Mal(0.7f), 0);
                    l.Fuelle(Ellipse(M, 512, 24 * gw, 12), Rgb.Hex(0x3A3D40));
                }
                break;
            }
        }
    }

    private static Rgb Mischen(Rgb a, Rgb b, float t) => new(a.R + (b.R - a.R) * t, a.G + (b.G - a.G) * t, a.B + (b.B - a.B) * t);

    // ---- Formen: Abstand zum Rand in Bildpunkten (negativ innen), dazu ein Rahmen, ausserhalb dessen nichts gezeichnet wird

    private sealed record Form(Func<float, float, float> Abstand, float X0, float Y0, float X1, float Y1);

    private static Form Kreis(float cx, float cy, float r) =>
        new((x, y) => MathF.Sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r, cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2);

    private static Form Ellipse(float cx, float cy, float rx, float ry) =>
        new((x, y) => { var k = MathF.Sqrt((x - cx) * (x - cx) / (rx * rx) + (y - cy) * (y - cy) / (ry * ry)); return (k - 1) * MathF.Min(rx, ry); },
            cx - rx - 2, cy - ry - 2, cx + rx + 2, cy + ry + 2);

    private static Form Box(float cx, float cy, float hx, float hy, float rad) =>
        new((x, y) =>
        {
            var qx = MathF.Abs(x - cx) - (hx - rad); var qy = MathF.Abs(y - cy) - (hy - rad);
            return MathF.Sqrt(MathF.Max(qx, 0) * MathF.Max(qx, 0) + MathF.Max(qy, 0) * MathF.Max(qy, 0)) + MathF.Min(MathF.Max(qx, qy), 0) - rad;
        }, cx - hx - 2, cy - hy - 2, cx + hx + 2, cy + hy + 2);

    private static Form Kapsel(float ax, float ay, float bx, float by, float r) =>
        new((x, y) =>
        {
            float px = x - ax, py = y - ay, dx = bx - ax, dy = by - ay;
            var h = Math.Clamp((px * dx + py * dy) / (dx * dx + dy * dy), 0, 1);
            return MathF.Sqrt((px - dx * h) * (px - dx * h) + (py - dy * h) * (py - dy * h)) - r;
        }, MathF.Min(ax, bx) - r - 2, MathF.Min(ay, by) - r - 2, MathF.Max(ax, bx) + r + 2, MathF.Max(ay, by) + r + 2);

    /// <summary>Trapez mit waagrechten Kanten oben und unten (Schirm, Reflektor): je Kante der Abstand zur Geraden, das Grösste zählt.</summary>
    private static Form Trapez(float cx, float oben, float unten, float halbOben, float halbUnten)
    {
        // rechte Schräge: von (cx+halbOben, oben) nach (cx+halbUnten, unten); Normale nach aussen
        float sx = halbUnten - halbOben, sy = unten - oben, len = MathF.Sqrt(sx * sx + sy * sy);
        float nx = sy / len, ny = -sx / len;
        var breit = MathF.Max(halbOben, halbUnten);
        return new((x, y) =>
        {
            var px = MathF.Abs(x - cx) - halbOben; var py = y - oben;
            var schraeg = px * nx + py * ny;
            return MathF.Max(MathF.Max(oben - y, y - unten), schraeg);
        }, cx - breit - 2, oben - 2, cx + breit + 2, unten + 2);
    }

    private static Form Unterhalb(float y0, bool unter) => new((x, y) => unter ? y0 - y : y - y0, 0, 0, Groesse, Groesse);

    private static Form Schnitt(Form a, Form b) =>
        new((x, y) => MathF.Max(a.Abstand(x, y), b.Abstand(x, y)), MathF.Max(a.X0, b.X0), MathF.Max(a.Y0, b.Y0), MathF.Min(a.X1, b.X1), MathF.Min(a.Y1, b.Y1));

    private sealed class Leinwand
    {
        private readonly int _n;
        private readonly float[] _r, _g, _b;

        public Leinwand(int n)
        {
            _n = n; _r = new float[n * n]; _g = new float[n * n]; _b = new float[n * n];
            var oben = Rgb.Hex(0xF3F4F6); var unten = Rgb.Hex(0xDDE1E5);
            for (var y = 0; y < n; y++)
            {
                var c = Mischen(oben, unten, y / (float)(n - 1));
                for (var x = 0; x < n; x++) { var i = y * n + x; _r[i] = c.R; _g[i] = c.G; _b[i] = c.B; }
            }
        }

        /// <summary>Füllen mit weicher Kante; oben heller als unten (<paramref name="schatten"/>), am Rand innen ein dunkler Saum.</summary>
        public void Fuelle(Form f, Rgb farbe, float schatten = 0.18f)
        {
            int x0 = Math.Max(0, (int)f.X0), y0 = Math.Max(0, (int)f.Y0), x1 = Math.Min(_n - 1, (int)f.X1 + 1), y1 = Math.Min(_n - 1, (int)f.Y1 + 1);
            var hoehe = Math.Max(1, y1 - y0);
            for (var y = y0; y <= y1; y++)
            {
                var hell = 1 + schatten * (0.5f - (y - y0) / (float)hoehe);
                for (var x = x0; x <= x1; x++)
                {
                    var d = f.Abstand(x + 0.5f, y + 0.5f);
                    var a = Math.Clamp(0.5f - d, 0, 1);
                    if (a <= 0) continue;
                    var saum = schatten > 0 && d > -1.6f ? 0.82f : 1f;
                    var c = farbe.Mal(hell * saum);
                    var i = y * _n + x;
                    _r[i] += (c.R - _r[i]) * a; _g[i] += (c.G - _g[i]) * a; _b[i] += (c.B - _b[i]) * a;
                }
            }
        }

        /// <summary>Weicher Lichtschein: zur Mitte hin stärker in der Lichtfarbe.</summary>
        public void Leuchten(float cx, float cy, float rx, float ry, Rgb farbe, float staerke)
        {
            int x0 = Math.Max(0, (int)(cx - rx)), y0 = Math.Max(0, (int)(cy - ry)), x1 = Math.Min(_n - 1, (int)(cx + rx)), y1 = Math.Min(_n - 1, (int)(cy + ry));
            for (var y = y0; y <= y1; y++)
                for (var x = x0; x <= x1; x++)
                {
                    var q = (x - cx) * (x - cx) / (rx * rx) + (y - cy) * (y - cy) / (ry * ry);
                    if (q >= 1) continue;
                    var a = staerke * (1 - q) * (1 - q);
                    var i = y * _n + x;
                    _r[i] += (farbe.R - _r[i]) * a; _g[i] += (farbe.G - _g[i]) * a; _b[i] += (farbe.B - _b[i]) * a;
                }
        }

        public byte[] Png()
        {
            var roh = new byte[_n * (1 + _n * 3)];
            for (var y = 0; y < _n; y++)
            {
                var z = y * (1 + _n * 3);
                roh[z] = 0;   // Filter: keiner
                for (var x = 0; x < _n; x++)
                {
                    var i = y * _n + x;
                    roh[z + 1 + x * 3] = (byte)Math.Round(Math.Clamp(_r[i], 0, 1) * 255);
                    roh[z + 2 + x * 3] = (byte)Math.Round(Math.Clamp(_g[i], 0, 1) * 255);
                    roh[z + 3 + x * 3] = (byte)Math.Round(Math.Clamp(_b[i], 0, 1) * 255);
                }
            }
            using var gepackt = new MemoryStream();
            using (var z = new ZLibStream(gepackt, CompressionLevel.Optimal, leaveOpen: true)) z.Write(roh);
            using var png = new MemoryStream();
            png.Write([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            var kopf = new byte[13];
            Schreibe(kopf, 0, (uint)_n); Schreibe(kopf, 4, (uint)_n);
            kopf[8] = 8; kopf[9] = 2;   // 8 Bit, RGB
            Stueck(png, "IHDR", kopf);
            Stueck(png, "IDAT", gepackt.ToArray());
            Stueck(png, "IEND", []);
            return png.ToArray();
        }

        private static void Schreibe(byte[] b, int o, uint v) { b[o] = (byte)(v >> 24); b[o + 1] = (byte)(v >> 16); b[o + 2] = (byte)(v >> 8); b[o + 3] = (byte)v; }

        private static void Stueck(Stream s, string art, byte[] daten)
        {
            var laenge = new byte[4]; Schreibe(laenge, 0, (uint)daten.Length); s.Write(laenge);
            var typ = System.Text.Encoding.ASCII.GetBytes(art); s.Write(typ); s.Write(daten);
            var crc = Crc(Crc(0xFFFFFFFF, typ), daten) ^ 0xFFFFFFFF;
            var pruef = new byte[4]; Schreibe(pruef, 0, crc); s.Write(pruef);
        }

        private static readonly uint[] Tabelle = Enumerable.Range(0, 256).Select(n =>
        {
            var c = (uint)n;
            for (var k = 0; k < 8; k++) c = (c & 1) != 0 ? 0xEDB88320 ^ (c >> 1) : c >> 1;
            return c;
        }).ToArray();

        private static uint Crc(uint c, byte[] daten)
        {
            foreach (var b in daten) c = Tabelle[(c ^ b) & 0xFF] ^ (c >> 8);
            return c;
        }
    }
}
