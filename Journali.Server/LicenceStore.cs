using System.Security.Cryptography;
using System.Text;
using Npgsql;
using NpgsqlTypes;

namespace Journali.Server;

/// <summary>
/// Die Lizenz in der Datenbank statt als Datei daneben (Taloan, 23.09.2026: „jegliche eingespielte Lizenz kommt signiert
/// und verschlüsselt in einen Container — die DB“). Anlass war ihr Verschwinden: fehlt die Datei, gilt still der
/// Testbetrieb, und der Zählbeginn aus der Lizenz ist weg — der Zähler springt zurück auf „alles seit jeher“.
/// <para>In der Datenbank fährt sie überall mit: im <c>pg_dump</c>, im Journal-Snapshot des Betriebs, und in unserer
/// Vollsicherung. Eine Datei im Datenverzeichnis wird beim ersten Start noch gelesen und übernommen.</para>
/// <para><b>Was das schützt und was nicht.</b> Die <em>Signatur</em> schützt den Inhalt: Grenzen und Zählbeginn stehen
/// im signierten Rumpf, wer sie ändert, macht die Lizenz ungültig (sofern <c>JOURNALI_LICENCE_KEY</c> gesetzt ist).
/// Die <em>Verschlüsselung</em> schützt nicht gegen jemanden mit Zugriff auf Datenbank und Image — der Schlüssel liegt
/// im Programm. Sie verhindert, dass in der Datenbank im Klartext steht, wer welche Grenzen hat, und dass man die
/// Lizenz mit einem Texteditor umschreibt. Wer den Container besitzt, kann mehr; dagegen hilft der Vertrag.</para>
/// </summary>
public sealed class LicenceStore(NpgsqlDataSource? db)
{
    public bool Ready => db is not null;

    /// <summary>Schlüssel der Verschlüsselung — aus dem Programm abgeleitet, damit in der Datenbank nichts im Klartext steht.</summary>
    private static readonly byte[] Key = SHA256.HashData(Encoding.UTF8.GetBytes("journali-licence-v1"));

    private void Sicherstellen(NpgsqlConnection conn)
    {
        using var cmd = new NpgsqlCommand("""
            CREATE TABLE IF NOT EXISTS licence (
                id   INT         PRIMARY KEY CHECK (id = 1),
                data BYTEA       NOT NULL,
                at   TIMESTAMPTZ NOT NULL DEFAULT now(),
                who  TEXT
            );
            """, conn);
        cmd.ExecuteNonQuery();
    }

    /// <summary>Die gespeicherte Lizenz als JSON — null, wenn keine da ist oder sie nicht lesbar ist.</summary>
    public string? Lies()
    {
        if (db is null) return null;
        try
        {
            using var conn = db.OpenConnection();
            Sicherstellen(conn);
            using var cmd = new NpgsqlCommand("SELECT data FROM licence WHERE id = 1", conn);
            return cmd.ExecuteScalar() is byte[] roh ? Entschluesseln(roh) : null;
        }
        catch { return null; }
    }

    /// <summary>Lizenz ablegen — verschlüsselt, mit Urheber und Zeitpunkt. Ersetzt, was da war.</summary>
    public void Schreib(string json, string actor)
    {
        if (db is null) return;
        using var conn = db.OpenConnection();
        Sicherstellen(conn);
        using var cmd = new NpgsqlCommand("""
            INSERT INTO licence (id, data, at, who) VALUES (1, @d, now(), @w)
            ON CONFLICT (id) DO UPDATE SET data = @d, at = now(), who = @w
            """, conn);
        cmd.Parameters.Add("d", NpgsqlDbType.Bytea).Value = Verschluesseln(json);
        cmd.Parameters.Add("w", NpgsqlDbType.Text).Value = actor;
        cmd.ExecuteNonQuery();
    }

    /// <summary>AES-GCM: Zufallszahl vorn, dann Geheimtext und Prüfsumme — eine Änderung am Datensatz fällt beim Lesen auf.</summary>
    private static byte[] Verschluesseln(string klar)
    {
        var nonce = RandomNumberGenerator.GetBytes(AesGcm.NonceByteSizes.MaxSize);
        var daten = Encoding.UTF8.GetBytes(klar);
        var geheim = new byte[daten.Length];
        var tag = new byte[AesGcm.TagByteSizes.MaxSize];
        using var aes = new AesGcm(Key, tag.Length);
        aes.Encrypt(nonce, daten, geheim, tag);
        return [.. nonce, .. tag, .. geheim];
    }

    private static string? Entschluesseln(byte[] roh)
    {
        var nl = AesGcm.NonceByteSizes.MaxSize;
        var tl = AesGcm.TagByteSizes.MaxSize;
        if (roh.Length < nl + tl) return null;
        var klar = new byte[roh.Length - nl - tl];
        using var aes = new AesGcm(Key, tl);
        aes.Decrypt(roh.AsSpan(0, nl), roh.AsSpan(nl + tl), roh.AsSpan(nl, tl), klar);
        return Encoding.UTF8.GetString(klar);
    }
}
