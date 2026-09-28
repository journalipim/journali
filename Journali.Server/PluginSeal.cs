using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Journali.Server;

/// <summary>
/// Das Siegel eines Plugins: <c>certificate.json</c> im Plugin-Verzeichnis, signiert vom Herausgeber (ECDSA P-256,
/// SHA-256, Signatur IEEE P1363 in Base64). Es nennt Schlüssel, Fassung und den Hash über alle Dateien des Verzeichnisses
/// (ausser node_modules, __pycache__, .git, .cache, certificate.json und den Pfaden unter <c>ignore</c>). Passt eine Datei nicht
/// mehr, ist das Siegel gebrochen — das Plugin bleibt nutzbar, trägt aber kein Siegel.
/// <para>Geprüft wird mit dem eingebauten öffentlichen Schlüssel oder mit <c>JOURNALI_PLUGIN_KEY</c>; das Werkzeug
/// dazu ist <c>tools/plugin-cert.mjs</c>, das denselben Hash rechnet.</para>
/// </summary>
public static class PluginSeal
{
    public const string FileName = "certificate.json";
    /// <summary>Der öffentliche Schlüssel des Herausgebers (Base64, SubjectPublicKeyInfo).</summary>
    public const string DefaultKey = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEDC5LFAXKOGYMNw18LjmJIOP3IfH3SWtP5rGzzBSF1HtyTzbrkqReAfYUkXbnDutAdl8H57eT8Fa/yB1pfQdBVQ==";
    // .cache: was ein Plugin zur Laufzeit holt (embed sein Modell) — sonst bricht es sein eigenes Siegel, sobald
    // es einmal gearbeitet hat (28.09.2026)
    private static readonly HashSet<string> SkipDirs = new(StringComparer.Ordinal) { "node_modules", "__pycache__", ".git", ".cache" };

    public sealed record Certificate(string Key, string Version, string Hash, string Issued, string Issuer, string[]? Ignore = null, string? Sig = null)
    {
        /// <summary>Was signiert wird — zeilenweise, damit kein JSON kanonisiert werden muss.</summary>
        [JsonIgnore] public string Rumpf => string.Join("\n", Key, Version, Hash, Issued, Issuer, string.Join(",", Ignore ?? Array.Empty<string>()));
        internal static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };
    }

    /// <summary>Ergebnis der Prüfung: zertifiziert, oder warum nicht. Ohne Zertifikat: <c>Certified</c> falsch, <c>Grund</c> leer — das ist kein Fehler.</summary>
    public sealed record Seal(bool Certified, string? Issued = null, string? Issuer = null, string? Grund = null)
    {
        public static readonly Seal Keins = new(false);
    }

    /// <summary>Der öffentliche Schlüssel: Umgebung vor eingebautem.</summary>
    public static string PublicKey => Environment.GetEnvironmentVariable("JOURNALI_PLUGIN_KEY") is { Length: > 0 } k ? k : DefaultKey;

    /// <summary>Das Siegel eines Plugin-Verzeichnisses prüfen: Zertifikat lesen, Schlüssel und Fassung gegen das Manifest, Signatur, dann den Hash.</summary>
    public static Seal Check(string dir, string key, string version, string? pub = null)
    {
        var file = Path.Combine(dir, FileName);
        if (!File.Exists(file)) return Seal.Keins;
        Certificate? c;
        try { c = JsonSerializer.Deserialize<Certificate>(File.ReadAllText(file), Certificate.Json); }
        catch (Exception e) { return new Seal(false, Grund: "Zertifikat nicht lesbar: " + e.Message); }
        if (c is null) return new Seal(false, Grund: "Zertifikat leer");
        if (c.Key != key) return new Seal(false, c.Issued, c.Issuer, $"Zertifikat für {c.Key}");
        if (c.Version != version) return new Seal(false, c.Issued, c.Issuer, $"Zertifikat für Fassung {c.Version}, Manifest {version}");
        var (ok, grund) = Verify(c.Rumpf, c.Sig, pub ?? PublicKey);
        if (!ok) return new Seal(false, c.Issued, c.Issuer, grund);
        if (!string.Equals(Hash(dir, c.Ignore), c.Hash, StringComparison.OrdinalIgnoreCase)) return new Seal(false, c.Issued, c.Issuer, "Dateien verändert");
        return new Seal(true, c.Issued, c.Issuer);
    }

    /// <summary>Der Hash über die Dateien — je Datei <c>pfad\0sha256hex\n</c> in einen SHA-256, Pfade mit / und ordinal sortiert.</summary>
    public static string Hash(string dir, string[]? ignore = null)
    {
        using var sha = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        foreach (var rel in Files(dir, ignore ?? Array.Empty<string>()))
        {
            var fh = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(Path.Combine(dir, rel)))).ToLowerInvariant();
            sha.AppendData(Encoding.UTF8.GetBytes(rel + "\0" + fh + "\n"));
        }
        return Convert.ToHexString(sha.GetHashAndReset()).ToLowerInvariant();
    }

    public static List<string> Files(string dir, string[] ignore)
    {
        var list = new List<string>();
        void Walk(string d)
        {
            foreach (var p in Directory.EnumerateFileSystemEntries(d))
            {
                var rel = Path.GetRelativePath(dir, p).Replace('\\', '/');
                if (Directory.Exists(p)) { if (!SkipDirs.Contains(Path.GetFileName(p)) && !Ignored(rel, ignore)) Walk(p); continue; }
                if (rel == FileName || Ignored(rel, ignore)) continue;
                list.Add(rel);
            }
        }
        Walk(dir);
        list.Sort(StringComparer.Ordinal);
        return list;
    }
    private static bool Ignored(string rel, string[] ignore) => ignore.Any(i => rel == i || rel.StartsWith(i.TrimEnd('/') + "/", StringComparison.Ordinal));

    /// <summary>Signatur prüfen — wie bei der Lizenz, mit dem übergebenen Schlüssel.</summary>
    public static (bool Ok, string? Grund) Verify(string rumpf, string? sig, string pub)
    {
        if (string.IsNullOrWhiteSpace(sig)) return (false, "keine Signatur");
        try
        {
            using var ecdsa = ECDsa.Create();
            ecdsa.ImportSubjectPublicKeyInfo(Convert.FromBase64String(pub), out _);
            return ecdsa.VerifyData(Encoding.UTF8.GetBytes(rumpf), Convert.FromBase64String(sig), HashAlgorithmName.SHA256) ? (true, null) : (false, "Signatur passt nicht");
        }
        catch (Exception e) { return (false, "Signatur nicht prüfbar: " + e.Message); }
    }

    /// <summary>Für Tests und das Werkzeug: ein Zertifikat mit einem privaten Schlüssel ausstellen und schreiben.</summary>
    public static Certificate Sign(string dir, string key, string version, ECDsa priv, string[]? ignore = null, string issuer = "journali")
    {
        var c = new Certificate(key, version, Hash(dir, ignore), DateOnly.FromDateTime(DateTime.Today).ToString("yyyy-MM-dd"), issuer, ignore);
        c = c with { Sig = Convert.ToBase64String(priv.SignData(Encoding.UTF8.GetBytes(c.Rumpf), HashAlgorithmName.SHA256)) };
        File.WriteAllText(Path.Combine(dir, FileName), JsonSerializer.Serialize(c, Certificate.Json));
        return c;
    }
}
