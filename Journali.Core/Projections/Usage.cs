using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>
/// Nutzung: wie viele Einträge an welchem Tag ins Journal gingen (Taloan, 22.09.2026: „zeige mir in den Einstellungen
/// einen Fortschrittsbalken — täglich, wöchentlich, monatlich“). Gezählt wird, was geschrieben wird; Lesen und
/// Exportieren kosten nichts (die Endpunkte schreiben nicht). Woche und Monat werden aus den Tagen gerechnet, die
/// Historie steht damit von selbst da — auch rückwirkend für ein bestehendes Journal, ohne einen einzigen eigenen
/// Eintrag. Der Tag ist die Ortszeit des Servers, die Woche beginnt am Montag.
/// </summary>
public sealed class Usage : IProjection
{
    /// <summary>
    /// Das Tagesgeschäft: Import, Datenpflege, Ausleitung — was ein PIM täglich leistet und was regelmässig und
    /// berechenbar anfällt (Taloan, 22.09.2026). Eine Positivliste: was hier nicht steht, zählt nicht. Damit kostet
    /// weder ein neuer Eintragstyp ungefragt etwas noch eine Arbeit, die keine Leistung am Datenbestand ist.
    /// <para>Draussen bleiben bewusst: <b>Datenmodellierung</b> (Attribute, Gruppen, Sichten, Listen, Sprachen,
    /// Kanäle, Status, Relationstypen, Workflows samt Designer, Einheiten, Wörterbuch), <b>Struktur</b> (Baum anlegen,
    /// umhängen, umbenennen, ordnen, Gruppen und Achsen festlegen), der <b>Aufbau des Publikationsbaums</b> (Rubriken anlegen,
    /// Produkte einsortieren, umhängen, Regeln, Stand) — Werte pflegen zählt dort aber sehr wohl, auch an einer Rubrik
    /// (Taloan, 22.09.2026: „jemand aktualisiert die Werte der Produkte im Pub-Baum → zählt“) —, die <b>Klassenzuweisung</b>
    /// (<c>CategoryAssigned</c>, z. B. eine ETIM-Klasse), <b>Referenzdaten von aussen</b> (<c>PluginDataSet</c> eines
    /// Katalogs, dessen Wertelisten) und <b>Einrichtung und Betrieb</b> (Plugins, Jobs mit ihrem Protokoll, gerechnete
    /// Vorschauen, Benutzer, Rollen). Taloans Fälle vom 22.09.2026: ETIM-Klasse zuweisen und die Attribute dafür anlegen
    /// zählen nicht, ein SAP-Import mit 50 000 Zeilen × 200 Spalten zählt, Publikationsbaum bauen zählt nicht, den
    /// Workflow-Designer bearbeiten zählt nicht, einen Workflow-Zustand setzen zählt.</para>
    /// </summary>
    public static readonly IReadOnlySet<string> Work = new HashSet<string>
    {
        // Datenpflege: Werte, Belege, Zeilen
        Types.AttributeSet, Types.ValueSourced, Types.RowAdded, Types.RowRemoved, Types.RowOrdered,
        // Bestand: Artikel und Varianten kommen und gehen
        Types.ProductCreated, Types.VariantCreated, Types.NodeRetired, Types.NodeRestored, Types.StatusSet,
        Types.ExternalLinked, Types.ExternalUnlinked,
        // Medien am Artikel (die gerechneten Vorschauen nicht — die macht der Job)
        Types.MediaCreated, Types.MediaRetired, Types.MediaFiled,
        // Beziehungen zwischen Artikeln
        Types.RelationCreated, Types.RelationRetired,
        // Ausleitung: Freigabe und Versionen (der Publikationsbaum selbst ist Struktur und zählt nicht)
        Types.ReleaseGranted, Types.ReleaseRevoked,
        Types.VersionCreated, Types.VersionDocumentAdded, Types.VersionWithdrawn,
        // Redaktion: Workflow und Übersetzung
        Types.WorkflowStateSet, Types.WorkflowAssigned, Types.TranslationMarked, Types.TranslationOrdered, Types.TranslationReturned,
    };

    public long LastApplied { get; private set; }

    /// <summary>Tagesgeschäft je Tag (Ortszeit) — das, was zählt.</summary>
    public Dictionary<DateOnly, int> PerDay { get; } = new();
    /// <summary>Alle Einträge je Tag, auch Modell, Struktur, Kataloge und Betrieb — zum Vergleich in der Anzeige.</summary>
    public Dictionary<DateOnly, int> AllPerDay { get; } = new();

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        var day = DateOnly.FromDateTime(entry.At.ToLocalTime().DateTime);
        AllPerDay[day] = AllPerDay.GetValueOrDefault(day) + 1;
        if (!Work.Contains(entry.Type)) return;
        PerDay[day] = PerDay.GetValueOrDefault(day) + 1;
    }

    public IEnumerable<KeyValuePair<DateOnly, int>> Days => PerDay.OrderBy(p => p.Key);

    /// <summary>Montag der Woche, in der <paramref name="d"/> liegt.</summary>
    public static DateOnly WeekStart(DateOnly d) => d.AddDays(-(((int)d.DayOfWeek + 6) % 7));
    public static DateOnly MonthStart(DateOnly d) => new(d.Year, d.Month, 1);

    /// <summary>Summe von <paramref name="from"/> bis einschliesslich <paramref name="to"/>; <paramref name="all"/> nimmt alles statt nur das Tagesgeschäft.</summary>
    public int Between(DateOnly from, DateOnly to, bool all = false)
    {
        var n = 0;
        foreach (var (d, c) in (all ? AllPerDay : PerDay)) if (d >= from && d <= to) n += c;
        return n;
    }

    public int Day(DateOnly d, bool all = false) => (all ? AllPerDay : PerDay).GetValueOrDefault(d);
    public int Week(DateOnly d, bool all = false) => Between(WeekStart(d), d, all);
    public int Month(DateOnly d, bool all = false) => Between(MonthStart(d), d, all);

    /// <summary>Abgeschlossene Perioden für den Verlauf: je Tag, Woche oder Monat eine Zeile (neueste zuerst).</summary>
    public IEnumerable<(DateOnly Start, int Count, int All)> History(string period, DateOnly today, int limit = 90)
    {
        DateOnly Key(DateOnly d) => period switch { "week" => WeekStart(d), "month" => MonthStart(d), _ => d };
        var work = new Dictionary<DateOnly, int>();
        var all = new Dictionary<DateOnly, int>();
        foreach (var (d, c) in PerDay) work[Key(d)] = work.GetValueOrDefault(Key(d)) + c;
        foreach (var (d, c) in AllPerDay) all[Key(d)] = all.GetValueOrDefault(Key(d)) + c;
        return all.OrderByDescending(g => g.Key).Take(limit).Select(g => (g.Key, work.GetValueOrDefault(g.Key), g.Value));
    }
}

/// <summary>
/// Die Grenzen: Woche und Monat (Taloan, 22.09.2026). <b>Kein Tageslimit</b> — „macht man 3 Testimporte und muss
/// aufhören“; der Tag wird gezählt und im Verlauf gezeigt, begrenzt wird er nicht. Vorerst Annahmen zum Messen,
/// was eine Einzelperson wirklich braucht — keine Lizenz, keine Sperre.
/// </summary>
public static class Limits
{
    public const int Week = 20_000;
    public const int Month = 100_000;
}
