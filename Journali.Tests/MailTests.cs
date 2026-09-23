using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Mailserver (Taloan, 23.09.2026: „was wir in den Settings noch brauchen, ist eine Mailserver-Konfiguration zum
/// Versenden von Mails“). Die Einstellung liegt als Datei beim Server, nie im Journal — da steht ein Passwort drin.
/// Geprüft wird, was ohne Netz prüfbar ist: dass das Passwort nie hinausgeht, dass ein Speichern es nicht durch
/// Sternchen ersetzt, und dass ohne Einstellung nichts gesendet wird statt still zu scheitern.
/// </summary>
public class MailTests : IDisposable
{
    private readonly string _dir = Path.Combine(Path.GetTempPath(), "journali-mail-" + Guid.NewGuid().ToString("N"));
    public void Dispose() { try { Directory.Delete(_dir, true); } catch { } }

    [Fact]
    public async Task Ohne_Server_wird_nichts_gesendet_und_es_wird_gesagt()
    {
        var m = new Mailer(_dir);
        Assert.False(m.Config.Ready);
        var fehler = await m.SendAsync("wer@beispiel.de", "Betreff", "Text");
        Assert.NotNull(fehler);
        Assert.Contains("Einstellungen", fehler);
    }

    [Fact]
    public void Das_Passwort_geht_nie_hinaus()
    {
        var c = new MailConfig("smtp.beispiel.de", 587, MailConfig.StartTlsMode, "pim", "geheim", "pim@beispiel.de");
        var maskiert = c.Masked();
        Assert.NotEqual("geheim", maskiert.Password);
        Assert.Equal("smtp.beispiel.de", maskiert.Host);   // alles andere bleibt lesbar
        Assert.DoesNotContain("geheim", maskiert.Spec);
    }

    [Fact]
    public void Gespeichert_wird_beim_Server_und_kommt_zurueck()
    {
        var m = new Mailer(_dir);
        m.Set(new MailConfig("smtp.beispiel.de", 465, MailConfig.SslMode, "pim", "geheim", "pim@beispiel.de", "journali PIM"));
        Assert.True(m.Config.Ready);

        var neu = new Mailer(_dir);   // wie nach einem Neustart
        Assert.Equal("smtp.beispiel.de", neu.Config.Host);
        Assert.Equal("geheim", neu.Config.Password);
        Assert.Equal(465, neu.Config.Port);
        Assert.Equal(MailConfig.SslMode, neu.Config.Security);
        Assert.Equal(MailKit.Security.SecureSocketOptions.SslOnConnect, neu.Config.Socket);
        Assert.Contains("mail.json", MailConfigFile.PathOf(_dir));
    }

    [Fact]
    public void Ein_leeres_Passwortfeld_loescht_das_Passwort_nicht()
    {
        // die Oberfläche bekommt Punkte statt des Passworts — kämen die zurück, stünden sie danach in der Datei
        var m = new Mailer(_dir);
        m.Set(new MailConfig("smtp.beispiel.de", 587, MailConfig.StartTlsMode, "pim", "geheim", "pim@beispiel.de"));
        var vonDerOberflaeche = m.Config.Masked() with { FromName = "journali PIM" };
        var behalten = vonDerOberflaeche with { Password = vonDerOberflaeche.Password is null or "••••••••" ? m.Config.Password : vonDerOberflaeche.Password };
        m.Set(behalten);

        Assert.Equal("geheim", new Mailer(_dir).Config.Password);
        Assert.Equal("journali PIM", new Mailer(_dir).Config.FromName);
    }

    [Fact]
    public void Eine_kaputte_Datei_wirft_nicht_sondern_gilt_als_nicht_eingerichtet()
    {
        Directory.CreateDirectory(_dir);
        File.WriteAllText(MailConfigFile.PathOf(_dir), "{kein json");
        var m = new Mailer(_dir);
        Assert.False(m.Config.Ready);
    }
}
