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

    [Fact]
    public void Angeboten_wird_nur_was_traegt()
    {
        // Eine Art, die noch nicht umgesetzt ist, steht nicht in der Liste: sonst waehlt jemand sie und bekommt
        // beim ersten Klick „ist noch nicht gebaut“ (25.09.2026). Seit 28.09.2026 hat jede Art, die Dateien liefert,
        // einen Treiber, und jede Anmeldung eine Weiterleitung
        Assert.Equal(new[] { "file", "webdav", "ftp", "ixp", "solr", "http" }, DriverApi.Arten.Select(a => a.Key));
        foreach (var a in DriverApi.Arten.Where(a => a.Dateien))
            Assert.NotNull(Treiber.Fuer(new DriverApi.Zugang("z", a.Key, "", new() { ["url"] = "https://example.invalid/", ["host"] = "example.invalid" }), new Dictionary<string, string>()));
        Assert.All(DriverApi.Arten.Where(a => !a.Dateien), a => Assert.Contains(a.Key, DriverApi.Anmeldungen));
        Assert.Null(DriverApi.ArtVon("mysql"));
    }

    [Fact]
    public void Eine_unbekannte_Art_gibt_es_nicht()
    {
        Assert.Null(DriverApi.ArtVon("gibtsnicht"));
        Assert.Null(DriverApi.ArtVon(""));
        Assert.Null(DriverApi.ArtVon(null));
    }

    [Fact]
    public void Ein_Geheimnis_steht_nie_unter_den_offenen_Feldern()
    {
        // Die offenen Felder gehen ins Journal, das Geheimnis zum Server. Gilt fuer jede Art, die je dazukommt
        Assert.All(DriverApi.Arten, a => Assert.Empty(a.Felder.Intersect(a.Geheim)));
    }
}
