using System.IO.Compression;
using System.Text.Json;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Wiederherstellen aus einer Sicherung. Nicht als Plugin, weil ein Plugin fehlen oder aus sein kann — und genau dann, wenn
/// wiederhergestellt werden muss, ist oft nichts eingerichtet.
/// <para>Gelesen wird, was das Plugin <c>backup</c> schreibt: Rohdaten-JSON eines Teilbaums mit Modellteil
/// (<see cref="TransferApi.RawExport"/>), auch gzip-gepackt (.json.gz). Geschrieben wird über denselben Weg wie der
/// JSON-Import — <see cref="TransferApi.Import"/>, ein Stapel, kein zweiter Schreibpfad ins Journal.</para>
/// <para>Ein Trockenlauf sagt vorher, was geschähe: wie viele Knoten neu wären, wie viele angeglichen, wie viele aus
/// dem Papierkorb zurückkämen, und was das Modell mitbringt.</para>
/// </summary>
public static class RestoreApi
{
    public sealed record Body(string Path, bool DryRun = true, string? Parent = null);

    public static void Map(RouteGroupBuilder api)
    {
        // Was liegt in diesem Verzeichnis an Sicherungen? Name, Grösse, Zeitpunkt — jüngste zuerst
        api.MapGet("/restore/files", (string? path) =>
        {
            var dir = (path ?? "").Trim();
            if (dir.Length == 0 || !Directory.Exists(dir)) return Bad("Verzeichnis nicht gefunden.");
            var files = new DirectoryInfo(dir).EnumerateFiles()
                .Where(f => f.Name.EndsWith(".json", StringComparison.OrdinalIgnoreCase) || f.Name.EndsWith(".json.gz", StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(f => f.LastWriteTimeUtc)
                .Select(f => new { f.Name, path = f.FullName, size = f.Length, at = f.LastWriteTimeUtc })
                .Take(200).ToList();
            return Results.Ok(new { path = Path.GetFullPath(dir), files });
        });

        // Einspielen — dryRun: true sagt nur, was geschähe
        api.MapPost("/restore", (Body body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (string.IsNullOrWhiteSpace(body.Path)) return Bad("Datei fehlt.");
            var file = body.Path.Trim();
            if (!File.Exists(file)) return Bad("Datei nicht gefunden: {0}", file);
            TransferApi.RawExport? raw;
            try { raw = JsonSerializer.Deserialize<TransferApi.RawExport>(Lesen(file), Json); }
            catch (Exception e) { return Bad("Keine Sicherung lesbar: {0}", e.Message); }
            if (raw?.Node is null) return Bad("Die Datei enthält keinen Teilbaum.");
            return TransferApi.Einspielen(c, actor, new TransferApi.ImportBody(raw.Node, body.Parent, raw.Model, null, body.DryRun));
        });
    }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>Die Datei als Text — gepackt (.json.gz, so schreibt es die Sicherung) oder roh.</summary>
    private static string Lesen(string file)
    {
        using var stream = File.OpenRead(file);
        if (!file.EndsWith(".gz", StringComparison.OrdinalIgnoreCase)) { using var plain = new StreamReader(stream); return plain.ReadToEnd(); }
        using var gzip = new GZipStream(stream, CompressionMode.Decompress);
        using var reader = new StreamReader(gzip);
        return reader.ReadToEnd();
    }
}
