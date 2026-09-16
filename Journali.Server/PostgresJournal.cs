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
    private const string Columns = "number, at, actor, stream, type, payload::text";

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

    public Entry Append(string actor, string stream, string type, string payload)
    {
        using var conn = _db.OpenConnection();
        using var tx = conn.BeginTransaction();

        // SHARE ROW EXCLUSIVE: andere Schreiber warten, Leser nicht.
        using (var gate = new NpgsqlCommand("LOCK TABLE journal IN SHARE ROW EXCLUSIVE MODE", conn, tx))
            gate.ExecuteNonQuery();

        // JSONB normalisiert (Reihenfolge, Leerraum); zurück kommt die gespeicherte Form,
        // damit Append und ReadAfter denselben Text liefern.
        using var cmd = new NpgsqlCommand($"""
            INSERT INTO journal (number, at, actor, stream, type, payload)
            SELECT COALESCE(MAX(number), 0) + 1, now(), @actor, @stream, @type, @payload
            FROM journal
            RETURNING {Columns}
            """, conn, tx);
        cmd.Parameters.AddWithValue("actor", actor);
        cmd.Parameters.AddWithValue("stream", stream);
        cmd.Parameters.AddWithValue("type", type);
        cmd.Parameters.Add("payload", NpgsqlDbType.Jsonb).Value = payload;

        Entry entry;
        using (var reader = cmd.ExecuteReader())
        {
            reader.Read();
            entry = Read(reader);
        }
        tx.Commit();
        return entry;
    }

    public IEnumerable<Entry> ReadAfter(long afterNumber) =>
        Query($"SELECT {Columns} FROM journal WHERE number > @n ORDER BY number",
              new NpgsqlParameter("n", afterNumber));

    public IEnumerable<Entry> ReadStream(string stream) =>
        Query($"SELECT {Columns} FROM journal WHERE stream = @s ORDER BY number",
              new NpgsqlParameter("s", stream));

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
        r.GetString(5));
}
