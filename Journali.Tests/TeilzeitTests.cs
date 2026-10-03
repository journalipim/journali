using Journali.Server;

namespace Journali.Tests;

/// <summary>Teilzeiten einer Anfrage: nur Beträchtliches wird notiert, ohne laufende Anfrage nichts.</summary>
public class TeilzeitTests
{
    [Fact]
    public async Task Notiert_wird_nur_in_einer_Anfrage_und_nur_ab_20_ms()
    {
        Teilzeit.Notiere("davor", 500);                       // keine Anfrage: nichts
        await Task.Run(() =>
        {
            Teilzeit.Beginn();
            Assert.Equal("", Teilzeit.Text());
            Teilzeit.Notiere("kurz", 5);
            Assert.Equal("", Teilzeit.Text());
            Teilzeit.Notiere("Sperre", 8120); Teilzeit.Notiere("Stand", 310);
            Assert.Equal(" · Sperre 8120 ms, Stand 310 ms", Teilzeit.Text());
        });
    }

    [Fact]
    public async Task Messen_haengt_die_Dauer_an_und_gibt_das_Ergebnis_zurueck()
    {
        await Task.Run(async () =>
        {
            Teilzeit.Beginn();
            Assert.Equal(7, Teilzeit.Messen("rechnet", () => { Thread.Sleep(40); return 7; }));
            Assert.Equal(9, await Teilzeit.MessenAsync("wartet", async () => { await Task.Delay(40); return 9; }));
            var t = Teilzeit.Text();
            Assert.Contains("rechnet ", t); Assert.Contains("wartet ", t);
        });
    }

    [Fact]
    public async Task Eine_freie_Lesesperre_meldet_nichts()
    {
        var c = new Catalog(new Journali.Core.Journal.MemoryJournal()); c.Rebuild(); c.SeedMissing();
        var gelesen = await Task.Run(() =>
        {
            Teilzeit.Beginn();
            c.Lesen((m, t) => 1);                             // frei: keine Wartezeit zu melden
            return Teilzeit.Text();
        });
        Assert.Equal("", gelesen);
    }
}
