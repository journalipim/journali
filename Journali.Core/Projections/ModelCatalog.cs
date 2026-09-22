using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>Eine Werteliste mit ihren Werten in Reihenfolge.</summary>
public sealed class ValueList
{
    public required string Key { get; init; }
    public Labels Label { get; set; } = new();
    public string[]? Columns { get; set; }
    /// <summary>geschlossen: Werte kommen aus einer Quelle (ETIM, Norm) — kein Zufügen in der Zelle.</summary>
    public bool Closed { get; set; }
    public Dictionary<string, ListValueDefinition> Values { get; } = new();

    public IEnumerable<ListValueDefinition> Ordered => Values.Values.OrderBy(v => v.Order).ThenBy(v => v.Value);
}

/// <summary>Ein Begriff des Wörterbuchs.</summary>
public sealed class Term
{
    public required string Key { get; init; }
    public Labels Text { get; set; } = new();
    public string? Note { get; set; }
    public long LastNumber { get; set; }
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
    /// <summary>Die Mastersprache (settings:master_locale); null, bis gesät.</summary>
    public string? MasterLocale { get; private set; }
    /// <summary>Der Masterkanal (settings:master_channel); null, bis gesät.</summary>
    public string? MasterChannel { get; private set; }
    /// <summary>Freigabesteuerung (Taloan, 22.09.2026): zählt eine Änderung dieses Attributs als Eingriff in Prüfung und Freigabe?
    /// Attribut schlägt Gruppe; „auto“ an der Gruppe heisst: ja, wenn die Gruppe ein Pflichtfeld hat.</summary>
    public bool Watched(string attribute)
    {
        if (!Attributes.TryGetValue(attribute, out var a)) return false;
        if (a.ReleaseWatch == Entries.ReleaseWatch.Always) return true;
        if (a.ReleaseWatch == Entries.ReleaseWatch.Never) return false;
        var g = a.Group is { } gk ? Groups.GetValueOrDefault(gk) : null;
        if (g is null) return false;                                   // ohne Gruppe gilt das Attribut nirgends
        if (g.ReleaseWatch == Entries.ReleaseWatch.Always) return true;
        if (g.ReleaseWatch == Entries.ReleaseWatch.Never) return false;
        return AttributesOf(g.Key).Any(x => x.Required is { Count: > 0 });   // auto: die Gruppe trägt Pflichtwerte
    }

    /// <summary>Die Schlüsselattribute (unique), nach Schlüssel geordnet — Taloan, 21.09.2026: beliebig viele, jedes für sich eindeutig.</summary>
    public IEnumerable<AttributeDefinition> UniqueAttributes => Attributes.Values.Where(a => a.Unique).OrderBy(a => a.Key, StringComparer.Ordinal);
    public Dictionary<string, ChannelDefinition> Channels { get; } = new();
    /// <summary>Status-Vokabular (Taloan, 22.09.2026); <see cref="StatusEver"/>: auch zurückgezogene — die Saat sät sie nicht wieder.</summary>
    public Dictionary<string, StatusDefinition> Statuses { get; } = new();
    public HashSet<string> StatusEver { get; } = new();
    public IEnumerable<StatusDefinition> StatusesOrdered => Statuses.Values.OrderBy(s => s.Order).ThenBy(s => s.Key, StringComparer.Ordinal);
    public Dictionary<string, AttributeDefinition> Attributes { get; } = new();
    public Dictionary<string, ValueList> Lists { get; } = new();
    public Dictionary<string, FamilyDefinition> Families { get; } = new();
    public Dictionary<string, UnitDefinition> Units { get; } = new();
    /// <summary>Wörterbuch (9): Begriff → Text je Sprache (+ Notiz).</summary>
    public Dictionary<string, Term> Terms { get; } = new();
    public Dictionary<string, ViewDefinition> Views { get; } = new();
    /// <summary>Relationstypen (18): relation:&lt;key&gt;.</summary>
    public Dictionary<string, RelationTypeDefinition> RelationTypes { get; } = new();
    public Dictionary<string, AttributeGroupDefinition> Groups { get; } = new();
    /// <summary>Welches Attribut die Knoten eines Typs im Baum benennt.</summary>
    public Dictionary<string, string> TreeLabels { get; } = new();

    /// <summary>Attribute einer Gruppe, nach Schlüssel; die Reihenfolge fürs Auge kommt aus der Sicht.</summary>
    public IEnumerable<AttributeDefinition> AttributesOf(string group) =>
        Attributes.Values.Where(a => (a.Group ?? "") == group).OrderBy(a => a.Key);

    /// <summary>Ist die Gruppe an dieser Rolle aktiv (Werte erfassbar)? Unbekannte Gruppen (nur an Attributen): überall.</summary>
    public bool GroupActiveAt(string group, string role) => !Groups.TryGetValue(group, out var g) || g.ActiveAt(role);

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
            case Types.MasterLocaleDefined:
                MasterLocale = Types.Deserialize<MasterLocaleDefined>(entry.Payload).Code;
                break;
            case Types.MasterChannelDefined:
                MasterChannel = Types.Deserialize<MasterChannelDefined>(entry.Payload).Key;
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
                List(ld.Key).Columns = ld.Columns;
                List(ld.Key).Closed = ld.Closed;
                break;
            case Types.ListValueDefined:
                var v = Types.Deserialize<ListValueDefinition>(entry.Payload);
                List(ListKey(entry.Stream)).Values[v.Value] = v;
                break;
            case Types.ListRetired:
                Lists.Remove(Types.Deserialize<ListRetired>(entry.Payload).Key);
                break;
            case Types.LocaleRetired:
                Locales.Remove(Types.Deserialize<LocaleRetired>(entry.Payload).Code);
                break;
            case Types.ChannelRetired:
                Channels.Remove(Types.Deserialize<ChannelRetired>(entry.Payload).Key);
                break;
            case Types.StatusDefined:
                var sd = Types.Deserialize<StatusDefinition>(entry.Payload);
                Statuses[sd.Key] = sd; StatusEver.Add(sd.Key);
                break;
            case Types.StatusRetired:
                Statuses.Remove(Types.Deserialize<StatusRetired>(entry.Payload).Key);
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
            case Types.TreeLabelDefined:
                var tl = Types.Deserialize<TreeLabelDefined>(entry.Payload);
                TreeLabels[tl.Role] = tl.Attribute;
                break;
            case Types.AttributeGroupDefined:
                var ag = Types.Deserialize<AttributeGroupDefinition>(entry.Payload);
                Groups[ag.Key] = ag;
                break;
            case Types.AttributeGroupRetired:
                Groups.Remove(Types.Deserialize<AttributeGroupRetired>(entry.Payload).Key);
                break;
            case Types.RelationTypeDefined:
                var rt = Types.Deserialize<RelationTypeDefinition>(entry.Payload);
                RelationTypes[rt.Key] = rt;
                break;
            case Types.RelationTypeRetired:
                RelationTypes.Remove(Types.Deserialize<RelationTypeRetired>(entry.Payload).Key);
                break;
            case Types.ViewDefined:
                var vw = Types.Deserialize<ViewDefinition>(entry.Payload);
                Views[vw.Key] = vw;
                break;
            case Types.ViewRetired:
                Views.Remove(Types.Deserialize<ViewRetired>(entry.Payload).Key);
                break;
            case Types.UnitDefined:
                var u = Types.Deserialize<UnitDefinition>(entry.Payload);
                Units[u.Key] = u;
                break;
            case Types.UnitRetired:
                Units.Remove(Types.Deserialize<UnitRetired>(entry.Payload).Key);
                break;
            case Types.TermDefined when entry.Stream.StartsWith(Model.TermStream, StringComparison.Ordinal):
            {
                var t = Types.Deserialize<TermDefined>(entry.Payload); var key = entry.Stream[Model.TermStream.Length..];
                Terms[key] = new Term { Key = key, Text = t.Text ?? new(), Note = t.Note, LastNumber = entry.Number };
                break;
            }
            case Types.TermRetired when entry.Stream.StartsWith(Model.TermStream, StringComparison.Ordinal):
                Terms.Remove(entry.Stream[Model.TermStream.Length..]);
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
