using System.IO.Compression;
using System.Text.Json;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Der Katalog zertifizierter Plugins: eine <c>catalog.json</c> beim Herausgeber (<c>JOURNALI_PLUGIN_CATALOG</c>, Vorgabe
/// das Verzeichnis auf GitHub) mit einem Zip je Plugin. Der Server liest den Katalog (eine Stunde gepuffert) und holt
/// ein Plugin auf Wunsch: Zip laden, entpacken, Siegel prüfen — nur mit gültigem Siegel kommt es nach <c>plugins/</c>.
/// Ohne Netz ist der Katalog leer; installiert wird danach wie jedes Plugin von der Platte.
/// </summary>
public static class PluginCatalogApi
{
    public const string DefaultUrl = "https://raw.githubusercontent.com/journalipim/plugins/main/catalog.json";
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromMinutes(2) };
    private static (DateTime At, JsonElement Doc)? cache;
    private static readonly SemaphoreSlim Lock = new(1, 1);

    public static string Url => Environment.GetEnvironmentVariable("JOURNALI_PLUGIN_CATALOG") is { Length: > 0 } u ? u : DefaultUrl;

    /// <summary>Den Katalog holen — gepuffert; <c>fresh</c> erzwingt das Laden. Fehler liefern einen leeren Katalog mit Grund.</summary>
    public static async Task<(JsonElement? Doc, string? Grund)> LoadAsync(bool fresh, CancellationToken ct)
    {
        if (!fresh && cache is { } c && DateTime.UtcNow - c.At < TimeSpan.FromHours(1)) return (c.Doc, null);
        await Lock.WaitAsync(ct);
        try
        {
            if (!fresh && cache is { } c2 && DateTime.UtcNow - c2.At < TimeSpan.FromHours(1)) return (c2.Doc, null);
            var json = await Http.GetStringAsync(Url, ct);
            var doc = JsonDocument.Parse(json).RootElement.Clone();
            cache = (DateTime.UtcNow, doc);
            return (doc, null);
        }
        catch (Exception e) { return (cache?.Doc, "Katalog nicht erreichbar: " + e.Message); }
        finally { Lock.Release(); }
    }

    public static void Map(RouteGroupBuilder api, string dir)
    {
        // Der Katalog mit dem Stand auf der Platte je Eintrag
        api.MapGet("/plugins/catalog", async (bool fresh, CancellationToken ct) =>
        {
            var (doc, grund) = await LoadAsync(fresh, ct);
            var disk = PluginApi.Scan(dir);
            var list = new List<object>();
            if (doc is { } d && d.TryGetProperty("plugins", out var arr) && arr.ValueKind == JsonValueKind.Array)
                foreach (var p in arr.EnumerateArray())
                {
                    var key = p.TryGetProperty("key", out var k) ? k.GetString() ?? "" : "";
                    if (!ValidKey(key)) continue;
                    var m = disk.GetValueOrDefault(key);
                    list.Add(new { entry = p, onDisk = m is not null, diskVersion = m?.Version, certified = m?.Seal.Certified ?? false });
                }
            return Results.Ok(new { url = Url, updated = doc is { } dd && dd.TryGetProperty("updated", out var u) ? u.GetString() : null, error = grund, plugins = list });
        });

        // Ein Plugin aus dem Katalog holen: Zip laden, entpacken, Siegel prüfen, nach plugins/<key> — vorhandenes wird ersetzt
        api.MapPost("/plugins/catalog/{key}/fetch", async (string key, HttpRequest req, CancellationToken ct) =>
        {
            if (Actor(req) is null) return ActorMissing();
            if (!ValidKey(key)) return Bad("Schlüssel ungültig.");
            var (doc, grund) = await LoadAsync(false, ct);
            if (doc is not { } d) return Bad(grund ?? "Kein Katalog.");
            JsonElement? entry = null;
            if (d.TryGetProperty("plugins", out var arr))
                foreach (var p in arr.EnumerateArray()) if (p.TryGetProperty("key", out var k) && k.GetString() == key) entry = p;
            if (entry is not { } ce || !ce.TryGetProperty("file", out var f) || f.GetString() is not { Length: > 0 } file) return Results.NotFound(new { error = $"{key} steht nicht im Katalog." });
            var zipUrl = new Uri(new Uri(Url), file).ToString();
            var tmp = Path.Combine(Path.GetTempPath(), "journali-plugin-" + Guid.NewGuid().ToString("N"));
            try
            {
                Directory.CreateDirectory(tmp);
                var bytes = await Http.GetByteArrayAsync(zipUrl, ct);
                if (bytes.Length > 200_000_000) return Bad("Zip grösser als 200 MB.");
                using (var zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read))
                {
                    foreach (var z in zip.Entries)
                    {
                        // Pfade bleiben unter tmp — kein .. und kein absoluter Pfad
                        var target = Path.GetFullPath(Path.Combine(tmp, z.FullName.Replace('\\', '/')));
                        if (!target.StartsWith(tmp + Path.DirectorySeparatorChar, StringComparison.Ordinal) && target != tmp) return Bad("Zip mit Pfad ausserhalb des Verzeichnisses.");
                        if (z.FullName.EndsWith('/')) { Directory.CreateDirectory(target); continue; }
                        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                        z.ExtractToFile(target, true);
                    }
                }
                // Wurzel: plugins/<key>/… oder direkt die Dateien
                var src = Directory.Exists(Path.Combine(tmp, key)) ? Path.Combine(tmp, key) : tmp;
                var manifestFile = Path.Combine(src, "plugin.json");
                if (!File.Exists(manifestFile)) return Bad("plugin.json fehlt im Zip.");
                var raw = JsonDocument.Parse(File.ReadAllText(manifestFile)).RootElement;
                var version = raw.TryGetProperty("version", out var v) ? v.GetString() ?? "0" : "0";
                if (!(raw.TryGetProperty("key", out var kk) && kk.GetString() == key)) return Bad("Manifest nennt einen anderen Schlüssel.");
                var seal = PluginSeal.Check(src, key, version);
                if (!seal.Certified) return Bad("Siegel ungültig: " + (seal.Grund ?? "kein Zertifikat"));
                var dest = Path.Combine(dir, key);
                if (Directory.Exists(dest)) Directory.Delete(dest, true);
                CopyDir(src, dest);
                return Results.Ok(new { key, version, issued = seal.Issued });
            }
            catch (HttpRequestException e) { return Bad("Zip nicht ladbar: " + e.Message); }
            catch (InvalidDataException e) { return Bad("Kein Zip: " + e.Message); }
            finally { try { Directory.Delete(tmp, true); } catch { } }
        });
    }

    private static void CopyDir(string src, string dest)
    {
        Directory.CreateDirectory(dest);
        foreach (var f in Directory.GetFiles(src)) File.Copy(f, Path.Combine(dest, Path.GetFileName(f)), true);
        foreach (var d in Directory.GetDirectories(src)) CopyDir(d, Path.Combine(dest, Path.GetFileName(d)));
    }
}
