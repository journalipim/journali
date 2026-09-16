using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>
/// Ein Abbild: liest das Journal und baut daraus einen Zustand für einen
/// Zweck — Pflege-Tabelle, Suchindex, Datenstore je Kanal. Ein Abbild
/// darf jederzeit gelöscht und aus dem Journal neu gebaut werden.
/// </summary>
public interface IProjection
{
    /// <summary>Nummer des zuletzt verarbeiteten Eintrags; 0, wenn noch keiner.</summary>
    long LastApplied { get; }

    /// <summary>
    /// Verarbeitet einen Eintrag. Wird in Journal-Reihenfolge aufgerufen,
    /// jeder Eintrag genau einmal. Einträge, die das Abbild nicht
    /// betreffen, ignoriert es — aber <see cref="LastApplied"/> rückt trotzdem vor.
    /// </summary>
    void Apply(Entry entry);
}
