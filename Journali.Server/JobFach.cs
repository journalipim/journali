using System.Security.Cryptography;
using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Die Fächer eines Jobs (docs/tasker-dateien.md): der Tasker besitzt die Ablage, das Plugin den Inhalt. Je Job vier Fächer unter
/// der Basis (Vorgabe jobs/&lt;key&gt;, je Job ein Share): <c>in/</c> Eingang, <c>done/</c> verarbeitet, <c>failed/</c> gescheitert
/// (mit Log daneben), <c>out/</c> Ausgaben. Das Manifest sagt nur, was der Prozess frisst und schreibt:
/// <code>"files": { "in": { "pattern": "*.json;*.json.gz", "mode": "one|all", "order": "name|time", "required": true, "param": "source" },
///            "out": { "many": true, "param": "dir" } }</code>
/// Vor dem Lauf wählt der Tasker den Eingang (Duplikat nach SHA-256 → done/ ohne Lauf), füllt {inFile}/{inDir} und {outFile}/{outDir}
/// (und den genannten Parameter, wenn der Job ihn leer lässt); nach dem Lauf räumt er auf, benennt, kopiert <c>latest</c>, hält die
/// Aufbewahrung ein und schreibt die Belege JobFileConsumed / JobFileWritten ins Journal. Archiv: die Datei zusätzlich als Medium.
/// </summary>
public sealed class JobFach
{
    public sealed record Picked(string Path, string Name, string Hash, long Bytes);
    public sealed record Plan(List<Picked> In, string? InDir, string? OutFile, string? OutDir, bool Many, string Stamp);
    public sealed record InSpec(string[] Patterns, string Mode, string Order, bool Required, string? Param);
    public sealed record OutSpec(bool Many, string? Ext, string? Param);

    private readonly string _dir;
    public JobFach(string jobDir) => _dir = jobDir;

    /// <summary>Basis der Fächer: Files.Base des Jobs (absolut) oder jobs/&lt;key&gt;.</summary>
    public string Base(JobState job) => job.Files?.Base is { Length: > 0 } b ? Path.GetFullPath(b) : Path.Combine(_dir, job.Key);
    public string Fach(JobState job, string which) => Path.Combine(Base(job), which);

    public static InSpec? In(JsonElement proc)
    {
        if (!proc.TryGetProperty("files", out var f) || !f.TryGetProperty("in", out var i) || i.ValueKind != JsonValueKind.Object) return null;
        var pattern = i.TryGetProperty("pattern", out var p) ? p.GetString() ?? "*" : "*";
        return new InSpec(pattern.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            i.TryGetProperty("mode", out var m) ? m.GetString() ?? "one" : "one",
            i.TryGetProperty("order", out var o) ? o.GetString() ?? "name" : "name",
            !(i.TryGetProperty("required", out var r) && r.ValueKind == JsonValueKind.False),
            i.TryGetProperty("param", out var pa) ? pa.GetString() : null);
    }

    public static OutSpec? Out(JsonElement proc)
    {
        if (!proc.TryGetProperty("files", out var f) || !f.TryGetProperty("out", out var o) || o.ValueKind != JsonValueKind.Object) return null;
        return new OutSpec(o.TryGetProperty("many", out var m) && m.ValueKind == JsonValueKind.True, o.TryGetProperty("ext", out var e) ? e.GetString() : null, o.TryGetProperty("param", out var p) ? p.GetString() : null);
    }

    /// <summary>Wartende Eingänge (für die Oberfläche): Name, Grösse, Alter — nichts wird angefasst.</summary>
    public List<(string Name, long Bytes, DateTimeOffset At)> Waiting(JobState job, InSpec? spec)
    {
        var dir = Fach(job, "in");
        if (!Directory.Exists(dir)) return new();
        return Candidates(dir, spec ?? new InSpec(["*"], "all", "name", true, null)).Select(f => (f.Name, f.Length, new DateTimeOffset(f.LastWriteTimeUtc))).ToList();
    }

    private static IEnumerable<FileInfo> Candidates(string dir, InSpec spec)
    {
        var info = new DirectoryInfo(dir);
        var all = spec.Patterns.SelectMany(p => info.EnumerateFiles(p)).DistinctBy(f => f.FullName)
            .Where(f => !f.Name.StartsWith('.') && !f.Name.EndsWith(".part", StringComparison.OrdinalIgnoreCase) && !f.Name.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase));
        return spec.Order == "time" ? all.OrderBy(f => f.LastWriteTimeUtc).ThenBy(f => f.Name, StringComparer.OrdinalIgnoreCase) : all.OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Vor dem Lauf: Eingang wählen (Duplikate nach done/, ohne Lauf), Ausgabeort festlegen, Platzhalter füllen.
    /// Liefert null mit <paramref name="skip"/>, wenn der Eingang leer ist und der Prozess einen braucht.
    /// </summary>
    public Plan? Prepare(JobState job, JsonElement proc, string run, Dictionary<string, string> values, Action<string, object> journal, out string? skip)
    {
        skip = null;
        var stamp = $"{job.Key}-{DateTimeOffset.Now:yyyyMMdd-HHmmss}-{run}";
        var picked = new List<Picked>(); string? inDir = null, outFile = null, outDir = null; var many = false;
        if (In(proc) is { } spec)
        {
            inDir = Fach(job, "in"); Directory.CreateDirectory(inDir); Directory.CreateDirectory(Fach(job, "done")); Directory.CreateDirectory(Fach(job, "failed"));
            foreach (var f in Candidates(inDir, spec).ToList())
            {
                if ((DateTime.UtcNow - f.LastWriteTimeUtc).TotalSeconds < 3) continue;   // wird gerade geschrieben (ERP, SFTP) — nächster Takt
                var hash = Sha(f.FullName);
                if (job.ConsumedHashes.Contains(hash))
                {   // Duplikat nach Inhalt: nach done/, Beleg ohne Lauf, kein Import
                    var target = Unique(Path.Combine(Fach(job, "done"), $"{DateTimeOffset.Now:yyyyMMdd-HHmmss}-dup-{f.Name}"));
                    File.Move(f.FullName, target);
                    journal(Types.JobFileConsumed, new JobFileConsumed("", f.Name, hash, f.Length, "duplicate"));
                    continue;
                }
                picked.Add(new Picked(f.FullName, f.Name, hash, f.Length));
                if (spec.Mode != "all") break;
            }
            if (picked.Count == 0 && spec.Required) { skip = $"Eingang leer — nichts in {inDir}"; return null; }
            if (picked.Count > 0)
            {
                values["inFile"] = picked[0].Path; values["inDir"] = inDir;
                if (spec.Param is { } p && (!values.TryGetValue(p, out var have) || have.Length == 0)) values[p] = spec.Mode == "all" ? inDir : picked[0].Path;
            }
        }
        if (Out(proc) is { } o)
        {
            var outBase = Fach(job, "out"); Directory.CreateDirectory(outBase);
            many = o.Many;
            if (many) { outDir = Path.Combine(outBase, stamp); Directory.CreateDirectory(outDir); values["outDir"] = outDir; }
            else { outFile = Path.Combine(outBase, stamp + (o.Ext is { Length: > 0 } e ? "." + e.TrimStart('.') : "")); values["outFile"] = outFile; }
            if (o.Param is { } p && (!values.TryGetValue(p, out var have) || have.Length == 0)) values[p] = many ? outDir! : outFile!;
        }
        return new Plan(picked, inDir, outFile, outDir, many, stamp);
    }

    /// <summary>
    /// Nach dem Lauf: Eingänge nach done/ oder failed/ (mit Log daneben), Ausgaben belegen, latest kopieren, Aufbewahrung, Archiv.
    /// Alles, was schiefgeht, landet in <paramref name="log"/> — der Lauf selbst ist schon beurteilt.
    /// </summary>
    public async Task Finish(JobState job, Plan plan, string run, bool ok, string logPath, Action<string, object> journal, Func<string, string, Task<string?>> archive, Action<string> log)
    {
        var now = DateTimeOffset.Now.ToString("yyyyMMdd-HHmmss");
        foreach (var p in plan.In)
        {
            try
            {
                var fach = Fach(job, ok ? "done" : "failed");
                var target = Unique(Path.Combine(fach, $"{now}-{run}-{p.Name}"));
                if (File.Exists(p.Path)) File.Move(p.Path, target);
                if (!ok && File.Exists(logPath)) File.Copy(logPath, target + ".log", overwrite: true);
                string? mediaId = null;
                if (ok && job.Files?.Archive == true) mediaId = await archive(target, p.Name);
                journal(Types.JobFileConsumed, new JobFileConsumed(run, p.Name, p.Hash, p.Bytes, ok ? "ok" : "failed", mediaId));
            }
            catch (Exception e) { log($"Eingang {p.Name}: {e.Message}"); }
        }
        if (!ok) { if (plan.OutDir is not null) TryDeleteEmpty(plan.OutDir); return; }
        var outBase = Fach(job, "out");
        var written = new List<(string Path, string Name)>();
        if (plan.OutDir is not null && Directory.Exists(plan.OutDir))
            written.AddRange(Directory.EnumerateFiles(plan.OutDir, "*", SearchOption.AllDirectories).Select(f => (f, Path.GetRelativePath(plan.OutDir, f))));
        else if (plan.OutFile is not null && File.Exists(plan.OutFile)) written.Add((plan.OutFile, Path.GetFileName(plan.OutFile)));
        if (written.Count == 0) { if (plan.OutDir is not null) TryDeleteEmpty(plan.OutDir); }
        var latest = job.Files?.Latest == true && written.Count > 0;
        foreach (var (path, name) in written)
        {
            try
            {
                var fi = new FileInfo(path); var hash = Sha(path);
                string? mediaId = null;
                if (job.Files?.Archive == true) mediaId = await archive(path, name);
                journal(Types.JobFileWritten, new JobFileWritten(run, plan.Many ? Path.Combine(Path.GetFileName(plan.OutDir!), name) : name, hash, fi.Length, latest, mediaId));
            }
            catch (Exception e) { log($"Ausgabe {name}: {e.Message}"); }
        }
        if (latest)
        {   // Kopie, kein Link — der stabile Name für den, der abholt
            try
            {
                if (plan.Many)
                {
                    var dir = Path.Combine(outBase, $"{job.Key}-latest");
                    if (Directory.Exists(dir)) Directory.Delete(dir, true);
                    Directory.CreateDirectory(dir);
                    foreach (var (path, name) in written) { var t = Path.Combine(dir, name); Directory.CreateDirectory(Path.GetDirectoryName(t)!); File.Copy(path, t, true); }
                }
                else File.Copy(plan.OutFile!, Path.Combine(outBase, $"{job.Key}-latest{Path.GetExtension(plan.OutFile!)}"), true);
            }
            catch (Exception e) { log($"latest: {e.Message}"); }
        }
        Keep(job, outBase, log);
    }

    /// <summary>Aufbewahrung der Ausgaben: „n“ = n Läufe, „nd“ = n Tage, leer = alle. Gelöscht wird nur, was der Tasker benannt hat (Präfix &lt;key&gt;-…), nie latest.</summary>
    private static void Keep(JobState job, string outBase, Action<string> log)
    {
        var keep = (job.Files?.Keep ?? "").Trim().ToLowerInvariant();
        if (keep.Length == 0 || !Directory.Exists(outBase)) return;
        var prefix = job.Key + "-";
        var runs = Directory.EnumerateFileSystemEntries(outBase).Where(p => Path.GetFileName(p).StartsWith(prefix) && !Path.GetFileName(p).StartsWith(prefix + "latest"))
            .Select(p => (Path: p, Name: Path.GetFileName(p), At: Directory.Exists(p) ? Directory.GetLastWriteTimeUtc(p) : File.GetLastWriteTimeUtc(p)))
            .OrderByDescending(x => x.Name, StringComparer.Ordinal).ToList();   // der Stempel sortiert: neueste zuerst
        IEnumerable<(string Path, string Name, DateTime At)> gone;
        if (keep.EndsWith('d') && int.TryParse(keep[..^1], out var days)) gone = runs.Where(x => x.At < DateTime.UtcNow.AddDays(-days));
        else if (int.TryParse(keep, out var n)) gone = runs.Skip(Math.Max(0, n));
        else return;
        foreach (var g in gone.ToList())
        {
            try { if (Directory.Exists(g.Path)) Directory.Delete(g.Path, true); else File.Delete(g.Path); }
            catch (Exception e) { log($"Aufbewahrung {g.Name}: {e.Message}"); }
        }
    }

    private static string Unique(string path)
    {
        if (!File.Exists(path)) return path;
        var dir = Path.GetDirectoryName(path)!; var name = Path.GetFileNameWithoutExtension(path); var ext = Path.GetExtension(path);
        for (var i = 2; ; i++) { var p = Path.Combine(dir, $"{name}({i}){ext}"); if (!File.Exists(p)) return p; }
    }

    private static void TryDeleteEmpty(string dir) { try { if (Directory.Exists(dir) && !Directory.EnumerateFileSystemEntries(dir).Any()) Directory.Delete(dir); } catch { } }

    public static string Sha(string path)
    {
        using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite, 1 << 16);
        return Convert.ToHexString(SHA256.HashData(fs)).ToLowerInvariant();
    }
}
