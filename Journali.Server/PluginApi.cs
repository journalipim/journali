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

    /// <summary>Die Dienste eines Plugins (Taloan, 19.09.: mehrere je Plugin): <c>process</c> (Schlüssel "") und/oder <c>processes[]</c> mit <c>key</c>.</summary>
    public static IEnumerable<(string Key, JsonElement Proc)> Processes(JsonElement raw)
    {
        if (raw.TryGetProperty("process", out var one) && one.ValueKind == JsonValueKind.Object) yield return ("", one);
        if (raw.TryGetProperty("processes", out var many) && many.ValueKind == JsonValueKind.Array)
            foreach (var p in many.EnumerateArray()) if (p.ValueKind == JsonValueKind.Object && p.TryGetProperty("key", out var k) && k.GetString() is { Length: > 0 } key) yield return (key, p);
    }
    /// <summary>Der Dienst zu einem Schlüssel (leer = der einzige/erste).</summary>
    public static JsonElement? ProcessOf(JsonElement raw, string? service)
    {
        var all = Processes(raw).ToList();
        if (string.IsNullOrEmpty(service)) return all.Count > 0 ? all[0].Proc : null;
        return all.Where(x => x.Key == service).Select(x => (JsonElement?)x.Proc).FirstOrDefault();
    }

    /// <summary>Was ein Plugin braucht (Manifest <c>requires</c>, Taloan 19.09.2026: Basis-Plugins sind der Container ihrer Ergänzungen).</summary>
    public static string[] Requires(JsonElement raw) => raw.TryGetProperty("requires", out var r) && r.ValueKind == JsonValueKind.Array
        ? r.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x.Length > 0).ToArray() : Array.Empty<string>();

    /// <summary>Beim Start: Manifeste mit <c>autoInstall</c>, die das Journal noch nicht kennt, installieren und einschalten (Saatgut) —
    /// Basis zuerst: ein Plugin kommt dran, wenn alles, was es braucht, schon da ist (sonst in einer späteren Runde).</summary>
    public static int AutoInstall(Catalog c, string dir)
    {
        var n = 0;
        var all = Scan(dir).Values.ToList();
        var ordered = new List<Manifest>(); var placed = new HashSet<string>();
        for (var round = 0; round < all.Count && ordered.Count < all.Count; round++)
            foreach (var m in all.Where(m => !placed.Contains(m.Key) && Requires(m.Raw).All(r => placed.Contains(r) || all.All(x => x.Key != r)))) { ordered.Add(m); placed.Add(m.Key); }
        ordered.AddRange(all.Where(m => !placed.Contains(m.Key)));   // Kreise: trotzdem installieren
        foreach (var m in ordered)
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

        // Plugin-Daten (Vorlagen, Zuordnungen, Regeln): benannte JSON-Texte im Journal, Strom plugin:<key>.
        // Lesen darf jeder; Schreiben braucht X-Actor. Leerer Wert = weg.
        api.MapGet("/plugins/{key}/data", (string key, Catalog c) =>
            c.With((_, _, _) => Results.Ok(c.Plugins.All.TryGetValue(key, out var p) ? p.Data.Keys.Order().ToList() : new List<string>())));
        api.MapGet("/plugins/{key}/data/{name}", (string key, string name, Catalog c) =>
            c.With((_, _, _) => c.Plugins.All.TryGetValue(key, out var p) && p.Data.TryGetValue(name, out var v)
                ? Results.Text(v, "application/json") : Results.NotFound()));
        api.MapPut("/plugins/{key}/data/{name}", async (string key, string name, HttpRequest req, Catalog c, CancellationToken ct) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (!ValidKey(key) || name.Length is 0 or > 120 || name.Any(ch => ch is '/' or '\\')) return Bad("Schlüssel oder Name ungültig.");
            using var reader = new StreamReader(req.Body); var value = await reader.ReadToEndAsync(ct);
            if (value.Length > 4_000_000) return Bad("Höchstens 4 MB je Datensatz.");
            if (value.Length > 0) { try { JsonDocument.Parse(value).Dispose(); } catch (JsonException e) { return Bad("Kein JSON: " + e.Message); } }
            return c.With((_, _, write) => Results.Ok(EntryView.Of(write(actor, Plugins.Stream + key, Types.PluginDataSet, new PluginDataSet(name, value.Length == 0 ? null : value), null))));
        });
        api.MapDelete("/plugins/{key}/data/{name}", (string key, string name, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            return c.With((_, _, write) => c.Plugins.All.TryGetValue(key, out var p) && p.Data.ContainsKey(name)
                ? Results.Ok(EntryView.Of(write(actor, Plugins.Stream + key, Types.PluginDataSet, new PluginDataSet(name, null), null))) : Results.NotFound());
        });

        // Prozess-Plugin starten: Befehl und Argumente aus dem Manifest, {param} aus dem Aufruf, {journali}/{actor} vom Server.
        // Läuft bis zum Ende (höchstens 30 Minuten), liefert Ausgabe und Rückgabewert. Nur installierte, eingeschaltete Plugins.
        api.MapPost("/plugins/{key}/run", async (string key, RunRequest body, HttpRequest req, Catalog c, CancellationToken ct) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var state = c.With((_, _, _) => c.Plugins.All.GetValueOrDefault(key));
            if (state is null || !state.Enabled) return Bad($"Plugin {key} ist nicht installiert oder aus.");
            if (!Scan(dir).TryGetValue(key, out var m) || !m.Raw.TryGetProperty("process", out var proc)) return Bad($"Plugin {key} hat keinen Prozess.");
            var values = new Dictionary<string, string> { ["journali"] = $"{req.Scheme}://{req.Host}", ["actor"] = actor };
            foreach (var (k, v) in body.Params ?? new()) values[k] = v;
            var sw = Stopwatch.StartNew();
            try { var (exit, output) = await RunProcessAsync(dir, key, proc, values, TimeSpan.FromMinutes(30), ct); return Results.Ok(new { exit, ms = sw.ElapsedMilliseconds, output }); }
            catch (InvalidOperationException e) { return Bad(e.Message); }
            catch (System.ComponentModel.Win32Exception e) { return Bad($"Prozess startet nicht: {e.Message}"); }
            catch (OperationCanceledException) { return Bad("Abgebrochen (Zeitgrenze 30 Minuten)."); }
        });
    }

    /// <summary>Prozess eines Plugins laufen lassen und auf das Ende warten: Rückgabewert und Ausgabe (stdout, dann stderr). Für /run und die Belegerzeuger (Versionen).</summary>
    public static async Task<(int Exit, string Output)> RunProcessAsync(string dir, string key, JsonElement proc, Dictionary<string, string> values, TimeSpan limit, CancellationToken ct)
    {
        var psi = BuildProcess(dir, key, proc, values);
        var output = new StringBuilder();
        using var p = Process.Start(psi)!;
        var stdout = p.StandardOutput.ReadToEndAsync(ct);
        var stderr = p.StandardError.ReadToEndAsync(ct);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(limit);
        try { await p.WaitForExitAsync(timeout.Token); } catch (OperationCanceledException) { try { p.Kill(true); } catch { } throw; }
        output.Append(await stdout);
        var err = await stderr;
        if (err.Length > 0) output.Append("\n--- stderr ---\n").Append(err);
        var text = output.ToString();
        if (text.Length > 200_000) text = "…" + text[^200_000..];
        return (p.ExitCode, text);
    }

    private static IResult Toggle(HttpRequest req, Catalog c, string key, bool on)
    {
        if (Actor(req) is not { } actor) return ActorMissing();
        return c.With((_, _, write) => c.Plugins.All.TryGetValue(key, out var s)
            ? on && Requires(JsonDocument.Parse(s.Manifest).RootElement).Where(r => !(c.Plugins.All.TryGetValue(r, out var b) && b.Enabled)).ToList() is { Count: > 0 } missing
                ? Bad($"{key} braucht {string.Join(", ", missing)} — zuerst einschalten.")   // Ergänzung ohne Basis (Taloan)
            : s.Enabled == on ? Results.Ok(new { unchanged = true })
                : Results.Ok(EntryView.Of(write(actor, Plugins.Stream + key, on ? Types.PluginEnabled : Types.PluginDisabled, on ? new PluginEnabled() : new PluginDisabled(), null)))
            : Results.NotFound());
    }

    /// <summary>Prozess eines Plugins aufbauen: Befehl und Argumente aus dem Manifest (process.command/args), {param} aus den Werten,
    /// {flag?--x} nur, wenn der Parameter wahr ist; Arbeitsverzeichnis das Plugin. Für /plugins/{key}/run und den JobRunner.</summary>
    public static ProcessStartInfo BuildProcess(string dir, string key, JsonElement proc, Dictionary<string, string> values)
    {
        var command = proc.TryGetProperty("command", out var cmd) ? cmd.GetString() ?? "" : "";
        if (command.Length == 0) throw new InvalidOperationException("process.command fehlt im Manifest.");
        var psi = new ProcessStartInfo(command) { WorkingDirectory = Path.Combine(dir, key), RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };
        psi.Environment["PYTHONIOENCODING"] = "utf-8";
        foreach (var (k, v) in values) psi.Environment["JOURNALI_" + k.ToUpperInvariant()] = v;   // auch als Umgebung — für Skripte ohne Argumente
        if (proc.TryGetProperty("args", out var arr))
            foreach (var a in arr.EnumerateArray())
            {
                var s = a.GetString() ?? "";
                var flag = System.Text.RegularExpressions.Regex.Match(s, @"^\{(\w+)\?(.*)\}$");
                if (flag.Success) { if (values.TryGetValue(flag.Groups[1].Value, out var fv) && fv is "true" or "1" or "on") psi.ArgumentList.Add(flag.Groups[2].Value); continue; }
                var filled = System.Text.RegularExpressions.Regex.Replace(s, @"\{(\w+)\}", mm => values.GetValueOrDefault(mm.Groups[1].Value) ?? "");
                if (filled.Length > 0 || !s.Contains('{')) psi.ArgumentList.Add(filled);
            }
        return psi;
    }

    public sealed record RunRequest(Dictionary<string, string>? Params);
}
