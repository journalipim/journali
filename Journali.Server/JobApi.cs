using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Jobs verwalten (Plugin tasker): anlegen/ändern, an/aus, jetzt starten, abbrechen, Läufe und Logs.
/// Die Definition steht im Journal (job:&lt;key&gt;), Geheimnisse in jobs/secrets.json; der JobRunner führt aus.
/// </summary>
public static class JobApi
{
    public sealed record ProfileSecrets(Dictionary<string, string?>? Values);
    public sealed record JobBody(string? Label, string? Plugin, string? Service, Dictionary<string, string>? Params, string? Schedule, bool? Enabled, int? TimeoutMinutes, Dictionary<string, string?>? Secrets, JobFiles? Files, string? Role);

    /// <summary>Ein Lauf, den die Oberfläche abgibt: Plugin, Parameter, Bezeichnung — der Job entsteht dabei.</summary>
    public sealed record UebergabeBody(string? Label, string? Service, Dictionary<string, string>? Params);

    public static void Map(RouteGroupBuilder api, JobRunner runner)
    {
        // Welche Plugins können Jobs? Die mit process im Manifest — mit ihren Parametern (process.params: key, label, type, secret, default)
        api.MapGet("/jobs/plugins", (Catalog c) =>
        {
            var manifests = PluginApi.Scan(runner.PluginDir);
            var tarif = c.InstanzTarif;
            // eine Zeile je Dienst: label des Dienstes, sonst des Plugins. Nur, was auch laufen dürfte —
            // mit einem Plugin ausserhalb des Tarifs liesse sich kein Job anlegen, also steht es hier nicht zur Wahl
            return c.With((_, _, _) => c.Plugins.All.Values.Where(p => p.Enabled && tarif.Erlaubt(p.Key) && manifests.ContainsKey(p.Key))
                .SelectMany(p => PluginApi.Processes(manifests[p.Key].Raw).Select(x => new
                {
                    key = p.Key, service = x.Key, version = p.Version,
                    label = x.Proc.TryGetProperty("label", out var pl) ? pl : (manifests[p.Key].Raw.TryGetProperty("label", out var l) ? l : (JsonElement?)null),
                    @params = x.Proc.TryGetProperty("params", out var ps) ? ps : (JsonElement?)null,
                    description = x.Proc.TryGetProperty("description", out var d) ? d.GetString() : null,
                    profile = x.Proc.TryGetProperty("profile", out var pr) ? pr.GetString() : null,   // "generic": Profile im Tasker anlegen (✎)
                    files = x.Proc.TryGetProperty("files", out var fi) ? fi : (JsonElement?)null,   // Fächer-Vertrag (in/out) — der Dialog zeigt dann die Fächer
                })).ToList());
        });

        // Geheimnisse am Profil eines Plugins: PUT {values:{token:…}} setzt (leer = weg),
        // GET sagt nur, welche Schlüssel gesetzt sind — der Wert verlässt den Server nie
        api.MapGet("/plugins/{key}/secrets/{name}", (string key, string name) => Results.Ok(new { keys = Secrets.Get(runner.Dir, Secrets.ProfileKey(key, name)).Keys.Order().ToList() }));
        api.MapPut("/plugins/{key}/secrets/{name}", (string key, string name, ProfileSecrets body, HttpRequest req) =>
        {
            if (Actor(req) is null) return ActorMissing();
            if (!ValidKey(key) || string.IsNullOrWhiteSpace(name) || name.Contains(':')) return Bad("Plugin oder Profilname ungültig.");
            Secrets.Set(runner.Dir, Secrets.ProfileKey(key, name), body.Values ?? new());
            return Results.Ok(new { keys = Secrets.Get(runner.Dir, Secrets.ProfileKey(key, name)).Keys.Order().ToList() });
        });
        api.MapDelete("/plugins/{key}/secrets/{name}", (string key, string name, HttpRequest req) => { if (Actor(req) is null) return ActorMissing(); Secrets.Remove(runner.Dir, Secrets.ProfileKey(key, name)); return Results.Ok(new { keys = Array.Empty<string>() }); });

        api.MapGet("/jobs", (Catalog c) => c.With((_, _, _) => c.Jobs.All.Values.OrderBy(j => j.Label).Select(j => View(j, runner)).ToList()));
        api.MapGet("/jobs/{key}", (string key, Catalog c) => c.With((_, _, _) => c.Jobs.All.TryGetValue(key, out var j) ? Results.Ok(View(j, runner, all: true)) : Results.NotFound()));

        api.MapPut("/jobs/{key}", (string key, JobBody body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (!ValidKey(key)) return Bad("key: a-z, 0-9, _");
            if (body.Schedule is { Length: > 0 } s && !Cron.TryParse(s, out _)) return Bad("Zeitplan: cron mit fünf Feldern „m h tag monat wochentag“, z. B. „0 2 * * *“ = täglich 02:00.");
            var manifests = PluginApi.Scan(runner.PluginDir);
            return c.With((_, _, write) =>
            {
                var cur = c.Jobs.All.GetValueOrDefault(key);
                var plugin = Blank(body.Plugin) ?? cur?.Plugin;
                var service = body.Service ?? cur?.Service ?? "";
                if (plugin is null || !manifests.TryGetValue(plugin, out var m) || PluginApi.ProcessOf(m.Raw, service) is not { } proc) return Bad("Plugin {0} hat keinen Prozess{1} — nur solche können Jobs.", plugin, (service.Length > 0 ? " " + service : ""));
                // Was nicht wirkt, bekommt auch keinen Job: sonst stünde er da und scheiterte bei jedem Lauf
                if (PluginApi.NichtImTarif(c, plugin) is { } nein) return nein;
                if (c.Plugins.All.GetValueOrDefault(plugin) is not { Enabled: true }) return Bad("Plugin {0} ist nicht installiert oder aus.", plugin);
                // Parameter: Geheimnisse (secret: true) gehören nicht ins Journal — raus aus params, rein in secrets.json
                var secretKeys = SecretKeys(proc);
                var prms = body.Params ?? cur?.Params ?? new();
                var secrets = new Dictionary<string, string?>(body.Secrets ?? new());
                foreach (var k in secretKeys) if (prms.Remove(k, out var v) && v is { Length: > 0 }) secrets[k] = v;
                if (secrets.Count > 0) Secrets.Set(runner.Dir, key, secrets);
                var files = body.Files is { } fb ? new JobFiles(Blank(fb.Base), Blank(fb.Keep), fb.Latest, fb.Archive) : cur?.Files;
                if (files?.Base is { } fbase && (fbase.Contains("..") || !Path.IsPathRooted(fbase))) return Bad("Fächer: Basis muss ein absoluter Pfad sein (auf dem Server).");
                // Die Rolle des Laufs ändert nur, wer Anwender und Rollen verwaltet — sonst wäre ein Job ein Weg zu fremden Rechten
                var rolle = cur?.Role;
                if (body.Role is not null && body.Role != (cur?.Role ?? ""))
                {
                    if (!Auth.Has(req, c, Rights.Users)) return Bad("Die Rolle eines Jobs setzt, wer Anwender und Rollen verwaltet.");
                    rolle = Blank(body.Role);
                    if (rolle is not null && !c.Users.Roles.ContainsKey(rolle)) return Bad("Unbekannte Rolle {0}.", rolle);
                }
                var def = new JobDefined(Blank(body.Label) ?? cur?.Label ?? key, plugin, prms, Blank(body.Schedule) ?? (body.Schedule is null ? cur?.Schedule : null), body.Enabled ?? cur?.Enabled ?? true, body.TimeoutMinutes ?? cur?.TimeoutMinutes, service.Length > 0 ? service : null, files, rolle, cur?.Owner ?? actor);
                write(actor, Jobs.Stream + key, Types.JobDefined, def, null);
                return Results.Ok(View(c.Jobs.All[key], runner));
            });
        });

        api.MapDelete("/jobs/{key}", (string key, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (runner.IsRunning(key)) return Bad("Der Job läuft.");
            Secrets.Remove(runner.Dir, key);
            return c.With((_, _, write) => c.Jobs.All.ContainsKey(key) ? Results.Ok(EntryView.Of(write(actor, Jobs.Stream + key, Types.JobRetired, new JobRetired(), null))) : Results.NotFound());
        });

        api.MapPost("/jobs/{key}/run", (string key, HttpRequest req, HttpContext ctx) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            runner.Origin = $"{req.Scheme}://{req.Host}";
            var run = runner.Start(key, "manual", out var error);
            return run is null ? Bad(error ?? "nicht gestartet") : Results.Ok(new { run });
        });
        // Einen Lauf an den Tasker abgeben. Der Job entsteht oder wird aktualisiert, gehört dem Anfragenden — auf sein Kontingent geht,
        // was der Lauf schreibt — und läuft sofort los. Wer pflegen darf, darf das; es ist dieselbe Arbeit, nur nebenan.
        api.MapPost("/jobs/{key}/uebergabe", (string key, UebergabeBody body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (!ValidKey(key)) return Bad("key: a-z, 0-9, _");
            var plugin = Blank(body.Service) is { } s && s.Contains('|') ? s.Split('|')[0] : Blank(body.Service) ?? "";
            var fehler = c.With((_, _, write) =>
            {
                var cur = c.Jobs.All.GetValueOrDefault(key);
                var p = Blank(plugin) ?? cur?.Plugin;
                if (p is null) return Bad("plugin fehlt.");
                if (!c.Plugins.All.TryGetValue(p, out var st) || !st.Enabled) return Bad("Plugin {0} ist nicht installiert oder aus.", p);
                var prms = body.Params ?? cur?.Params ?? new();
                write(actor, Jobs.Stream + key, Types.JobDefined,
                    new JobDefined(Blank(body.Label) ?? cur?.Label ?? key, p, prms, null, true, cur?.TimeoutMinutes ?? 180, cur?.Service, cur?.Files, cur?.Role, actor), null);
                return (IResult?)null;
            });
            if (fehler is not null) return fehler;
            runner.Origin = $"{req.Scheme}://{req.Host}";
            var run = runner.Start(key, "uebergabe", out var error);
            return run is null ? Bad(error ?? "nicht gestartet") : Results.Ok(new { job = key, run });
        });

        // Anhalten und weiter: der Lauf wartet beim nächsten Stapel, statt zu sterben.
        api.MapPost("/jobs/{key}/pause", (string key, HttpRequest req) => Actor(req) is null ? ActorMissing()
            : runner.Pause(key) ? Results.Ok(new { paused = true }) : Bad("Der Job läuft nicht."));
        api.MapPost("/jobs/{key}/resume", (string key, HttpRequest req) => Actor(req) is null ? ActorMissing()
            : runner.Resume(key) ? Results.Ok(new { paused = false }) : Bad("Der Job wartet nicht."));
        // Was der Lauf selbst zwischen zwei Stapeln fragt — er kennt nur seinen Jobschlüssel
        api.MapGet("/jobs/{key}/signal", (string key, Catalog c) =>
        {
            // Ein volles Kontingent hält den Lauf an, statt ihn sterben zu lassen. Fortgesetzt wird
            // er nur von Hand — sonst nähmen wartende Jobs das neue Kontingent im selben Moment wieder weg.
            var eigner = c.With((_, _, _) => c.Jobs.All.GetValueOrDefault(key)?.Owner);
            if (eigner is not null && !Auth.HatKontingent(c, eigner, fuerJob: true)) runner.Pause(key, "Kontingent");
            return Results.Ok(new { paused = runner.IsPaused(key), running = runner.IsRunning(key), reason = runner.PauseReason(key) });
        });

        api.MapPost("/jobs/{key}/cancel", (string key, HttpRequest req) => Actor(req) is null ? ActorMissing() : runner.Cancel(key) ? Results.Ok(new { cancelled = true }) : Bad("Der Job läuft nicht."));

        // Log eines Laufs: ganz oder die letzten n Zeilen — auch während er läuft
        // Fächer eines Jobs (docs/tasker-dateien.md): wartende Eingänge (Platte), verarbeitete und geschriebene (Journal), latest, Einstellungen
        api.MapGet("/jobs/{key}/files", (string key, Catalog c) =>
        {
            if (!ValidKey(key)) return Results.NotFound();
            var j = c.With((_, _, _) => c.Jobs.All.GetValueOrDefault(key));
            if (j is null) return Results.NotFound();
            var manifests = PluginApi.Scan(runner.PluginDir);
            var proc = manifests.TryGetValue(j.Plugin, out var m) ? PluginApi.ProcessOf(m.Raw, j.Service) : null;
            var inSpec = proc is { } p1 ? JobFach.In(p1) : null; var outSpec = proc is { } p2 ? JobFach.Out(p2) : null;
            var outDir = runner.Fach.Fach(j, "out");
            var latest = Directory.Exists(outDir) ? Directory.EnumerateFileSystemEntries(outDir).Select(Path.GetFileName).Where(n => n!.StartsWith(key + "-latest")).ToList() : new();
            return Results.Ok(new
            {
                @base = runner.Fach.Base(j), files = j.Files,
                uses = new { @in = inSpec is not null, @out = outSpec is not null, pattern = inSpec?.Patterns, mode = inSpec?.Mode, many = outSpec?.Many },
                waiting = runner.Fach.Waiting(j, inSpec).Select(w => new { w.Name, w.Bytes, w.At }).ToList(),
                consumed = j.Consumed.Take(200).Select(f => new { f.Run, f.Name, f.Hash, f.Bytes, f.Status, f.MediaId, f.At }).ToList(),
                written = j.Written.Take(200).Select(f => new { f.Run, f.Name, f.Hash, f.Bytes, f.Latest, f.MediaId, f.At }).ToList(),
                latest,
            });
        });

        api.MapGet("/jobs/{key}/runs/{run}/log", (string key, string run, int tail = 0) =>
        {
            if (!ValidKey(key) || run.Contains("..") || run.Contains('/') || run.Contains('\\')) return Results.NotFound();
            var path = runner.LogPath(key, run);
            if (!File.Exists(path)) return Results.Text("", "text/plain; charset=utf-8");
            string text;
            using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)) using (var sr = new StreamReader(fs)) text = sr.ReadToEnd();
            if (tail > 0) { var lines = text.Split('\n'); if (lines.Length > tail) text = string.Join('\n', lines[^tail..]); }
            return Results.Text(text, "text/plain; charset=utf-8");
        });
    }

    private static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static List<string> SecretKeys(JsonElement proc)
    {
        var keys = new List<string>();
        if (proc.TryGetProperty("params", out var ps) && ps.ValueKind == JsonValueKind.Array)
            foreach (var p in ps.EnumerateArray())
                if (p.TryGetProperty("secret", out var s) && s.ValueKind == JsonValueKind.True && p.TryGetProperty("key", out var k)) keys.Add(k.GetString() ?? "");
        return keys;
    }

    private static object View(JobState j, JobRunner runner, bool all = false)
    {
        var secrets = Secrets.Get(runner.Dir, j.Key).Keys.ToList();
        return new
        {
            j.Key, j.Label, j.Plugin, j.Service, j.Params, j.Schedule, scheduleText = Cron.Describe(j.Schedule), j.Enabled, j.TimeoutMinutes, files = j.Files, role = j.Role, owner = j.Owner, paused = runner.IsPaused(j.Key), pauseReason = runner.PauseReason(j.Key),
            waiting = runner.Fach.Waiting(j, null).Count, consumed = j.Consumed.Count, written = j.Written.Count,
            secrets, nextDue = j.Enabled ? JobRunner.NextDue(j.Schedule) : null,
            running = runner.RunningId(j.Key),
            last = j.Last is { } l ? Run(l) : null,
            runs = (all ? j.Runs : j.Runs.Take(5)).Select(Run).ToList(),
        };
    }
    private static object Run(JobRun r) => new { r.Id, r.Trigger, r.StartedAt, r.FinishedAt, r.Status, r.Exit, r.Seconds, r.Summary, r.LogBytes, r.Actor };
}
