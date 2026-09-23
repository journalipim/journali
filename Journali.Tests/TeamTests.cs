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
            write("t", Teams.Stream + Model.InitTeam, Types.TeamDefined, new TeamDefined("Init Team", null, MonthlyTokens: 100_000, DailyTokens: 50_000, IncludedTokens: 200_000), null);
            write("t", Teams.Stream + "es", Types.TeamDefined, new TeamDefined("Spanien", null, KeysFrom: Model.InitTeam), null);
            write("t", Users.Stream + "taloan", Types.UserDefined, new UserDefined("Taloan", null, "admin", true, Model.InitTeam), null);
            write("t", Users.Stream + "pablo", Types.UserDefined, new UserDefined("Pablo", null, "editor", true, "es"), null);
            return 0;
        });
        return c;
    }
    /// <summary>Ein KI-Aufruf mit gemessenem Volumen — hin die Hälfte, zurück der Rest (Taloan, 23.09.2026).</summary>
    private static void Verbrauch(Catalog c, string team, int bytes, string user = "taloan", string? fuer = null, string? anlass = null) =>
        c.With((_, _, write) => write(user, Teams.UsageStream + team, Types.AiUsed, new AiUsed("anthropic", "claude-sonnet-5", user, 0, 0, 1, DateOnly.FromDateTime(DateTime.Today).ToString("yyyy-MM-dd"), fuer, bytes / 2, bytes - bytes / 2, anlass), null));

    [Fact]
    public void Team_1_ist_das_zuerst_angelegte_und_traegt_das_Grundrauschen()
    {
        var c = World();
        Assert.Equal(Model.InitTeam, c.With((_, _, _) => c.Teams.Primary!.Key));
        Assert.Equal(200_000, c.With((_, _, _) => c.Teams.Get(Model.InitTeam)!.IncludedTokens));
        Assert.Equal(0, c.With((_, _, _) => c.Teams.Get("es")!.IncludedTokens));
    }

    [Fact]
    public void Wer_keine_eigenen_Schluessel_hat_haengt_am_Zahler()
    {
        var c = World();
        Assert.Equal(Model.InitTeam, c.With((_, _, _) => c.Teams.Payer("es")));     // Spanien zahlt nicht selbst
        Assert.Equal(Model.InitTeam, c.With((_, _, _) => c.Teams.Payer(Model.InitTeam)));
        Assert.Equal(["es", "init"], c.With((_, _, _) => c.Teams.Dependents(Model.InitTeam).Order().ToArray()));
        // ein weiteres Team am selben Zahler bringt keinen weiteren Freibetrag — der Topf ist derselbe
        c.With((_, _, write) => write("t", Teams.Stream + "fr", Types.TeamDefined, new TeamDefined("Frankreich", null, KeysFrom: Model.InitTeam), null));
        Verbrauch(c, Model.InitTeam, 1000, "pablo", fuer: "es");
        Verbrauch(c, Model.InitTeam, 500, "taloan");
        Assert.Equal(1500, c.With((_, _, _) => c.Teams.Day(Model.InitTeam, DateOnly.FromDateTime(DateTime.Today)).Bytes));
        Assert.Equal(0, c.With((_, _, _) => c.Teams.Day("es", DateOnly.FromDateTime(DateTime.Today)).Bytes));   // gemessen wird beim Zahler
    }

    [Fact]
    public void Das_Volumen_sagt_wer_womit_und_wofuer()
    {
        var c = World();
        Verbrauch(c, Model.InitTeam, 1000, "pablo", fuer: "es", anlass: "uebersetzung");
        Verbrauch(c, Model.InitTeam, 400, "taloan", anlass: "editor");
        var tag = c.With((_, _, _) => c.Teams.Day(Model.InitTeam, DateOnly.FromDateTime(DateTime.Today)));
        Assert.Equal(2, tag.Calls);
        Assert.Equal(1400, tag.Bytes);
        Assert.Equal(700, tag.BytesIn);                   // hin und zurück getrennt — journali misst beides selbst
        Assert.Equal(700, tag.BytesOut);
        Assert.Equal(0, tag.In);                          // Tokenzahlen des Anbieters schreibt journali nicht mehr
        Assert.Equal(1000, tag.ByUser["pablo"]);
        Assert.Equal(400, tag.ByUser["taloan"]);
        Assert.Equal(1400, tag.ByProvider["anthropic"]);
        Assert.Equal(1000, tag.ByPurpose["uebersetzung"]);
        Assert.Equal(1400, c.With((_, _, _) => c.Teams.Month(Model.InitTeam, DateTime.Today.ToString("yyyy-MM"))));
    }

    [Fact]
    public void Ein_Team_zurueckziehen_nimmt_die_Stammdaten_nicht_den_Verbrauch()
    {
        var c = World();
        Verbrauch(c, Model.InitTeam, 300);
        c.With((_, _, write) => write("t", Teams.Stream + Model.InitTeam, Types.TeamRetired, new TeamRetired(), null));
        Assert.Null(c.With((_, _, _) => c.Teams.Get(Model.InitTeam)));
        Assert.Equal(300, c.With((_, _, _) => c.Teams.Month(Model.InitTeam, DateTime.Today.ToString("yyyy-MM"))));   // was verbraucht wurde, wurde verbraucht
        Assert.Equal("es", c.With((_, _, _) => c.Teams.Payer("es")));   // der Zahler ist weg: Spanien steht wieder für sich
    }

    [Fact]
    public void Der_Benutzer_traegt_sein_Team_und_ohne_Team_gibt_es_keines()
    {
        var c = World();
        Assert.Equal("es", c.With((_, _, _) => c.Users.All["pablo"].Team));
        Assert.Equal("es", TeamApi.TeamOf(c, "pablo"));
        // wer ausgetragen wurde, ist teamlos — und teamlos heisst 0 (Taloan, 23.09.2026), kein stilles Zurückfallen auf Team 1
        c.With((_, _, write) => write("t", Users.Stream + "gast", Types.UserDefined, new UserDefined("Gast", null, "reader"), null));
        Assert.Null(c.With((_, _, _) => c.Users.All["gast"].Team));
        Assert.Null(TeamApi.TeamOf(c, "gast"));
        Assert.Null(TeamApi.TeamOf(c, null));
    }

    [Fact]
    public void Wer_kein_eigenes_Team_hat_zaehlt_zum_ersten()
    {
        var c = World();
        c.With((_, _, write) => write("t", Users.Stream + "gast", Types.UserDefined, new UserDefined("Gast", null, "reader"), null));
        // die Mitgliederzahl von Team 1 nimmt die ohne eigenes Team mit — sonst hätte niemand Zugriff auf ihre Token
        var mitglieder = c.With((_, _, _) => c.Users.All.Values.Where(u => u.Team == Model.InitTeam || u.Team is null).Select(u => u.Key).ToHashSet());
        Assert.Contains("gast", mitglieder);
        Assert.Contains("taloan", mitglieder);
        Assert.DoesNotContain("pablo", mitglieder);   // Pablo hat ein eigenes Team
    }

    [Fact]
    public void Jede_Anlage_bringt_das_Init_Team_mit_und_es_bleibt()
    {
        var j = new MemoryJournal(); var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        var erstes = c.With((_, _, _) => c.Teams.Primary);
        Assert.NotNull(erstes);
        Assert.Equal(Model.InitTeam, erstes!.Key);
        Assert.Equal("Init Team", erstes.Label);
        Assert.Equal("init", c.With((_, _, _) => c.Teams.All.Keys.Single()));
        // ein zweiter Lauf legt nichts Zweites an
        c.SeedMissing();
        Assert.Single(c.With((_, _, _) => c.Teams.All));
        // umbenennen geht, das Grundrauschen sitzt hier
        c.With((_, _, write) => write("t", Teams.Stream + Model.InitTeam, Types.TeamDefined, new TeamDefined("Haus", null, IncludedTokens: 50_000), null));
        Assert.Equal("Haus", c.With((_, _, _) => c.Teams.Primary!.Label));
        Assert.Equal(50_000, c.With((_, _, _) => c.Teams.Primary!.IncludedTokens));
        Assert.Equal(Model.InitTeam, c.With((_, _, _) => c.Teams.Primary!.Key));   // Team 1 bleibt Team 1
    }

    [Fact]
    public void Die_Fuehrung_steht_am_Team_und_teamlos_heisst_null()
    {
        var c = World();
        c.With((_, _, write) => write("t", Teams.Stream + "es", Types.TeamDefined, new TeamDefined("Spanien", null, KeysFrom: Model.InitTeam, Managers: ["pablo"]), null));
        Assert.True(c.With((_, _, _) => c.Teams.Leads("es", "pablo")));
        Assert.False(c.With((_, _, _) => c.Teams.Leads("es", "taloan")));
        Assert.Equal(["es"], c.With((_, _, _) => c.Teams.Led("pablo").Select(t => t.Key).ToArray()));
        // ausgetragen heisst teamlos: kein Team, also kein Schlüssel, keine Grenze, keine KI
        c.With((_, _, write) => write("t", Users.Stream + "pablo", Types.UserDefined, new UserDefined("Pablo", null, "editor", true, null), null));
        Assert.Null(c.With((_, _, _) => c.Users.All["pablo"].Team));
        Assert.Null(TeamApi.TeamOf(c, "pablo"));
        Assert.Null(TeamApi.TeamOf(c, "gibtsnicht"));
    }

    [Fact]
    public void Das_Modell_steht_am_Team()
    {
        var c = World();
        c.With((_, _, write) => write("t", Teams.Stream + Model.InitTeam, Types.TeamDefined,
            new TeamDefined("Init Team", Managers: ["taloan"], Models: new() { ["anthropic"] = "claude-opus-5" }), null));
        Assert.Equal("claude-opus-5", c.With((_, _, _) => c.Teams.Get(Model.InitTeam)!.Models["anthropic"]));
    }

    [Fact]
    public void Das_Recht_Team_gibt_es_im_Vokabular_und_der_Team_Admin_im_Saatgut()
    {
        Assert.Contains("team", Rights.All);
        Assert.Equal("Eigenes Team (Schlüssel, Mitglieder)", Rights.Label["team"]);
        var saat = Rights.Seeds().ToDictionary(x => x.Key, x => x.Role);
        Assert.Contains("team", saat["teamadmin"].Rights);
        Assert.DoesNotContain("users", saat["teamadmin"].Rights);   // der Team-Admin holt sich keine Mitglieder in die eigene Kasse
        Assert.Contains("team", saat["admin"].Rights);
    }
}
