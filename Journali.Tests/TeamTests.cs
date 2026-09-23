using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Teams (Taloan, 23.09.2026: „je Team gibt es Limits und API-Keys, Benutzer gehören einem Team an“). Geprüft wird vor allem
// das Leck, das Taloan selbst gesehen hat: „dann lege ich mir 20 Teams an und habe 20× Grundrauschen“ — ein Team ohne eigene
// Schlüssel hat kein eigenes Kontingent, es hängt am Zahler.
public class TeamTests
{
    private static Catalog World()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) =>
        {
            write("t", Teams.Stream + "zentral", Types.TeamDefined, new TeamDefined("Zentrale", null, MonthlyTokens: 100_000, DailyTokens: 50_000, IncludedTokens: 200_000), null);
            write("t", Teams.Stream + "es", Types.TeamDefined, new TeamDefined("Spanien", null, KeysFrom: "zentral"), null);
            write("t", Users.Stream + "taloan", Types.UserDefined, new UserDefined("Taloan", null, "admin", true, "zentral"), null);
            write("t", Users.Stream + "pablo", Types.UserDefined, new UserDefined("Pablo", null, "editor", true, "es"), null);
            return 0;
        });
        return c;
    }
    private static void Verbrauch(Catalog c, string team, int tokens, string user = "taloan", string? fuer = null) =>
        c.With((_, _, write) => write(user, Teams.UsageStream + team, Types.AiUsed, new AiUsed("anthropic", "claude-sonnet-5", user, tokens / 2, tokens - tokens / 2, 1, DateOnly.FromDateTime(DateTime.Today).ToString("yyyy-MM-dd"), fuer), null));

    [Fact]
    public void Team_1_ist_das_zuerst_angelegte_und_traegt_das_Grundrauschen()
    {
        var c = World();
        Assert.Equal("zentral", c.With((_, _, _) => c.Teams.Primary!.Key));
        Assert.Equal(200_000, c.With((_, _, _) => c.Teams.Get("zentral")!.IncludedTokens));
        Assert.Equal(0, c.With((_, _, _) => c.Teams.Get("es")!.IncludedTokens));
    }

    [Fact]
    public void Wer_keine_eigenen_Schluessel_hat_haengt_am_Zahler()
    {
        var c = World();
        Assert.Equal("zentral", c.With((_, _, _) => c.Teams.Payer("es")));     // Spanien zahlt nicht selbst
        Assert.Equal("zentral", c.With((_, _, _) => c.Teams.Payer("zentral")));
        Assert.Equal(["es", "zentral"], c.With((_, _, _) => c.Teams.Dependents("zentral").Order().ToArray()));
        // ein weiteres Team am selben Zahler bringt keinen weiteren Freibetrag — der Topf ist derselbe
        c.With((_, _, write) => write("t", Teams.Stream + "fr", Types.TeamDefined, new TeamDefined("Frankreich", null, KeysFrom: "zentral"), null));
        Verbrauch(c, "zentral", 1000, "pablo", fuer: "es");
        Verbrauch(c, "zentral", 500, "taloan");
        Assert.Equal(1500, c.With((_, _, _) => c.Teams.Day("zentral", DateOnly.FromDateTime(DateTime.Today)).Tokens));
        Assert.Equal(0, c.With((_, _, _) => c.Teams.Day("es", DateOnly.FromDateTime(DateTime.Today)).Tokens));   // gezählt wird beim Zahler
    }

    [Fact]
    public void Der_Verbrauch_sagt_wer_und_womit()
    {
        var c = World();
        Verbrauch(c, "zentral", 1000, "pablo", fuer: "es");
        Verbrauch(c, "zentral", 400, "taloan");
        var tag = c.With((_, _, _) => c.Teams.Day("zentral", DateOnly.FromDateTime(DateTime.Today)));
        Assert.Equal(2, tag.Calls);
        Assert.Equal(1400, tag.Tokens);
        Assert.Equal(1000, tag.ByUser["pablo"]);          // die Rechnung ist nachvollziehbar, ohne dass jemand gesperrt wird
        Assert.Equal(400, tag.ByUser["taloan"]);
        Assert.Equal(1400, tag.ByProvider["anthropic"]);
        Assert.Equal(1400, c.With((_, _, _) => c.Teams.Month("zentral", DateTime.Today.ToString("yyyy-MM"))));
    }

    [Fact]
    public void Ein_Team_zurueckziehen_nimmt_die_Stammdaten_nicht_den_Verbrauch()
    {
        var c = World();
        Verbrauch(c, "zentral", 300);
        c.With((_, _, write) => write("t", Teams.Stream + "zentral", Types.TeamRetired, new TeamRetired(), null));
        Assert.Null(c.With((_, _, _) => c.Teams.Get("zentral")));
        Assert.Equal(300, c.With((_, _, _) => c.Teams.Month("zentral", DateTime.Today.ToString("yyyy-MM"))));   // was verbraucht wurde, wurde verbraucht
        Assert.Equal("es", c.With((_, _, _) => c.Teams.Payer("es")));   // der Zahler ist weg: Spanien steht wieder für sich
    }

    [Fact]
    public void Der_Benutzer_traegt_sein_Team_und_faellt_sonst_auf_Team_1()
    {
        var c = World();
        Assert.Equal("es", c.With((_, _, _) => c.Users.All["pablo"].Team));
        Assert.Equal("es", TeamApi.TeamOf(c, "pablo"));
        c.With((_, _, write) => write("t", Users.Stream + "gast", Types.UserDefined, new UserDefined("Gast", null, "reader"), null));
        Assert.Null(c.With((_, _, _) => c.Users.All["gast"].Team));
        Assert.Equal("zentral", TeamApi.TeamOf(c, "gast"));   // ohne eigenes Team gilt Team 1
        Assert.Equal("zentral", TeamApi.TeamOf(c, null));
    }

    [Fact]
    public void Das_Recht_Team_gibt_es_im_Vokabular_und_der_Team_Admin_im_Saatgut()
    {
        Assert.Contains("team", Rights.All);
        Assert.Equal("Eigenes Team (KI-Schlüssel, Grenzen)", Rights.Label["team"]);
        var saat = Rights.Seeds().ToDictionary(x => x.Key, x => x.Role);
        Assert.Contains("team", saat["teamadmin"].Rights);
        Assert.DoesNotContain("users", saat["teamadmin"].Rights);   // der Team-Admin holt sich keine Mitglieder in die eigene Kasse
        Assert.Contains("team", saat["admin"].Rights);
    }
}
