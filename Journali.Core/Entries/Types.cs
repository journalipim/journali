using System.Text.Json;
using System.Text.Json.Serialization;

namespace Journali.Core.Entries;

/// <summary>
/// Das Vokabular der Einträge. Ein Typ ist für immer: neue Typen sind billig,
/// geänderte teuer, gelöschte unmöglich (docs/eintraege.md). Der Name des
/// Typs ist <c>Type</c>, die Nutzdaten das Record als JSON in camelCase.
/// </summary>
public static class Types
{
    public const string AttributeSet = "AttributeSet";
    public const string CategoryAssigned = "CategoryAssigned";
    public const string CategoryRemoved = "CategoryRemoved";
    public const string ReleaseGranted = "ReleaseGranted";
    public const string ReleaseRevoked = "ReleaseRevoked";

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

/// <summary>Ein Attributwert auf seinen Achsen. Fehlende Achse = gilt für alle.</summary>
public sealed record AttributeSet(string Attribute, string? Locale, string? Channel, string Value);

public sealed record CategoryAssigned(string Category);

public sealed record CategoryRemoved(string Category);

/// <summary>Freigabe für einen Kanal, optional je Sprache.</summary>
public sealed record ReleaseGranted(string Channel, string? Locale);

public sealed record ReleaseRevoked(string Channel, string? Locale);
