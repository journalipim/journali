namespace Journali.Core.Entries;

/// <summary>
/// Ströme des Modells und das Saatgut für ein leeres Journal. Das Modell
/// selbst steht im Journal (docs/pflegestruktur.md, Grundsatz); dies hier
/// ist nur, womit ein neues Journal anfängt (Taloan, 17.09.2026): Einheiten,
/// zwei Sprachen, zwei Kanäle, Gruppen mastergroup/logistics/physical, Werteliste
/// Farben mit RAL, Sicht DefaultView je Knotentyp, Wurzelknoten „MasterTree“.
/// Fehlende Ströme werden bei jedem Start nachgesät (Catalog.SeedMissing).
/// </summary>
public static class Model
{
    public const string LocaleStream = "locale:";
    public const string ChannelStream = "channel:";
    public const string AttributeStream = "attribute:";
    public const string ListStream = "list:";
    public const string FamilyStream = "family:";
    public const string UnitStream = "unit:";
    public const string ViewStream = "view:";
    public const string GroupStream = "group:";
    public const string LabelStream = "settings:label:";

    /// <summary>Die SKU ist ein Attribut der Variante, eindeutig über alle Varianten.</summary>
    public const string SkuAttribute = "sku";

    /// <summary>Der Wurzelknoten des Saatguts — feste Id, damit er nur einmal entsteht.</summary>
    public const string RootNode = "g-mastertree";

    /// <summary>Ein Modell-Eintrag: Strom, Typ, Nutzdaten — fertig zum Anhängen.</summary>
    public sealed record Seed(string Stream, string Type, string Payload);

    public static IEnumerable<Seed> Seeds()
    {
        yield return new(LocaleStream + "de", Types.LocaleDefined, Types.Serialize(new LocaleDefinition("de", "Deutsch")));
        yield return new(LocaleStream + "en", Types.LocaleDefined, Types.Serialize(new LocaleDefinition("en", "English")));
        yield return new(ChannelStream + "web", Types.ChannelDefined, Types.Serialize(new ChannelDefinition("web", Labels.Of("Web", "Web"))));
        yield return new(ChannelStream + "print", Types.ChannelDefined, Types.Serialize(new ChannelDefinition("print", Labels.Of("Print", "Print"))));

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
        ];
        foreach (var g in groups)
            yield return new(GroupStream + g.Key, Types.AttributeGroupDefined, Types.Serialize(g));

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
            new(SkuAttribute, Labels.Of("SKU", "SKU"), AttributeTypes.Text, Group: "logistics", Required: new() { ["web"] = ["*"], ["print"] = ["*"] }),
            new("ean", Labels.Of("EAN", "EAN"), AttributeTypes.Text, Group: "logistics"),
            new("weight", Labels.Of("Gewicht", "Weight"), AttributeTypes.Decimal, Unit: "kg", Group: "physical"),
        ];
        foreach (var a in attributes)
            yield return new(AttributeStream + a.Key, Types.AttributeDefined, Types.Serialize(a));

        var viewNames = new Dictionary<string, (string De, string En)> { [Roles.Group] = ("Gruppe", "Group"), [Roles.Product] = ("Produkt", "Product"), [Roles.Variant] = ("Variante", "Variant") };
        foreach (var role in Roles.All)
        {
            var items = groups.Where(g => g.ActiveAt(role)).Select(g => new ViewItem(g.Key)).ToList();
            var (de, en) = viewNames[role];
            yield return new(ViewStream + "defaultview_" + role, Types.ViewDefined, Types.Serialize(new ViewDefinition("defaultview_" + role, Labels.Of("DefaultView" + de, "DefaultView" + en), items, role)));
        }
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
