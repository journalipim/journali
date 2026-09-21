using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Jobs verwalten (Plugin tasker, Taloan 19.09.2026): anlegen/ändern, an/aus, jetzt starten, abbrechen, Läufe und Logs.
/// Die Definition steht im Journal (job:&lt;key&gt;), Geheimnisse in jobs/secrets.json; der JobRunner führt aus.
/// </summary>
public static class JobApi
{
    public sealed record ProfileSecrets(Dictionary<string, string?>? Values);
    public sealed record JobBody(string? Label, string? Plugin, string? Service, Dictionary<string, string>? Params, string? Schedule, bool? Enabled, int? TimeoutMinutes, Dictionary<string, string?>? Secrets);

    public static void Map(RouteGroupBuilder api, JobRunner runner)
    {
        // Welche Plugins können Jobs? Die mit process im Manifest — mit ihren Parametern (process.params: key, label, type, secret, default)
        api.MapGet("/jobs/plugins", (Catalog c) =>
        {
            var manifests = PluginApi.Scan(runner.PluginDir);
            // eine Zeile je Dienst (Taloan: mehrere Dienste je Plugin): label des Dienstes, sonst des Plugins
            return c.With((_, _, _) => c.Plugins.All.Values.Where(p => p.Enabled && manifests.ContainsKey(p.Key))
                .SelectMany(p => PluginApi.Processes(manifests[p.Key].Raw).Select(x => new
                {
                    key = p.Key, service = x.Key, version = p.Version,
                    label = x.Proc.TryGetProperty("label", out var pl) ? pl : (manifests[p.Key].Raw.TryGetProperty("label", out var l) ? l : default),
                    @params = x.Proc.TryGetProperty("params", out var ps) ? ps : default,
                    description = x.Proc.TryGetProperty("description", out var d) ? d.GetString() : null,
                    profile = x.Proc.TryGetProperty("profile", out var pr) ? pr.GetString() : null,   // "generic": Profile im Tasker anlegen (✎)
                })).ToList());
        });

        // Geheimnisse am Profil eines Plugins (Taloan, 21.09.: Token gehört zum Profil, dann braucht der Job kein Feld): PUT {values:{token:…}} setzt (leer = weg),
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
                if (plugin is null || !manifests.TryGetValue(plugin, out var m) || PluginApi.ProcessOf(m.Raw, service) is not { } proc) return Bad($"Plugin {plugin} hat keinen Prozess{(service.Length > 0 ? " " + service : "")} — nur solche können Jobs.");
                // Parameter: Geheimnisse (secret: true) gehören nicht ins Journal — raus aus params, rein in secrets.json
                var secretKeys = SecretKeys(proc);
                var prms = body.Params ?? cur?.Params ?? new();
                var secrets = new Dictionary<string, string?>(body.Secrets ?? new());
                foreach (var k in secretKeys) if (prms.Remove(k, out var v) && v is { Length: > 0 }) secrets[k] = v;
                if (secrets.Count > 0) Secrets.Set(runner.Dir, key, secrets);
                var def = new JobDefined(Blank(body.Label) ?? cur?.Label ?? key, plugin, prms, Blank(body.Schedule) ?? (body.Schedule is null ? cur?.Schedule : null), body.Enabled ?? cur?.Enabled ?? true, body.TimeoutMinutes ?? cur?.TimeoutMinutes, service.Length > 0 ? service : null);
                write(actor, Jobs.Stream + key, Types.JobDefined, def, null);
                return Results.Ok(View(c.Jobs.All[key], runner));
            });
        });

        api.MapDelete("/jobs/{key}", (string key, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (runner.IsRunning(key)) return Bad("Der Job läuft gerade — erst abbrechen.");
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
        api.MapPost("/jobs/{key}/cancel", (string key, HttpRequest req) => Actor(req) is null ? ActorMissing() : runner.Cancel(key) ? Results.Ok(new { cancelled = true }) : Bad("Der Job läuft nicht."));

        // Log eines Laufs: ganz oder die letzten n Zeilen — auch während er läuft
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
            j.Key, j.Label, j.Plugin, j.Service, j.Params, j.Schedule, scheduleText = Cron.Describe(j.Schedule), j.Enabled, j.TimeoutMinutes,
            secrets, nextDue = j.Enabled ? JobRunner.NextDue(j.Schedule) : null,
            running = runner.RunningId(j.Key),
            last = j.Last is { } l ? Run(l) : null,
            runs = (all ? j.Runs : j.Runs.Take(5)).Select(Run).ToList(),
        };
    }
    private static object Run(JobRun r) => new { r.Id, r.Trigger, r.StartedAt, r.FinishedAt, r.Status, r.Exit, r.Seconds, r.Summary, r.LogBytes, r.Actor };
}
