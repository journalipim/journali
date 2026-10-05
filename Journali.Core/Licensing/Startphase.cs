namespace Journali.Core.Licensing;

/// <summary>
/// Die Startphase (05.10.2026): journali gibt es ohne Grenzen. Solange sie gilt,
/// <list type="bullet">
/// <item>hat jedes Team den Tarif Unlimited, und kein Eintrag wird wegen eines Kontingents abgewiesen,</item>
/// <item>läuft auf einer Datenbank genau ein Server (kein Multi-Server),</item>
/// <item>fragt kein Server den Lizenzserver — weder nach Abo noch nach Tarifblatt oder Registrierung,</item>
/// <item>zeigt die Oberfläche nichts zu Lizenz, Limits und journali-Token.</item>
/// </list>
/// Die Lizenzfunktionen bleiben im Code; eine spätere Version schaltet sie mit diesem Schalter wieder ein. Grenzen gelten dann
/// nur für diese neue Version. Der Server setzt den Schalter beim Start (Program.cs), nicht über die Umgebung; die Tests prüfen die
/// Lizenzfunktionen ohne ihn und die Startphase ausdrücklich mit ihm.
/// </summary>
public static class Startphase
{
    /// <summary>Gilt die Startphase? Vorgabe aus: so prüfen die Tests die Lizenzfunktionen. Der Server schaltet sie beim Start ein.</summary>
    public static bool An { get; set; }
}
