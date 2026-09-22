using Journali.Core.Entries;
using Journali.Core.Journal;
using Npgsql;
using NpgsqlTypes;

namespace Journali.Server;

/// <summary>
/// Dauerhaftes Journal in PostgreSQL: eine append-only Tabelle <c>journal</c>.
/// Die Nummer kommt nicht aus einer Sequenz — die lässt bei abgebrochenen
/// Transaktionen Lücken —, sondern ist MAX+1 unter einer Tabellensperre.
/// Abnehmer verlassen sich auf „lückenlos ab 1" (docs/architektur.md).
/// </summary>
public sealed class PostgresJournal : IJournal
{
    private const string Columns = "number, at, actor, stream, type, payload::text, batch, kind";

    private readonly NpgsqlDataSource _db;

    public PostgresJournal(NpgsqlDataSource db) => _db = db;

    /// <summary>
    /// Legt die Datenbank aus der Verbindungszeichenfolge an, falls sie fehlt.
    /// Dafür wird kurz die Wartungsdatenbank <c>postgres</c> benutzt.
    /// </summary>
    public static void EnsureDatabase(string connectionString)
    {
        var target = new NpgsqlConnectionStringBuilder(connectionString);
        var name = target.Database ?? throw new InvalidOperationException("Verbindungszeichenfolge ohne Database.");
        var maintenance = new NpgsqlConnectionStringBuilder(connectionString) { Database = "postgres" };

        using var conn = new NpgsqlConnection(maintenance.ConnectionString);
        conn.Open();
        using var exists = new NpgsqlCommand("SELECT 1 FROM pg_database WHERE datname = @n", conn);
        exists.Parameters.AddWithValue("n", name);
        if (exists.ExecuteScalar() is not null) return;

        // Datenbankname lässt sich nicht parametrisieren; Anführungszeichen verdoppeln reicht.
        using var create = new NpgsqlCommand($"CREATE DATABASE \"{name.Replace("\"", "\"\"")}\"", conn);
        create.ExecuteNonQuery();
    }

    /// <summary>Legt die Tabelle an, falls sie fehlt. Einmal beim Start.</summary>
    public void EnsureSchema()
    {
        using var conn = _db.OpenConnection();
        using var cmd = new NpgsqlCommand("""
            CREATE TABLE IF NOT EXISTS journal (
                number  BIGINT      PRIMARY KEY,
                at      TIMESTAMPTZ NOT NULL,
                actor   TEXT        NOT NULL,
                stream  TEXT        NOT NULL,
                type    TEXT        NOT NULL,
                payload JSONB       NOT NULL
            );
            CREATE INDEX IF NOT EXISTS journal_stream ON journal (stream, number);
            ALTER TABLE journal ADD COLUMN IF NOT EXISTS batch TEXT;
            -- Art der Arbeit (Taloan, 22.09.2026): model, structure, data, publish, reference, setup, ops.
            -- Alte Einträge bleiben leer; wer sie liest, leitet die Art aus dem Typ ab (Kinds.Of).
            ALTER TABLE journal ADD COLUMN IF NOT EXISTS kind TEXT;
            CREATE INDEX IF NOT EXISTS journal_kind_at ON journal (kind, at);
            """, conn);
        cmd.ExecuteNonQuery();
    }

    public long Head
    {
        get
        {
            using var conn = _db.OpenConnection();
            using var cmd = new NpgsqlCommand("SELECT COALESCE(MAX(number), 0) FROM journal", conn);
            return (long)cmd.ExecuteScalar()!;
        }
    }

    public Entry Append(string actor, string stream, string type, string payload, string? batch = null, string? kind = null)
    {
        using var conn = _db.OpenConnection();
        using var tx = conn.BeginTransaction();

        // SHARE ROW EXCLUSIVE: andere Schreiber warten, Leser nicht.
        using (var gate = new NpgsqlCommand("LOCK TABLE journal IN SHARE ROW EXCLUSIVE MODE", conn, tx))
            gate.ExecuteNonQuery();

        // JSONB normalisiert (Reihenfolge, Leerraum); zurück kommt die gespeicherte Form,
        // damit Append und ReadAfter denselben Text liefern.
        using var cmd = new NpgsqlCommand($"""
            INSERT INTO journal (number, at, actor, stream, type, payload, batch, kind)
            SELECT COALESCE(MAX(number), 0) + 1, now(), @actor, @stream, @type, @payload, @batch, @kind
            FROM journal
            RETURNING {Columns}
            """, conn, tx);
        cmd.Parameters.AddWithValue("actor", actor);
        cmd.Parameters.AddWithValue("stream", stream);
        cmd.Parameters.AddWithValue("type", type);
        cmd.Parameters.Add("payload", NpgsqlDbType.Jsonb).Value = payload;
        cmd.Parameters.Add("batch", NpgsqlDbType.Text).Value = (object?)batch ?? DBNull.Value;
        cmd.Parameters.Add("kind", NpgsqlDbType.Text).Value = kind ?? Kinds.Of(type);

        Entry entry;
        using (var reader = cmd.ExecuteReader())
        {
            reader.Read();
            entry = Read(reader);
        }
        tx.Commit();
        return entry;
    }

    /// <summary>Viele Einträge in einer Transaktion: eine Sperre, MAX(number) einmal, dann ein vorbereitetes INSERT je Eintrag — 5 000 Klassen in Sekunden statt Minuten.</summary>
    public IReadOnlyList<Entry> AppendMany(string actor, IReadOnlyList<(string Stream, string Type, string Payload)> items, string? batch = null)
    {
        var list = new List<Entry>(items.Count);
        if (items.Count == 0) return list;
        using var conn = _db.OpenConnection();
        using var tx = conn.BeginTransaction();
        using (var gate = new NpgsqlCommand("LOCK TABLE journal IN SHARE ROW EXCLUSIVE MODE", conn, tx)) gate.ExecuteNonQuery();
        long next;
        using (var max = new NpgsqlCommand("SELECT COALESCE(MAX(number), 0) FROM journal", conn, tx)) next = (long)max.ExecuteScalar()!;
        using var cmd = new NpgsqlCommand($"INSERT INTO journal (number, at, actor, stream, type, payload, batch, kind) VALUES (@n, now(), @actor, @stream, @type, @payload, @batch, @kind) RETURNING {Columns}", conn, tx);
        var pn = cmd.Parameters.Add("n", NpgsqlDbType.Bigint); cmd.Parameters.AddWithValue("actor", actor);
        var ps = cmd.Parameters.Add("stream", NpgsqlDbType.Text); var pt = cmd.Parameters.Add("type", NpgsqlDbType.Text); var pp = cmd.Parameters.Add("payload", NpgsqlDbType.Jsonb);
        var pk = cmd.Parameters.Add("kind", NpgsqlDbType.Text);
        cmd.Parameters.Add("batch", NpgsqlDbType.Text).Value = (object?)batch ?? DBNull.Value;
        cmd.Prepare();
        foreach (var (s, t, p) in items)
        {
            pn.Value = ++next; ps.Value = s; pt.Value = t; pp.Value = p; pk.Value = Kinds.Of(t);
            using var reader = cmd.ExecuteReader(); reader.Read(); list.Add(Read(reader));
        }
        tx.Commit();
        return list;
    }

    public IEnumerable<Entry> ReadAfter(long afterNumber) =>
        Query($"SELECT {Columns} FROM journal WHERE number > @n ORDER BY number",
              new NpgsqlParameter("n", afterNumber));

    public IEnumerable<Entry> ReadStream(string stream) =>
        Query($"SELECT {Columns} FROM journal WHERE stream = @s ORDER BY number",
              new NpgsqlParameter("s", stream));

    public IEnumerable<Entry> ReadRecent(string type, int limit) =>
        Query($"SELECT {Columns} FROM journal WHERE type = @t ORDER BY number DESC LIMIT {Math.Clamp(limit, 1, 100)}",
              new NpgsqlParameter("t", type));

    public IEnumerable<Entry> ReadBatch(string batch) =>
        Query($"SELECT {Columns} FROM journal WHERE batch = @b ORDER BY number",
              new NpgsqlParameter("b", batch));

    private IEnumerable<Entry> Query(string sql, NpgsqlParameter parameter)
    {
        using var conn = _db.OpenConnection();
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.Add(parameter);
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
            yield return Read(reader);
    }

    private static Entry Read(NpgsqlDataReader r) => new(
        r.GetInt64(0),
        r.GetFieldValue<DateTimeOffset>(1),
        r.GetString(2),
        r.GetString(3),
        r.GetString(4),
        r.GetString(5),
        r.IsDBNull(6) ? null : r.GetString(6),
        r.IsDBNull(7) ? null : r.GetString(7));
}
