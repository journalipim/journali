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
    public sealed record Manifest(string Key, string Version, JsonElement Raw, PluginSeal.Seal Seal);

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
                var version = raw.TryGetProperty("version", out var v) ? v.GetString() ?? "0" : "0";
                found[key] = new Manifest(key, version, raw, PluginSeal.Check(d, key, version));
            }
            catch (JsonException) { }
        }
        return found;
    }

    /// <summary>Die Dienste eines Plugins: <c>process</c> (Schlüssel "") und/oder <c>processes[]</c> mit <c>key</c>.</summary>
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

    /// <summary>Was ein Plugin braucht (Manifest <c>requires</c>).</summary>
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
        PluginCatalogApi.Map(api, dir);   // vor /plugins/{key}: „catalog" ist kein Plugin
        // Liste: alles auf der Platte, mit Stand aus dem Journal — und Journal-Einträge, deren Verzeichnis fehlt
        api.MapGet("/plugins", (Catalog c) =>
        {
            var disk = Scan(dir);
            var tarif = c.InstanzTarif;
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
                        // der Tarif der Instanz erlaubt es — sonst nicht ladbar, nicht einschaltbar
                        allowed = tarif.Erlaubt(k), tarif = Tarife.Alle.FirstOrDefault(t => t.Erlaubt(k))?.Key,
                        // das Siegel: zertifiziert, oder warum nicht (leer ohne Zertifikat)
                        certified = m?.Seal.Certified ?? false, sealIssued = m?.Seal.Issued, sealIssuer = m?.Seal.Issuer, sealReason = m?.Seal.Grund,
                    };
                }).ToList();
            });
        });

        api.MapPost("/plugins/{key}/install", (string key, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (!Scan(dir).TryGetValue(key, out var m)) return Results.NotFound(Err("plugins/{0}/plugin.json fehlt.", key));
            if (NichtImTarif(c, key) is { } nein) return nein;
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
        // Namen — oder mit ?values=true&prefix=… die Datensätze selbst als ein JSON-Objekt { name: wert } (etim: alle Klassen einer Version)
        api.MapGet("/plugins/{key}/data", (string key, Catalog c, string? prefix = null, bool values = false) =>
            c.With((_, _, _) =>
            {
                var data = c.Plugins.All.TryGetValue(key, out var p) ? p.Data : new Dictionary<string, string>();
                var names = data.Keys.Where(n => prefix is null || n.StartsWith(prefix)).Order().ToList();
                if (!values) return Results.Ok(names);
                var sb = new StringBuilder("{");
                foreach (var n in names) { if (sb.Length > 1) sb.Append(','); sb.Append(JsonSerializer.Serialize(n)).Append(':').Append(data[n]); }
                return Results.Text(sb.Append('}').ToString(), "application/json");
            }));
        api.MapGet("/plugins/{key}/data/{name}", (string key, string name, Catalog c) =>
            c.With((_, _, _) => c.Plugins.All.TryGetValue(key, out var p) && p.Data.TryGetValue(name, out var v)
                ? Results.Text(v, "application/json") : Results.NotFound()));
        api.MapPut("/plugins/{key}/data/{name}", async (string key, string name, HttpRequest req, Catalog c, CancellationToken ct) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (!ValidKey(key) || name.Length is 0 or > 120 || name.Any(ch => ch is '/' or '\\')) return Bad("Schlüssel oder Name ungültig.");
            using var reader = new StreamReader(req.Body); var value = await reader.ReadToEndAsync(ct);
            if (value.Length > 4_000_000) return Bad("Höchstens 4 MB je Datensatz.");
            if (value.Length > 0) { try { JsonDocument.Parse(value).Dispose(); } catch (JsonException e) { return Bad("Kein JSON: {0}", e.Message); } }
            return c.With((_, _, write) => Results.Ok(EntryView.Of(write(actor, Plugins.Stream + key, Types.PluginDataSet, new PluginDataSet(name, value.Length == 0 ? null : value), null))));
        });
        // Sammel-PUT: { name: wert, … } — alle in einem Stapel (etim: eine ganze Freigabe, tausende Klassen)
        api.MapPut("/plugins/{key}/data", async (string key, HttpRequest req, Catalog c, CancellationToken ct) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (!ValidKey(key)) return Bad("Schlüssel ungültig.");
            using var reader = new StreamReader(req.Body); var body = await reader.ReadToEndAsync(ct);
            if (body.Length > 48_000_000) return Bad("Höchstens 48 MB je Stapel.");
            Dictionary<string, JsonElement>? items;
            try { items = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(body); } catch (JsonException e) { return Bad("Kein JSON-Objekt: {0}", e.Message); }
            if (items is null || items.Count == 0) return Bad("Leer.");
            if (items.Keys.Any(n => n.Length is 0 or > 120 || n.Any(ch => ch is '/' or '\\'))) return Bad("Name ungültig.");
            var batch = Guid.NewGuid().ToString("N")[..12];
            var entries = c.WriteMany(actor, items.Select(kv => (Plugins.Stream + key, Types.PluginDataSet, (object)new PluginDataSet(kv.Key, kv.Value.GetRawText()))).ToList(), batch);
            return Results.Ok(new { count = entries.Count, batch, last = EntryView.Of(entries[^1]) });
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
            if (state is null || !state.Enabled) return Bad("Plugin {0} ist nicht installiert oder aus.", key);
            if (NichtImTarif(c, key) is { } nein) return nein;
            if (!Scan(dir).TryGetValue(key, out var m) || !m.Raw.TryGetProperty("process", out var proc)) return Bad("Plugin {0} hat keinen Prozess.", key);
            var values = new Dictionary<string, string> { ["journali"] = $"{req.Scheme}://{req.Host}", ["actor"] = actor, ["token"] = Auth.IssueServiceToken(actor) };
            foreach (var (k, v) in body.Params ?? new()) values[k] = v;
            var sw = Stopwatch.StartNew();
            try { var (exit, output) = await RunProcessAsync(dir, key, proc, values, TimeSpan.FromMinutes(30), ct); return Results.Ok(new { exit, ms = sw.ElapsedMilliseconds, output }); }
            catch (InvalidOperationException e) { return Bad(e.Message); }
            catch (System.ComponentModel.Win32Exception e) { return Bad("Prozess startet nicht: {0}", e.Message); }
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

    /// <summary>Gehört das Plugin nicht zum Tarif der Instanz: 403 mit dem Tarif, der es hat.</summary>
    public static IResult? NichtImTarif(Catalog c, string key)
    {
        var t = c.InstanzTarif;
        if (t.Erlaubt(key)) return null;
        var ab = Tarife.Alle.FirstOrDefault(x => x.Erlaubt(key));
        return Results.Json(Err("{0} gehört zum Tarif {1} — diese Instanz hat {2}.", key, ab?.Label ?? "?", t.Label), statusCode: 403);
    }

    private static IResult Toggle(HttpRequest req, Catalog c, string key, bool on)
    {
        if (Actor(req) is not { } actor) return ActorMissing();
        if (on && NichtImTarif(c, key) is { } nein) return nein;
        return c.With((_, _, write) => c.Plugins.All.TryGetValue(key, out var s)
            ? on && Requires(JsonDocument.Parse(s.Manifest).RootElement).Where(r => !(c.Plugins.All.TryGetValue(r, out var b) && b.Enabled)).ToList() is { Count: > 0 } missing
                ? Bad("{0} braucht {1} — zuerst einschalten.", key, string.Join(", ", missing))   // Ergänzung ohne Basis
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
                // Ein leerer Platzhalter bleibt als leeres Argument stehen — die Skripte lesen positionsweise (job.mjs: <root> <dir> …);
                // ihn wegzulassen verschob alle folgenden (Test Leere_Parameter_verschieben_die_Argumente_nicht)
                if (filled.Length > 0 || !s.Contains('{') || System.Text.RegularExpressions.Regex.IsMatch(s, @"^\{\w+\}$")) psi.ArgumentList.Add(filled);
            }
        return psi;
    }

    public sealed record RunRequest(Dictionary<string, string>? Params);
}
