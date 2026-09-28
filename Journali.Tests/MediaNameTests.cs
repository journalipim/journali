using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Der Abruf einer Datei trägt ihren Namen (28.09.2026): vorher hiess jeder Abruf „file.pdf“ — der letzte Teil der
/// Adresse /api/media/{id}/file. inline, nicht attachment: ein PDF öffnet im Browser, der Name gilt beim Speichern.
/// </summary>
public class MediaNameTests
{
    [Fact]
    public void Der_Name_steht_im_Kopf_inline_nicht_als_Anhang()
    {
        var h = MediaApi.Inline("datenblatt.pdf");
        Assert.StartsWith("inline;", h);
        Assert.Contains("filename=\"datenblatt.pdf\"", h);
        Assert.DoesNotContain("attachment", h);
    }

    [Fact]
    public void Umlaute_kommen_als_UTF8_an_und_ASCII_faellt_zurueck()
    {
        var h = MediaApi.Inline("Maßblatt Größe.pdf");
        Assert.Contains("filename=\"Ma_blatt Gr__e.pdf\"", h);
        Assert.Contains("filename*=UTF-8''Ma%C3%9Fblatt%20Gr%C3%B6%C3%9Fe.pdf", h);
    }

    [Fact]
    public void Anfuehrungszeichen_und_Umbrueche_brechen_den_Kopf_nicht()
    {
        var h = MediaApi.Inline("a\"b\r\nc.pdf");
        Assert.Contains("filename=\"a'bc.pdf\"", h);
        Assert.DoesNotContain("\n", h);
    }

    [Fact]
    public void Ohne_Namen_heisst_die_Datei_file()
    {
        Assert.Contains("filename=\"file\"", MediaApi.Inline(null));
        Assert.Contains("filename=\"file\"", MediaApi.Inline("  "));
    }
}
