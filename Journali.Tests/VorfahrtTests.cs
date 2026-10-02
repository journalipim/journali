using System.Diagnostics;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Microsoft.Extensions.Logging.Abstractions;

namespace Journali.Tests;

// Ein Import hat Vorfahrt: solange er läuft, warten die Läufe, die der Server nebenher tut (Vektoren, Ableitungen, Dokumente lesen),
// und der Nachzieher startet keinen neuen. Der Import schreibt in dieselbe Datenbank, und auf ihn wartet jemand.
public class VorfahrtTests
{
    private static string Manifest(string key, string kind, string skript = "setTimeout(()=>{},8000)") =>
        $$$"""{"key":"{{{key}}}","version":"1","label":"{{{key}}}","kind":"{{{kind}}}","runs":"process","process":{"command":"node","args":["-e","{{{skript}}}"],"params":[]}}""";

    private static (JobRunner Runner, Catalog Katalog, string Dir) Welt(string skriptWerk = "setTimeout(()=>{},8000)")
    {
        var dir = Path.Combine(Path.GetTempPath(), "journali-vorfahrt-" + Guid.NewGuid().ToString("N"));
        foreach (var (key, kind) in new[] { ("csv", "import"), ("probe", "tool") })
        {
            Directory.CreateDirectory(Path.Combine(dir, "plugins", key));
            File.WriteAllText(Path.Combine(dir, "plugins", key, "plugin.json"), key == "probe" ? Manifest(key, kind, skriptWerk) : Manifest(key, kind));
        }
        Directory.CreateDirectory(Path.Combine(dir, "jobs"));
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) =>
        {
            foreach (var key in new[] { "csv", "probe" })
            {
                write("t", Plugins.Stream + key, Types.PluginInstalled, new PluginInstalled("1", "{}"), null);
                write("t", Plugins.Stream + key, Types.PluginEnabled, new PluginEnabled(), null);
                write("t", Jobs.Stream + key, Types.JobDefined, new JobDefined(key, key, new(), null, true, 5, null, null, null, null), null);
            }
            return 0;
        });
        var runner = new JobRunner(c, Path.Combine(dir, "plugins"), Path.Combine(dir, "jobs"), NullLogger<JobRunner>.Instance) { Origin = "http://localhost:1" };
        return (runner, c, dir);
    }

    private static void Starte(JobRunner r, string key) { var run = r.Start(key, "manual", out var fehler); Assert.True(run is not null, $"Start {key}: {fehler}"); }

    private static void Ende(JobRunner r, string dir)
    {
        foreach (var k in new[] { "csv", "probe" }) r.Cancel(k);
        try { Directory.Delete(dir, true); } catch { }
    }

    [Fact]
    public void Ein_Import_haelt_die_anderen_Laeufe_an_und_gibt_sie_danach_frei()
    {
        var (runner, _, dir) = Welt();
        try
        {
            Starte(runner, "probe");
            Assert.False(runner.IsPaused("probe"));                           // ohne Import läuft er ungestört

            Starte(runner, "csv");
            Assert.True(runner.ImportLaeuft);
            Assert.True(runner.IsPaused("probe"));
            Assert.Equal("Import", runner.PauseReason("probe"));
            Assert.False(runner.IsPaused("csv"));                            // der Import wartet auf niemanden
            Assert.Null(runner.PauseReason("csv"));

            runner.Cancel("csv");
            for (var i = 0; i < 100 && runner.ImportLaeuft; i++) Thread.Sleep(50);
            Assert.False(runner.ImportLaeuft);
            Assert.False(runner.IsPaused("probe"));
        }
        finally { Ende(runner, dir); }
    }

    [Fact]
    public void Ein_Job_der_nicht_laeuft_wartet_auch_nicht()
    {
        var (runner, _, dir) = Welt();
        try
        {
            Starte(runner, "csv");
            Assert.False(runner.IsPaused("probe"));                           // nicht gestartet: nichts, was warten könnte
        }
        finally { Ende(runner, dir); }
    }

    [Fact]
    public void Ein_Lauf_der_beim_Anhalten_mit_2_endet_gilt_nicht_als_gescheitert()
    {
        // Der Systemjob fragt das Signal, sieht „Import“ und endet mit 2; der Tasker zeigt ihn nicht als gescheitert
        var (runner, c, dir) = Welt("setTimeout(()=>process.exit(2),1500)");
        try
        {
            Starte(runner, "probe"); Starte(runner, "csv");
            for (var i = 0; i < 200 && runner.IsRunning("probe"); i++) Thread.Sleep(50);
            Assert.False(runner.IsRunning("probe"));
            Assert.Equal("ok", c.Lesen((_, _) => c.Jobs.All["probe"].Last?.Status));
        }
        finally { Ende(runner, dir); }
    }

    [Fact]
    public void Dieselbe_2_ohne_Anhalten_bleibt_ein_Fehler()
    {
        var (runner, c, dir) = Welt("setTimeout(()=>process.exit(2),500)");
        try
        {
            Starte(runner, "probe");
            for (var i = 0; i < 200 && runner.IsRunning("probe"); i++) Thread.Sleep(50);
            Assert.Equal("failed", c.Lesen((_, _) => c.Jobs.All["probe"].Last?.Status));   // ein Aufruffehler, kein Anhalten
        }
        finally { Ende(runner, dir); }
    }

    [Theory]
    [InlineData("""{"kind":"import"}""", null, true)]        // ixp, solr
    [InlineData("""{"kind":"io"}""", "import", true)]        // csv, excel, json: der Dienst import
    [InlineData("""{"kind":"io"}""", "export", false)]
    [InlineData("""{"kind":"tool"}""", null, false)]         // embed, derive, docs, ocr, probe
    [InlineData("""{"kind":"classification"}""", null, false)]
    public void Was_ein_Import_ist(string manifest, string? dienst, bool erwartet)
    {
        using var doc = System.Text.Json.JsonDocument.Parse(manifest);
        Assert.Equal(erwartet, JobRunner.IstImport(doc.RootElement, dienst));
    }
}
