using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Server;
using Journali.Core.Projections;

namespace Journali.Tests;

// Nutzung je Tag, Woche, Monat.
// Gezählt wird jeder Journaleintrag — Lesen und Exportieren erzeugen keine, also kosten sie nichts.
public class UsageTests
{
    private static Entry E(long n, DateTimeOffset at) => new(n, at, "t", "x", Types.AttributeSet, "{}");
    private static DateTimeOffset Local(int y, int m, int d, int h = 12) => new DateTimeOffset(new DateTime(y, m, d, h, 0, 0, DateTimeKind.Local));

    [Fact]
    public void Zaehlt_je_Tag_und_rechnet_Woche_und_Monat_daraus()
    {
        var u = new Usage();
        // Dienstag 22.09.2026 dreimal, Montag davor einmal, im Vormonat einmal
        long n = 0;
        foreach (var _ in Enumerable.Range(0, 3)) u.Apply(E(++n, Local(2026, 9, 22)));
        u.Apply(E(++n, Local(2026, 9, 21)));
        u.Apply(E(++n, Local(2026, 8, 31)));

        var heute = new DateOnly(2026, 9, 22);
        Assert.Equal(3, u.Day(heute));
        Assert.Equal(4, u.Week(heute));    // Montag 21. und Dienstag 22.
        Assert.Equal(4, u.Month(heute));   // der 31.08. gehört in den Vormonat
        Assert.Equal(5, u.LastApplied);
    }

    [Fact]
    public void Woche_beginnt_am_Montag_auch_am_Sonntag()
    {
        // Sonntag, 27.09.2026 — die Woche reicht zurück bis Montag, 21.09.
        Assert.Equal(new DateOnly(2026, 9, 21), Usage.WeekStart(new DateOnly(2026, 9, 27)));
        Assert.Equal(new DateOnly(2026, 9, 21), Usage.WeekStart(new DateOnly(2026, 9, 21)));
        Assert.Equal(new DateOnly(2026, 9, 1), Usage.MonthStart(new DateOnly(2026, 9, 27)));
    }

    [Fact]
    public void Verlauf_fasst_zusammen_neueste_zuerst()
    {
        var u = new Usage();
        long n = 0;
        u.Apply(E(++n, Local(2026, 9, 22))); u.Apply(E(++n, Local(2026, 9, 22)));
        u.Apply(E(++n, Local(2026, 9, 15)));
        u.Apply(E(++n, Local(2026, 8, 3)));

        var tage = u.History("day", new DateOnly(2026, 9, 22)).ToList();
        Assert.Equal(new DateOnly(2026, 9, 22), tage[0].Start);
        Assert.Equal(2, tage[0].Count);
        Assert.Equal(3, tage.Count);

        var wochen = u.History("week", new DateOnly(2026, 9, 22)).ToList();
        Assert.Equal(new DateOnly(2026, 9, 21), wochen[0].Start);
        Assert.Equal(2, wochen[0].Count);

        var monate = u.History("month", new DateOnly(2026, 9, 22)).ToList();
        Assert.Equal(new DateOnly(2026, 9, 1), monate[0].Start);
        Assert.Equal(3, monate[0].Count);
        Assert.Equal(1, monate[1].Count);
    }

    [Fact]
    public void Aus_dem_Journal_gebaut_zaehlt_jeder_Eintrag_genau_einmal()
    {
        var j = new MemoryJournal();
        foreach (var s in Model.Seeds()) j.Append("system", s.Stream, s.Type, s.Payload);
        var u = new Usage();
        Projector.CatchUp(j, u);
        var heute = DateOnly.FromDateTime(DateTime.Now);
        Assert.Equal(Model.Seeds().Count(), u.Day(heute, all: true));
        Assert.Equal(u.LastApplied, u.AllPerDay.Values.Sum());
        Assert.Equal(0, u.Day(heute));   // die Saat ist Modell — kein Tagesgeschäft

        // zweimal nachlaufen zählt nicht doppelt
        Projector.CatchUp(j, u);
        Assert.Equal(Model.Seeds().Count(), u.Day(heute, all: true));
    }

    [Fact]
    public void Betriebsspur_der_Jobs_zaehlt_nicht_mit()
    {
        var u = new Usage();
        long n = 0;
        var at = Local(2026, 9, 22);
        u.Apply(new Entry(++n, at, "job", "job:backup", Types.JobRunStarted, "{}"));
        u.Apply(new Entry(++n, at, "job", "job:backup", Types.JobFileWritten, "{}"));
        u.Apply(new Entry(++n, at, "job", "job:backup", Types.JobRunFinished, "{}"));
        Assert.Equal(0, u.Day(new DateOnly(2026, 9, 22)));   // Sicherung kostet nichts
        Assert.Equal(3, u.LastApplied);                       // gelesen hat das Abbild sie trotzdem

        // was der Job an Daten schreibt, zählt: ein Import setzt Werte
        u.Apply(new Entry(++n, at, "job", "v-1", Types.AttributeSet, "{}"));
        Assert.Equal(1, u.Day(new DateOnly(2026, 9, 22)));
    }

    // die Fälle vom 22.09.2026, einer nach dem anderen — so steht die Rechnung, bevor ein Preis daran hängt
    [Theory]
    [InlineData(Types.CategoryAssigned, "p-1", false)]      // ETIM-Klasse zuweisen
    [InlineData(Types.AttributeDefined, "attribute:ef1", false)]  // die Attribute dafür anlegen
    [InlineData(Types.AttributeSet, "v-1", true)]           // ERP-Import: 50 000 Zeilen × 200 Spalten — jeder Wert
    [InlineData(Types.VariantCreated, "v-1", true)]         // … und die Artikel, die dabei entstehen
    [InlineData(Types.AttributeSet, "p-1", true)]           // einen Wert ändern
    [InlineData(Types.RubricCreated, "k-1", false)]         // Publikationsbaum anlegen
    [InlineData(Types.NodePlaced, "k-1", false)]            // Produkte einsortieren und umhängen
    [InlineData(Types.AttributeSet, "k-1", true)]           // Werte im Publikationsbaum pflegen zählt — auch an der Rubrik
    [InlineData(Types.WorkflowDefined, "workflow:review", false)]  // den Designer bearbeiten
    [InlineData(Types.WorkflowStateSet, "v-1", true)]       // einen Workflow-Zustand setzen
    [InlineData(Types.PluginDataSet, "plugin:etim", false)] // Referenzdaten von aussen
    [InlineData(Types.ListValueDefined, "list:etim_class", false)]
    [InlineData(Types.GroupCreated, "g-1", false)]          // Baum anlegen und strukturieren
    [InlineData(Types.NodeMoved, "p-1", false)]
    [InlineData(Types.JobRunStarted, "job:backup", false)]  // Sicherung
    [InlineData(Types.ReleaseGranted, "v-1", true)]         // Ausleitung: Freigabe für einen Kanal
    [InlineData(Types.MediaCreated, "m-1", true)]           // ein Bild kommt herein
    [InlineData(Types.MediaDerived, "m-1", false)]          // die gerechnete Vorschau macht der Job
    public void Zaehlt_nur_das_Tagesgeschaeft(string type, string stream, bool zaehlt)
    {
        var u = new Usage();
        var tag = new DateOnly(2026, 9, 22);
        // ohne Art im Eintrag (alles von vor der Spalte kind) entscheidet der Typ
        u.Apply(new Entry(1, Local(2026, 9, 22), "t", stream, type, "{}"));
        Assert.Equal(zaehlt ? 1 : 0, u.Day(tag));
        Assert.Equal(1, u.Day(tag, all: true));   // gezählt wird alles, nur berechnet nicht
    }

    [Fact]
    public void Die_Art_im_Eintrag_schlaegt_die_Ableitung_aus_dem_Typ()
    {
        var u = new Usage();
        var tag = new DateOnly(2026, 9, 22);
        // ein Plugin schreibt Pflegedaten und sagt das auch — sonst wäre PluginDataSet Referenzmaterial
        u.Apply(new Entry(1, Local(2026, 9, 22), "t", "plugin:enrich", Types.PluginDataSet, "{}", null, Kinds.Data));
        Assert.Equal(1, u.Day(tag));
        // und umgekehrt: ein Katalogimport, der Werte schreibt, kann sich als Referenz ausweisen
        u.Apply(new Entry(2, Local(2026, 9, 22), "t", "v-1", Types.AttributeSet, "{}", null, Kinds.Reference));
        Assert.Equal(1, u.Day(tag));
        Assert.Equal(2, u.Day(tag, all: true));
    }

    [Theory]
    [InlineData(Types.AttributeSet, Kinds.Data)]
    [InlineData(Types.ReleaseGranted, Kinds.Publish)]
    [InlineData(Types.AttributeDefined, Kinds.Model)]
    [InlineData(Types.WorkflowDefined, Kinds.Model)]
    [InlineData(Types.GroupCreated, Kinds.Structure)]
    [InlineData(Types.NodePlaced, Kinds.Structure)]
    [InlineData(Types.CategoryAssigned, Kinds.Structure)]
    [InlineData(Types.PluginDataSet, Kinds.Reference)]
    [InlineData(Types.ListValueDefined, Kinds.Reference)]
    [InlineData(Types.PluginInstalled, Kinds.Setup)]
    [InlineData(Types.JobRunStarted, Kinds.Ops)]
    [InlineData(Types.MediaDerived, Kinds.Ops)]
    [InlineData("EinTypDenEsNochNichtGibt", Kinds.Model)]   // neue Typen zählen nie ungefragt
    public void Art_aus_dem_Typ(string type, string kind) => Assert.Equal(kind, Kinds.Of(type));

    [Fact]
    public void Das_Journal_schreibt_die_Art_mit()
    {
        var j = new MemoryJournal();
        var e = j.Append("t", "v-1", Types.AttributeSet, "{}");
        Assert.Equal(Kinds.Data, e.Kind);
        var own = j.Append("t", "plugin:enrich", Types.PluginDataSet, "{}", null, Kinds.Data);
        Assert.Equal(Kinds.Data, own.Kind);   // wer schreibt, darf die Art mitgeben
        var many = j.AppendMany("t", [("g-1", Types.GroupCreated, "{}"), ("v-1", Types.AttributeSet, "{}")]);
        Assert.Equal([Kinds.Structure, Kinds.Data], many.Select(x => x.Kind).ToArray());
    }

    [Fact]
    public void Grenzen_sind_Woche_und_Monat_kein_Tag()
    {
        // ohne Lizenz gelten diese Werte
        Assert.Equal(10_000, Limits.Week);        // Tarif Kostenlos
        Assert.Equal(50_000, Limits.Month);
        Assert.Equal(Limits.Week, Licence.Frei.TarifIn(Tarife.Saat).Week);
        Assert.Equal(Limits.Month, Licence.Frei.TarifIn(Tarife.Saat).Month);
        Assert.Equal(0, Licence.Frei.AiTokensMonth);   // kein Grundrauschen ohne Lizenz
        // Kein Tageslimit — sonst steht man nach drei Testimporten still
    }
}
