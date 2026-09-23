using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Ein Lauf, der an den Tasker abgegeben wird, gehört dem, der ihn abgegeben hat (Taloan, 23.09.2026: „sobald ich bei
// einem Import auf Schreiben klicke, sollte der Job an den Tasker übergeben werden“). Sonst liefe ein Import als Job
// am Kontingent vorbei: der Urheber `job:<key>` ist kein Anwender, und die Sperre greift nur bei Anwendern.
public class UebergabeTests
{
    private static Catalog Welt()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) =>
        {
            write("t", Users.Stream + "frei", Types.UserDefined, new UserDefined("Frei", null, "editor"), null);                       // kein Team
            write("t", Users.Stream + "taloan", Types.UserDefined, new UserDefined("Taloan", null, "editor", true, Model.InitTeam), null);
            return 0;
        });
        return c;
    }

    private static bool Schreibt(Catalog c, string actor)
    {
        try { c.With((_, _, write) => write(actor, "n-test", Types.AttributeSet, new AttributeSet("name", "de", null, "x"), null)); return true; }
        catch (KeinKontingentException) { return false; }
    }

    private static void Job(Catalog c, string key, string? owner) =>
        c.With((_, _, write) => write("t", Jobs.Stream + key, Types.JobDefined,
            new JobDefined("Import", "solr", null, null, true, 180, null, null, null, owner), null));

    [Fact]
    public void Der_Lauf_geht_auf_das_Kontingent_seines_Eigentuemers()
    {
        var c = Welt();
        Job(c, "solr_import", "taloan");                       // Taloan hat ein Team mit Kontingent
        Assert.True(Schreibt(c, "job:solr_import"));
    }

    [Fact]
    public void Wer_selbst_kein_Kontingent_hat_bekommt_auch_keins_ueber_einen_Job()
    {
        var c = Welt();
        Job(c, "solr_import", "frei");                       // Frei ist in keinem Team
        Assert.False(Schreibt(c, "job:solr_import"));
        Assert.False(Schreibt(c, "frei"));                   // von Hand geht es ebenso wenig
    }

    [Fact]
    public void Ein_Job_ohne_Eigentuemer_bleibt_wie_bisher_frei()
    {
        // Geplante Jobs (Sicherung, Ableitungen) gehören niemandem — sie laufen weiter
        var c = Welt();
        Job(c, "sicherung", null);
        Assert.True(Schreibt(c, "job:sicherung"));
    }

    [Fact]
    public void Der_Eigentuemer_steht_am_Job_und_ueberlebt_den_Neuaufbau()
    {
        var j = new MemoryJournal();
        var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        Job(c, "solr_import", "taloan");
        Assert.Equal("taloan", c.With((_, _, _) => c.Jobs.All["solr_import"].Owner));
        var wieder = new Catalog(j); wieder.Rebuild();
        Assert.Equal("taloan", wieder.With((_, _, _) => wieder.Jobs.All["solr_import"].Owner));
    }
}
