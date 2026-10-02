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
    /// <summary>Freigabesteuerung: zählt eine Änderung dieses Attributs als Eingriff in Prüfung und Freigabe?
    /// Attribut schlägt Gruppe; „auto“ an der Gruppe heisst: ja, wenn die Gruppe ein Pflichtfeld hat.</summary>
    public bool Watched(string attribute) => Watched(attribute, null);

    /// <summary>Die Gruppen, in denen mindestens ein Attribut Pflichtwerte hat — in einem Durchgang. Wer für viele Attribute <see cref="Watched(string, HashSet{string})"/>
    /// fragt, übergibt diese Menge, statt dass jede Frage alle Attribute der Gruppe durchgeht (die Modellansicht brauchte dafür 0,9 s).</summary>
    public HashSet<string> GroupsWithRequired()
    {
        var r = new HashSet<string>();
        foreach (var a in Attributes.Values)
            if (a.Required is { Count: > 0 }) foreach (var g in GroupsOf(a.Key)) r.Add(g);
        return r;
    }

    public bool Watched(string attribute, HashSet<string>? mitPflicht)
    {
        if (!Attributes.TryGetValue(attribute, out var a)) return false;
        if (a.ReleaseWatch == Entries.ReleaseWatch.Always) return true;
        if (a.ReleaseWatch == Entries.ReleaseWatch.Never) return false;
        var g = a.Group is { } gk ? Groups.GetValueOrDefault(gk) : null;
        if (g is null) return false;                                   // ohne Gruppe gilt das Attribut nirgends
        if (g.ReleaseWatch == Entries.ReleaseWatch.Always) return true;
        if (g.ReleaseWatch == Entries.ReleaseWatch.Never) return false;
        return mitPflicht is not null ? mitPflicht.Contains(g.Key) : AttributesOf(g.Key).Any(x => x.Required is { Count: > 0 });   // auto: die Gruppe trägt Pflichtwerte
    }

    /// <summary>Die Schlüsselattribute (unique), nach Schlüssel geordnet — beliebig viele, jedes für sich eindeutig.</summary>
    public IEnumerable<AttributeDefinition> UniqueAttributes => Attributes.Values.Where(a => a.Unique).OrderBy(a => a.Key, StringComparer.Ordinal);
    public Dictionary<string, ChannelDefinition> Channels { get; } = new();
    /// <summary>Status-Vokabular; <see cref="StatusEver"/>: auch zurückgezogene — die Saat sät sie nicht wieder.</summary>
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
    /// <summary>Mitgliedschaften (n:m, 29.09.2026): Attribut → Gruppen, in denen es Mitglied ist — neben <c>AttributeDefinition.Group</c>.</summary>
    public Dictionary<string, HashSet<string>> AttributeGroups { get; } = new();
    /// <summary>Welches Attribut die Knoten eines Typs im Baum benennt.</summary>
    public Dictionary<string, string> TreeLabels { get; } = new();

    /// <summary>Attribute einer Gruppe, nach Schlüssel; die Reihenfolge fürs Auge kommt aus der Sicht.
    /// Dazu gehört ein Attribut über seine Zuordnung (<c>group</c>) und über jede Mitgliedschaft (n:m, 29.09.2026) — jedes einmal.</summary>
    public IEnumerable<AttributeDefinition> AttributesOf(string group) =>
        (_nachGruppe ?? BaueGruppenIndex()).TryGetValue(group, out var liste) ? liste : [];

    // Gruppe → ihre Attribute, einmal gebaut und bei jeder Änderung des Modells (Apply) verworfen. Ohne ihn ging jede Frage nach einer Gruppe durch alle Attribute und
    // sortierte sie; die Tabelle des Baums fragte das je Knoten und Gruppe (1 500 Attribute × 2 200 Knoten: 2,3 s). Gelesen wird gleichzeitig, verändert nur unter der
    // Schreibsperre des Servers — der Index gehört nicht in den Schnappschuss.
    [System.Text.Json.Serialization.JsonIgnore] private Dictionary<string, AttributeDefinition[]>? _nachGruppe;
    private static readonly object IndexSperre = new();

    private Dictionary<string, AttributeDefinition[]> BaueGruppenIndex()
    {
        lock (IndexSperre)
        {
            if (_nachGruppe is { } fertig) return fertig;
            var d = new Dictionary<string, List<AttributeDefinition>>();
            void Zu(string g, AttributeDefinition a) { if (!d.TryGetValue(g, out var l)) d[g] = l = []; if (l.Count == 0 || !ReferenceEquals(l[^1], a)) l.Add(a); }
            foreach (var a in Attributes.Values.OrderBy(a => a.Key))
            {
                Zu(a.Group ?? "", a);
                if (AttributeGroups.TryGetValue(a.Key, out var gs)) foreach (var g in gs) if (g != (a.Group ?? "")) Zu(g, a);
            }
            return _nachGruppe = d.ToDictionary(k => k.Key, k => k.Value.ToArray());
        }
    }

    /// <summary>Die Gruppen eines Attributs: Zuordnung und Mitgliedschaften zusammen, jede einmal, nach Schlüssel.</summary>
    public IEnumerable<string> GroupsOf(string attribute)
    {
        var aus = new HashSet<string>();
        if (Attributes.TryGetValue(attribute, out var a) && a.Group is { Length: > 0 } g) aus.Add(g);
        if (AttributeGroups.TryGetValue(attribute, out var gs)) aus.UnionWith(gs);
        return aus.Order();
    }

    /// <summary>Gehört das Attribut zu dieser Gruppe (Zuordnung oder Mitgliedschaft)? Eine Nachschlagefrage, ohne die Gruppen des Attributs aufzulisten.</summary>
    public bool IsMember(string attribute, string group) =>
        (Attributes.TryGetValue(attribute, out var a) && (a.Group ?? "") == group)
        || (AttributeGroups.TryGetValue(attribute, out var gs) && gs.Contains(group));

    /// <summary>Jede Gruppe, die es gibt: definierte, am Attribut zugeordnete und solche, die nur Mitglieder haben.</summary>
    public IEnumerable<string> AllGroupKeys =>
        Groups.Keys.Concat(Attributes.Values.Select(a => a.Group ?? "")).Concat(AttributeGroups.Values.SelectMany(g => g))
            .Where(g => g.Length > 0).Distinct().Order();

    /// <summary>Ist die Gruppe an dieser Rolle aktiv (Werte erfassbar)? Unbekannte Gruppen (nur an Attributen): überall.</summary>
    public bool GroupActiveAt(string group, string role) => !Groups.TryGetValue(group, out var g) || g.ActiveAt(role);

    /// <summary>Ist überhaupt ein Modell da? Sonst sät der Server das Saatgut.</summary>
    public bool IsEmpty => Attributes.Count == 0 && Locales.Count == 0;

    public void Apply(Entry entry)
    {
        _nachGruppe = null;
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
                var ar = Types.Deserialize<AttributeRetired>(entry.Payload).Key;
                Attributes.Remove(ar);
                AttributeGroups.Remove(ar);   // mit dem Attribut gehen seine Mitgliedschaften
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
                var agr = Types.Deserialize<AttributeGroupRetired>(entry.Payload).Key;
                Groups.Remove(agr);
                foreach (var set in AttributeGroups.Values) set.Remove(agr);   // eine zurückgezogene Gruppe hat keine Mitglieder mehr
                break;
            case Types.AttributeGroupsSet:
                var ags = Types.Deserialize<AttributeGroupsSet>(entry.Payload);
                var mengen = (ags.Groups ?? []).Where(g => !string.IsNullOrWhiteSpace(g)).Select(g => g.Trim()).ToHashSet();
                if (mengen.Count == 0) AttributeGroups.Remove(ags.Key); else AttributeGroups[ags.Key] = mengen;
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
