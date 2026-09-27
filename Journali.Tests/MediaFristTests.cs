using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Fristen am Medium (27.09.2026): gilt ab, gilt bis — als Werte, und eine Regel im Abbild, die Bibliothek, Knoten
/// und Relationen gleich beantworten. Abgelaufen heisst nicht weg: es fällt aus der Ausleitung, nicht aus dem Journal.
/// </summary>
public class MediaFristTests
{
    private static long _n;
    private static Medium Mit(string? von, string? bis)
    {
        var media = new Media();
        media.Apply(new Entry(++_n, DateTimeOffset.UtcNow, "t", "m1", Types.MediaCreated, Types.Serialize(new MediaCreated("sha", 1, "image/png", "a.png"))));
        if (von is not null) media.Apply(new Entry(++_n, DateTimeOffset.UtcNow, "t", "m1", Types.AttributeSet, Types.Serialize(new AttributeSet(Model.ValidFrom, null, null, von, null))));
        if (bis is not null) media.Apply(new Entry(++_n, DateTimeOffset.UtcNow, "t", "m1", Types.AttributeSet, Types.Serialize(new AttributeSet(Model.ValidUntil, null, null, bis, null))));
        return media.All["m1"];
    }
    private static readonly DateOnly Tag = new(2026, 9, 27);

    [Fact]
    public void Ohne_Frist_gilt_es_immer()
    {
        var m = Mit(null, null);
        Assert.True(m.GueltigAm(Tag)); Assert.False(m.Abgelaufen(Tag));
    }

    [Fact]
    public void Gilt_bis_einschliesslich()
    {
        var m = Mit(null, "2026-09-27");
        Assert.True(m.GueltigAm(Tag));
        Assert.False(m.GueltigAm(Tag.AddDays(1)));
        Assert.True(m.Abgelaufen(Tag.AddDays(1)));
    }

    [Fact]
    public void Gilt_ab_ist_kein_Ablauf()
    {
        var m = Mit("2026-10-01", null);
        Assert.False(m.GueltigAm(Tag));       // noch nicht
        Assert.False(m.Abgelaufen(Tag));      // aber nicht abgelaufen — das ist etwas anderes
        Assert.True(m.GueltigAm(new DateOnly(2026, 10, 1)));
    }

    [Fact]
    public void Ein_Wert_der_kein_Datum_ist_setzt_keine_Frist()
    {
        var m = Mit(null, "irgendwann");
        Assert.True(m.GueltigAm(Tag));
    }

    [Fact]
    public void Das_Saatgut_bringt_die_Attribute_mit()
    {
        var j = new MemoryJournal(); var cat = new ModelCatalog();
        foreach (var e in Model.Seeds()) j.Append("system", e.Stream, e.Type, e.Payload);
        Projector.CatchUpAll(j, cat, new Tree(), new Relations(), new Media());
        Assert.Equal(AttributeTypes.Date, cat.Attributes[Model.ValidFrom].Type);
        Assert.Equal(AttributeTypes.Date, cat.Attributes[Model.ValidUntil].Type);
        Assert.Equal(Model.LicenceList, cat.Attributes["licence"].List);
        Assert.Equal(Model.MediaGroup, cat.Attributes["source"].Group);
        Assert.Empty(cat.Lists[Model.LicenceList].Values);   // die Lizenzen sind die des Kunden
    }
}
