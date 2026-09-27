using Journali.Core.Entries;

namespace Journali.Server;

/// <summary>
/// Die Masse einer Bilddatei aus ihrem Kopf lesen: Breite, Höhe, Auflösung, Farbraum, Transparenz.
/// Kein Paket dafür — ein Dateikopf ist eine Handvoll Felder an festen Stellen, und die Bytes gehen beim
/// Hochladen ohnehin durch den Server. Gelesen werden JPEG, PNG, GIF, WebP, BMP und TIFF.
/// <para>Bei JPEG und TIFF tauscht die EXIF-Orientierung Breite und Höhe, wenn das Bild quer steht: die
/// Bibliothek nennt damit dasselbe Mass wie die Ableitung, denn das Plugin <c>derive</c> dreht ebenso
/// (<c>rotate()</c>).</para>
/// <para>Ein unbekanntes Format ergibt <c>null</c> — das Medium bleibt dann ohne Masse. Gelesen wird nur der
/// Anfang der Datei (<see cref="Kopf"/>); liegt das Verzeichnis eines TIFF weiter hinten, bleibt es ungelesen.</para>
/// </summary>
public static class MediaProbe
{
    /// <summary>So viele Bytes vom Anfang reichen: JPEG, PNG, GIF, WebP und BMP tragen ihre Masse in den ersten
    /// Hundert, und ein TIFF sein Verzeichnis üblicherweise vorn. Mehr zu lesen zahlt sich nicht aus.</summary>
    public const int Kopf = 256 * 1024;

    /// <summary>Den Anfang eines Datenstroms holen — höchstens <see cref="Kopf"/> Bytes.</summary>
    public static async Task<byte[]> KopfAsync(Stream s, CancellationToken ct = default)
    {
        var buf = new byte[Kopf];
        var n = 0;
        while (n < buf.Length)
        {
            var k = await s.ReadAsync(buf.AsMemory(n), ct);
            if (k == 0) break;
            n += k;
        }
        return n == buf.Length ? buf : buf[..n];
    }

    /// <summary>Was im Kopf steht, oder null.</summary>
    public static MediaProbed? Lies(ReadOnlySpan<byte> b) =>
        Jpeg(b) ?? Png(b) ?? Gif(b) ?? Webp(b) ?? Bmp(b) ?? Tiff(b, 0);

    // ---- Zahlen lesen. Ein fehlendes Byte ist kein Fehler, sondern ein Kopf, der zu kurz ist: dann 0.
    private static int U8(ReadOnlySpan<byte> b, int i) => i >= 0 && i < b.Length ? b[i] : 0;
    private static int Be16(ReadOnlySpan<byte> b, int i) => (U8(b, i) << 8) | U8(b, i + 1);
    private static int Le16(ReadOnlySpan<byte> b, int i) => U8(b, i) | (U8(b, i + 1) << 8);
    private static long Be32(ReadOnlySpan<byte> b, int i) => ((long)Be16(b, i) << 16) | (uint)Be16(b, i + 2);
    private static long Le32(ReadOnlySpan<byte> b, int i) => (uint)Le16(b, i) | ((long)Le16(b, i + 2) << 16);
    private static int Le24(ReadOnlySpan<byte> b, int i) => U8(b, i) | (U8(b, i + 1) << 8) | (U8(b, i + 2) << 16);
    private static int Word(ReadOnlySpan<byte> b, int i, bool gross) => gross ? Be16(b, i) : Le16(b, i);
    private static long Long(ReadOnlySpan<byte> b, int i, bool gross) => gross ? Be32(b, i) : Le32(b, i);
    private static bool Ist(ReadOnlySpan<byte> b, int i, string ascii)
    {
        if (i < 0 || i + ascii.Length > b.Length) return false;
        for (var k = 0; k < ascii.Length; k++) if (b[i + k] != (byte)ascii[k]) return false;
        return true;
    }

    /// <summary>Masse ergeben nur positiv einen Sinn; 0 heisst „nicht gelesen“.</summary>
    private static MediaProbed? Fertig(long w, long h, int? dpi = null, string? raum = null, bool? alpha = null, int orientierung = 1)
    {
        if (w is <= 0 or > int.MaxValue || h is <= 0 or > int.MaxValue) return null;
        // 5 bis 8 stehen quer — dieselbe Regel wie in der EXIF-Norm
        var quer = orientierung is >= 5 and <= 8;
        return new MediaProbed((int)(quer ? h : w), (int)(quer ? w : h), dpi is > 0 ? dpi : null, raum, alpha);
    }

    // ---- JPEG: FFD8, dann Segmente. Das Mass steht im SOF, die Auflösung im JFIF (APP0) und die Orientierung im EXIF (APP1).
    private static MediaProbed? Jpeg(ReadOnlySpan<byte> b)
    {
        if (U8(b, 0) != 0xFF || U8(b, 1) != 0xD8) return null;
        int dpi = 0, orientierung = 1;
        for (var i = 2; i + 3 < b.Length;)
        {
            if (b[i] != 0xFF) { i++; continue; }                       // Füllbytes zwischen Segmenten
            var marke = b[i + 1];
            if (marke == 0xFF) { i++; continue; }
            if (marke is 0x01 or 0xD8 || marke is >= 0xD0 and <= 0xD7) { i += 2; continue; }   // ohne Länge
            if (marke is 0xD9 or 0xDA) break;                          // Ende oder Bilddaten: danach kommt kein Kopf mehr
            var len = Be16(b, i + 2);
            if (len < 2) break;
            var daten = i + 4;
            switch (marke)
            {
                case 0xE0 when Ist(b, daten, "JFIF\0"):
                    // Einheit 1 = Punkte je Zoll, 2 = je Zentimeter
                    var einheit = U8(b, daten + 7); var x = Be16(b, daten + 8);
                    dpi = einheit == 1 ? x : einheit == 2 ? (int)Math.Round(x * 2.54) : 0;
                    break;
                case 0xE1 when Ist(b, daten, "Exif\0\0"):
                    var exif = Tiff(b, daten + 6);
                    orientierung = ExifOrientierung(b, daten + 6);
                    if (dpi == 0 && exif?.Dpi is { } d) dpi = d;
                    break;
                // SOF: Genauigkeit(1), Höhe(2), Breite(2), Komponenten(1). Nicht C4 (Huffman), C8 (JPG), CC (DAC).
                case >= 0xC0 and <= 0xCF when marke is not (0xC4 or 0xC8 or 0xCC):
                    var komponenten = U8(b, daten + 5);
                    var raum = komponenten == 1 ? Raeume.Grau : komponenten == 4 ? Raeume.Cmyk : Raeume.Srgb;
                    return Fertig(Be16(b, daten + 3), Be16(b, daten + 1), dpi, raum, null, orientierung);
            }
            i += 2 + len;
        }
        return null;
    }

    // ---- PNG: Signatur, dann IHDR; die Auflösung steht in pHYs, wenn es eines gibt.
    private static MediaProbed? Png(ReadOnlySpan<byte> b)
    {
        if (!Ist(b, 1, "PNG") || U8(b, 0) != 0x89 || !Ist(b, 12, "IHDR")) return null;
        var farbe = U8(b, 25);
        var raum = farbe is 0 or 4 ? Raeume.Grau : farbe == 3 ? Raeume.Indiziert : Raeume.Srgb;
        var alpha = farbe is 4 or 6;
        var dpi = 0;
        for (var i = 8; i + 8 <= b.Length;)                            // Blöcke: Länge(4), Art(4), Daten, CRC(4)
        {
            var len = Be32(b, i);
            if (len is < 0 or > int.MaxValue) break;
            if (Ist(b, i + 4, "pHYs"))
            {
                // Einheit 1 = Meter; sonst ist das Verhältnis gemeint, nicht die Auflösung
                if (U8(b, i + 16) == 1) dpi = (int)Math.Round(Be32(b, i + 8) * 0.0254);
                break;
            }
            if (Ist(b, i + 4, "IDAT") || Ist(b, i + 4, "IEND")) break;
            i += 12 + (int)len;
        }
        return Fertig(Be32(b, 16), Be32(b, 20), dpi, raum, alpha);
    }

    // ---- GIF: Breite und Höhe stehen im Logical Screen Descriptor.
    private static MediaProbed? Gif(ReadOnlySpan<byte> b) =>
        Ist(b, 0, "GIF87a") || Ist(b, 0, "GIF89a") ? Fertig(Le16(b, 6), Le16(b, 8), null, Raeume.Indiziert) : null;

    // ---- BMP: der Kopf des DIB sagt, wie breit die Felder sind.
    private static MediaProbed? Bmp(ReadOnlySpan<byte> b)
    {
        if (!Ist(b, 0, "BM")) return null;
        var kopf = Le32(b, 14);
        // 12 = BITMAPCOREHEADER mit 16-Bit-Massen, alles Neuere 32-Bit; die Höhe darf negativ sein (von oben nach unten)
        var (w, h) = kopf == 12 ? (Le16(b, 18), (long)(short)Le16(b, 20)) : (Le32(b, 18), (long)(int)Le32(b, 22));
        return Fertig(w, Math.Abs(h), null, Raeume.Srgb);
    }

    // ---- WebP: RIFF-Behälter, drei Sorten Block — VP8X (mit Alpha-Flagge), VP8 (verlustbehaftet), VP8L (verlustfrei).
    private static MediaProbed? Webp(ReadOnlySpan<byte> b)
    {
        if (!Ist(b, 0, "RIFF") || !Ist(b, 8, "WEBP")) return null;
        if (Ist(b, 12, "VP8X"))
            return Fertig(Le24(b, 24) + 1, Le24(b, 27) + 1, null, Raeume.Srgb, (U8(b, 20) & 0x10) != 0);
        if (Ist(b, 12, "VP8 ") && U8(b, 23) == 0x9D && U8(b, 24) == 0x01 && U8(b, 25) == 0x2A)
            return Fertig(Le16(b, 26) & 0x3FFF, Le16(b, 28) & 0x3FFF, null, Raeume.Srgb, false);
        if (Ist(b, 12, "VP8L") && U8(b, 20) == 0x2F)
        {
            // 14 Bit Breite-1, 14 Bit Höhe-1, 1 Bit Alpha — am Stück, mit dem niedrigsten Bit zuerst
            var bits = Le32(b, 21);
            return Fertig((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1, null, Raeume.Srgb, ((bits >> 28) & 1) != 0);
        }
        return null;
    }

    // ---- TIFF: Verzeichnis (IFD) mit Einträgen zu je 12 Bytes. Dasselbe Format steckt im EXIF-Segment eines JPEG,
    // darum nimmt der Leser einen Anfangspunkt: 0 für eine TIFF-Datei, den Anfang des TIFF-Blocks im EXIF.
    private static MediaProbed? Tiff(ReadOnlySpan<byte> b, int start)
    {
        if (!Ordnung(b, start, out var gross)) return null;
        var ifd = start + (int)Long(b, start + 4, gross);
        long w = 0, h = 0, foto = -1, proben = 0, extra = 0, einheit = 2, orientierung = 1;
        double xres = 0;
        foreach (var (tag, wert, offset, typ) in Eintraege(b, start, ifd, gross))
            switch (tag)
            {
                case 256: w = wert; break;                             // ImageWidth
                case 257: h = wert; break;                             // ImageLength
                case 258: break;                                       // BitsPerSample — nicht gebraucht
                case 262: foto = wert; break;                          // PhotometricInterpretation
                case 274: orientierung = wert; break;                  // Orientation
                case 277: proben = wert; break;                        // SamplesPerPixel
                case 282 when typ == 5: xres = Bruch(b, start, (int)offset, gross); break;   // XResolution
                case 296: einheit = wert; break;                       // ResolutionUnit: 2 = Zoll, 3 = Zentimeter
                case 338: extra = wert; break;                         // ExtraSamples: Alphakanal
            }
        var raum = foto switch { 5 => Raeume.Cmyk, 0 or 1 => Raeume.Grau, 3 => Raeume.Indiziert, 2 => Raeume.Srgb, _ => null };
        var dpi = xres > 0 ? (int)Math.Round(einheit == 3 ? xres * 2.54 : xres) : 0;
        bool? alpha = proben > 0 ? extra > 0 : null;
        return Fertig(w, h, dpi, raum, alpha, (int)orientierung);
    }

    /// <summary>Nur die Orientierung aus einem EXIF-Block — sie gilt für das JPEG, nicht für das Vorschaubild darin.</summary>
    private static int ExifOrientierung(ReadOnlySpan<byte> b, int start)
    {
        if (!Ordnung(b, start, out var gross)) return 1;
        foreach (var (tag, wert, _, _) in Eintraege(b, start, start + (int)Long(b, start + 4, gross), gross))
            if (tag == 274) return (int)wert;
        return 1;
    }

    /// <summary>Byte-Reihenfolge und Kennung eines TIFF-Blocks: II = klein zuerst, MM = gross zuerst.</summary>
    private static bool Ordnung(ReadOnlySpan<byte> b, int start, out bool gross)
    {
        gross = Ist(b, start, "MM");
        if (!gross && !Ist(b, start, "II")) return false;
        return Word(b, start + 2, gross) == 42;
    }

    /// <summary>Die Einträge eines Verzeichnisses. Ein Eintrag: Tag(2), Typ(2), Anzahl(4), Wert oder Zeiger(4).</summary>
    private static IEnumerable<(int Tag, long Wert, long Offset, int Typ)> Eintraege(ReadOnlySpan<byte> b, int start, int ifd, bool gross)
    {
        var treffer = new List<(int, long, long, int)>();
        if (ifd <= start || ifd + 2 > b.Length) return treffer;
        var anzahl = Word(b, ifd, gross);
        for (var n = 0; n < anzahl; n++)
        {
            var e = ifd + 2 + n * 12;
            if (e + 12 > b.Length) break;
            var typ = Word(b, e + 2, gross);
            var offset = Long(b, e + 8, gross);
            // Kurze Werte stehen im Eintrag selbst, und zwar links — bei „gross zuerst“ also in den ersten zwei Bytes
            var wert = typ == 3 ? Word(b, e + 8, gross) : offset;
            treffer.Add((Word(b, e, gross), wert, start + offset, typ));
        }
        return treffer;
    }

    /// <summary>Ein Bruch (Typ 5): Zähler und Nenner, je vier Bytes, am Ende des Zeigers.</summary>
    private static double Bruch(ReadOnlySpan<byte> b, int start, int offset, bool gross)
    {
        if (offset + 8 > b.Length) return 0;
        var nenner = Long(b, offset + 4, gross);
        return nenner == 0 ? 0 : Long(b, offset, gross) / (double)nenner;
    }
}

/// <summary>Farbräume, wie sie am Medium stehen — so wenige wie ein Kopf hergibt.</summary>
public static class Raeume
{
    public const string Srgb = "srgb";
    public const string Grau = "grau";
    public const string Cmyk = "cmyk";
    public const string Indiziert = "indiziert";
}
