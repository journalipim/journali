using System.Security.Cryptography;

namespace Journali.Server;

/// <summary>
/// Wo die Bytes liegen (docs/pflegestruktur.md, 20): ausserhalb der Datenbank, adressiert über
/// den SHA-256 der Datei. Erst ein Verzeichnis; später S3/MinIO hinter derselben Schnittstelle.
/// Der Server berührt Bytes nur beim Hochladen und Ausliefern — im Journal steht nur der Hash.
/// </summary>
public interface IMediaStore
{
    /// <summary>Datei ablegen; liefert Hash und Grösse. Gleiche Bytes = gleicher Hash = dieselbe Datei.</summary>
    Task<(string Sha256, long Bytes)> PutAsync(Stream data, CancellationToken ct);
    bool Exists(string sha256);
    Stream? Open(string sha256);
}

/// <summary>Verzeichnis <c>JOURNALI_MEDIA</c> (Vorgabe <c>media/</c> neben dem Programm), Unterordner nach den ersten zwei Hexzeichen.</summary>
public sealed class FileMediaStore : IMediaStore
{
    private readonly string _root;

    public FileMediaStore(string root)
    {
        _root = Path.GetFullPath(root);
        Directory.CreateDirectory(_root);
    }

    public string Root => _root;

    private string PathOf(string sha256) => Path.Combine(_root, sha256[..2], sha256);

    public async Task<(string Sha256, long Bytes)> PutAsync(Stream data, CancellationToken ct)
    {
        // Erst in eine Temp-Datei, Hash unterwegs — dann an den Platz des Hashes (oder verwerfen, wenn er schon liegt).
        var tmp = Path.Combine(_root, "tmp-" + Guid.NewGuid().ToString("n"));
        long bytes;
        string sha;
        await using (var file = File.Create(tmp))
        using (var hasher = IncrementalHash.CreateHash(HashAlgorithmName.SHA256))
        {
            var buffer = new byte[81920];
            int n;
            bytes = 0;
            while ((n = await data.ReadAsync(buffer, ct)) > 0)
            {
                await file.WriteAsync(buffer.AsMemory(0, n), ct);
                hasher.AppendData(buffer, 0, n);
                bytes += n;
            }
            sha = Convert.ToHexString(hasher.GetHashAndReset()).ToLowerInvariant();
        }
        var target = PathOf(sha);
        if (File.Exists(target)) File.Delete(tmp);
        else
        {
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            File.Move(tmp, target);
        }
        return (sha, bytes);
    }

    public bool Exists(string sha256) => sha256.Length == 64 && File.Exists(PathOf(sha256));

    public Stream? Open(string sha256) => Exists(sha256) ? File.OpenRead(PathOf(sha256)) : null;
}
