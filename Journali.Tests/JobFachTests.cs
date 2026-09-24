using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Fächer des Taskers (docs/tasker-dateien.md): Eingang wählen, Duplikat nach Hash ohne Lauf, nach done/ bzw. failed/,
// Ausgaben benennen, latest kopieren, Aufbewahrung — und die Belege im Journal.
public class JobFachTests
{
    private static readonly JsonElement Proc = JsonDocument.Parse("""{"command":"node","args":[],"files":{"in":{"pattern":"*.json;*.json.gz","mode":"one","order":"name","param":"source"},"out":{"many":true,"param":"dir"}}}""").RootElement;

    private sealed class World : IDisposable
    {
        public string Root = Path.Combine(Path.GetTempPath(), "journali-fach-" + Guid.NewGuid().ToString("N"));
        public JobState Job;
        public List<(string Type, object Payload)> Journal = new();
        public List<string> Log = new();
        public JobFach Fach;
        public World(string? keep = null, bool latest = true)
        {
            Directory.CreateDirectory(Root);
            Job = new JobState { Key = "imp", Files = new JobFiles(Path.Combine(Root, "share"), keep, latest, false) };
            Fach = new JobFach(Path.Combine(Root, "jobs"));
        }
        public void Put(string name, string content) { var dir = Fach.Fach(Job, "in"); Directory.CreateDirectory(dir); File.WriteAllText(Path.Combine(dir, name), content); File.SetLastWriteTimeUtc(Path.Combine(dir, name), DateTime.UtcNow.AddSeconds(-10)); }
        public void Record(string type, object payload)
        {
            Journal.Add((type, payload));
            // wie das Abbild: erfolgreich verarbeitete Hashes merken
            if (payload is JobFileConsumed c && c.Status == "ok") Job.ConsumedHashes.Add(c.Hash);
        }
        public JobFach.Plan? Prepare(string run, Dictionary<string, string> values, out string? skip) => Fach.Prepare(Job, Proc, run, values, Record, out skip);
        public Task Finish(JobFach.Plan plan, string run, bool ok) { var log = Path.Combine(Root, run + ".log"); File.WriteAllText(log, "log"); return Fach.Finish(Job, plan, run, ok, log, Record, (_, _) => Task.FromResult<string?>(null), Log.Add); }
        public string[] Names(string fach) => Directory.Exists(Fach.Fach(Job, fach)) ? Directory.GetFileSystemEntries(Fach.Fach(Job, fach)).Select(x => Path.GetFileName(x)!).Order().ToArray() : [];
        public void Dispose() { try { Directory.Delete(Root, true); } catch { } }
    }

    [Fact]
    public async Task Eingang_wird_gewaehlt_verarbeitet_und_ein_Duplikat_laeuft_nicht_noch_einmal()
    {
        using var w = new World();
        w.Put("b.json", "{\"b\":1}"); w.Put("a.json", "{\"a\":1}"); w.Put("notiz.txt", "nicht dran");
        var values = new Dictionary<string, string> { ["source"] = "" };
        var plan = w.Prepare("r1", values, out var skip);
        Assert.NotNull(plan); Assert.Null(skip);
        Assert.Single(plan!.In); Assert.Equal("a.json", plan.In[0].Name);            // mode one, nach Name
        Assert.Equal(plan.In[0].Path, values["source"]);                              // leerer Parameter wird gefüllt
        Assert.Equal(plan.In[0].Path, values["inFile"]);
        Assert.True(Directory.Exists(plan.OutDir)); Assert.Equal(plan.OutDir, values["dir"]);
        File.WriteAllText(Path.Combine(plan.OutDir!, "ergebnis.json"), "{}");
        await w.Finish(plan, "r1", ok: true);
        Assert.DoesNotContain("a.json", w.Names("in")); Assert.Contains("b.json", w.Names("in"));
        Assert.Single(w.Names("done")); Assert.EndsWith("-r1-a.json", w.Names("done")[0]);
        Assert.Contains(w.Journal, e => e.Type == Types.JobFileConsumed && ((JobFileConsumed)e.Payload).Status == "ok" && ((JobFileConsumed)e.Payload).Name == "a.json");
        Assert.Contains(w.Journal, e => e.Type == Types.JobFileWritten && ((JobFileWritten)e.Payload).Latest && ((JobFileWritten)e.Payload).Name.EndsWith("ergebnis.json"));
        Assert.True(File.Exists(Path.Combine(w.Fach.Fach(w.Job, "out"), "imp-latest", "ergebnis.json")));   // Kopie unter stabilem Namen
        // dieselbe Datei kommt noch einmal (anderer Name, gleicher Inhalt): Duplikat → done/, kein Lauf
        w.Put("a-nochmal.json", "{\"a\":1}");
        var plan2 = w.Prepare("r2", new(), out skip);
        Assert.NotNull(plan2); Assert.Equal("b.json", plan2!.In[0].Name);
        Assert.Contains(w.Journal, e => e.Type == Types.JobFileConsumed && ((JobFileConsumed)e.Payload).Status == "duplicate");
        Assert.Contains(w.Names("done"), n => n.Contains("-dup-a-nochmal.json"));
        Assert.DoesNotContain("a-nochmal.json", w.Names("in"));
        // gescheiterter Lauf: nach failed/ mit Log daneben
        await w.Finish(plan2, "r2", ok: false);
        Assert.Contains(w.Names("failed"), n => n.EndsWith("-r2-b.json")); Assert.Contains(w.Names("failed"), n => n.EndsWith("-r2-b.json.log"));
        Assert.Contains(w.Journal, e => e.Type == Types.JobFileConsumed && ((JobFileConsumed)e.Payload).Status == "failed");
        // Eingang leer: kein Lauf
        Assert.Null(w.Prepare("r3", new(), out skip)); Assert.Contains("Eingang leer", skip);
    }

    [Fact]
    public async Task Aufbewahrung_haelt_n_Laeufe_und_verschont_latest()
    {
        using var w = new World(keep: "1");
        var procOut = JsonDocument.Parse("""{"files":{"out":{"many":true,"param":"dir"}}}""").RootElement;
        for (var i = 1; i <= 3; i++)
        {
            var plan = w.Fach.Prepare(w.Job, procOut, "r" + i, new(), w.Record, out _)!;
            File.WriteAllText(Path.Combine(plan.OutDir!, "x.json"), "{}");
            await Task.Delay(1100);   // Stempel je Sekunde
            await w.Finish(plan, "r" + i, ok: true);
        }
        var names = w.Names("out");
        Assert.Contains("imp-latest", names);
        Assert.Single(names.Where(n => n.StartsWith("imp-") && n != "imp-latest"));   // nur der jüngste Lauf
        Assert.Empty(w.Log);
    }
}
