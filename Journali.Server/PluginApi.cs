using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Plugins (docs/pflegestruktur.md, 19): ein Verzeichnis je Plugin unter <c>plugins/&lt;key&gt;/</c> mit
/// <c>plugin.json</c>. Was auf der Platte liegt, listet der Server; was gilt (installiert, Fassung, an/aus),
/// steht im Journal (<c>plugin:&lt;key&gt;</c>). Kein Plugin läuft im Serverprozess: Browser-Plugins lädt die
/// Oberfläche, Prozess-Plugins startet der Server als Kindprozess, der nur über /api redet.
/// </summary>
public static class PluginApi
{
    public sealed record Manifest(string Key, string Version, JsonElement Raw);

    /// <summary>Alle plugin.json unter dem Verzeichnis, nach Schlüssel.</summary>
    public static Dictionary<string, Manifest> Scan(string dir)
    {
        var found = new Dictionary<string, Manifest>();
        if (!Directory.Exists(dir)) return found;
        foreach (var d in Directory.GetDirectories(dir))
        {
            var file = Path.Combine(d, "plugin.json");
            if (!File.Exists(file)) continue;
            try
            {
                var raw = JsonDocument.Parse(File.ReadAllText(file)).RootElement.Clone();
                var key = raw.TryGetProperty("key", out var k) ? k.GetString() ?? "" : "";
                if (!ValidKey(key) || key != Path.GetFileName(d)) continue;   // Schlüssel = Verzeichnisname, sonst übergangen
                found[key] = new Manifest(key, raw.TryGetProperty("version", out var v) ? v.GetString() ?? "0" : "0", raw);
            }
            catch (JsonException) { }
        }
        return found;
    }

    /// <summary>Beim Start: Manifeste mit <c>autoInstall</c>, die das Journal noch nicht kennt, installieren und einschalten (Saatgut).</summary>
    public static int AutoInstall(Catalog c, string dir)
    {
        var n = 0;
        foreach (var m in Scan(dir).Values)
        {
            if (!(m.Raw.TryGetProperty("autoInstall", out var a) && a.ValueKind == JsonValueKind.True)) continue;
            c.With((_, _, write) =>
            {
                if (c.Plugins.All.ContainsKey(m.Key)) return 0;
                write("system", Plugins.Stream + m.Key, Types.PluginInstalled, new PluginInstalled(m.Version, m.Raw.GetRawText()), null);
                write("system", Plugins.Stream + m.Key, Types.PluginEnabled, new PluginEnabled(), null);
                n++;
                return 0;
            });
        }
        return n;
    }

    public static void Map(RouteGroupBuilder api, string dir)
    {
        // Liste: alles auf der Platte, mit Stand aus dem Journal — und Journal-Einträge, deren Verzeichnis fehlt
        api.MapGet("/plugins", (Catalog c) =>
        {
            var disk = Scan(dir);
            return c.With((_, _, _) =>
            {
                var state = c.Plugins.All;
                var keys = disk.Keys.Union(state.Keys).Order();
                return keys.Select(k =>
                {
                    var m = disk.GetValueOrDefault(k); var s = state.GetValueOrDefault(k);
                    var manifest = m?.Raw ?? (s is not null ? JsonDocument.Parse(s.Manifest).RootElement.Clone() : default);
                    return new
                    {
                        key = k, manifest, onDisk = m is not null, diskVersion = m?.Version,
                        installed = s is not null, version = s?.Version, enabled = s?.Enabled ?? false,
                        update = m is not null && s is not null && m.Version != s.Version,
                        lastAt = s?.LastAt, lastActor = s?.LastActor,
                    };
                }).ToList();
            });
        });

        api.MapPost("/plugins/{key}/install", (string key, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (!Scan(dir).TryGetValue(key, out var m)) return Results.NotFound(new { error = $"plugins/{key}/plugin.json fehlt." });
            return c.With((_, _, write) =>
            {
                var fresh = !c.Plugins.All.ContainsKey(key);
                var e = write(actor, Plugins.Stream + key, Types.PluginInstalled, new PluginInstalled(m.Version, m.Raw.GetRawText()), null);
                if (fresh) e = write(actor, Plugins.Stream + key, Types.PluginEnabled, new PluginEnabled(), null);
                return Results.Ok(EntryView.Of(e));
            });
        });
        api.MapPost("/plugins/{key}/enable", (string key, HttpRequest req, Catalog c) => Toggle(req, c, key, true));
        api.MapPost("/plugins/{key}/disable", (string key, HttpRequest req, Catalog c) => Toggle(req, c, key, false));
        api.MapDelete("/plugins/{key}", (string key, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            return c.With((_, _, write) => c.Plugins.All.ContainsKey(key)
                ? Results.Ok(EntryView.Of(write(actor, Plugins.Stream + key, Types.PluginRemoved, new PluginRemoved(), null)))
                : Results.NotFound());
        });

        // Prozess-Plugin starten: Befehl und Argumente aus dem Manifest, {param} aus dem Aufruf, {journali}/{actor} vom Server.
        // Läuft bis zum Ende (höchstens 30 Minuten), liefert Ausgabe und Rückgabewert. Nur installierte, eingeschaltete Plugins.
        api.MapPost("/plugins/{key}/run", async (string key, RunRequest body, HttpRequest req, Catalog c, CancellationToken ct) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var state = c.With((_, _, _) => c.Plugins.All.GetValueOrDefault(key));
            if (state is null || !state.Enabled) return Bad($"Plugin {key} ist nicht installiert oder aus.");
            if (!Scan(dir).TryGetValue(key, out var m) || !m.Raw.TryGetProperty("process", out var proc)) return Bad($"Plugin {key} hat keinen Prozess.");
            var command = proc.TryGetProperty("command", out var cmd) ? cmd.GetString() ?? "" : "";
            if (command.Length == 0) return Bad("process.command fehlt im Manifest.");
            var values = new Dictionary<string, string> { ["journali"] = $"{req.Scheme}://{req.Host}", ["actor"] = actor };
            foreach (var (k, v) in body.Params ?? new()) values[k] = v;
            var args = new List<string>();
            if (proc.TryGetProperty("args", out var arr))
                foreach (var a in arr.EnumerateArray())
                {
                    var s = a.GetString() ?? "";
                    // {flag?--dry-run}: nur, wenn der Parameter wahr ist
                    var flag = System.Text.RegularExpressions.Regex.Match(s, @"^\{(\w+)\?(.*)\}$");
                    if (flag.Success) { if (values.TryGetValue(flag.Groups[1].Value, out var fv) && fv is "true" or "1" or "on") args.Add(flag.Groups[2].Value); continue; }
                    var filled = System.Text.RegularExpressions.Regex.Replace(s, @"\{(\w+)\}", mm => values.GetValueOrDefault(mm.Groups[1].Value) ?? "");
                    if (filled.Length > 0 || !s.Contains('{')) args.Add(filled);
                }
            var psi = new ProcessStartInfo(command) { WorkingDirectory = Path.Combine(dir, key), RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };
            psi.Environment["PYTHONIOENCODING"] = "utf-8";
            foreach (var a in args) psi.ArgumentList.Add(a);
            var sw = Stopwatch.StartNew();
            var output = new StringBuilder();
            try
            {
                using var p = Process.Start(psi)!;
                var stdout = p.StandardOutput.ReadToEndAsync(ct);
                var stderr = p.StandardError.ReadToEndAsync(ct);
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeout.CancelAfter(TimeSpan.FromMinutes(30));
                await p.WaitForExitAsync(timeout.Token);
                output.Append(await stdout);
                var err = await stderr;
                if (err.Length > 0) output.Append("\n--- stderr ---\n").Append(err);
                var text = output.ToString();
                if (text.Length > 200_000) text = "…" + text[^200_000..];
                return Results.Ok(new { exit = p.ExitCode, ms = sw.ElapsedMilliseconds, command, args, output = text });
            }
            catch (System.ComponentModel.Win32Exception e) { return Bad($"Prozess {command} startet nicht: {e.Message}"); }
            catch (OperationCanceledException) { return Bad("Abgebrochen (Zeitgrenze 30 Minuten)."); }
        });
    }

    private static IResult Toggle(HttpRequest req, Catalog c, string key, bool on)
    {
        if (Actor(req) is not { } actor) return ActorMissing();
        return c.With((_, _, write) => c.Plugins.All.TryGetValue(key, out var s)
            ? s.Enabled == on ? Results.Ok(new { unchanged = true })
                : Results.Ok(EntryView.Of(write(actor, Plugins.Stream + key, on ? Types.PluginEnabled : Types.PluginDisabled, on ? new PluginEnabled() : new PluginDisabled(), null)))
            : Results.NotFound());
    }

    public sealed record RunRequest(Dictionary<string, string>? Params);
}
