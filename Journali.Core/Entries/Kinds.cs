namespace Journali.Core.Entries;

/// <summary>
/// Die Art eines Journaleintrags: <b>was für eine Arbeit</b> der Eintrag war. Das ist ein Fakt und steht für immer
/// im Eintrag (Spalte <c>kind</c>) — im Gegensatz zu der Frage, ob er <i>zählt</i>: die beantwortet der Tarif und
/// darf sich ändern, ohne die Vergangenheit anzufassen.
/// <para>Wer schreibt, darf die Art mitgeben (ein Plugin weiss besser als der Kern, was es tut). Fehlt sie —
/// auch bei allen Einträgen von vor dieser Spalte —, leitet <see cref="Of"/> sie aus dem Eintragstyp ab.</para>
/// </summary>
public static class Kinds
{
    /// <summary>Datenmodellierung: Attribute, Gruppen, Sichten, Listen, Sprachen, Kanäle, Status, Relationstypen, Workflow-Designer, Einheiten, Wörterbuch.</summary>
    public const string Model = "model";
    /// <summary>Struktur: Baum anlegen, umhängen, ordnen, benennen, Achsen und Gruppen festlegen — auch der Aufbau des Publikationsbaums.</summary>
    public const string Structure = "structure";
    /// <summary>Datenpflege: Werte, Zeilen, Artikel und Varianten, Status, Kennungen, Medien, Relationen — Import wie Handarbeit.</summary>
    public const string Data = "data";
    /// <summary>Ausleitung: Freigaben, Versionen, Workflow-Zustände, Übersetzungsschritte.</summary>
    public const string Publish = "publish";
    /// <summary>Referenzdaten von aussen: Kataloge (ETIM) und ihre Wertelisten — fremdes Material, keine eigene Leistung.</summary>
    public const string Reference = "reference";
    /// <summary>Einrichtung: Plugins, Benutzer, Rollen, Jobdefinitionen.</summary>
    public const string Setup = "setup";
    /// <summary>Betrieb: Jobläufe mit ihrem Protokoll, gerechnete Vorschauen.</summary>
    public const string Ops = "ops";

    public static readonly IReadOnlyList<string> All = [Model, Structure, Data, Publish, Reference, Setup, Ops];

    /// <summary>Was im Tagesgeschäft zählt.</summary>
    public static readonly IReadOnlySet<string> Counts = new HashSet<string> { Data, Publish };

    /// <summary>Zählt dieser Eintrag? Ohne eigene Art entscheidet der Typ.</summary>
    public static bool Billable(string? kind, string type) => Counts.Contains(kind ?? Of(type));

    /// <summary>Die Art aus dem Eintragstyp — der Notnagel für alles, was ohne Angabe geschrieben wurde.</summary>
    public static string Of(string type) => type switch
    {
        // Datenpflege
        Types.AttributeSet or Types.AttributeCleared or Types.ValueSourced or Types.RowAdded or Types.RowRemoved or Types.RowOrdered
            or Types.NodeNamed          // einen Knoten benennen ist Pflege, nicht Gerüst
            or Types.ProductCreated or Types.VariantCreated or Types.NodeRetired or Types.NodeRestored
            or Types.StatusSet or Types.ExternalLinked or Types.ExternalUnlinked
            or Types.MediaCreated or Types.MediaRetired or Types.MediaFiled or Types.MediaSuperseded
            or Types.RelationCreated or Types.RelationRetired => Data,

        // Ausleitung
        Types.ReleaseGranted or Types.ReleaseRevoked
            or Types.VersionCreated or Types.VersionDocumentAdded or Types.VersionWithdrawn
            or Types.WorkflowStateSet or Types.WorkflowAssigned
            or Types.TranslationMarked or Types.TranslationOrdered or Types.TranslationReturned => Publish,

        // Struktur: Baum und Publikationsbaum
        Types.GroupCreated or Types.GroupRenamed or Types.NodeMoved or Types.NodeOrdered
            or Types.GroupsAttached or Types.ProductAxesSet or Types.LabelAttributeSet
            or Types.CategoryAssigned or Types.CategoryRemoved
            or Types.RubricCreated or Types.PubTreeSet or Types.PubStandSet
            or Types.NodePlaced or Types.NodeUnplaced or Types.PlaceNamed
            or Types.RulePlaced or Types.RuleRemoved
            or Types.MediaFolderCreated or Types.MediaFolderRenamed or Types.MediaFolderMoved or Types.MediaFolderRetired
            or Types.NodeRestricted or Types.MediaFolderRestricted => Structure,

        // Referenzdaten von aussen
        Types.PluginDataSet or Types.ListValueDefined or Types.ListValueRetired => Reference,

        // Einrichtung
        Types.PluginInstalled or Types.PluginEnabled or Types.PluginDisabled or Types.PluginRemoved or Types.PluginAcknowledged or Types.UsageReportsSet or Types.NoticeAcknowledged
            or Types.JobDefined or Types.JobRetired or Types.ServerMainSet or Types.ServerBlockSet or Types.ServerNamed
            or Types.UserDefined or Types.UserRetired or Types.RoleDefined or Types.RoleRetired or Types.KeyRedeemed or Types.EntitlementReceived or Types.TarifeReceived
            or Types.MediaPresetDefined or Types.MediaPresetRetired => Setup,

        // Betrieb
        Types.JobRunStarted or Types.JobRunFinished or Types.JobFileConsumed or Types.JobFileWritten
            or Types.MediaDerived or Types.MediaProbed or Types.MediaSourced => Ops,

        // alles Übrige ist Modell (Attribute, Gruppen, Sichten, Listen, Sprachen, Kanäle, Status, Einheiten,
        // Relationstypen, Workflows, Wörterbuch, Master-Einstellungen) — und ein neuer Typ zählt nie ungefragt
        _ => Model,
    };
}
