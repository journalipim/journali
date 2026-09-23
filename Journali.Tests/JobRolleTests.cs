using Microsoft.AspNetCore.Http;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Die Rolle eines Jobs (Taloan, 23.09.2026): der Sicherungsjob scheiterte mit „403 Rolle editor darf das nicht (Anwender
// und Rollen)“. Ein Dienst-Token bekam hart editor — /api/backup verlangt aber users. Jetzt steht am Job, mit welcher
// Rolle er läuft; ohne Angabe bleibt es bei editor, damit sich an bestehenden Jobs nichts ändert.
public class JobRolleTests
{
    private static (Catalog C, string Dir) Welt()
    {
        var j = new MemoryJournal(); var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        var dir = Path.Combine(Path.GetTempPath(), "journali-test-" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(dir);
        return (c, dir);
    }

    private static (string User, string Role)? Auflösen(Catalog c, string dir, string token)
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Headers.Authorization = "Bearer " + token;
        return Auth.Resolve(ctx, c, dir);
    }

    [Fact]
    public void Ohne_Angabe_laeuft_ein_Job_wie_bisher_als_editor()
    {
        var (c, dir) = Welt();
        var token = Auth.IssueServiceToken("job:docs");
        Assert.Equal(("job:docs", "editor"), Auflösen(c, dir, token));
    }

    [Fact]
    public void Mit_Rolle_am_Job_bekommt_der_Lauf_deren_Rechte()
    {
        var (c, dir) = Welt();
        var token = Auth.IssueServiceToken("job:sicherung", "admin");
        var wer = Auflösen(c, dir, token);
        Assert.Equal("admin", wer!.Value.Role);
        // und damit darf der Lauf, was eine Sicherung braucht
        Assert.Contains(Rights.Users, Auth.RightsOf(c, wer.Value.Role));
    }

    [Fact]
    public void Eine_Rolle_die_es_nicht_gibt_faellt_auf_editor_zurueck()
    {
        var (c, dir) = Welt();
        var token = Auth.IssueServiceToken("job:x", "gibtsnicht");
        Assert.Equal("editor", Auflösen(c, dir, token)!.Value.Role);
    }

    [Fact]
    public void Die_Rolle_steht_am_Job_und_ueberlebt_den_Neuaufbau()
    {
        var j = new MemoryJournal(); var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) => write("t", Jobs.Stream + "sicherung", Types.JobDefined,
            new JobDefined("Sicherung", "backup", new() { ["dir"] = "x" }, null, true, 60, null, null, "admin"), null));
        Assert.Equal("admin", c.With((_, _, _) => c.Jobs.All["sicherung"].Role));
        var wieder = new Catalog(j); wieder.Rebuild();
        Assert.Equal("admin", wieder.With((_, _, _) => wieder.Jobs.All["sicherung"].Role));
        // ein Job von vorher hat keine — und läuft weiter wie bisher
        c.With((_, _, write) => write("t", Jobs.Stream + "alt", Types.JobDefined,
            new JobDefined("Alt", "docs", null, null), null));
        Assert.Null(c.With((_, _, _) => c.Jobs.All["alt"].Role));
    }
}
