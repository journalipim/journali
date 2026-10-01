using Journali.Core.Projections;

namespace Journali.Tests;

// Der Stempel des Schnappschusses. Bis dahin war es die ModuleVersionId des Kerns — mit dem Git-Commit darin
// fiel der Schnappschuss bei jedem Commit. Gemessen beim Bau (vier Bauten des Kerns): anderer Commit → gleicher Stempel,
// nur ein Kommentar → gleicher Stempel, eine Konstante geändert → anderer Stempel.
public class FingerabdruckTests
{
    [Fact]
    public void Der_Stempel_ist_der_Fingerabdruck_der_Kern_Logik()
    {
        var kern = typeof(Snapshot).Assembly;
        Assert.Equal(Fingerabdruck.Von(kern), Snapshot.Stamp);
        Assert.Matches("^[0-9a-f]{64}$", Snapshot.Stamp);
        Assert.Equal(Fingerabdruck.Von(kern), Fingerabdruck.Von(kern));        // derselbe Kern, derselbe Abdruck
    }

    [Fact]
    public void Der_Git_Commit_geht_nicht_ein()
    {
        // die InformationalVersion trägt den Commit (1.0.0+…) — sie ist kein Code und kein Feld, also nicht im Abdruck
        var info = typeof(Snapshot).Assembly.GetCustomAttributes(typeof(System.Reflection.AssemblyInformationalVersionAttribute), false);
        Assert.NotEmpty(info);
        Assert.NotEqual(typeof(Snapshot).Assembly.ManifestModule.ModuleVersionId.ToString("N"), Snapshot.Stamp);
    }

    [Fact]
    public void Anderer_Code_anderer_Abdruck()
    {
        Assert.NotEqual(Fingerabdruck.Von(typeof(Snapshot).Assembly), Fingerabdruck.Von(typeof(FingerabdruckTests).Assembly));
    }
}
