using System.Security.Cryptography;
using Npgsql;
using NpgsqlTypes;

namespace Journali.Server;

/// <summary>
/// Die Kennung dieser Anlage (Taloan, 23.09.2026: „d. h. ein Server muss irgendwie fälschungssicher eine eigene GUID
/// haben“). Sie entsteht beim ersten Start, steht in der Datenbank und geht <b>nicht</b> in die Sicherung — eine
/// wiederhergestellte Anlage bekommt darum eine neue. Das löst den Fall, den Taloan beschrieben hat: „ich mache eine
/// Sicherung, mache drei neue isolierte Instanzen und restore dreimal — dann habe ich aus einer Lizenz vier gemacht.“
/// Mit eigener Kennung je Anlage gilt eine Lizenz nur dort, wofür sie ausgestellt wurde.
/// <para><b>Was fälschungssicher hier heisst.</b> Wer die Datenbank besitzt, kann die Kennung ändern — dagegen hilft
/// nichts, was im selben Container liegt. Sie ist kein Schloss, sondern ein Name: sie macht Vervielfältigung zu einer
/// bewussten Handlung statt zu einem Nebeneffekt der Wiederherstellung, und sie gibt beiden Seiten etwas, worüber sie
/// reden können — beim Ausstellen der Lizenz, beim Support, bei einer späteren Aktivierung
/// (Taloan: der Onlineweg ist erst zumutbar, „bis er kommerziell wird, indem er die 20k/100k erweitern will“).</para>
/// </summary>
public sealed class Instanz(NpgsqlDataSource? db)
{
    private string? _id;

    /// <summary>Die Kennung — beim ersten Aufruf gelesen oder erzeugt. Ohne Datenbank eine flüchtige (Tests, Sandbox).</summary>
    public string Id => _id ??= Lies();

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
