using Journali.Core.Entries;

namespace Journali.Tests;

/// <summary>Vorlagen-Attribute (Template): Platzhalter, Zusätze, Abschnitte, die wegfallen, und die Prüfung beim Schreiben (04.10.2026).</summary>
public class TemplateTests
{
    private static Func<string, Template.Slot> Werte(Dictionary<string, Template.Slot> w) => k => w.GetValueOrDefault(k, Template.Slot.None);

    private static readonly Dictionary<string, Template.Slot> Laptop = new()
    {
        ["name"] = new("Laptop", null, null),
        ["cpu"] = new("i7", null, null),
        ["ssd"] = new("512", 512m, "GB"),
        ["weight"] = new("1.24", 1.24m, "kg"),
        ["farbe"] = new("rot", null, null),
        ["text"] = new("<p>sehr <b>leicht</b>&nbsp;und schnell</p>", null, null),
    };

    [Fact]
    public void Ein_Abschnitt_mit_leerem_Platzhalter_faellt_ganz_weg()
    {
        Assert.Equal("Laptop mit i7, 512 GB SSD", Template.Render("{name} mit {cpu}[, {ram} GB RAM][, {ssd|unit} SSD]", Werte(Laptop), "de"));
        Assert.Equal("Laptop mit i7", Template.Render("{name}[ mit {cpu}[ und {ram} GB]]", Werte(Laptop), "de"));   // innen leer: nur der innere fällt weg
        Assert.Equal("Laptop", Template.Render("{name}[ mit {ram}[ und {cpu}]]", Werte(Laptop), "de"));           // aussen leer: alles darin fällt weg
    }

    [Fact]
    public void Nachkommastellen_in_der_Sprache_und_die_Einheit()
    {
        Assert.Equal("1,2 kg", Template.Render("{weight|1|unit}", Werte(Laptop), "de"));
        Assert.Equal("1.2 kg", Template.Render("{weight|1|unit}", Werte(Laptop), "en"));
        Assert.Equal("1,240000", Template.Render("{weight|6}", Werte(Laptop), "de"));
        Assert.Equal("512", Template.Render("{ssd}", Werte(Laptop), "de"));               // ohne |unit keine Einheit
    }

    [Fact]
    public void Gross_klein_Anfang_und_ohne_HTML()
    {
        Assert.Equal("ROT · rot · Rot", Template.Render("{farbe|upper} · {farbe|lower} · {farbe|capitalize}", Werte(Laptop), "de"));
        Assert.Equal("sehr leicht und schnell", Template.Render("{text|plain}", Werte(Laptop), "de"));
    }

    [Fact]
    public void Leerraum_aus_weggefallenen_Abschnitten_wird_bereinigt()
    {
        Assert.Equal("Laptop, rot.", Template.Render("{name} [{ram} ], {farbe} .", Werte(Laptop), "de"));
        Assert.Equal("{name} [x]", Template.Render(@"\{name} \[x\]", Werte(Laptop), "de"));   // maskiert: die Zeichen selbst
        Assert.Null(Template.Render("[{ram}]", Werte(Laptop), "de"));                         // nichts übrig: kein Wert
    }

    [Fact]
    public void Die_Pruefung_nennt_die_Schluessel_oder_den_Fehler()
    {
        var (keys, fehler) = Template.Check("{name}[, {ssd|unit|2}][ {name}]");
        Assert.Equal(["name", "ssd"], keys); Assert.Null(fehler);
        Assert.NotNull(Template.Check(@"\[x]").Error);                                        // ein „]“ ohne „[“ — maskiert wäre es \]
        Assert.Contains("|7", Template.Check("{ssd|7}").Error);
        Assert.Contains("„]“ ohne „[“", Template.Check("{name}]").Error);
        Assert.Contains("„[“ ohne „]“", Template.Check("[{name}").Error);
        Assert.NotNull(Template.Check("{1name}").Error);
    }
}
