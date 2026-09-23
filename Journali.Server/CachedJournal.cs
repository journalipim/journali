using System.Text;
using System.Text.Json;
using Journali.Core.Journal;

namespace Journali.Server;

/// <summary>
/// Lokaler Spiegel des Journals (Taloan, 21.09.2026: Start dauerte 31 s — davon 30 s Lesen über das Netz aus Postgres,
/// 1 s Anwenden). Jeder Eintrag, der einmal gelesen oder geschrieben wurde, landet als JSON-Zeile in einer Datei im
/// Datenverzeichnis; beim nächsten Start kommt <see cref="ReadAfter"/> bis zum Spiegelstand von der Platte und nur der
/// Rest aus der Datenbank. Der Spiegel ist ein Cache, keine Wahrheit: er wird gegen die Datenbank geprüft (letzter
/// Eintrag muss dort gleich sein, die Nummern müssen lückenlos sein) und bei jeder Abweichung verworfen — dann liest
/// der Start wie bisher alles aus der Datenbank. Alles andere (Ströme, Stapel, Zuletzt, Kopf) geht direkt zur Datenbank.
/// </summary>
public sealed class CachedJournal : IJournal
{
    private readonly IJournal _inner;
    private readonly string _path;
    private readonly object _gate = new();
    private long _head;            // Nummer des letzten Eintrags im Spiegel; 0 = leer
    private static readonly JsonSerializerOptions Json = new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public CachedJournal(IJournal inner, string path)
    {
        _inner = inner; _path = path;
        _head = Validate();
    }

    /// <summary>Stand des Spiegels (für die Startzeile).</summary>
    public long CachedHead => _head;
    public string Path => _path;

    // Spiegel prüfen: letzte Zeile lesen, den Eintrag mit dieser Nummer in der Datenbank holen — gleich? sonst weg damit
    private long Validate()
    {
        if (!File.Exists(_path)) return 0;
        try
        {
            Entry? last = null;
            foreach (var e in ReadFile(0)) last = e;   // liest einmal durch und prüft die Lückenlosigkeit (wirft bei Lücke)
            if (last is null) { File.Delete(_path); return 0; }
            var db = _inner.ReadAfter(last.Number - 1).FirstOrDefault();
            if (db is null || db.Number != last.Number || db.Stream != last.Stream || db.Type != last.Type || db.At != last.At || db.Payload != last.Payload)
            { File.Delete(_path); return 0; }
            return last.Number;
        }
        catch { try { File.Delete(_path); } catch { } return 0; }
    }

    private IEnumerable<Entry> ReadFile(long after)
    {
        using var fs = new FileStream(_path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite, 1 << 16);
        using var reader = new StreamReader(fs, Encoding.UTF8);
        long expect = 0;
        while (reader.ReadLine() is { } line)
        {
            if (line.Length == 0) continue;
            var e = JsonSerializer.Deserialize<Entry>(line, Json) ?? throw new InvalidDataException("Spiegel: Zeile unlesbar");
            if (expect != 0 && e.Number != expect + 1) throw new InvalidDataException($"Spiegel: Lücke bei #{expect} → #{e.Number}");
            expect = e.Number;
            if (e.Number > after) yield return e;
        }
    }

    private void AppendFile(Entry e)
    {
        lock (_gate)
        {
            if (e.Number != _head + 1) return;   // nicht der nächste (fremder Schreiber, Lücke): der nächste ReadAfter holt es aus der Datenbank
            using var fs = new FileStream(_path, FileMode.Append, FileAccess.Write, FileShare.Read);
            using var w = new StreamWriter(fs, new UTF8Encoding(false));
            w.WriteLine(JsonSerializer.Serialize(e, Json));
            _head = e.Number;
        }
    }

    public Entry Append(string actor, string stream, string type, string payload, string? batch = null, string? kind = null)
    {
        var e = _inner.Append(actor, stream, type, payload, batch, kind);
        AppendFile(e);
        return e;
    }

    /// <summary>Eine Sicherung zurückschreiben und den Spiegel neu aufbauen — er zeigte sonst den Stand von vorher.</summary>
    public int RestoreAll(IEnumerable<Entry> entries)
    {
        lock (_gate)
        {
            var n = _inner.RestoreAll(entries);
            try { File.Delete(_path); } catch { }
            _head = 0;
            foreach (var e in _inner.ReadAfter(0)) AppendFile(e);
            return n;
        }
    }

    public IReadOnlyList<Entry> AppendMany(string actor, IReadOnlyList<(string Stream, string Type, string Payload)> items, string? batch = null)
    {
        var list = _inner.AppendMany(actor, items, batch);
        foreach (var e in list) AppendFile(e);
        return list;
    }

    public IEnumerable<Entry> ReadAfter(long afterNumber)
    {
        var head = _head;
        long reached = afterNumber;
        if (afterNumber < head)
        {
            foreach (var e in ReadFile(afterNumber)) { reached = e.Number; yield return e; }
        }
        foreach (var e in _inner.ReadAfter(Math.Max(reached, head)))
        {
            AppendFile(e);
            yield return e;
        }
    }

    public IEnumerable<Entry> ReadStream(string stream) => _inner.ReadStream(stream);
    public IEnumerable<Entry> ReadBatch(string batch) => _inner.ReadBatch(batch);
    public IEnumerable<Entry> ReadRecent(string type, int limit) => _inner.ReadRecent(type, limit);
    public long Head => _inner.Head;
}
