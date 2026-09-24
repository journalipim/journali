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

    // Was je Eintrag kostet, wächst mit dem Journal. Gemessen: 50 000 nachholen mit der Datei je Eintrag
    // auf und zu 7,4 s, in einem Strom 87 ms.
    [Fact]
    public void Nachholen_schreibt_viele_Eintraege_in_einem_Zug()
    {
        var path = TempFile();
        try
        {
            var inner = new MemoryJournal();
            inner.AppendMany("t", Enumerable.Range(0, 50_000).Select(i => ("s" + i, "AttributeSet", $"{{\"n\":{i}}}")).ToList());
            var sw = System.Diagnostics.Stopwatch.StartNew();
            Assert.Equal(50_000, new CachedJournal(inner, path).ReadAfter(0).Count());
            Assert.True(sw.ElapsedMilliseconds < 3_000, $"Nachholen dauerte {sw.ElapsedMilliseconds} ms — wird die Datei wieder je Eintrag geöffnet?");
            var again = new CachedJournal(inner, path);
            Assert.Equal(50_000, again.CachedHead);
            Assert.Equal(new long[] { 49_999, 50_000 }, again.ReadAfter(49_998).Select(e => e.Number).ToArray());
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void Eine_halb_geschriebene_letzte_Zeile_kostet_eine_Zeile_nicht_den_Spiegel()
    {
        var path = TempFile();
        try
        {
            var inner = new MemoryJournal();
            for (var i = 0; i < 5; i++) inner.Append("t", "s" + i, "X", "{}");
            new CachedJournal(inner, path).ReadAfter(0).ToList();
            File.AppendAllText(path, "{\"Number\":6,\"At\":\"2026-");     // Absturz mitten im Schreiben
            var again = new CachedJournal(inner, path);
            Assert.Equal(5, again.CachedHead);
            Assert.EndsWith("\n", File.ReadAllText(path));
            inner.Append("t", "s5", "X", "{}");
            Assert.Equal(6, again.ReadAfter(0).Count());
            Assert.Equal(6, new CachedJournal(inner, path).CachedHead);
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void Eine_fehlende_Zeile_mitten_im_Spiegel_verwirft_ihn()
    {
        var path = TempFile();
        try
        {
            var inner = new MemoryJournal();
            for (var i = 0; i < 5; i++) inner.Append("t", "s" + i, "X", "{}");
            new CachedJournal(inner, path).ReadAfter(0).ToList();
            var zeilen = File.ReadAllLines(path).ToList(); zeilen.RemoveAt(2);
            File.WriteAllLines(path, zeilen);                               // #3 fehlt, #5 ist noch die letzte
            Assert.Equal(0, new CachedJournal(inner, path).CachedHead);
        }
        finally { if (File.Exists(path)) File.Delete(path); }
    }

    [Fact]
    public void Schreiben_waehrend_des_Nachholens_bringt_die_Datei_nicht_durcheinander()
    {
        var path = TempFile();
        try
        {
            var inner = new MemoryJournal();
            for (var i = 0; i < 100; i++) inner.Append("t", "s" + i, "X", "{}");
            var cached = new CachedJournal(inner, path);
            var n = 0;
            foreach (var e in cached.ReadAfter(0))
                if (++n == 50) cached.Append("t", "neu", "X", "{}");          // ein Anwender schreibt, während der Start nachholt
            Assert.Equal(100, n);                                           // die Quelle wurde vor dem Schreiben gelesen
            Assert.Equal(101, cached.ReadAfter(0).Count());                 // der nächste Lauf holt es
            var again = new CachedJournal(inner, path);
            Assert.Equal(101, again.CachedHead);
            Assert.Equal(Enumerable.Range(1, 101).Select(i => (long)i), again.ReadAfter(0).Select(e => e.Number));
        }
        finally { File.Delete(path); }
    }
}
