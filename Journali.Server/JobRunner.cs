using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Jobs laufen im Server, nicht im Browser (Taloan, 19.09.2026: „Jobs wie Import dürfen nicht vom offenen Browserfenster
/// abhängen“). Ein Job ist ein Prozess-Plugin mit Parametern; der Runner startet ihn als Kindprozess (nie im
/// Serverprozess selbst), schreibt die Ausgabe in eine Logdatei unter JOURNALI_JOBS und die Eckdaten ins Journal
/// (JobRunStarted/JobRunFinished). Der Zeitplan ist cron mit fünf Feldern, geprüft je Minute; je Job läuft höchstens
/// ein Lauf zugleich. Geheimnisse (Token) stehen in jobs/secrets.json, nie im Journal, und gehen als {param} an den Prozess.
/// </summary>
public sealed class JobRunner : BackgroundService
{
    private readonly Catalog _catalog;
    private readonly string _pluginDir;
    private readonly ILogger<JobRunner> _log;
    private readonly Dictionary<string, (Process Process, CancellationTokenSource Cancel, string Run)> _running = new();
    private readonly object _gate = new();
    private DateTimeOffset _lastMinute;
    public string Dir { get; }
    public string PluginDir => _pluginDir;
    public string Origin { get; set; } = "http://localhost:5000";

    public JobRunner(Catalog catalog, string pluginDir, string jobDir, ILogger<JobRunner> log)
    {
        _catalog = catalog; _pluginDir = pluginDir; _log = log; Dir = jobDir;
        Directory.CreateDirectory(jobDir);
        _lastMinute = Floor(DateTimeOffset.Now);
    }

    private static DateTimeOffset Floor(DateTimeOffset t) => new(t.Year, t.Month, t.Day, t.Hour, t.Minute, 0, t.Offset);

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        while (!stop.IsCancellationRequested)
        {
            try { Tick(); } catch (Exception e) { _log.LogError(e, "Job-Takt"); }
            try { await Task.Delay(TimeSpan.FromSeconds(20), stop); } catch (OperationCanceledException) { }
        }
        lock (_gate) foreach (var (_, r) in _running) { try { r.Process.Kill(true); } catch { } }
    }

    /// <summary>Jede Minute seit dem letzten Takt: welche Jobs sind fällig? Verpasste Minuten (Server stand) werden nicht nachgeholt, nur die letzten 5.</summary>
    private void Tick()
    {
        var now = Floor(DateTimeOffset.Now);
        if (now <= _lastMinute) return;
        var from = _lastMinute.AddMinutes(1); if ((now - from).TotalMinutes > 5) from = now.AddMinutes(-5);
        _lastMinute = now;
        var jobs = _catalog.With((_, _, _) => _catalog.Jobs.All.Values.Where(j => j.Enabled && j.Schedule is not null).Select(j => (j.Key, j.Schedule!)).ToList());
        foreach (var (key, schedule) in jobs)
        {
            if (!Cron.TryParse(schedule, out var cron)) continue;
            for (var t = from; t <= now; t = t.AddMinutes(1))
                if (cron.Matches(t)) { Start(key, "schedule", out _); break; }
        }
    }

    /// <summary>Was Rückgängig/Vorschau brauchen: wann der Job das nächste Mal fällig ist.</summary>
    public static DateTimeOffset? NextDue(string? schedule)
    {
        if (schedule is null || !Cron.TryParse(schedule, out var cron)) return null;
        var t = Floor(DateTimeOffset.Now).AddMinutes(1);
        for (var i = 0; i < 366 * 24 * 60; i++, t = t.AddMinutes(1)) if (cron.Matches(t)) return t;
        return null;
    }

    public bool IsRunning(string key) { lock (_gate) return _running.ContainsKey(key); }

    /// <summary>Lauf starten — sofort zurück; der Prozess läuft weiter, der Ausgang kommt ins Journal.</summary>
    public string? Start(string key, string trigger, out string? error)
    {
        error = null;
        lock (_gate) if (_running.ContainsKey(key)) { error = "läuft schon"; return null; }
        var job = _catalog.With((_, _, _) => _catalog.Jobs.All.GetValueOrDefault(key));
        if (job is null) { error = "unbekannter Job"; return null; }
        var state = _catalog.With((_, _, _) => _catalog.Plugins.All.GetValueOrDefault(job.Plugin));
        if (state is null || !state.Enabled) { error = $"Plugin {job.Plugin} ist nicht installiert oder aus"; return null; }
        if (!PluginApi.Scan(_pluginDir).TryGetValue(job.Plugin, out var m) || !m.Raw.TryGetProperty("process", out var proc)) { error = $"Plugin {job.Plugin} hat keinen Prozess"; return null; }
        var run = DateTimeOffset.Now.ToString("yyyyMMdd-HHmmss") + "-" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(2)).ToLowerInvariant();
        var actor = "job:" + key;
        var values = new Dictionary<string, string>(job.Params) { ["journali"] = Origin, ["actor"] = actor, ["job"] = key, ["run"] = run };
        foreach (var (k, v) in Secrets.Get(Dir, key)) values[k] = v;
        ProcessStartInfo psi;
        try { psi = PluginApi.BuildProcess(_pluginDir, job.Plugin, proc, values); }
        catch (Exception e) { error = e.Message; return null; }
        var logDir = Path.Combine(Dir, key); Directory.CreateDirectory(logDir);
        var logPath = Path.Combine(logDir, run + ".log");
        Process p;
        try { p = Process.Start(psi) ?? throw new InvalidOperationException("Prozess startet nicht"); }
        catch (Exception e) { error = $"Prozess {psi.FileName} startet nicht: {e.Message}"; return null; }
        var cts = new CancellationTokenSource();
        lock (_gate) _running[key] = (p, cts, run);
        _catalog.With((_, _, write) => write(actor, Jobs.Stream + key, Types.JobRunStarted, new JobRunStarted(run, trigger), null));
        _ = Task.Run(() => Watch(key, job.TimeoutMinutes, run, p, cts, logPath, actor));
        return run;
    }

    private async Task Watch(string key, int timeoutMinutes, string run, Process p, CancellationTokenSource cts, string logPath, string actor)
    {
        var sw = Stopwatch.StartNew();
        var status = "ok"; string? last = null;
        await using var log = new StreamWriter(logPath, false, new UTF8Encoding(false)) { AutoFlush = true };
        var writeLock = new object();
        void Line(string prefix, string? s) { if (s is null) return; lock (writeLock) { log.WriteLine($"{DateTime.Now:HH:mm:ss} {prefix}{s}"); } if (prefix.Length == 0 && s.Length > 0) last = s; }
        p.OutputDataReceived += (_, e) => Line("", e.Data);
        p.ErrorDataReceived += (_, e) => Line("! ", e.Data);
        p.BeginOutputReadLine(); p.BeginErrorReadLine();
        try
        {
            cts.CancelAfter(TimeSpan.FromMinutes(Math.Max(1, timeoutMinutes)));
            await p.WaitForExitAsync(cts.Token);
            p.WaitForExit();   // Ausgabe zu Ende lesen
            status = p.ExitCode switch { 0 => "ok", 3 => "warn", _ => "failed" };   // 3 = mit Warnungen (übersprungene Befehle) — Vereinbarung mit den Prozess-Plugins
        }
        catch (OperationCanceledException)
        {
            status = _cancelled.Remove(key) ? "cancelled" : "timeout";
            try { p.Kill(true); } catch { }
            Line("! ", status == "timeout" ? $"Zeitgrenze {timeoutMinutes} min — abgebrochen" : "abgebrochen");
        }
        finally
        {
            lock (_gate) _running.Remove(key);
            var exit = 0; try { exit = p.ExitCode; } catch { }
            var bytes = 0L; try { log.Flush(); bytes = new FileInfo(logPath).Length; } catch { }
            var summary = last is { Length: > 0 } ? (last.Length > 200 ? last[..200] : last) : null;
            try { _catalog.With((_, _, write) => write(actor, Jobs.Stream + key, Types.JobRunFinished, new JobRunFinished(run, status, exit, Math.Round(sw.Elapsed.TotalSeconds, 1), summary, bytes), null)); }
            catch (Exception e) { _log.LogError(e, "Job {Key}: Ausgang nicht geschrieben", key); }
            p.Dispose();
        }
    }

    private readonly HashSet<string> _cancelled = new();
    public bool Cancel(string key)
    {
        lock (_gate)
        {
            if (!_running.TryGetValue(key, out var r)) return false;
            _cancelled.Add(key); r.Cancel.Cancel(); return true;
        }
    }

    public string? RunningId(string key) { lock (_gate) return _running.TryGetValue(key, out var r) ? r.Run : null; }
    public string LogPath(string key, string run) => Path.Combine(Dir, key, run + ".log");
}

/// <summary>Geheimnisse der Jobs (Token, Passwörter): jobs/secrets.json — nie im Journal, nie im Repo (jobs/ ist ignoriert).</summary>
public static class Secrets
{
    private static readonly object Gate = new();
    private static string File(string dir) => Path.Combine(dir, "secrets.json");
    private static Dictionary<string, Dictionary<string, string>> Load(string dir)
    {
        try { return System.IO.File.Exists(File(dir)) ? JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, string>>>(System.IO.File.ReadAllText(File(dir))) ?? new() : new(); }
        catch { return new(); }
    }
    public static Dictionary<string, string> Get(string dir, string key) { lock (Gate) return Load(dir).GetValueOrDefault(key) ?? new(); }
    public static void Set(string dir, string key, Dictionary<string, string?> values)
    {
        lock (Gate)
        {
            var all = Load(dir); var mine = all.GetValueOrDefault(key) ?? new();
            foreach (var (k, v) in values) { if (string.IsNullOrEmpty(v)) mine.Remove(k); else mine[k] = v; }
            if (mine.Count == 0) all.Remove(key); else all[key] = mine;
            Directory.CreateDirectory(dir);
            System.IO.File.WriteAllText(File(dir), JsonSerializer.Serialize(all, new JsonSerializerOptions { WriteIndented = true }));
        }
    }
    public static void Remove(string dir, string key) { lock (Gate) { var all = Load(dir); if (all.Remove(key)) System.IO.File.WriteAllText(File(dir), JsonSerializer.Serialize(all)); } }
}

/// <summary>cron mit fünf Feldern: Minute Stunde Tag Monat Wochentag — *, n, a-b, */n, a,b; Wochentag 0–7 (0 und 7 = Sonntag).
/// Tag und Wochentag gelten zusammen (UND) — „15-21 * 0“ ist der 3. Sonntag im Monat. Sechstes Feld (Taloan, 19.09.: „jeden zweiten“):
/// dN:JJJJ-MM-TT = nur alle N Tage ab dem Datum, wN:JJJJ-MM-TT = nur alle N Wochen ab dem Datum (Woche = 7 Tage ab Anker).</summary>
public sealed class Cron
{
    private readonly bool[][] _f = new bool[5][];
    private char _everyKind; private int _everyN; private DateOnly _anchor;
    private static readonly int[] Min = [0, 0, 1, 1, 0], Max = [59, 23, 31, 12, 7];

    public static bool TryParse(string s, out Cron cron)
    {
        cron = new Cron();
        var parts = s.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 6)
        {
            var e = parts[5]; var colon = e.IndexOf(':');
            if (e.Length < 4 || (e[0] != 'd' && e[0] != 'w') || colon < 2 || !int.TryParse(e[1..colon], out var n) || n < 1 || !DateOnly.TryParseExact(e[(colon + 1)..], "yyyy-MM-dd", out var anchor)) return false;
            cron._everyKind = e[0]; cron._everyN = n; cron._anchor = anchor;
        }
        else if (parts.Length != 5) return false;
        for (var i = 0; i < 5; i++)
        {
            var set = new bool[Max[i] + 1];
            foreach (var item in parts[i].Split(','))
            {
                var (range, step) = item.Contains('/') ? (item[..item.IndexOf('/')], item[(item.IndexOf('/') + 1)..]) : (item, "1");
                if (!int.TryParse(step, out var st) || st < 1) return false;
                int lo, hi;
                if (range == "*") { lo = Min[i]; hi = Max[i]; }
                else if (range.Contains('-')) { var ab = range.Split('-'); if (ab.Length != 2 || !int.TryParse(ab[0], out lo) || !int.TryParse(ab[1], out hi)) return false; }
                else { if (!int.TryParse(range, out lo)) return false; hi = st > 1 ? Max[i] : lo; }
                if (lo < Min[i] || hi > Max[i] || lo > hi) return false;
                for (var v = lo; v <= hi; v += st) set[v] = true;
            }
            if (i == 4 && set[7]) set[0] = true;
            cron._f[i] = set;
        }
        return true;
    }

    public bool Matches(DateTimeOffset t) => _f[0][t.Minute] && _f[1][t.Hour] && _f[2][t.Day] && _f[3][t.Month] && _f[4][(int)t.DayOfWeek] && Every(t);
    private bool Every(DateTimeOffset t)
    {
        if (_everyKind == '\0') return true;
        var days = DateOnly.FromDateTime(t.LocalDateTime).DayNumber - _anchor.DayNumber;
        var unit = _everyKind == 'w' ? (int)Math.Floor(days / 7.0) : days;
        return ((unit % _everyN) + _everyN) % _everyN == 0;
    }

    /// <summary>In Worten, für die Liste: „täglich 02:00“, „alle 15 min“, „Mo–Fr 06:30“ … sonst der Ausdruck selbst.</summary>
    public static string Describe(string? s)
    {
        if (s is null) return "nur von Hand";
        var p = s.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var every = "";
        if (p.Length == 6 && TryParse(s, out var c6)) { every = c6._everyN > 1 ? $" · alle {c6._everyN} {(c6._everyKind == 'w' ? "Wochen" : "Tage")}" : ""; p = p[..5]; }
        if (p.Length != 5) return s;
        var days = new[] { "So", "Mo", "Di", "Mi", "Do", "Fr", "Sa" };
        var nth = p[2] switch { "1-7" => "1. ", "8-14" => "2. ", "15-21" => "3. ", "22-28" => "4. ", _ => "" };
        string Dow(string d) => d == "*" ? "" : d == "1-5" ? "Mo–Fr " : d == "0,6" || d == "6,0" ? "Sa/So " : string.Join(",", d.Split(',').Select(x => int.TryParse(x, out var n) && n >= 0 && n <= 7 ? days[n % 7] : x)) + " ";
        if (p[0].StartsWith("*/") && p[1] == "*" && p[2] == "*" && p[3] == "*" && p[4] == "*") return $"alle {p[0][2..]} min";
        if (p[0] == "0" && p[1].StartsWith("*/") && p[2] == "*" && p[3] == "*" && p[4] == "*") return $"alle {p[1][2..]} h";
        if (p[0] == "*" && p[1] == "*" && p[2] == "*" && p[3] == "*" && p[4] == "*") return "jede Minute";
        if (int.TryParse(p[0], out var mi) && int.TryParse(p[1], out var h) && p[2] == "*" && p[3] == "*") return $"{(p[4] == "*" ? "täglich" : Dow(p[4]).Trim())} {h:00}:{mi:00}{every}";
        if (int.TryParse(p[0], out mi) && int.TryParse(p[1], out h) && nth.Length > 0 && p[3] == "*" && p[4] != "*") return $"{nth}{Dow(p[4]).Trim()} im Monat {h:00}:{mi:00}";
        if (int.TryParse(p[0], out mi) && int.TryParse(p[1], out h) && int.TryParse(p[2], out var d) && p[4] == "*") return $"{(p[3] == "*" ? "monatlich" : p[3].StartsWith("*/") ? $"alle {p[3][2..]} Monate" : "Monat " + p[3])} am {d}. {h:00}:{mi:00}";
        return s + every;
    }
}
