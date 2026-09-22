namespace Journali.Core.Journal;

/// <summary>
/// Ein Eintrag im Journal. Einträge werden nur angehängt, nie geändert,
/// nie gelöscht — ein Löschen ist selbst ein Eintrag.
/// </summary>
/// <param name="Number">Laufende Nummer, lückenlos, beginnt bei 1. Abnehmer merken sich „zuletzt gelesen".</param>
/// <param name="At">Zeitpunkt des Anhängens.</param>
/// <param name="Actor">Wer den Eintrag verursacht hat (Nutzer, Import, System).</param>
/// <param name="Stream">Wozu der Eintrag gehört, z. B. die SKU eines Produkts. Ein Strom je Ding.</param>
/// <param name="Type">Art des Eintrags, z. B. <c>AttributeSet</c>, <c>ReleaseGranted</c>.</param>
/// <param name="Payload">Nutzdaten als JSON. Die Form hängt von <see cref="Type"/> ab.</param>
/// <param name="Batch">Stapelkennung: alle Einträge einer Aktion (Import, Einfügen aus Excel) tragen dieselbe — Rückgängig je Aktion.</param>
/// <param name="Kind">Art der Arbeit (<c>model</c>, <c>structure</c>, <c>data</c>, <c>publish</c>, <c>reference</c>, <c>setup</c>, <c>ops</c>;
/// Taloan, 22.09.2026). Ein Fakt, kein Preis — ob eine Art zählt, sagt der Tarif und darf sich ändern. Wer schreibt, darf sie
/// mitgeben; fehlt sie (so auch bei allen Einträgen von vor dieser Spalte), leitet <c>Kinds.Of(Type)</c> sie aus dem Typ ab.</param>
public sealed record Entry(
    long Number,
    DateTimeOffset At,
    string Actor,
    string Stream,
    string Type,
    string Payload,
    string? Batch = null,
    string? Kind = null);
