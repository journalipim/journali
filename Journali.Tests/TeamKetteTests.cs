using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Führen und dazugehören sind zweierlei (Taloan, 23.09.2026: „man kann zwar Manager von mehreren Teams sein, aber nur
// Mitglied von einem Team“ · „der IT-Administrator von Südeuropa kann Manager von Spanien, Frankreich und Portugal
// sein; wenn er in der Zentrale sitzt, ist er wahrscheinlich Mitglied von Team Deutschland“).
// Dazu die Kette: ein Team kann über ein anderes abrechnen, das selbst über ein drittes abrechnet — am Ende steht
// immer ein Kontingent. Was nicht sein darf, ist ein Kreis (a→b→a, a→b→c→a).
public class TeamKetteTests
{
    private static Catalog Welt()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) =>
        {
            foreach (var (key, label) in new[] { ("de", "Deutschland"), ("es", "Spanien"), ("fr", "Frankreich"), ("pt", "Portugal") })
                write("t", Teams.Stream + key, Types.TeamDefined, new TeamDefined(label), null);
            return 0;
        });
        return c;
    }

    [Fact]
    public void Wer_mehrere_Teams_fuehrt_gehoert_trotzdem_nur_einem_an()
    {
        var c = Welt();
        c.With((_, _, write) =>
        {
            // der IT-Administrator von Südeuropa sitzt in der Zentrale
            write("t", Users.Stream + "ines", Types.UserDefined, new UserDefined("Ines", null, "admin", true, "de"), null);
            foreach (var t in new[] { "es", "fr", "pt" })
                write("t", Teams.Stream + t, Types.TeamDefined, new TeamDefined(c.Teams.Get(t)!.Label, Managers: ["ines"]), null);
            return 0;
        });
        Assert.Equal(["es", "fr", "pt"], c.With((_, _, _) => c.Teams.Led("ines").Select(t => t.Key).Order().ToArray()));
        Assert.Equal("de", c.With((_, _, _) => c.Users.All["ines"].Team));       // Mitglied bleibt sie genau dort
        Assert.Equal("de", TeamApi.TeamOf(c, "ines"));                            // und das zeigt auch die Leiste
        Assert.False(c.With((_, _, _) => c.Teams.Leads("de", "ines")));           // ihr eigenes Team führt sie nicht
    }

    [Fact]
    public void Die_Kette_endet_bei_dem_der_das_Kontingent_hat()
    {
        var c = Welt();
        c.With((_, _, write) =>
        {
            write("t", Teams.Stream + "pt", Types.TeamDefined, new TeamDefined("Portugal", KeysFrom: "es"), null);
            write("t", Teams.Stream + "es", Types.TeamDefined, new TeamDefined("Spanien", KeysFrom: "de"), null);
            return 0;
        });
        Assert.Equal("de", c.With((_, _, _) => c.Teams.Payer("pt")));   // pt → es → de
        Assert.Equal("de", c.With((_, _, _) => c.Teams.Payer("es")));
        Assert.Equal("de", c.With((_, _, _) => c.Teams.Payer("de")));
        Assert.Equal(["de", "es", "pt"], c.With((_, _, _) => c.Teams.Dependents("de").Order().ToArray()));
    }

    [Fact]
    public void Ein_Kreis_wird_erkannt_bevor_er_entsteht()
    {
        var c = Welt();
        c.With((_, _, write) =>
        {
            write("t", Teams.Stream + "es", Types.TeamDefined, new TeamDefined("Spanien", KeysFrom: "de"), null);
            write("t", Teams.Stream + "fr", Types.TeamDefined, new TeamDefined("Frankreich", KeysFrom: "es"), null);
            return 0;
        });
        Assert.True(c.With((_, _, _) => c.Teams.WaereKreis("de", "es")));    // de → es → de
        Assert.True(c.With((_, _, _) => c.Teams.WaereKreis("de", "fr")));    // de → fr → es → de
        Assert.True(c.With((_, _, _) => c.Teams.WaereKreis("pt", "pt")));    // auf sich selbst
        Assert.False(c.With((_, _, _) => c.Teams.WaereKreis("pt", "fr")));   // pt → fr → es → de: endet
    }

    [Fact]
    public void Ein_Kreis_im_Journal_legt_die_Anwendung_nicht_lahm()
    {
        var c = Welt();
        // von Hand geschrieben, wie es die API nicht zuliesse — der Abruf muss trotzdem enden
        c.With((_, _, write) =>
        {
            write("t", Teams.Stream + "es", Types.TeamDefined, new TeamDefined("Spanien", KeysFrom: "fr"), null);
            write("t", Teams.Stream + "fr", Types.TeamDefined, new TeamDefined("Frankreich", KeysFrom: "es"), null);
            return 0;
        });
        var zahler = c.With((_, _, _) => c.Teams.Payer("es"));
        Assert.Contains(zahler, new[] { "es", "fr" });
    }
}
