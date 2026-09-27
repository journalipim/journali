using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Die offene Postenliste der Texterkennung (27.09.2026): Dokumente im Zustand <c>scan</c>, mit dem Hash, den der
/// Index kennt. Eine neue Fassung (anderer Hash) ist wieder ein Fall des Lesers, nicht des Erkenners; ein gelesenes
/// oder gescheitertes Dokument steht nicht darin.
/// </summary>
public class DocsScansTests
{
    private static Media Mit(params (string Id, string Sha)[] medien)
    {
        var media = new Media(); long n = 0;
        foreach (var (id, sha) in medien)
            media.Apply(new Entry(++n, DateTimeOffset.UtcNow.AddMinutes(n), "t", id, Types.MediaCreated, Types.Serialize(new MediaCreated(sha, 10, "application/pdf", id + ".pdf"))));
        return media;
    }

    [Fact]
    public void Nur_Scans_mit_passendem_Hash()
    {
        var media = Mit(("m1", "aaa"), ("m2", "bbb"), ("m3", "ccc"), ("m4", "ddd"));
        var known = new Dictionary<string, (string Sha, string State)>
        {
            ["m1"] = ("aaa", DocText.States.Scan),     // wartet auf Texterkennung
            ["m2"] = ("alt", DocText.States.Scan),     // neue Fassung seit dem Lesen — erst wieder der Leser
            ["m3"] = ("ccc", DocText.States.Text),     // gelesen
            ["m4"] = ("ddd", DocText.States.Error),    // gescheitert — /docs/retry, nicht der Erkenner
        };
        var scans = DocsApi.Scans(known, media.All.Values, 100);
        Assert.Equal(["m1"], scans.Select(s => s.Id));
        Assert.Equal(("m1.pdf", "application/pdf", "aaa"), (scans[0].Name, scans[0].Mime, scans[0].Sha256));
    }

    [Fact]
    public void Was_der_Index_nicht_kennt_ist_kein_Scan()
    {
        var media = Mit(("m1", "aaa"));
        Assert.Empty(DocsApi.Scans(new Dictionary<string, (string, string)>(), media.All.Values, 100));
    }

    [Fact]
    public void Ein_Bild_mit_Stichwort_Text_erkennen_ist_ein_Scan_bis_der_Index_es_kennt()
    {
        var media = new Media(); long n = 0;
        media.Apply(new Entry(++n, DateTimeOffset.UtcNow, "t", "b1", Types.MediaCreated, Types.Serialize(new MediaCreated("s1", 10, "image/jpeg", "scan.jpg"))));
        media.Apply(new Entry(++n, DateTimeOffset.UtcNow, "t", "b2", Types.MediaCreated, Types.Serialize(new MediaCreated("s2", 10, "image/jpeg", "foto.jpg"))));
        media.Apply(new Entry(++n, DateTimeOffset.UtcNow, "t", "b1", Types.AttributeSet, Types.Serialize(new AttributeSet(Model.KeywordAttribute, null, null, null, [Model.OcrKeyword]))));
        var leer = new Dictionary<string, (string Sha, string State)>();
        Assert.Equal(["b1"], DocsApi.Scans(leer, media.All.Values, 10).Select(s => s.Id));   // das Foto ohne Stichwort nicht
        var erkannt = new Dictionary<string, (string Sha, string State)> { ["b1"] = ("s1", DocText.States.Text) };
        Assert.Empty(DocsApi.Scans(erkannt, media.All.Values, 10));                          // erkannt: erledigt
        var alt = new Dictionary<string, (string Sha, string State)> { ["b1"] = ("anders", DocText.States.Text) };
        Assert.Equal(["b1"], DocsApi.Scans(alt, media.All.Values, 10).Select(s => s.Id));    // neue Fassung: wieder offen
        Assert.Contains(Model.Seeds(), s => s.Type == Types.ListValueDefined && s.Stream == Model.ListStream + Model.KeywordList && s.Payload.Contains("\"ocr\""));
    }

    [Fact]
    public void Aelteste_zuerst_und_begrenzt()
    {
        var media = Mit(("m1", "a"), ("m2", "b"), ("m3", "c"));
        var known = media.All.Keys.ToDictionary(k => k, k => (media.All[k].Sha256, DocText.States.Scan));
        Assert.Equal(["m1", "m2"], DocsApi.Scans(known, media.All.Values, 2).Select(s => s.Id));
    }
}
