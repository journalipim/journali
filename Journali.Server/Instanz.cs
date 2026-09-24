using System.Security.Cryptography;
using Npgsql;
using NpgsqlTypes;

namespace Journali.Server;

/// <summary>
/// Die Kennung dieser Anlage. Sie entsteht beim ersten Start, steht in der Datenbank und geht <b>nicht</b> in die Sicherung — eine
/// wiederhergestellte Anlage bekommt darum eine neue. Das löst den Fall der Vervielfältigung
/// Mit eigener Kennung je Anlage gilt eine Lizenz nur dort, wofür sie ausgestellt wurde.
/// <para><b>Was fälschungssicher hier heisst.</b> Wer die Datenbank besitzt, kann die Kennung ändern — dagegen hilft
/// nichts, was im selben Container liegt. Sie ist kein Schloss, sondern ein Name: sie macht Vervielfältigung zu einer
/// bewussten Handlung statt zu einem Nebeneffekt der Wiederherstellung, und sie gibt beiden Seiten etwas, worüber sie
/// reden können — beim Ausstellen der Lizenz, beim Support, bei einer späteren Aktivierung
///.</para>
/// </summary>
public sealed class Instanz(NpgsqlDataSource? db)
{
    private string? _id;
    private ECDsa? _paar;

    /// <summary>Die Kennung — beim ersten Aufruf gelesen oder erzeugt. Ohne Datenbank eine flüchtige (Tests, Sandbox).</summary>
    public string Id => _id ??= Lies();

    /// <summary>
    /// Das Schlüsselpaar der Instanz (ECDSA P-256) — sie signiert damit ihre Anforderungen (<see cref="KeyRequests"/>).
    /// Es entsteht mit der Kennung, liegt verschlüsselt neben ihr und geht wie sie nicht in die Sicherung.
    /// </summary>
    private ECDsa Paar => _paar ??= LiesPaar();
    /// <summary>Der öffentliche Schlüssel (SubjectPublicKeyInfo, Base64) — steht in jeder Anforderung.</summary>
    public string PublicKey => Convert.ToBase64String(Paar.ExportSubjectPublicKeyInfo());
    /// <summary>Signatur über einen Text: SHA-256, r‖s.</summary>
    public byte[] Signiere(string text) => Paar.SignData(System.Text.Encoding.UTF8.GetBytes(text), HashAlgorithmName.SHA256);

    private ECDsa LiesPaar()
    {
        var neu = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        if (db is null) return neu;
        _ = Id;   // legt die Tabelle an
        try
        {
            using var conn = db.OpenConnection();
            using (var mk = new NpgsqlCommand("ALTER TABLE instanz ADD COLUMN IF NOT EXISTS paar BYTEA", conn)) mk.ExecuteNonQuery();
            // nur setzen, wenn noch keins da ist — zwei Server, die gleichzeitig starten, bekommen dasselbe
            using (var set = new NpgsqlCommand("UPDATE instanz SET paar = @p WHERE id = 1 AND paar IS NULL", conn))
            {
                set.Parameters.Add("p", NpgsqlDbType.Bytea).Value = LicenceStore.Verschluesseln(Convert.ToBase64String(neu.ExportPkcs8PrivateKey()));
                set.ExecuteNonQuery();
            }
            using var get = new NpgsqlCommand("SELECT paar FROM instanz WHERE id = 1", conn);
            if (get.ExecuteScalar() is byte[] roh && LicenceStore.Entschluesseln(roh) is { } b64)
            {
                var paar = ECDsa.Create();
                paar.ImportPkcs8PrivateKey(Convert.FromBase64String(b64), out _);
                neu.Dispose();
                return paar;
            }
        }
        catch { }
        return neu;
    }

    private string Lies()
    {
        if (db is null) return Guid.NewGuid().ToString();
        try
        {
            using var conn = db.OpenConnection();
            using (var mk = new NpgsqlCommand("""
                CREATE TABLE IF NOT EXISTS instanz (
                    id    INT         PRIMARY KEY CHECK (id = 1),
                    guid  TEXT        NOT NULL,
                    seit  TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                """, conn))
                mk.ExecuteNonQuery();

            // Eine Zeile, oder sie entsteht jetzt — zwei Server, die gleichzeitig starten, bekommen dieselbe
            using var cmd = new NpgsqlCommand("""
                INSERT INTO instanz (id, guid) VALUES (1, @g)
                ON CONFLICT (id) DO UPDATE SET guid = instanz.guid
                RETURNING guid
                """, conn);
            cmd.Parameters.Add("g", NpgsqlDbType.Text).Value = Neu();
            return cmd.ExecuteScalar() as string ?? Neu();
        }
        catch { return Guid.NewGuid().ToString(); }
    }

    /// <summary>Eine neue Kennung: Zufall, keine Hardware — sie soll nichts über den Rechner verraten.</summary>
    private static string Neu() => Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant() is { } h
        ? $"{h[..8]}-{h[8..12]}-{h[12..16]}-{h[16..20]}-{h[20..]}"
        : Guid.NewGuid().ToString();
}
