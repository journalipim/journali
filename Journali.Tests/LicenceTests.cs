using Journali.Server;

namespace Journali.Tests;

// Die Lizenz.
public class LicenceTests
{
    private static string Frisch()
    {
        var dir = Path.Combine(Path.GetTempPath(), "journali-lic-" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(dir); return dir;
    }

    [Fact]
    public void Ohne_Datei_gilt_Kostenlos()
    {
        var dir = Frisch();
        var (lic, geprueft, grund) = LicenceFile.Load(dir);
        Assert.Equal("free", lic.Plan);          // Tarif Kostenlos
        Assert.Equal(10_000, lic.Week);
        Assert.Equal(50_000, lic.Month);
        Assert.Equal(0, lic.AiTokensMonth);   // kein Grundrauschen, solange keine Lizenz da ist
        Assert.False(geprueft);
        Assert.Contains("Kostenlos", grund);
        Directory.Delete(dir, true);
    }

    [Fact]
    public void Eine_eingespielte_Lizenz_gilt_und_bleibt_ohne_Schluessel_ungeprueft()
    {
        var dir = Frisch();
        var l = new Licences(dir);
        l.Neu(new Licence("Klein", "Beispiel GmbH", null, 5_000, 25_000, null, 250_000, 40_000));
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
        l.Neu(new Licence("Alt", null, DateOnly.FromDateTime(DateTime.Today.AddDays(-1)), 1, 2, null, 3, 4));
        Assert.True(l.Roh.Abgelaufen);            // eingespielt ist sie noch — zum Anzeigen
        Assert.Equal(Licence.Frei, l.Lic);        // es gilt Kostenlos
        Assert.False(l.Geprueft);
        Assert.Contains("abgelaufen", l.Grund);
        Directory.Delete(dir, true);
    }

    [Fact]
    public void Der_Rumpf_traegt_keine_Signatur_und_ist_stabil()
    {
        var a = new Licence("X", "Y", new DateOnly(2027, 1, 1), 1, 2, null, 3, 4);
        var b = a with { Sig = "irgendwas" };
        Assert.Equal(a.Rumpf, b.Rumpf);         // signiert wird, was drinsteht — nicht die Signatur selbst
        Assert.DoesNotContain("irgendwas", b.Rumpf);
    }
}
