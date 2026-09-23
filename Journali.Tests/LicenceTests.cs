using Journali.Server;

namespace Journali.Tests;

// Die Lizenz (Taloan, 23.09.2026: „die Grenzen setzt der Lizenzkey“ · „selbst wenn Team B über Team A abrechnet, kann A
// nichts limitieren“ · „wer den Komfort der Kontrolle will, muss Teams mit eigenem Kontingent bilden“).
public class LicenceTests
{
    private static string Frisch()
    {
        var dir = Path.Combine(Path.GetTempPath(), "journali-lic-" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(dir); return dir;
    }

    [Fact]
    public void Ohne_Datei_gilt_der_Testbetrieb()
    {
        var dir = Frisch();
        var (lic, geprueft, grund) = LicenceFile.Load(dir);
        Assert.Equal("Testbetrieb", lic.Plan);
        Assert.Equal(20_000, lic.EntriesWeek);
        Assert.Equal(100_000, lic.EntriesMonth);
        Assert.Equal(0, lic.AiTokensMonth);   // kein Grundrauschen, solange keine Lizenz da ist
        Assert.False(geprueft);
        Assert.Contains("Testbetrieb", grund);
        Directory.Delete(dir, true);
    }

    [Fact]
    public void Eine_eingespielte_Lizenz_gilt_und_bleibt_ohne_Schluessel_ungeprueft()
    {
        var dir = Frisch();
        var l = new Licences(dir);
        l.Neu(new Licence("Klein", "Beispiel GmbH", null, 5_000, 25_000, 250_000, 40_000));
        Assert.Equal("Klein", l.Lic.Plan);
        Assert.Equal(250_000, l.Lic.AiTokensMonth);
        Assert.False(l.Geprueft);
        Assert.Contains("ungeprüft", l.Grund);   // ohne öffentlichen Schlüssel wird nichts vorgetäuscht
        // sie überlebt den Neustart: sie ist eine Datei, kein Stammdatum
        Assert.Equal(250_000, new Licences(dir).Lic.AiTokensMonth);
        Directory.Delete(dir, true);
    }

    [Fact]
    public void Abgelaufen_heisst_abgelaufen()
    {
        var dir = Frisch();
        var l = new Licences(dir);
        l.Neu(new Licence("Alt", null, DateOnly.FromDateTime(DateTime.Today.AddDays(-1)), 1, 2, 3, 4));
        Assert.True(l.Lic.Abgelaufen);
        Assert.False(l.Geprueft);
        Assert.Contains("abgelaufen", l.Grund);
        Directory.Delete(dir, true);
    }

    [Fact]
    public void Der_Rumpf_traegt_keine_Signatur_und_ist_stabil()
    {
        var a = new Licence("X", "Y", new DateOnly(2027, 1, 1), 1, 2, 3, 4);
        var b = a with { Sig = "irgendwas" };
        Assert.Equal(a.Rumpf, b.Rumpf);         // signiert wird, was drinsteht — nicht die Signatur selbst
        Assert.DoesNotContain("irgendwas", b.Rumpf);
    }
}
