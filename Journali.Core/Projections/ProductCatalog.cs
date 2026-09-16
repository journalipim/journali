using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>Die Achsen eines Werts: Attribut × Sprache × Kanal. Null = gilt für alle.</summary>
public readonly record struct Axis(string Attribute, string? Locale, string? Channel);

public readonly record struct Release(string Channel, string? Locale);

/// <summary>Zustand eines Produkts, wie er sich aus seinem Strom ergibt.</summary>
public sealed class ProductState
{
    public required string Sku { get; init; }
    public Dictionary<Axis, string> Values { get; } = new();
    public HashSet<string> Categories { get; } = new();
    public HashSet<Release> Releases { get; } = new();
    public long LastNumber { get; set; }
    public DateTimeOffset LastAt { get; set; }
    public string LastActor { get; set; } = "";
    public int Entries { get; set; }

    /// <summary>Wert auf der Achse, sonst Rückfall auf weniger spezifische Achsen (Kanal weg, dann Sprache weg).</summary>
    public string? Resolve(string attribute, string? locale, string? channel)
    {
        if (Values.TryGetValue(new Axis(attribute, locale, channel), out var v)) return v;
        if (channel is not null && Values.TryGetValue(new Axis(attribute, locale, null), out v)) return v;
        if (locale is not null && Values.TryGetValue(new Axis(attribute, null, null), out v)) return v;
        return null;
    }
}

/// <summary>
/// Abbild „aktueller Zustand je Produkt": der letzte Eintrag je Achse gewinnt.
/// Ein Strom ist ein Produkt (SKU). Wird beim Start aus dem Journal gebaut
/// und danach synchron mit jedem Eintrag nachgezogen.
/// </summary>
public sealed class ProductCatalog : IProjection
{
    private readonly Dictionary<string, ProductState> _products = new();

    public long LastApplied { get; private set; }

    public IReadOnlyDictionary<string, ProductState> Products => _products;

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;

        if (!_products.TryGetValue(entry.Stream, out var p))
            _products[entry.Stream] = p = new ProductState { Sku = entry.Stream };

        switch (entry.Type)
        {
            case Types.AttributeSet:
                var a = Types.Deserialize<AttributeSet>(entry.Payload);
                p.Values[new Axis(a.Attribute, a.Locale, a.Channel)] = a.Value;
                break;
            case Types.CategoryAssigned:
                p.Categories.Add(Types.Deserialize<CategoryAssigned>(entry.Payload).Category);
                break;
            case Types.CategoryRemoved:
                p.Categories.Remove(Types.Deserialize<CategoryRemoved>(entry.Payload).Category);
                break;
            case Types.ReleaseGranted:
                var g = Types.Deserialize<ReleaseGranted>(entry.Payload);
                p.Releases.Add(new Release(g.Channel, g.Locale));
                break;
            case Types.ReleaseRevoked:
                var r = Types.Deserialize<ReleaseRevoked>(entry.Payload);
                p.Releases.Remove(new Release(r.Channel, r.Locale));
                break;
            // Unbekannte Typen betreffen dieses Abbild nicht — LastApplied rückt trotzdem vor.
        }

        p.LastNumber = entry.Number;
        p.LastAt = entry.At;
        p.LastActor = entry.Actor;
        p.Entries++;
    }
}
