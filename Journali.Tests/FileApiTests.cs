using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Der Dateibrowser legt Verzeichnisse an und benennt sie um — mehr nicht. Ein Name darf kein Pfad sein und keine
/// Zeichen enthalten, die ein Dateisystem nicht nimmt; sonst schöbe ein Name wie „..\andere“ das Verzeichnis woanders hin.
/// Die Liste gilt auf jedem System gleich, auch wo das Dateisystem mehr erlaubt.
/// </summary>
public class FileApiTests
{
    [Theory]
    [InlineData("Sicherung 2026", "Sicherung 2026")]
    [InlineData("  export  ", "export")]
    [InlineData("a.b.c", "a.b.c")]
    public void Ein_gewoehnlicher_Name_geht_durch(string ein, string erwartet) => Assert.Equal(erwartet, FileApi.Name(ein));

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(".")]
    [InlineData("..")]
    [InlineData("../andere")]
    [InlineData("..\\andere")]
    [InlineData("unter\u0007ordner")]
    [InlineData("unter/ordner")]
    [InlineData("C:")]
    [InlineData("was?")]
    [InlineData("stern*")]
    [InlineData("zoll\"")]
    [InlineData(null)]
    public void Ein_Pfad_oder_Sonderzeichen_nicht(string? ein) => Assert.Null(FileApi.Name(ein));

    [Fact]
    public void Auch_kein_sehr_langer_Name() => Assert.Null(FileApi.Name(new string('a', 121)));
}
