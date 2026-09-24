using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Ohne Kontingent keine Pflege.
// Die Sperre sitzt am Schreibpfad, weil erst dort feststeht, ob ein Eintrag zählt: Datenpflege und Ausleitung kosten,
// Modellieren, Strukturieren, Kataloge, Einrichtung und Betrieb nicht.
public class OhneTeamTests
{
    private static Catalog Welt()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) =>
        {
            write("t", Users.Stream + "frei", Types.UserDefined, new UserDefined("Frei", null, "editor"), null);                      // in keinem Team
            write("t", Users.Stream + "u1", Types.UserDefined, new UserDefined("U1", null, "editor", true, Model.InitTeam), null);
            return 0;
        });
        return c;
    }

    /// <summary>Einen Eintrag schreiben, wie es die API täte — liefert true, wenn er durchgeht.</summary>
    private static bool Schreibt(Catalog c, string actor, string type, object payload, string stream = "n-test")
    {
        try { c.With((_, _, write) => write(actor, stream, type, payload, null)); return true; }
        catch (KeinKontingentException) { return false; }
    }

    [Fact]
    public void Wer_kein_Team_hat_pflegt_nicht()
    {
        var c = Welt();
        Assert.False(Schreibt(c, "frei", Types.AttributeSet, new AttributeSet("name", "de", null, "x")));
        Assert.False(Schreibt(c, "frei", Types.StatusSet, new StatusSet("released")));
        Assert.False(Schreibt(c, "frei", Types.ReleaseGranted, new ReleaseGranted("web", null)));
        // einen Knoten benennen ist Pflege
        Assert.False(Schreibt(c, "frei", Types.NodeNamed, new NodeNamed("neu")));
    }

    [Fact]
    public void Was_nichts_kostet_geht_auch_ohne_Team()
    {
        // Modell, Struktur, Einrichtung: sie schreiben ins Journal, zählen aber nicht (Kinds.Counts)
        var c = Welt();
        Assert.True(Schreibt(c, "frei", Types.GroupCreated, new GroupCreated(null, new Labels(), null), "n-gruppe"));
        Assert.True(Schreibt(c, "frei", Types.NodeMoved, new NodeMoved("g-1")));
        Assert.True(Schreibt(c, "frei", Types.JobDefined, new JobDefined("X", "docs", null, null), Jobs.Stream + "x"));
    }

    [Fact]
    public void Wer_ein_Team_mit_Kontingent_hat_arbeitet_wie_bisher()
    {
        var c = Welt();
        Assert.True(Schreibt(c, "u1", Types.AttributeSet, new AttributeSet("name", "de", null, "x")));
    }

    [Fact]
    public void Ein_Team_ohne_Kontingent_pflegt_auch_nicht()
    {
        // „limits > 0“: ein Team ohne eigene Limits und ohne Zahler hat nichts zu verbrauchen
        var c = Welt();
        c.With((_, _, write) =>
        {
            write("t", Teams.Stream + "es", Types.TeamDefined, new TeamDefined("Spanien"), null);
            write("t", Users.Stream + "pablo", Types.UserDefined, new UserDefined("Pablo", null, "editor", true, "es"), null);
            return 0;
        });
        Assert.False(Schreibt(c, "pablo", Types.AttributeSet, new AttributeSet("name", "de", null, "x")));
        // hängt es an einem Team mit Kontingent, geht es wieder
        c.With((_, _, write) => write("t", Teams.Stream + "es", Types.TeamDefined, new TeamDefined("Spanien", KeysFrom: Model.InitTeam), null));
        Assert.True(Schreibt(c, "pablo", Types.AttributeSet, new AttributeSet("name", "de", null, "x")));
    }

    [Fact]
    public void Ein_aufgebrauchtes_Kontingent_ist_wie_keins()
    {
        // „die Balken sind bei hundert Prozent, der Solr-Import schreibt noch“
        var c = Welt();
        // dem Init Team ein winziges Kontingent geben: drei Einträge die Woche
        c.With((_, _, write) =>
        {
            var t = c.Teams.Get(Model.InitTeam)!;
            write("system", Teams.Stream + Model.InitTeam, Types.TeamDefined,
                new TeamDefined(t.Label, t.Note, t.MonthlyTokens, t.DailyTokens, t.Enabled, t.KeysFrom, t.IncludedTokens, t.Managers, t.Models, 3, 999), null);
            return 0;
        });
        for (var i = 0; i < 3; i++)
            Assert.True(Schreibt(c, "u1", Types.AttributeSet, new AttributeSet("name", "de", null, "w" + i)), $"Eintrag {i} musste noch durchgehen");
        Assert.False(Schreibt(c, "u1", Types.AttributeSet, new AttributeSet("name", "de", null, "zuviel")), "der vierte hätte nicht mehr gedurft");
        // was nichts kostet, geht weiter — das Modell steht nicht still, nur weil die Woche voll ist
        Assert.True(Schreibt(c, "u1", Types.NodeMoved, new NodeMoved("g-1")));
    }

    [Fact]
    public void Jobs_und_das_System_haengen_an_keiner_Mitgliedschaft()
    {
        var c = Welt();
        Assert.True(Schreibt(c, "job:sicherung", Types.AttributeSet, new AttributeSet("name", "de", null, "x")));
        Assert.True(Schreibt(c, "system", Types.AttributeSet, new AttributeSet("name", "de", null, "x")));
    }
}
