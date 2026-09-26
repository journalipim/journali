namespace Journali.Tests;

/// <summary>
/// Was beim Start des Servers gelten muss, geprüft an der Quelle von <c>Program.cs</c> — die Tests starten die App nicht.
/// </summary>
public class StartTests
{
    private static string Program() =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Journali.Server", "Program.cs"));

    /// <summary>
    /// Am 26.09.2026 brach der Start ab („Unable to resolve service for type ICorsService“): <c>app.UseCors()</c> läuft in
    /// jeder Umgebung, <c>AddCors</c> stand hinter <c>if (IsDevelopment())</c> — ohne launchSettings.json (Development)
    /// und im Paket fehlte der Dienst.
    /// </summary>
    [Fact]
    public void Cors_ist_in_jeder_Umgebung_registriert()
    {
        var zeilen = Program().Split('\n').Select(z => z.TrimEnd('\r')).ToList();
        if (!zeilen.Any(z => z.Contains("app.UseCors(")) ) return;
        var i = zeilen.FindIndex(z => z.Contains("builder.Services.AddCors("));
        Assert.True(i >= 0, "UseCors ohne AddCors");
        Assert.StartsWith("builder.Services.AddCors(", zeilen[i]);                       // nicht eingerückt: keine Bedingung davor
        Assert.DoesNotContain("IsDevelopment", zeilen[i - 1]);
    }
}
