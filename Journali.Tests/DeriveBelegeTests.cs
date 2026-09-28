using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Eine Runde schreibt einmal, nicht zweihundertmal (28.09.2026). Jede gerechnete Ableitung schrieb ihren Beleg
/// einzeln ins Journal und nahm dafür die Schreibsperre; währenddessen brauchte selbst <c>/api/health</c> 4,5 s
/// statt 1 ms, und die Kacheln der Systemjobs standen still. Die Bytes gehen weiter einzeln in den Speicher — sie
/// sind gross —, die Belege in einem Zug.
/// </summary>
public class DeriveBelegeTests
{
    private static (Catalog C, string Medium) Welt()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        var id = c.With((_, _, write) =>
            write("t", "media:m1", Types.MediaCreated, new MediaCreated("abc123", 1234, "image/jpeg", "bild.jpg"), null).Stream);
        return (c, id);
    }

    [Fact]
    public void Viele_Belege_gehen_als_ein_Stapel_ins_Journal()
    {
        var (c, medium) = Welt();
        var vorher = c.Head;

        // Drei Belege, wie sie eine Runde liefert — ein Aufruf von WriteMany
        var items = new List<(string, string, object)>
        {
            (medium, Types.MediaDerived, new MediaDerived("thumb", 256, 256, 8_000, "fp1")),
            (medium, Types.MediaDerived, new MediaDerived("web", 1200, 900, 60_000, "fp2")),
            (medium, Types.MediaDerived, new MediaDerived("print", 3000, 2250, 400_000, "fp3")),
        };
        var eintraege = c.WriteMany("t", items);

        Assert.Equal(3, eintraege.Count);
        // In einem Zug: fortlaufende Nummern ohne Fremdeintrag dazwischen. WriteMany nimmt die Schreibsperre
        // einmal (lock im Katalog), statt dreimal wie drei einzelne Schreibvorgaenge
        Assert.Equal(eintraege.Select(e => e.Number).OrderBy(n => n).ToList(), eintraege.Select(e => e.Number).ToList());
        Assert.Equal(eintraege[0].Number + 2, eintraege[2].Number);
        Assert.Equal(vorher + 3, c.Head);
    }

    [Fact]
    public void Jeder_Beleg_steht_am_Medium_und_ist_wiederauffindbar()
    {
        var (c, medium) = Welt();
        c.WriteMany("t", [(medium, Types.MediaDerived, new MediaDerived("thumb", 256, 256, 8_000, "fp1"))]);
        var m = c.Lesen((_, _) => c.Media.All.Values.Single());
        Assert.True(m.Derived.ContainsKey("thumb"));
        Assert.Equal(256, m.Derived["thumb"].Width);
        Assert.Equal("fp1", m.Derived["thumb"].Fingerprint);
    }

    [Fact]
    public void Ohne_Beleg_gilt_die_Ableitung_als_fehlend_und_wird_neu_gerechnet()
    {
        // Bricht ein Lauf zwischen dem Ablegen der Bytes und den Belegen ab, bleibt die Ableitung offen.
        // Das ist gewollt: neu rechnen kostet Zeit, ein falscher Beleg kostet Vertrauen
        var (c, medium) = Welt();
        var preset = new MediaPreset { Key = "thumb", Width = 256, Height = 256, Format = "webp", Quality = 80, Auto = true };
        var offen = c.Lesen((_, _) => c.Media.Pending(preset).Count());
        Assert.Equal(1, offen);

        c.WriteMany("t", [(medium, Types.MediaDerived, new MediaDerived("thumb", 256, 256, 8_000, preset.Fingerprint))]);
        Assert.Equal(0, c.Lesen((_, _) => c.Media.Pending(preset).Count()));
    }
}
