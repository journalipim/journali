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
    public const string NodeRetired = "NodeRetired";
    /// <summary>Zurückgezogenen Knoten zurückholen — mit allem, was er hatte (Taloan: „kein Rückgängig nach Löschen?“).</summary>
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
    public const string LabelAttributeSet = "LabelAttributeSet";
    public const string ExternalLinked = "ExternalLinked";
    public const string ExternalUnlinked = "ExternalUnlinked";

    // Werte an einem Knoten
    public const string AttributeSet = "AttributeSet";
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
    public const string ChannelDefined = "ChannelDefined";
    public const string AttributeDefined = "AttributeDefined";
    public const string AttributeRetired = "AttributeRetired";
    public const string ListDefined = "ListDefined";
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
    public const string MasterLocaleDefined = "MasterLocaleDefined";
    public const string RelationTypeDefined = "RelationTypeDefined";
    public const string RelationTypeRetired = "RelationTypeRetired";

    // Plugins (docs/pflegestruktur.md, 19): Strom plugin:<key>
    public const string PluginInstalled = "PluginInstalled";
    public const string PluginEnabled = "PluginEnabled";
    public const string PluginDisabled = "PluginDisabled";
    public const string PluginRemoved = "PluginRemoved";
    public const string PluginDataSet = "PluginDataSet";      // benannter Datensatz eines Plugins (Vorlage, Zuordnung, Regel) — JSON-Text

    // Jobs (Plugin tasker, Taloan 19.09.2026): Strom job:<key> — Definition, jeder Lauf mit Ausgang; das Log liegt als Datei
    public const string JobDefined = "JobDefined";
    public const string JobRetired = "JobRetired";
    public const string JobRunStarted = "JobRunStarted";
    public const string JobRunFinished = "JobRunFinished";

    // Versionen (Taloan, 19.09.2026: Freigabe = Version, nach draussen zaehlt das Belegdokument): am Knotenstrom —
    // Zeiger auf den Journalstand, eingefrorene Belege (hash-adressiert im Medienspeicher), zurueckgezogen nur markiert
    public const string VersionCreated = "VersionCreated";
    public const string VersionDocumentAdded = "VersionDocumentAdded";
    public const string VersionWithdrawn = "VersionWithdrawn";

    // Benutzer (Taloan, 19.09.2026: Benutzer und Rollen): Strom user:<key> — wer es gibt und welche Rolle; Passwoerter nie im Journal
    public const string UserDefined = "UserDefined";
    public const string UserRetired = "UserRetired";

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
    /// <summary>Kein Baumknoten: ein Medium als Ziel einer Relation (20).</summary>
    public const string Media = "media";
    public static readonly IReadOnlyList<string> All = [Group, Product, Variant];
    /// <summary>Tiefe im Baum: Gruppe 0, Produkt 1, Variante 2 — für „aktiv ab“.</summary>
    public static int Depth(string role) => role switch { Group => 0, Product => 1, Variant => 2, _ => 0 };
}

/// <summary>Status eines Produkts oder einer Variante; discontinued am Produkt überstimmt alles darunter.</summary>
public static class Statuses
{
    public const string Draft = "draft";
    public const string Active = "active";
    public const string Discontinued = "discontinued";
    public static readonly IReadOnlyList<string> All = [Draft, Active, Discontinued];
}

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

/// <summary>Variantenachsen eines Produkts nachträglich (ganze Liste) — nur, solange es keine Varianten hat (Taloan, 17.09.2026).</summary>
public sealed record ProductAxesSet(string[] Axes);

/// <summary>Erster Eintrag einer Variante: je Variantenachse des Produkts ein Wert.</summary>
public sealed record VariantCreated(string Product, Dictionary<string, string> AxisValues);

public sealed record NodeMoved(string Parent);

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

/// <summary>Externe Kennung je Quellsystem (Import): beim zweiten Lauf Update statt Neuanlage.</summary>
public sealed record ExternalLinked(string System, string Id);

public sealed record ExternalUnlinked(string System);

// ---- Werte an einem Knoten ------------------------------------------------

/// <summary>
/// Ein Attributwert auf seinen Achsen. Fehlende Achse = gilt für alle.
/// <paramref name="Values"/> statt <paramref name="Value"/> bei mehrfachen Attributen.
/// <paramref name="Row"/>: Zeile eines vermehrbaren Attributs (docs/pflegestruktur.md, 13).
/// Leerer Wert = eigener Wert weg, Rückfall gilt wieder.
/// </summary>
public sealed record AttributeSet(string Attribute, string? Locale, string? Channel, string? Value, string[]? Values = null, string? Row = null);

/// <summary>Neue Zeile eines vermehrbaren Attributs; die Zellen kommen per <see cref="AttributeSet"/> mit <c>row</c>.</summary>
public sealed record RowAdded(string Attribute, string Row);

public sealed record RowRemoved(string Attribute, string Row);

/// <summary>
/// Beleg an einem Wert (Taloan, 20.09.2026: „Quelle: URL, geprüft am …“ — Anreicherung fremder Produktdaten, Recherche der KI):
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

public sealed record LocaleDefinition(string Code, string Label);

public sealed record ChannelDefinition(string Key, Labels Label);

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
    /// Formel (Taloan, 17.09.2026): der Wert ist ein Skript (<see cref="Entries.Formula"/>), gepflegt wie jeder
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
/// <param name="Pattern">Muster (regulärer Ausdruck), dem jeder Wert genügen muss — Telefon, E-Mail, EAN … (Taloan, 17.09.2026); nur bei text</param>
/// <param name="PatternHint">was das Muster verlangt, für die Fehlermeldung („+49 30 1234567")</param>
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
    string? PatternHint = null)
{
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
public sealed record ListDefinition(string Key, Labels Label, string[]? Columns = null);

/// <param name="Extra">Zusatzfelder je Wert, z. B. Farbe: {"hex": "#000000"}</param>
public sealed record ListValueDefinition(string Value, Labels Label, Dictionary<string, string>? Extra = null, int Order = 0);

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
public sealed record AttributeGroupDefinition(string Key, Labels Label, string? ActiveFrom = null, string[]? Order = null)
{
    /// <summary>Aktiv an dieser Rolle: ab <see cref="ActiveFrom"/> abwärts (group → product → variant).</summary>
    public bool ActiveAt(string role) => ActiveFrom is null || Roles.Depth(role) >= Roles.Depth(ActiveFrom);
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

/// <summary>
/// Die Mastersprache (Taloan, 17.09.2026): Strom <c>settings:master_locale</c>. Pflichtfelder beim Anlegen
/// werden in ihr erfasst; ändert sich ein sprachabhängiger Wert in ihr, gelten die anderen Sprachen
/// als „zu überarbeiten“ (abgeleitet aus den Eintragsnummern, kein eigener Eintrag).
/// </summary>
public sealed record MasterLocaleDefined(string Code);

/// <summary>
/// Ein Relationstyp (18): Strom <c>relation:&lt;key&gt;</c>. <paramref name="Reverse"/> ist die Bezeichnung
/// vom Ziel aus („Zubehör von"); <paramref name="From"/>/<paramref name="To"/> schränken die Rollen ein
/// (null = alle); <paramref name="Group"/> ist die Attributgruppe, deren Attribute an der Relation
/// stehen (Menge, Slot …) — ohne Gruppe hat die Relation keine Werte. <paramref name="Symmetric"/>
/// (Taloan, 17.09.2026: „Richtung beidseitig"): die Relation liest sich von beiden Enden gleich
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
/// Service (Taloan, 19.09.: mehrere Dienste je Plugin): Schlüssel aus processes[] im Manifest; leer = der eine process.</summary>
public sealed record JobDefined(string Label, string Plugin, Dictionary<string, string>? Params, string? Schedule, bool Enabled = true, int? TimeoutMinutes = null, string? Service = null);
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
public sealed record UserDefined(string Name, string? Email, string Role, bool Enabled = true);
public sealed record UserRetired();
