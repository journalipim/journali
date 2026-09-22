using System.Security.Cryptography;

namespace Journali.Core.Entries;

/// <summary>
/// Interne Ids der Knoten: Rolle als Vorsilbe, dann 8 Hexzeichen aus dem
/// Zufall. Lesbar im Journal, nie eine SKU — die wird umbenannt, ein Strom nie.
/// </summary>
public static class Ids
{
    public static string New(string role) => role switch
    {
        Roles.Group => "g-" + Random(),
        Roles.Product => "p-" + Random(),
        Roles.Variant => "v-" + Random(),
        Roles.Rubric => "k-" + Random(),
        _ => throw new ArgumentException(role, nameof(role)),
    };

    /// <summary>Strom eines Mediums: m-…</summary>
    public static string Media() => "m-" + Random();

    /// <summary>Strom eines Medienordners: mf-…</summary>
    public static string MediaFolder() => "mf-" + Random();

    /// <summary>Strom einer Relation: r-…</summary>
    public static string Relation() => "r-" + Random();

    /// <summary>Schlüssel eines Übersetzungsauftrags (30): Tag und Uhrzeit, damit man ihn im Gespräch nennen kann.</summary>
    public static string TranslationOrder() => DateTime.UtcNow.ToString("yyyyMMdd-HHmm") + "-" + Random()[..4];

    private static string Random() => Convert.ToHexString(RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();
}
