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
public sealed record Entry(
    long Number,
    DateTimeOffset At,
    string Actor,
    string Stream,
    string Type,
    string Payload);
