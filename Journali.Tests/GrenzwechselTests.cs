using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Licensing;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Was auf ein Team zählt (03.10.2026): auch, was seine Jobs schreiben — und ab wann: ändern sich seine Grenzen, zählt es neu. Gleiche Grenzen (Pro und
/// Pro+) sind kein Wechsel.
/// </summary>
public class GrenzwechselTests
{
    private static DateTimeOffset Local(int y, int m, int d, int h = 12) => new(new DateTime(y, m, d, h, 0, 0, DateTimeKind.Local));
    private sealed class Welt
    {
        public readonly Teams T = new(); public readonly Usage U = new(); public readonly Jobs J = new();
        private long _n;
        public long Schreib(DateTimeOffset at, string actor, string stream, string type, object payload)
        {
            var e = new Entry(++_n, at, actor, stream, type, Types.Serialize(payload));
            T.Apply(e); U.Apply(e); J.Apply(e);
            return e.Number;
        }
        public void Pflege(DateTimeOffset at, string actor, int wieviel) { for (var i = 0; i < wieviel; i++) Schreib(at, actor, "n-1", Types.AttributeSet, new AttributeSet("name", "de", null, "x")); }
        public int Monat(IEnumerable<string> leute, DateOnly heute)
        {
            var z = T.Zaehlbeginn("de", null, heute);
            return U.Sum(J.MitJobs(leute), Usage.Ab(Usage.MonthStart(heute), z.Ab), heute, z.Cut);
        }
    }

    [Fact]
    public void Was_ein_Job_schreibt_zaehlt_beim_Besitzer_auch_wenn_der_Job_entfernt_ist()
    {
        var w = new Welt();
        w.Schreib(Local(2026, 10, 1), "t", Teams.Stream + "de", Types.TeamDefined, new TeamDefined("DE", EntriesWeek: 10_000, EntriesMonth: 50_000));
        w.Schreib(Local(2026, 10, 1), "u1", Jobs.Stream + "imp", Types.JobDefined, new JobDefined("Import", "solr", null, null, Owner: "u1"));
        w.Pflege(Local(2026, 10, 2), "u1", 3);
        w.Pflege(Local(2026, 10, 2), "job:imp", 5);
        w.Pflege(Local(2026, 10, 2), "job:fremd", 7);                       // ein Job ohne Besitzer in diesem Team
        var heute = new DateOnly(2026, 10, 2);
        Assert.Equal(8, w.Monat(["u1"], heute));
        w.Schreib(Local(2026, 10, 2, 13), "u1", Jobs.Stream + "imp", Types.JobRetired, new JobRetired());
        Assert.Equal(8, w.Monat(["u1"], heute));                          // entfernt: was er schrieb, bleibt beim Besitzer
    }

    [Fact]
    public void Ein_Job_ohne_Besitzer_zaehlt_beim_Administrator_und_seinem_Team()
    {
        var w = new Welt();
        var users = new Users();
        foreach (var e in new[]
        {
            new Entry(900, Local(2026, 10, 1), "t", Users.Stream + "ed", Types.UserDefined, Types.Serialize(new UserDefined("Ed", null, "editor", true, "init"))),
            new Entry(901, Local(2026, 10, 1), "t", Users.Stream + "b-admin", Types.UserDefined, Types.Serialize(new UserDefined("B", null, "admin", true, "de"))),
            new Entry(902, Local(2026, 10, 1), "t", Users.Stream + "z-admin", Types.UserDefined, Types.Serialize(new UserDefined("Z", null, "admin", true, "init"))),
        }) users.Apply(e);
        Assert.Equal("z-admin", users.Verwalter("init"));                     // der aus dem Init Team, auch wenn ein anderer im Schlüssel vorn liegt
        w.Schreib(Local(2026, 10, 1), "t", Jobs.Stream + "embed", Types.JobDefined, new JobDefined("Einbettungen", "embed", null, null));
        w.Pflege(Local(2026, 10, 2), "job:embed", 4);
        var heute = new DateOnly(2026, 10, 2);
        Assert.Equal(0, w.U.Sum(w.J.MitJobs(["ed"], "z-admin"), Usage.MonthStart(heute), heute));
        Assert.Equal(4, w.U.Sum(w.J.MitJobs(["z-admin"], "z-admin"), Usage.MonthStart(heute), heute));
        Assert.Equal("z-admin", w.J.BesitzerVon("embed", "z-admin"));
    }

    [Fact]
    public void Ein_Job_wird_ueber_sein_Team_abgerechnet_ohne_Team_ueber_den_Besitzer_ohne_beides_ueber_den_Administrator()
    {
        var jobs = new Jobs(); var users = new Users(); var teams = new Teams();
        long n = 0;
        void E(Journali.Core.Projections.IProjection p, string actor, string stream, string type, object payload) => p.Apply(new Entry(++n, Local(2026, 10, 1), actor, stream, type, Types.Serialize(payload)));
        foreach (var t in new[] { "init", "mkt", "dev" }) E(teams, "t", Teams.Stream + t, Types.TeamDefined, new TeamDefined(t));
        E(users, "t", Users.Stream + "admin", Types.UserDefined, new UserDefined("A", null, "admin", true, "init"));
        E(users, "t", Users.Stream + "mia", Types.UserDefined, new UserDefined("Mia", null, "editor", true, "mkt"));
        E(jobs, "mia", Jobs.Stream + "export", Types.JobDefined, new JobDefined("Export", "csv", null, null, Owner: "mia", Team: "dev"));   // gehört Mia, zahlt Entwicklung
        E(jobs, "mia", Jobs.Stream + "import", Types.JobDefined, new JobDefined("Import", "csv", null, null, Owner: "mia"));
        E(jobs, "t", Jobs.Stream + "embed", Types.JobDefined, new JobDefined("Einbettungen", "embed", null, null));
        Assert.Equal("dev", Abrechnung.TeamDesJobs(jobs, users, "export", "init"));
        Assert.Equal("mkt", Abrechnung.TeamDesJobs(jobs, users, "import", "init"));
        Assert.Equal("init", Abrechnung.TeamDesJobs(jobs, users, "embed", "init"));
        Assert.Equal(new[] { "job:import", "mia" }, Abrechnung.Urheber(teams, users, jobs, "mkt", "init").Order());
        Assert.Equal(new[] { "job:export" }, Abrechnung.Urheber(teams, users, jobs, "dev", "init").Order());
        Assert.Equal(new[] { "admin", "job:embed" }, Abrechnung.Urheber(teams, users, jobs, "init", "init").Order());
    }

    [Fact]
    public void Aendern_sich_die_Grenzen_zaehlt_das_Team_ab_dem_Eintrag_neu_gleiche_Grenzen_sind_kein_Wechsel()
    {
        var w = new Welt();
        w.Schreib(Local(2026, 10, 1), "t", Teams.Stream + "de", Types.TeamDefined, new TeamDefined("DE", EntriesWeek: 10_000, EntriesMonth: 50_000));
        w.Pflege(Local(2026, 10, 1), "u1", 4);
        w.Pflege(Local(2026, 10, 2, 9), "u1", 2);
        var heute = new DateOnly(2026, 10, 2);
        Assert.Equal(6, w.Monat(["u1"], heute));

        // ein Pro-Schlüssel um 10 Uhr: andere Grenzen — gezählt wird ab ihm, nicht ab dem Tag
        var schluessel = w.Schreib(Local(2026, 10, 2, 10), "t", Teams.Stream + "de", Types.KeyRedeemed, new KeyRedeemed("k-1", Schluessel.Limit, heute, heute.AddDays(29), 50_000, 250_000, 30, 0, "pro"));
        w.Pflege(Local(2026, 10, 2, 11), "u1", 3);
        Assert.Equal((heute, schluessel), w.T.Zaehlbeginn("de", null, heute));
        Assert.Equal(3, w.Monat(["u1"], heute));

        // dasselbe Grundkontingent noch einmal (umbenannt): kein Wechsel
        w.Schreib(Local(2026, 10, 2, 12), "t", Teams.Stream + "de", Types.TeamDefined, new TeamDefined("Deutschland", EntriesWeek: 10_000, EntriesMonth: 50_000));
        Assert.Equal((heute, schluessel), w.T.Zaehlbeginn("de", null, heute));
        // ein zweiter Schlüssel mit denselben Grenzen (Pro+ hat die Grenzen von Pro): kein Wechsel
        w.Schreib(Local(2026, 10, 2, 13), "t", Teams.Stream + "de", Types.KeyRedeemed, new KeyRedeemed("k-2", Schluessel.Limit, heute, heute.AddDays(29), 50_000, 250_000, 30, 0, "proplus"));
        Assert.Equal((heute, schluessel), w.T.Zaehlbeginn("de", null, heute));
        Assert.Equal(3, w.Monat(["u1"], heute));
    }

    [Fact]
    public void Endet_ein_Schluessel_oder_entzieht_der_Lizenzserver_das_Abo_zaehlt_das_Team_neu()
    {
        var w = new Welt();
        var d1 = new DateOnly(2026, 9, 25);
        w.Schreib(Local(2026, 9, 25), "t", Teams.Stream + "de", Types.TeamDefined, new TeamDefined("DE", EntriesWeek: 10_000, EntriesMonth: 50_000));
        w.Schreib(Local(2026, 9, 25), "t", Teams.Stream + "de", Types.KeyRedeemed, new KeyRedeemed("k-1", Schluessel.Limit, d1, new DateOnly(2026, 10, 1), 50_000, 250_000, 7, 0, "pro"));
        w.Pflege(Local(2026, 10, 1), "u1", 40);
        // der Schlüssel galt bis zum 01.10.: ab dem 02.10. zählt das Team neu — ohne einen Eintrag an diesem Tag
        Assert.Equal((new DateOnly(2026, 10, 2), (long?)null), w.T.Zaehlbeginn("de", null, new DateOnly(2026, 10, 2)));
        Assert.Equal(0, w.Monat(["u1"], new DateOnly(2026, 10, 2)));

        // ein Stand vom Lizenzserver: Unlimited, dann entzogen — beide ändern die Grenzen
        var jetzt = Local(2026, 10, 3, 9);
        w.Schreib(jetzt, "t", Teams.Stream + "de", Types.EntitlementReceived, new EntitlementReceived("i", "de", "unlimited", Tarife.Ohne, Tarife.Ohne, "active",
            new DateOnly(2026, 10, 24), jetzt, jetzt + Entitlement.Kulanz, "r1", "s", Geprueft: true));
        w.Pflege(Local(2026, 10, 3, 10), "u1", 100);
        var entzug = w.Schreib(Local(2026, 10, 3, 11), "t", Teams.Stream + "de", Types.EntitlementReceived, new EntitlementReceived("i", "de", "unlimited", Tarife.Ohne, Tarife.Ohne, "entzogen",
            new DateOnly(2026, 10, 2), jetzt.AddHours(2), jetzt.AddHours(2) + Entitlement.Kulanz, "r2", "s", Geprueft: true));
        w.Pflege(Local(2026, 10, 3, 12), "u1", 5);
        var heute = new DateOnly(2026, 10, 3);
        Assert.Equal((heute, entzug), w.T.Zaehlbeginn("de", null, heute));
        Assert.Equal(5, w.Monat(["u1"], heute));                          // was unter Unlimited geschrieben wurde, zählt nicht mehr
    }

    [Fact]
    public void Ein_Team_steuert_nur_seine_eigenen_Jobs_ein_Administrator_alle()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, w) =>
        {
            w("t", Teams.Stream + "mkt", Types.TeamDefined, new TeamDefined("Marketing"), null);
            w("t", Teams.Stream + "dev", Types.TeamDefined, new TeamDefined("Entwicklung"), null);
            w("t", Users.Stream + "admin", Types.UserDefined, new UserDefined("A", null, "admin", true, Model.InitTeam), null);
            w("t", Users.Stream + "mia", Types.UserDefined, new UserDefined("Mia", null, "editor", true, "mkt"), null);
            w("t", Users.Stream + "dan", Types.UserDefined, new UserDefined("Dan", null, "editor", true, "dev"), null);
            w("dan", Jobs.Stream + "export", Types.JobDefined, new JobDefined("Export", "csv", null, null, Owner: "dan", Team: "dev"), null);
            w("t", Jobs.Stream + "embed", Types.JobDefined, new JobDefined("Einbettungen", "embed", null, null), null);
            return 0;
        });
        Assert.True(JobApi.DarfSteuern(c, "dan", false, "export"));
        Assert.False(JobApi.DarfSteuern(c, "mia", false, "export"));          // Marketing startet nicht auf Kosten der Entwicklung
        Assert.True(JobApi.DarfSteuern(c, "mia", true, "export"));            // ein Administrator darf alle — gezahlt wird weiter von Entwicklung
        Assert.False(JobApi.DarfSteuern(c, "mia", false, "embed"));           // ein Systemjob gehört dem Team des Administrators
        Assert.True(JobApi.DarfSteuern(c, "admin", false, "embed"));
        Assert.True(JobApi.DarfSteuern(c, "job:export", false, "export"));    // ein Lauf selbst ist nicht gemeint
    }

    [Fact]
    public void Trockenlauf_ist_der_Parameter_dryRun_oder_dry_run_und_die_Zahl_steht_am_Lauf()
    {
        System.Text.Json.JsonElement Proc(string json) => System.Text.Json.JsonDocument.Parse(json).RootElement;
        Assert.Equal("dryRun", JobRunner.TrockenParam(Proc("""{"params":[{"key":"source"},{"key":"dryRun"}]}""")));
        Assert.Equal("dry_run", JobRunner.TrockenParam(Proc("""{"params":[{"key":"dry_run"}]}""")));
        Assert.Null(JobRunner.TrockenParam(Proc("""{"params":[{"key":"limit"}]}""")));
        Assert.Null(JobRunner.TrockenParam(Proc("""{}""")));

        var jobs = new Jobs(); long n = 0;
        void E(string type, object payload) => jobs.Apply(new Entry(++n, Local(2026, 10, 3), "t", Jobs.Stream + "imp", type, Types.Serialize(payload)));
        E(Types.JobDefined, new JobDefined("Import", "solr", null, null));
        E(Types.JobRunStarted, new JobRunStarted("r1", JobRunner.Trocken));
        E(Types.JobRunFinished, new JobRunFinished("r1", "ok", 0, 3.2, "Probelauf", 100, 1_320_000));
        Assert.Equal((JobRunner.Trocken, 1_320_000), (jobs.All["imp"].Runs[0].Trigger, jobs.All["imp"].Runs[0].Entries));
    }

    [Fact]
    public void Verfuegbar_fuer_einen_Job_ist_die_Grenze_ohne_Reserve_abzueglich_des_Gezaehlten()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, w) =>
        {
            w("t", Teams.Stream + "de", Types.TeamDefined, new TeamDefined("DE", EntriesWeek: 1000, EntriesMonth: 5000), null);
            w("t", Users.Stream + "u", Types.UserDefined, new UserDefined("U", null, "editor", true, "de"), null);
            return 0;
        });
        Assert.Equal((900, 4500), c.VerfuegbarFuerJob("de"));                          // 90 %: der Rest gehört der Handarbeit
        for (var i = 0; i < 100; i++) c.With((_, _, w) => w("u", "n-1", Types.AttributeSet, new AttributeSet("name", "de", null, "x" + i), null));
        Assert.Equal((800, 4400), c.VerfuegbarFuerJob("de"));
        Assert.Null(c.VerfuegbarFuerJob("gibtsnicht"));
    }
}
