using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>Eine Werteliste mit ihren Werten in Reihenfolge.</summary>
public sealed class ValueList
{
    public required string Key { get; init; }
    public Labels Label { get; set; } = new();
    public Dictionary<string, ListValueDefinition> Values { get; } = new();

    public IEnumerable<ListValueDefinition> Ordered => Values.Values.OrderBy(v => v.Order).ThenBy(v => v.Value);
}

/// <summary>
/// Abbild „das Modell": Sprachen, Kanäle, Attribute, Wertelisten, Familien —
/// aus den Modell-Einträgen (docs/pflegestruktur.md). Der letzte Eintrag je
/// Strom gewinnt; ein <c>…Retired</c> nimmt den Schlüssel heraus.
/// </summary>
public sealed class ModelCatalog : IProjection
{
    public long LastApplied { get; private set; }

    public Dictionary<string, LocaleDefinition> Locales { get; } = new();
    public Dictionary<string, ChannelDefinition> Channels { get; } = new();
    public Dictionary<string, AttributeDefinition> Attributes { get; } = new();
    public Dictionary<string, ValueList> Lists { get; } = new();
    public Dictionary<string, FamilyDefinition> Families { get; } = new();
    public Dictionary<string, UnitDefinition> Units { get; } = new();

    /// <summary>Ist überhaupt ein Modell da? Sonst sät der Server das Saatgut.</summary>
    public bool IsEmpty => Attributes.Count == 0 && Locales.Count == 0;

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        switch (entry.Type)
        {
            case Types.LocaleDefined:
                var l = Types.Deserialize<LocaleDefinition>(entry.Payload);
                Locales[l.Code] = l;
                break;
            case Types.ChannelDefined:
                var c = Types.Deserialize<ChannelDefinition>(entry.Payload);
                Channels[c.Key] = c;
                break;
            case Types.AttributeDefined:
                var a = Types.Deserialize<AttributeDefinition>(entry.Payload);
                Attributes[a.Key] = a;
                break;
            case Types.AttributeRetired:
                Attributes.Remove(Types.Deserialize<AttributeRetired>(entry.Payload).Key);
                break;
            case Types.ListDefined:
                var ld = Types.Deserialize<ListDefinition>(entry.Payload);
                List(ld.Key).Label = ld.Label;
                break;
            case Types.ListValueDefined:
                var v = Types.Deserialize<ListValueDefinition>(entry.Payload);
                List(ListKey(entry.Stream)).Values[v.Value] = v;
                break;
            case Types.ListValueRetired:
                List(ListKey(entry.Stream)).Values.Remove(Types.Deserialize<ListValueRetired>(entry.Payload).Value);
                break;
            case Types.FamilyDefined:
                var f = Types.Deserialize<FamilyDefinition>(entry.Payload);
                Families[f.Key] = f;
                break;
            case Types.FamilyRetired:
                Families.Remove(Types.Deserialize<FamilyRetired>(entry.Payload).Key);
                break;
            case Types.UnitDefined:
                var u = Types.Deserialize<UnitDefinition>(entry.Payload);
                Units[u.Key] = u;
                break;
            case Types.UnitRetired:
                Units.Remove(Types.Deserialize<UnitRetired>(entry.Payload).Key);
                break;
        }
    }

    private ValueList List(string key)
    {
        if (!Lists.TryGetValue(key, out var list))
            Lists[key] = list = new ValueList { Key = key };
        return list;
    }

    private static string ListKey(string stream) =>
        stream.StartsWith(Model.ListStream) ? stream[Model.ListStream.Length..] : stream;
}
