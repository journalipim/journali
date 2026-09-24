namespace Journali.Core.Projections;

/// <summary>Ein Tarif: Grenzen je Woche und Monat, wie viele Publikationsbäume, welche Plugins (null = alle).</summary>
public sealed record Tarif(string Key, string Label, int Rang, int Week, int Month, int PubTrees, IReadOnlySet<string>? Plugins)
{
    public bool Erlaubt(string plugin) => Plugins is null || Plugins.Contains(plugin);
    public bool Unbegrenzt => Week == Tarife.Ohne && Month == Tarife.Ohne;
}

/// <summary>
/// Die Tarife (Taloan, 24.09.2026). Grenzen je Woche und Monat hängen am Team (am Ende der Zahlerkette); Plugins und
/// Publikationsbäume gelten für die ganze Instanz — nach dem höchsten Tarif, den sie hat („wenn Team 1 Pro hat und
/// Team 2 Enterprise: der höchste gilt für alle“).
/// <list type="bullet">
/// <item><b>Kostenlos</b> — 10 000 / 50 000, Tabelle (CSV, Excel, JSON), das Excel-Add-in, OnlyOffice, Ableitungen
/// (Vorschaubilder) und Export (Taloan, 24.09.2026: „schon in kostenlos“), ein Publikationsbaum. Ableitungen und Export
/// laufen als Job — der Tasker ist darum dabei, startet aber nur Jobs erlaubter Plugins; gesichert wird von Hand
/// (Einstellungen → B&amp;R), die Sicherung als Job gehört zu Pro.</item>
/// <item><b>Pro</b> — 50 000 / 250 000, dazu Datenblatt, Übersetzung (XLIFF), BMEcat (Export nach Vorlage), ETIM,
/// Tasker; fünf Publikationsbäume. ETIM braucht Datenanalyse und Export nach Vorlage, der Tasker bringt die Sicherung
/// als Job mit — die kommen mit.</item>
/// <item><b>Pro+</b> — Pro mit allen Plugins („Pro kann eine All-Plugin-Lizenz dazukaufen — gilt systemweit“).</item>
/// <item><b>Enterprise</b> — 200 000 / 1 000 000, alle Plugins, Publikationsbäume ohne Grenze.</item>
/// <item><b>Unlimited</b> — keine Grenzen, alle Plugins.</item>
/// </list>
/// Jede neue Instanz bekommt die ersten drei Monate Enterprise (<see cref="TestMonate"/>): „das sollte reichen für
/// Tests und Datenmigration“. Die Preise stehen im Shop, nicht hier.
/// </summary>
public static class Tarife
{
    public const string ProKey = "pro";
    public const string EnterpriseKey = "enterprise";

    /// <summary>Keine Grenze — für Unlimited (Woche, Monat) und Publikationsbäume ab Enterprise.</summary>
    public const int Ohne = int.MaxValue;
    /// <summary>So lange gilt der Test einer neuen Instanz, gezählt ab dem ersten Eintrag im Journal.</summary>
    public const int TestMonate = 3;

    private static readonly string[] Basis = ["table", "csv", "xlsx", "json", "excel", "onlyoffice", "derive", "export", "tasker"];

    public static readonly Tarif Free = new("free", "Kostenlos", 0, 10_000, 50_000, 1, new HashSet<string>(Basis));
    public static readonly Tarif Pro = new("pro", "Pro", 1, 50_000, 250_000, 5,
        new HashSet<string>([.. Basis, "datasheet", "xliff", "xport", "etim", "da", "backup"]));
    public static readonly Tarif ProPlus = new("proplus", "Pro+", 2, 50_000, 250_000, 5, null);
    public static readonly Tarif Enterprise = new("enterprise", "Enterprise", 3, 200_000, 1_000_000, Ohne, null);
    public static readonly Tarif Unlimited = new("unlimited", "Unlimited", 4, Ohne, Ohne, Ohne, null);

    public static readonly Tarif[] Alle = [Free, Pro, ProPlus, Enterprise, Unlimited];

    /// <summary>Der Tarif zu einem Schlüssel — null, wenn es ihn nicht gibt (Lizenzen von vor den Tarifen).</summary>
    public static Tarif? Von(string? key) => Alle.FirstOrDefault(t => string.Equals(t.Key, key, StringComparison.OrdinalIgnoreCase));

    /// <summary>Der höhere von zwei Tarifen.</summary>
    public static Tarif Hoeher(Tarif a, Tarif b) => b.Rang > a.Rang ? b : a;

    /// <summary>
    /// Zu welchem Reset gehört dieser Tarif? Reset-Schlüssel gibt es getrennt für Pro und Enterprise (Taloan,
    /// 24.09.2026). Pro+ ist Pro mit allen Plugins; kostenlos gibt es keinen Reset, Unlimited braucht keinen.
    /// </summary>
    public static string? ResetFuer(Tarif t) => t.Key switch { "pro" or "proplus" => Pro.Key, "enterprise" => Enterprise.Key, _ => null };
}
