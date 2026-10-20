using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Wer gerade wo arbeitet (26.09.2026) — flüchtig, neben dem Journal. Ohne Datenbank hält <see cref="Presence"/> es im
/// Speicher; mit Datenbank sehen auch mehrere Server einander, denn sie schreiben in dieselbe Tabelle.
/// </summary>
public class PresenceTests
{
    private static readonly DateTimeOffset Jetzt = new(2026, 9, 26, 10, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Wer_hier_ist_sieht_die_anderen_aber_nicht_sich_selbst()
    {
        var p = new Presence(null);
        Assert.Empty(p.Puls("u1", "v-1", Jetzt));                       // allein
        Assert.Equal(["u1"], p.Puls("admin", "v-1", Jetzt));            // admin sieht u1
        Assert.Equal(["admin"], p.Puls("u1", "v-1", Jetzt));            // und umgekehrt
        Assert.Empty(p.Puls("u1", "v-2", Jetzt));                       // woanders ist niemand
    }

    [Fact]
    public void Wer_nicht_mehr_pulst_ist_nach_kurzem_weg()
    {
        var p = new Presence(null);
        p.Puls("admin", "v-1", Jetzt);
        Assert.Equal(["admin"], p.Puls("u1", "v-1", Jetzt));
        var spaeter = Jetzt + Presence.Gilt + TimeSpan.FromSeconds(1);
        Assert.Empty(p.Puls("u1", "v-1", spaeter));                     // admin hat seither nicht gepulst
    }

    [Fact]
    public void Ohne_Ort_und_ohne_Namen_passiert_nichts()
    {
        var p = new Presence(null);
        Assert.Empty(p.Puls("u1", null, Jetzt));
        Assert.Empty(p.Puls("u1", "", Jetzt));
        p.Puls(null, "v-1", Jetzt);                                        // ohne Anmeldung: nur schauen, nicht melden
        Assert.Empty(p.Puls("u1", "v-1", Jetzt));
    }
}
