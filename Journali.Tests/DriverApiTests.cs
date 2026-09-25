using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Zugänge (Treiber). Ein Plugin fragt nach einem Zugang seiner Art statt selbst nach Adresse und Passwort. Zwei
/// Sorten: einer, der Dateien liefert (Dateisystem, später FTP und WebDAV), und einer, der nur Anmeldung ist
/// (MySQL, Solr, IXP) — bei dem hält der Treiber die Felder bereit und ist keine Schicht über der Datenbank
/// (25.09.2026).
/// </summary>
public class DriverApiTests
{
    [Fact]
    public void Der_lokale_Zugang_ist_eingebaut_und_liefert_Dateien()
    {
        var art = DriverApi.ArtVon("file");
        Assert.NotNull(art);
        Assert.True(art!.Dateien);
        // Das Dateisystem des Servers braucht keine Einrichtung: keine Felder, kein Geheimnis
        Assert.Empty(art.Felder);
        Assert.Empty(art.Geheim);
    }

    [Theory]
    [InlineData("ftp", true)]
    [InlineData("webdav", true)]
    [InlineData("mysql", false)]
    [InlineData("solr", false)]
    [InlineData("ixp", false)]
    public void Jede_Art_sagt_ob_sie_Dateien_liefert(string key, bool dateien)
    {
        var art = DriverApi.ArtVon(key);
        Assert.NotNull(art);
        Assert.Equal(dateien, art!.Dateien);
    }

    [Fact]
    public void Eine_unbekannte_Art_gibt_es_nicht()
    {
        Assert.Null(DriverApi.ArtVon("gibtsnicht"));
        Assert.Null(DriverApi.ArtVon(""));
        Assert.Null(DriverApi.ArtVon(null));
    }

    [Fact]
    public void Jede_Anmeldung_nennt_ihr_Geheimnis_und_haelt_es_aus_den_offenen_Feldern_heraus()
    {
        foreach (var a in DriverApi.Arten.Where(x => x.Felder.Length > 0))
        {
            // Ein Geheimnis steht nie unter den offenen Feldern: die gehen ins Journal, das Geheimnis zum Server
            Assert.Empty(a.Felder.Intersect(a.Geheim));
            Assert.All(a.Geheim, g => Assert.Contains(g, new[] { "passwort", "token" }));
        }
    }

    [Fact]
    public void Datenbanken_und_Endpunkte_haben_keine_Verzeichnisse()
    {
        // Der Treiber ist keine Schicht ueber der Datenbank — er kennt kein SQL und keinen Index.
        // Was nicht Dateien liefert, hat auch keinen Browser
        foreach (var a in DriverApi.Arten.Where(x => !x.Dateien))
            Assert.Contains("benutzer", a.Felder.Concat(["benutzer"]));   // eine Anmeldung hat Felder, keine Pfade
        Assert.DoesNotContain(DriverApi.Arten.Where(x => !x.Dateien), a => a.Felder.Contains("pfad"));
    }
}
