using System.Text.RegularExpressions;
using Journali.Core.Entries;

namespace Journali.Tests;

/// <summary>
/// Einheiten mit Verschiebung (30.09.2026): <c>Basis = Wert × Faktor + Verschiebung</c>. Damit rechnen auch °C, °F und K
/// ineinander um. Ältere Einträge kennen keine Verschiebung und gelten mit 0.
/// </summary>
public class EinheitTests
{
    private static readonly UnitDefinition Celsius = new("°C", Labels.Of("Grad Celsius", "degree Celsius"), "temperature", 1, 0);
    private static readonly UnitDefinition Fahrenheit = new("°F", Labels.Of("Grad Fahrenheit", "degree Fahrenheit"), "temperature", 5m / 9m, -160m / 9m);
    private static readonly UnitDefinition Kelvin = new("K", Labels.Of("Kelvin", "kelvin"), "temperature", 1, -273.15m);

    [Fact]
    public void Fahrenheit_und_Kelvin_rechnen_ueber_die_Basis_Celsius()
    {
        Assert.Equal(0m, Math.Round(Fahrenheit.ToBase(32m), 10));                    // 32 °F = 0 °C
        Assert.Equal(100m, Math.Round(Fahrenheit.ToBase(212m), 10));                 // 212 °F = 100 °C
        Assert.Equal(-273.15m, Kelvin.ToBase(0m));                                   // 0 K
        Assert.Equal(212m, Math.Round(Fahrenheit.FromBase(Celsius.ToBase(100m)), 10));
        Assert.Equal(373.15m, Math.Round(Kelvin.FromBase(100m), 10));
    }

    [Fact]
    public void Hin_und_zurueck_ergibt_den_Ausgangswert()
    {
        foreach (var u in new[] { Celsius, Fahrenheit, Kelvin })
            Assert.Equal(21.5m, Math.Round(u.FromBase(u.ToBase(21.5m)), 10));
    }

    [Fact]
    public void Ohne_Verschiebung_bleibt_es_beim_Faktor()
    {
        var gramm = new UnitDefinition("g", Labels.Of("Gramm", "gram"), "mass", 0.001m);
        Assert.Equal(0.5m, gramm.ToBase(500m));
        Assert.Equal(0m, gramm.Offset);
    }

    [Fact]
    public void Die_Verschiebung_steht_im_Eintrag_und_ein_aelterer_Eintrag_ohne_sie_gilt_mit_null()
    {
        var neu = Types.Deserialize<UnitDefinition>(Types.Serialize(Kelvin));
        Assert.Equal(-273.15m, neu.Offset);

        var alt = Regex.Replace(Types.Serialize(Celsius), "\"offset\":\\s*0(\\.0+)?,?", "", RegexOptions.IgnoreCase).Replace(",}", "}");
        Assert.DoesNotContain("offset", alt, StringComparison.OrdinalIgnoreCase);
        var gelesen = Types.Deserialize<UnitDefinition>(alt);
        Assert.Equal(0m, gelesen.Offset);
        Assert.Equal(1m, gelesen.Factor);
    }
}
