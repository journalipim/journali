using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Vorschau ohne eigene Kachel (04.10.2026): der Server liefert die kleinste Ableitung des Jobs derive — sonst rechnete jeder Browser aus dem Original.
public class VorschauErsatzTests
{
    static MediaPreset P(string key, int w, string format = "webp") => new() { Key = key, Width = w, Height = w, Format = format };

    [Fact]
    public void Die_kleinste_passende_Ableitung_ersetzt_die_Vorschau_eine_veraltete_nicht()
    {
        var presets = new Dictionary<string, MediaPreset> { ["kachel"] = P("kachel", 256), ["web"] = P("web", 1200), ["druck"] = P("druck", 3000, "jpeg") };
        var m = new Medium { Id = "m-1", Sha256 = "abc", Bytes = 50_000_000, Mime = "image/tiff", Name = "x.tif" };
        Assert.Null(MediaApi.KleinsteAbleitung(m, presets));                                    // noch nichts gerechnet
        m.Derived["druck"] = new Derived(3000, 2000, 900_000, presets["druck"].Fingerprint, 1);
        m.Derived["web"] = new Derived(1200, 800, 120_000, presets["web"].Fingerprint, 2);
        Assert.Equal("web", MediaApi.KleinsteAbleitung(m, presets)!.Key);
        m.Derived["kachel"] = new Derived(256, 170, 9_000, "128x128/webp/82", 3);                 // nach altem Preset gerechnet: passt nicht mehr
        Assert.Equal("web", MediaApi.KleinsteAbleitung(m, presets)!.Key);
        m.Derived["kachel"] = new Derived(256, 170, 9_000, presets["kachel"].Fingerprint, 4);
        Assert.Equal("kachel", MediaApi.KleinsteAbleitung(m, presets)!.Key);
    }
}
