using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Text, der nach Postgres geht. Ein PDF mit kaputter Zeichentabelle bringt Nullbytes mit; <c>text</c> verträgt kein 0x00,
/// und ein einziges davon liess das ganze Dokument scheitern — der Job hakte es als Fehler ab und versuchte es nie
/// wieder. Geprüft wird hier die Säuberung allein, ohne Datenbank.
/// </summary>
public class DocTextTests
{
    [Fact]
    public void Nullbyte_faellt_weg_der_Text_bleibt()
    {
        var mit = "Netzspannungs\0bereich 220 – 240 V";
        var sauber = DocText.Clean(mit);
        Assert.Equal("Netzspannungsbereich 220 – 240 V", sauber);
        Assert.DoesNotContain('\0', sauber!);
    }

    [Fact]
    public void Umbruch_und_Tabulator_bleiben_andere_Steuerzeichen_nicht()
    {
        Assert.Equal("a\tb\nc\rd", DocText.Clean("a\tb\nc\rd"));
        Assert.Equal("ab", DocText.Clean("ab"));       // Klingelzeichen aus einer kaputten Schrift
        Assert.Equal("ab", DocText.Clean("ab"));
    }

    [Fact]
    public void Sauberer_Text_kommt_unveraendert_zurueck()
    {
        const string s = "LCA 50W 350-1050mA DT8 lp PRE — tc 75,0 °C, 12,5 kΩ";
        Assert.Same(s, DocText.Clean(s));   // nichts zu tun: dieselbe Zeichenkette, keine neue
    }

    [Fact]
    public void Leer_bleibt_leer()
    {
        Assert.Null(DocText.Clean(null));
        Assert.Equal("", DocText.Clean(""));
    }
}
