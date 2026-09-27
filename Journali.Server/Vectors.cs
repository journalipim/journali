using System.Globalization;
using System.Text;
using Npgsql;
using NpgsqlTypes;

namespace Journali.Server;

/// <summary>
/// Die Vektoren (27.09.2026, pflegestruktur 35): je Abschnitt eines Dokuments und je Knoten eine Einbettung, in
/// Postgres mit der Erweiterung <c>vector</c> (pgvector). <b>Abgeleitet</b> wie der Text der Dokumente: aus dem Text
/// und dem Modell jederzeit neu zu rechnen, darum eigene Tabellen neben dem Journal, nichts davon wird ein Eintrag.
/// <para>Gerechnet wird nicht hier: ein Prozess-Plugin (<c>embed</c>) holt die offenen Posten, bettet mit einem
/// lokalen Modell ein und legt die Vektoren zurück. Die offene Postenliste ist eine Frage an die Tabellen — Abschnitte
/// ohne Vektor zu ihrem Hash und Modell, Knoten, deren Text sich geändert hat —, nie ein eigener Bestand.</para>
/// <para>Ohne die Erweiterung ist der Server nicht kaputt: <see cref="Ready"/> ist dann falsch, <see cref="Reason"/>
/// sagt warum, und die Wortsuche läuft weiter wie bisher.</para>
/// </summary>
public sealed class Vectors
{
    private readonly NpgsqlDataSource? _db;
    public bool Ready { get; }
    public string? Reason { get; }

    public Vectors(NpgsqlDataSource? db)
    {
        _db = db;
        if (_db is null) { Reason = "Ohne Postgres gibt es keine Vektoren."; return; }
        try
        {
            using var conn = _db.OpenConnection();
            using var cmd = new NpgsqlCommand("""
                CREATE EXTENSION IF NOT EXISTS vector;
                CREATE TABLE IF NOT EXISTS media_vector (
                    media     TEXT        NOT NULL,
                    sha256    TEXT        NOT NULL,
                    seq       INT         NOT NULL,
                    model     TEXT        NOT NULL,
                    embedding vector      NOT NULL,
                    at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                    PRIMARY KEY (media, seq)
                );
                CREATE TABLE IF NOT EXISTS node_vector (
                    node      TEXT        NOT NULL,
                    locale    TEXT        NOT NULL,
                    hash      TEXT        NOT NULL,
                    model     TEXT        NOT NULL,
                    embedding vector      NOT NULL,
                    at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                    PRIMARY KEY (node, locale)
                );
                """, conn);
            cmd.ExecuteNonQuery();
            Ready = true;
        }
        catch (Exception e) { Reason = "Erweiterung vector fehlt in dieser Datenbank: " + e.Message; }
    }

    /// <summary>Ein Abschnitt ohne Vektor: Medium, Hash, Reihenfolge, Überschrift, Text — was der Job einbettet.</summary>
    public sealed record Offen(string Media, string Sha256, int Seq, int? Page, string? Heading, string Body);
    /// <summary>Ein Treffer der Ähnlichkeitssuche über Abschnitte; <c>Distance</c> ist der Kosinusabstand (0 = gleich).</summary>
    public sealed record Treffer(string Media, string Sha256, int Seq, int? Page, string? Heading, string Body, double Distance);
    public sealed record KnotenTreffer(string Node, string Locale, double Distance);

    /// <summary>Die Schreibweise, die pgvector liest: <c>[0.1,0.2,…]</c>, Punkt als Dezimaltrenner.</summary>
    public static string Literal(IReadOnlyList<float> v)
    {
        var sb = new StringBuilder("[");
        for (var i = 0; i < v.Count; i++) { if (i > 0) sb.Append(','); sb.Append(v[i].ToString("R", CultureInfo.InvariantCulture)); }
        return sb.Append(']').ToString();
    }

    /// <summary>Die Umkehrung von <see cref="Literal"/>: <c>[0.1,0.2]</c> wird ein Vektor — für den eigenen Vektor eines Knotens.</summary>
    public static float[] ParseLiteral(string s) =>
        s.Trim().TrimStart('[').TrimEnd(']').Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => float.Parse(x, CultureInfo.InvariantCulture)).ToArray();

    // ---- Der Index (27.09.2026) -------------------------------------------------------------
    // HNSW braucht eine feste Dimension; die Spalte hat keine, weil das Modell wechseln darf. Darum je Modell und
    // Dimension ein Teilindex über den Ausdruck embedding::vector(N) mit WHERE model = '…'. Die Suche muss genau so
    // fragen — mit demselben Ausdruck und dem Modell als Wortlaut im SQL, nicht als Parameter: ein Teilindex gilt nur,
    // wenn der Planer die Bedingung beweisen kann, und einen Parameter kann er nicht beweisen. Ein Modellname ist ein
    // Bezeichner (Buchstaben, Ziffern, _ . / : -), sonst wird er abgewiesen — so kommt kein SQL in den Wortlaut.

    private readonly HashSet<(string Table, string Model, int Dims)> _indexed = new();
    /// <summary>Warum der letzte Index nicht entstand (Zeilen mit anderer Dimension unter demselben Modell) — null, wenn alles gut ging.</summary>
    public string? IndexError { get; private set; }

    /// <summary>Der Modellname als SQL-Wortlaut — nur Bezeichnerzeichen, sonst eine Ausnahme.</summary>
    public static string ModelLiteral(string model)
    {
        if (string.IsNullOrEmpty(model) || model.Length > 200 || !model.All(ch => char.IsAsciiLetterOrDigit(ch) || ch is '_' or '.' or '/' or ':' or '-'))
            throw new InvalidOperationException("Modellname ungültig.");
        return "'" + model + "'";
    }

    /// <summary>Ein gültiger, stabiler Indexname je Tabelle, Modell und Dimension.</summary>
    public static string IndexName(string table, string model, int dims)
    {
        var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(model)))[..8].ToLowerInvariant();
        return $"{table}_hnsw_{dims}_{hash}";
    }

    /// <summary>Den Teilindex anlegen, wenn er fehlt — einmal je Prozess und Kombination. Scheitert er (eine Zeile mit anderer
    /// Dimension unter demselben Modell), bleibt die Suche genau und langsam; der Grund steht in <see cref="IndexError"/>.</summary>
    private async Task EnsureIndexAsync(NpgsqlConnection conn, string table, string model, int dims, CancellationToken ct)
    {
        if (dims <= 0 || dims > 16000) return;
        lock (_indexed) if (!_indexed.Add((table, model, dims))) return;
        try
        {
            await using var cmd = new NpgsqlCommand($"CREATE INDEX IF NOT EXISTS {IndexName(table, model, dims)} ON {table} USING hnsw ((embedding::vector({dims})) vector_cosine_ops) WHERE model = {ModelLiteral(model)}", conn);
            cmd.CommandTimeout = 600;
            await cmd.ExecuteNonQueryAsync(ct);
            IndexError = null;
        }
        catch (Exception e)
        {
            lock (_indexed) _indexed.Remove((table, model, dims));
            IndexError = e.Message;
        }
    }

    /// <summary>Was ein Modell für ein Medium sinnvoll aufnimmt: Überschrift und Text, sonst nur der Text.</summary>
    public static string Passage(string? heading, string body) => string.IsNullOrWhiteSpace(heading) ? body : heading + "\n" + body;

    // ---- Abschnitte -------------------------------------------------------------------------

    /// <summary>Abschnitte, die zu diesem Modell noch keinen Vektor mit ihrem Hash haben — die offene Postenliste.</summary>
    public async Task<List<Offen>> PendingChunksAsync(string model, int limit, CancellationToken ct = default)
    {
        var list = new List<Offen>();
        if (!Ready) return list;
        await using var conn = await _db!.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT t.media, t.sha256, t.seq, t.page, t.heading, t.body
            FROM media_text t
            LEFT JOIN media_vector v ON v.media = t.media AND v.seq = t.seq AND v.sha256 = t.sha256 AND v.model = @model
            WHERE v.media IS NULL
            ORDER BY t.media, t.seq
            LIMIT @n
            """, conn);
        cmd.Parameters.AddWithValue("model", model);
        cmd.Parameters.AddWithValue("n", Math.Clamp(limit, 1, 5000));
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            list.Add(new Offen(r.GetString(0), r.GetString(1), r.GetInt32(2), r.IsDBNull(3) ? null : r.GetInt32(3), r.IsDBNull(4) ? null : r.GetString(4), r.GetString(5)));
        return list;
    }

    public sealed record ChunkVector(string Media, string Sha256, int Seq, float[] Vector);

    /// <summary>Vektoren ablegen — ersetzt, was zu dem Abschnitt stand (neuer Hash, anderes Modell).</summary>
    public async Task<int> PutChunksAsync(string model, IReadOnlyList<ChunkVector> items, CancellationToken ct = default)
    {
        if (!Ready || items.Count == 0) return 0;
        await using var conn = await _db!.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using var cmd = new NpgsqlCommand("""
            INSERT INTO media_vector (media, sha256, seq, model, embedding, at) VALUES (@m, @s, @q, @model, @v::vector, now())
            ON CONFLICT (media, seq) DO UPDATE SET sha256 = @s, model = @model, embedding = @v::vector, at = now()
            """, conn, tx);
        var pm = cmd.Parameters.Add("m", NpgsqlDbType.Text); var ps = cmd.Parameters.Add("s", NpgsqlDbType.Text);
        var pq = cmd.Parameters.Add("q", NpgsqlDbType.Integer); var pmodel = cmd.Parameters.Add("model", NpgsqlDbType.Text); var pv = cmd.Parameters.Add("v", NpgsqlDbType.Text);
        await cmd.PrepareAsync(ct);
        var n = 0;
        foreach (var it in items)
        {
            if (it.Vector is not { Length: > 0 }) continue;
            pm.Value = it.Media; ps.Value = it.Sha256; pq.Value = it.Seq; pmodel.Value = model; pv.Value = Literal(it.Vector);
            n += await cmd.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
        if (items.FirstOrDefault(i => i.Vector is { Length: > 0 }) is { } erster) await EnsureIndexAsync(conn, "media_vector", model, erster.Vector.Length, ct);
        return n;
    }

    /// <summary>Die nächsten Abschnitte zu einem Vektor; <paramref name="media"/> schränkt auf bestimmte Medien ein.</summary>
    public async Task<List<Treffer>> SearchChunksAsync(string model, float[] query, int limit, IReadOnlyCollection<string>? media = null, CancellationToken ct = default)
    {
        var list = new List<Treffer>();
        if (!Ready) return list;
        var only = media is { Count: > 0 };
        await using var conn = await _db!.OpenConnectionAsync(ct);
        var dims = query.Length;
        await using var cmd = new NpgsqlCommand($"""
            SELECT v.media, t.sha256, v.seq, t.page, t.heading, t.body, v.embedding::vector({dims}) <=> @q::vector({dims}) AS d
            FROM media_vector v
            JOIN media_text t ON t.media = v.media AND t.seq = v.seq AND t.sha256 = v.sha256
            WHERE v.model = {ModelLiteral(model)}{(only ? " AND v.media = ANY(@ids)" : "")}
            ORDER BY v.embedding::vector({dims}) <=> @q::vector({dims}), v.media, v.seq
            LIMIT @n
            """, conn);
        cmd.Parameters.AddWithValue("q", Literal(query));
        cmd.Parameters.AddWithValue("n", Math.Clamp(limit, 1, 500));
        if (only) cmd.Parameters.Add("ids", NpgsqlDbType.Array | NpgsqlDbType.Text).Value = media!.ToArray();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            list.Add(new Treffer(r.GetString(0), r.GetString(1), r.GetInt32(2), r.IsDBNull(3) ? null : r.GetInt32(3), r.IsDBNull(4) ? null : r.GetString(4), r.GetString(5), r.GetDouble(6)));
        return list;
    }

    public async Task<int> RemoveMediaAsync(string media, CancellationToken ct = default)
    {
        if (!Ready) return 0;
        await using var conn = await _db!.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("DELETE FROM media_vector WHERE media = @m", conn);
        cmd.Parameters.AddWithValue("m", media);
        return await cmd.ExecuteNonQueryAsync(ct);
    }

    // ---- Knoten -----------------------------------------------------------------------------

    /// <summary>Welcher Text je Knoten und Sprache schon eingebettet ist (sein Hash) — der Vergleich sagt, was offen ist.</summary>
    public async Task<Dictionary<(string Node, string Locale), string>> NodeHashesAsync(string model, CancellationToken ct = default)
    {
        var out_ = new Dictionary<(string, string), string>();
        if (!Ready) return out_;
        await using var conn = await _db!.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT node, locale, hash FROM node_vector WHERE model = @model", conn);
        cmd.Parameters.AddWithValue("model", model);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) out_[(r.GetString(0), r.GetString(1))] = r.GetString(2);
        return out_;
    }

    public sealed record NodeVector(string Node, string Locale, string Hash, float[] Vector);

    public async Task<int> PutNodesAsync(string model, IReadOnlyList<NodeVector> items, IReadOnlyCollection<string>? gone = null, CancellationToken ct = default)
    {
        if (!Ready) return 0;
        await using var conn = await _db!.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        var n = 0;
        if (gone is { Count: > 0 })
        {
            await using var del = new NpgsqlCommand("DELETE FROM node_vector WHERE node = ANY(@ids)", conn, tx);
            del.Parameters.Add("ids", NpgsqlDbType.Array | NpgsqlDbType.Text).Value = gone.ToArray();
            await del.ExecuteNonQueryAsync(ct);
        }
        if (items.Count > 0)
        {
            await using var cmd = new NpgsqlCommand("""
                INSERT INTO node_vector (node, locale, hash, model, embedding, at) VALUES (@n, @l, @h, @model, @v::vector, now())
                ON CONFLICT (node, locale) DO UPDATE SET hash = @h, model = @model, embedding = @v::vector, at = now()
                """, conn, tx);
            var pn = cmd.Parameters.Add("n", NpgsqlDbType.Text); var pl = cmd.Parameters.Add("l", NpgsqlDbType.Text); var ph = cmd.Parameters.Add("h", NpgsqlDbType.Text);
            var pmodel = cmd.Parameters.Add("model", NpgsqlDbType.Text); var pv = cmd.Parameters.Add("v", NpgsqlDbType.Text);
            await cmd.PrepareAsync(ct);
            foreach (var it in items)
            {
                if (it.Vector is not { Length: > 0 }) continue;
                pn.Value = it.Node; pl.Value = it.Locale; ph.Value = it.Hash; pmodel.Value = model; pv.Value = Literal(it.Vector);
                n += await cmd.ExecuteNonQueryAsync(ct);
            }
        }
        await tx.CommitAsync(ct);
        if (items.FirstOrDefault(i => i.Vector is { Length: > 0 }) is { } erster) await EnsureIndexAsync(conn, "node_vector", model, erster.Vector.Length, ct);
        return n;
    }

    /// <summary>Die nächsten Knoten zu einem Vektor in einer Sprache; <paramref name="exclude"/> nimmt den Ausgangsknoten heraus.</summary>
    public async Task<List<KnotenTreffer>> SearchNodesAsync(string model, float[] query, string locale, int limit, string? exclude = null, CancellationToken ct = default)
    {
        var list = new List<KnotenTreffer>();
        if (!Ready) return list;
        await using var conn = await _db!.OpenConnectionAsync(ct);
        var dims = query.Length;
        await using var cmd = new NpgsqlCommand($"""
            SELECT node, locale, embedding::vector({dims}) <=> @q::vector({dims}) AS d FROM node_vector
            WHERE model = {ModelLiteral(model)} AND locale = @l{(exclude is null ? "" : " AND node <> @x")}
            ORDER BY embedding::vector({dims}) <=> @q::vector({dims}), node LIMIT @n
            """, conn);
        cmd.Parameters.AddWithValue("q", Literal(query)); cmd.Parameters.AddWithValue("l", locale);
        cmd.Parameters.AddWithValue("n", Math.Clamp(limit, 1, 200));
        if (exclude is not null) cmd.Parameters.AddWithValue("x", exclude);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) list.Add(new KnotenTreffer(r.GetString(0), r.GetString(1), r.GetDouble(2)));
        return list;
    }

    /// <summary>Die Knoten, die einem Knoten am nächsten stehen — aus seinem eigenen Vektor, ohne neue Einbettung.</summary>
    public async Task<(bool Known, List<KnotenTreffer> Hits)> SimilarNodesAsync(string model, string node, string locale, int limit, CancellationToken ct = default)
    {
        if (!Ready) return (false, []);
        string? eigen;
        await using (var conn = await _db!.OpenConnectionAsync(ct))
        {
            await using var cmd = new NpgsqlCommand("SELECT embedding::text FROM node_vector WHERE node = @n AND locale = @l AND model = @model", conn);
            cmd.Parameters.AddWithValue("n", node); cmd.Parameters.AddWithValue("l", locale); cmd.Parameters.AddWithValue("model", model);
            eigen = await cmd.ExecuteScalarAsync(ct) as string;
        }
        if (eigen is null) return (false, []);
        return (true, await SearchNodesAsync(model, ParseLiteral(eigen), locale, limit, node, ct));
    }

    /// <summary>Zahlen für die Anzeige und den Balken: Abschnitte gesamt und mit Vektor zu diesem Modell, Knoten mit Vektor.</summary>
    public async Task<(long Chunks, long Embedded, long Nodes)> StatsAsync(string model, CancellationToken ct = default)
    {
        if (!Ready) return (0, 0, 0);
        await using var conn = await _db!.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT (SELECT count(*) FROM media_text),
                   (SELECT count(*) FROM media_vector v JOIN media_text t ON t.media = v.media AND t.seq = v.seq AND t.sha256 = v.sha256 WHERE v.model = @model),
                   (SELECT count(*) FROM node_vector WHERE model = @model)
            """, conn);
        cmd.Parameters.AddWithValue("model", model);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        return await r.ReadAsync(ct) ? (r.GetInt64(0), r.GetInt64(1), r.GetInt64(2)) : (0, 0, 0);
    }
}
