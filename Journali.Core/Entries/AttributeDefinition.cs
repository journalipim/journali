namespace Journali.Core.Entries;

/// <summary>
/// Ströme des Modells und das Saatgut für ein leeres Journal. Das Modell
/// selbst steht im Journal (docs/pflegestruktur.md, Grundsatz); dies hier
/// ist nur, womit ein neues Journal anfängt.
/// </summary>
public static class Model
{
    public const string LocaleStream = "locale:";
    public const string ChannelStream = "channel:";
    public const string AttributeStream = "attribute:";
    public const string ListStream = "list:";
    public const string FamilyStream = "family:";

    /// <summary>Die SKU ist ein Attribut der Variante, eindeutig über alle Varianten.</summary>
    public const string SkuAttribute = "sku";

    /// <summary>Ein Modell-Eintrag: Strom, Typ, Nutzdaten — fertig zum Anhängen.</summary>
    public sealed record Seed(string Stream, string Type, string Payload);

    /// <summary>Was ein leeres Journal als Modell bekommt: zwei Sprachen, zwei Kanäle, vier Attribute.</summary>
    public static IEnumerable<Seed> Seeds()
    {
        yield return new(LocaleStream + "de", Types.LocaleDefined, Types.Serialize(new LocaleDefinition("de", "Deutsch")));
        yield return new(LocaleStream + "en", Types.LocaleDefined, Types.Serialize(new LocaleDefinition("en", "English")));
        yield return new(ChannelStream + "web", Types.ChannelDefined, Types.Serialize(new ChannelDefinition("web", Labels.Of("Web", "Web"))));
        yield return new(ChannelStream + "print", Types.ChannelDefined, Types.Serialize(new ChannelDefinition("print", Labels.Of("Print", "Print"))));

        AttributeDefinition[] attributes =
        [
            new(SkuAttribute, Labels.Of("SKU", "SKU"), AttributeTypes.Text, Group: "logistics", Levels: [Roles.Variant]),
            new("name", Labels.Of("Name", "Name"), AttributeTypes.Text, Group: "texts", Axes: [Axes.Locale]),
            new("description", Labels.Of("Beschreibung", "Description"), AttributeTypes.Html, Group: "texts", Axes: [Axes.Locale, Axes.Channel]),
            new("weight", Labels.Of("Gewicht", "Weight"), AttributeTypes.Decimal, Unit: "kg", Group: "physical"),
            new("ean", Labels.Of("EAN", "EAN"), AttributeTypes.Text, Group: "logistics"),
        ];
        foreach (var a in attributes)
            yield return new(AttributeStream + a.Key, Types.AttributeDefined, Types.Serialize(a));
    }
}
