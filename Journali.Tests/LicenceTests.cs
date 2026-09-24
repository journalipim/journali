using System.Security.Cryptography;
using Journali.Core.Licensing;
using Journali.Core.Projections;
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
        Assert.Equal(10_000, lic.TarifIn(Tarife.Saat).Week);
        Assert.Equal(50_000, lic.TarifIn(Tarife.Saat).Month);
        Assert.Equal(0, lic.AiTokensMonth);   // kein Grundrauschen, solange keine Lizenz da ist
        Assert.False(geprueft);
        Assert.Contains("Kostenlos", grund);
        Directory.Delete(dir, true);
    }

    [Fact]
    public void Eine_signierte_Lizenz_gilt()
    {
        var dir = Frisch();
        var l = new Licences(dir);
        l.Neu(PruefAussteller.Signiert(new Licence("enterprise", "Beispiel GmbH", null, 0, 0, null, 250_000, 40_000)));
        Assert.Equal("enterprise", l.Lic.Plan);
        Assert.Equal(250_000, l.Lic.AiTokensMonth);
        Assert.True(l.Geprueft);
        // sie überlebt den Neustart: sie ist eine Datei, kein Stammdatum
        Assert.Equal(250_000, new Licences(dir).Lic.AiTokensMonth);
        Directory.Delete(dir, true);
    }

    /// <summary>Nur Signiertes zählt (25.09.2026): ohne Signatur, mit fremdem Schlüssel oder nachträglich geändert gilt
    /// Kostenlos — eingespielt ist sie trotzdem, zum Anzeigen.</summary>
    [Fact]
    public void Ohne_passende_Signatur_gilt_Kostenlos()
    {
        var dir = Frisch();
        var l = new Licences(dir);
        var unlimited = new Licence("unlimited", "Beispiel GmbH");

        l.Neu(unlimited);
        Assert.Equal(Licence.Frei, l.Lic);
        Assert.Equal("unlimited", l.Roh.Plan);
        Assert.False(l.Geprueft);
        Assert.Equal("keine Signatur", l.Grund);

        using var fremd = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        l.Neu(unlimited with { Sig = Signaturen.Signiere(fremd, unlimited.Rumpf) });
        Assert.Equal(Licence.Frei, l.Lic);
        Assert.Equal("Signatur passt nicht", l.Grund);

        l.Neu(PruefAussteller.Signiert(new Licence("pro", "Beispiel GmbH")) with { Plan = "unlimited" });
        Assert.Equal(Licence.Frei, l.Lic);
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
