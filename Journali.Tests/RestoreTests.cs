using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;

namespace Journali.Tests;

/// <summary>
/// Eine Sicherung zurückspielen.
/// Entscheidend ist, dass nichts Neues entsteht: die Einträge kommen mit ihren Nummern, Zeiten und Urhebern zurück,
/// und die Abbilder ergeben denselben Stand. Sonst wäre es eine Kopie, keine Wiederherstellung.
/// </summary>
public class RestoreTests
{
    private static MemoryJournal Gefuellt()
    {
        var j = new MemoryJournal();
        foreach (var s in Model.Seeds()) j.Append("system", s.Stream, s.Type, s.Payload);
        var g = Ids.New(Roles.Group);
        j.Append("u1", g, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("Leuchten", "Luminaires"))));
        var p = Ids.New(Roles.Product);
        j.Append("u1", p, Types.ProductCreated, Types.Serialize(new ProductCreated(g)));
        j.Append("u1", p, Types.StatusSet, Types.Serialize(new StatusSet("active")), "b-1");
        return j;
    }

    [Fact]
    public void Die_Eintraege_kommen_unveraendert_zurueck()
    {
        var alt = Gefuellt();
        var sicherung = alt.ReadAfter(0).ToList();

        var neu = new MemoryJournal();
        var n = neu.RestoreAll(sicherung);

        Assert.Equal(sicherung.Count, n);
        Assert.Equal(alt.Head, neu.Head);
        Assert.Equal(sicherung, neu.ReadAfter(0).ToList());   // Nummer, Zeit, Urheber, Stapel, Art — alles gleich
    }

    [Fact]
    public void Die_Abbilder_ergeben_denselben_Stand()
    {
        var alt = Gefuellt();
        var neu = new MemoryJournal();
        neu.RestoreAll(alt.ReadAfter(0).ToList());

        var (baumA, baumB) = (new Tree(), new Tree());
        var (modellA, modellB) = (new ModelCatalog(), new ModelCatalog());
        Projector.CatchUp(alt, modellA); Projector.CatchUp(alt, baumA);
        Projector.CatchUp(neu, modellB); Projector.CatchUp(neu, baumB);

        Assert.Equal(baumA.Nodes.Count, baumB.Nodes.Count);
        Assert.Equal(baumA.Nodes.Keys.Order(), baumB.Nodes.Keys.Order());
        Assert.Equal(modellA.Attributes.Count, modellB.Attributes.Count);
        foreach (var (id, a) in baumA.Nodes) Assert.Equal(a.Status, baumB.Nodes[id].Status);
    }

    [Fact]
    public void In_ein_volles_Journal_wird_nicht_wiederhergestellt()
    {
        var alt = Gefuellt();
        var voll = Gefuellt();
        var fehler = Assert.Throws<InvalidOperationException>(() => voll.RestoreAll(alt.ReadAfter(0).ToList()));
        Assert.Contains("nicht leer", fehler.Message);
        Assert.Equal(alt.Head, voll.Head);   // nichts angefasst
    }

    [Fact]
    public void Nach_der_Wiederherstellung_geht_es_normal_weiter()
    {
        var alt = Gefuellt();
        var neu = new MemoryJournal();
        neu.RestoreAll(alt.ReadAfter(0).ToList());

        var weiter = neu.Append("u1", Ids.New(Roles.Group), Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("Neu", "New"))));
        Assert.Equal(alt.Head + 1, weiter.Number);   // die Zählung läuft weiter, nicht von vorn
    }
}
