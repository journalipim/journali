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
        _ => throw new ArgumentException(role, nameof(role)),
    };

    private static string Random() => Convert.ToHexString(RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();
}
