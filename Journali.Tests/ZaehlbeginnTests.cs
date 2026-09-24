using Journali.Core.Projections;

namespace Journali.Tests;

// Ein Journal lässt sich nicht zurücksetzen — der Verbrauch sind die Einträge, und die bleiben. Was eine Lizenz sagen darf, ist, **ab wann**
// gezählt wird: `countFrom`. Alles davor bleibt stehen und zählt nicht mehr mit.
// Dazu die Reserve: ein Joblauf lässt der Handarbeit die letzten 10 %.
public class ZaehlbeginnTests
{
    [Fact]
    public void Ohne_Zaehlbeginn_gilt_der_Anfang_des_Zeitraums()
    {
        var montag = new DateOnly(2026, 9, 21);
        Assert.Equal(montag, Usage.Ab(montag, null));
    }

    [Fact]
    public void Ein_spaeterer_Zaehlbeginn_schneidet_den_Zeitraum_ab()
    {
        var montag = new DateOnly(2026, 9, 21);
        var mittwoch = new DateOnly(2026, 9, 23);
        Assert.Equal(mittwoch, Usage.Ab(montag, mittwoch));   // was vor Mittwoch geschrieben wurde, zählt nicht mehr
    }

    [Fact]
    public void Ein_frueherer_Zaehlbeginn_aendert_nichts()
    {
        var montag = new DateOnly(2026, 9, 21);
        Assert.Equal(montag, Usage.Ab(montag, new DateOnly(2026, 1, 1)));
    }

    [Fact]
    public void Ein_Job_laesst_der_Handarbeit_zehn_Prozent()
    {
        Assert.Equal(18_000, Limits.FuerJob(20_000));
        Assert.Equal(90_000, Limits.FuerJob(100_000));
        Assert.Equal(0, Limits.FuerJob(0));       // kein Kontingent bleibt kein Kontingent
        Assert.Equal(9, Limits.FuerJob(10));      // und bei kleinen Zahlen wird abgerundet
    }
}
