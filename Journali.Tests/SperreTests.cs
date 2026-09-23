using System.Diagnostics;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Server;

namespace Journali.Tests;

// Leser warten nicht auf Schreiber (Taloan, 23.09.2026: „ich habe einen Solr-Import gestartet und alles ist super
// langsam“). Gemessen war damals: /api/health 25 Sekunden ohne Antwort bei 0 CPU — der Halter der einen Sperre
// wartete auf die Datenbank, und jeder Lesezugriff stand dahinter. Hier steht dieselbe Lage nachgestellt: ein
// Journal, dessen Append hängt, und daneben jemand, der lesen will.
public class SperreTests
{
    /// <summary>Ein Journal, dessen Append so lange braucht, wie eine langsame Datenbank braucht.</summary>
    private sealed class ZaehesJournal(TimeSpan dauer) : IJournal
    {
        private readonly MemoryJournal _inner = new();
        public Entry Append(string actor, string stream, string type, string payload, string? batch = null, string? kind = null)
        {
            Thread.Sleep(dauer);
            return _inner.Append(actor, stream, type, payload, batch, kind);
        }
        public IReadOnlyList<Entry> AppendMany(string actor, IReadOnlyList<(string Stream, string Type, string Payload)> items, string? batch = null)
        { Thread.Sleep(dauer); return _inner.AppendMany(actor, items, batch); }
        public IEnumerable<Entry> ReadAfter(long afterNumber) => _inner.ReadAfter(afterNumber);
        public IEnumerable<Entry> ReadStream(string stream) => _inner.ReadStream(stream);
        public IEnumerable<Entry> ReadBatch(string batch) => _inner.ReadBatch(batch);
        public IEnumerable<Entry> ReadRecent(string type, int limit) => _inner.ReadRecent(type, limit);
        public int RestoreAll(IEnumerable<Entry> entries) => _inner.RestoreAll(entries);
        public long Head => _inner.Head;
    }

    [Fact]
    public async Task Wer_liest_wartet_nicht_auf_die_Datenbank()
    {
        var c = new Catalog(new ZaehesJournal(TimeSpan.FromMilliseconds(600)));
        c.Rebuild();

        // ein Schreiber, der 600 ms in der Datenbank hängt
        var schreibt = Task.Run(() => c.With((_, _, write) =>
            write("t", "n-test", Types.NodeNamed, new NodeNamed("x"), null)));

        Thread.Sleep(100);   // ihm Zeit geben, in den Append zu laufen
        var uhr = Stopwatch.StartNew();
        var kopf = c.Head;                       // genau das machte die Statusleiste alle drei Sekunden
        var knoten = c.Read(t => t.Nodes.Count);
        uhr.Stop();

        await schreibt;
        Assert.True(uhr.ElapsedMilliseconds < 200, $"Lesen dauerte {uhr.ElapsedMilliseconds} ms — es hat auf den Schreiber gewartet");
        Assert.True(kopf >= 0 && knoten >= 0);
    }

    [Fact]
    public void Zwei_Schreiber_kommen_trotzdem_nacheinander_dran()
    {
        // Prüfen und Schreiben bleibt eine Einheit: sonst sähe der zweite einen halben Stand
        var c = new Catalog(new ZaehesJournal(TimeSpan.FromMilliseconds(120)));
        c.Rebuild();
        var nummern = new List<long>();
        Parallel.For(0, 6, i =>
        {
            var e = c.With((_, _, write) => write("t", "n-" + i, Types.NodeNamed, new NodeNamed("x" + i), null));
            lock (nummern) nummern.Add(e.Number);
        });
        Assert.Equal(6, nummern.Count);
        Assert.Equal(6, nummern.Distinct().Count());   // keine Nummer doppelt
    }

    [Fact]
    public async Task Der_Stand_stimmt_nach_parallelem_Betrieb()
    {
        var c = new Catalog(new MemoryJournal());
        c.Rebuild();
        var lesen = new CancellationTokenSource();
        var leser = Task.Run(() => { while (!lesen.IsCancellationRequested) { _ = c.Head; _ = c.Read(t => t.Nodes.Count); } });
        for (var i = 0; i < 200; i++) c.With((_, _, write) => write("t", "n-" + i, Types.NodeNamed, new NodeNamed("x"), null));
        lesen.Cancel();
        await leser;
        Assert.Equal(200, c.Head);
    }
}
