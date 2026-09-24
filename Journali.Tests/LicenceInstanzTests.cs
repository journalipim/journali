using System.Text.Json;
using System.Text.Json.Serialization;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Die Lizenz gilt für eine Anlage. Darum nennt sie die Kennung der Anlage, für
/// die sie ausgestellt wurde, und zwar im signierten Rumpf; passt sie nicht, gilt der Testbetrieb.
/// <para>Was das nicht leistet, steht bei <see cref="Instanz"/>: wer die Datenbank besitzt, kann die Kennung ändern,
/// und bei offenem Quelltext lässt sich die Prüfung entfernen. Es macht Vervielfältigung zu einer bewussten Handlung statt zu einem Nebeneffekt der
/// Wiederherstellung.</para>
/// </summary>
public class LicenceInstanzTests
{
    private const string A = "11111111-2222-3333-4444-555555555555";
    private const string B = "99999999-8888-7777-6666-555555555555";

    // dieselbe Schreibweise wie der Server (Licence.Json ist intern)
    private static readonly JsonSerializerOptions Opt = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };
    private static string Json(Licence l) => JsonSerializer.Serialize(l, Opt);
    private static Licence Fuer(string? anlage) => new("Klein", "Kunde", null, 200_000, 1_000_000, null, 0, 0, null, anlage);

    [Fact]
    public void Eine_Lizenz_fuer_diese_Anlage_gilt()
    {
        var (lic, _, grund) = LicenceFile.Aus(Json(Fuer(A)), A);
        Assert.Equal(200_000, lic.EntriesWeek);
        Assert.DoesNotContain("andere Instanz", grund ?? "");
    }

    [Fact]
    public void Nach_der_Wiederherstellung_gilt_sie_nicht_mehr()
    {
        // dieselbe Lizenz, aber die Anlage hat eine neue Kennung — genau die Fall mit den drei Instanzen
        var (lic, geprueft, grund) = LicenceFile.Aus(Json(Fuer(A)), B);
        Assert.Equal(Journali.Core.Projections.Tarife.Free.Key, lic.Plan);
        Assert.False(geprueft);
        Assert.Contains("andere Instanz", grund);
        Assert.Equal(Journali.Core.Projections.Limits.Week, lic.EntriesWeek);
    }

    [Fact]
    public void Eine_Lizenz_ohne_Kennung_gilt_weiter()
    {
        // Lizenzen von vor der Bindung sollen nicht über Nacht ungültig werden
        var (lic, _, grund) = LicenceFile.Aus(Json(Fuer(null)), A);
        Assert.Equal(200_000, lic.EntriesWeek);
        Assert.DoesNotContain("andere Instanz", grund ?? "");
    }

    [Fact]
    public void Ohne_eigene_Kennung_wird_nicht_gepruft()
    {
        // Sandbox und Tests ohne Datenbank: die Bindung greift nur, wenn beide Seiten eine Kennung haben
        var (lic, _, _) = LicenceFile.Aus(Json(Fuer(A)), null);
        Assert.Equal(200_000, lic.EntriesWeek);
    }

    [Fact]
    public void Die_Kennung_steht_im_signierten_Rumpf()
    {
        // wer sie umschreibt, macht die Signatur ungültig — darauf beruht die Bindung
        var lic = Fuer(A) with { Sig = "sig-xyz" };
        Assert.Contains(A, lic.Rumpf);
        Assert.DoesNotContain("sig-xyz", lic.Rumpf);
    }
}
