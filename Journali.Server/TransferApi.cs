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
    /// <param name="Unit">Einheit, in der ein Zahlenwert eingegeben wurde (AttributeSet.Unit); <c>Value</c> steht in der des Attributs.</param>
    public sealed record RawValue(string Attribute, string? Locale = null, string? Channel = null, string? Row = null, string? Value = null, string[]? Values = null, string? Unit = null);
    /// <summary>Eine Relation in den Rohdaten (30.09.2026): am Knoten, von dem sie ausgeht; das Ziel per Id. Ziele ausserhalb des Teilbaums
    /// bleiben Ids — der Import legt die Relation an, wenn es das Ziel dort gibt.</summary>
    public sealed record RawRelation(string Type, string To, List<RawValue>? Values = null, Dictionary<string, string>? External = null);
    /// <summary>Eine Stufe des Lebenszyklus in den Rohdaten: ab welchem Tag welcher Status gilt. Nur gewählte Tage
    /// stehen hier — ein Status ohne Datum ist schlicht <c>Status</c>.</summary>
    public sealed record RawStatus(string Status, string From);
    public sealed record RawNode(string Id, string Role, string? Parent, string? Name, string? Status, string[]? Axes, Dictionary<string, string>? AxisValues,
        string[]? Groups, string? LabelAttribute, Dictionary<string, string>? External, List<RawValue> Values, Dictionary<string, List<string>>? Rows,
        Labels? Label, List<RawNode>? Children, List<RawStatus>? StatusPlan = null, List<RawRelation>? Relations = null)
    {
        [JsonIgnore] public string? Family { get; init; }
    }
    /// <summary>Die Modellteile, die der Teilbaum benutzt — damit ein Import in ein anderes System die Definitionen mitbringt.</summary>
    /// <param name="RelationTypes">Die Relationstypen, die der Teilbaum benutzt (30.09.2026).</param>
    /// <param name="Memberships">Attribut → alle seine Gruppen (n:m), für die hier benutzten Attribute — sonst fehlt einem Attribut, das nur Mitglied der
    /// Gruppe eines Relationstyps ist, im anderen System die Zugehörigkeit.</param>
    public sealed record RawModel(List<AttributeGroupDefinition> Groups, List<AttributeDefinition> Attributes, List<RawList> Lists, List<UnitDefinition> Units,
        List<RelationTypeDefinition>? RelationTypes = null, Dictionary<string, string[]>? Memberships = null);
    public sealed record RawList(string Key, Labels Label, string[]? Columns, List<ListValueDefinition> Values);
    public sealed record RawExport(RawModel Model, RawNode Node);
    /// <summary>Zuordnung aus dem Import-Manager: JSON-Key → vorhandenes Attribut/Gruppe, oder neu (mit Präfix). Fehlt ein Key hier, gilt: gleicher Key.</summary>
    public sealed record ImportMap(Dictionary<string, string>? Attributes = null, Dictionary<string, string>? Groups = null, string? Prefix = null);
    public sealed record ImportBody(RawNode Node, string? Parent = null, RawModel? Model = null, ImportMap? Map = null, bool DryRun = false);

    public static void Map(RouteGroupBuilder api)
    {
        api.MapGet("/nodes/{id}/export", (string id, Catalog c, bool deep = true) =>
            c.Lesen((model, tree) => tree.Nodes.TryGetValue(id, out var n) ? Results.Ok(new RawExport(UsedModel(model, tree, n, deep, c.Relations), Raw(tree, n, deep, c.Relations))) : Results.NotFound()));

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
                ImportRelations(ctx, s);
                return (s, Error: s.Errors.Count > 0 && s.Created + s.Restored + s.Updated == 0 ? s.Errors[0] : null);
            });
            var st = result.s;
            return result.Error is not null ? Bad(result.Error)
                : Results.Ok(new { created = st.Created, restored = st.Restored, updated = st.Updated, entries = st.Entries, model = st.ModelAdded, relations = st.RelationsAdded, errors = st.Errors.Take(20), batch = body.DryRun ? null : batch, dryRun = body.DryRun, idMap = st.IdMap });
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
            Relations = n.Relations?.Select(rl => rl with { Values = rl.Values?.Select(v => v with { Attribute = A(v.Attribute) }).ToList() }).ToList(),
            Children = n.Children?.Select(N).ToList(),
        };
        RawModel? M(RawModel? x) => x is null ? null : new RawModel(
            x.Groups.Where(g => !model.Groups.ContainsKey(G(g.Key))).Select(g => g with { Key = G(g.Key) }).ToList(),
            x.Attributes.Where(a => !model.Attributes.ContainsKey(A(a.Key))).Select(a => a with { Key = A(a.Key), Group = a.Group is null ? null : G(a.Group), Columns = a.Columns?.Select(A).ToArray() }).ToList(),
            x.Lists, x.Units,
            x.RelationTypes?.Where(t => !model.RelationTypes.ContainsKey(t.Key)).Select(t => t with { Group = t.Group is null ? null : G(t.Group), Groups = t.Groups?.Select(G).ToArray() }).ToList(),
            x.Memberships?.Where(kv => !model.Attributes.ContainsKey(A(kv.Key))).ToDictionary(kv => A(kv.Key), kv => kv.Value.Select(G).ToArray()));
        return (N(node), M(m));
    }

    // ---- Export: der Knoten roh, mit Kindern
    /// <summary>Die Relationen, die von diesem Knoten ausgehen und zu einem Knoten führen (Medien-Zuordnungen gehören zur Bibliothek), mit ihren Werten.</summary>
    private static List<RawRelation>? RawRelations(Tree tree, Relations? rel, Node n)
    {
        if (rel is null) return null;
        var list = rel.From(n.Id).Where(r => tree.Nodes.ContainsKey(r.To)).OrderBy(r => r.Type).ThenBy(r => r.To).Select(r =>
        {
            var vals = r.Values.Select(kv => new RawValue(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, null, kv.Value, null, r.Units.GetValueOrDefault(kv.Key)))
                .Concat(r.Lists.Select(kv => new RawValue(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, null, null, kv.Value)))
                .OrderBy(v => v.Attribute).ThenBy(v => v.Locale).ThenBy(v => v.Channel).ToList();
            return new RawRelation(r.Type, r.To, vals.Count > 0 ? vals : null, r.External.Count > 0 ? r.External : null);
        }).ToList();
        return list.Count > 0 ? list : null;
    }

    public static RawNode Raw(Tree tree, Node n, bool deep, Relations? rel = null)
    {
        var values = n.Values.Select(kv => new RawValue(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, kv.Key.Row, kv.Value, null, n.Units.GetValueOrDefault(kv.Key)))
            .Concat(n.Lists.Select(kv => new RawValue(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, kv.Key.Row, null, kv.Value)))
            .OrderBy(v => v.Attribute).ThenBy(v => v.Row).ThenBy(v => v.Locale).ThenBy(v => v.Channel).ToList();
        return new RawNode(n.Id, n.Role, n.Parent, n.Name, n.HasStatus ? n.Status : null, n.Axes.Length > 0 ? n.Axes : null, n.AxisValues.Count > 0 ? n.AxisValues : null,
            n.Groups.Length > 0 ? n.Groups : null, n.LabelAttribute, n.External.Count > 0 ? n.External : null, values,
            n.Rows.Count > 0 ? n.Rows.ToDictionary(kv => kv.Key, kv => kv.Value.ToList()) : null,
            n.Role == Roles.Group && n.Label.Count > 0 ? n.Label : null,
            deep ? tree.Children(n.Id).Select(k => Raw(tree, k, true, rel)).ToList() : null,
            // Was erst noch gilt, geht mit: sonst faellt ein zum Jahreswechsel geplanter Status beim Ausleiten weg
            n.StatusGeplant is { } g ? [new RawStatus(g.Status, g.Ab.ToString("yyyy-MM-dd"))] : null,
            RawRelations(tree, rel, n));
    }

    private sealed class Stats
    {
        public int Created, Restored, Updated, Entries, ModelAdded, RelationsAdded;
        public List<string> Errors = new(); public Dictionary<string, string> IdMap = new();
        /// <summary>Relationen, die erst nach allen Knoten eingespielt werden — ihr Ziel kann weiter hinten im Teilbaum stehen.</summary>
        public List<(string From, RawRelation Relation)> Pending = new();
    }

    // ---- Modellteile, die der Teilbaum benutzt: Gruppen (angehängte und die der Attribute), Attribute mit Werten, Achsen, Zeilen, Stern; Listen, Einheiten
    public static RawModel UsedModel(ModelCatalog model, Tree tree, Node root, bool deep, Relations? rel = null)
    {
        var nodes = deep ? tree.DescendantsDeepestFirst(root.Id).Append(root).ToList() : [root];
        var attrs = new HashSet<string>(); var groups = new HashSet<string>(); var relTypes = new HashSet<string>();
        foreach (var n in nodes)
        {
            // Relationen: ihr Typ, seine Gruppen und die Attribute ihrer Werte gehören zum Modellteil
            foreach (var r in rel?.From(n.Id).Where(r => tree.Nodes.ContainsKey(r.To)) ?? [])
            {
                relTypes.Add(r.Type);
                foreach (var a in r.Values.Keys) attrs.Add(a.Attribute);
                foreach (var a in r.Lists.Keys) attrs.Add(a.Attribute);
            }
            foreach (var a in n.Values.Keys) attrs.Add(a.Attribute);
            foreach (var a in n.Lists.Keys) attrs.Add(a.Attribute);
            foreach (var a in n.Rows.Keys) attrs.Add(a);
            foreach (var a in n.Axes) attrs.Add(a);
            foreach (var a in n.AxisValues.Keys) attrs.Add(a);
            if (n.LabelAttribute is not null) attrs.Add(n.LabelAttribute);
            foreach (var g in n.Groups) groups.Add(g);
        }
        var types = relTypes.Select(k => model.RelationTypes.GetValueOrDefault(k)).Where(t => t is not null).Select(t => t!).OrderBy(t => t.Key).ToList();
        foreach (var t in types) foreach (var g in t.AllGroups()) groups.Add(g);
        var defs = attrs.Select(k => model.Attributes.GetValueOrDefault(k)).Where(d => d is not null).Select(d => d!).ToList();
        foreach (var d in defs) if (d.Group is not null) groups.Add(d.Group);
        // Mitgliedschaften (n:m): alle Gruppen eines benutzten Attributs mit — auch die, in der es nur Mitglied ist
        var memberships = defs.Where(d => model.AttributeGroups.ContainsKey(d.Key)).ToDictionary(d => d.Key, d => model.AttributeGroups[d.Key].Order().ToArray());
        foreach (var g in memberships.Values.SelectMany(x => x)) groups.Add(g);
        foreach (var d in defs) if (d.Columns is not null) foreach (var col in d.Columns) if (model.Attributes.TryGetValue(col, out var cd) && !defs.Contains(cd)) defs.Add(cd);
        var lists = defs.Where(d => d.List is not null && model.Lists.ContainsKey(d.List)).Select(d => model.Lists[d.List!]).DistinctBy(l => l.Key)
            .Select(l => new RawList(l.Key, l.Label, l.Columns, l.Ordered.ToList())).ToList();
        var units = defs.Where(d => d.Unit is not null && model.Units.ContainsKey(d.Unit)).Select(d => model.Units[d.Unit!]).DistinctBy(u => u.Key).ToList();
        return new RawModel(groups.Select(g => model.Groups.GetValueOrDefault(g)).Where(g => g is not null).Select(g => g!).OrderBy(g => g.Key).ToList(),
            defs.OrderBy(d => d.Key).ToList(), lists, units, types.Count > 0 ? types : null, memberships.Count > 0 ? memberships : null);
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
            // Mitgliedschaften (n:m) des neuen Attributs, soweit die Datei sie kennt
            if (m.Memberships is { } ms && ms.TryGetValue(a.Key, out var gs) && gs.Length > 0) { c.Write(Model.AttributeStream + a.Key, Types.AttributeGroupsSet, new AttributeGroupsSet(a.Key, gs)); s.Entries++; }
        }
        foreach (var t in m.RelationTypes ?? []) if (!c.Model.RelationTypes.ContainsKey(t.Key)) { c.Write(Model.RelationStream + t.Key, Types.RelationTypeDefined, t); s.Entries++; s.ModelAdded++; }
    }

    // ---- Relationen: nach allen Knoten, weil ihr Ziel weiter hinten im Teilbaum stehen kann. Gibt es die Relation schon (gleicher Typ,
    // gleiche Enden), werden nur abweichende Werte geschrieben; sonst wird sie angelegt. Ein Ziel, das es hier nicht gibt, ist ein Fehler
    // dieser einen Relation — die übrigen gehen weiter.
    private static void ImportRelations(Ctx c, Stats s)
    {
        foreach (var (from, rr) in s.Pending)
        {
            var to = s.IdMap.GetValueOrDefault(rr.To, rr.To);
            if (!c.Tree.Nodes.ContainsKey(to)) { s.Errors.Add($"Relation {rr.Type} von {from} nach {rr.To}: das Ziel gibt es hier nicht."); continue; }
            var symmetric = c.Model.RelationTypes.GetValueOrDefault(rr.Type)?.Symmetric ?? false;
            var have = c.Relations.From(from).FirstOrDefault(x => x.Type == rr.Type && x.To == to)
                ?? (symmetric ? c.Relations.From(to).FirstOrDefault(x => x.Type == rr.Type && x.To == from) : null);
            string id;
            if (have is null)
            {
                var o = Commands.CreateRelation(c, rr.Type, from, to);
                if (!Count(s, o, from)) continue;
                id = o.Entry!.Stream; s.RelationsAdded++;
            }
            else id = have.Id;
            var rel = c.Relations.All[id];
            foreach (var v in rr.Values ?? [])
            {
                var axis = new Axis(v.Attribute, Blank(v.Locale), Blank(v.Channel));
                if (v.Values is not null ? rel.Lists.TryGetValue(axis, out var cur) && cur.SequenceEqual(v.Values) : rel.Values.GetValueOrDefault(axis) == v.Value) continue;
                Count(s, Commands.SetRelationAttribute(c, id, v.Attribute, axis.Locale, axis.Channel, v.Value, v.Values, v.Unit), from);
            }
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
                _ => Outcome.Bad("Unbekannte Rolle {0}", r.Role),
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
        // Geplante Stufen: nur, was hier noch nicht so steht — ein zweiter Import derselben Datei schreibt nichts
        foreach (var p in r.StatusPlan ?? [])
            if (DateOnly.TryParse(p.From, System.Globalization.CultureInfo.InvariantCulture, out var ab) && n.StatusAm(ab) != p.Status)
                Count(s, Commands.SetStatus(c, id, p.Status, p.From), r.Id);
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
            Count(s, Commands.SetAttribute(c, id, v.Attribute, axis.Locale, axis.Channel, v.Value, v.Values, row, v.Unit), r.Id);
        }
        foreach (var rr in r.Relations ?? []) s.Pending.Add((id, rr));
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
