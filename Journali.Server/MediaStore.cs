using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using Npgsql;

namespace Journali.Server;

/// <summary>
/// Wo die Bytes liegen (docs/pflegestruktur.md, 20): ausserhalb des Journals, adressiert über den SHA-256 der Datei.
/// Das Journal kennt nur den Hash (<c>MediaCreated</c>); gleiche Bytes = gleicher Hash = dieselbe Datei, unveränderlich.
/// Der Treiber ist Konfiguration, nicht Bauzeit (Taloan, 19.09.2026: „Datenbank auf Azure, Assets im günstigen Object Storage“):
/// <c>JOURNALI_MEDIA</c> = <c>postgres</c> (Vorgabe — Tabelle <c>media_blob</c> neben dem Journal, ein Paket = lauffähig),
/// ein Verzeichnis, oder <c>s3://bucket</c> (Garage, MinIO, AWS, R2, Hetzner …); dazu <c>JOURNALI_MEDIA_ORIGIN</c> = eine andere
/// journali-Instanz als Ursprung (Read-through/Write-through, für Entwicklung neben dem Produktivsystem).
/// Schlüssel: der Hash, oder Hash + Suffix für Abgeleitetes (<c>.thumb</c> = Vorschau). Der Server berührt Bytes nur beim
/// Hochladen und Ausliefern.
/// </summary>
public interface IMediaStore
{
    string Kind { get; }
    /// <summary>Datei ablegen; liefert Hash und Grösse. Liegt der Hash schon, wird nichts überschrieben.</summary>
    Task<(string Sha256, long Bytes)> PutAsync(Stream data, CancellationToken ct);
    /// <summary>Unter festem Schlüssel ablegen (Abgeleitetes wie <c>sha.thumb</c>, oder Kopie eines Blobs von anderswo).</summary>
    Task PutAsync(string key, Stream data, CancellationToken ct);
    Task<bool> ExistsAsync(string key, CancellationToken ct);
    Task<Stream?> OpenAsync(string key, CancellationToken ct);
    /// <summary>Alle Schlüssel — für den Kopierlauf zwischen Treibern.</summary>
    IAsyncEnumerable<string> KeysAsync(CancellationToken ct);
}

public static partial class MediaStores
{
    [GeneratedRegex("^[0-9a-f]{64}(\\.[a-z0-9]{1,16})?$")]
    private static partial Regex KeyRx();
    public static bool ValidKey(string key) => KeyRx().IsMatch(key);

    /// <summary>Treiber aus der Angabe: <c>postgres</c>, <c>s3://bucket</c>, sonst ein Verzeichnis. <c>origin</c> legt sich darüber.</summary>
    public static IMediaStore Create(string? spec, NpgsqlDataSource db, IConfiguration cfg, ILogger log, string contentRoot)
    {
        var s = (spec ?? "postgres").Trim();
        IMediaStore inner;
        if (s.Equals("postgres", StringComparison.OrdinalIgnoreCase)) inner = new PostgresMediaStore(db);
        else if (s.StartsWith("s3://", StringComparison.OrdinalIgnoreCase))
        {
            var bucket = s[5..].Trim('/');
            inner = new S3MediaStore(
                cfg["JOURNALI_S3_ENDPOINT"] ?? throw new InvalidOperationException("JOURNALI_S3_ENDPOINT fehlt (z. B. http://garage:3900)."),
                bucket,
                cfg["JOURNALI_S3_KEY"] ?? throw new InvalidOperationException("JOURNALI_S3_KEY fehlt."),
                cfg["JOURNALI_S3_SECRET"] ?? throw new InvalidOperationException("JOURNALI_S3_SECRET fehlt."),
                cfg["JOURNALI_S3_REGION"] ?? "garage",
                !string.Equals(cfg["JOURNALI_S3_PATHSTYLE"], "false", StringComparison.OrdinalIgnoreCase));
        }
        else inner = new FileMediaStore(Path.IsPathRooted(s) ? s : Path.Combine(contentRoot, s));
        if (cfg["JOURNALI_MEDIA_ORIGIN"] is { Length: > 0 } origin) return new OriginMediaStore(inner, origin.TrimEnd('/'), cfg["JOURNALI_MEDIA_ORIGIN_ACTOR"] ?? "media-origin", log);
        return inner;
    }

    /// <summary>Strom in eine Temp-Datei, Hash unterwegs — jeder Treiber braucht Länge und Hash, bevor er ablegt.</summary>
    internal static async Task<(string Path, string Sha256, long Bytes)> SpoolAsync(Stream data, CancellationToken ct)
    {
        var tmp = Path.Combine(Path.GetTempPath(), "journali-" + Guid.NewGuid().ToString("n"));
        long bytes = 0; string sha;
        await using (var file = File.Create(tmp))
        using (var hasher = IncrementalHash.CreateHash(HashAlgorithmName.SHA256))
        {
            var buffer = new byte[81920]; int n;
            while ((n = await data.ReadAsync(buffer, ct)) > 0) { await file.WriteAsync(buffer.AsMemory(0, n), ct); hasher.AppendData(buffer, 0, n); bytes += n; }
            sha = Convert.ToHexString(hasher.GetHashAndReset()).ToLowerInvariant();
        }
        return (tmp, sha, bytes);
    }

    /// <summary>Kopierlauf: alles, was in <paramref name="from"/> liegt und in <paramref name="to"/> fehlt.</summary>
    public static async Task<(int Copied, int Skipped, int Failed)> CopyAsync(IMediaStore from, IMediaStore to, CancellationToken ct, Action<string>? say = null)
    {
        int copied = 0, skipped = 0, failed = 0;
        await foreach (var key in from.KeysAsync(ct))
        {
            if (await to.ExistsAsync(key, ct)) { skipped++; continue; }
            try
            {
                await using var src = await from.OpenAsync(key, ct);
                if (src is null) { failed++; continue; }
                await to.PutAsync(key, src, ct); copied++;
                say?.Invoke(key);
            }
            catch (Exception e) { failed++; say?.Invoke($"✗ {key}: {e.Message}"); }
        }
        return (copied, skipped, failed);
    }
}

/// <summary>Verzeichnis, Unterordner nach den ersten zwei Hexzeichen; Abgeleitetes liegt daneben (<c>ab/ab…cd.thumb</c>).</summary>
public sealed class FileMediaStore : IMediaStore
{
    private readonly string _root;
    public FileMediaStore(string root) { _root = Path.GetFullPath(root); Directory.CreateDirectory(_root); }
    public string Kind => "file:" + _root;
    public string Root => _root;
    private string PathOf(string key) => Path.Combine(_root, key[..2], key);

    public async Task<(string Sha256, long Bytes)> PutAsync(Stream data, CancellationToken ct)
    {
        var (tmp, sha, bytes) = await MediaStores.SpoolAsync(data, ct);
        var target = PathOf(sha);
        if (File.Exists(target)) File.Delete(tmp);
        else { Directory.CreateDirectory(Path.GetDirectoryName(target)!); File.Move(tmp, target); }
        return (sha, bytes);
    }

    public async Task PutAsync(string key, Stream data, CancellationToken ct)
    {
        if (!MediaStores.ValidKey(key)) throw new ArgumentException("Schlüssel ungültig.");
        var (tmp, _, _) = await MediaStores.SpoolAsync(data, ct);
        var target = PathOf(key);
        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
        File.Move(tmp, target, overwrite: true);
    }

    public Task<bool> ExistsAsync(string key, CancellationToken ct) => Task.FromResult(MediaStores.ValidKey(key) && File.Exists(PathOf(key)));
    public Task<Stream?> OpenAsync(string key, CancellationToken ct) => Task.FromResult<Stream?>(MediaStores.ValidKey(key) && File.Exists(PathOf(key)) ? File.OpenRead(PathOf(key)) : null);

    public async IAsyncEnumerable<string> KeysAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        foreach (var dir in Directory.EnumerateDirectories(_root))
            foreach (var f in Directory.EnumerateFiles(dir)) { var k = Path.GetFileName(f); if (MediaStores.ValidKey(k)) yield return k; }
        await Task.CompletedTask;
    }
}

/// <summary>Bytes in Postgres, Tabelle <c>media_blob</c> neben dem Journal (nicht darin): ein Paket = lauffähig, Sicherung = pg_dump.
/// Für grosse Bestände später auf s3 kopieren (POST /api/media/copy) — die Ids bleiben, das Journal ändert sich nicht.</summary>
public sealed class PostgresMediaStore : IMediaStore
{
    private readonly NpgsqlDataSource _db;
    public PostgresMediaStore(NpgsqlDataSource db)
    {
        _db = db;
        using var conn = _db.OpenConnection();
        using var cmd = new NpgsqlCommand("CREATE TABLE IF NOT EXISTS media_blob (key TEXT PRIMARY KEY, bytes BYTEA NOT NULL, size BIGINT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now());", conn);
        cmd.ExecuteNonQuery();
    }
    public string Kind => "postgres";

    public async Task<(string Sha256, long Bytes)> PutAsync(Stream data, CancellationToken ct)
    {
        var (tmp, sha, bytes) = await MediaStores.SpoolAsync(data, ct);
        try { await InsertAsync(sha, tmp, ct); } finally { File.Delete(tmp); }
        return (sha, bytes);
    }

    public async Task PutAsync(string key, Stream data, CancellationToken ct)
    {
        if (!MediaStores.ValidKey(key)) throw new ArgumentException("Schlüssel ungültig.");
        var (tmp, _, _) = await MediaStores.SpoolAsync(data, ct);
        try { await InsertAsync(key, tmp, ct, overwrite: true); } finally { File.Delete(tmp); }
    }

    private async Task InsertAsync(string key, string tmp, CancellationToken ct, bool overwrite = false)
    {
        var bytes = await File.ReadAllBytesAsync(tmp, ct);
        await using var conn = await _db.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand(overwrite
            ? "INSERT INTO media_blob (key, bytes, size) VALUES (@k, @b, @s) ON CONFLICT (key) DO UPDATE SET bytes = EXCLUDED.bytes, size = EXCLUDED.size, at = now()"
            : "INSERT INTO media_blob (key, bytes, size) VALUES (@k, @b, @s) ON CONFLICT (key) DO NOTHING", conn);
        cmd.Parameters.AddWithValue("k", key); cmd.Parameters.AddWithValue("b", bytes); cmd.Parameters.AddWithValue("s", (long)bytes.Length);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<bool> ExistsAsync(string key, CancellationToken ct)
    {
        if (!MediaStores.ValidKey(key)) return false;
        await using var conn = await _db.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT 1 FROM media_blob WHERE key = @k", conn);
        cmd.Parameters.AddWithValue("k", key);
        return await cmd.ExecuteScalarAsync(ct) is not null;
    }

    public async Task<Stream?> OpenAsync(string key, CancellationToken ct)
    {
        if (!MediaStores.ValidKey(key)) return null;
        await using var conn = await _db.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT bytes FROM media_blob WHERE key = @k", conn);
        cmd.Parameters.AddWithValue("k", key);
        return await cmd.ExecuteScalarAsync(ct) is byte[] b ? new MemoryStream(b, writable: false) : null;
    }

    public async IAsyncEnumerable<string> KeysAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        await using var conn = await _db.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT key FROM media_blob ORDER BY key", conn);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) yield return r.GetString(0);
    }
}

/// <summary>S3-kompatibel (Garage, MinIO, AWS, R2, Hetzner …) ohne SDK: Signature V4 per HttpClient — Npgsql bleibt das einzige Paket.
/// Pfad-Stil <c>endpoint/bucket/key</c> (Vorgabe; <c>JOURNALI_S3_PATHSTYLE=false</c> für <c>bucket.endpoint</c>).</summary>
public sealed class S3MediaStore : IMediaStore
{
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromMinutes(10) };
    private readonly Uri _endpoint; private readonly string _bucket, _key, _secret, _region; private readonly bool _pathStyle;

    public S3MediaStore(string endpoint, string bucket, string key, string secret, string region, bool pathStyle)
    {
        _endpoint = new Uri(endpoint.TrimEnd('/'), UriKind.Absolute); _bucket = bucket; _key = key; _secret = secret; _region = region; _pathStyle = pathStyle;
    }
    public string Kind => $"s3://{_bucket} @ {_endpoint.Host}";

    private Uri UriOf(string? objectKey, string? query = null)
    {
        var host = _pathStyle ? _endpoint.Host : $"{_bucket}.{_endpoint.Host}";
        var path = (_pathStyle ? "/" + _bucket : "") + "/" + (objectKey ?? "");
        return new UriBuilder(_endpoint.Scheme, host, _endpoint.Port, path) { Query = query ?? "" }.Uri;
    }

    private static string Hex(byte[] b) => Convert.ToHexString(b).ToLowerInvariant();
    private static byte[] Hmac(byte[] key, string data) => HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(data));

    /// <summary>AWS Signature V4 (Dienst s3); Payload-Hash mitgeben, wenn bekannt — sonst UNSIGNED-PAYLOAD.</summary>
    private HttpRequestMessage Sign(HttpMethod method, Uri uri, string payloadHash, HttpContent? content = null)
    {
        var now = DateTime.UtcNow; var amzDate = now.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture); var date = now.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        var req = new HttpRequestMessage(method, uri) { Content = content };
        req.Headers.Host = uri.IsDefaultPort ? uri.Host : $"{uri.Host}:{uri.Port}";
        req.Headers.Add("x-amz-date", amzDate);
        req.Headers.Add("x-amz-content-sha256", payloadHash);
        var canonicalQuery = string.Join("&", uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(p => { var i = p.IndexOf('='); return i < 0 ? (k: p, v: "") : (k: p[..i], v: p[(i + 1)..]); })
            .OrderBy(x => x.k, StringComparer.Ordinal).Select(x => $"{Uri.EscapeDataString(Uri.UnescapeDataString(x.k))}={Uri.EscapeDataString(Uri.UnescapeDataString(x.v))}"));
        var canonicalHeaders = $"host:{req.Headers.Host}\nx-amz-content-sha256:{payloadHash}\nx-amz-date:{amzDate}\n";
        const string signedHeaders = "host;x-amz-content-sha256;x-amz-date";
        var canonical = $"{method.Method}\n{uri.AbsolutePath}\n{canonicalQuery}\n{canonicalHeaders}\n{signedHeaders}\n{payloadHash}";
        var scope = $"{date}/{_region}/s3/aws4_request";
        var toSign = $"AWS4-HMAC-SHA256\n{amzDate}\n{scope}\n{Hex(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)))}";
        var kDate = Hmac(Encoding.UTF8.GetBytes("AWS4" + _secret), date); var kRegion = Hmac(kDate, _region); var kService = Hmac(kRegion, "s3"); var kSigning = Hmac(kService, "aws4_request");
        var signature = Hex(Hmac(kSigning, toSign));
        req.Headers.TryAddWithoutValidation("Authorization", $"AWS4-HMAC-SHA256 Credential={_key}/{scope}, SignedHeaders={signedHeaders}, Signature={signature}");
        return req;
    }

    public async Task<(string Sha256, long Bytes)> PutAsync(Stream data, CancellationToken ct)
    {
        var (tmp, sha, bytes) = await MediaStores.SpoolAsync(data, ct);
        try { if (!await ExistsAsync(sha, ct)) await UploadAsync(sha, tmp, sha, ct); } finally { File.Delete(tmp); }
        return (sha, bytes);
    }

    public async Task PutAsync(string key, Stream data, CancellationToken ct)
    {
        if (!MediaStores.ValidKey(key)) throw new ArgumentException("Schlüssel ungültig.");
        var (tmp, sha, _) = await MediaStores.SpoolAsync(data, ct);
        try { await UploadAsync(key, tmp, sha, ct); } finally { File.Delete(tmp); }
    }

    private async Task UploadAsync(string key, string tmp, string payloadSha, CancellationToken ct)
    {
        await using var file = File.OpenRead(tmp);
        var content = new StreamContent(file); content.Headers.ContentLength = file.Length; content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        using var res = await _http.SendAsync(Sign(HttpMethod.Put, UriOf(key), payloadSha, content), ct);
        if (!res.IsSuccessStatusCode) throw new IOException($"s3 PUT {key}: {(int)res.StatusCode} {await res.Content.ReadAsStringAsync(ct)}");
    }

    private const string Unsigned = "UNSIGNED-PAYLOAD";
    public async Task<bool> ExistsAsync(string key, CancellationToken ct)
    {
        if (!MediaStores.ValidKey(key)) return false;
        using var res = await _http.SendAsync(Sign(HttpMethod.Head, UriOf(key), Unsigned), ct);
        return res.IsSuccessStatusCode;
    }

    public async Task<Stream?> OpenAsync(string key, CancellationToken ct)
    {
        if (!MediaStores.ValidKey(key)) return null;
        var res = await _http.SendAsync(Sign(HttpMethod.Get, UriOf(key), Unsigned), HttpCompletionOption.ResponseHeadersRead, ct);
        if (res.StatusCode == System.Net.HttpStatusCode.NotFound) { res.Dispose(); return null; }
        if (!res.IsSuccessStatusCode) { var t = await res.Content.ReadAsStringAsync(ct); res.Dispose(); throw new IOException($"s3 GET {key}: {(int)res.StatusCode} {t}"); }
        return await res.Content.ReadAsStreamAsync(ct);
    }

    public async IAsyncEnumerable<string> KeysAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        string? token = null;
        do
        {
            var query = "list-type=2&max-keys=1000" + (token is null ? "" : "&continuation-token=" + Uri.EscapeDataString(token));
            using var res = await _http.SendAsync(Sign(HttpMethod.Get, UriOf(null, query), Unsigned), ct);
            if (!res.IsSuccessStatusCode) throw new IOException($"s3 LIST: {(int)res.StatusCode} {await res.Content.ReadAsStringAsync(ct)}");
            var doc = XDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            XNamespace ns = doc.Root!.Name.Namespace;
            foreach (var k in doc.Descendants(ns + "Key").Select(x => x.Value)) if (MediaStores.ValidKey(k)) yield return k;
            token = doc.Descendants(ns + "IsTruncated").FirstOrDefault()?.Value == "true" ? doc.Descendants(ns + "NextContinuationToken").FirstOrDefault()?.Value : null;
        } while (token is not null);
    }
}

/// <summary>Eine andere journali-Instanz als Ursprung (Taloan, 19.09.: zwei Rechner, ein Journal — die Bytes lagen nur auf einem):
/// Lesen holt Fehlendes vom Ursprung und legt es lokal ab, Schreiben legt lokal ab und lädt zum Ursprung hoch (/api/media/blob/{key}).</summary>
public sealed class OriginMediaStore : IMediaStore
{
    private readonly IMediaStore _local; private readonly string _origin; private readonly string _actor; private readonly ILogger _log;
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromMinutes(10) };
    public OriginMediaStore(IMediaStore local, string origin, string actor, ILogger log) { _local = local; _origin = origin; _actor = actor; _log = log; }
    public string Kind => $"{_local.Kind} ← {_origin}";
    private string Url(string key) => $"{_origin}/api/media/blob/{key}";

    public async Task<(string Sha256, long Bytes)> PutAsync(Stream data, CancellationToken ct)
    {
        var r = await _local.PutAsync(data, ct);
        await PushAsync(r.Sha256, ct);
        return r;
    }
    public async Task PutAsync(string key, Stream data, CancellationToken ct) { await _local.PutAsync(key, data, ct); await PushAsync(key, ct); }

    private async Task PushAsync(string key, CancellationToken ct)
    {
        try
        {
            using var head = await _http.SendAsync(new HttpRequestMessage(HttpMethod.Head, Url(key)), ct);
            if (head.IsSuccessStatusCode) return;
            await using var s = await _local.OpenAsync(key, ct); if (s is null) return;
            var req = new HttpRequestMessage(HttpMethod.Put, Url(key)) { Content = new StreamContent(s) };
            req.Headers.Add("X-Actor", _actor);
            using var res = await _http.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode) _log.LogWarning("Medien-Ursprung {Origin}: {Key} nicht hochgeladen ({Status})", _origin, key, (int)res.StatusCode);
        }
        catch (Exception e) { _log.LogWarning("Medien-Ursprung {Origin} nicht erreichbar: {Error}", _origin, e.Message); }
    }

    public async Task<bool> ExistsAsync(string key, CancellationToken ct)
    {
        if (await _local.ExistsAsync(key, ct)) return true;
        if (!MediaStores.ValidKey(key)) return false;
        try { using var head = await _http.SendAsync(new HttpRequestMessage(HttpMethod.Head, Url(key)), ct); return head.IsSuccessStatusCode; } catch { return false; }
    }

    public async Task<Stream?> OpenAsync(string key, CancellationToken ct)
    {
        if (await _local.OpenAsync(key, ct) is { } have) return have;
        if (!MediaStores.ValidKey(key)) return null;
        try
        {
            using var res = await _http.GetAsync(Url(key), HttpCompletionOption.ResponseHeadersRead, ct);
            if (!res.IsSuccessStatusCode) return null;
            await _local.PutAsync(key, await res.Content.ReadAsStreamAsync(ct), ct);   // lokal ablegen — beim nächsten Mal ohne Umweg
            return await _local.OpenAsync(key, ct);
        }
        catch (Exception e) { _log.LogWarning("Medien-Ursprung {Origin} nicht erreichbar: {Error}", _origin, e.Message); return null; }
    }

    public IAsyncEnumerable<string> KeysAsync(CancellationToken ct) => _local.KeysAsync(ct);
}
