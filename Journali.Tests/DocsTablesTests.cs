using System.Text.Json;
using Journali.Core.Entries;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Tabellen aus einem Dokument (27.09.2026, 34 L): was der Leser abliefert, wird bereinigt — nur Zeilen mit zwei Zellen
/// sind Schlüssel/Wert —, die feste Gruppe „aus Dokument“ ist Saatgut, und der Rumpf des PUT nimmt <c>tables</c> an.
/// </summary>
public class DocsTablesTests
{
    [Fact]
    public void Nur_Zeilen_mit_Schluessel_und_Wert_und_nur_Tabellen_mit_Zeilen()
    {
        var roh = new List<DocText.Table>
        {
            new(0, 1, "Technische Daten", [["Gewicht", "1,2 kg"], ["Seite 1 von 3"], ["", "ohne Schlüssel"], ["Breite", "22", "mm"]]),
            new(1, 2, null, [["nur eine Zelle"]]),
            new(2, 2, "Leer", []),
        };
        var t = DocsApi.Tabellen(roh);
        Assert.Single(t);
        Assert.Equal(0, t[0].Seq);
        Assert.Equal([["Gewicht", "1,2 kg"], ["Breite", "22", "mm"]], t[0].Rows);
        Assert.Equal("Technische Daten", t[0].Heading);
        Assert.Empty(DocsApi.Tabellen(null));
    }

    [Fact]
    public void Tabellen_werden_neu_durchnummeriert()
    {
        var roh = new List<DocText.Table> { new(4, 1, null, [["a", "1"]]), new(9, 3, null, [["b", "2"]]) };
        Assert.Equal([0, 1], DocsApi.Tabellen(roh).Select(t => t.Seq));
    }

    [Fact]
    public void Der_Rumpf_des_PUT_nimmt_tables_an_und_ohne_bleibt_er_wie_er_war()
    {
        var opt = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var mit = JsonSerializer.Deserialize<DocsApi.PutBody>("""{"sha256":"abc","chunks":[],"state":"text","pages":2,"tables":[{"seq":0,"page":1,"heading":"Daten","rows":[["Gewicht","1,2 kg"]]}]}""", opt)!;
        Assert.NotNull(mit.Tables);
        Assert.Equal("Gewicht", mit.Tables![0].Rows[0][0]);
        var ohne = JsonSerializer.Deserialize<DocsApi.PutBody>("""{"sha256":"abc","chunks":[],"state":"text"}""", opt)!;
        Assert.Null(ohne.Tables);   // der alte Leser liefert keine — das ist kein Fehler
    }

    [Fact]
    public void Die_Gruppe_aus_Dokument_ist_Saatgut()
    {
        var seeds = Model.Seeds().Where(s => s.Type == Types.AttributeGroupDefined).Select(s => Types.Deserialize<AttributeGroupDefinition>(s.Payload)).ToList();
        var g = Assert.Single(seeds, x => x.Key == Model.DocGroup);
        Assert.Equal("from_document", g.Key);
        Assert.Equal("aus Dokument", g.Label["de"]);
    }
}
