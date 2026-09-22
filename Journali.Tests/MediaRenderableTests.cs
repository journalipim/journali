using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;

namespace Journali.Tests;

/// <summary>
/// Wer bekommt eine Vorschau (Taloan, 23.09.2026: „bau die pdf thumbs“)? Bilder schon immer, ein PDF seit heute — seine
/// erste Seite wird die Kachel. Ein PDF bleibt dabei ein Dokument: die Bibliothek gruppiert weiter nach
/// <see cref="Medium.IsImage"/>, nur das Rechnen richtet sich nach <see cref="Medium.IsRenderable"/>.
/// </summary>
public class MediaRenderableTests
{
    private static Media Mit(params (string Id, string Mime)[] medien)
    {
        var media = new Media();
        long n = 0;
        foreach (var (id, mime) in medien)
            media.Apply(new Entry(++n, DateTimeOffset.UtcNow, "test", id, Types.MediaCreated, Types.Serialize(new MediaCreated("sha-" + id, 1234, mime, id + ".datei"))));
        return media;
    }

    private static MediaPreset Thumb(Media media)
    {
        media.Apply(new Entry(999, DateTimeOffset.UtcNow, "test", Media.PresetStream + Media.ThumbPreset, Types.MediaPresetDefined,
            Types.Serialize(new MediaPresetDefined(Labels.Of("Kachel", "Tile"), 256, 256, "webp", 80))));
        return media.Presets[Media.ThumbPreset];
    }

    [Fact]
    public void Ein_PDF_ist_kein_Bild_aber_bekommt_eine_Vorschau()
    {
        var media = Mit(("m1", "application/pdf"));
        var pdf = media.All["m1"];
        Assert.False(pdf.IsImage);
        Assert.True(pdf.IsRenderable);
    }

    [Fact]
    public void Andere_Dokumente_bekommen_keine()
    {
        var media = Mit(("m1", "text/html"), ("m2", "application/vnd.ms-excel"), ("m3", "image/jpeg"));
        Assert.False(media.All["m1"].IsRenderable);
        Assert.False(media.All["m2"].IsRenderable);
        Assert.True(media.All["m3"].IsRenderable);
    }

    [Fact]
    public void Der_Job_bekommt_das_PDF_zum_Rechnen()
    {
        var media = Mit(("bild", "image/jpeg"), ("blatt", "application/pdf"), ("tabelle", "text/csv"));
        var offen = media.Pending(Thumb(media)).Select(m => m.Id).Order().ToList();
        Assert.Equal(["bild", "blatt"], offen);
    }

    [Fact]
    public void Gerechnetes_faellt_aus_dem_Stapel()
    {
        var media = Mit(("blatt", "application/pdf"));
        var preset = Thumb(media);
        media.Apply(new Entry(1000, DateTimeOffset.UtcNow, "test", "blatt", Types.MediaDerived,
            Types.Serialize(new MediaDerived(Media.ThumbPreset, 181, 256, 4096, preset.Fingerprint))));
        Assert.Empty(media.Pending(preset));
        Assert.True(media.HasDerived(media.All["blatt"], preset));
    }
}
