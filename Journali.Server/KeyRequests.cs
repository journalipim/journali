using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Npgsql;
using NpgsqlTypes;

namespace Journali.Server;

/// <summary>
/// Eine Schlüssel-Anforderung dieser Instanz (Taloan, 23.09.2026: „die Lizenzanforderung muss vom Server signiert sein,
/// daraufhin wird sie von der Shopseite genehmigt — zurücksigniert — und nur dann vom Aussteller akzeptiert. PGP quasi“).
/// <para>Der Weg eines Schlüssels:</para>
/// <list type="number">
/// <item>Die Instanz schreibt die Anforderung (Art, Grenzen, Dauer) und signiert sie mit ihrem eigenen Schlüsselpaar.
/// Der öffentliche Schlüssel steht in der Anforderung — der Aussteller kann sie prüfen, ohne die Instanz zu kennen, und
/// merkt sich beim ersten Mal, zu welcher Kennung welcher öffentliche Schlüssel gehört.</item>
/// <item>Der Shop gibt sie frei: er signiert den Fingerabdruck (<see cref="SignedRequest.Hash"/>) mit seinem Schlüssel.</item>
/// <item>Der Aussteller prüft beide Signaturen und stellt den Schlüssel aus: mit derselben Id und dem Fingerabdruck
/// der Anforderung (<see cref="LicenceKey.Request"/>), signiert mit dem Lizenzschlüssel.</item>
/// <item>Die Instanz löst nur Schlüssel ein, zu denen sie selbst eine Anforderung hat.</item>
/// </list>
/// <para>Die Anforderung reist wie eine PGP-Klartextsignatur: der Rumpf als Text, daneben die Signatur. Geprüft wird
/// der Text, so wie er dasteht — keine Seite muss JSON gleich schreiben wie die andere.</para>
/// <para>Signatur: ECDSA P-256 über SHA-256, im Format r‖s (IEEE P1363, 64 Byte), Base64.</para>
/// </summary>
public sealed record KeyRequest(
    string? Id = null,
    string? Kind = null,
    string? Instance = null,
    string? Pub = null,
    string? Plan = null,
    int EntriesWeek = 0,
    int EntriesMonth = 0,
    int Days = 0,
    DateTimeOffset? Created = null)
{
    internal static readonly JsonSerializerOptions Json = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
}

/// <summary>Anforderung und Signatur, so wie sie an den Shop geht.</summary>
public sealed record SignedRequest(string Anforderung, string Sig)
{
    /// <summary>Fingerabdruck: SHA-256 über den Rumpf, hex. Den signiert der Shop, den trägt der Schlüssel.</summary>
    [JsonIgnore] public string Hash => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Anforderung))).ToLowerInvariant();
    [JsonIgnore] public KeyRequest? Inhalt { get { try { return JsonSerializer.Deserialize<KeyRequest>(Anforderung, KeyRequest.Json); } catch { return null; } } }
    /// <summary>Anforderung und Signatur als ein Text — das, was kopiert und an den Shop geschickt wird.</summary>
    [JsonIgnore] public string Text => JsonSerializer.Serialize(this, KeyRequest.Json);

    /// <summary>Passt die Signatur zum öffentlichen Schlüssel, der in der Anforderung steht? Das prüft auch der Aussteller.</summary>
    public (bool Ok, string? Grund) Pruefe()
    {
        if (Inhalt is not { Pub: { Length: > 0 } pub }) return (false, "Anforderung ohne öffentlichen Schlüssel");
        try
        {
            using var ecdsa = ECDsa.Create();
            ecdsa.ImportSubjectPublicKeyInfo(Convert.FromBase64String(pub), out _);
            return ecdsa.VerifyData(Encoding.UTF8.GetBytes(Anforderung), Convert.FromBase64String(Sig), HashAlgorithmName.SHA256)
                ? (true, null) : (false, "Signatur der Anforderung passt nicht");
        }
        catch (Exception e) { return (false, "Anforderung nicht prüfbar: " + e.Message); }
    }
}

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
}
