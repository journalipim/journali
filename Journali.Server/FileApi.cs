using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Dateibrowser des Servers: ein Endpunkt für alles, was ein Pfad auf dem Server ist — Verzeichnis des Medienspeichers (Einstellungen →
/// Storage), Quelle eines Imports, Ziel eines Exports (Jobs). Ein Verzeichnis: Unterverzeichnisse, Dateien (Größe, Zeit, neueste
/// zuerst), Vater, die Wurzeln (Datenverzeichnis, Programm, Laufwerke) und <c>blobs</c> (Hash-Ordner, zwei Zeichen — sieht nach
/// einem Medienspeicher aus). Leer = Datenverzeichnis. Versteckte Einträge bleiben weg. Recht: Jobs oder Storage (Auth).
/// <para>Dazu zwei Befehle für den Browser: ein Verzeichnis anlegen und eines umbenennen. Mehr nicht — gelöscht wird
/// hier nichts, und Dateien fasst der Browser nicht an.</para>
/// </summary>
public static class FileApi
{
    public sealed record NeuBody(string? Path, string? Name);
    public sealed record UmbenennenBody(string? Path, string? Name);

    public static void Map(RouteGroupBuilder api, string dataDir, IHostEnvironment env)
    {
        // Der Weg über den Zugang heisst /api/drivers/{zugang}/… (DriverApi). Diese Routen bleiben als der kurze
        // Weg zum Dateisystem des Servers — sie sind der Zugang „lokal“ ohne seinen Namen (25.09.2026).
        api.MapGet("/files", (string? path) => Files(dataDir, env.ContentRootPath, path));
        api.MapPost("/files/dir", (NeuBody body, HttpRequest req) => NeuesVerzeichnis(body, req));
        api.MapPut("/files/dir", (UmbenennenBody body, HttpRequest req) => VerzeichnisUmbenennen(body, req));
    }

    /// <summary>Anlegen: &lt;path&gt;/&lt;name&gt;. Gibt es das Verzeichnis schon, ist nichts zu tun — der Browser springt hinein.</summary>
    internal static IResult NeuesVerzeichnis(NeuBody body, HttpRequest req)
    {
        if (Actor(req) is null) return ActorMissing();
        if (Name(body.Name) is not { } name) return Bad("Name: ohne \\ / : * ? \" < > | und nicht leer.");
        if (string.IsNullOrWhiteSpace(body.Path) || !Directory.Exists(body.Path)) return Bad("Verzeichnis nicht gefunden: {0}", body.Path ?? "");
        var ziel = Path.Combine(Path.GetFullPath(body.Path), name);
        try
        {
            if (File.Exists(ziel)) return Bad("„{0}“ ist eine Datei.", name);
            Directory.CreateDirectory(ziel);
            return Results.Ok(new { path = ziel });
        }
        catch (UnauthorizedAccessException) { return Bad("Kein Zugriff: {0}", ziel); }
        catch (Exception e) { return Bad(e.Message); }
    }

    /// <summary>Umbenennen: derselbe Vater, neuer Name. Nur Verzeichnisse.</summary>
    internal static IResult VerzeichnisUmbenennen(UmbenennenBody body, HttpRequest req)
    {
        if (Actor(req) is null) return ActorMissing();
        if (Name(body.Name) is not { } name) return Bad("Name: ohne \\ / : * ? \" < > | und nicht leer.");
        if (string.IsNullOrWhiteSpace(body.Path) || !Directory.Exists(body.Path)) return Bad("Verzeichnis nicht gefunden: {0}", body.Path ?? "");
        var alt = Path.GetFullPath(body.Path);
        if (Path.GetDirectoryName(alt) is not { Length: > 0 } vater) return Bad("Ein Laufwerk lässt sich nicht umbenennen.");
        var neu = Path.Combine(vater, name);
        try
        {
            if (string.Equals(alt, neu, StringComparison.OrdinalIgnoreCase)) return Results.Ok(new { path = alt });
            if (Directory.Exists(neu) || File.Exists(neu)) return Bad("„{0}“ gibt es hier schon.", name);
            Directory.Move(alt, neu);
            return Results.Ok(new { path = neu });
        }
        catch (UnauthorizedAccessException) { return Bad("Kein Zugriff: {0}", alt); }
        catch (IOException e) { return Bad(e.Message); }
    }

    /// <summary>Ein Verzeichnisname: keine Trenn- und Sonderzeichen, kein Pfad, nicht . oder ..</summary>
    public static string? Name(string? s)
    {
        var n = (s ?? "").Trim();
        if (n.Length is 0 or > 120 || n is "." or "..") return null;
        return n.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || n.Contains('/') || n.Contains('\\') ? null : n;
    }

    internal static IResult Files(string dataDir, string contentRoot, string? path)
    {
        var dir = string.IsNullOrWhiteSpace(path) ? dataDir : path.Trim();
        try
        {
            dir = Path.GetFullPath(dir);
            if (File.Exists(dir)) dir = Path.GetDirectoryName(dir) ?? dir;   // eine Datei angegeben: ihr Verzeichnis zeigen
            if (!Directory.Exists(dir)) return Bad("Verzeichnis nicht gefunden: {0}", dir);
            var info = new DirectoryInfo(dir);
            static bool Hidden(FileSystemInfo f) => f.Name.StartsWith('.') || (f.Attributes & (FileAttributes.Hidden | FileAttributes.System)) != 0;
            var dirs = info.EnumerateDirectories().Where(d => !Hidden(d)).OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase).Select(d => new { d.Name, path = d.FullName }).ToList();
            var files = info.EnumerateFiles().Where(f => !Hidden(f)).OrderByDescending(f => f.LastWriteTimeUtc).Select(f => new { f.Name, path = f.FullName, size = f.Length, at = f.LastWriteTimeUtc }).ToList();
            var blobs = dirs.Count(d => d.Name.Length == 2);
            var roots = new List<object> { new { label = "⌂ Datenverzeichnis", path = Path.GetFullPath(dataDir) }, new { label = "▣ Programm", path = Path.GetFullPath(contentRoot) } };
            if (OperatingSystem.IsWindows())
                roots.AddRange(DriveInfo.GetDrives().Where(d => d.IsReady && d.DriveType is DriveType.Fixed or DriveType.Network or DriveType.Removable).Select(d => new { label = d.Name.TrimEnd('\\', '/') + (string.IsNullOrEmpty(d.VolumeLabel) ? "" : " " + d.VolumeLabel), path = d.RootDirectory.FullName }));
            else roots.Add(new { label = "/", path = "/" });
            return Results.Ok(new { path = dir, parent = info.Parent?.FullName, roots, dirs, files, blobs });
        }
        catch (UnauthorizedAccessException) { return Bad("Kein Zugriff: {0}", dir); }
        catch (Exception e) { return Bad(e.Message); }
    }
}
