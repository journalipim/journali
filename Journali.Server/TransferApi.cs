using System.Text.Json.Serialization;
using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Rohdaten eines Teilbaums hin und zurück. Darum ROH: eigene Werte je Achse (nicht geerbt,
/// nicht aufgelöst), Formeln und Vorlagen als Skript (nicht als Ergebnis), Zeilen, Gruppen, Name, Stern, Status, Kennungen.
/// Import: gibt es den Knoten, wird er angeglichen; liegt er im Papierkorb, wird er zurückgeholt und angeglichen; sonst neu
/// angelegt (neue Id, Kinder folgen). Was drinsteht, wird übernommen — nur Unterschiede werden geschrieben, ein Stapel.
/// </summary>
public static class TransferApi
{
    public sealed record RawValue(string Attribute, string? Locale = null, string? Channel = null, string? Row = null, string? Value = null, string[]? Values = null);
    public sealed record RawNode(string Id, string Role, string? Parent, string? Name, string? Status, string[]? Axes, Dictionary<string, string>? AxisValues,
        string[]? Groups, string? LabelAttribute, Dictionary<string, string>? External, List<RawValue> Values, Dictionary<string, List<string>>? Rows,
        Labels? Label, List<RawNode>? Children)
    {
        [JsonIgnore] public string? Family { get; init; }
    }
    /// <summary>Die Modellteile, die der Teilbaum benutzt — damit ein Import in ein anderes System die Definitionen mitbringt.</summary>
    public sealed record RawModel(List<AttributeGroupDefinition> Groups, List<AttributeDefinition> Attributes, List<RawList> Lists, List<UnitDefinition> Units);
    public sealed record RawList(string Key, Labels Label, string[]? Columns, List<ListValueDefinition> Values);
    public sealed record RawExport(RawModel Model, RawNode Node);
    /// <summary>Zuordnung aus dem Import-Manager: JSON-Key → vorhandenes Attribut/Gruppe, oder neu (mit Präfix). Fehlt ein Key hier, gilt: gleicher Key.</summary>
    public sealed record ImportMap(Dictionary<string, string>? Attributes = null, Dictionary<string, string>? Groups = null, string? Prefix = null);
    public sealed record ImportBody(RawNode Node, string? Parent = null, RawModel? Model = null, ImportMap? Map = null, bool DryRun = false);

    public static void Map(RouteGroupBuilder api)
    {
        api.MapGet("/nodes/{id}/export", (string id, Catalog c, bool deep = true) =>
            c.With((model, tree, _) => tree.Nodes.TryGetValue(id, out var n) ? Results.Ok(new RawExport(UsedModel(model, tree, n, deep), Raw(tree, n, deep))) : Results.NotFound()));

        api.MapPost("/nodes/import", (ImportBody body, HttpRequest req, Catalog c) =>
            Actor(req) is not { } actor ? ActorMissing() : Einspielen(c, actor, body));
    }

    /// <summary>
    /// Einen Teilbaum einspielen — angleichen, zurückholen oder anlegen, alles in einem Stapel. Nimmt den Modellteil
    /// mit, wenn einer dabei ist. <c>DryRun</c> zählt nur, was geschähe.
    /// Gemeinsamer Weg von <c>POST /nodes/import</c> und der Wiederherstellung aus einer Sicherung (RestoreApi).
    /// </summary>
    public static IResult Einspielen(Catalog c, string actor, ImportBody body)
    {
        {
            if (body.Node is null) return Bad("node fehlt.");
            var batch = "b-" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();
            var result = c.With((model, tree, write) =>
            {
                var ctx = new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Write = (stream, type, payload) => write(actor, stream, type, payload, batch) };
                var s = new Stats();
                var (node, rawModel) = body.Map is null ? (body.Node, body.Model) : Remap(body.Node, body.Model, body.Map, model);
                var parent = Blank(body.Parent) ?? node.Parent;
                if (parent is not null && !tree.Nodes.ContainsKey(parent)) return (s, Error: (string?)$"Vater {parent} steht nicht im Baum — Ziel angeben (parent).");
                // Trockenlauf (Job): nur zählen, was passieren würde — nichts schreiben
                if (body.DryRun)
                {
                    void Count(RawNode r) { if (tree.Nodes.ContainsKey(r.Id)) s.Updated++; else if (tree.Retired.ContainsKey(r.Id)) s.Restored++; else s.Created++; foreach (var ch in r.Children ?? []) Count(ch); }
                    Count(node);
                    if (rawModel is not null) s.ModelAdded = rawModel.Groups.Count(g => !model.Groups.ContainsKey(g.Key)) + rawModel.Attributes.Count(a => !model.Attributes.ContainsKey(a.Key)) + rawModel.Lists.Count(l => !model.Lists.ContainsKey(l.Key)) + rawModel.Units.Count(u => !model.Units.ContainsKey(u.Key));
                    return (s, Error: null);
                }
                if (rawModel is not null) ImportModel(ctx, rawModel, s);
                Import(ctx, node, parent, s);
                return (s, Error: s.Errors.Count > 0 && s.Created + s.Restored + s.Updated == 0 ? s.Errors[0] : null);
            });
            var st = result.s;
            return result.Error is not null ? Bad(result.Error)
                : Results.Ok(new { created = st.Created, restored = st.Restored, updated = st.Updated, entries = st.Entries, model = st.ModelAdded, errors = st.Errors.Take(20), batch = body.DryRun ? null : batch, dryRun = body.DryRun, idMap = st.IdMap });
        }
    }

    private static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    // ---- Zuordnung anwenden: Attribut- und Gruppen-Keys im Knotenbaum und im Modellteil umschreiben; auf Vorhandenes
    // gemappte Definitionen werden nicht angelegt, neue bekommen den Präfix
    private static (RawNode, RawModel?) Remap(RawNode node, RawModel? m, ImportMap map, ModelCatalog model)
    {
        var prefix = Blank(map.Prefix) ?? "";
        var attrs = map.Attributes ?? new(); var groups = map.Groups ?? new();
        string A(string k) => attrs.TryGetValue(k, out var to) && to.Length > 0 ? to : model.Attributes.ContainsKey(k) ? k : prefix + k;
        string G(string k) => groups.TryGetValue(k, out var to) && to.Length > 0 ? to : model.Groups.ContainsKey(k) ? k : prefix + k;
        RawNode N(RawNode n) => n with
        {
            Axes = n.Axes?.Select(A).ToArray(),
            AxisValues = n.AxisValues?.ToDictionary(kv => A(kv.Key), kv => kv.Value),
            Groups = n.Groups?.Select(G).Distinct().ToArray(),
            LabelAttribute = n.LabelAttribute is null ? null : A(n.LabelAttribute),
            Values = n.Values.Select(v => v with { Attribute = A(v.Attribute) }).ToList(),
            Rows = n.Rows?.ToDictionary(kv => A(kv.Key), kv => kv.Value),
            Children = n.Children?.Select(N).ToList(),
        };
        RawModel? M(RawModel? x) => x is null ? null : new RawModel(
            x.Groups.Where(g => !model.Groups.ContainsKey(G(g.Key))).Select(g => g with { Key = G(g.Key) }).ToList(),
            x.Attributes.Where(a => !model.Attributes.ContainsKey(A(a.Key))).Select(a => a with { Key = A(a.Key), Group = a.Group is null ? null : G(a.Group), Columns = a.Columns?.Select(A).ToArray() }).ToList(),
            x.Lists, x.Units);
        return (N(node), M(m));
    }

    // ---- Export: der Knoten roh, mit Kindern
    public static RawNode Raw(Tree tree, Node n, bool deep)
    {
        var values = n.Values.Select(kv => new RawValue(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, kv.Key.Row, kv.Value))
            .Concat(n.Lists.Select(kv => new RawValue(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, kv.Key.Row, null, kv.Value)))
            .OrderBy(v => v.Attribute).ThenBy(v => v.Row).ThenBy(v => v.Locale).ThenBy(v => v.Channel).ToList();
        return new RawNode(n.Id, n.Role, n.Parent, n.Name, n.HasStatus ? n.Status : null, n.Axes.Length > 0 ? n.Axes : null, n.AxisValues.Count > 0 ? n.AxisValues : null,
            n.Groups.Length > 0 ? n.Groups : null, n.LabelAttribute, n.External.Count > 0 ? n.External : null, values,
            n.Rows.Count > 0 ? n.Rows.ToDictionary(kv => kv.Key, kv => kv.Value.ToList()) : null,
            n.Role == Roles.Group && n.Label.Count > 0 ? n.Label : null,
            deep ? tree.Children(n.Id).Select(k => Raw(tree, k, true)).ToList() : null);
    }

    private sealed class Stats { public int Created, Restored, Updated, Entries, ModelAdded; public List<string> Errors = new(); public Dictionary<string, string> IdMap = new(); }

    // ---- Modellteile, die der Teilbaum benutzt: Gruppen (angehängte und die der Attribute), Attribute mit Werten, Achsen, Zeilen, Stern; Listen, Einheiten
    public static RawModel UsedModel(ModelCatalog model, Tree tree, Node root, bool deep)
    {
        var nodes = deep ? tree.DescendantsDeepestFirst(root.Id).Append(root) : [root];
        var attrs = new HashSet<string>(); var groups = new HashSet<string>();
        foreach (var n in nodes)
        {
            foreach (var a in n.Values.Keys) attrs.Add(a.Attribute);
            foreach (var a in n.Lists.Keys) attrs.Add(a.Attribute);
            foreach (var a in n.Rows.Keys) attrs.Add(a);
            foreach (var a in n.Axes) attrs.Add(a);
            foreach (var a in n.AxisValues.Keys) attrs.Add(a);
            if (n.LabelAttribute is not null) attrs.Add(n.LabelAttribute);
            foreach (var g in n.Groups) groups.Add(g);
        }
        var defs = attrs.Select(k => model.Attributes.GetValueOrDefault(k)).Where(d => d is not null).Select(d => d!).ToList();
        foreach (var d in defs) if (d.Group is not null) groups.Add(d.Group);
        foreach (var d in defs) if (d.Columns is not null) foreach (var col in d.Columns) if (model.Attributes.TryGetValue(col, out var cd) && !defs.Contains(cd)) defs.Add(cd);
        var lists = defs.Where(d => d.List is not null && model.Lists.ContainsKey(d.List)).Select(d => model.Lists[d.List!]).DistinctBy(l => l.Key)
            .Select(l => new RawList(l.Key, l.Label, l.Columns, l.Ordered.ToList())).ToList();
        var units = defs.Where(d => d.Unit is not null && model.Units.ContainsKey(d.Unit)).Select(d => model.Units[d.Unit!]).DistinctBy(u => u.Key).ToList();
        return new RawModel(groups.Select(g => model.Groups.GetValueOrDefault(g)).Where(g => g is not null).Select(g => g!).OrderBy(g => g.Key).ToList(),
            defs.OrderBy(d => d.Key).ToList(), lists, units);
    }

    // ---- Fehlende Modellteile anlegen — was es schon gibt, bleibt unangetastet (Mapping ist Sache des Profils, nicht des Rohimports)
    private static void ImportModel(Ctx c, RawModel m, Stats s)
    {
        foreach (var u in m.Units ?? []) if (!c.Model.Units.ContainsKey(u.Key)) { c.Write(Model.UnitStream + u.Key, Types.UnitDefined, u); s.Entries++; s.ModelAdded++; }
        foreach (var g in m.Groups ?? []) if (!c.Model.Groups.ContainsKey(g.Key)) { c.Write(Model.GroupStream + g.Key, Types.AttributeGroupDefined, g); s.Entries++; s.ModelAdded++; }
        foreach (var l in m.Lists ?? [])
        {
            if (!c.Model.Lists.ContainsKey(l.Key)) { c.Write(Model.ListStream + l.Key, Types.ListDefined, new ListDefinition(l.Key, l.Label, l.Columns)); s.Entries++; s.ModelAdded++; }
            var have = c.Model.Lists[l.Key].Values;
            foreach (var v in l.Values ?? []) if (!have.ContainsKey(v.Value)) { c.Write(Model.ListStream + l.Key, Types.ListValueDefined, v); s.Entries++; }
        }
        foreach (var a in m.Attributes ?? [])
        {
            if (c.Model.Attributes.ContainsKey(a.Key)) continue;
            if (!AttributeTypes.All.Contains(a.Type)) { s.Errors.Add($"Attribut {a.Key}: unbekannter Typ {a.Type}"); continue; }
            c.Write(Model.AttributeStream + a.Key, Types.AttributeDefined, a); s.Entries++; s.ModelAdded++;
        }
    }

    // ---- Import: angleichen, zurückholen oder anlegen — dann Kinder
    private static void Import(Ctx c, RawNode r, string? parent, Stats s)
    {
        var tree = c.Tree;
        string id;
        var before = s.Entries;
        Outcome o;
        if (tree.Nodes.TryGetValue(r.Id, out var existing))
        {
            id = r.Id;
            if (existing.Parent != parent) Count(s, Commands.Move(c, id, parent), r.Id);
        }
        else if (tree.Retired.ContainsKey(r.Id))
        {
            id = r.Id;
            o = Commands.Restore(c, id); if (!Count(s, o, r.Id)) return; s.Restored++;
            if (tree.Nodes[id].Parent != parent) Count(s, Commands.Move(c, id, parent), r.Id);
        }
        else
        {
            o = r.Role switch
            {
                Roles.Group => Commands.CreateGroup(c, parent, r.Label, r.Name),
                Roles.Product => Commands.CreateProduct(c, parent, r.Axes),
                Roles.Variant => Commands.CreateVariant(c, parent, r.AxisValues),
                _ => Outcome.Bad($"Unbekannte Rolle {r.Role}"),
            };
            if (!Count(s, o, r.Id)) return;
            id = o.Entry!.Stream; s.Created++; s.IdMap[r.Id] = id;
        }
        var n = tree.Nodes[id];
        // Eigenschaften — nur, was abweicht
        if (r.Role != Roles.Group && (r.Name ?? "") != (n.Name ?? "")) Count(s, Commands.Rename(c, id, r.Name), r.Id);
        if (r.Role == Roles.Group && r.Name is not null && r.Name != n.Name) Count(s, Commands.Rename(c, id, r.Name), r.Id);
        // Status: an Produkt und Variante immer, an einer Gruppe seit dem 23.09.2026 — dort aber nur, wenn die Datei
        // wirklich einen mitbringt. Ein Export von früher trug an jeder Gruppe „draft“, das ist kein gesetzter Status
        // und soll keine Einträge erzeugen.
        if (r.Status is { Length: > 0 } st && st != n.Status && (r.Role != Roles.Group || n.HasStatus || st != Statuses.Draft))
            Count(s, Commands.SetStatus(c, id, st), r.Id);
        if (r.Role == Roles.Product && r.Axes is not null && !r.Axes.SequenceEqual(n.Axes) && !tree.Children(id).Any()) Count(s, Commands.SetAxes(c, id, r.Axes), r.Id);
        var groups = r.Groups ?? [];
        if (!groups.SequenceEqual(n.Groups)) Count(s, Commands.AttachGroups(c, id, groups), r.Id);
        if ((r.LabelAttribute ?? "") != (n.LabelAttribute ?? "")) Count(s, Commands.SetLabelAttribute(c, id, r.LabelAttribute), r.Id);
        foreach (var (sys, ext) in r.External ?? new()) if (n.External.GetValueOrDefault(sys) != ext) Count(s, Commands.LinkExternal(c, id, sys, ext), r.Id);
        // Zeilen: fehlende anlegen (neue Zeilen-Ids), Zellen darauf umlenken
        var rowMap = new Dictionary<string, string>();
        foreach (var (attr, rows) in r.Rows ?? new())
            foreach (var row in rows)
            {
                if (n.Rows.TryGetValue(attr, out var have) && have.Contains(row)) continue;
                var ro = Commands.AddRow(c, id, attr);
                if (Count(s, ro, r.Id)) rowMap[row] = Types.Deserialize<RowAdded>(ro.Entry!.Payload).Row;
            }
        // Werte: roh je Achse — Skripte von Formel und Vorlage bleiben Skripte
        foreach (var v in r.Values ?? [])
        {
            var row = v.Row is null ? null : rowMap.GetValueOrDefault(v.Row, v.Row);
            var axis = new Axis(v.Attribute, Blank(v.Locale), Blank(v.Channel), row);
            if (v.Values is not null) { if (n.Lists.TryGetValue(axis, out var cur) && cur.SequenceEqual(v.Values)) continue; }
            else if (n.Values.GetValueOrDefault(axis) == v.Value) continue;
            Count(s, Commands.SetAttribute(c, id, v.Attribute, axis.Locale, axis.Channel, v.Value, v.Values, row), r.Id);
        }
        if (s.Entries > before && existing is not null) s.Updated++;
        foreach (var child in r.Children ?? []) Import(c, child, id, s);
    }

    private static bool Count(Stats s, Outcome o, string id)
    {
        if (o.Error is not null) { s.Errors.Add($"{id}: {o.Error}"); return false; }
        if (o.Entry is not null) s.Entries++;
        return true;
    }
}
