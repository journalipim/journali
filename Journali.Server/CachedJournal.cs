using System.Text;
using System.Text.Json;
using Journali.Core.Journal;

namespace Journali.Server;

/// <summary>
/// Lokaler Spiegel des Journals. Jeder Eintrag, der einmal gelesen oder geschrieben wurde, landet als JSON-Zeile in einer Datei im
/// Datenverzeichnis; beim nächsten Start kommt <see cref="ReadAfter"/> bis zum Spiegelstand von der Platte und nur der
/// Rest aus der Datenbank. Der Spiegel ist ein Cache, keine Wahrheit: er wird gegen die Datenbank geprüft (letzter
/// Eintrag muss dort gleich sein, die Nummern müssen lückenlos sein) und bei jeder Abweichung verworfen — dann liest
/// der Start wie bisher alles aus der Datenbank. Alles andere (Ströme, Stapel, Zuletzt, Kopf) geht direkt zur Datenbank.
/// <para>Was je Eintrag kostet, wächst mit dem Journal. Gemessen an 125 096 Einträgen: 50 000 anhängen mit
/// der Datei je Eintrag auf und zu 7 417 ms, in einem offenen Strom 87 ms; den ganzen Spiegel entschlüsseln 2 162 ms,
/// nur die Zeilen lesen 365 ms. Darum: eine Datei je Vorgang, nicht je Eintrag; beim Start nur die letzte Zeile
/// entschlüsseln; beim Lesen Zeilen vor dem gesuchten Stand an ihrer Nummer erkennen, ohne sie zu entschlüsseln.</para>
/// </summary>
public sealed class CachedJournal : IJournal
{
    private readonly IJournal _inner;
    private readonly string _path;
    private readonly object _gate = new();
    private long _head;            // Nummer des letzten Eintrags im Spiegel; 0 = leer
    private StreamWriter? _w;      // offen, solange ein Vorgang schreibt — einmal auf, nicht je Eintrag
    private int _vorgaenge;        // wie viele Vorgänge den Schreiber gerade nutzen; beim letzten wird er geschlossen
    private static readonly JsonSerializerOptions Json = new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public CachedJournal(IJournal inner, string path)
    {
        _inner = inner; _path = path;
        _head = Validate();
    }

    /// <summary>Stand des Spiegels (für die Startzeile).</summary>
    public long CachedHead => _head;
    public string Path => _path;

    // Spiegel prüfen: letzte Zeile lesen, den Eintrag mit dieser Nummer in der Datenbank holen — gleich? sonst weg damit.
    // Lückenlos ist er, wenn die erste Zeile #1 ist und es so viele Zeilen gibt, wie die letzte Nummer sagt: jede Zeile
    // kommt nur an, wenn sie die nächste ist (AppendFile). Entschlüsselt wird nur die letzte Zeile.
    private long Validate()
    {
        if (!File.Exists(_path)) return 0;
        try
        {
            AbgebrocheneZeileAbschneiden();   // ein Absturz mitten im Schreiben kostet eine Zeile, nicht den Spiegel
            var (zeilen, erste, letzte) = Zeilen();
            if (zeilen == 0 || letzte is null) { File.Delete(_path); return 0; }
            var last = JsonSerializer.Deserialize<Entry>(letzte, Json) ?? throw new InvalidDataException("Spiegel: letzte Zeile unlesbar");
            if (erste != 1 || zeilen != last.Number) throw new InvalidDataException($"Spiegel: {zeilen} Zeilen bis #{last.Number}");
            var db = _inner.ReadAfter(last.Number - 1).FirstOrDefault();
            if (db is null || db.Number != last.Number || db.Stream != last.Stream || db.Type != last.Type || db.At != last.At || db.Payload != last.Payload)
            { File.Delete(_path); return 0; }
            return last.Number;
        }
        catch { try { File.Delete(_path); } catch { } return 0; }
    }

    /// <summary>Zeilen zählen, ohne sie zu entschlüsseln: Anzahl, Nummer der ersten, Text der letzten.</summary>
    private (long Zeilen, long? Erste, string? Letzte) Zeilen()
    {
        using var fs = new FileStream(_path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete, 1 << 16);
        using var reader = new StreamReader(fs, Encoding.UTF8);
        long n = 0; long? erste = null; string? letzte = null;
        while (reader.ReadLine() is { } line)
        {
            if (line.Length == 0) continue;
            n++; letzte = line;
            erste ??= Nummer(line);
        }
        return (n, erste, letzte);
    }

    /// <summary>
    /// Endet die Datei nicht mit einem Zeilenumbruch, hat ein Absturz die letzte Zeile halb geschrieben — sie wird
    /// abgeschnitten. Der nächste Lauf holt sie aus der Datenbank nach.
    /// </summary>
    private void AbgebrocheneZeileAbschneiden()
    {
        using var fs = new FileStream(_path, FileMode.Open, FileAccess.ReadWrite, FileShare.Read);
        if (fs.Length == 0) return;
        var puffer = new byte[64 * 1024];
        var ende = fs.Length;
        while (ende > 0)
        {
            var lang = (int)Math.Min(puffer.Length, ende);
            fs.Position = ende - lang;
            fs.ReadExactly(puffer, 0, lang);
            var i = Array.LastIndexOf(puffer, (byte)'\n', lang - 1, lang);
            if (i >= 0) { var schnitt = ende - lang + i + 1; if (schnitt != fs.Length) fs.SetLength(schnitt); return; }
            ende -= lang;
        }
        fs.SetLength(0);   // keine einzige ganze Zeile
    }

    /// <summary>Die Nummer einer Zeile, ohne sie zu entschlüsseln — sie beginnt immer mit <c>{"Number":…</c> (Entry, erstes Feld).</summary>
    private static long? Nummer(string line)
    {
        const string vorn = "{\"Number\":";
        if (!line.StartsWith(vorn, StringComparison.Ordinal)) return JsonSerializer.Deserialize<Entry>(line, Json)?.Number;
        long n = 0; var i = vorn.Length;
        for (; i < line.Length && char.IsAsciiDigit(line[i]); i++) n = n * 10 + (line[i] - '0');
        return i == vorn.Length ? null : n;
    }

    private IEnumerable<Entry> ReadFile(long after)
    {
        using var fs = new FileStream(_path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete, 1 << 16);
        using var reader = new StreamReader(fs, Encoding.UTF8);
        long expect = 0;
        while (reader.ReadLine() is { } line)
        {
            if (line.Length == 0) continue;
            var nr = Nummer(line) ?? throw new InvalidDataException("Spiegel: Zeile ohne Nummer");
            if (expect != 0 && nr != expect + 1) throw new InvalidDataException($"Spiegel: Lücke bei #{expect} → #{nr}");
            expect = nr;
            if (nr <= after) continue;   // vor dem gesuchten Stand: nicht entschlüsseln
            yield return JsonSerializer.Deserialize<Entry>(line, Json) ?? throw new InvalidDataException("Spiegel: Zeile unlesbar");
        }
    }

    /// <summary>Ein Vorgang beginnt zu schreiben — der Schreiber bleibt offen, bis der letzte Vorgang endet.</summary>
    private void Beginne() { lock (_gate) _vorgaenge++; }
    private void Beende()
    {
        lock (_gate)
        {
            if (--_vorgaenge > 0) { _w?.Flush(); return; }
            _w?.Dispose(); _w = null;
        }
    }

    private void AppendFile(Entry e)
    {
        lock (_gate)
        {
            if (e.Number != _head + 1) return;   // nicht der nächste (fremder Schreiber, Lücke): der nächste ReadAfter holt es aus der Datenbank
            _w ??= new StreamWriter(new FileStream(_path, FileMode.Append, FileAccess.Write, FileShare.Read | FileShare.Delete, 1 << 16), new UTF8Encoding(false));
            _w.WriteLine(JsonSerializer.Serialize(e, Json));
            _head = e.Number;
        }
    }

    public Entry Append(string actor, string stream, string type, string payload, string? batch = null, string? kind = null)
    {
        var e = _inner.Append(actor, stream, type, payload, batch, kind);
        Beginne();
        try { AppendFile(e); } finally { Beende(); }
        return e;
    }

    /// <summary>Eine Sicherung zurückschreiben und den Spiegel neu aufbauen — er zeigte sonst den Stand von vorher.</summary>
    public int RestoreAll(IEnumerable<Entry> entries)
    {
        lock (_gate)
        {
            var n = _inner.RestoreAll(entries);
            _w?.Dispose(); _w = null;
            try { File.Delete(_path); } catch { }
            _head = 0;
            Beginne();
            try { foreach (var e in _inner.ReadAfter(0)) AppendFile(e); } finally { Beende(); }
            return n;
        }
    }

    public IReadOnlyList<Entry> AppendMany(string actor, IReadOnlyList<(string Stream, string Type, string Payload)> items, string? batch = null)
    {
        var list = _inner.AppendMany(actor, items, batch);
        Beginne();
        try { foreach (var e in list) AppendFile(e); } finally { Beende(); }
        return list;
    }

    public IEnumerable<Entry> ReadAfter(long afterNumber)
    {
        lock (_gate) _w?.Flush();   // was ein anderer Vorgang noch im Puffer hat, muss in der Datei stehen, bevor sie gelesen wird
        var head = _head;
        long reached = afterNumber;
        if (afterNumber < head)
        {
            foreach (var e in ReadFile(afterNumber)) { reached = e.Number; yield return e; }
        }
        Beginne();
        try
        {
            foreach (var e in _inner.ReadAfter(Math.Max(reached, head)))
            {
                AppendFile(e);
                yield return e;
            }
        }
        finally { Beende(); }
    }

    public IEnumerable<Entry> ReadStream(string stream) => _inner.ReadStream(stream);
    public IEnumerable<Entry> ReadBatch(string batch) => _inner.ReadBatch(batch);
    public IEnumerable<Entry> ReadRecent(string type, int limit) => _inner.ReadRecent(type, limit);
    public long Head => _inner.Head;
}
