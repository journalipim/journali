using Journali.Core.Entries;
using Journali.Server;
using Microsoft.AspNetCore.Http;

namespace Journali.Tests;

/// <summary>
/// Sicherheit (07.10.2026): HTML-Werte ohne Skript, den Prozess eines Plugins startet nur, wer Jobs darf, Dateien, die als Seite laufen würden,
/// gehen als Anhang hinaus.
/// </summary>
public class SicherheitTests
{
    [Theory]
    [InlineData("<p>Strahler <b>breit</b></p>", false)]
    [InlineData("<a href=\"https://beispiel.example\">mehr</a>", false)]
    [InlineData("<ul><li>Eins</li></ul>", false)]
    [InlineData("Die Funktion onload ist hier ein Wort", false)]
    [InlineData("<script>x()</script>", true)]
    [InlineData("<img src=x onerror=x()>", true)]
    [InlineData("<a href=\"javascript:x()\">a</a>", true)]
    [InlineData("<a href=\"&#106;avascript:x()\">a</a>", true)]   // auch als Zeichenreferenz
    [InlineData("<iframe src=\"/\"></iframe>", true)]
    [InlineData("<svg><circle/></svg>", true)]
    [InlineData("<div style=\"x\" onmouseover='x()'>a</div>", true)]
    public void HTML_mit_Skript_ist_unsicher(string html, bool unsicher) => Assert.Equal(unsicher, HtmlPruefung.Unsicher(html));

    [Fact]
    public void Den_Prozess_eines_Plugins_startet_nur_wer_Jobs_darf()
    {
        var ctx = new DefaultHttpContext(); ctx.Request.Method = "POST"; ctx.Request.Path = "/api/plugins/backup/run";
        Assert.Equal(Rights.Jobs, Auth.Needed(ctx.Request));
        ctx.Request.Path = "/api/plugins/etim/data/settings"; ctx.Request.Method = "PUT";
        Assert.Equal(Rights.Write, Auth.Needed(ctx.Request));   // Plugin-Daten bleiben Pflege
    }

    [Theory]
    [InlineData("image/svg+xml", "logo.svg", true)]
    [InlineData("text/html", "blatt.html", true)]
    [InlineData("application/octet-stream", "seite.htm", true)]
    [InlineData("application/xml", "daten.xml", true)]
    [InlineData("image/png", "bild.png", false)]
    [InlineData("application/pdf", "blatt.pdf", false)]
    public void Was_als_Seite_liefe_geht_als_Anhang(string mime, string name, bool anhang) => Assert.Equal(anhang, MediaApi.AlsSeiteGefaehrlich(mime, name));
}
