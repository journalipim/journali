using Npgsql;
using NpgsqlTypes;
using System.Text.Json;

namespace Journali.Server;

/// <summary>
/// Der Text der Dokumente. Am Knoten hängen Datenblätter und Zertifikate; für uns waren sie bisher
/// eine Blackbox: <c>MediaCreated</c> kennt Hash, Grösse, Mime und Name, nicht den Inhalt.
/// <para>Das hier ist <b>abgeleitet</b>, nicht Wahrheit: Text und Abschnitte entstehen aus einer Datei, die
/// hash-adressiert im Medienspeicher liegt, und lassen sich jederzeit neu herstellen. Deshalb eigene Tabelle neben dem
/// Journal (wie die gerechneten Vorschauen), nichts davon wird je ein Eintrag.</para>
/// <para>Gesucht wird mit Postgres-Volltext: exakt bei Zahlen, Normen und Kennungen („12 N/mm²“, „DIN EN 204“), kostenlos
/// und ohne Modell. Die semantische Suche kommt später daneben (pgvector), sie ersetzt diese nicht.</para>
/// </summary>
public sealed class DocText
{
    private readonly NpgsqlDataSource? _db;
    /// <summary>Wörterbuch für den Index: deutsch stemmt („Klebstoffe“ → „klebstoff“), simple nimmt die Wörter, wie sie sind.</summary>
    private const string Dict = "german";

    public DocText(NpgsqlDataSource? db)
    {
        _db = db;
        if (_db is null) return;
        using var conn = _db.OpenConnection();
        using var cmd = new NpgsqlCommand($"""
            CREATE TABLE IF NOT EXISTS media_text (
                media   TEXT        NOT NULL,
                sha256  TEXT        NOT NULL,
                seq     INT         NOT NULL,
                page    INT,
                heading TEXT,
                body    TEXT        NOT NULL,
                at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (media, seq)
            );
            ALTER TABLE media_text ADD COLUMN IF NOT EXISTS tsv tsvector
                GENERATED ALWAYS AS (to_tsvector('{Dict}', coalesce(heading, '') || ' ' || body)) STORED;
            CREATE INDEX IF NOT EXISTS media_text_tsv ON media_text USING GIN (tsv);
            CREATE INDEX IF NOT EXISTS media_text_sha ON media_text (sha256);
            -- Zustand je Dokument: gelesen, ohne Textebene (Scan → OCR), nicht lesbar. Ohne ihn versuchte der Job
            -- einen Scan in jeder Runde neu, weil „keine Abschnitte“ wie „noch nicht gelesen“ aussieht.
            CREATE TABLE IF NOT EXISTS media_text_doc (
                media   TEXT PRIMARY KEY,
                sha256  TEXT        NOT NULL,
                state   TEXT        NOT NULL,
                pages   INT,
                chunks  INT         NOT NULL DEFAULT 0,
                note    TEXT,
                at      TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            -- Tabellen im Dokument (27.09.2026, 34 L): je Tabelle die Zeilen als Zellen — technische Daten, Schlüssel links,
            -- Wert rechts. Abgeleitet wie der Text: der Leser findet sie beim selben Lesen, der Dialog am Knoten fragt sie ab.
            CREATE TABLE IF NOT EXISTS media_table (
                media   TEXT        NOT NULL,
                sha256  TEXT        NOT NULL,
                seq     INT         NOT NULL,
                page    INT,
                heading TEXT,
                rows    JSONB       NOT NULL,
                at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (media, seq)
            );
            """, conn);
        cmd.ExecuteNonQuery();
    }

    public bool Ready => _db is not null;

    /// <summary>Ein Abschnitt: Reihenfolge im Dokument, Seite (wenn bekannt), Überschrift darüber, der Text.</summary>
    public sealed record Chunk(int Seq, int? Page, string? Heading, string Body);

    /// <summary>Eine Tabelle im Dokument: Reihenfolge, Seite, Überschrift darüber, die Zeilen als Zellen (erste Zelle der Schlüssel).</summary>
    public sealed record Table(int Seq, int? Page, string? Heading, List<string[]> Rows);

    /// <summary>Treffer: Medium, Abschnitt und ein Ausschnitt mit den gefundenen Wörtern.</summary>
    public sealed record Hit(string Media, string Sha256, int Seq, int? Page, string? Heading, string Snippet, double Rank);

    /// <summary>Was aus einem Dokument wurde: <c>text</c> (gelesen), <c>scan</c> (keine Textebene — OCR nötig), <c>fehler</c>.</summary>
    public static class States { public const string Text = "text"; public const string Scan = "scan"; public const string Error = "fehler"; }

    /// <summary>Text eines Mediums ersetzen (erst weg, dann neu) — dasselbe Dokument wird nie zweimal gelesen, der Hash sagt es.</summary>
    public async Task PutAsync(string media, string sha256, IReadOnlyList<Chunk> chunks, string state = States.Text, int? pages = null, string? note = null, IReadOnlyList<Table>? tables = null, CancellationToken ct = default)
    {
        if (_db is null) throw new InvalidOperationException("Ohne Postgres gibt es keinen Dokumentindex.");
        await using var conn = await _db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using (var del = new NpgsqlCommand("DELETE FROM media_text WHERE media = @m", conn, tx))
        {
            del.Parameters.AddWithValue("m", media);
            await del.ExecuteNonQueryAsync(ct);
        }
        await using var ins = new NpgsqlCommand("INSERT INTO media_text (media, sha256, seq, page, heading, body) VALUES (@m, @s, @q, @p, @h, @b)", conn, tx);
        var pm = ins.Parameters.Add("m", NpgsqlDbType.Text); var ps = ins.Parameters.Add("s", NpgsqlDbType.Text);
        var pq = ins.Parameters.Add("q", NpgsqlDbType.Integer); var pp = ins.Parameters.Add("p", NpgsqlDbType.Integer);
        var ph = ins.Parameters.Add("h", NpgsqlDbType.Text); var pb = ins.Parameters.Add("b", NpgsqlDbType.Text);
        await ins.PrepareAsync(ct);
        foreach (var chunk in chunks)
        {
            pm.Value = media; ps.Value = sha256; pq.Value = chunk.Seq;
            pp.Value = (object?)chunk.Page ?? DBNull.Value;
            ph.Value = (object?)Clean(chunk.Heading) ?? DBNull.Value;
            pb.Value = Clean(chunk.Body) ?? "";
            await ins.ExecuteNonQueryAsync(ct);
        }
        // Tabellen: erst weg, dann neu — wie der Text, und im selben Vorgang
        await using (var delT = new NpgsqlCommand("DELETE FROM media_table WHERE media = @m", conn, tx))
        {
            delT.Parameters.AddWithValue("m", media);
            await delT.ExecuteNonQueryAsync(ct);
        }
        foreach (var t in tables ?? [])
        {
            if (t.Rows is not { Count: > 0 }) continue;
            await using var insT = new NpgsqlCommand("INSERT INTO media_table (media, sha256, seq, page, heading, rows) VALUES (@m, @s, @q, @p, @h, @r)", conn, tx);
            insT.Parameters.AddWithValue("m", media); insT.Parameters.AddWithValue("s", sha256); insT.Parameters.AddWithValue("q", t.Seq);
            insT.Parameters.AddWithValue("p", (object?)t.Page ?? DBNull.Value);
            insT.Parameters.AddWithValue("h", (object?)Clean(t.Heading) ?? DBNull.Value);
            insT.Parameters.Add("r", NpgsqlDbType.Jsonb).Value = JsonSerializer.Serialize(t.Rows.Select(r => r.Select(c => Clean(c) ?? "").ToArray()));
            await insT.ExecuteNonQueryAsync(ct);
        }
        await using (var doc = new NpgsqlCommand("""
            INSERT INTO media_text_doc (media, sha256, state, pages, chunks, note, at)
            VALUES (@m, @s, @st, @p, @c, @n, now())
            ON CONFLICT (media) DO UPDATE SET sha256 = @s, state = @st, pages = @p, chunks = @c, note = @n, at = now()
            """, conn, tx))
        {
            doc.Parameters.AddWithValue("m", media); doc.Parameters.AddWithValue("s", sha256);
            doc.Parameters.AddWithValue("st", state);
            doc.Parameters.AddWithValue("p", (object?)pages ?? DBNull.Value);
            doc.Parameters.AddWithValue("c", chunks.Count);
            doc.Parameters.AddWithValue("n", (object?)Clean(note) ?? DBNull.Value);
            await doc.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
    }

    /// <summary>
    /// Text, wie Postgres ihn annimmt. Ein PDF mit kaputter Zeichentabelle liefert Nullbytes mitten im Text; <c>text</c> in Postgres verträgt
    /// kein 0x00, und ein einziges davon lässt das ganze Dokument scheitern. Weg damit — und gleich auch die übrigen
    /// Steuerzeichen ausser Tabulator und Zeilenumbruch: sie sind nie Text, stehen aber im Ausschnitt eines Treffers.
    /// Leer bleibt leer (null), damit die Spalte NULL bekommt und nicht einen leeren String.
    /// </summary>
    public static string? Clean(string? s)
    {
        if (string.IsNullOrEmpty(s)) return s;
        if (!s.Any(ch => ch < ' ' && ch is not ('\t' or '\n' or '\r'))) return s;
        var sb = new System.Text.StringBuilder(s.Length);
        foreach (var ch in s) if (ch >= ' ' || ch is '\t' or '\n' or '\r') sb.Append(ch);
        return sb.ToString();
    }

    /// <summary>Alle Dokumente, die beim Lesen scheiterten, wieder freigeben — der Job nimmt sie in der nächsten Runde
    /// erneut. Ohne das bliebe ein Fehler für immer stehen, auch wenn die Ursache längst behoben ist. Ein erkannter Scan bleibt draussen, der wartet auf OCR und nicht auf eine neue Serverfassung.</summary>
    public async Task<int> RetryFailedAsync(CancellationToken ct = default)
    {
        if (_db is null) return 0;
        await using var conn = await _db.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand($"DELETE FROM media_text_doc WHERE state = '{States.Error}'", conn);
        return await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>Welcher Stand je Medium schon gelesen wurde (Hash und Zustand) — damit holt der Job nur Neues und
    /// versucht einen Scan nicht in jeder Runde erneut.</summary>
    public async Task<Dictionary<string, (string Sha, string State)>> IndexedAsync(CancellationToken ct = default)
    {
        var out_ = new Dictionary<string, (string, string)>();
        if (_db is null) return out_;
        await using var conn = await _db.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("SELECT media, sha256, state FROM media_text_doc", conn);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) out_[r.GetString(0)] = (r.GetString(1), r.GetString(2));
        return out_;
    }

    public async Task<int> RemoveAsync(string media, CancellationToken ct = default)
    {
        if (_db is null) return 0;
        await using var conn = await _db.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("DELETE FROM media_text WHERE media = @m; DELETE FROM media_table WHERE media = @m; DELETE FROM media_text_doc WHERE media = @m;", conn);
        cmd.Parameters.AddWithValue("m", media);
        return await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>Die Tabellen eines Dokuments mit dem Stand des Index: Zustand und Hash, den der Leser kannte. Ohne Zustand
    /// ist das Dokument noch nicht gelesen — der Dialog wartet dann auf den Job, statt leere Tabellen zu zeigen.</summary>
    public async Task<(string? State, string? Sha256, List<Table> Tables)> TablesAsync(string media, CancellationToken ct = default)
    {
        var tables = new List<Table>();
        if (_db is null) return (null, null, tables);
        await using var conn = await _db.OpenConnectionAsync(ct);
        string? state = null, sha = null;
        await using (var doc = new NpgsqlCommand("SELECT state, sha256 FROM media_text_doc WHERE media = @m", conn))
        {
            doc.Parameters.AddWithValue("m", media);
            await using var r = await doc.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct)) { state = r.GetString(0); sha = r.GetString(1); }
        }
        await using var cmd = new NpgsqlCommand("SELECT seq, page, heading, rows::text FROM media_table WHERE media = @m ORDER BY seq", conn);
        cmd.Parameters.AddWithValue("m", media);
        await using var rd = await cmd.ExecuteReaderAsync(ct);
        while (await rd.ReadAsync(ct))
            tables.Add(new Table(rd.GetInt32(0), rd.IsDBNull(1) ? null : rd.GetInt32(1), rd.IsDBNull(2) ? null : rd.GetString(2),
                JsonSerializer.Deserialize<List<string[]>>(rd.GetString(3)) ?? []));
        return (state, sha, tables);
    }

    /// <summary>Wortsuche über alle Abschnitte; <paramref name="media"/> schränkt auf bestimmte Medien ein (die Treffer eines Teilbaums).</summary>
    public async Task<List<Hit>> SearchAsync(string query, int limit = 50, IReadOnlyCollection<string>? media = null, CancellationToken ct = default)
    {
        var hits = new List<Hit>();
        if (_db is null || string.IsNullOrWhiteSpace(query)) return hits;
        var only = media is { Count: > 0 };
        await using var conn = await _db.OpenConnectionAsync(ct);
        // websearch_to_tsquery versteht, was Anwender tippen: "12 N/mm²", -ohne, "genaue Wendung"
        await using var cmd = new NpgsqlCommand($"""
            SELECT media, sha256, seq, page, heading,
                   ts_headline('{Dict}', body, websearch_to_tsquery('{Dict}', @q), 'MaxFragments=1,MaxWords=28,MinWords=12,StartSel=«,StopSel=»'),
                   ts_rank(tsv, websearch_to_tsquery('{Dict}', @q))
            FROM media_text
            WHERE tsv @@ websearch_to_tsquery('{Dict}', @q){(only ? " AND media = ANY(@ids)" : "")}
            ORDER BY 7 DESC, media, seq
            LIMIT @n
            """, conn);
        cmd.Parameters.AddWithValue("q", query);
        cmd.Parameters.AddWithValue("n", Math.Clamp(limit, 1, 500));
        if (only) cmd.Parameters.Add("ids", NpgsqlDbType.Array | NpgsqlDbType.Text).Value = media!.ToArray();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            hits.Add(new Hit(r.GetString(0), r.GetString(1), r.GetInt32(2),
                r.IsDBNull(3) ? null : r.GetInt32(3), r.IsDBNull(4) ? null : r.GetString(4), r.GetString(5), r.GetDouble(6)));
        return hits;
    }

    /// <summary>Zahlen für die Anzeige: gelesene Dokumente, Abschnitte, und wie viele auf OCR warten oder scheiterten.</summary>
    public async Task<(int Media, long Chunks, int Scans, int Errors)> StatsAsync(CancellationToken ct = default)
    {
        if (_db is null) return (0, 0, 0, 0);
        await using var conn = await _db.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT (SELECT count(*) FROM media_text_doc WHERE state = 'text'),
                   (SELECT count(*) FROM media_text),
                   (SELECT count(*) FROM media_text_doc WHERE state = 'scan'),
                   (SELECT count(*) FROM media_text_doc WHERE state = 'fehler')
            """, conn);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        return await r.ReadAsync(ct) ? ((int)r.GetInt64(0), r.GetInt64(1), (int)r.GetInt64(2), (int)r.GetInt64(3)) : (0, 0, 0, 0);
    }
}
