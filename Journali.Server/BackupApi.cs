using System.IO.Compression;
using System.Text;
using System.Text.Json;
using Journali.Core.Journal;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Vollsicherung und Wiederherstellung. Der Unterschied zu <c>pg_dump</c>: dieses Format
/// hängt an nichts — nicht an der Postgres-Fassung, nicht am Schema, nicht am Treiber des Medienspeichers.
/// <para>Eine Sicherung ist ein Verzeichnis: <c>journal.ndjson.gz</c> (ein Eintrag je Zeile, mit Nummer, Zeit,
/// Urheber), <c>media/</c> (die Blobs, benannt nach ihrem Schlüssel) und <c>backup.json</c> (Zeitpunkt, Anzahl,
/// Art des Medienspeichers). Zurück geht sie nur in ein leeres System — <see cref="IJournal.RestoreAll"/>.</para>
/// <para>Die Abbilder stehen danach nicht neu: der Server baut sie beim Start aus dem Journal. Nach einer
/// Wiederherstellung also einmal neu starten.</para>
/// </summary>
public static class BackupApi
{
    public sealed record Body(string Dir, bool Media = true, bool Config = true, bool Plugins = true);

    /// <summary>
    /// Was neben dem Journal liegt und ohne das ein wiederhergestelltes System nicht läuft:
    /// <c>auth.json</c> (Passwort-Hashes, API-Token, Sitzungen), <c>media.json</c> (Speicher-Einstellung, bei S3 mit
    /// Zugangsdaten), <c>mail.json</c> (Mailserver mit Passwort), <c>jobs/secrets.json</c> (Token der Jobs). Wer sie mitsichert, hat Geheimnisse in der Sicherung
    /// — wie im Datenverzeichnis selbst. Wer sie weglässt, kommt in ein wiederhergestelltes System nicht hinein.
    /// </summary>
    /// <remarks>
    /// Die Lizenz ist <b>nicht</b> dabei. Sie steht in der Datenbank, auf
    /// die Kennung dieser Instanz ausgestellt; eine wiederhergestellte Instanz bekommt eine neue Kennung und läuft im
    /// Testbetrieb, bis eine Lizenz für sie ausgestellt wird.
    /// </remarks>
    private static readonly string[] Dateien = ["auth.json", "media.json", "mail.json", Path.Combine("jobs", "secrets.json")];
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static void Map(RouteGroupBuilder api, IJournal journal, string dataDir, string pluginDir)
    {
        // Was steht hier, und was liegt in einem Sicherungsverzeichnis?
        api.MapGet("/backup/status", async (Catalog c, IMediaStore store, string? dir, CancellationToken ct) =>
        {
            var hier = new { entries = journal.Head, media = c.Read(_ => c.Media.All.Count), storage = store.Kind };
            if (string.IsNullOrWhiteSpace(dir)) return Results.Ok(new { hier, dort = (object?)null });
            var meta = Path.Combine(dir.Trim(), "backup.json");
            if (!File.Exists(meta)) return Results.Ok(new { hier, dort = (object?)null });
            try
            {
                var m = JsonSerializer.Deserialize<Meta>(await File.ReadAllTextAsync(meta, ct), Json);
                return Results.Ok(new { hier, dort = m });
            }
            catch (Exception e) { return Bad($"backup.json nicht lesbar: {e.Message}"); }
        });

        // Schreiben: Journal und (auf Wunsch) die Medien in ein Verzeichnis
        api.MapPost("/backup", async (Body body, HttpRequest req, Catalog c, IMediaStore store, CancellationToken ct) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (string.IsNullOrWhiteSpace(body.Dir)) return Bad("Verzeichnis fehlt.");
            var dir = Path.GetFullPath(body.Dir.Trim());
            Directory.CreateDirectory(dir);

            long n = 0;
            await using (var file = File.Create(Path.Combine(dir, "journal.ndjson.gz")))
            await using (var gz = new GZipStream(file, CompressionLevel.SmallestSize))
            await using (var writer = new StreamWriter(gz, new UTF8Encoding(false)))
                foreach (var e in journal.ReadAfter(0))
                {
                    await writer.WriteLineAsync(JsonSerializer.Serialize(e, Json));
                    n++;
                }

            long medien = 0, bytes = 0;
            var eigen = store.Kind == "postgres";   // nur, was in der Datenbank liegt, gehört in unsere Sicherung
            if (body.Media && eigen)
            {
                var ziel = Path.Combine(dir, "media");
                Directory.CreateDirectory(ziel);
                await foreach (var key in store.KeysAsync(ct))
                {
                    var name = Path.Combine(ziel, Sicher(key));
                    if (File.Exists(name)) { medien++; continue; }   // schon gesichert (gleicher Hash, gleicher Inhalt)
                    await using var quelle = await store.OpenAsync(key, ct);
                    if (quelle is null) continue;
                    await using var aus = File.Create(name);
                    await quelle.CopyToAsync(aus, ct);
                    medien++; bytes += aus.Length;
                }
            }

            var dateien = 0;
            if (body.Config)
            {
                var ziel = Path.Combine(dir, "config");
                Directory.CreateDirectory(ziel);
                foreach (var rel in Dateien)
                {
                    var quelle = Path.Combine(dataDir, rel);
                    if (!File.Exists(quelle)) continue;
                    File.Copy(quelle, Path.Combine(ziel, Sicher(rel)), overwrite: true);
                    dateien++;
                }
            }

            var plugins = 0;
            if (body.Plugins && Directory.Exists(pluginDir))
            {
                var ziel = Path.Combine(dir, "plugins");
                foreach (var quelle in Directory.EnumerateDirectories(pluginDir))
                {
                    Kopiere(quelle, Path.Combine(ziel, Path.GetFileName(quelle)));
                    plugins++;
                }
            }

            var meta = new Meta(DateTimeOffset.UtcNow, n, medien, bytes, store.Kind, actor, dateien, plugins);
            await File.WriteAllTextAsync(Path.Combine(dir, "backup.json"), JsonSerializer.Serialize(meta, Json), ct);
            return Results.Ok(new { meta.At, meta.Entries, meta.Media, meta.Bytes, meta.Storage, meta.Actor, meta.Config, meta.Plugins,
                hinweis = body.Media && !eigen ? $"Die Medien liegen in {store.Kind} und sind nicht mit gesichert — dafür sorgt der Betrieb." : null });
        });

        // Zurück in ein leeres System
        api.MapPost("/backup/restore", async (Body body, HttpRequest req, Catalog c, IMediaStore store, CancellationToken ct) =>
        {
            if (Actor(req) is null) return ActorMissing();
            if (string.IsNullOrWhiteSpace(body.Dir)) return Bad("Verzeichnis fehlt.");
            var dir = Path.GetFullPath(body.Dir.Trim());
            var quelle = Path.Combine(dir, "journal.ndjson.gz");
            if (!File.Exists(quelle)) return Bad($"Keine Sicherung in {dir} (journal.ndjson.gz fehlt).");
            if (journal.Head > 0) return Bad($"Hier stehen schon {journal.Head} Einträge — wiederhergestellt wird nur in ein leeres System.");

            int n;
            try { n = journal.RestoreAll(Lesen(quelle)); }
            catch (InvalidOperationException e) { return Bad(e.Message); }
            catch (Exception e) { return Bad($"Journal nicht lesbar: {e.Message}"); }

            long medien = 0;
            var mdir = Path.Combine(dir, "media");
            if (body.Media && store.Kind == "postgres" && Directory.Exists(mdir))
                foreach (var f in Directory.EnumerateFiles(mdir))
                {
                    var key = Klar(Path.GetFileName(f));
                    if (await store.ExistsAsync(key, ct)) continue;
                    await using var ein = File.OpenRead(f);
                    await store.PutAsync(key, ein, ct);
                    medien++;
                }

            var dateien = 0;
            var cdir = Path.Combine(dir, "config");
            if (body.Config && Directory.Exists(cdir))
                foreach (var rel in Dateien)
                {
                    var gesichert = Path.Combine(cdir, Sicher(rel));
                    var ziel = Path.Combine(dataDir, rel);
                    if (!File.Exists(gesichert) || File.Exists(ziel)) continue;   // nie überschreiben, was hier schon steht
                    Directory.CreateDirectory(Path.GetDirectoryName(ziel)!);
                    File.Copy(gesichert, ziel);
                    dateien++;
                }

            var plugins = 0;
            var pdir = Path.Combine(dir, "plugins");
            if (body.Plugins && Directory.Exists(pdir))
                foreach (var gesichert in Directory.EnumerateDirectories(pdir))
                {
                    var ziel = Path.Combine(pluginDir, Path.GetFileName(gesichert));
                    if (Directory.Exists(ziel)) continue;   // nie überschreiben, was hier schon steht
                    Kopiere(gesichert, ziel);
                    plugins++;
                }

            var npm = plugins > 0 ? " Plugins mit eigenen Paketen brauchen einmal npm install (node_modules sind nicht in der Sicherung — sie gehören zum Betriebssystem)." : "";
            return Results.Ok(new { entries = n, media = medien, config = dateien, plugins, hinweis = "Der Server baut die Abbilder beim Start aus dem Journal — jetzt neu starten." + npm });
        });
    }

    public sealed record Meta(DateTimeOffset At, long Entries, long Media, long Bytes, string? Storage, string Actor, int Config = 0, int Plugins = 0);

    /// <summary>
    /// Ein Plugin-Verzeichnis kopieren — ohne <c>node_modules</c>. Die Pakete bleiben draussen: sie sind für ein Betriebssystem gebaut — sharp und pdfjs bringen
    /// Binärdateien mit, die auf einem anderen Rechner nicht laufen. Ein <c>npm install</c> stellt sie her, die
    /// Fassungen stehen in package-lock.json, die mitkommt.
    /// </summary>
    private static void Kopiere(string von, string nach)
    {
        Directory.CreateDirectory(nach);
        foreach (var datei in Directory.EnumerateFiles(von)) File.Copy(datei, Path.Combine(nach, Path.GetFileName(datei)), overwrite: true);
        foreach (var unter in Directory.EnumerateDirectories(von))
        {
            var name = Path.GetFileName(unter);
            if (name is "node_modules" or ".git") continue;
            Kopiere(unter, Path.Combine(nach, name));
        }
    }

    /// <summary>Einträge einer Sicherung, Zeile für Zeile — gestreamt, damit auch ein grosses Journal durchgeht.</summary>
    private static IEnumerable<Entry> Lesen(string file)
    {
        using var stream = File.OpenRead(file);
        using var gz = new GZipStream(stream, CompressionMode.Decompress);
        using var reader = new StreamReader(gz);
        while (reader.ReadLine() is { } line)
        {
            if (line.Length == 0) continue;
            var e = JsonSerializer.Deserialize<Entry>(line, Json);
            if (e is not null) yield return e;
        }
    }

    /// <summary>Ein Schlüssel als Dateiname: Medienschlüssel sind Hashes, aber Abgeleitetes trägt einen Punkt
    /// (<c>sha.thumb</c>) und könnte einen Pfad enthalten — hier kommt nichts durch, was aus dem Verzeichnis führt.</summary>
    private static string Sicher(string key) => key.Replace('/', '~').Replace('\\', '~');
    private static string Klar(string name) => name.Replace('~', '/');
}
