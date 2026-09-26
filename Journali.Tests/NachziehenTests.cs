using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Zwei Server auf einer Datenbank (26.09.2026: journali auf dem Server und auf dem Arbeitsplatz, dasselbe Journal).
/// Jeder wendet bisher nur an, was er selbst schreibt, und liest das Journal sonst nur beim Start — der eine sah vom
/// anderen nichts, bis er neu startete. <see cref="Catalog.Nachziehen"/> holt, was von aussen kam.
/// </summary>
public class NachziehenTests
{
    private static Catalog Server(IJournal j) { var c = new Catalog(j); c.Rebuild(); return c; }

    private static string NeuerKnoten(Catalog c, string name) =>
        c.With((_, _, write) => write("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of(name, name)), null).Stream);

    [Fact]
    public void Was_der_andere_schreibt_kommt_mit_dem_Nachziehen()
    {
        var j = new MemoryJournal();
        var a = Server(j); a.SeedMissing();
        var b = Server(j);
        Assert.Equal(a.Head, b.Head);

        var knoten = NeuerKnoten(a, "Notebooks");
        Assert.True(a.Read(t => t.Nodes.ContainsKey(knoten)));
        Assert.False(b.Read(t => t.Nodes.ContainsKey(knoten)), "B sieht es ohne Nachziehen");
        Assert.True(a.Head > b.Head);

        Assert.Equal(1, b.Nachziehen());
        Assert.True(b.Read(t => t.Nodes.ContainsKey(knoten)), "B sieht es auch nach dem Nachziehen nicht");
        Assert.Equal(a.Head, b.Head);
        Assert.Equal(0, b.Nachziehen());                                  // nichts Neues: nichts zu tun
    }

    [Fact]
    public void Beide_schreiben_abwechselnd_und_bleiben_gleich()
    {
        var j = new MemoryJournal();
        var a = Server(j); a.SeedMissing();
        var b = Server(j); b.Nachziehen();

        var vonA = NeuerKnoten(a, "von A");
        b.Nachziehen();
        var vonB = NeuerKnoten(b, "von B");
        a.Nachziehen();

        foreach (var (name, c) in new[] { ("A", a), ("B", b) })
        {
            Assert.True(c.Read(t => t.Nodes.ContainsKey(vonA)), $"{name} fehlt der Knoten von A");
            Assert.True(c.Read(t => t.Nodes.ContainsKey(vonB)), $"{name} fehlt der Knoten von B");
        }
        Assert.Equal(a.Head, b.Head);
        // und was ein Dritter aus dem Journal baut, ist dasselbe
        var c3 = Server(j);
        Assert.Equal(a.Read(t => t.Nodes.Count), c3.Read(t => t.Nodes.Count));
    }

    /// <summary>Auch Teams und Kontingente ziehen mit: der mitgeführte Stand muss dabei weg.</summary>
    [Fact]
    public void Ein_Team_des_anderen_gilt_nach_dem_Nachziehen()
    {
        var j = new MemoryJournal();
        var a = Server(j); a.SeedMissing();
        var b = Server(j); b.Nachziehen();

        a.With((_, _, write) => write("t", Teams.Stream + "es", Types.TeamDefined, new TeamDefined("Spanien", EntriesWeek: 1234, EntriesMonth: 5678), null));
        Assert.Null(b.With((_, _, _) => b.Teams.Get("es")));

        b.Nachziehen();
        Assert.Equal((1234, 5678), b.With((_, _, _) => (b.Teams.Get("es")!.EntriesWeek, b.Teams.Get("es")!.EntriesMonth)));
    }
}
