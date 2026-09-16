namespace Journali.Core.Entries;

/// <summary>
/// Welche Achsen ein Attribut hat (docs/architektur.md, „Die Achsen").
/// Vorläufig fest im Code; später selbst ein Eintragstyp (<c>AttributeDefined</c>),
/// damit auch das Modell aus dem Journal kommt.
/// </summary>
public sealed record AttributeDefinition(string Name, bool PerLocale, bool PerChannel);

public static class Model
{
    public static readonly IReadOnlyList<string> Locales = ["de", "en"];

    public static readonly IReadOnlyList<string> Channels = ["web", "print"];

    public static readonly IReadOnlyList<AttributeDefinition> Attributes =
    [
        new("name", PerLocale: true, PerChannel: false),
        new("description", PerLocale: true, PerChannel: true),
        new("weight", PerLocale: false, PerChannel: false),
        new("ean", PerLocale: false, PerChannel: false),
    ];
}
