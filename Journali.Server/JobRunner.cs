using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Jobs laufen im Server, nicht im Browser. Ein Job ist ein Prozess-Plugin mit Parametern; der Runner startet ihn als Kindprozess (nie im
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
    /// <summary>Die Fächer (in/done/failed/out je Job, docs/tasker-dateien.md).</summary>
    public JobFach Fach { get; }
    /// <summary>Medienspeicher fürs Archiv (Files.Archive) — vom Programm gesetzt.</summary>
    public IMediaStore? Store { get; set; }

    /// <summary>
    /// Der Stand eines Systemjobs: wie viele Posten offen sind. Das Programm setzt die Funktion — sie fragt den
    /// <c>progress</c>-Endpunkt aus dem Manifest, denselben, den die Kachel im Tasker zeigt.
    /// </summary>
    public Func<string, Task<int>>? Offen { get; set; }

    // ---- Mehrere Server (pflegestruktur 41): der Hauptserver führt die Systemjobs aus, jeder andere Job läuft auf seinem Server ----
    /// <summary>Ist dieser Server Hauptserver? Nur er führt Systemjobs aus. Ohne Verbund immer.</summary>
    public Func<bool> IstHaupt { get; set; } = () => true;
    /// <summary>Die Kennung dieses Servers — null ohne Verbund: dann läuft alles hier.</summary>
    public string? HierId { get; set; }
    /// <summary>Der festgelegte Hauptserver (null = noch keiner).</summary>
    public Func<string?> HauptId { get; set; } = () => null;
    /// <summary>Über welches Team ein Job abgerechnet wird (Schlüssel des Jobs → Team) und wie das Team heisst — für die Jobliste.</summary>
    public Func<string, string?>? TeamDes { get; set; }
    public Func<string, string?>? TeamName { get; set; }
    /// <summary>Was ein Joblauf dieses Teams noch schreiben darf (Woche, Monat) — für die Warnung vor einem Import.</summary>
    public Func<string?, (int Woche, int Monat)?>? Verfuegbar { get; set; }
    /// <summary>Name eines Servers für Meldungen und die Jobliste.</summary>
    public Func<string, string> ServerName { get; set; } = id => id;
    /// <summary>Läuft auf einem anderen Server ein Import? Dann warten die Läufe hier wie bei einem eigenen Import.</summary>
    public Func<bool> ImportAnderswo { get; set; } = () => false;
    /// <summary>Einen Auftrag an einen anderen Server geben (an, art: start | pause | resume | cancel, Job, Auslöser) — Ergebnis oder Fehler.</summary>
    public Func<string, string, string, string?, (string? Ergebnis, string? Fehler)>? AnServer { get; set; }
    /// <summary>Was auf den anderen Servern gerade läuft (aus ihrem Puls).</summary>
    public Func<IReadOnlyList<Laufend>> Anderswo { get; set; } = () => [];
    /// <summary>Das Log eines laufenden Laufs hat sich geändert / der Lauf ist zu Ende (Job, Lauf, Datei) — der Verbund schreibt es in die Datenbank.</summary>
    public Action<string, string, string>? LogFertig { get; set; }

    private Laufend? Fern(string key) => Anderswo().FirstOrDefault(l => l.Key == key);

    /// <summary>Auslöser eines Trockenlaufs.</summary>
    public const string Trocken = "trocken";
    /// <summary>Die Zeile, mit der ein Prozess meldet, wie viele Einträge er schreibt oder schreiben würde: <c>journali:eintraege=12345</c>.</summary>
    public const string EintraegeZeile = "journali:eintraege=";
    /// <summary>Der Parameter, der einen Prozess zum Trockenlauf macht — <c>dryRun</c> oder <c>dry_run</c>; null = er kennt keinen.</summary>
    public static string? TrockenParam(JsonElement proc) =>
        proc.TryGetProperty("params", out var ps) && ps.ValueKind == JsonValueKind.Array
            ? ps.EnumerateArray().Select(x => x.TryGetProperty("key", out var k) ? k.GetString() : null)
                .FirstOrDefault(k => k is not null && k.Replace("_", "").Equals("dryrun", StringComparison.OrdinalIgnoreCase))
            : null;

    /// <summary>Was ein Job kann: Trockenlauf, und ob er ein Import ist (Vorfahrt, Warnung vor dem Kontingent). Aus dem Manifest, eine halbe Minute gemerkt.</summary>
    public (bool Trockenlauf, bool Import) Art(JobState j)
    {
        Manifeste();
        if (!_manifeste.TryGetValue(j.Plugin, out var m) || PluginApi.ProcessOf(m.Raw, j.Service) is not { } proc) return (false, false);
        return (TrockenParam(proc) is not null, IstImport(m.Raw, j.Service));
    }
    private Dictionary<string, PluginApi.Manifest> _manifeste = new();
    private DateTime _manifesteAm = DateTime.MinValue;
    private void Manifeste()
    {
        if (DateTime.UtcNow - _manifesteAm < TimeSpan.FromSeconds(30)) return;
        _manifeste = PluginApi.Scan(_pluginDir); _manifesteAm = DateTime.UtcNow;
    }

    /// <summary>Ist das Plugin ein Systemjob (<c>system: true</c> im Manifest)? Die Manifeste werden für eine halbe Minute gemerkt.</summary>
    public bool IstSystemjob(string plugin)
    {
        if (DateTime.UtcNow - _systemAm > TimeSpan.FromSeconds(30))
        {
            _system = PluginApi.Scan(_pluginDir).Where(kv => kv.Value.Raw.TryGetProperty("system", out var sy) && sy.ValueKind == JsonValueKind.True).Select(kv => kv.Key).ToHashSet();
            _systemAm = DateTime.UtcNow;
        }
        return _system.Contains(plugin);
    }
    private HashSet<string> _system = new();
    private DateTime _systemAm = DateTime.MinValue;

    /// <summary>Auf welchem Server läuft dieser Job? Ein Systemjob auf dem Hauptserver, jeder andere auf seinem Server, ohne Angabe auf dem Hauptserver.</summary>
    public string? Ziel(JobState j) => IstSystemjob(j.Plugin) ? HauptId() : j.Server ?? HauptId();
    /// <summary>Läuft dieser Job hier? Ohne Verbund immer; ein Systemjob nur auf dem Hauptserver, der die Sperre hält.</summary>
    public bool Hier(JobState j) => HierId is null || (IstSystemjob(j.Plugin) ? IstHaupt() : Ziel(j) == HierId);

    /// <summary>Einen Auftrag an den Server des Jobs geben. Null = der Job läuft hier (der Aufrufer macht es selbst).</summary>
    private (string? Ergebnis, string? Fehler)? Weiter(string key, string art, string? ausloeser)
    {
        if (HierId is null) return null;
        var job = _catalog.Lesen((_, _) => _catalog.Jobs.All.GetValueOrDefault(key));
        if (job is null || Hier(job)) return null;
        if (Ziel(job) is not { } an) return (null, "Kein Hauptserver festgelegt.");
        if (an == HierId) return null;   // dieser Server ist gemeint, hält aber die Sperre des Hauptservers gerade nicht: hier, statt an sich selbst
        if (AnServer is null) return (null, "Der Job läuft auf einem anderen Server.");
        return AnServer(an, art, key, ausloeser);
    }

    public JobRunner(Catalog catalog, string pluginDir, string jobDir, ILogger<JobRunner> log)
    {
        _catalog = catalog; _pluginDir = pluginDir; _log = log; Dir = jobDir;
        Directory.CreateDirectory(jobDir);
        _lastMinute = Floor(DateTimeOffset.Now);
        Fach = new JobFach(jobDir);
    }

    private static DateTimeOffset Floor(DateTimeOffset t) => new(t.Year, t.Month, t.Day, t.Hour, t.Minute, 0, t.Offset);

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        while (!stop.IsCancellationRequested)
        {
            // Der Zeitplan nimmt nur die Jobs dieses Servers; die Systemjobs zieht nur der Hauptserver nach — auf zwei Servern liefen sie sonst doppelt
            try { Tick(); } catch (Exception e) { _log.LogError(e, "Job-Takt"); }
            if (IstHaupt()) try { await Nachziehen(stop); } catch (Exception e) { _log.LogError(e, "Systemjobs"); }
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
        // Ohne den Tarif dafür läuft nichts nach Zeitplan — von Hand geht weiter
        if (!_catalog.InstanzTarif.Zeitplan) return;
        var jobs = _catalog.Lesen((_, _) => _catalog.Jobs.All.Values.Where(j => j.Enabled && j.Schedule is not null).ToList()).Where(Hier).Select(j => (j.Key, j.Schedule!)).ToList();
        foreach (var (key, schedule) in jobs)
        {
            if (!Cron.TryParse(schedule, out var cron)) continue;
            for (var t = from; t <= now; t = t.AddMinutes(1))
                if (cron.Matches(t)) { Start(key, "schedule", out _); break; }
        }
    }

    private DateTimeOffset _letztesNachziehen = DateTimeOffset.MinValue;
    /// <summary>Je Job: wie viel beim letzten Start offen war, wann das war, und wie lange bis zum nächsten Versuch.</summary>
    private readonly Dictionary<string, (int Offen, DateTimeOffset Wann, TimeSpan Abstand)> _nachzug = new();

    /// <summary>Der längste Abstand, in dem ein Systemjob es noch einmal versucht.</summary>
    public static readonly TimeSpan NachzugMax = TimeSpan.FromHours(1);

    /// <summary>
    /// Wie lange bis zum nächsten Versuch? Hat der Lauf etwas bewirkt (die Zahl der offenen Posten hat sich
    /// geändert), geht es sofort weiter — eine Minute. Hat er nichts bewirkt, wird der Abstand schnell lang:
    /// 1 → 5 → 15 → 60. Jeder Lauf steht im Journal und in der Liste der Läufe; wer nichts findet, soll dort nicht
    /// jede Minute eine Zeile hinterlassen (28.09.2026).
    /// </summary>
    public static TimeSpan NaechsterAbstand(bool unveraendert, TimeSpan bisher)
    {
        if (!unveraendert) return TimeSpan.FromMinutes(1);
        var m = bisher.TotalMinutes;
        return TimeSpan.FromMinutes(m < 5 ? 5 : m < 15 ? 15 : NachzugMax.TotalMinutes);
    }

    /// <summary>
    /// Systemjobs holen auf. „Läuft von selbst“ heisst nicht „läuft nach der Uhr“, sondern: solange etwas offen ist,
    /// wird weitergearbeitet — ein Rückstand aus der Zeit vor dem Plugin bleibt sonst für immer liegen (28.09.2026).
    /// <para>Je Minute höchstens eine Runde; ein Job, der schon läuft, wird nicht noch einmal gestartet (das lehnt
    /// <see cref="Start"/> selbst ab). Ausgeschaltet zählt er nicht — der Schalter auf der Kachel ist die Bremse.
    /// Ohne Zeitplan im Tarif läuft er trotzdem: ein Systemjob ist keine Automatik nach der Uhr, sondern der
    /// Nachzieher zu dem, was ohnehin geschieht.</para>
    /// </summary>
    private async Task Nachziehen(CancellationToken stop)
    {
        if (Offen is null) return;
        if (ImportLaeuft) return;   // ein Import hat Vorfahrt: kein Nachzieher startet, solange er läuft
        var jetzt = DateTimeOffset.Now;
        if (jetzt - _letztesNachziehen < TimeSpan.FromMinutes(1)) return;
        _letztesNachziehen = jetzt;

        var kandidaten = _catalog.Lesen((_, _) => _catalog.Jobs.All.Values
            .Where(j => j.Enabled && j.Schedule is null)
            .Select(j => (j.Key, j.Plugin)).ToList());
        foreach (var (key, plugin) in kandidaten)
        {
            if (stop.IsCancellationRequested) return;
            lock (_gate) if (_running.ContainsKey(key)) continue;   // laeuft schon
            int offen;
            try { offen = await Offen(plugin); } catch { continue; }   // kein progress-Endpunkt oder nicht erreichbar
            if (offen <= 0) { _nachzug.Remove(key); continue; }

            // Rueckfall: bewirkt ein Lauf nichts, waechst der Abstand bis auf eine Stunde. Sonst startet der Takt
            // jede Minute einen Prozess ins Leere — etwa wenn der Job auf ein Preset eingeschraenkt ist, bei dem
            // nichts fehlt, waehrend der Zaehler ueber alle Presets zaehlt (28.09.2026)
            if (_nachzug.TryGetValue(key, out var v))
            {
                var abstand = offen == v.Offen ? v.Abstand : TimeSpan.FromMinutes(1);
                if (jetzt - v.Wann < abstand) continue;
                var neu = NaechsterAbstand(offen == v.Offen, abstand);
                _nachzug[key] = (offen, jetzt, neu);
                if (offen == v.Offen && neu >= TimeSpan.FromMinutes(8) && abstand < TimeSpan.FromMinutes(8))
                    _log.LogWarning("Systemjob {Job}: {Offen} offen, aber kein Lauf bewirkt etwas — Abstand jetzt {Min} min", key, offen, neu.TotalMinutes);
            }
            else _nachzug[key] = (offen, jetzt, TimeSpan.FromMinutes(1));

            Start(key, "nachziehen", out var fehler);
            if (fehler is not null && fehler != "läuft schon") _log.LogWarning("Systemjob {Job}: {Fehler}", key, fehler);
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

    public bool IsRunning(string key) { lock (_gate) if (_running.ContainsKey(key)) return true; return Fern(key) is not null; }

    /// <summary>Lauf starten — sofort zurück; der Prozess läuft weiter, der Ausgang kommt ins Journal.</summary>
    public string? Start(string key, string trigger, out string? error) => Start(key, trigger, weitergeben: true, out error);

    /// <param name="weitergeben">Läuft der Job auf einem anderen Server, geht der Start als Auftrag dorthin. Ein Auftrag selbst gibt nicht weiter —
    /// sähen zwei Server den Job für einen Moment verschieden (das Journal ist noch nicht nachgezogen), schöben sie ihn sonst hin und her.</param>
    private string? Start(string key, string trigger, bool weitergeben, out string? error)
    {
        error = null;
        lock (_gate) if (_running.ContainsKey(key)) { error = "läuft schon"; return null; }
        if (weitergeben && Weiter(key, "start", trigger) is { } fern) { error = fern.Fehler; return fern.Ergebnis; }
        var job = _catalog.Lesen((_, _) => _catalog.Jobs.All.GetValueOrDefault(key));
        if (job is null) { error = "unbekannter Job"; return null; }
        var state = _catalog.Lesen((_, _) => _catalog.Plugins.All.GetValueOrDefault(job.Plugin));
        if (state is null || !state.Enabled) { error = $"Plugin {job.Plugin} ist nicht installiert oder aus"; return null; }
        if (!_catalog.InstanzTarif.Erlaubt(job.Plugin)) { error = $"Plugin {job.Plugin} gehört nicht zum Tarif {_catalog.InstanzTarif.Label}"; return null; }
        if (!PluginApi.Scan(_pluginDir).TryGetValue(job.Plugin, out var m) || PluginApi.ProcessOf(m.Raw, job.Service) is not { } proc) { error = $"Plugin {job.Plugin} hat keinen Prozess {job.Service}"; return null; }
        var run = DateTimeOffset.Now.ToString("yyyyMMdd-HHmmss") + "-" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(2)).ToLowerInvariant();
        var actor = "job:" + key;
        // Trockenlauf (03.10.2026): derselbe Job, nur mit seinem Parameter „dryRun“ (oder „dry_run“) — er zählt, was er schreiben würde
        string? trockenParam = null;
        if (trigger == Trocken && (trockenParam = TrockenParam(proc)) is null) { error = $"Plugin {job.Plugin} kennt keinen Trockenlauf"; return null; }
        var token = Auth.IssueServiceToken(actor, job.Role);   // gilt fuer diesen Lauf (JOURNALI_TOKEN); der Prozess schickt ihn als Bearer
        var values = new Dictionary<string, string>(job.Params) { ["journali"] = Origin, ["actor"] = actor, ["job"] = key, ["run"] = run, ["token"] = token };
        foreach (var (k, v) in Secrets.Get(Dir, key)) values[k] = v;
        if (trockenParam is not null) values[trockenParam] = "true";
        // Profil: profile:<name> (sonst config:<name>) aus den Plugin-Daten im Journal
        // füllt jeden Parameter des Manifests, den der Job nicht selbst setzt — Ziel im Baum, Teilbaum, Format, Sprachen …
        if (job.Params.TryGetValue("profile", out var profName) && profName is { Length: > 0 } && ProfileOf(state, profName) is { } profile)
            foreach (var (k, v) in ProfileValues(proc, profile)) if (!values.TryGetValue(k, out var have) || have.Length == 0) values[k] = v;
        // Geheimnisse am Profil:
        // füllen, was der Job selbst nicht gesetzt hat
        if (job.Params.TryGetValue("profile", out var prof) && prof is { Length: > 0 })
            foreach (var (k, v) in Secrets.Get(Dir, Secrets.ProfileKey(job.Plugin, prof))) if (!values.TryGetValue(k, out var have) || have.Length == 0) values[k] = v;
        // Zugänge (28.09.2026): ein Parameter vom Typ driver nennt einen Zugang — der Prozess bekommt dessen Felder und
        // Geheimnisse als <param>_<feld>, also JOURNALI_<PARAM>_<FELD> (zugang_url, zugang_token). Das Geheimnis geht nur hierher, nie an den Browser.
        if (Zugaenge(_catalog, Dir, proc, values, out var zugangFehler) is false) { error = zugangFehler; return null; }
        // Eingang über einen Zugang: vor dem Lauf holen, was dort liegt — dann gilt es wie eine Datei in in/
        if (job.Files?.InZugang is { } inZugang && JobFach.In(proc) is { } inSpec)
        {
            if (DriverApi.Aufloesen(_catalog, Dir, inZugang) is not { } a || DriverApi.TreiberFuer(a.Zugang, Dir) is not { } t) { error = $"Zugang {inZugang} gibt es nicht oder er liefert keine Dateien"; return null; }
            try { Fach.Holen(job, t, job.Files.InPfad, inSpec, m => _log.LogWarning("Job {Key}: {Meldung}", key, m)).GetAwaiter().GetResult(); }
            catch (Exception e) { _log.LogWarning("Job {Key}: Eingang über {Zugang}: {Meldung}", key, inZugang, e.Message); }   // was im Fach liegt, läuft trotzdem
        }
        // Fächer: Eingang wählen (Duplikate weg), Ausgabeort festlegen, {inFile}/{inDir}/{outFile}/{outDir} füllen
        JobFach.Plan? plan;
        try
        {
            plan = Fach.Prepare(job, proc, run, values, (type, payload) => _catalog.With((_, _, write) => write(actor, Jobs.Stream + key, type, payload, null).Number), out var skip);
            if (plan is null) { error = skip; return null; }
        }
        catch (Exception e) { error = $"Fächer: {e.Message}"; return null; }
        ProcessStartInfo psi;
        try { psi = PluginApi.BuildProcess(_pluginDir, job.Plugin, proc, values); }
        catch (Exception e) { error = e.Message; return null; }
        var logDir = Path.Combine(Dir, key); Directory.CreateDirectory(logDir);
        var logPath = Path.Combine(logDir, run + ".log");
        Process p;
        try { p = Process.Start(psi) ?? throw new InvalidOperationException("Prozess startet nicht"); }
        catch (Exception e) { error = $"Prozess {psi.FileName} startet nicht: {e.Message}"; return null; }
        var cts = new CancellationTokenSource();
        var vorrang = IstImport(m.Raw, job.Service) && trigger != Trocken;   // ein Trockenlauf schreibt nichts: er hält die Systemjobs nicht an
        lock (_gate) { _running[key] = (p, cts, run); if (vorrang) _vorrang.Add(key); }
        _catalog.With((_, _, write) => write(actor, Jobs.Stream + key, Types.JobRunStarted, new JobRunStarted(run, trigger), null));
        _ = Task.Run(() => Watch(key, job.TimeoutMinutes, run, p, cts, logPath, actor, token, plan, job));
        return run;
    }

    private async Task Watch(string key, int timeoutMinutes, string run, Process p, CancellationTokenSource cts, string logPath, string actor, string token, JobFach.Plan plan, JobState job)
    {
        var sw = Stopwatch.StartNew();
        var status = "ok"; string? last = null;
        await using var log = new StreamWriter(logPath, false, new UTF8Encoding(false)) { AutoFlush = true };
        var writeLock = new object();
        int? eintraege = null;
        void Line(string prefix, string? s)
        {
            if (s is null) return;
            lock (writeLock) { log.WriteLine($"{DateTime.Now:HH:mm:ss} {prefix}{s}"); }
            // die Zahl der Einträge, die der Lauf schreibt oder schreiben würde — eine Zeile für den Tasker, nicht die letzte Zeile des Laufs
            if (prefix.Length == 0 && s.StartsWith(EintraegeZeile, StringComparison.Ordinal) && int.TryParse(s[EintraegeZeile.Length..], out var n)) { eintraege = n; return; }
            if (prefix.Length == 0 && s.Length > 0) last = s;
        }
        p.OutputDataReceived += (_, e) => Line("", e.Data);
        p.ErrorDataReceived += (_, e) => Line("! ", e.Data);
        p.BeginOutputReadLine(); p.BeginErrorReadLine();
        try
        {
            cts.CancelAfter(TimeSpan.FromMinutes(Math.Max(1, timeoutMinutes)));
            await p.WaitForExitAsync(cts.Token);
            p.WaitForExit();   // Ausgabe zu Ende lesen
            // 3 = mit Warnungen (übersprungene Befehle) — Vereinbarung mit den Prozess-Plugins. 2 beim Anhalten (ein Import hat Vorfahrt, oder von Hand):
            // der Lauf ist nicht gescheitert, die offenen Posten bleiben offen und der nächste Lauf findet dieselben. Sonst ist 2 ein Aufruffehler.
            var angehalten = IsPaused(key);
            status = p.ExitCode switch { 0 => "ok", 2 when angehalten => "ok", 3 => "warn", _ => "failed" };
        }
        catch (OperationCanceledException)
        {
            status = _cancelled.Remove(key) ? "cancelled" : "timeout";
            try { p.Kill(true); } catch { }
            Line("! ", status == "timeout" ? $"Zeitgrenze {timeoutMinutes} min — abgebrochen" : "abgebrochen");
        }
        finally
        {
            lock (_gate) { _running.Remove(key); _paused.Remove(key); _vorrang.Remove(key); }
            Auth.RevokeServiceToken(token);
            try { log.Flush(); LogFertig?.Invoke(key, run, logPath); } catch (Exception e) { _log.LogWarning("Job {Key}: Log nicht in die Datenbank geschrieben — {Meldung}", key, e.Message); }
            var exit = 0; try { exit = p.ExitCode; } catch { }
            var bytes = 0L; try { log.Flush(); bytes = new FileInfo(logPath).Length; } catch { }
            var summary = last is { Length: > 0 } ? (last.Length > 200 ? last[..200] : last) : null;
            // Fächer aufräumen: Eingang nach done/ oder failed/, Ausgaben belegen, latest, Aufbewahrung, Archiv — ins Log des Laufs
            if (plan.In.Count > 0 || plan.OutDir is not null || plan.OutFile is not null)
            {
                try
                {
                    // Ausgabe über einen Zugang: der Treiber wird einmal je Lauf gebaut
                    Func<string, string, Task>? ablegen = null;
                    if (job.Files?.OutZugang is { } outZugang)
                    {
                        if (DriverApi.Aufloesen(_catalog, Dir, outZugang) is { } a && DriverApi.TreiberFuer(a.Zugang, Dir) is { } t)
                            ablegen = async (datei, name) => { await JobFach.Ablegen(t, job.Files.OutPfad, datei, name); Line("→ ", $"{outZugang}: {name}"); };
                        else Line("! Fächer: ", $"Zugang {outZugang} gibt es nicht oder er liefert keine Dateien");
                    }
                    await Fach.Finish(job, plan, run, status is "ok" or "warn", logPath,
                        (type, payload) => _catalog.With((_, _, write) => write(actor, Jobs.Stream + key, type, payload, null).Number),
                        (path, name) => Archive(actor, path, name),
                        m => Line("! Fächer: ", m), ablegen);
                }
                catch (Exception e) { Line("! Fächer: ", e.Message); }
            }
            try { _catalog.With((_, _, write) => write(actor, Jobs.Stream + key, Types.JobRunFinished, new JobRunFinished(run, status, exit, Math.Round(sw.Elapsed.TotalSeconds, 1), summary, bytes, eintraege), null)); }
            catch (Exception e) { _log.LogError(e, "Job {Key}: Ausgang nicht geschrieben", key); }
            p.Dispose();
        }
    }

    /// <summary>Archiv (Files.Archive): die Datei als Medium im Medienspeicher — gleicher Hash = dasselbe Medium; liefert die Medien-Id.</summary>
    private async Task<string?> Archive(string actor, string path, string name)
    {
        if (Store is null) return null;
        await using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        var (sha, bytes) = await Store.PutAsync(fs, CancellationToken.None);
        var mime = Path.GetExtension(name).ToLowerInvariant() switch { ".json" => "application/json", ".xml" => "application/xml", ".csv" => "text/csv", ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".pdf" => "application/pdf", ".gz" => "application/gzip", ".html" => "text/html", ".txt" => "text/plain", _ => "application/octet-stream" };
        return _catalog.With((_, _, write) => _catalog.Media.BySha(sha)?.Id ?? write(actor, Ids.Media(), Types.MediaCreated, new MediaCreated(sha, bytes, mime, Path.GetFileName(name)), null).Stream);
    }

    private readonly HashSet<string> _cancelled = new();
    /// <summary>Wer gerade warten soll und warum. Im Speicher: nach einem Neustart läuft ohnehin nichts mehr.</summary>
    private readonly Dictionary<string, string> _paused = new();

    /// <summary>
    /// Anhalten — der Lauf stirbt nicht, er wartet beim nächsten Stapel. <paramref name="grund"/> steht in der
    /// Jobliste; „Kontingent“ setzt der Server selbst, wenn der Zähler voll ist. Fortgesetzt wird nur von Hand:
    /// sonst nähmen wartende Jobs das neue Kontingent im selben Moment wieder weg.
    /// </summary>
    public bool Pause(string key, string grund = "von Hand") => Pause(key, grund, weitergeben: true);
    private bool Pause(string key, string grund, bool weitergeben)
    {
        lock (_gate)
        {
            if (!_running.ContainsKey(key)) return weitergeben && Weiter(key, "pause", grund) is { Fehler: null };
            if (!_paused.ContainsKey(key)) _paused[key] = grund;
            return true;
        }
    }

    /// <summary>Weiter — das macht ein Mensch, nie der Server.</summary>
    public bool Resume(string key) => Resume(key, weitergeben: true);
    private bool Resume(string key, bool weitergeben)
    {
        lock (_gate) if (_running.ContainsKey(key)) return _paused.Remove(key);
        return weitergeben && Weiter(key, "resume", null) is { Fehler: null };
    }

    /// <summary>Soll dieser Lauf warten?</summary>
    public bool IsPaused(string key) { lock (_gate) if (_paused.ContainsKey(key) || VorfahrtGrund(key) is not null) return true; return Fern(key)?.Reason is not null; }

    /// <summary>Warum er wartet (null = er wartet nicht).</summary>
    public string? PauseReason(string key) { lock (_gate) if ((_paused.GetValueOrDefault(key) ?? VorfahrtGrund(key)) is { } g) return g; return Fern(key)?.Reason; }

    /// <summary>Läufe, die ein Import sind: sie haben Vorfahrt vor allem anderen, was der Server nebenher tut (Vektoren, Ableitungen,
    /// Dokumente lesen, Erkennen). Ein Import ist die Arbeit, auf die jemand wartet, und schreibt in dieselbe Datenbank.</summary>
    private readonly HashSet<string> _vorrang = new();

    /// <summary>Ein Import: ein Plugin der Art import (ixp, solr) oder der Dienst import eines Formats (csv, excel, json, xliff).</summary>
    public static bool IstImport(JsonElement manifest, string? service) =>
        service == "import" || (manifest.TryGetProperty("kind", out var k) && k.GetString() == "import");

    /// <summary>Läuft gerade ein Import?</summary>
    public bool ImportLaeuft { get { lock (_gate) return _vorrang.Count > 0 || ImportAnderswo(); } }

    /// <summary>Läuft hier ein Import (nur auf diesem Server)? Das meldet der Verbund an die anderen.</summary>
    public bool ImportHier { get { lock (_gate) return _vorrang.Count > 0; } }

    /// <summary>Die laufenden Jobs dieses Servers — für die Tabelle der Server und für die Jobliste eines Arbeitsservers.</summary>
    public List<Laufend> Laufende()
    {
        lock (_gate) return _running.Select(kv => new Laufend(kv.Key, kv.Value.Run, _paused.GetValueOrDefault(kv.Key) ?? VorfahrtGrund(kv.Key))).OrderBy(l => l.Key).ToList();
    }
    public sealed record Laufend(string Key, string Run, string? Reason);

    /// <summary>Wartet dieser laufende Job, weil ein Import Vorfahrt hat? Der Import selbst wartet nie darauf. Unter <c>_gate</c> aufrufen.</summary>
    private string? VorfahrtGrund(string key) => (_vorrang.Count > 0 || ImportAnderswo()) && _running.ContainsKey(key) && !_vorrang.Contains(key) ? "Import" : null;

    public bool Cancel(string key) => Cancel(key, weitergeben: true);
    private bool Cancel(string key, bool weitergeben)
    {
        lock (_gate)
        {
            if (!_running.TryGetValue(key, out var r)) return weitergeben && Weiter(key, "cancel", null) is { Fehler: null };
            _paused.Remove(key);   // wer abbricht, wartet nicht mehr
            _cancelled.Add(key); r.Cancel.Cancel(); return true;
        }
    }

    public string? RunningId(string key) { lock (_gate) if (_running.TryGetValue(key, out var r)) return r.Run; return Fern(key)?.Run; }

    /// <summary>
    /// Einen Auftrag eines anderen Servers hier ausführen. Für start ist das Ergebnis die Kennung des Laufs; „läuft schon“ ist kein Fehler,
    /// wenn ein Systemjob nachziehen soll — das entscheidet der Aufrufer wie bisher. Weitergegeben wird nichts.
    /// </summary>
    public (string? Ergebnis, string? Fehler) Ausfuehren(string art, string key, string? ausloeser)
    {
        switch (art)
        {
            case "start": { var run = Start(key, ausloeser ?? "manual", weitergeben: false, out var e); return (run, run is null ? e ?? "nicht gestartet" : null); }
            case "pause": return Pause(key, ausloeser ?? "von Hand", weitergeben: false) ? ("ok", null) : (null, "Der Job läuft nicht.");
            case "resume": return Resume(key, weitergeben: false) ? ("ok", null) : (null, "Der Job wartet nicht.");
            case "cancel": return Cancel(key, weitergeben: false) ? ("ok", null) : (null, "Der Job läuft nicht.");
            default: return (null, $"unbekannter Auftrag {art}");
        }
    }

    /// <summary>Die Logs der laufenden Läufe (Job, Lauf, Datei) — der Takt des Verbunds schreibt sie in die Datenbank.</summary>
    public List<(string Key, string Run, string Pfad)> LaufendeLogs() { lock (_gate) return _running.Select(kv => (kv.Key, kv.Value.Run, LogPath(kv.Key, kv.Value.Run))).ToList(); }
    public string LogPath(string key, string run) => Path.Combine(Dir, key, run + ".log");

    /// <summary>
    /// Parameter vom Typ <c>driver</c> auflösen: der Wert ist der Name eines Zugangs; seine Felder und Geheimnisse kommen
    /// als <c>&lt;param&gt;_&lt;feld&gt;</c> dazu — was der Job schon setzt, bleibt. Nennt das Manifest eine <c>art</c>, muss der
    /// Zugang von dieser Art sein. Ein leerer Parameter ist kein Fehler: dann nimmt das Plugin, was es sonst hat.
    /// </summary>
    public static bool Zugaenge(Catalog catalog, string dir, JsonElement proc, Dictionary<string, string> values, out string? fehler)
    {
        fehler = null;
        if (!proc.TryGetProperty("params", out var ps) || ps.ValueKind != JsonValueKind.Array) return true;
        foreach (var p in ps.EnumerateArray())
        {
            if (!(p.TryGetProperty("type", out var ty) && ty.GetString() == "driver") || !p.TryGetProperty("key", out var k) || k.GetString() is not { Length: > 0 } key) continue;
            if (!values.TryGetValue(key, out var name) || string.IsNullOrWhiteSpace(name)) continue;
            if (DriverApi.Aufloesen(catalog, dir, name) is not { } a) { fehler = $"Zugang {name} gibt es nicht"; return false; }
            if (p.TryGetProperty("art", out var art) && art.GetString() is { Length: > 0 } soll && a.Zugang.Art != soll) { fehler = $"Zugang {name} ist {a.Zugang.Art}, nicht {soll}"; return false; }
            foreach (var (f, v) in a.Zugang.Felder) values.TryAdd($"{key}_{f}", v);
            foreach (var (g, v) in a.Geheim) values.TryAdd($"{key}_{g}", v);
        }
        return true;
    }

    private static JsonElement? ProfileOf(Journali.Core.Projections.PluginState state, string name)
    {
        var raw = state.Data.GetValueOrDefault("profile:" + name) ?? state.Data.GetValueOrDefault("config:" + name);
        if (raw is null) return null;
        try { var d = JsonDocument.Parse(raw).RootElement; return d.ValueKind == JsonValueKind.Object ? d : null; } catch { return null; }
    }

    /// <summary>Werte des Profils für die Parameter des Prozesses (ohne Geheimnisse): Text, Zahl, Wahrheitswert, Liste (mit Komma).</summary>
    private static IEnumerable<(string Key, string Value)> ProfileValues(JsonElement proc, JsonElement profile)
    {
        if (!proc.TryGetProperty("params", out var ps) || ps.ValueKind != JsonValueKind.Array) yield break;
        foreach (var p in ps.EnumerateArray())
        {
            if (!p.TryGetProperty("key", out var k) || k.GetString() is not { Length: > 0 } key || key == "profile") continue;
            if (p.TryGetProperty("secret", out var sec) && sec.ValueKind == JsonValueKind.True) continue;
            if (!profile.TryGetProperty(key, out var v)) continue;
            var s = v.ValueKind switch
            {
                JsonValueKind.String => v.GetString(),
                JsonValueKind.Number => v.GetRawText(),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                JsonValueKind.Array => string.Join(",", v.EnumerateArray().Select(x => x.ValueKind == JsonValueKind.String ? x.GetString() : x.GetRawText())),
                _ => null,
            };
            if (s is { Length: > 0 }) yield return (key, s);
        }
    }
}

/// <summary>Geheimnisse der Jobs, Profile und Teams (Token, Passwörter, KI-Schlüssel): im Tresor, Stück „secrets“ —
/// nie im Journal. Mit Datenbank teilen alle Server auf ihr dieselben.</summary>
public static class Secrets
{
    private static readonly object Gate = new();
    /// <summary>Schlüssel der Geheimnisse eines Profils: plugin:&lt;key&gt;:&lt;profil&gt; — neben den Jobs in derselben Datei.</summary>
    public static string ProfileKey(string plugin, string profile) => $"plugin:{plugin}:{profile}";
    private static Dictionary<string, Dictionary<string, string>> Load(string dir)
    {
        var json = Tresor.Fuer(dir).Lies(Tresor.Secrets);
        try { return json is null ? new() : JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, string>>>(json) ?? new(); }
        catch (JsonException) { return new(); }
    }
    private static Dictionary<string, Dictionary<string, string>> Parse(string? json)
    {
        try { return json is null ? new() : JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, string>>>(json) ?? new(); }
        catch (JsonException) { return new(); }
    }
    public static Dictionary<string, string> Get(string dir, string key) { lock (Gate) return Load(dir).GetValueOrDefault(key) ?? new(); }
    public static void Set(string dir, string key, Dictionary<string, string?> values)
    {
        lock (Gate)
            Tresor.Fuer(dir).Aendere(Tresor.Secrets, json =>
            {
                var all = Parse(json); var mine = all.GetValueOrDefault(key) ?? new();
                foreach (var (k, v) in values) { if (string.IsNullOrEmpty(v)) mine.Remove(k); else mine[k] = v; }
                if (mine.Count == 0) all.Remove(key); else all[key] = mine;
                return all.Count == 0 ? null : JsonSerializer.Serialize(all, new JsonSerializerOptions { WriteIndented = true });
            });
    }
    public static void Remove(string dir, string key)
    {
        lock (Gate)
            Tresor.Fuer(dir).Aendere(Tresor.Secrets, json =>
            {
                var all = Parse(json);
                return all.Remove(key) && all.Count == 0 ? null : json is null ? null : JsonSerializer.Serialize(all, new JsonSerializerOptions { WriteIndented = true });
            });
    }
}

/// <summary>cron mit fünf Feldern: Minute Stunde Tag Monat Wochentag — *, n, a-b, */n, a,b; Wochentag 0–7 (0 und 7 = Sonntag).
/// Tag und Wochentag gelten zusammen (UND) — „15-21 * 0“ ist der 3. Sonntag im Monat. Sechstes Feld:
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
