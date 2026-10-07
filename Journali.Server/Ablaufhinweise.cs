using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Erinnerung vor dem Ablauf (07.10.2026): für einen passenden Tarif und das rechtzeitige Verlängern sorgt der Betreiber (Nutzungsbedingungen);
/// journali sagt es ihm vorher. <see cref="Vorlauf"/> Tage vor dem Ende eines Tests, einer Lizenz, eines Schlüssels mit fester Laufzeit oder
/// eines Abos, das sich nicht von selbst verlängert (gekündigt, Zahlung offen, von Hand verlängert), steht ein Hinweis in der Kopfzeile — für die,
/// die das Team führen, und für die Verwaltung. Ein laufendes Abo (active, on_trial) verlängert sich selbst und löst keinen Hinweis aus.
/// In der Startphase gibt es keine Grenzen und darum nichts zu erinnern.
/// </summary>
public static class Ablaufhinweise
{
    public const int Vorlauf = 14;

    /// <param name="Was">test · lizenz · abo · schluessel</param>
    /// <param name="Team">null: die Instanz (Test, Lizenz)</param>
    public sealed record Ablauf(string Was, string? Team, string? TeamLabel, string Tarif, DateOnly Am, int Tage);

    /// <summary>Was in den nächsten <see cref="Vorlauf"/> Tagen endet, das Nächste zuerst.</summary>
    public static List<Ablauf> Bald(Licence roh, bool geprueft, IEnumerable<TeamState> teams, Tarifliste liste, DateOnly heute)
    {
        var aus = new List<Ablauf>();
        bool Bald(DateOnly d) => d >= heute && d <= heute.AddDays(Vorlauf);
        if (geprueft && roh.ValidUntil is { } lb && Bald(lb))
            aus.Add(new(roh.Trial == true ? "test" : "lizenz", null, null, roh.TarifIn(liste).Label, lb, lb.DayNumber - heute.DayNumber));
        foreach (var t in teams)
        {
            if (t.Abo is { Geprueft: true } a && a.Status is not ("active" or "on_trial") && Bald(a.PaidUntil))
                aus.Add(new("abo", t.Key, t.Label, liste.Von(a.Plan)?.Label ?? a.Plan, a.PaidUntil, a.PaidUntil.DayNumber - heute.DayNumber));
            foreach (var w in t.Windows.Where(w => w.Gilt(heute) && Bald(w.Until)))
                aus.Add(new("schluessel", t.Key, t.Label, w.Plan is { } p ? liste.Von(p)?.Label ?? p : "", w.Until, w.Until.DayNumber - heute.DayNumber));
        }
        return aus.OrderBy(x => x.Am).ToList();
    }
}
