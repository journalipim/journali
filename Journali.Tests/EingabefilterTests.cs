using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>Eingabefilter der Demo (07.10.2026): Links, Kontaktdaten, Begriffe der Sperrliste (auch verfremdet) und zu lange Texte werden abgewiesen.</summary>
public class EingabefilterTests
{
    private static readonly Eingabefilter Filter = new(["verboten", "Schlimmwort"]);

    [Theory]
    [InlineData("Leuchte aus Aluminium, 4000 K, E27", false)]
    [InlineData("4006381333931", false)]                 // GTIN: keine Telefonnummer
    [InlineData("Maße 12.5 x 30 cm", false)]
    [InlineData("<p>Strahler für außen</p>", false)]
    [InlineData("mehr unter https://beispiel.example", true)]
    [InlineData("www.irgendwo.org", true)]
    [InlineData("shop.de", true)]
    [InlineData("schreib an a.b@beispiel.de", true)]
    [InlineData("ruf an: +49 170 1234567", true)]
    [InlineData("Tel. 0711 / 123456", true)]
    [InlineData("das ist VERBOTEN", true)]
    [InlineData("v.e-r b0t3n", true)]                    // verfremdet: Zeichen dazwischen, Ziffern als Buchstaben
    [InlineData("Schlímmwört", true)]                     // Akzente und Umlautpunkte fallen weg
    [InlineData("Schlimm-Wort", true)]
    public void Prueft_Texte(string text, bool unzulaessig) => Assert.Equal(unzulaessig, Filter.Unzulaessig(text));

    [Fact]
    public void Zu_lang_ist_unzulaessig() => Assert.True(Filter.Unzulaessig(new string('a', Eingabefilter.MaxText + 1)));

    [Fact]
    public void Im_Schreibpfad_nur_Pflege_Struktur_und_Ausleitung()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        string p = "";
        c.With((_, _, w) => { var g = w("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("G", "G")), null).Stream; p = w("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(g), null).Stream; return 0; });
        c.Eingabefilter = Filter.Unzulaessig;
        Assert.Throws<EingabeException>(() => c.With((_, _, w) => w("demo", p, Types.AttributeSet, new AttributeSet("name", "de", null, "verboten gut", null), null)));
        Assert.Throws<EingabeException>(() => c.WithBatch("demo", "b", (_, _, w) => w("demo", p, Types.AttributeSet, new AttributeSet("name", "de", null, "www.x.de", null), null)));
        c.With((_, _, w) => w("demo", p, Types.AttributeSet, new AttributeSet("name", "de", null, "Strahler", null), null));   // zulässig
        c.With((_, _, w) => w("demo", "user:x", Types.UserDefined, new UserDefined("verboten", null, "demo", true), null));    // Einrichtung: nicht geprüft
        Assert.Equal("Strahler", c.Lesen((_, t) => t.Nodes[p].Values[new Axis("name", "de", null)]));
    }
}
