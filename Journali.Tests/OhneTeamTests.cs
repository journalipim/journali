using Microsoft.AspNetCore.Http;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Ohne Team kein Kontingent, ohne Kontingent keine Änderung (Taloan, 23.09.2026: „wenn ich keinem Team angehöre und
// keine Limits habe gleich 0, kann ich auch keine Änderungen vornehmen — aktuell kann ich es aber“).
// Lesen bleibt erlaubt; das eigene Konto und die Teamverwaltung auch, sonst spielte sich ein teamloser Administrator
// selbst aus dem System.
public class OhneTeamTests
{
    private static Catalog Welt()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) =>
        {
            write("t", Users.Stream + "frei", Types.UserDefined, new UserDefined("Frei", null, "editor"), null);                      // in keinem Team
            write("t", Users.Stream + "taloan", Types.UserDefined, new UserDefined("Taloan", null, "editor", true, Model.InitTeam), null);
            return 0;
        });
        return c;
    }

    private static HttpContext Anfrage(string wer, string method, string pfad)
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Method = method;
        ctx.Request.Path = pfad;
        ctx.Items["user"] = wer;
        return ctx;
    }

    [Fact]
    public void Wer_kein_Team_hat_darf_nichts_aendern()
    {
        var c = Welt();
        Assert.True(Auth.OhneKontingent(Anfrage("frei", "POST", "/api/nodes/n1/attributes"), c));
        Assert.True(Auth.OhneKontingent(Anfrage("frei", "PUT", "/api/model/attributes/farbe"), c));
        Assert.True(Auth.OhneKontingent(Anfrage("frei", "DELETE", "/api/nodes/n1"), c));
    }

    [Fact]
    public void Lesen_bleibt_erlaubt()
    {
        var c = Welt();
        Assert.False(Auth.OhneKontingent(Anfrage("frei", "GET", "/api/nodes/n1"), c));
        Assert.False(Auth.OhneKontingent(Anfrage("frei", "HEAD", "/api/tree"), c));
    }

    [Fact]
    public void Das_eigene_Konto_und_die_Teamverwaltung_bleiben_offen()
    {
        var c = Welt();
        Assert.False(Auth.OhneKontingent(Anfrage("frei", "PUT", "/api/auth/password"), c));
        Assert.False(Auth.OhneKontingent(Anfrage("frei", "PUT", "/api/teams/init"), c));   // sonst sperrt sich ein Administrator aus
    }

    [Fact]
    public void Wer_ein_Team_hat_arbeitet_wie_bisher()
    {
        var c = Welt();
        Assert.False(Auth.OhneKontingent(Anfrage("taloan", "POST", "/api/nodes/n1/attributes"), c));
    }

    [Fact]
    public void Ein_Joblauf_haengt_nicht_an_einer_Mitgliedschaft()
    {
        var c = Welt();
        // Dienst-Token: der Urheber ist job:<key> und steht nicht in den Anwendern
        Assert.False(Auth.OhneKontingent(Anfrage("job:sicherung", "POST", "/api/nodes/n1/attributes"), c));
        // und ohne Anmeldung (offene Anlage) gilt die Sperre ohnehin nicht
        var offen = new DefaultHttpContext(); offen.Request.Method = "POST"; offen.Request.Path = "/api/nodes/n1/attributes";
        Assert.False(Auth.OhneKontingent(offen, c));
    }
}
