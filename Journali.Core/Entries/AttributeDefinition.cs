namespace Journali.Core.Entries;

/// <summary>
/// Ströme des Modells und das Saatgut für ein leeres Journal. Das Modell
/// selbst steht im Journal (docs/pflegestruktur.md, Grundsatz); dies hier
/// ist nur, womit ein neues Journal anfängt: Einheiten,
/// zwei Sprachen, zwei Kanäle, Gruppen mastergroup/logistics/physical, Werteliste
/// Farben mit RAL, Sicht DefaultView je Knotentyp, Wurzelknoten „MasterTree“.
/// Fehlende Ströme werden bei jedem Start nachgesät (Catalog.SeedMissing).
/// </summary>
public static class Model
{
    public const string LocaleStream = "locale:";
    public const string ChannelStream = "channel:";
    public const string StatusStream = "status:";
    public const string AttributeStream = "attribute:";
    public const string ListStream = "list:";
    public const string FamilyStream = "family:";
    public const string UnitStream = "unit:";
    public const string TermStream = "term:";
    public const string ViewStream = "view:";
    public const string GroupStream = "group:";
    public const string LabelStream = "settings:label:";
    public const string MasterLocaleStream = "settings:master_locale";
    public const string MasterChannelStream = "settings:master_channel";
    /// <summary>Das Team, das jede Anlage mitbringt: nicht löschbar, umbenennbar; hierher fällt, wer kein eigenes trägt.</summary>
    public const string InitTeam = "init";
    public const string RelationStream = "relation:";
    /// <summary>Gruppe der Werte am Medium (20).</summary>
    public const string MediaGroup = "media";
    /// <summary>Die Werteliste der Stichwörter und das vermehrbare Attribut am Medium, das aus ihr wählt.</summary>
    public const string KeywordList = "keyword";
    public const string KeywordAttribute = "keywords";
    /// <summary>Fristen am Medium (Datum, Gruppe media) und die Werteliste der Lizenzen.</summary>
    public const string ValidFrom = "valid_from";
    public const string ValidUntil = "valid_until";
    public const string LicenceList = "licence";
    /// <summary>Die feste Gruppe für Attribute, die aus einem Dokument entstehen (34 L) — später im Modell einzuordnen.</summary>
    public const string DocGroup = "from_document";

    /// <summary>Das Saatgut-Attribut SKU — eindeutig (unique) wie jedes andere Schlüsselattribut; im Code sonst nichts Besonderes.</summary>
    public const string SkuAttribute = "sku";

    /// <summary>Der Wurzelknoten des Saatguts — feste Id, damit er nur einmal entsteht.</summary>
    public const string RootNode = "g-mastertree";

    /// <summary>Ein Modell-Eintrag: Strom, Typ, Nutzdaten — fertig zum Anhängen.</summary>
    public sealed record Seed(string Stream, string Type, string Payload);

    public static IEnumerable<Seed> Seeds()
    {
        yield return new(LocaleStream + "de", Types.LocaleDefined, Types.Serialize(new LocaleDefinition("de", "Deutsch")));
        yield return new(LocaleStream + "en", Types.LocaleDefined, Types.Serialize(new LocaleDefinition("en", "English")));
        yield return new(MasterLocaleStream, Types.MasterLocaleDefined, Types.Serialize(new MasterLocaleDefined("de")));
        yield return new(MasterChannelStream, Types.MasterChannelDefined, Types.Serialize(new MasterChannelDefined("web")));
        yield return new(ChannelStream + "web", Types.ChannelDefined, Types.Serialize(new ChannelDefinition("web", Labels.Of("Web", "Web"))));
        yield return new(ChannelStream + "print", Types.ChannelDefined, Types.Serialize(new ChannelDefinition("print", Labels.Of("Print", "Print"))));
        // Status-Saat: die drei bisherigen — danach frei erweiterbar (z. B. Überprüfung, Freigabe, Verkauf DE, Verkauf weltweit)
        yield return new(StatusStream + "draft", Types.StatusDefined, Types.Serialize(new StatusDefinition("draft", Labels.Of("Entwurf", "Draft"), "muted", "○", 10)));
        yield return new(StatusStream + "active", Types.StatusDefined, Types.Serialize(new StatusDefinition("active", Labels.Of("aktiv", "active"), "pos", "●", 20)));
        yield return new(StatusStream + "discontinued", Types.StatusDefined, Types.Serialize(new StatusDefinition("discontinued", Labels.Of("ausgelaufen", "discontinued"), "neg", "✗", 30)));

        UnitDefinition[] units =
        [
            new("kg", Labels.Of("Kilogramm", "kilogram"), "mass", 1),
            new("g", Labels.Of("Gramm", "gram"), "mass", 0.001m),
            new("m", Labels.Of("Meter", "metre"), "length", 1),
            new("cm", Labels.Of("Zentimeter", "centimetre"), "length", 0.01m),
            new("mm", Labels.Of("Millimeter", "millimetre"), "length", 0.001m),
            new("in", Labels.Of("Zoll", "inch"), "length", 0.0254m),
            new("l", Labels.Of("Liter", "litre"), "volume", 1),
            new("ml", Labels.Of("Milliliter", "millilitre"), "volume", 0.001m),
            new("GB", Labels.Of("Gigabyte", "gigabyte"), "data", 1),
            new("MB", Labels.Of("Megabyte", "megabyte"), "data", 0.001m),
            new("TB", Labels.Of("Terabyte", "terabyte"), "data", 1000),
            new("pc", Labels.Of("Stück", "pieces"), "count", 1),
        ];
        foreach (var u in units)
            yield return new(UnitStream + u.Key, Types.UnitDefined, Types.Serialize(u));

        AttributeGroupDefinition[] groups =
        [
            new("mastergroup", Labels.Of("MasterGroup", "MasterGroup")),
            new("logistics", Labels.Of("Logistik", "Logistics"), ActiveFrom: Roles.Variant),
            new("physical", Labels.Of("Physisch", "Physical")),
            new(DocGroup, Labels.Of("aus Dokument", "From document")),
        ];
        foreach (var g in groups)
            yield return new(GroupStream + g.Key, Types.AttributeGroupDefined, Types.Serialize(g));

        // Märkte: Liste ohne Saatwerte — der Anwender trägt seine Länder ein; Spalte fallback = ein Markt bekommt
        // das Sortiment seines Fallback-Markts, solange er nichts Eigenes sagt. Attribut markets (mehrfach, vererbbar) am Verkaufbaren; leer = überall.
        yield return new(ListStream + Projections.Publication.MarketList, Types.ListDefined, Types.Serialize(new ListDefinition(Projections.Publication.MarketList, Labels.Of("Märkte", "Markets"), [Projections.Publication.FallbackColumn])));
        // Werteliste Farben: Eintrag = Farbe mit Namen je Sprache und RAL-Nummer (RAL Classic).
        yield return new(ListStream + "color", Types.ListDefined, Types.Serialize(new ListDefinition("color", Labels.Of("Farben", "Colours"), ["ral"])));
        (string Key, string De, string En, string Ral)[] colors =
        [
            ("white", "Weiss", "White", "9010"), ("black", "Schwarz", "Black", "9005"), ("red", "Rot", "Red", "3020"),
            ("blue", "Blau", "Blue", "5015"), ("green", "Grün", "Green", "6018"), ("yellow", "Gelb", "Yellow", "1023"),
            ("orange", "Orange", "Orange", "2004"), ("grey", "Grau", "Grey", "7035"), ("anthracite", "Anthrazit", "Anthracite", "7016"),
            ("brown", "Braun", "Brown", "8017"), ("beige", "Beige", "Beige", "1001"), ("ivory", "Elfenbein", "Ivory", "1015"),
            ("purple", "Violett", "Purple", "4005"), ("pink", "Rosa", "Pink", "3015"), ("magenta", "Magenta", "Magenta", "4010"),
            ("turquoise", "Türkis", "Turquoise", "5018"), ("mint", "Mint", "Mint", "6029"), ("navy", "Marineblau", "Navy", "5002"),
            ("silver", "Silber", "Silver", "9006"), ("gold", "Gold", "Gold", "1036"),
        ];
        var i = 0;
        foreach (var c in colors)
            yield return new(ListStream + "color", Types.ListValueDefined, Types.Serialize(new ListValueDefinition(c.Key, Labels.Of(c.De, c.En), new() { ["ral"] = c.Ral }, ++i)));

        AttributeDefinition[] attributes =
        [
            new("name", Labels.Of("Name", "Name"), AttributeTypes.Text, Group: "mastergroup", Axes: [Axes.Locale], Required: new() { ["web"] = ["*"], ["print"] = ["de"] }),
            new("description", Labels.Of("Beschreibung", "Description"), AttributeTypes.Html, Group: "mastergroup", Axes: [Axes.Locale, Axes.Channel]),
            new("color", Labels.Of("Farbe", "Colour"), AttributeTypes.Enum, Group: "mastergroup", List: "color"),
            new(SkuAttribute, Labels.Of("SKU", "SKU"), AttributeTypes.Text, Group: "logistics", Required: new() { ["web"] = ["*"], ["print"] = ["*"] }, Unique: true),
            new("ean", Labels.Of("EAN", "EAN"), AttributeTypes.Text, Group: "logistics"),
            new("weight", Labels.Of("Gewicht", "Weight"), AttributeTypes.Decimal, Unit: "kg", Group: "physical"),
            new(Projections.Publication.MarketsAttribute, Labels.Of("Verkaufsländer", "Markets"), AttributeTypes.Enum, Group: "mastergroup", List: Projections.Publication.MarketList, Multiple: true, Inheritable: true),
        ];
        foreach (var a in attributes)
            yield return new(AttributeStream + a.Key, Types.AttributeDefined, Types.Serialize(a));

        // Relationen (18): Zubehör, Bestandteil (mit Menge), Verwandt — die Gruppe relation_component trägt die Werte am Bestandteil.
        yield return new(GroupStream + "relation_component", Types.AttributeGroupDefined, Types.Serialize(new AttributeGroupDefinition("relation_component", Labels.Of("Bestandteil", "Component"))));
        yield return new(AttributeStream + "quantity", Types.AttributeDefined, Types.Serialize(new AttributeDefinition("quantity", Labels.Of("Menge", "Quantity"), AttributeTypes.Integer, Group: "relation_component")));
        yield return new(RelationStream + "accessory", Types.RelationTypeDefined, Types.Serialize(new RelationTypeDefinition("accessory", Labels.Of("Zubehör", "Accessory"), Labels.Of("Zubehör von", "Accessory of"))));
        yield return new(RelationStream + "component", Types.RelationTypeDefined, Types.Serialize(new RelationTypeDefinition("component", Labels.Of("Bestandteil", "Component"), Labels.Of("verbaut in", "part of"), Group: "relation_component")));
        yield return new(RelationStream + "related", Types.RelationTypeDefined, Types.Serialize(new RelationTypeDefinition("related", Labels.Of("Verwandt", "Related"), Labels.Of("Verwandt", "Related"), Symmetric: true)));
        yield return new(RelationStream + "bom", Types.RelationTypeDefined, Types.Serialize(new RelationTypeDefinition("bom", Labels.Of("Stückliste", "Bill of materials"), Labels.Of("Stückliste von", "Part of"), Group: "relation_component")));

        // Workflows (27): Redaktion mit Korrekturschleife, und „zur Übersetzung“ — Saatgut, in den Einstellungen änderbar
        yield return new(Projections.Workflows.Stream + "review", Types.WorkflowDefined, Types.Serialize(new WorkflowDefined(Labels.Of("Redaktion", "Editorial"),
            [new("draft", Labels.Of("Entwurf", "Draft"), "muted"), new("review", Labels.Of("Prüfung", "Review"), "warn"), new("rework", Labels.Of("Korrektur", "Rework"), "neg"), new("approved", Labels.Of("Freigegeben", "Approved"), "pos", true)],
            [new("submit", "draft", "review", Labels.Of("zur Prüfung", "Submit")), new("resubmit", "rework", "review", Labels.Of("erneut zur Prüfung", "Resubmit")),
             new("reject", "review", "rework", Labels.Of("zurück zur Korrektur", "Reject"), null, true), new("approve", "review", "approved", Labels.Of("freigeben", "Approve"), ["admin"], false, ["release:web"]),   // Wirkung: Freigabe für web an allen vollständigen Varianten
             new("reopen", "approved", "draft", Labels.Of("zurückziehen", "Withdraw"), ["admin"], true, ["revoke:web"])], "draft")));
        yield return new(Projections.Workflows.Stream + "translation", Types.WorkflowDefined, Types.Serialize(new WorkflowDefined(Labels.Of("Übersetzung", "Translation"),
            [new("none", Labels.Of("nicht angefordert", "Not requested"), "muted"), new("to_translate", Labels.Of("zur Übersetzung", "To translate"), "warn"), new("translated", Labels.Of("übersetzt", "Translated"), "accent"), new("checked", Labels.Of("geprüft", "Checked"), "pos", true)],
            [new("request", "none", "to_translate", Labels.Of("zur Übersetzung geben", "Request translation")), new("done", "to_translate", "translated", Labels.Of("übersetzt", "Translated")),
             new("check", "translated", "checked", Labels.Of("geprüft", "Checked")), new("back", "translated", "to_translate", Labels.Of("zurück zur Übersetzung", "Back to translation"), null, true),
             new("again", "checked", "to_translate", Labels.Of("erneut zur Übersetzung", "Translate again"))], "none", null, null, PerLocale: true)));   // je Sprache ein Zustand: „Französisch in Korrektur, Deutsch freigegeben“

        // Vorschau-Presets: was beim Import je Bild vorausberechnet wird — Saatgut, in den Einstellungen änderbar
        yield return new(Projections.Media.PresetStream + "thumb", Types.MediaPresetDefined, Types.Serialize(new MediaPresetDefined(Labels.Of("Kachel", "Tile"), 256, 256, "webp", 80)));
        yield return new(Projections.Media.PresetStream + "web", Types.MediaPresetDefined, Types.Serialize(new MediaPresetDefined(Labels.Of("Web", "Web"), 1200, 1200, "webp", 82)));
        yield return new(Projections.Media.PresetStream + "print", Types.MediaPresetDefined, Types.Serialize(new MediaPresetDefined(Labels.Of("Druck", "Print"), 3000, 3000, "jpeg", 90)));

        // Medien (20): Werte am Medium (Gruppe media), Werte an der Kante Knoten→Medium (Gruppe relation_media), Typen image und document.
        yield return new(GroupStream + "media", Types.AttributeGroupDefined, Types.Serialize(new AttributeGroupDefinition("media", Labels.Of("Medium", "Medium"))));
        yield return new(AttributeStream + "alt_text", Types.AttributeDefined, Types.Serialize(new AttributeDefinition("alt_text", Labels.Of("Alt-Text", "Alt text"), AttributeTypes.Text, Group: "media", Axes: [Axes.Locale])));
        yield return new(AttributeStream + "copyright", Types.AttributeDefined, Types.Serialize(new AttributeDefinition("copyright", Labels.Of("Rechte", "Copyright"), AttributeTypes.Text, Group: "media")));
        // Stichwörter: eine Werteliste im Modell, kein Freitext — sonst stehen „Bohrer“, „bohrer“ und „Bohrer “
        // nebeneinander und keine Facette fasst sie zusammen. Die Liste beginnt leer; neue Werte legt die Zelle an
        // („+ neuer Wert …“), und weil sie im Modell steht, ist sie übersetzbar.
        yield return new(ListStream + KeywordList, Types.ListDefined, Types.Serialize(new ListDefinition(KeywordList, Labels.Of("Stichwörter", "Keywords"))));
        yield return new(AttributeStream + KeywordAttribute, Types.AttributeDefined, Types.Serialize(
            new AttributeDefinition(KeywordAttribute, Labels.Of("Stichwörter", "Keywords"), AttributeTypes.Enum, Group: MediaGroup, List: KeywordList, Multiple: true)));
        // Fristen und Rechte (27.09.2026): ein Bild gilt von … bis; Lizenz aus einer Werteliste (beginnt leer), Quelle als Text.
        // Die Regel dazu (Medium.GueltigAm) beantworten Bibliothek, Knoten und Relationen gleich: abgelaufen heisst
        // nicht weg — es fällt aus der Ausleitung, nicht aus dem Journal.
        yield return new(AttributeStream + ValidFrom, Types.AttributeDefined, Types.Serialize(new AttributeDefinition(ValidFrom, Labels.Of("Gilt ab", "Valid from"), AttributeTypes.Date, Group: MediaGroup)));
        yield return new(AttributeStream + ValidUntil, Types.AttributeDefined, Types.Serialize(new AttributeDefinition(ValidUntil, Labels.Of("Gilt bis", "Valid until"), AttributeTypes.Date, Group: MediaGroup)));
        yield return new(ListStream + LicenceList, Types.ListDefined, Types.Serialize(new ListDefinition(LicenceList, Labels.Of("Lizenzen", "Licences"))));
        yield return new(AttributeStream + "licence", Types.AttributeDefined, Types.Serialize(new AttributeDefinition("licence", Labels.Of("Lizenz", "Licence"), AttributeTypes.Enum, Group: MediaGroup, List: LicenceList)));
        yield return new(AttributeStream + "source", Types.AttributeDefined, Types.Serialize(new AttributeDefinition("source", Labels.Of("Quelle", "Source"), AttributeTypes.Text, Group: MediaGroup)));
        yield return new(GroupStream + "relation_media", Types.AttributeGroupDefined, Types.Serialize(new AttributeGroupDefinition("relation_media", Labels.Of("Medienzuordnung", "Media link"))));
        yield return new(AttributeStream + "position", Types.AttributeDefined, Types.Serialize(new AttributeDefinition("position", Labels.Of("Reihenfolge", "Position"), AttributeTypes.Integer, Group: "relation_media")));
        yield return new(AttributeStream + "usage", Types.AttributeDefined, Types.Serialize(new AttributeDefinition("usage", Labels.Of("Verwendung", "Usage"), AttributeTypes.Text, Group: "relation_media")));
        // Vererbung von Medien: ein Medium mit inherit=true gilt an allen Subitems — als Ableitung, ohne
        // Kopie. Ein geerbtes Medium lässt sich an keiner Ebene „entfernen“, nur die Vererbung stoppen: eine Zuordnung zum selben
        // Medium mit stop=true an einem Knoten nimmt es dort und an allem darunter heraus (wieder lösen = wieder da).
        yield return new(AttributeStream + "inherit", Types.AttributeDefined, Types.Serialize(new AttributeDefinition("inherit", Labels.Of("an Subitems vererben", "inherit to subitems"), AttributeTypes.Boolean, Group: "relation_media")));
        yield return new(AttributeStream + "stop", Types.AttributeDefined, Types.Serialize(new AttributeDefinition("stop", Labels.Of("Verwendung und Vererbung hier unterbinden", "suppress use and inheritance here"), AttributeTypes.Boolean, Group: "relation_media")));
        yield return new(RelationStream + "image", Types.RelationTypeDefined, Types.Serialize(new RelationTypeDefinition("image", Labels.Of("Bild", "Image"), Labels.Of("Bild von", "Image of"), To: [Roles.Media], Group: "relation_media")));
        yield return new(RelationStream + "document", Types.RelationTypeDefined, Types.Serialize(new RelationTypeDefinition("document", Labels.Of("Dokument", "Document"), Labels.Of("Dokument zu", "Document of"), To: [Roles.Media], Group: "relation_media")));

        var viewNames = new Dictionary<string, (string De, string En)> { [Roles.Group] = ("Gruppe", "Group"), [Roles.Product] = ("Produkt", "Product"), [Roles.Variant] = ("Variante", "Variant"), [Roles.Rubric] = ("Rubrik", "Rubric") };
        foreach (var role in Roles.All)
        {
            var items = groups.Where(g => g.ActiveAt(role)).Select(g => new ViewItem(g.Key)).ToList();
            var (de, en) = viewNames[role];
            yield return new(ViewStream + "defaultview_" + role, Types.ViewDefined, Types.Serialize(new ViewDefinition("defaultview_" + role, Labels.Of("DefaultView" + de, "DefaultView" + en), items, role)));
        }
        // Sicht „Verkaufbares“: nur die Gruppen,
        // in denen das Verkaufbare typischerweise eigene Werte hat — Kennungen, Logistik, Physisches; der Anwender passt sie an seine Gruppen an
        yield return new(ViewStream + "sellable", Types.ViewDefined, Types.Serialize(new ViewDefinition("sellable", Labels.Of("Verkaufbares", "Sellable"), [new ViewItem("logistics"), new ViewItem("physical")], Roles.Variant)));
    }

    /// <summary>
    /// Der Baum eines leeren Journals: ein Wurzelknoten „MasterTree“, an dem alle
    /// Saatgut-Gruppen hängen und an dem das Sternchen auf <c>name</c> steht —
    /// alles darunter ohne eigenen Namen heisst wie sein Name.
    /// </summary>
    public static IEnumerable<Seed> TreeSeeds()
    {
        yield return new(RootNode, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("MasterTree", "MasterTree"), "MasterTree")));
        yield return new(RootNode, Types.GroupsAttached, Types.Serialize(new GroupsAttached(["mastergroup", "logistics", "physical"])));
        yield return new(RootNode, Types.LabelAttributeSet, Types.Serialize(new LabelAttributeSet("name")));
    }
}
