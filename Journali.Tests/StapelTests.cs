using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Ein Stapel ist eine Transaktion.
// Einzeln kostet jeder Eintrag in Postgres eine eigene Transaktion mit Tabellensperre und MAX(number) — ein Import
// mit Zehntausenden Einträgen bezahlt das Zehntausende Male. Geprüft wird: es wird einmal geschrieben, die Befehle
// sehen einander trotzdem, und die Nummern stimmen hinterher.
public class StapelTests
{
    /// <summary>Zählt mit, wie oft einzeln und wie oft gebündelt geschrieben wurde.</summary>
    private sealed class ZaehlendesJournal : IJournal
    {
        private readonly MemoryJournal _inner = new();
        public int Einzeln, Gebuendelt, Eintraege;
        public Entry Append(string actor, string stream, string type, string payload, string? batch = null, string? kind = null)
        { Einzeln++; Eintraege++; return _inner.Append(actor, stream, type, payload, batch, kind); }
        public IReadOnlyList<Entry> AppendMany(string actor, IReadOnlyList<(string Stream, string Type, string Payload)> items, string? batch = null)
        { Gebuendelt++; Eintraege += items.Count; return _inner.AppendMany(actor, items, batch); }
        public IEnumerable<Entry> ReadAfter(long afterNumber) => _inner.ReadAfter(afterNumber);
        public IEnumerable<Entry> ReadStream(string stream) => _inner.ReadStream(stream);
        public IEnumerable<Entry> ReadBatch(string batch) => _inner.ReadBatch(batch);
        public IEnumerable<Entry> ReadRecent(string type, int limit) => _inner.ReadRecent(type, limit);
        public int RestoreAll(IEnumerable<Entry> entries) => _inner.RestoreAll(entries);
        public long Head => _inner.Head;
    }

    [Fact]
    public void Ein_Stapel_geht_in_einem_Zug_zur_Datenbank()
    {
        var j = new ZaehlendesJournal();
        var c = new Catalog(j); c.Rebuild();
        var vorher = j.Einzeln;

        c.WithBatch("u1", "b-1", (_, _, write) =>
        {
            for (var i = 0; i < 500; i++) write("u1", "n-" + i, Types.NodeMoved, new NodeMoved("g-1"), "b-1");
            return 0;
        });

        Assert.Equal(vorher, j.Einzeln);            // kein einziger Einzelschreibvorgang
        Assert.Equal(1, j.Gebuendelt);              // einer für den ganzen Stapel
        Assert.Equal(500, c.Head - vorher);
    }

    [Fact]
    public void Jeder_Befehl_sieht_den_vorigen()
    {
        // Genau daran scheiterte das Bündeln bisher: der zweite Befehl braucht den Knoten aus dem ersten
        var j = new ZaehlendesJournal();
        var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        var gesehen = false;
        c.WithBatch("system", "b-2", (_, tree, write) =>
        {
            write("system", "g-neu", Types.GroupCreated, new GroupCreated(null, new Labels(), "Neu"), "b-2");
            gesehen = tree.Nodes.ContainsKey("g-neu");   // der Baum kennt ihn sofort
            return 0;
        });
        Assert.True(gesehen, "der zweite Befehl hätte den ersten nicht gesehen");
        Assert.True(c.Read(t => t.Nodes.ContainsKey("g-neu")), "und danach steht er im Baum");
    }

    [Fact]
    public void Die_Nummern_sind_hinterher_dieselben()
    {
        var j = new ZaehlendesJournal();
        var c = new Catalog(j); c.Rebuild();
        var nummern = new List<long>();
        c.WithBatch("u1", "b-3", (_, _, write) =>
        {
            for (var i = 0; i < 20; i++) nummern.Add(write("u1", "n-" + i, Types.NodeMoved, new NodeMoved("g-1"), "b-3").Number);
            return 0;
        });
        Assert.Equal(Enumerable.Range(1, 20).Select(x => (long)x), nummern);
        Assert.Equal(20, j.ReadBatch("b-3").Count());
        Assert.Equal(nummern, j.ReadBatch("b-3").Select(e => e.Number));
    }

    [Fact]
    public void Bricht_ein_Befehl_ab_bleibt_kein_halber_Stand()
    {
        var j = new ZaehlendesJournal();
        var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        var vorher = c.Head;
        Assert.ThrowsAny<Exception>(() => c.WithBatch<int>("system", "b-4", (_, _, write) =>
        {
            write("system", "g-halb", Types.GroupCreated, new GroupCreated(null, new Labels(), "Halb"), "b-4");
            throw new InvalidOperationException("Befehl 2 geht nicht");
        }));
        Assert.Equal(vorher, c.Head);                                   // nichts geschrieben
        Assert.False(c.Read(t => t.Nodes.ContainsKey("g-halb")), "und nichts steht im Baum");
    }
}
