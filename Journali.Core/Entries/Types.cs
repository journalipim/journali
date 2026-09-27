using System.Text.Json;
using System.Text.Json.Serialization;

namespace Journali.Core.Entries;

/// <summary>
/// Das Vokabular der Einträge. Ein Typ ist für immer: neue Typen sind billig,
/// geänderte teuer, gelöschte unmöglich (docs/eintraege.md). Der Name des
/// Typs ist <c>Type</c>, die Nutzdaten das Record als JSON in camelCase.
/// Optionale Felder dürfen dazukommen; bestehende ändern nie ihre Bedeutung.
/// </summary>
public static class Types
{
    // Baum: Produktgruppe → … → Produkt → Variante (docs/pflegestruktur.md, 5)
    public const string GroupCreated = "GroupCreated";
    public const string GroupRenamed = "GroupRenamed";
    public const string ProductCreated = "ProductCreated";
    public const string VariantCreated = "VariantCreated";
    public const string NodeMoved = "NodeMoved";
    public const string NodeRestricted = "NodeRestricted";
    public const string NodeOrdered = "NodeOrdered";
    public const string NodeRetired = "NodeRetired";
    /// <summary>Zurückgezogenen Knoten zurückholen — mit allem, was er hatte.</summary>
    public const string NodeRestored = "NodeRestored";
    public const string StatusSet = "StatusSet";
    public const string GroupsAttached = "GroupsAttached";
    public const string NodeNamed = "NodeNamed";
    public const string ProductAxesSet = "ProductAxesSet";

    // Relationen (docs/pflegestruktur.md, 18): eigener Strom r-…, Werte per AttributeSet wie am Knoten
    public const string RelationCreated = "RelationCreated";
    public const string RelationRetired = "RelationRetired";

    // Medien (docs/pflegestruktur.md, 20): eigener Strom m-…, die Bytes liegen ausserhalb (Hash)
    public const string MediaCreated = "MediaCreated";
    public const string MediaRetired = "MediaRetired";
    // Medienordner: Strom mf-…
    public const string MediaFolderCreated = "MediaFolderCreated";
    public const string MediaFolderRenamed = "MediaFolderRenamed";
    public const string MediaFolderMoved = "MediaFolderMoved";
    public const string MediaFolderRetired = "MediaFolderRetired";
    public const string MediaFolderRestricted = "MediaFolderRestricted";
    public const string MediaFiled = "MediaFiled";   // am Medium: in welchem Ordner es liegt
    // Vorschau-Presets: Strom media-preset:<key>
    public const string MediaPresetDefined = "MediaPresetDefined";
    public const string MediaPresetRetired = "MediaPresetRetired";
    public const string MediaDerived = "MediaDerived";   // am Medium: Ableitung nach Preset liegt im Store (sha.<preset>)
    public const string MediaProbed = "MediaProbed";      // am Medium: was im Kopf der Datei steht (Mass, Auflösung, Farbraum)
    public const string MediaSourced = "MediaSourced";    // am Medium: woher es kam (Schnittstelle, Profil, Job, Bezug)
    public const string MediaSuperseded = "MediaSuperseded";   // am Vorgänger: dieses Medium ersetzt es — die Zuordnungen sind gewandert
    public const string LabelAttributeSet = "LabelAttributeSet";
    public const string ExternalLinked = "ExternalLinked";
    public const string ExternalUnlinked = "ExternalUnlinked";

    // Werte an einem Knoten
    public const string AttributeSet = "AttributeSet";
    public const string AttributeCleared = "AttributeCleared";
    public const string ValueSourced = "ValueSourced";
    public const string RowAdded = "RowAdded";
    public const string RowRemoved = "RowRemoved";
    public const string RowOrdered = "RowOrdered";
    public const string CategoryAssigned = "CategoryAssigned";
    public const string CategoryRemoved = "CategoryRemoved";
    public const string ReleaseGranted = "ReleaseGranted";
    public const string ReleaseRevoked = "ReleaseRevoked";

    // Modell (docs/pflegestruktur.md) — ganze Definition je Eintrag, der letzte gewinnt
    public const string LocaleDefined = "LocaleDefined";
    public const string LocaleRetired = "LocaleRetired";
    public const string ChannelDefined = "ChannelDefined";
    public const string ChannelRetired = "ChannelRetired";
    public const string StatusDefined = "StatusDefined";   // Status-Vokabular
    public const string StatusRetired = "StatusRetired";
    public const string AttributeDefined = "AttributeDefined";
    public const string AttributeRetired = "AttributeRetired";
    public const string ListDefined = "ListDefined";
    public const string ListRetired = "ListRetired";
    public const string ListValueDefined = "ListValueDefined";
    public const string ListValueRetired = "ListValueRetired";
    public const string FamilyDefined = "FamilyDefined";
    public const string FamilyRetired = "FamilyRetired";
    public const string TreeLabelDefined = "TreeLabelDefined";
    public const string AttributeGroupDefined = "AttributeGroupDefined";
    public const string AttributeGroupRetired = "AttributeGroupRetired";
    public const string ViewDefined = "ViewDefined";
    public const string ViewRetired = "ViewRetired";
    public const string UnitDefined = "UnitDefined";
    public const string UnitRetired = "UnitRetired";
    // Wörterbuch (docs/pflegestruktur.md 9): Strom term:<key>
    public const string TermDefined = "TermDefined";
    public const string TermRetired = "TermRetired";
    // Workflows (docs/pflegestruktur.md 27): Strom workflow:<key>; am Knoten der Schritt und die Zuständigkeit
    public const string WorkflowDefined = "WorkflowDefined";
    public const string WorkflowRetired = "WorkflowRetired";
    public const string WorkflowStateSet = "WorkflowStateSet";
    public const string WorkflowAssigned = "WorkflowAssigned";
    // Übersetzung (docs/pflegestruktur.md 30): die Marke am Knoten, der Auftrag im Strom translation:<key>
    public const string TranslationMarked = "TranslationMarked";
    public const string TranslationOrdered = "TranslationOrdered";
    public const string TranslationReturned = "TranslationReturned";
    public const string MasterLocaleDefined = "MasterLocaleDefined";
    public const string MasterChannelDefined = "MasterChannelDefined";
    public const string SkuAttributeDefined = "SkuAttributeDefined";
    /// <summary>Publikationsbaum: Rubriken und Verweise.</summary>
    public const string RubricCreated = "RubricCreated";
    public const string PubTreeSet = "PubTreeSet";
    public const string PubStandSet = "PubStandSet";
    public const string NodePlaced = "NodePlaced";
    public const string NodeUnplaced = "NodeUnplaced";
    public const string RulePlaced = "RulePlaced";
    public const string RuleRemoved = "RuleRemoved";
    public const string PlaceNamed = "PlaceNamed";
    public const string RelationTypeDefined = "RelationTypeDefined";
    public const string RelationTypeRetired = "RelationTypeRetired";

    // Plugins (docs/pflegestruktur.md, 19): Strom plugin:<key>
    public const string PluginInstalled = "PluginInstalled";
    public const string PluginEnabled = "PluginEnabled";
    public const string PluginDisabled = "PluginDisabled";
    public const string PluginRemoved = "PluginRemoved";
    public const string PluginDataSet = "PluginDataSet";      // benannter Datensatz eines Plugins (Vorlage, Zuordnung, Regel) — JSON-Text

    // Jobs (Plugin tasker): Strom job:<key> — Definition, jeder Lauf mit Ausgang; das Log liegt als Datei
    public const string JobDefined = "JobDefined";
    public const string JobRetired = "JobRetired";
    public const string JobRunStarted = "JobRunStarted";
    public const string JobRunFinished = "JobRunFinished";
    // Fächer des Taskers (docs/tasker-dateien.md): Belege je Datei — die Dateien selbst liegen nicht im Journal
    public const string JobFileConsumed = "JobFileConsumed";
    public const string JobFileWritten = "JobFileWritten";

    // Versionen: am Knotenstrom —
    // Zeiger auf den Journalstand, eingefrorene Belege (hash-adressiert im Medienspeicher), zurueckgezogen nur markiert
    public const string VersionCreated = "VersionCreated";
    public const string VersionDocumentAdded = "VersionDocumentAdded";
    public const string VersionWithdrawn = "VersionWithdrawn";

    // Benutzer: Strom user:<key> — wer es gibt und welche Rolle; Passwoerter nie im Journal
    public const string UserDefined = "UserDefined";
    public const string UserRetired = "UserRetired";
    public const string UserPrefsSet = "UserPrefsSet";
    // Teams: Strom team:<key>; der KI-Verbrauch je Team unter ai-usage:<team>
    public const string TeamDefined = "TeamDefined";
    public const string TeamRetired = "TeamRetired";
    public const string AiUsed = "AiUsed";
    /// <summary>Ein Lizenzschlüssel wurde für ein Team eingelöst (Strom <c>team:&lt;key&gt;</c>) — einmal je Schlüssel.</summary>
    public const string KeyRedeemed = "KeyRedeemed";
    /// <summary>Der Stand eines Abos, vom Lizenzserver signiert bestätigt (Taloan, 24.09.2026) — Strom team:&lt;key&gt;.</summary>
    public const string EntitlementReceived = "EntitlementReceived";
    /// <summary>Ein Tarifblatt des Lizenzservers, signiert (25.09.2026) — Strom <c>tarife</c>. Die höchste echte Fassung gilt.</summary>
    public const string TarifeReceived = "TarifeReceived";
    public const string RegistrationSet = "RegistrationSet";
    public const string RoleDefined = "RoleDefined";
    public const string RoleRetired = "RoleRetired";

    /// <summary>camelCase, Null-Felder weg, Umlaute lesbar — dieselbe Form in Journal und Antworten.</summary>
    public static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static string Serialize<T>(T payload) => JsonSerializer.Serialize(payload, Json);

    public static T Deserialize<T>(string payload) =>
        JsonSerializer.Deserialize<T>(payload, Json)
        ?? throw new InvalidOperationException($"Payload ist null: {typeof(T).Name}");
}

// ---- Baum -----------------------------------------------------------------

/// <summary>Rollen der Knoten. Nur Varianten sind verkaufsfähig.</summary>
public static class Roles
{
    public const string Group = "group";
    public const string Product = "product";
    public const string Variant = "variant";
    /// <summary>Rubrik: Knoten eines Publikationsbaums — Wurzel = der Baum eines Kanals (× Markt), darunter Rubriken;
    /// Produktgruppen und Produkte hängen per Verweis darin (NodePlaced), nie als Kinder — keine Vererbung über den Publikationsbaum.
    /// Rubriken tragen eigene Werte (Texte, Bilder, SEO) wie jeder Knoten.</summary>
    public const string Rubric = "rubric";
    /// <summary>Kein Baumknoten: ein Medium als Ziel einer Relation (20).</summary>
    public const string Media = "media";
    public static readonly IReadOnlyList<string> All = [Group, Product, Variant, Rubric];
    /// <summary>Die Rollen des Pflegebaums (ohne Rubrik).</summary>
    public static readonly IReadOnlyList<string> Care = [Group, Product, Variant];
    /// <summary>Tiefe im Baum: Gruppe 0, Produkt 1, Variante 2 — für „aktiv ab“. Rubrik 0: ein eigener Baum.</summary>
    public static int Depth(string role) => role switch { Group => 0, Product => 1, Variant => 2, _ => 0 };
}

/// <summary>Status eines Produkts oder einer Variante: Lebenszyklus am Markt (nicht Redaktion — das ist der Workflow). Das Vokabular
/// steht im Modell (<see cref="StatusDefinition"/>, Strom <c>status:&lt;key&gt;</c>). <see cref="Draft"/> ist der Startstatus neuer Knoten und bleibt immer im Modell.</summary>
public static class Statuses
{
    public const string Draft = "draft";
}

/// <summary>Ein Status im Modell: Schlüssel, Text je Sprache, Farbe (Token: muted, warn, neg, accent, pos), Symbol, Reihenfolge.</summary>
public sealed record StatusDefinition(string Key, Labels Label, string? Color = null, string? Icon = null, int Order = 0);
public sealed record StatusRetired(string Key);

/// <summary>
/// Erster Eintrag einer Produktgruppe. <paramref name="Parent"/> null = Wurzel.
/// <paramref name="Name"/> ist der Name im Baum (einsprachig); <paramref name="Label"/>
/// ist Altlast (je Sprache) und füllt den Namen, wenn er fehlt.
/// </summary>
public sealed record GroupCreated(string? Parent, Labels Label, string? Name = null);

/// <summary>Altlast (17.09.2026): Gruppe je Sprache umbenennen — heute <see cref="NodeNamed"/>. Bleibt lesbar, wird nicht mehr geschrieben.</summary>
public sealed record GroupRenamed(Labels Label);

/// <summary>
/// Eigener Name des Knotens im Baum, jede Rolle, einsprachig (docs/pflegestruktur.md, 17).
/// Leer = weg, dann benennt die Automatik (<see cref="LabelAttributeSet"/>, SKU, Achsen, Id).
/// </summary>
public sealed record NodeNamed(string? Name);

/// <summary>
/// Das Sternchen: welches Attribut ab hier nach unten die Knoten benennt, die keinen
/// eigenen Namen haben. Gilt den Pfad hinunter, jeder Knoten darunter darf es neu setzen.
/// Null = weg, es gilt wieder das der Vorfahren.
/// </summary>
public sealed record LabelAttributeSet(string? Attribute);

/// <summary>Erster Eintrag eines Produkts: unter welcher Gruppe, wonach es variiert (Attribute, optional). <paramref name="Family"/> ist Altlast.</summary>
public sealed record ProductCreated(string Group, string? Family = null, string[]? Axes = null);

/// <summary>Variantenachsen eines Produkts nachträglich (ganze Liste) — nur, solange es keine Varianten hat.</summary>
public sealed record ProductAxesSet(string[] Axes, bool Force = false);

/// <summary>Erster Eintrag einer Variante: je Variantenachse des Produkts ein Wert.</summary>
public sealed record VariantCreated(string Product, Dictionary<string, string> AxisValues);

public sealed record NodeMoved(string Parent);
/// <summary>Sichtbar für diese Rollen — ab hier abwärts, bis ein Nachfahre eigene nennt. Leer oder null = für alle (27.09.2026).
/// Wer eine Rolle mit dem Recht <c>users</c> hat, sieht immer alles; ohne Anmeldung gilt keine Einschränkung.</summary>
public sealed record NodeRestricted(string[]? Roles);

/// <summary>Platz unter den Geschwistern (Rubriken eines Publikationsbaums). Ohne Eintrag: alphabetisch.</summary>
public sealed record NodeOrdered(int Order);

/// <summary>Knoten weg — nur ohne Kinder. Das Journal behält alles, das Abbild nimmt ihn heraus.</summary>
public sealed record NodeRetired();

/// <summary>Knoten zurück ins Abbild — mit Werten, Gruppen, Kennungen, wie er war; der Vater muss da sein.</summary>
public sealed record NodeRestored();

public sealed record StatusSet(string Status);

/// <summary>
/// Welche Attributgruppen an diesem Knoten hängen (ganze Liste, der letzte gewinnt).
/// Die Definition vererbt sich nach unten: alles darunter hat diese Attribute dazu.
/// Ob ein Wert vererbt wird, sagt das Attribut (<see cref="AttributeDefinition.Inheritable"/>).
/// </summary>
public sealed record GroupsAttached(string[] Groups);

/// <summary>Erster Eintrag einer Relation: Typ aus dem Modell, von Knoten zu Knoten. Werte danach per <see cref="AttributeSet"/> auf demselben Strom.</summary>
public sealed record RelationCreated(string Type, string From, string To);

/// <summary>Relation weg — das Journal behält sie, das Abbild nimmt sie heraus.</summary>
public sealed record RelationRetired();

/// <summary>Erster Eintrag eines Mediums: die Datei liegt im Store unter ihrem SHA-256; hier nur Hash, Grösse, Typ, Name.</summary>
public sealed record MediaCreated(string Sha256, long Bytes, string Mime, string Name);

/// <summary>Medium weg — die Datei bleibt im Store (Hash-adressiert, vielleicht geteilt), das Abbild nimmt das Medium heraus.</summary>
public sealed record MediaRetired();

/// <summary>
/// Medienordner: ein Strukturbaum nur zum Organisieren der Bibliothek — wie ein Dateimanager. Ein Ordner
/// hat einen Namen und einen Vater (null = oberste Ebene); ein Medium liegt in höchstens einem Ordner. Die Ordner sagen nichts
/// über die Verwendung (das sind die Relationen) und nichts über die Datei (die liegt im Store).
/// </summary>
public sealed record MediaFolderCreated(string Name, string? Parent);
public sealed record MediaFolderRenamed(string Name);
public sealed record MediaFolderMoved(string? Parent);
/// <summary>Ordner weg — nur leer (keine Unterordner, keine Medien); das prüft der Befehl.</summary>
public sealed record MediaFolderRetired();
/// <summary>Sichtbar für diese Rollen — der Ordner, seine Unterordner und die Medien darin, bis ein Unterordner eigene nennt. Leer = für alle.</summary>
public sealed record MediaFolderRestricted(string[]? Roles);
/// <summary>Am Medium: in diesen Ordner gelegt (null = kein Ordner).</summary>
public sealed record MediaFiled(string? Folder);

/// <summary>
/// Vorschau-Preset: Ableitung eines Bildes, die beim Import für jedes Bild vorausberechnet wird — Kante
/// in Pixeln (längste Seite, Bild wird eingepasst, nie vergrössert), Format webp | jpeg | png, Qualität 1–100. Im Journal, weil
/// die Ableitung Teil der Ausleitung ist (Datenblatt, Shop nehmen <c>/api/media/{id}/{preset}</c>); der Store hält die Bytes
/// unter <c>sha.&lt;preset&gt;</c>, gerechnet vom Prozess-Plugin <c>derive</c> (nie im Serverprozess).
/// </summary>
public sealed record MediaPresetDefined(Labels Label, int Width, int Height, string Format = "webp", int Quality = 82, bool Auto = true);
public sealed record MediaPresetRetired();
/// <summary>Am Medium: Ableitung nach diesem Preset liegt im Store — mit Mass und Grösse; <c>Fingerprint</c> = Kante/Format/Qualität, damit ein geändertes Preset neu rechnet.</summary>
public sealed record MediaDerived(string Preset, int Width, int Height, long Bytes, string Fingerprint);

/// <summary>
/// Am Medium: was im Kopf der Datei steht — Mass in Pixeln, Auflösung in Punkten je Zoll, Farbraum, Transparenz.
/// Kein gepflegter Wert, sondern eine Eigenschaft der Bytes: der Server liest sie beim Hochladen
/// (<c>MediaProbe</c>) und schreibt sie einmal. Darum Art „Betrieb“ — sie kostet kein Kontingent, so wie die
/// Ableitung keines kostet.
/// <para>Das Mass ist das des fertigen Bildes: steht ein JPEG nach EXIF quer, sind Breite und Höhe schon
/// getauscht — dieselbe Ansicht, die auch die Ableitung rechnet.</para>
/// <para><c>Dpi</c>, <c>Space</c> und <c>Alpha</c> bleiben null, wo der Kopf sie nicht nennt.</para>
/// </summary>
public sealed record MediaProbed(int Width, int Height, int? Dpi = null, string? Space = null, bool? Alpha = null);

/// <summary>
/// Am Medium: woher es kam. Ein Asset, das eine Schnittstelle von sich aus geholt hat, ist ohne diese Angabe
/// nicht mehr zuzuordnen — darum setzt sie der Importeur beim Anlegen, nicht ein Mensch später.
/// <para><c>Plugin</c> ist der Schlüssel der Schnittstelle (<c>csv</c>, <c>ixp</c>, <c>solr</c>, <c>json</c>),
/// <c>Profile</c> das benutzte Profil in seiner Schreibweise <c>&lt;dienst&gt;:&lt;name&gt;</c>, <c>Job</c> der
/// Job, in dessen Lauf es geschah, <c>Ref</c> der Bezug an der Quelle (Adresse, Dateiname, Kennung dort).</para>
/// <para><c>From</c> nennt das Medium, aus dem dieses entstand — ein Zuschnitt oder eine Ausrichtung ergibt ein
/// neues Medium, weil ein Medium unveränderlich ist; <c>From</c> hält die Abstammung fest.</para>
/// <para>Das Datum steht nicht darin: es ist die Zeit des Eintrags. Art „Betrieb“ — die Herkunft festzuhalten
/// ist Teil des Imports, der schon mit <c>MediaCreated</c> zählt.</para>
/// </summary>
public sealed record MediaSourced(string? Plugin = null, string? Profile = null, string? Job = null, string? Ref = null, string? From = null);

/// <summary>
/// Am Vorgänger: das Medium <c>By</c> ersetzt dieses. „Ein neues Bild ist ein neues Medium“ bleibt richtig — ein
/// Medium ist unveränderlich —, aber ein Nachfolger war bis dahin ein fremdes Asset: die Zuordnungen am Knoten
/// wanderten nicht mit, und die Bibliothek zeigte beide. Der Eintrag sagt, wer wen ablöst; der Befehl dazu legt die
/// Zuordnungen am Nachfolger neu an (mit ihren Werten) und löst sie am Vorgänger, im selben Zug.
/// <para>Der Vorgänger bleibt im Abbild: eine Ausleitung von damals, ein Beleg, eine Version nennen ihn weiter, und
/// sie müssen ihn auflösen können. Nur die Bibliothek bietet ihn nicht mehr an. Art „Datenpflege“: es ist die
/// Aussage eines Menschen, kein Messwert.</para>
/// </summary>
public sealed record MediaSuperseded(string By);

/// <summary>Externe Kennung je Quellsystem (Import): beim zweiten Lauf Update statt Neuanlage.</summary>
public sealed record ExternalLinked(string System, string Id);

public sealed record ExternalUnlinked(string System);

// ---- Werte an einem Knoten ------------------------------------------------

/// <summary>
/// Ein Attributwert auf seinen Achsen. Fehlende Achse = gilt für alle.
/// <paramref name="Values"/> statt <paramref name="Value"/> bei mehrfachen Attributen.
/// <paramref name="Row"/>: Zeile eines vermehrbaren Attributs (docs/pflegestruktur.md, 13).
/// Leerer Wert = eigener Wert weg, Fallback gilt wieder.
/// </summary>
public sealed record AttributeSet(string Attribute, string? Locale, string? Channel, string? Value, string[]? Values = null, string? Row = null);

/// <summary>
/// Hier gilt ausdrücklich nichts (27.09.2026): ein eigener, leerer Wert auf dieser Achse. Er bricht die Vererbung wie
/// jeder eigene Wert — der geerbte gilt nicht mehr, und die Zelle bleibt leer. Zu unterscheiden von
/// <see cref="AttributeSet"/> mit leerem Wert: das nimmt den eigenen Wert weg, danach gilt der geerbte wieder.
/// <para>Beides wird gebraucht: „dieses Produkt heisst bewusst nicht wie sein Modell“ ist etwas anderes als „hier steht
/// nichts Eigenes“. Zurück zur Vererbung führt das ↓ an der Attributzeile.</para>
/// </summary>
public sealed record AttributeCleared(string Attribute, string? Locale, string? Channel, string? Row = null);

/// <summary>Neue Zeile eines vermehrbaren Attributs; die Zellen kommen per <see cref="AttributeSet"/> mit <c>row</c>.</summary>
public sealed record RowAdded(string Attribute, string Row);

public sealed record RowRemoved(string Attribute, string Row);

/// <summary>
/// Beleg an einem Wert:
/// woher der Wert auf dieser Achse stammt. <paramref name="Source"/> ist eine URL oder ein Text (Datenblatt, Katalogseite);
/// <paramref name="Method"/> web | ai | rule | import | manual; <paramref name="CheckedAt"/> Datum der Prüfung (ISO, leer = Tag des Eintrags).
/// Leere <paramref name="Source"/> = Beleg weg. Ändert sich der Wert später (AttributeSet danach), gilt der Beleg als veraltet — das Abbild zeigt es.
/// </summary>
public sealed record ValueSourced(string Attribute, string? Locale, string? Channel, string? Row, string? Source, string? Title = null, string? Note = null, string? Method = null, string? CheckedAt = null);

public sealed record RowOrdered(string Attribute, string[] Rows);

public sealed record CategoryAssigned(string Category);

public sealed record CategoryRemoved(string Category);

/// <summary>Freigabe für einen Kanal, optional je Sprache.</summary>
public sealed record ReleaseGranted(string Channel, string? Locale);

public sealed record ReleaseRevoked(string Channel, string? Locale);

// ---- Modell ---------------------------------------------------------------

/// <summary>Label je Sprache: {"de": "Gewicht", "en": "Weight"}.</summary>
public sealed class Labels : Dictionary<string, string>
{
    public Labels() { }
    public Labels(IDictionary<string, string> d) : base(d) { }
    public static Labels Of(string de, string en) => new() { ["de"] = de, ["en"] = en };
}

/// <param name="Fallback">Fallback: Sprache, deren Wert gilt, wenn diese keinen hat — vor dem Master (fr_ch → fr_fr → Master → *). Optional, alte Einträge ohne.</param>
public sealed record LocaleDefinition(string Code, string Label, string? Fallback = null);

/// <param name="Fallback">Fallback: Kanal, dessen Werte und Freigaben (Sortiment) gelten, wenn dieser keine hat — vor dem Master.</param>
public sealed record ChannelDefinition(string Key, Labels Label, string? Fallback = null);

/// <summary>Die Typen eines Attributs; je Typ eine Zelle in der Oberfläche.</summary>
public static class AttributeTypes
{
    public const string Text = "text";
    public const string Html = "html";
    public const string Integer = "integer";
    public const string Decimal = "decimal";
    public const string Boolean = "boolean";
    public const string Date = "date";
    public const string Enum = "enum";
    /// <summary>Vermehrbar: n Zeilen aus Spalten, die selbst Attribute sind (13).</summary>
    public const string Rows = "rows";
    /// <summary>
    /// Formel: der Wert ist ein Skript (<see cref="Entries.Formula"/>), gepflegt wie jeder
    /// andere Wert am Knoten — auch geerbt, auch je Sprache; das Ergebnis wird beim Lesen gerechnet.
    /// </summary>
    public const string Formula = "formula";
    /// <summary>Vorlage: Textbaustein {key}[ … ] aus Attributen, Ergebnis beim Lesen (Template.cs).</summary>
    public const string Template = "template";

    public static readonly IReadOnlyList<string> All = [Text, Html, Integer, Decimal, Boolean, Date, Enum, Rows, Formula, Template];
}

/// <summary>Die Achsen, die ein Attribut haben kann.</summary>
public static class Axes
{
    public const string Locale = "locale";
    public const string Channel = "channel";
}

/// <summary>
/// Ein Attribut (docs/pflegestruktur.md, 1). Strom <c>attribute:&lt;key&gt;</c>,
/// die ganze Definition je Eintrag — der letzte gewinnt.
/// </summary>
/// <param name="Key">technischer Name, für immer: <c>[a-z][a-z0-9_]*</c></param>
/// <param name="Label">Anzeigename je Sprache</param>
/// <param name="Type"><see cref="AttributeTypes"/></param>
/// <param name="Unit">Einheit bei Zahlen, z. B. <c>GB</c></param>
/// <param name="Group">Gruppe in der Pflege, nur Anzeige</param>
/// <param name="Axes"><see cref="Entries.Axes"/>, leer = ein Wert für alles</param>
/// <param name="Channels">nur für diese Kanäle pflegbar; null = alle</param>
/// <param name="List">Werteliste bei <c>enum</c></param>
/// <param name="Multiple">mehrere Werte (Liste)</param>
/// <param name="Levels">an welchen Rollen setzbar (<see cref="Roles"/>); null = die Regel der Gruppe gilt</param>
/// <param name="Columns">bei <c>rows</c>: die Spalten, jede ein Attribut</param>
/// <param name="Inheritable">Wert vererbt sich nach unten (Kategorie ja, Name nein). Vorgabe nein.</param>
/// <param name="Required">Pflicht je Kanal: Sprachen oder "*" — gilt überall gleich (Eineindeutigkeit)</param>
/// <param name="Pattern">Muster (regulärer Ausdruck), dem jeder Wert genügen muss — Telefon, E-Mail, EAN …; nur bei text</param>
/// <param name="PatternHint">was das Muster verlangt, für die Fehlermeldung („+49 30 1234567")</param>
/// <param name="When">Bedingung: gilt an einem Knoten nur, wenn das genannte Attribut dort (wirksam, geerbt zählt) einen der Werte hat — Klassifikationen: Merkmal nur bei seiner Klasse. Null = immer.</param>
public sealed record AttributeDefinition(
    string Key,
    Labels Label,
    string Type,
    string? Unit = null,
    string? Group = null,
    string[]? Axes = null,
    string[]? Channels = null,
    string? List = null,
    bool Multiple = false,
    string[]? Levels = null,
    string[]? Columns = null,
    bool Inheritable = false,
    Dictionary<string, string[]>? Required = null,
    string? Pattern = null,
    string? PatternHint = null,
    AttributeCondition? When = null,
    bool Unique = false,
    string? ReleaseWatch = null)
{
    /// <summary>Eindeutig: kein zweiter Knoten mit demselben eigenen Wert auf dem Stern (ohne Sprache, ohne Kanal) —
    /// SKU, EAN, MATNR, Artikelnummer, beliebig viele je Modell, jedes für sich. Eindeutige Werte sind die Schlüssel eines Knotens:
    /// sie benennen die Variante ohne ★, stehen als <c>keys</c> in der Baumzeile (Suche, Auswahl), finden beim Tabellen-Import den
    /// Knoten wieder und kommen beim Kopieren nicht mit. Ein „Kennungsattribut“ gibt es nicht.</summary>
    public bool IsUnique => Unique;
    /// <summary>Typ formula oder template: der Wert ist Skript bzw. Vorlage, das Ergebnis wird beim Lesen gerechnet.</summary>
    public bool IsComputed => Type is AttributeTypes.Formula or AttributeTypes.Template;
    public bool IsTemplate => Type == AttributeTypes.Template;
    public bool PerLocale => Axes?.Contains(Entries.Axes.Locale) ?? false;
    public bool PerChannel => Axes?.Contains(Entries.Axes.Channel) ?? false;
    public bool AllowedAt(string role) => Levels is null || Levels.Contains(role);
}

public sealed record AttributeRetired(string Key);

/// <summary>
/// Eine Werteliste (2): Strom <c>list:&lt;key&gt;</c>; die Werte sind eigene Einträge darauf.
/// <paramref name="Columns"/>: eigene Felder je Eintrag (Farbe: ral, hex) — der Eintrag ist ein
/// referenziertes Ding mit Eigenschaften, nicht ein Wort; ein Attribut, das auf die Liste
/// zeigt, sieht damit auch diese Felder.
/// </summary>
/// <param name="Closed">geschlossen: die Werte kommen aus einer Quelle (ETIM, Norm) — kein Zufügen von Hand in der Zelle; Pflege nur über das Modell oder die Quelle</param>
public sealed record ListDefinition(string Key, Labels Label, string[]? Columns = null, bool Closed = false);

/// <param name="Extra">Zusatzfelder je Wert, z. B. Farbe: {"hex": "#000000"}</param>
public sealed record ListValueDefinition(string Value, Labels Label, Dictionary<string, string>? Extra = null, int Order = 0);

/// <summary>Bedingung eines Attributs: <see cref="Attribute"/> hat am Knoten einen der <see cref="Values"/> (Gross/Klein egal).</summary>
public sealed record AttributeCondition(string Attribute, string[] Values)
{
    public bool Holds(string? value) => value is not null && Values.Any(v => string.Equals(v, value, StringComparison.OrdinalIgnoreCase));
}

public sealed record ListValueRetired(string Value);

/// <summary>Ein Attribut in einer Familie: Gruppe und Pflicht je Kanal (Sprachen oder "*").</summary>
public sealed record FamilyAttribute(string Key, string? Group = null, Dictionary<string, string[]>? Required = null);

/// <summary>
/// Eine Familie (3): welche Attribute ein Produkt hat, was Pflicht ist,
/// welche Variantenachsen erlaubt sind. Strom <c>family:&lt;key&gt;</c>.
/// </summary>
/// <param name="LabelAttribute">welches Attribut den Knoten im Baum benennt; null = <c>name</c></param>
public sealed record FamilyDefinition(string Key, Labels Label, List<FamilyAttribute> Attributes, string[]? Axes = null, string? LabelAttribute = null);

public sealed record FamilyRetired(string Key);

/// <summary>
/// Eine Attributgruppe (16): Label je Sprache und ab welchem Knotentyp ihre Werte
/// erfasst werden (<paramref name="ActiveFrom"/>, null = überall). Das Attribut
/// verweist mit <c>group</c> darauf; Gruppen hängen an Knoten (<see cref="GroupsAttached"/>).
/// </summary>
public sealed record AttributeGroupDefinition(string Key, Labels Label, string? ActiveFrom = null, string[]? Order = null, string? ReleaseWatch = null)
{
    /// <summary>Aktiv an dieser Rolle: ab <see cref="ActiveFrom"/> abwärts (group → product → variant).</summary>
    public bool ActiveAt(string role) => ActiveFrom is null || Roles.Depth(role) >= Roles.Depth(ActiveFrom);
}

/// <summary>
/// Freigabesteuerung: zählt eine Wertänderung in dieser Gruppe als Eingriff, der Prüfung und Freigabe berührt?
/// <c>auto</c> (leer): ja, wenn die Gruppe mindestens ein Pflichtfeld hat · <c>always</c>: immer · <c>never</c>: nie.
/// Am Attribut zusätzlich <c>null</c> = wie die Gruppe. WAS dann geschieht (Zustand zurück, Freigabe zurücknehmen, nur anzeigen),
/// sagt der Workflow — der Schalter sagt nur, ob die Änderung zählt.
/// </summary>
public static class ReleaseWatch
{
    public const string Auto = "auto";
    public const string Always = "always";
    public const string Never = "never";
    public static readonly string[] All = [Auto, Always, Never];
}

/// <summary>Altlast (17.09.2026): Name im Baum je Knotentyp. Ersetzt durch das Sternchen am Knoten (<see cref="LabelAttributeSet"/>). Bleibt lesbar, wird nicht mehr geschrieben.</summary>
public sealed record TreeLabelDefined(string Role, string Attribute);

public sealed record AttributeGroupRetired(string Key);

/// <summary>Eine Gruppe in einer Sicht mit der Reihenfolge ihrer Attribute dort; ungenannte Attribute hängen unten an. Gruppen, die die Sicht nicht nennt, zeigt sie nicht.</summary>
public sealed record ViewItem(string Group, string[]? Order = null);

/// <summary>
/// Eine Sicht (15): für einen Knotentyp die Gruppen in Reihenfolge und darin die
/// Attribute in Reihenfolge — redaktionell, technisch, Preise, alles.
/// Strom <c>view:&lt;key&gt;</c>, ganze Definition je Eintrag.
/// </summary>
public sealed record ViewDefinition(string Key, Labels Label, List<ViewItem> Items, string Level);

public sealed record ViewRetired(string Key);

/// <summary>
/// Eine Einheit (14): gehört zu einer Grösse (mass, length, data …) und hat
/// einen Faktor zur Basiseinheit dieser Grösse (kg = 1, g = 0.001). Damit
/// rechnet die Anzeige um; im Journal steht der Wert immer in der Einheit des Attributs.
/// </summary>
public sealed record UnitDefinition(string Key, Labels Label, string Quantity, decimal Factor = 1);

public sealed record UnitRetired(string Key);

/// <summary>Begriff im Wörterbuch (9): Text je Sprache, an einer Stelle gepflegt — Fachwort, Einheit, Listenwert. Übersetzung: Glossar
/// für KI und DeepL und Gedächtnis (gleicher Quelltext → derselbe Zieltext). <c>Note</c>: Kontext für Übersetzer.</summary>
public sealed record TermDefined(Labels Text, string? Note = null);
public sealed record TermRetired();

/// <summary>Zustand eines Workflows (27): Key, Text je Sprache, Farbe (Token oder Hex), Final = Ende des Wegs.</summary>
public sealed record WfState(string Key, Labels Label, string? Color = null, bool Final = false, int? X = null, int? Y = null);   // X/Y: Lage im Designer, null = Reihe
/// <summary>Übergang: von → nach, wer ihn gehen darf (Rollen; leer = jede Rolle mit Schreibrecht), Notiz Pflicht (Korrekturschleife),
/// Wirkungen: <c>release:&lt;kanal&gt;</c>, <c>revoke:&lt;kanal&gt;</c>, <c>status:&lt;wert&gt;</c>.</summary>
public sealed record WfTransition(string Key, string From, string To, Labels Label, string[]? Roles = null, bool NoteRequired = false, string[]? Effects = null, int? EscalateAfterDays = null, string[]? EscalateRoles = null, string? FromPort = null, string? ToPort = null, int? LabelX = null, int? LabelY = null, int[]? Route = null, string? Job = null);   // Job: ein Job des Tasker, der nach diesem Schritt startet — die Brücke zu Import und Export (34 I). Route: Stützpunkte x,y,x,y … des Pfeilwegs aus dem Layout (dagre), null = Bogen. LabelX/Y: Lage der Beschriftung im Designer (null = auf dem Bogen). FromPort/ToPort: Andockpunkt „seite:anteil“ (top:0.25), null = automatisch. Eskalation: nach n Tagen im Zustand dürfen auch EscalateRoles (leer = jede Rolle mit Schreibrecht)
/// <summary>Ein Workflow: Zustände, Übergänge, Start; gilt für Knotentypen (Roles) und Familien (leer = alle).</summary>
public sealed record WorkflowDefined(Labels Label, List<WfState> States, List<WfTransition> Transitions, string? Start = null, string[]? Roles = null, string[]? Families = null, bool PerLocale = false);   // PerLocale: je Sprache ein eigener Zustand — „Französisch in Korrektur, Deutsch freigegeben“
public sealed record WorkflowRetired();
/// <summary>Am Knoten: ein Schritt gegangen — der Zustand danach, der Übergang, die Notiz.</summary>
public sealed record WorkflowStateSet(string Workflow, string? State, string? Transition = null, string? Note = null, string? Locale = null);   // State leer = eigenen Zustand aufheben, es gilt wieder der geerbte. Locale nur bei PerLocale-Workflows; leer = der Zustand des Knotens (jeder Eintrag von früher bleibt gültig)

/// <summary>
/// Übersetzung, die Marke (docs/pflegestruktur.md 30): der Zielwert in <see cref="Locale"/> ist gegen <em>diese</em> Quellfassung übersetzt
/// (<see cref="SourceHash"/>, gesetzt bei Journalnummer <see cref="SourceAt"/>). Nicht „wann zuletzt geschrieben“, sondern
/// „gegen was übersetzt“ — daran hängt der Rückstand: ist die Quelle seither weitergezogen, bleibt die Einheit offen,
/// obwohl der Zieltext frisch geschrieben wurde. Der Strom ist der Knoten.
/// </summary>
public sealed record TranslationMarked(string Attribute, string Locale, string? Channel, string? Row, string SourceHash, long SourceAt, string? Order = null);

/// <summary>Eine Einheit im Auftrag: die Id (<c>node|attribut|kanal|zeile</c>) und die Fingerabdrücke, die hinausgingen.</summary>
public sealed record OrderUnit(string Id, string SourceHash, string? TargetHash = null);

/// <summary>
/// Übersetzung, das Paket (30): ein Auftrag ist ein Zeiger ins Journal — Sprachrichtung, Umfang, Stand und die Einheiten mit
/// ihren Fingerabdrücken. Die Datei (XLIFF, CSV) ist nur die Kopie für unterwegs. Strom <c>translation:&lt;key&gt;</c>.
/// </summary>
public sealed record TranslationOrdered(string From, string To, List<OrderUnit> Units, string? Root = null, string? Channel = null, string[]? Attributes = null, string? Scope = null, long At = 0, string? Note = null);

/// <summary>Der Auftrag ist zurück: was geschrieben wurde, was im Rückstand bleibt (Quelle weitergezogen), was ein Mensch ansehen muss.</summary>
public sealed record TranslationReturned(int Written, int Behind, int Conflicts, int Skipped, string? Note = null);
/// <summary>Am Knoten: Zuständigkeit für den nächsten Schritt — eine Person (Benutzer-Key) oder null (die Rolle des Übergangs).</summary>
public sealed record WorkflowAssigned(string Workflow, string? User);

/// <summary>Werteliste, Sprache, Kanal aus dem Abbild (20.09.2026). Werte auf dieser Sprache/diesem Kanal bleiben im Journal.</summary>
public sealed record ListRetired(string Key);
public sealed record LocaleRetired(string Code);
public sealed record ChannelRetired(string Key);

/// <summary>
/// Die Mastersprache: Strom <c>settings:master_locale</c>. Pflichtfelder beim Anlegen
/// werden in ihr erfasst; ändert sich ein sprachabhängiger Wert in ihr, gelten die anderen Sprachen
/// als „zu überarbeiten“ (abgeleitet aus den Eintragsnummern, kein eigener Eintrag).
/// </summary>
public sealed record MasterLocaleDefined(string Code);

/// <summary>
/// Der Masterkanal: Strom <c>settings:master_channel</c>. Sprachen und Kanäle sind eine Matrix mit
/// je einem Stern (ohne Sprache / ohne Kanal). Der Master bekommt die Werte des Sterns und kann sie überschreiben;
/// abgeleitete Kanäle beziehen ihren Wert aus dem Masterkanal — wie abgeleitete Sprachen aus der Mastersprache.
/// </summary>
public sealed record MasterChannelDefined(string Key);

/// <summary>
/// Ausser Kraft: Strom <c>settings:sku_attribute</c>
/// sollte das eine Kennungsattribut benennen. Es gibt keines mehr — jedes Attribut mit <c>unique</c> ist ein Schlüssel. Der Typ bleibt,
/// weil Eintragstypen für immer sind; die Abbilder überlesen ihn.
/// </summary>
public sealed record SkuAttributeDefined(string Key);

/// <summary>
/// Erster Eintrag einer Rubrik. Ohne Parent ist sie die Wurzel eines Publikationsbaums: die Maximalstruktur
/// eines Kanals, optional für einen Markt — Ausleitungen filtern über das Attribut markets, nicht über eigene Bäume.
/// </summary>
public sealed record RubricCreated(string? Parent, Labels Label, string? Name = null, string? Channel = null, string? Market = null, string? Source = null);   // Source: die Pflegegruppe, aus der die Rubrik kopiert wurde

/// <summary>Kanal und Markt der Wurzel ändern.</summary>
public sealed record PubTreeSet(string? Channel, string? Market);

/// <summary>Stand einer Rubrik: eingefroren bei Journalnummer n — alles darunter liest die Pflege wie damals; null = live.
/// Gilt ab hier nach unten, die nächste Rubrik mit eigenem Stand übersteuert. Kein Kopieren: ein Zeiger, aktualisieren = neuer Zeiger.</summary>
public sealed record PubStandSet(long? JournalNumber);

/// <summary>Verweis: ein Pflegeknoten (Produktgruppe, Produkt) hängt in dieser Rubrik — derselbe Knoten darf in mehreren hängen. Order: Platz in der Rubrik.</summary>
public sealed record NodePlaced(string Node, int? Order = null);

public sealed record NodeUnplaced(string Node);

/// <summary>Regel-Verweis: „alles, worauf das zutrifft“ — kind name (Gruppen/Produkte namens name unter under) oder
/// attribute (Produkte mit attribute = value, geerbt zählt); role group|product; groupBy none | parent | attr:&lt;key&gt;. Rules.cs.</summary>
public sealed record PubRule(string Id, string Kind, string? Under, string? Role = null, string? Name = null, string? Attribute = null, string? Value = null, string? GroupBy = null, string? Label = null);
public sealed record RulePlaced(PubRule Rule);
public sealed record RuleRemoved(string Id);

/// <summary>Anzeigename eines Verweises in dieser Rubrik: nur für den Überblick im Publikationsbaum, nie für die Ausgabe. Leer = Pflegename.</summary>
public sealed record PlaceNamed(string Node, string? Name);

/// <summary>
/// Ein Relationstyp (18): Strom <c>relation:&lt;key&gt;</c>. <paramref name="Reverse"/> ist die Bezeichnung
/// vom Ziel aus („Zubehör von"); <paramref name="From"/>/<paramref name="To"/> schränken die Rollen ein
/// (null = alle); <paramref name="Group"/> ist die Attributgruppe, deren Attribute an der Relation
/// stehen (Menge, Slot …) — ohne Gruppe hat die Relation keine Werte. <paramref name="Symmetric"/>
///: die Relation liest sich von beiden Enden gleich
/// („verwandt"), es gibt sie je Paar nur einmal; sonst einseitig mit Lesart hin (<paramref name="Label"/>,
/// „hat Zubehör") und zurück (<paramref name="Reverse"/>, „ist Zubehör von").
/// </summary>
public sealed record RelationTypeDefinition(string Key, Labels Label, Labels? Reverse = null, string[]? From = null, string[]? To = null, string? Group = null, bool Symmetric = false)
{
    public bool FromAllowed(string role) => From is null || From.Contains(role);
    public bool ToAllowed(string role) => To is null || To.Contains(role);
}

public sealed record RelationTypeRetired(string Key);

/// <summary>Plugin installiert (oder aktualisiert): Fassung und das Manifest (plugin.json), wie es dabei war.</summary>
public sealed record PluginInstalled(string Version, string Manifest);
public sealed record PluginEnabled();
public sealed record PluginDisabled();
public sealed record PluginRemoved();
/// <summary>Benannter Datensatz eines Plugins (Datenblatt-Vorlage, Import-Zuordnung, Prüfregel …); Value ist JSON-Text, leer = weg. Der letzte gewinnt.</summary>
public sealed record PluginDataSet(string Name, string? Value);

/// <summary>Ein Job: Plugin mit Prozess, Parameter (ohne Geheimnisse — die liegen in jobs/secrets.json), Zeitplan als cron
/// „m h dom mon dow“ (leer = nur von Hand), an/aus, Zeitgrenze. Der letzte Eintrag gilt ganz.
/// Service: Schlüssel aus processes[] im Manifest; leer = der eine process.</summary>
/// <summary>
/// Ein Job. <paramref name="Role"/> sagt, mit welcher Rolle der Lauf arbeitet — null heisst wie bisher editor. Setzen darf sie nur, wer Anwender
/// und Rollen verwaltet; sonst könnte sich jeder über einen Job Rechte verschaffen.
/// <para><paramref name="Owner"/> ist der Anwender, auf dessen Kontingent der Lauf geht — sonst
/// liefe ein Import als Job daran vorbei: der Urheber <c>job:&lt;key&gt;</c> ist kein Anwender.</para>
/// </summary>
public sealed record JobDefined(string Label, string Plugin, Dictionary<string, string>? Params, string? Schedule, bool Enabled = true, int? TimeoutMinutes = null, string? Service = null, JobFiles? Files = null, string? Role = null, string? Owner = null);

/// <summary>
/// Fächer eines Jobs (docs/tasker-dateien.md): <c>Base</c> = Verzeichnis mit in/, done/, failed/, out/ (leer = jobs/&lt;key&gt;;
/// ein Share, auf dem ERP ablegt, ist erlaubt), <c>Keep</c> = Aufbewahrung der Ausgaben („10“ Läufe, „30d“ Tage, leer = alle),
/// <c>Latest</c> = nach jedem erfolgreichen Lauf eine Kopie unter stabilem Namen (Kopie, kein Link), <c>Archive</c> =
/// verarbeitete Eingänge und Ausgaben zusätzlich als Medium im Medienspeicher (Vorgabe aus).
/// </summary>
public sealed record JobFiles(string? Base = null, string? Keep = null, bool Latest = false, bool Archive = false);
/// <summary>Eingang verarbeitet: <c>Status</c> ok | failed | duplicate (gleicher Hash schon verarbeitet — ohne Lauf nach done/).</summary>
public sealed record JobFileConsumed(string Run, string Name, string Hash, long Bytes, string Status, string? MediaId = null);
/// <summary>Ausgabe geschrieben; <c>Latest</c>: dazu unter dem stabilen Namen kopiert.</summary>
public sealed record JobFileWritten(string Run, string Name, string Hash, long Bytes, bool Latest = false, string? MediaId = null);
public sealed record JobRetired();
/// <summary>Lauf begonnen: Kennung des Laufs und Auslöser (schedule | manual).</summary>
public sealed record JobRunStarted(string Run, string Trigger);
/// <summary>Lauf zu Ende: ok | failed | timeout | cancelled, Rückgabewert, Dauer, letzte Zeile der Ausgabe, Grösse des Logs.</summary>
public sealed record JobRunFinished(string Run, string Status, int? Exit, double Seconds, string? Summary, long LogBytes);

/// <summary>Version eines Knotens: laufende Nummer je Knoten, der Journalstand (alles bis dahin ist der Stand — auch das Modell von
/// damals), wahlweise Kanal/Sprache, Anmerkung, Aufbewahrung in Jahren (Vorgabe 10). Belege kommen als VersionDocumentAdded dazu.</summary>
public sealed record VersionCreated(int Nr, long JournalNumber, string? Channel, string? Locale, string? Note, int RetentionYears = 10);
/// <summary>Beleg zur Version: Art (datasheet, sds …), das Medium (Hash, Typ, Name) und welcher Erzeuger (Plugin) es lieferte.</summary>
public sealed record VersionDocumentAdded(int Nr, string Kind, string MediaId, string Sha256, string Mime, string Name, long Bytes, string? Renderer);
/// <summary>Version zurückgezogen (fehlerhaft, ersetzt) — bleibt sichtbar, gilt nicht mehr.</summary>
public sealed record VersionWithdrawn(int Nr, string? Reason);

/// <summary>Benutzer: Anzeigename, E-Mail, Rolle (admin | editor | reader), an/aus. Der letzte Eintrag gilt ganz. Kein Geheimnis hier (auth.json).</summary>
public sealed record UserDefined(string Name, string? Email, string Role, bool Enabled = true, string? Team = null);   // Team: wessen Schlüssel und wessen Rechnung

/// <summary>
/// Ein Team. Die Schlüssel selbst
/// stehen nie im Journal — sie liegen im Datenverzeichnis unter <c>team:&lt;key&gt;</c>, wie Mailpasswort und Job-Token.
/// <para><b>Ein Team ist kein Guthaben.</b> Wer keinen eigenen Schlüssel hinterlegt, zahlt nichts selbst, sondern benutzt den
/// eines anderen Teams (<see cref="KeysFrom"/>) — und dann gilt dessen Reissleine für die Summe aller, die daran hängen.
/// Sonst wäre ein neues Team ein neuer Freibetrag.</para>
/// <para><see cref="MonthlyTokens"/> warnt nur; <see cref="DailyTokens"/> weist ab. Die Reissleine soll den Amoklauf stoppen
/// (Schleife im Job), nicht die Arbeit: hoch ansetzen. Ein Budget, das sperrt, erzeugt Streit statt Steuerung.</para>
/// </summary>
public sealed record TeamDefined(string Label, string? Note = null, long MonthlyTokens = 0, long DailyTokens = 0, bool Enabled = true, string? KeysFrom = null, long IncludedTokens = 0, string[]? Managers = null, Dictionary<string, string>? Models = null, int EntriesWeek = 0, int EntriesMonth = 0);
// EntriesWeek/EntriesMonth und MonthlyTokens/DailyTokens sind die Limits, die der Administrator aus der Lizenz verteilt
//. Das Init Team trägt die der Lizenz, jedes weitere
// startet bei 0. IncludedTokens ist die Altlast des ersten Entwurfs — die Lizenz sagt, was inklusive ist.
// IncludedTokens: das Grundrauschen — nur am ersten Team. Managers: „nur der Administrator kann ein neues
// Team erstellen, und dazu muss er mindestens einen zum Teammanager machen, notfalls sich selbst. Der Teammanager kann
// Benutzer seinem Team zufügen — aber nur Benutzer, die in keinem Team sind — und sie wieder entfernen.“
public sealed record TeamRetired();

/// <summary>
/// Ein Schlüssel wurde eingelöst. Das Team entscheidet sich erst hier, beim Einlösen.
/// <para><paramref name="Kind"/>: <c>reset</c> — das Team zählt ab <paramref name="From"/> neu; <c>limit</c> — das
/// Team hat von <paramref name="From"/> bis <paramref name="Until"/> (beide eingeschlossen) mindestens
/// <paramref name="EntriesWeek"/>/<paramref name="EntriesMonth"/>. Beide Arten sind kombinierbar, und keine
/// überschreibt die andere: ein Reset setzt nur den Zählbeginn, ein Limit nur das Kontingent.</para>
/// <para><paramref name="Until"/> ist schon umgerechnet: lief beim Einlösen ein anderer Limit-Schlüssel, ist sein
/// Restvolumen in Tage dieses Schlüssels umgerechnet und angehängt (<paramref name="Carried"/>). So steht die Rechnung
/// im Journal und nicht in einer Formel, die sich später ändern könnte.</para>
/// </summary>
public sealed record KeyRedeemed(string Id, string Kind, DateOnly From, DateOnly? Until = null, int EntriesWeek = 0, int EntriesMonth = 0, int Days = 0, int Carried = 0, string? Plan = null);

/// <summary>
/// Der Stand eines Abos, wie ihn der Lizenzserver signiert bestätigt hat (Taloan, 24.09.2026): Tarif, Grenzen, Status,
/// bezahlt bis, gilt ohne neue Abfrage bis (+7 Tage), Fingerabdruck der Anfrage, Signatur. Die Instanz fragt täglich;
/// jede Antwort ist ein Eintrag — so lassen sich Grenzen und Tarif jederzeit aus dem Journal neu aufbauen.
/// </summary>
public sealed record EntitlementReceived(string Instance, string Team, string Plan, int EntriesWeek, int EntriesMonth, string Status,
    DateOnly PaidUntil, DateTimeOffset Issued, DateTimeOffset ValidUntil, string Request, string? Sig = null, bool Geprueft = false);

/// <summary>
/// Ein Tarifblatt des Lizenzservers (25.09.2026): <paramref name="Blatt"/> ist der Text, so wie er signiert wurde,
/// <paramref name="Sig"/> die Signatur. Es kommt mit einem Abo-Stand oder einem Schlüssel zum Kopieren und nennt alle
/// Tarife mit Grenzen, Publikationsbäumen und Plugins, dazu den Test. Es gilt die höchste Fassung, deren Signatur passt —
/// das Abbild prüft sie selbst, ein Eintrag ohne passende Signatur ändert nichts.
/// </summary>
public sealed record TarifeReceived(string Blatt, string Sig);

/// <summary>
/// Ob diese Anlage beim Lizenzserver registriert ist (26.09.2026). Registriert heisst: sie holt dort das Tarifblatt und
/// nennt dabei ihre Kennung und ihren öffentlichen Schlüssel — damit kennt sie die Tarife und die Aktionen des Shops.
/// Nicht registriert heisst: sie spricht nicht mit ihm, solange kein Team ein Abo hat. Gefragt wird einmal; die Antwort
/// steht im Journal, damit jeder Server dieser Anlage sie kennt und niemand zweimal gefragt wird.
/// </summary>
public sealed record RegistrationSet(bool Registered);

/// <summary>Ein KI-Aufruf, wie er wirklich stattgefunden hat: Anbieter, Modell, Person, Token hin und zurück. Strom
/// <c>ai-usage:&lt;team&gt;</c> — gezählt wird beim Team, das zahlt (also beim schlüsselführenden), damit die Rechnung stimmt.</summary>
/// <summary>
/// Ein KI-Aufruf, wie er stattgefunden hat. <paramref name="BytesIn"/> und <paramref name="BytesOut"/> sind das, was
/// journali gemessen hat: die Bytes der Anfrage und der Antwort auf der eigenen Leitung. Über
/// Tokens und Kosten sagt journali nichts — <paramref name="In"/> und <paramref name="Out"/> trugen bis dahin die
/// Tokenzahlen des Anbieters und bleiben nur deshalb stehen, weil ein Eintragstyp für immer ist; gefüllt werden sie
/// nicht mehr. <paramref name="Purpose"/> sagt, welche Funktion gefragt hat.
/// </summary>
public sealed record AiUsed(string Provider, string Model, string? User, int In, int Out, int Calls = 1, string? Day = null, string? OnBehalfOf = null, long BytesIn = 0, long BytesOut = 0, string? Purpose = null);

/// <summary>
/// Was ein Benutzer für sich eingestellt hat — Darstellung,
/// Sichtsprachen, Zellen, Sicht je Knotentyp, Umfang, Attributnamen. Sie folgen der Person an jeden Rechner, darum stehen sie
/// im Journal und nicht im Browser. Nur Genanntes wird gesetzt, leerer Wert nimmt einen Schlüssel wieder weg; die Werte sind
/// JSON als Text, damit ein neuer Schalter keinen neuen Eintragstyp braucht.
/// <para>Der Fensterzustand bleibt im Browser (Journal auf/zu, zugeklappte Abschnitte, Reihenfolge der Leiste, Serveradresse):
/// er ändert sich ständig und gehört zum Gerät, nicht zur Person.</para>
/// </summary>
public sealed record UserPrefsSet(Dictionary<string, string> Prefs);

/// <summary>
/// Eine Rolle:
/// Strom <c>role:&lt;key&gt;</c>, Bezeichnung und die Rechte aus dem festen Vokabular <see cref="Rights"/>. Der letzte Eintrag gilt ganz.
/// </summary>
public sealed record RoleDefined(string Label, string[] Rights);
public sealed record RoleRetired();

/// <summary>Das Rechte-Vokabular — fest im Code, denn der Server muss jedes Recht prüfen können; welche Rolle welche hat, steht im Journal.</summary>
public static class Rights
{
    public const string Read = "read";         // lesen: Baum, Werte, Medien, Journal, Modell
    public const string Write = "write";       // pflegen: Knoten, Werte, Relationen, Medien, Stapel, Plugin-Daten (Profile), Belege
    public const string Retire = "retire";     // Knoten zurückziehen und wiederherstellen
    public const string Release = "release";   // Freigaben und Versionen
    public const string Model = "model";       // Modell ändern: Attribute, Gruppen, Listen, Sichten, Einheiten, Sprachen, Kanäle, Relationstypen
    public const string Plugins = "plugins";   // Plugins installieren, an/aus, entfernen
    public const string Jobs = "jobs";         // Jobs anlegen, starten, Logs
    public const string Storage = "storage";   // Medien-Speicher einstellen und kopieren
    public const string Users = "users";       // Benutzer und Rollen verwalten
    public const string Team = "team";         // das eigene Team: KI-Schlüssel hinterlegen, Grenzen setzen, Verbrauch sehen
    /// <summary>Herunterladen (27.09.2026): die Datei selbst und ihre Ableitungen — sehen ist nicht haben. Kacheln und
    /// die Angaben sieht, wer liest; das Original, ein Preset und die Blobs lädt, wer dieses Recht hat.</summary>
    public const string Download = "download";
    public static readonly string[] All = [Read, Write, Retire, Release, Model, Plugins, Jobs, Storage, Team, Users, Download];
    public static readonly Dictionary<string, string> Label = new()
    {
        [Read] = "Lesen", [Write] = "Pflegen", [Retire] = "Zurückziehen", [Release] = "Freigeben, Versionen", [Model] = "Modell ändern",
        [Plugins] = "Plugins verwalten", [Jobs] = "Jobs", [Storage] = "Storage", [Team] = "Teammanager", [Users] = "Anwender und Rollen",
        [Download] = "Herunterladen",
    };
    /// <summary>
    /// Was ein Recht mit einschliesst. Ein neues Recht hat keine bestehende Rolle — führte man <c>download</c> ein, ohne dass
    /// <c>write</c> es einschliesst, lüde am nächsten Morgen niemand mehr eine Datei, bis jede Rolle nachgepflegt ist. Darum
    /// steht die Regel hier im Kern und nicht in den Rollen: wer pflegt, lädt; wer Anwender verwaltet, führt auch Teams.
    /// </summary>
    public static readonly Dictionary<string, string[]> Implies = new()
    {
        [Write] = [Download],
        [Users] = [Team],
    };
    /// <summary>Die wirksamen Rechte einer Rolle: die eigenen und alles, was sie einschliessen.</summary>
    public static IReadOnlySet<string> Effective(IEnumerable<string> own)
    {
        var set = new HashSet<string>(own);
        foreach (var r in set.ToList()) if (Implies.TryGetValue(r, out var mehr)) set.UnionWith(mehr);
        return set;
    }
    /// <summary>Vorbelegte Rollen — Saatgut für ein leeres Journal; der Anwender ändert, ergänzt, entfernt sie (nur „admin“ bleibt als Schlüssel bekannt).</summary>
    public static IEnumerable<(string Key, RoleDefined Role)> Seeds()
    {
        yield return ("admin", new RoleDefined("Administrator", All));
        yield return ("manager", new RoleDefined("PIM-Manager", [Read, Write, Retire, Release, Model, Jobs]));
        // Team-Admin: pflegt sein eigenes Team — Schlüssel, Grenzen, Verbrauch. Neue Teams und die Zuordnung
        // von Personen bleiben bei „Benutzer und Rollen“; sonst könnte sich jeder Mitglieder in seine Kasse holen.
        yield return ("teamadmin", new RoleDefined("Team-Admin", [Read, Write, Team]));
        yield return ("editor", new RoleDefined("PIM-Editor", [Read, Write, Retire, Release]));
        yield return ("reader", new RoleDefined("Leser", [Read]));
    }
}
public sealed record UserRetired();
