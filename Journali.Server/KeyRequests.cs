using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Npgsql;
using NpgsqlTypes;

using Journali.Core.Licensing;

namespace Journali.Server;

/// <summary>
/// Die Anforderungen dieser Instanz. Sie liegen in der Datenbank (Tabelle <c>anforderung</c>) und gehen wie Lizenz und
/// Kennung <b>nicht</b> in die Sicherung: eine wiederhergestellte Instanz hat eine neue Kennung, und was die alte
/// angefordert hat, gilt dort nicht. Ob eine Anforderung eingelöst ist, sagt das Journal (<c>KeyRedeemed</c>).
/// </summary>
public sealed class KeyRequests(NpgsqlDataSource? db, Instanz instanz)
{
    public sealed record Zeile(SignedRequest Signiert, DateTimeOffset At, string Who);
    private readonly List<Zeile> _ohneDb = new();   // Tests, Sandbox

    private static void Sicherstellen(NpgsqlConnection conn)
    {
        using var cmd = new NpgsqlCommand("""
            CREATE TABLE IF NOT EXISTS anforderung (
                id          TEXT        PRIMARY KEY,
                anforderung TEXT        NOT NULL,
                sig         TEXT        NOT NULL,
                at          TIMESTAMPTZ NOT NULL DEFAULT now(),
                who         TEXT
            );
            """, conn);
        cmd.ExecuteNonQuery();
    }

    /// <summary>Eine Anforderung schreiben, signieren, ablegen.</summary>
    public SignedRequest Neu(string kind, int week, int month, int days, string actor, string? plan = null)
    {
        var id = "k-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant();
        var r = new KeyRequest(id, kind, instanz.Id, instanz.PublicKey, plan, week, month, days, DateTimeOffset.UtcNow);
        var rumpf = JsonSerializer.Serialize(r, KeyRequest.Json);
        var s = new SignedRequest(rumpf, Convert.ToBase64String(instanz.Signiere(rumpf)));
        if (db is null) { lock (_ohneDb) _ohneDb.Add(new Zeile(s, DateTimeOffset.UtcNow, actor)); return s; }
        using var conn = db.OpenConnection();
        Sicherstellen(conn);
        using var cmd = new NpgsqlCommand("INSERT INTO anforderung (id, anforderung, sig, who) VALUES (@i, @a, @s, @w)", conn);
        cmd.Parameters.Add("i", NpgsqlDbType.Text).Value = id;
        cmd.Parameters.Add("a", NpgsqlDbType.Text).Value = s.Anforderung;
        cmd.Parameters.Add("s", NpgsqlDbType.Text).Value = s.Sig;
        cmd.Parameters.Add("w", NpgsqlDbType.Text).Value = actor;
        cmd.ExecuteNonQuery();
        return s;
    }

    /// <summary>Alle Anforderungen, neueste zuerst.</summary>
    public IReadOnlyList<Zeile> Alle()
    {
        if (db is null) { lock (_ohneDb) return _ohneDb.OrderByDescending(z => z.At).ToList(); }
        using var conn = db.OpenConnection();
        Sicherstellen(conn);
        using var cmd = new NpgsqlCommand("SELECT anforderung, sig, at, coalesce(who, '') FROM anforderung ORDER BY at DESC", conn);
        using var rd = cmd.ExecuteReader();
        var alle = new List<Zeile>();
        while (rd.Read()) alle.Add(new Zeile(new SignedRequest(rd.GetString(0), rd.GetString(1)), rd.GetFieldValue<DateTimeOffset>(2), rd.GetString(3)));
        return alle;
    }

    public SignedRequest? Get(string? id) => id is { Length: > 0 } ? Alle().FirstOrDefault(z => z.Signiert.Inhalt?.Id == id)?.Signiert : null;

    /// <summary>Eine Anforderung wegwerfen — nur eine offene; ob sie eingelöst ist, sagt das Journal und prüft der Aufrufer.
    /// Liefert, ob es sie gab. Ein Schlüssel zu einer weggeworfenen Anforderung lässt sich nicht mehr einlösen.</summary>
    public bool Loesche(string id)
    {
        if (db is null) { lock (_ohneDb) return _ohneDb.RemoveAll(z => z.Signiert.Inhalt?.Id == id) > 0; }
        using var conn = db.OpenConnection();
        Sicherstellen(conn);
        using var cmd = new NpgsqlCommand("DELETE FROM anforderung WHERE id = @i", conn);
        cmd.Parameters.Add("i", NpgsqlDbType.Text).Value = id;
        return cmd.ExecuteNonQuery() > 0;
    }
}
