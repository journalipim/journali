using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Dateibrowser des Servers: ein Endpunkt für alles, was ein Pfad auf dem Server ist — Verzeichnis des Medienspeichers (Einstellungen →
/// Storage), Quelle eines Imports, Ziel eines Exports (Jobs). Ein Verzeichnis: Unterverzeichnisse, Dateien (Größe, Zeit, neueste
/// zuerst), Vater, die Wurzeln (Datenverzeichnis, Programm, Laufwerke) und <c>blobs</c> (Hash-Ordner, zwei Zeichen — sieht nach
/// einem Medienspeicher aus). Leer = Datenverzeichnis. Versteckte Einträge bleiben weg. Recht: Jobs oder Storage (Auth).
/// </summary>
public static class FileApi
{
    public static void Map(RouteGroupBuilder api, string dataDir, IHostEnvironment env)
    {
        api.MapGet("/files", (string? path) => Files(dataDir, env.ContentRootPath, path));
    }

    private static IResult Files(string dataDir, string contentRoot, string? path)
    {
        var dir = string.IsNullOrWhiteSpace(path) ? dataDir : path.Trim();
        try
        {
            dir = Path.GetFullPath(dir);
            if (File.Exists(dir)) dir = Path.GetDirectoryName(dir) ?? dir;   // eine Datei angegeben: ihr Verzeichnis zeigen
            if (!Directory.Exists(dir)) return Bad($"Verzeichnis nicht gefunden: {dir}");
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
        catch (UnauthorizedAccessException) { return Bad($"Kein Zugriff: {dir}"); }
        catch (Exception e) { return Bad(e.Message); }
    }
}
