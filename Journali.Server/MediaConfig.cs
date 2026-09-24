using System.Text.Json;
using System.Text.Json.Serialization;
using Npgsql;

namespace Journali.Server;

/// <summary>
/// Einstellung des Medienspeichers: liegt als <c>media.json</c> im Datenverzeichnis des Servers (JOURNALI_JOBS, neben secrets.json) — nie im Journal
/// (Geheimnis), nie im Repo. Fehlt die Datei, gilt die Umgebung (JOURNALI_MEDIA …). Umschalten im Betrieb: der
/// <see cref="SwitchableMediaStore"/> tauscht den Treiber aus; die Blobs zieht danach der Kopierlauf.
/// </summary>
public sealed record MediaConfig(
    string Driver = "postgres",           // postgres | file | s3
    string? Path = null,                  // file
    string? Bucket = null, string? Endpoint = null, string? Key = null, string? Secret = null, string? Region = null, bool PathStyle = true)   // s3
{
    /// <summary>Kurzform für Meldungen — ohne Geheimnis.</summary>
    public string Spec => Driver switch { "file" => Path ?? "media", "s3" => $"s3://{Bucket}", _ => "postgres" };
    public MediaConfig Masked() => this with { Secret = string.IsNullOrEmpty(Secret) ? null : "••••••••" };
    /// <summary>Aus der Umgebung (Vorgabe, wenn keine media.json liegt).</summary>
    public static MediaConfig FromEnv(IConfiguration cfg)
    {
        var s = (cfg["JOURNALI_MEDIA"] ?? "postgres").Trim();
        var c = s.Equals("postgres", StringComparison.OrdinalIgnoreCase) ? new MediaConfig("postgres")
            : s.StartsWith("s3://", StringComparison.OrdinalIgnoreCase) ? new MediaConfig("s3", Bucket: s[5..].Trim('/'), Endpoint: cfg["JOURNALI_S3_ENDPOINT"], Key: cfg["JOURNALI_S3_KEY"], Secret: cfg["JOURNALI_S3_SECRET"], Region: cfg["JOURNALI_S3_REGION"] ?? "garage", PathStyle: !string.Equals(cfg["JOURNALI_S3_PATHSTYLE"], "false", StringComparison.OrdinalIgnoreCase))
            : new MediaConfig("file", Path: s);
        return c;
    }
}

public static class MediaConfigFile
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    public static string PathOf(string dir) => System.IO.Path.Combine(dir, "media.json");
    public static MediaConfig? Load(string dir)
    {
        try { return File.Exists(PathOf(dir)) ? JsonSerializer.Deserialize<MediaConfig>(File.ReadAllText(PathOf(dir)), Json) : null; } catch { return null; }
    }
    public static void Save(string dir, MediaConfig c) { Directory.CreateDirectory(dir); File.WriteAllText(PathOf(dir), JsonSerializer.Serialize(c, Json)); }
}

/// <summary>Der eine Store, den die API kennt — innen austauschbar (Einstellungen → Storage → Speichern).</summary>
public sealed class SwitchableMediaStore : IMediaStore
{
    private readonly NpgsqlDataSource _db; private readonly ILogger _log; private readonly string _contentRoot;
    private IMediaStore _inner;
    public MediaConfig Config { get; private set; }

    public SwitchableMediaStore(MediaConfig config, NpgsqlDataSource db, ILogger log, string contentRoot)
    {
        _db = db; _log = log; _contentRoot = contentRoot; Config = config; _inner = Build(config);
    }

    public IMediaStore Build(MediaConfig c)
    {
        return c.Driver switch
        {
            "file" => new FileMediaStore(System.IO.Path.IsPathRooted(c.Path ?? "media") ? c.Path! : System.IO.Path.Combine(_contentRoot, c.Path ?? "media")),
            "s3" => new S3MediaStore(
                c.Endpoint is { Length: > 0 } ? c.Endpoint : throw new InvalidOperationException("Endpoint fehlt (z. B. http://garage:3900)."),
                c.Bucket is { Length: > 0 } ? c.Bucket : throw new InvalidOperationException("Bucket fehlt."),
                c.Key is { Length: > 0 } ? c.Key : throw new InvalidOperationException("Key fehlt."),
                c.Secret is { Length: > 0 } ? c.Secret : throw new InvalidOperationException("Secret fehlt."),
                c.Region is { Length: > 0 } ? c.Region : "garage", c.PathStyle),
            _ => new PostgresMediaStore(_db),
        };
    }

    /// <summary>Neue Einstellung: bauen, prüfen, erst dann übernehmen. Liefert die Fehlmeldung, wenn es nicht geht.</summary>
    public async Task<string?> SwitchAsync(MediaConfig c, CancellationToken ct)
    {
        IMediaStore next;
        try { next = Build(c); } catch (Exception e) { return e.Message; }
        if (await next.ProbeAsync(ct) is { } error) return error;
        _inner = next; Config = c;
        _log.LogInformation("Medienspeicher: {Kind}", next.Kind);
        return null;
    }

    public string Kind => _inner.Kind;
    public Task<(string Sha256, long Bytes)> PutAsync(Stream data, CancellationToken ct) => _inner.PutAsync(data, ct);
    public Task PutAsync(string key, Stream data, CancellationToken ct) => _inner.PutAsync(key, data, ct);
    public Task<bool> ExistsAsync(string key, CancellationToken ct) => _inner.ExistsAsync(key, ct);
    public Task<Stream?> OpenAsync(string key, CancellationToken ct) => _inner.OpenAsync(key, ct);
    public IAsyncEnumerable<string> KeysAsync(CancellationToken ct) => _inner.KeysAsync(ct);
    public Task<string?> ProbeAsync(CancellationToken ct) => _inner.ProbeAsync(ct);
}
