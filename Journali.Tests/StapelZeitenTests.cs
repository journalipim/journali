using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Server;

namespace Journali.Tests;

// Ein langsamer Stapel nennt in der Konsole, wohin die Zeit ging: Wartezeit auf die Schreibsperre, Anwenden im Speicher, Schreiben ins Journal.
public class StapelZeitenTests
{
    [Fact]
    public void Ein_Stapel_merkt_sich_Anzahl_und_Zeiten()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        Catalog.LetzterStapel = null;
        c.WithBatch("u", "b1", (_, _, write) => { for (var i = 0; i < 50; i++) write("u", "n-" + i, Types.AttributeSet, new AttributeSet("name", "de", null, "w" + i), null); return 0; });
        Assert.Matches(@"^50 entries: lock \d+ ms, apply \d+ ms, write \d+ ms$", Catalog.LetzterStapel);
    }
}
