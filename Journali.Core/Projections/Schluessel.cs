namespace Journali.Core.Projections;

/// <summary>
/// Die Rechnung hinter den Lizenzschlüsseln (Taloan, 23.09.2026). Zwei Arten, beide nur an die Instanz gebunden, beide
/// einmal einlösbar, beide kombinierbar:
/// <list type="bullet">
/// <item><c>reset</c> — das Team zählt ab dem Einlösen neu. Sofort, einmalig.</item>
/// <item><c>limit</c> — das Team bekommt für eine Dauer ein höheres Kontingent. Die Dauer beginnt beim Einlösen
/// (Schlüssel auf Vorrat verfallen nicht in der Schublade).</item>
/// </list>
/// Läuft beim Einlösen eines Limit-Schlüssels schon einer, geht nichts verloren: „ab sofort würde den Anwender um die
/// Laufzeit einer anderen Limit-Lizenz betrügen — müsste also umgerechnet werden“ (Taloan). Umgerechnet wird nach
/// <b>Restvolumen</b>: was vom laufenden übrig ist, wird in Tage des neuen umgerechnet und hinten angehängt.
/// </summary>
public static class Schluessel
{
    public const string Reset = "reset";
    public const string Limit = "limit";
    public static readonly string[] Arten = [Reset, Limit];

    /// <summary>
    /// Bis wann ein Limit-Schlüssel gilt, der heute eingelöst wird. <paramref name="laufend"/> ist der Schlüssel, der
    /// heute schon gilt (oder null). Beispiel: es laufen 30 000/Woche noch 20 Tage (heute eingeschlossen), neu kommen
    /// 50 000/Woche für 30 Tage → 20 × 30 000 / 50 000 = 12 Tage dazu → gilt 42 Tage, bis heute + 41.
    /// Aufgerundet: angefangene Tage gehören dem Team.
    /// </summary>
    public static (DateOnly Until, int Carried) Bis(DateOnly heute, int tage, int woche, int monat, LimitWindow? laufend)
    {
        var dazu = 0;
        if (laufend is not null && laufend.Until >= heute)
        {
            var rest = laufend.Until.DayNumber - heute.DayNumber + 1;   // heute gehört schon dem neuen — also mitrechnen
            // gemessen an der Woche; hat einer keine Woche, am Monat
            var (alt, neu) = woche > 0 && laufend.Week > 0 ? (laufend.Week, woche) : (laufend.Month, monat);
            if (alt > 0 && neu > 0) dazu = (int)Math.Ceiling(rest * (double)alt / neu);
        }
        return (heute.AddDays(Math.Max(1, tage) - 1 + dazu), dazu);
    }
}
