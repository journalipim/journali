using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Was im Kopf einer Datei steht, liest der Server selbst — ohne Paket (<see cref="MediaProbe"/>). Geprüft wird
/// an gebauten Köpfen: jedes Format an der Stelle, an der es sein Mass trägt, dazu die EXIF-Orientierung, die
/// Breite und Höhe tauscht, wenn das Bild quer steht. Ein unbekanntes Format ergibt null — der Aufrufer hält
/// dann 0 × 0 fest, damit der offene Posten nicht offen bleibt.
/// </summary>
public class MediaProbeTests
{
    // ---- Köpfe bauen. Nur so viel, wie der Leser anfasst.
    private static void Be16(List<byte> b, int v) { b.Add((byte)(v >> 8)); b.Add((byte)v); }
    private static void Be32(List<byte> b, long v) { b.Add((byte)(v >> 24)); b.Add((byte)(v >> 16)); b.Add((byte)(v >> 8)); b.Add((byte)v); }
    private static void Le16(List<byte> b, int v) { b.Add((byte)v); b.Add((byte)(v >> 8)); }
    private static void Le24(List<byte> b, int v) { b.Add((byte)v); b.Add((byte)(v >> 8)); b.Add((byte)(v >> 16)); }
    private static void Le32(List<byte> b, long v) { b.Add((byte)v); b.Add((byte)(v >> 8)); b.Add((byte)(v >> 16)); b.Add((byte)(v >> 24)); }
    private static void Text(List<byte> b, string s) { foreach (var c in s) b.Add((byte)c); }

    private static byte[] Png(int w, int h, int farbtyp = 6, int ppuMeter = 0)
    {
        var b = new List<byte> { 0x89 };
        Text(b, "PNG"); b.AddRange(new byte[] { 0x0D, 0x0A, 0x1A, 0x0A });
        Be32(b, 13); Text(b, "IHDR"); Be32(b, w); Be32(b, h);
        b.Add(8); b.Add((byte)farbtyp); b.Add(0); b.Add(0); b.Add(0);
        Be32(b, 0);                                            // CRC — der Leser prüft ihn nicht
        if (ppuMeter > 0) { Be32(b, 9); Text(b, "pHYs"); Be32(b, ppuMeter); Be32(b, ppuMeter); b.Add(1); Be32(b, 0); }
        Be32(b, 0); Text(b, "IEND"); Be32(b, 0);
        return b.ToArray();
    }

    /// <summary>Ein TIFF-Block, wie er allein in einer Datei oder im EXIF-Segment eines JPEG steht.</summary>
    private static List<byte> TiffBlock(params (int Tag, int Typ, int Wert)[] tags)
    {
        var b = new List<byte>();
        Text(b, "II"); Le16(b, 42); Le32(b, 8);                 // klein zuerst, Verzeichnis gleich dahinter
        Le16(b, tags.Length);
        foreach (var (tag, typ, wert) in tags)
        {
            Le16(b, tag); Le16(b, typ); Le32(b, 1);
            // Kurze Werte stehen im Eintrag: bei „klein zuerst“ in den ersten Bytes, der Rest ist Füllung
            if (typ == 3) { Le16(b, wert); Le16(b, 0); } else Le32(b, wert);
        }
        Le32(b, 0);                                            // kein weiteres Verzeichnis
        return b;
    }

    private static byte[] Jpeg(int w, int h, int komponenten = 3, int dichte = 0, int orientierung = 0)
    {
        var b = new List<byte> { 0xFF, 0xD8 };
        if (dichte > 0)
        {
            b.Add(0xFF); b.Add(0xE0); Be16(b, 16);
            Text(b, "JFIF"); b.Add(0);
            Be16(b, 0x0101); b.Add(1);                         // Fassung, Einheit 1 = Punkte je Zoll
            Be16(b, dichte); Be16(b, dichte); b.Add(0); b.Add(0);
        }
        if (orientierung > 0)
        {
            var tiff = TiffBlock((274, 3, orientierung));
            b.Add(0xFF); b.Add(0xE1); Be16(b, 2 + 6 + tiff.Count);
            Text(b, "Exif"); b.Add(0); b.Add(0);
            b.AddRange(tiff);
        }
        b.Add(0xFF); b.Add(0xC0); Be16(b, 8 + 3 * komponenten);
        b.Add(8); Be16(b, h); Be16(b, w); b.Add((byte)komponenten);
        for (var i = 0; i < komponenten; i++) { b.Add((byte)(i + 1)); b.Add(0x11); b.Add(0); }
        b.Add(0xFF); b.Add(0xDA);                              // ab hier Bilddaten
        return b.ToArray();
    }

    private static byte[] Gif(int w, int h)
    {
        var b = new List<byte>(); Text(b, "GIF89a"); Le16(b, w); Le16(b, h); b.Add(0); b.Add(0); b.Add(0);
        return b.ToArray();
    }

    private static byte[] Bmp(int w, int h)
    {
        var b = new List<byte>(); Text(b, "BM"); Le32(b, 0); Le32(b, 0); Le32(b, 0); Le32(b, 40); Le32(b, w); Le32(b, h);
        return b.ToArray();
    }

    private static byte[] WebpVp8x(int w, int h, bool alpha)
    {
        var b = new List<byte>(); Text(b, "RIFF"); Le32(b, 0); Text(b, "WEBP"); Text(b, "VP8X"); Le32(b, 10);
        b.Add((byte)(alpha ? 0x10 : 0x00)); b.Add(0); b.Add(0); b.Add(0);
        Le24(b, w - 1); Le24(b, h - 1);
        return b.ToArray();
    }

    private static byte[] Tiff(params (int Tag, int Typ, int Wert)[] tags) => TiffBlock(tags).ToArray();

    // ---- Die Formate

    [Fact]
    public void PNG_mit_Alphakanal_und_Auflösung()
    {
        // 11811 Punkte je Meter sind 300 je Zoll
        var p = MediaProbe.Lies(Png(1920, 1080, farbtyp: 6, ppuMeter: 11811));
        Assert.NotNull(p);
        Assert.Equal((1920, 1080), (p!.Width, p.Height));
        Assert.Equal(300, p.Dpi);
        Assert.Equal(Raeume.Srgb, p.Space);
        Assert.True(p.Alpha);
    }

    [Fact]
    public void PNG_ohne_pHYs_hat_keine_Auflösung()
    {
        var p = MediaProbe.Lies(Png(10, 20, farbtyp: 2));
        Assert.Equal((10, 20), (p!.Width, p.Height));
        Assert.Null(p.Dpi);
        Assert.False(p.Alpha);
    }

    [Fact]
    public void PNG_mit_Palette_ist_indiziert()
        => Assert.Equal(Raeume.Indiziert, MediaProbe.Lies(Png(4, 4, farbtyp: 3))!.Space);

    [Fact]
    public void JPEG_mit_JFIF_Auflösung()
    {
        var p = MediaProbe.Lies(Jpeg(4000, 3000, dichte: 72));
        Assert.Equal((4000, 3000), (p!.Width, p.Height));
        Assert.Equal(72, p.Dpi);
        Assert.Equal(Raeume.Srgb, p.Space);
    }

    [Fact]
    public void JPEG_mit_vier_Komponenten_ist_CMYK()
        => Assert.Equal(Raeume.Cmyk, MediaProbe.Lies(Jpeg(100, 100, komponenten: 4))!.Space);

    [Fact]
    public void JPEG_mit_einer_Komponente_ist_Grau()
        => Assert.Equal(Raeume.Grau, MediaProbe.Lies(Jpeg(100, 100, komponenten: 1))!.Space);

    /// <summary>
    /// Steht ein Bild nach EXIF quer (5 bis 8), sind Breite und Höhe getauscht. Die Bibliothek nennt damit
    /// dasselbe Mass wie die Ableitung, denn das Plugin derive dreht mit rotate() ebenso.
    /// </summary>
    [Theory]
    [InlineData(1, 4000, 3000)]
    [InlineData(3, 4000, 3000)]
    [InlineData(6, 3000, 4000)]
    [InlineData(8, 3000, 4000)]
    public void Die_EXIF_Orientierung_dreht_das_Mass(int orientierung, int breite, int hoehe)
    {
        var p = MediaProbe.Lies(Jpeg(4000, 3000, orientierung: orientierung));
        Assert.Equal((breite, hoehe), (p!.Width, p.Height));
    }

    [Fact]
    public void GIF_und_BMP()
    {
        Assert.Equal((320, 240), MediaProbe.Lies(Gif(320, 240)) is { } g ? (g.Width, g.Height) : (0, 0));
        Assert.Equal((64, 48), MediaProbe.Lies(Bmp(64, 48)) is { } b ? (b.Width, b.Height) : (0, 0));
    }

    [Fact]
    public void BMP_von_oben_nach_unten_hat_negative_Höhe()
        => Assert.Equal(48, MediaProbe.Lies(Bmp(64, -48))!.Height);

    [Fact]
    public void WebP_nennt_Mass_und_Transparenz()
    {
        var p = MediaProbe.Lies(WebpVp8x(1200, 630, alpha: true));
        Assert.Equal((1200, 630), (p!.Width, p.Height));
        Assert.True(p.Alpha);
        Assert.False(MediaProbe.Lies(WebpVp8x(8, 8, alpha: false))!.Alpha);
    }

    [Fact]
    public void TIFF_mit_CMYK_und_gedrehtem_Mass()
    {
        // 262 = Farbdeutung (5 = CMYK), 274 = Orientierung (8 = quer), 296 = Einheit (2 = Zoll)
        var p = MediaProbe.Lies(Tiff((256, 4, 4000), (257, 4, 3000), (262, 3, 5), (274, 3, 8), (296, 3, 2)));
        Assert.Equal((3000, 4000), (p!.Width, p.Height));
        Assert.Equal(Raeume.Cmyk, p.Space);
    }

    [Fact]
    public void Ein_unbekanntes_Format_ergibt_nichts()
    {
        Assert.Null(MediaProbe.Lies(new byte[] { 0x50, 0x4B, 0x03, 0x04, 1, 2, 3, 4 }));   // ZIP
        Assert.Null(MediaProbe.Lies(System.Text.Encoding.UTF8.GetBytes("%PDF-1.7\n")));
        Assert.Null(MediaProbe.Lies([]));
    }

    [Fact]
    public void Ein_abgeschnittener_Kopf_bringt_den_Leser_nicht_um()
    {
        var voll = Png(800, 600);
        for (var n = 0; n < voll.Length; n++) MediaProbe.Lies(voll.AsSpan(0, n));   // wirft nicht
        Assert.Null(MediaProbe.Lies(voll.AsSpan(0, 20)));                           // IHDR noch nicht da
    }

    [Fact]
    public async Task Der_Kopf_wird_nur_bis_zur_Grenze_gelesen()
    {
        var daten = new byte[MediaProbe.Kopf + 1000];
        Png(1, 1).CopyTo(daten, 0);
        var kopf = await MediaProbe.KopfAsync(new MemoryStream(daten));
        Assert.Equal(MediaProbe.Kopf, kopf.Length);
        var kurz = await MediaProbe.KopfAsync(new MemoryStream(new byte[7]));
        Assert.Equal(7, kurz.Length);
    }
}

/// <summary>
/// Was das Abbild aus den zwei neuen Einträgen macht: das Mass am Medium, die Herkunft, und die Zeit des
/// Anlegens als Importdatum. Dazu die offene Postenliste — sie ist eine Frage an das Abbild, kein Bestand,
/// und übersteht darum jeden Neustart.
/// </summary>
public class MediumHerkunftTests
{
    private static long _n;
    private static Entry E(string stream, string type, object payload, string actor = "test", DateTimeOffset? at = null)
        => new(++_n, at ?? DateTimeOffset.UtcNow, actor, stream, type, Types.Serialize(payload));

    private static Media Mit(string id, string mime = "image/jpeg", string actor = "test", DateTimeOffset? at = null)
    {
        var media = new Media();
        media.Apply(E(id, Types.MediaCreated, new MediaCreated("sha-" + id, 5000, mime, id + ".jpg"), actor, at));
        return media;
    }

    [Fact]
    public void Das_Anlegen_haelt_Zeit_und_Urheber_fest()
    {
        var wann = new DateTimeOffset(2026, 9, 27, 8, 30, 0, TimeSpan.Zero);
        var m = Mit("m1", actor: "job:ixp", at: wann).All["m1"];
        Assert.Equal(wann, m.CreatedAt);
        Assert.Equal("job:ixp", m.CreatedBy);
    }

    [Fact]
    public void Das_Mass_kommt_an_das_Medium()
    {
        var media = Mit("m1");
        Assert.Null(media.All["m1"].Probe);
        Assert.Equal(0, media.All["m1"].Pixels);
        media.Apply(E("m1", Types.MediaProbed, new MediaProbed(4000, 3000, 300, "srgb", false)));
        var m = media.All["m1"];
        Assert.Equal((4000, 3000), (m.Probe!.Width, m.Probe.Height));
        Assert.Equal(12_000_000, m.Pixels);
    }

    [Fact]
    public void Die_offene_Postenliste_steht_im_Abbild()
    {
        var media = Mit("m1");
        media.Apply(E("m2", Types.MediaCreated, new MediaCreated("sha-m2", 10, "application/zip", "m2.zip")));
        Assert.Equal(["m1", "m2"], media.Unprobed().Select(m => m.Id).Order());
        media.Apply(E("m1", Types.MediaProbed, new MediaProbed(10, 10)));
        media.Apply(E("m2", Types.MediaProbed, new MediaProbed(0, 0)));   // kein bekanntes Format
        Assert.Empty(media.Unprobed());
        Assert.Equal(["m2"], media.Unknown().Select(m => m.Id));
    }

    [Fact]
    public void Die_Herkunft_sagt_Schnittstelle_Profil_und_Bezug()
    {
        var media = Mit("m1");
        Assert.Null(media.All["m1"].Source);
        media.Apply(E("m1", Types.MediaSourced, new MediaSourced("ixp", "import:lieferant", "ixp", "https://example.invalid/bild.jpg")));
        var q = media.All["m1"].Source!;
        Assert.Equal(("ixp", "import:lieferant", "ixp"), (q.Plugin, q.Profile, q.Job));
        Assert.Equal("https://example.invalid/bild.jpg", q.Ref);
    }

    /// <summary>Ein zweiter Eintrag ergänzt die Herkunft — er löscht nicht, was schon dastand.</summary>
    [Fact]
    public void Eine_nachgetragene_Herkunft_ergaenzt()
    {
        var media = Mit("m1");
        media.Apply(E("m1", Types.MediaSourced, new MediaSourced(Plugin: "csv")));
        media.Apply(E("m1", Types.MediaSourced, new MediaSourced(Profile: "import:abc", Ref: "bilder/1.jpg")));
        var q = media.All["m1"].Source!;
        Assert.Equal(("csv", "import:abc", "bilder/1.jpg"), (q.Plugin, q.Profile, q.Ref));
    }

    /// <summary>Ein Zuschnitt ist ein neues Medium — <c>From</c> hält fest, woraus es entstand.</summary>
    [Fact]
    public void Die_Abstammung_nennt_das_Medium_davor()
    {
        var media = Mit("m1");
        media.Apply(E("m2", Types.MediaCreated, new MediaCreated("sha-m2", 900, "image/webp", "zuschnitt.webp")));
        media.Apply(E("m2", Types.MediaSourced, new MediaSourced(From: "m1")));
        Assert.Equal("m1", media.All["m2"].Source!.From);
        Assert.Null(media.All["m1"].Source);
    }

    /// <summary>Beides kostet kein Kontingent: es sind Eigenschaften der Datei, kein gepflegter Wert.</summary>
    [Fact]
    public void Mass_und_Herkunft_zaehlen_nicht_gegen_das_Kontingent()
    {
        Assert.False(Kinds.Billable(null, Types.MediaProbed));
        Assert.False(Kinds.Billable(null, Types.MediaSourced));
        Assert.Equal(Kinds.Ops, Kinds.Of(Types.MediaProbed));
        Assert.Equal(Kinds.Ops, Kinds.Of(Types.MediaSourced));
        Assert.True(Kinds.Billable(null, Types.MediaCreated));   // das Anlegen selbst zählt weiter
    }

    /// <summary>Der Katalog baut das Abbild aus dem Journal — beide Typen müssen den Neubau überleben.</summary>
    [Fact]
    public void Nach_dem_Neubau_steht_alles_wieder_da()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        var id = c.With((_, _, write) => write("test", Ids.Media(), Types.MediaCreated, new MediaCreated("sha-x", 7, "image/png", "x.png"), null).Stream);
        c.With((_, _, write) =>
        {
            write("test", id, Types.MediaProbed, new MediaProbed(800, 600, 96, "srgb", true), null);
            write("test", id, Types.MediaSourced, new MediaSourced("json", "import:x", "nacht", "http://example.invalid/x.png"), null);
            return 0;
        });
        c.Rebuild();
        var m = c.With((_, _, _) => c.Media.All[id]);
        Assert.Equal(480_000, m.Pixels);
        Assert.Equal("json", m.Source!.Plugin);
        Assert.Equal("srgb", m.Probe!.Space);
    }
}
