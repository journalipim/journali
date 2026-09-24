using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Npgsql;
using NpgsqlTypes;

namespace Journali.Server;

/// <summary>
/// Der Tresor: was geheim ist und zur Instanz gehört — Anmeldedaten (Passwort-Hashes, API-Token, Sitzungen), der
/// Mailserver mit Passwort, die Geheimnisse der Jobs und Teams. Nie im Journal. Mit Datenbank liegt er in der Tabelle
/// <c>tresor</c>, verschlüsselt; jeder Server auf derselben Datenbank sieht dasselbe, und er fährt in jedem Datenbank-Abzug
/// mit. Ohne Datenbank (Tests, Werkzeuge) liegt jedes Stück als Datei im Datenverzeichnis wie früher.
/// <para>Jedes Stück ist ein JSON-Text unter einem Namen; wer es liest und schreibt, bestimmt sein Format selbst.
/// <see cref="ITresorAblage.Aendere"/> ist atomar — zwei Server, die gleichzeitig eine Sitzung anlegen, verlieren keine.</para>
/// </summary>
public interface ITresorAblage
{
    string? Lies(string name);
    /// <summary>Lesen, ändern, schreiben in einem Zug; <c>null</c> als Ergebnis entfernt das Stück.</summary>
    void Aendere(string name, Func<string?, string?> f);
}

public static class Tresor
{
    public const string Auth = "auth", Mail = "mail", Secrets = "secrets";
    /// <summary>Die Dateinamen von früher — für den Dateibetrieb, die Übernahme und die Sicherung.</summary>
    public static readonly IReadOnlyDictionary<string, string> Dateien = new Dictionary<string, string>
    {
        [Auth] = "auth.json", [Mail] = "mail.json", [Secrets] = "secrets.json",
    };

    private static ITresorAblage? _ablage;
    /// <summary>Ab jetzt die Datenbank — einmal beim Start, sobald die Verbindung steht.</summary>
    public static void Nutze(ITresorAblage? ablage) => _ablage = ablage;
    public static ITresorAblage Fuer(string dir) => _ablage ?? new DateiTresor(dir);
    public static string PfadIn(string dir, string name) => Path.Combine(dir, Dateien[name]);
    /// <summary>Name eines Stücks zu einem Dateinamen — null, wenn die Datei nicht in den Tresor gehört (media.json).</summary>
    public static string? NameVon(string datei) => Dateien.FirstOrDefault(kv => kv.Value == datei).Key;

    /// <summary>
    /// Dateien von früher in den Tresor. Steht dort schon etwas, wird ergänzt, was fehlt — Anwender, Token, Sitzungen und
    /// Geheimnisse, die nur dieser Server kannte; bei Gleichem gilt der Tresor. Den Mailserver gibt es nur einmal: er wird
    /// nur übernommen, wenn der Tresor keinen hat. Die Datei bleibt als <c>.uebernommen</c> liegen.
    /// </summary>
    public static List<string> Uebernehmen(string dir, ITresorAblage ziel)
    {
        var fertig = new List<string>();
        foreach (var (name, datei) in Dateien)
        {
            var p = Path.Combine(dir, datei);
            if (!File.Exists(p)) continue;
            var inhalt = File.ReadAllText(p);
            var genommen = false;
            ziel.Aendere(name, alt =>
            {
                if (alt is null) { genommen = true; return inhalt; }
                if (name == Mail) return alt;
                var (neu, mehr) = Ergaenze(alt, inhalt);
                genommen = mehr;
                return neu;
            });
            File.Move(p, p + ".uebernommen", overwrite: true);
            if (genommen) fertig.Add(datei);
        }
        return fertig;
    }

    /// <summary>Zwei Ebenen: was im Tresor fehlt, kommt aus der Datei; was da ist, bleibt.</summary>
    internal static (string Json, bool Mehr) Ergaenze(string tresor, string datei)
    {
        JsonObject? t, d;
        try { t = JsonNode.Parse(tresor) as JsonObject; d = JsonNode.Parse(datei) as JsonObject; }
        catch { return (tresor, false); }
        if (t is null || d is null) return (tresor, false);
        var mehr = false;
        foreach (var (k, v) in d.ToList())
        {
            if (v is null) continue;
            if (!t.ContainsKey(k)) { t[k] = v.DeepClone(); mehr = true; continue; }
            if (t[k] is JsonObject tk && v is JsonObject dk)
                foreach (var (k2, v2) in dk.ToList())
                    if (!tk.ContainsKey(k2)) { tk[k2] = v2?.DeepClone(); mehr = true; }
        }
        return (t.ToJsonString(new System.Text.Json.JsonSerializerOptions { WriteIndented = true }), mehr);
    }
}

/// <summary>Tresor als Dateien im Datenverzeichnis — der Betrieb ohne Datenbank.</summary>
public sealed class DateiTresor(string dir) : ITresorAblage
{
    private static readonly object Gate = new();
    public string? Lies(string name) { var p = Tresor.PfadIn(dir, name); lock (Gate) return File.Exists(p) ? File.ReadAllText(p) : null; }
    public void Aendere(string name, Func<string?, string?> f)
    {
        lock (Gate)
        {
            var p = Tresor.PfadIn(dir, name);
            var neu = f(File.Exists(p) ? File.ReadAllText(p) : null);
            if (neu is null) { if (File.Exists(p)) File.Delete(p); return; }
            Directory.CreateDirectory(dir);
            File.WriteAllText(p, neu);
        }
    }
}

/// <summary>Tresor in der Datenbank: Tabelle <c>tresor</c>, je Stück eine Zeile, AES-GCM verschlüsselt.</summary>
public sealed class PostgresTresor(NpgsqlDataSource db) : ITresorAblage
{
    private const string Zweck = "tresor";
    private volatile bool _bereit;

    private void Sicherstellen(NpgsqlConnection conn)
    {
        if (_bereit) return;
        using var cmd = new NpgsqlCommand("""
            CREATE TABLE IF NOT EXISTS tresor (
                name TEXT        PRIMARY KEY,
                data BYTEA       NOT NULL,
                at   TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            """, conn);
        cmd.ExecuteNonQuery();
        _bereit = true;
    }

    /// <summary>Lesen. Ein Fehler der Datenbank geht nach aussen — ein leerer Tresor sähe aus wie „kein Passwort“.</summary>
    public string? Lies(string name)
    {
        using var conn = db.OpenConnection();
        Sicherstellen(conn);
        using var cmd = new NpgsqlCommand("SELECT data FROM tresor WHERE name = @n", conn);
        cmd.Parameters.Add("n", NpgsqlDbType.Text).Value = name;
        return cmd.ExecuteScalar() is byte[] { Length: > 0 } roh ? Verschluesselung.Von(roh, Zweck) : null;
    }

    public void Aendere(string name, Func<string?, string?> f)
    {
        using var conn = db.OpenConnection();
        Sicherstellen(conn);
        using var tx = conn.BeginTransaction();
        // Die Zeile gibt es danach sicher — so sperrt FOR UPDATE auch beim allerersten Schreiben
        using (var ins = new NpgsqlCommand("INSERT INTO tresor (name, data) VALUES (@n, ''::bytea) ON CONFLICT (name) DO NOTHING", conn, tx))
        { ins.Parameters.Add("n", NpgsqlDbType.Text).Value = name; ins.ExecuteNonQuery(); }
        string? alt;
        using (var sel = new NpgsqlCommand("SELECT data FROM tresor WHERE name = @n FOR UPDATE", conn, tx))
        {
            sel.Parameters.Add("n", NpgsqlDbType.Text).Value = name;
            alt = sel.ExecuteScalar() is byte[] { Length: > 0 } roh ? Verschluesselung.Von(roh, Zweck) : null;
        }
        var neu = f(alt);
        using (var w = neu is null
            ? new NpgsqlCommand("DELETE FROM tresor WHERE name = @n", conn, tx)
            : new NpgsqlCommand("UPDATE tresor SET data = @d, at = now() WHERE name = @n", conn, tx))
        {
            w.Parameters.Add("n", NpgsqlDbType.Text).Value = name;
            if (neu is not null) w.Parameters.Add("d", NpgsqlDbType.Bytea).Value = Verschluesselung.Zu(neu, Zweck);
            w.ExecuteNonQuery();
        }
        tx.Commit();
    }
}

/// <summary>
/// AES-GCM mit einem Schlüssel aus dem Programm — wie bei der Lizenz: schützt nicht gegen jemanden, der Datenbank und
/// Programm besitzt, aber es steht nichts im Klartext, und eine Änderung am Datensatz fällt beim Lesen auf.
/// </summary>
public static class Verschluesselung
{
    private static byte[] Key(string zweck) => SHA256.HashData(Encoding.UTF8.GetBytes($"journali-{zweck}-v1"));

    public static byte[] Zu(string klar, string zweck)
    {
        var nonce = RandomNumberGenerator.GetBytes(AesGcm.NonceByteSizes.MaxSize);
        var daten = Encoding.UTF8.GetBytes(klar);
        var geheim = new byte[daten.Length];
        var tag = new byte[AesGcm.TagByteSizes.MaxSize];
        using var aes = new AesGcm(Key(zweck), tag.Length);
        aes.Encrypt(nonce, daten, geheim, tag);
        return [.. nonce, .. tag, .. geheim];
    }

    /// <summary>Entschlüsseln — eine veränderte oder fremde Zeile wirft, statt still leer zu sein.</summary>
    public static string Von(byte[] roh, string zweck)
    {
        var nl = AesGcm.NonceByteSizes.MaxSize; var tl = AesGcm.TagByteSizes.MaxSize;
        if (roh.Length < nl + tl) throw new CryptographicException("zu kurz");
        var klar = new byte[roh.Length - nl - tl];
        using var aes = new AesGcm(Key(zweck), tl);
        aes.Decrypt(roh.AsSpan(0, nl), roh.AsSpan(nl + tl), roh.AsSpan(nl, tl), klar);
        return Encoding.UTF8.GetString(klar);
    }
}
