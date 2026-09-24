using System.Security.Cryptography;
using System.Text.Json;
using Journali.Core.Licensing;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Ein Aussteller für die Tests: journali glaubt ihm wie dem Lizenzserver (<see cref="Aussteller.Vertraue"/>). Was ein Test
/// damit signiert, zählt; was er mit einem anderen Schlüssel signiert, nicht.
/// </summary>
internal static class PruefAussteller
{
    public static readonly ECDsa Schluessel = ECDsa.Create(ECCurve.NamedCurves.nistP256);
    public static string Pub { get; } = Signaturen.Oeffentlich(Schluessel);

    static PruefAussteller() => Aussteller.Vertraue(Pub);

    /// <summary>Eine Lizenz, signiert wie vom Lizenzserver.</summary>
    public static Licence Signiert(Licence l) => l with { Sig = Signaturen.Signiere(Schluessel, l.Rumpf) };

    /// <summary>Ein Tarifblatt, signiert mit <paramref name="mit"/> (ohne: mit dem Prüf-Aussteller).</summary>
    public static Tarifblatt Blatt(TarifblattInhalt inhalt, ECDsa? mit = null)
    {
        _ = Pub;   // der statische Konstruktor muss gelaufen sein, bevor jemand prüft
        var text = JsonSerializer.Serialize(inhalt, TarifblattInhalt.Json);
        return new Tarifblatt(text, Signaturen.Signiere(mit ?? Schluessel, text));
    }

    /// <summary>Das Saatgut als Tarifblatt der Fassung <paramref name="fassung"/>, verändert durch <paramref name="aendern"/>.</summary>
    public static Tarifblatt Blatt(long fassung, Func<TarifZeile, TarifZeile>? aendern = null, int testMonate = 3, ECDsa? mit = null)
    {
        var b = Tarife.Saat.AlsBlatt(fassung, DateTimeOffset.UtcNow);
        return Blatt(b with { TestMonate = testMonate, Tarife = [.. b.Tarife.Select(aendern ?? (z => z))] }, mit);
    }
}
