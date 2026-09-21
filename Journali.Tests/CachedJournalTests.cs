using Journali.Core.Journal;
using Journali.Server;

namespace Journali.Tests;

/// <summary>Der lokale Spiegel des Journals (CachedJournal): liest von der Platte, prüft gegen die Quelle, verwirft bei Abweichung.</summary>
public class CachedJournalTests
{
    private static string TempFile() => Path.Combine(Path.GetTempPath(), "journali-test-" + Guid.NewGuid().ToString("N") + ".jsonl");

    [Fact]
    public void Spiegel_liefert_dieselben_Eintraege_wie_die_Quelle_und_fuellt_sich_beim_Lesen()
    {
        var path = TempFile();
        try
        {
            var inner = new MemoryJournal();
            for (var i = 0; i < 5; i++) inner.Append("t", "s" + i, "AttributeSet", $"{{\"n\":{i}}}");
            var cached = new CachedJournal(inner, path);
            Assert.Equal(0, cached.CachedHead);
            var all = cached.ReadAfter(0).ToList();
            Assert.Equal(5, all.Count);
            Assert.Equal(5, cached.CachedHead);                       // beim Lesen gefüllt
            // zweiter Start: alles aus dem Spiegel, gleiche Einträge
            var again = new CachedJournal(inner, path);
            Assert.Equal(5, again.CachedHead);
            var fromCache = again.ReadAfter(0).ToList();
            Assert.Equal(all.Select(e => (e.Number, e.Stream, e.Type, e.Payload, e.At)), fromCache.Select(e => (e.Number, e.Stream, e.Type, e.Payload, e.At)));
            // teilweise: ab #3 nur zwei
            Assert.Equal(new long[] { 4, 5 }, again.ReadAfter(3).Select(e => e.Number).ToArray());
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void Schreiben_landet_im_Spiegel_und_Neues_in_der_Quelle_wird_nachgeholt()
    {
        var path = TempFile();
        try
        {
            var inner = new MemoryJournal();
            var cached = new CachedJournal(inner, path);
            cached.Append("t", "a", "X", "{}");
            cached.AppendMany("t", new[] { ("b", "X", "{}"), ("c", "X", "{}") });
            Assert.Equal(3, cached.CachedHead);
            inner.Append("t", "d", "X", "{}");                        // fremder Schreiber direkt in der Quelle
            var got = cached.ReadAfter(0).Select(e => e.Stream).ToArray();
            Assert.Equal(new[] { "a", "b", "c", "d" }, got);
            Assert.Equal(4, cached.CachedHead);
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void Spiegel_wird_verworfen_wenn_die_Quelle_nicht_mehr_passt()
    {
        var path = TempFile();
        try
        {
            var inner = new MemoryJournal();
            inner.Append("t", "a", "X", "{}"); inner.Append("t", "b", "X", "{}");
            new CachedJournal(inner, path).ReadAfter(0).ToList();
            Assert.True(File.Exists(path));
            // andere Datenbank: gleiche Nummern, anderer Inhalt
            var other = new MemoryJournal();
            other.Append("t", "a", "X", "{}"); other.Append("t", "z", "Y", "{}");
            var cached = new CachedJournal(other, path);
            Assert.Equal(0, cached.CachedHead);
            Assert.Equal(new[] { "a", "z" }, cached.ReadAfter(0).Select(e => e.Stream).ToArray());
            // kaputte Datei: Lücke → weg
            File.WriteAllLines(path, new[] { "{\"Number\":1,\"At\":\"2026-01-01T00:00:00+00:00\",\"Actor\":\"t\",\"Stream\":\"a\",\"Type\":\"X\",\"Payload\":\"{}\"}", "{\"Number\":3,\"At\":\"2026-01-01T00:00:00+00:00\",\"Actor\":\"t\",\"Stream\":\"c\",\"Type\":\"X\",\"Payload\":\"{}\"}" });
            Assert.Equal(0, new CachedJournal(other, path).CachedHead);
            Assert.False(File.Exists(path));
        }
        finally { if (File.Exists(path)) File.Delete(path); }
    }
}
