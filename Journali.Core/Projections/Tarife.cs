namespace Journali.Core.Projections;

/// <summary>Ein Tarif: Grenzen je Woche und Monat, wie viele Publikationsbäume, welche Plugins (null = alle).</summary>
/// <param name="Server">Wie viele Server auf einer Datenbank laufen dürfen (04.10.2026); <see cref="Tarife.Ohne"/> = beliebig viele.</param>
public sealed record Tarif(string Key, string Label, int Rang, int Week, int Month, int PubTrees, IReadOnlySet<string>? Plugins, int Server = 1)
{
    /// <summary>Enthält dieser Tarif das Plugin? Ein Systemjob (<see cref="Tarife.Systemjobs"/>) immer.</summary>
    public bool Erlaubt(string plugin) => Tarife.Systemjobs.Contains(plugin) || Plugins is null || Plugins.Contains(plugin);
    public bool Unbegrenzt => Week == Tarife.Ohne && Month == Tarife.Ohne;
    /// <summary>Laufen Jobs nach einem Zeitplan? Ab Pro. Kostenlos startet sie von Hand — die Arbeit machen sie gleich,
    /// nur eben dann, wenn jemand darauf drückt.</summary>
    public bool Zeitplan => Rang > 0;
}

/// <summary>
/// Die Tarife, die in dieser Instanz gelten — aus dem Tarifblatt des Lizenzservers, das als <c>TarifeReceived</c> im Journal
/// steht (<see cref="Teams.Tarife"/>). Ohne Blatt gilt das Saatgut <see cref="Tarife.Saat"/>. So ändern sich Grenzen,
/// Plugins, Publikationsbäume und der Test ohne neues Image (25.09.2026).
/// </summary>
public sealed class Tarifliste
{
    private readonly string _testTarif;

    public Tarifliste(long version, IEnumerable<Tarif> tarife, string testTarif, int testMonate, string? kauf = null,
        IEnumerable<Licensing.RabattZeile>? rabatte = null)
    {
        Version = version;
        Alle = [.. tarife.OrderBy(x => x.Rang)];
        _testTarif = testTarif;
        TestMonate = testMonate;
        Kauf = kauf;
        Rabatte = [.. rabatte ?? []];
    }

    /// <summary>Version des Tarifblatts — 0 für das Saatgut.</summary>
    public long Version { get; }
    /// <summary>Alle Tarife, nach Rang aufsteigend.</summary>
    public IReadOnlyList<Tarif> Alle { get; }
    /// <summary>So lange gilt der Test einer neuen Instanz, gezählt ab dem ersten Eintrag im Journal.</summary>
    public int TestMonate { get; }
    /// <summary>Die Adresse des Shops — eine für alle Tarife; null, wenn das Blatt keine nennt.</summary>
    public string? Kauf { get; }
    /// <summary>Die Aktionen des Shops: Code, Satz, bis wann.</summary>
    public IReadOnlyList<Licensing.RabattZeile> Rabatte { get; }

    /// <summary>Die Aktionen, die an diesem Tag gelten.</summary>
    public IReadOnlyList<Licensing.RabattZeile> RabatteAm(DateOnly heute) => [.. Rabatte.Where(r => r.Gilt(heute))];

    /// <summary>Der Tarif zu einem Schlüssel — null, wenn es ihn nicht gibt.</summary>
    public Tarif? Von(string? key) => Alle.FirstOrDefault(t => string.Equals(t.Key, key, StringComparison.OrdinalIgnoreCase));
    /// <summary>Der niedrigste Tarif (Kostenlos): ohne Lizenz, nach dem Test, wenn eine Lizenz abgelaufen ist.</summary>
    public Tarif Free => Alle[0];
    /// <summary>Der Tarif des Tests einer neuen Instanz.</summary>
    public Tarif Test => Von(_testTarif) ?? Free;
    /// <summary>Der niedrigste Tarif, der dieses Plugin enthält — null, wenn keiner.</summary>
    public Tarif? Ab(string plugin) => Alle.FirstOrDefault(t => t.Erlaubt(plugin));
    /// <summary>Der niedrigste Tarif mit Zeitplan für Jobs.</summary>
    public Tarif? AbZeitplan => Alle.FirstOrDefault(t => t.Zeitplan);

    /// <summary>Die Pakete, die als Schlüssel angefordert werden können — die Tarife ausser dem niedrigsten, je 30 Tage.</summary>
    public IReadOnlyList<Schluessel.Paket> Pakete => [.. Alle.Where(t => t.Rang > 0).Select(t => new Schluessel.Paket(t.Key, t.Label, t.Week, t.Month, 30))];
    public Schluessel.Paket? PaketVon(string? key) => Pakete.FirstOrDefault(p => p.Key == key);

    /// <summary>Aus dem Inhalt eines (geprüften) Tarifblatts.</summary>
    public static Tarifliste Aus(Licensing.TarifblattInhalt b) =>
        new(b.Version, b.Tarife.Select(z => new Tarif(z.Key, z.Label, z.Rang, z.Week, z.Month, z.PubTrees, z.Plugins is null ? null : new HashSet<string>(z.Plugins),
                // ohne Angabe (Blätter von davor): ein unbegrenzter Tarif beliebig viele Server, jeder andere einen
                z.Server ?? (z.Week == Tarife.Ohne && z.Month == Tarife.Ohne ? Tarife.Ohne : 1))),
            b.TestTarif, b.TestMonate, b.Kauf, b.Rabatte);

    /// <summary>Als Inhalt eines Tarifblatts — so legt der Lizenzserver seine erste Version aus dem Saatgut an.</summary>
    public Licensing.TarifblattInhalt AlsBlatt(long version, DateTimeOffset ausgestellt) =>
        new(version, ausgestellt, Test.Key, TestMonate,
            [.. Alle.Select(t => new Licensing.TarifZeile(t.Key, t.Label, t.Rang, t.Week, t.Month, t.PubTrees, t.Plugins?.Order().ToArray(), t.Server))], Kauf, Rabatte.Count == 0 ? null : [.. Rabatte]);
}

/// <summary>
/// Das Saatgut der Tarife und was für alle gleich ist. Im Betrieb gilt die <see cref="Tarifliste"/> aus dem Journal —
/// die Werte hier gelten nur, solange eine Instanz noch nie ein Tarifblatt bekommen hat, und sind die erste Version des
/// Lizenzservers. Grenzen je Woche und Monat hängen am Team (am Ende der Zahlerkette); Plugins und
/// Publikationsbäume gelten für die ganze Instanz — nach dem höchsten Tarif, den sie hat.
/// <list type="bullet">
/// <item><b>Kostenlos</b> — 10 000 / 50 000, Tabelle (CSV, Excel, JSON), das Excel-Add-in, OnlyOffice, Ableitungen
/// (Vorschaubilder) und Export, ein Publikationsbaum; Jobs nur von Hand, ein Zeitplan gehört zu Pro. Ableitungen und Export
/// laufen als Job — der Tasker ist darum dabei, startet aber nur Jobs erlaubter Plugins; gesichert wird von Hand
/// (Einstellungen → B&amp;R), die Sicherung als Job gehört zu Pro.</item>
/// <item><b>Pro</b> — 50 000 / 250 000, dazu Datenblatt, Übersetzung (XLIFF), BMEcat (Export nach Vorlage), ETIM, Konfigurator,
/// Tasker; fünf Publikationsbäume (GPC und Vektoren ab Pro+, Tarifblatt Version 11). ETIM braucht Datenanalyse und Export nach Vorlage, der Tasker bringt die Sicherung
/// als Job mit — die kommen mit.</item>
/// <item><b>Pro+</b> — Pro mit allen Plugins; damit auch <c>scriptum</c> (29.09.2026): ein Skript läuft als Prozess
/// auf dem Server, und wer eines schreibt, kann alles, was der Serverbenutzer kann — das gehört zu den Tarifen, die
/// auch die Verantwortung dafür tragen, nicht zum Einstieg.</item>
/// <item><b>Enterprise</b> — 200 000 / 1 000 000, alle Plugins, Publikationsbäume ohne Grenze.</item>
/// <item><b>Unlimited</b> — keine Grenzen, alle Plugins.</item>
/// </list>
/// Jede neue Instanz bekommt die ersten drei Monate Enterprise. Die Preise stehen im Shop, nicht hier.
/// </summary>
public static class Tarife
{
    public const string ProKey = "pro";
    public const string EnterpriseKey = "enterprise";

    /// <summary>Keine Grenze — für Unlimited (Woche, Monat) und Publikationsbäume ab Enterprise.</summary>
    public const int Ohne = int.MaxValue;

    /// <summary>
    /// Systemjobs: sie rechnen und messen, was jede Instanz braucht — die Vorschauen und die Bildabmessungen.
    /// Das ist Betrieb, kein Merkmal eines Tarifs, und darum sind sie in jedem erlaubt. Die Vektoren (<c>embed</c>) nicht mehr (03.10.2026): sie sind ein
    /// Merkmal des Tarifs — welcher Tarif sie enthält, sagt das Tarifblatt des Lizenzservers mit dem Schlüssel <c>embed</c> (Version 11: ab Pro+).
    /// <para>Die Ausnahme steht hier und nicht nur in <see cref="Basis"/>, weil im Betrieb das signierte Tarifblatt
    /// gilt und nicht das Saatgut: ein Blatt, das einen neuen Systemjob noch nicht kennt, sperrte ihn sonst aus. In
    /// der Liste stünde dann der Tarif, der ihn enthält, statt an/aus — und einmal ausgeschaltet liesse er sich nicht
    /// wieder einschalten (27.09.2026).</para>
    /// </summary>
    public static readonly IReadOnlySet<string> Systemjobs = new HashSet<string> { "derive", "probe" };

    /// <summary>
    /// Die Plugins, die mit journali kommen — Schlüssel und Name. Der Lizenzserver zeigt sie beim Bearbeiten des Tarifblatts und weist einen unbekannten
    /// Schlüssel ab (03.10.2026: ein Tarif enthält ein Plugin über seinen Schlüssel, etwa <c>embed</c> für die Vektoren). Der Prüfstand
    /// <c>Der_Plugin_Katalog_nennt_jedes_Plugin_im_Repo</c> hält die Liste beim Verzeichnis <c>plugins/</c>.
    /// </summary>
    public static readonly IReadOnlyList<(string Key, string Label)> Katalog =
    [
        ("backup", "Sicherung"), ("configurator", "Konfigurator"), ("csv", "CSV / TSV"), ("da", "Datenanalyse"), ("datasheet", "Datenblatt"),
        ("derive", "Vorschauen rechnen"), ("docs", "Dokumente durchsuchbar machen"), ("dpp", "Digitaler Produktpass"), ("driver", "Zugänge"),
        ("embed", "Einbettungen (Vektoren)"), ("empco", "Werbeaussagen (EmpCo)"), ("enrich", "Anreicherung"), ("etim", "ETIM"), ("excel", "Excel"),
        ("exceladdin", "Excel-Add-in"), ("geo", "GEO-Texte (KI)"), ("gpc", "GPC"), ("ixp", "IXP"), ("json", "JSON"), ("ocr", "Texterkennung (OCR)"),
        ("ooaddin", "OnlyOffice"), ("ppwr", "Verpackung (PPWR)"), ("probe", "Bildabmessungen lesen"), ("rag", "KI-Wissensbasis"), ("scriptum", "Skripte"),
        ("solr", "Solr"), ("table", "Tabelle"), ("tasker", "Jobs"), ("xliff", "Übersetzung (XLIFF)"), ("xport", "Vorlagen"),
    ];

    // Die Systemjobs stehen auch hier: das Saatgut soll dasselbe sagen wie die Ausnahme darüber.
    // Nicht hier und nicht bei Pro: scriptum — es gibt es erst ab Pro+ (Prüfstand TarifPluginsTests).
    private static readonly string[] Basis = ["table", "csv", "excel", "json", "exceladdin", "ooaddin", "derive", "probe", "tasker", "driver"];

    public static readonly Tarif Free = new("free", "Kostenlos", 0, 10_000, 50_000, 1, new HashSet<string>(Basis));
    public static readonly Tarif Pro = new("pro", "Pro", 1, 50_000, 250_000, 5,
        new HashSet<string>([.. Basis, "datasheet", "xliff", "xport", "etim", "da", "backup", "configurator"]));   // wie im Tarifblatt Version 11 (03.10.2026)
    public static readonly Tarif ProPlus = new("proplus", "Pro+", 2, 50_000, 250_000, 5, null);
    public static readonly Tarif Enterprise = new("enterprise", "Enterprise", 3, 200_000, 1_000_000, Ohne, null);
    public static readonly Tarif Unlimited = new("unlimited", "Unlimited", 4, Ohne, Ohne, Ohne, null, Server: Ohne);   // mehrere Server auf einer Datenbank: nur Unlimited (04.10.2026)

    /// <summary>Das Saatgut: gilt, solange kein Tarifblatt im Journal steht.</summary>
    public static readonly Tarifliste Saat = new(0, [Free, Pro, ProPlus, Enterprise, Unlimited], EnterpriseKey, 3);

    /// <summary>Der höhere von zwei Tarifen.</summary>
    public static Tarif Hoeher(Tarif a, Tarif b) => b.Rang > a.Rang ? b : a;

    /// <summary>
    /// Zu welchem Reset gehört dieser Tarif? Reset-Schlüssel gibt es getrennt für Pro und Enterprise. Pro+ ist Pro mit allen Plugins; kostenlos gibt es keinen Reset, Unlimited braucht keinen.
    /// </summary>
    public static string? ResetFuer(Tarif t) => t.Key switch { "pro" or "proplus" => ProKey, "enterprise" => EnterpriseKey, _ => null };
}
