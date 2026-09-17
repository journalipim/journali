using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Der Baum unter /api: Lesen, und jeder Befehl aus <see cref="Commands"/>
/// einzeln als Endpunkt. Die Prüfung steckt in Commands, hier ist nur HTTP.
/// </summary>
public static class TreeApi
{
    public static void Map(RouteGroupBuilder api)
    {
        // ---- Lesen -----------------------------------------------------------

        api.MapGet("/tree", (Catalog c) => c.With((model, tree, _) => tree.Nodes.Values.Select(n => NodeRow.Of(tree, model, n)).ToList()));

        api.MapGet("/nodes/{id}", (string id, Catalog c) =>
            c.With((model, tree, _) => tree.Nodes.TryGetValue(id, out var n) ? NodeView.Of(tree, model, n) : null)
                is { } view ? Results.Ok(view) : Results.NotFound());

        // Tabelle unter einem Knoten (Massenpflege, Export, Datenqualität): die Kinder — oder mit deep=true alle
        // Nachfahren — als Zeilen, die Attribute als Spalten, Werte wie in der Knotenansicht aufgelöst (geerbt zählt,
        // own sagt, ob der Wert am Knoten selbst steht). role filtert die Zeilen; attributes (a,b,c) die Spalten,
        // sonst alle Attribute, die an der Rolle der Zeilen gelten. locale/channel = die Achse; ohne = Grundwert.
        api.MapGet("/nodes/{id}/table", (string id, Catalog c, string? role = null, string? attributes = null, string? locale = null, string? channel = null, bool deep = false) =>
            c.With((model, tree, _) =>
            {
                if (!tree.Nodes.TryGetValue(id, out var root)) return Results.NotFound();
                var nodes = (deep ? tree.DescendantsDeepestFirst(id).Reverse() : tree.Children(id)).Where(n => role is null || n.Role == role).ToList();
                var wanted = attributes?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                var cols = wanted is { Length: > 0 }
                    ? wanted.Select(k => model.Attributes.GetValueOrDefault(k)).Where(a => a is not null).Select(a => a!).ToList()
                    : nodes.SelectMany(n => CompletenessRules.ActiveAttributes(tree, model, n)).DistinctBy(a => a.Key).ToList();
                var rows = nodes.Select(n => new
                {
                    row = NodeRow.Of(tree, model, n),
                    // Spalten, die an diesem Knoten nicht gelten (Gruppe erst ab tieferer Rolle, Attribut nicht erlaubt) —
                    // bei deep ist die Spaltenliste die Vereinigung über alle Knoten (Datenqualität, Taloan)
                    inactive = cols.Where(a => !CompletenessRules.ActiveAttributes(tree, model, n).Any(x => x.Key == a.Key)).Select(a => a.Key).ToList(),
                    values = cols.ToDictionary(a => a.Key, a =>
                    {
                        var (v, from) = tree.Resolve(model, n, a.Key, a.PerLocale ? locale : null, a.PerChannel ? channel : null);
                        // Formel/Vorlage: das Ergebnis zeigen, nicht das Skript — die Spalte ist in der Tabelle ohnehin gesperrt
                        if (a.IsComputed) v = tree.Compute(model, n, a, locale);
                        return new { value = v, own = from is not null && from.Id == n.Id, from = from is not null && from.Id != n.Id ? from.Id : null };
                    }),
                }).ToList();
                return Results.Ok(new { node = NodeRow.Of(tree, model, root), columns = cols.Select(a => new { a.Key, a.Type, a.Label, a.Unit, a.PerLocale, a.Required, a.List, a.Inheritable, a.Multiple, a.Pattern, computed = a.IsComputed }).ToList(), rows });
            }));

        // Suche über Label, SKU, Id und Werte; liefert Zeilen mit Fundstelle.
        api.MapGet("/search", (string q, Catalog c, int limit = 200) =>
            string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2
                ? Results.BadRequest(new { error = "q: mindestens 2 Zeichen." })
                : Results.Ok(c.With((model, tree, _) => tree.Query(model, q.Trim()).Take(Math.Clamp(limit, 1, 1000)).Select(h => new { row = NodeRow.Of(tree, model, h.Node), hit = h.Hit }).ToList())));

        api.MapGet("/nodes/external/{system}/{externalId}", (string system, string externalId, Catalog c) =>
            c.With((model, tree, _) => tree.ByExternal(system, externalId) is { } n ? NodeView.Of(tree, model, n) : null)
                is { } view ? Results.Ok(view) : Results.NotFound());

        // ---- Befehle: genau ein Eintrag je Aufruf ------------------------------

        api.MapPost("/groups", (GroupCreated b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.CreateGroup(x, b.Parent, b.Label, b.Name)));
        api.MapPut("/groups/{id}/label", (string id, GroupRenamed b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.RenameGroup(x, id, b.Label)));   // Altlast
        api.MapPut("/nodes/{id}/name", (string id, NodeNamed b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.Rename(x, id, b.Name)));
        api.MapPut("/nodes/{id}/label-attribute", (string id, LabelAttributeSet b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.SetLabelAttribute(x, id, b.Attribute)));
        api.MapPost("/products", (ProductCreated b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.CreateProduct(x, b.Group, b.Axes)));
        api.MapPut("/nodes/{id}/axes", (string id, ProductAxesSet b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.SetAxes(x, id, b.Axes)));
        api.MapPut("/nodes/{id}/groups", (string id, GroupsAttached b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.AttachGroups(x, id, b.Groups)));
        api.MapPost("/variants", (VariantCreated b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.CreateVariant(x, b.Product, b.AxisValues)));
        api.MapPost("/nodes/{id}/move", (string id, NodeMoved b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.Move(x, id, b.Parent)));
        api.MapDelete("/nodes/{id}", (string id, bool recursive, HttpRequest req, Catalog c) =>
        {
            if (!recursive) return Run(req, c, x => Commands.Retire(x, id));
            // Unterbaum: tiefste zuerst, alles in einem Stapel — Rückgängig je Aktion.
            if (Actor(req) is not { } actor) return ActorMissing();
            var batch = "b-" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();
            var result = c.With((model, tree, write) =>
            {
                if (!tree.Nodes.ContainsKey(id)) return (Count: -1, Batch: batch);
                var ctx = new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Write = (stream, type, payload) => write(actor, stream, type, payload, batch) };
                var n = 0;
                foreach (var d in tree.DescendantsDeepestFirst(id).ToList()) { Commands.Retire(ctx, d.Id); n++; }
                Commands.Retire(ctx, id); n++;
                return (Count: n, Batch: batch);
            });
            return result.Count < 0 ? Results.NotFound() : Results.Ok(new { retired = result.Count, batch = result.Batch });
        });
        api.MapPost("/nodes/{id}/duplicate", (string id, bool deep, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var batch = "b-" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();
            var r = c.With((model, tree, write) => Commands.Duplicate(
                new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Write = (stream, type, payload) => write(actor, stream, type, payload, batch) }, id, deep));
            return r.Id is not null ? Results.Ok(new { id = r.Id, entries = r.Count, batch })
                : r.Error is not null ? Bad(r.Error) : Results.NotFound();
        });
        api.MapPost("/nodes/{id}/status", (string id, StatusSet b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.SetStatus(x, id, b.Status)));
        api.MapPost("/nodes/{id}/attributes", (string id, AttributeSet b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.SetAttribute(x, id, b.Attribute, b.Locale, b.Channel, b.Value, b.Values, b.Row)));
        api.MapPost("/nodes/{id}/rows", (string id, RowAdded b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.AddRow(x, id, b.Attribute)));
        api.MapDelete("/nodes/{id}/rows/{attribute}/{row}", (string id, string attribute, string row, HttpRequest req, Catalog c) => Run(req, c, x => Commands.RemoveRow(x, id, attribute, row)));
        api.MapPut("/nodes/{id}/rows/{attribute}", (string id, string attribute, RowOrdered b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.OrderRows(x, id, attribute, b.Rows)));
        api.MapPost("/nodes/{id}/categories", (string id, CategoryAssigned b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.AssignCategory(x, id, b.Category)));
        api.MapDelete("/nodes/{id}/categories/{category}", (string id, string category, HttpRequest req, Catalog c) => Run(req, c, x => Commands.RemoveCategory(x, id, category)));
        api.MapPost("/nodes/{id}/releases", (string id, ReleaseGranted b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.GrantRelease(x, id, b.Channel, b.Locale)));
        api.MapDelete("/nodes/{id}/releases", (string id, string channel, string? locale, HttpRequest req, Catalog c) => Run(req, c, x => Commands.RevokeRelease(x, id, channel, locale)));
        api.MapPut("/nodes/{id}/external/{system}", (string id, string system, ExternalLinked b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.LinkExternal(x, id, system, b.Id)));
        api.MapDelete("/nodes/{id}/external/{system}", (string id, string system, HttpRequest req, Catalog c) => Run(req, c, x => Commands.UnlinkExternal(x, id, system)));
    }

    /// <summary>Ein Befehl: Urheber aus dem Kopf, Prüfen und Schreiben unter der Sperre, Ergebnis als HTTP.</summary>
    public static IResult Run(HttpRequest req, Catalog c, Func<Ctx, Outcome> command)
    {
        if (Actor(req) is not { } actor) return ActorMissing();
        var outcome = c.With((model, tree, write) => command(new Ctx
        {
            Model = model, Tree = tree, Relations = c.Relations, Media = c.Media,
            Write = (stream, type, payload) => write(actor, stream, type, payload, null),
        }));
        return outcome switch
        {
            { Entry: { } e } => Results.Ok(EntryView.Of(e)),
            { NotFound: true } => Results.NotFound(),
            _ => Bad(outcome.Error!),
        };
    }
}

/// <summary>Eine Zeile im Baum: genug für die Anzeige, ohne Werte.</summary>
public sealed record NodeRow(string Id, string Role, string? Parent, string Label, string? Name, string? Groups, string[] Axes,
    Dictionary<string, string> AxisValues, string Status, string? Sku, Dictionary<string, string> External,
    int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor, string? LabelAttribute = null)
{
    public static NodeRow Of(Tree tree, ModelCatalog model, Node n) => new(
        n.Id, n.Role, n.Parent, LabelOf(tree, model, n), n.Name, n.Groups.Length > 0 ? string.Join(",", n.Groups) : null, n.Axes, n.AxisValues, n.Status,
        n.Own(Model.SkuAttribute, null, null), n.External, n.Entries, n.LastNumber, n.LastAt, n.LastActor, LabelAttributeOf(tree, model, n));

    /// <summary>Das ★-Attribut, das diesen Knoten benennt (Tabelle, Taloan): null bei fixiertem Namen; sonst das nächste ★ am Pfad,
    /// das hier gilt und einen Wert hat — hat keins einen Wert, das nächste, das hier gilt (dann benennt der Wert, sobald er da ist).</summary>
    public static string? LabelAttributeOf(Tree tree, ModelCatalog model, Node n)
    {
        if (!string.IsNullOrWhiteSpace(n.Name)) return null;
        string? first = null;
        foreach (var (attr, _) in tree.LabelAttributesOf(n))
        {
            if (!AppliesAt(model, attr, n.Role)) continue;
            if (ByAttribute(tree, model, n, attr) is not null) return attr;
            first ??= attr;
        }
        return first;
    }

    /// <summary>
    /// Name im Baum (docs/pflegestruktur.md, 17), in dieser Reihenfolge:
    /// 1. eigener Name (NodeNamed); 2. die Sternchen am Pfad, das nächste zuerst — ein ★
    /// zählt nur, wo sein Attribut an dieser Rolle gilt und einen Wert hat (de zuerst,
    /// dann die anderen Sprachen, dann ohne — geerbt zählt; Werteliste zeigt ihr Label),
    /// sonst das nächste weiter oben; 3. bei der Variante SKU, dann Achsenwerte; 4. die Id.
    /// </summary>
    public static string LabelOf(Tree tree, ModelCatalog model, Node n)
    {
        if (!string.IsNullOrWhiteSpace(n.Name)) return n.Name;
        foreach (var (attr, _) in tree.LabelAttributesOf(n))
            if (AppliesAt(model, attr, n.Role) && ByAttribute(tree, model, n, attr) is { } v) return v;
        if (n.Role == Roles.Variant)
        {
            if (n.Own(Model.SkuAttribute, null, null) is { } sku) return sku;
            if (n.AxisValues.Count > 0) return string.Join(" · ", n.AxisValues.Values);
        }
        return n.Id;
    }

    /// <summary>Gilt das Attribut an dieser Rolle (Gruppe aktiv, levels)? Ein ★ an SKU benennt Varianten, nicht die Produkte darüber.</summary>
    public static bool AppliesAt(ModelCatalog model, string attr, string role) =>
        model.Attributes.TryGetValue(attr, out var d) && d.AllowedAt(role) && model.GroupActiveAt(d.Group ?? "", role);

    /// <summary>Wert eines Attributs als Text fürs Label — null, wenn leer.</summary>
    public static string? ByAttribute(Tree tree, ModelCatalog model, Node n, string attr)
    {
        var raw = tree.Resolve(model, n, attr, "de", null).Value;
        if (raw is null) foreach (var l in model.Locales.Keys) if (tree.Resolve(model, n, attr, l, null).Value is { } lv) { raw = lv; break; }
        raw ??= tree.Resolve(model, n, attr, null, null).Value;
        if (string.IsNullOrWhiteSpace(raw)) return null;
        if (model.Attributes.TryGetValue(attr, out var def) && def.Type == AttributeTypes.Enum
            && model.Lists.TryGetValue(def.List ?? "", out var list) && list.Values.TryGetValue(raw, out var value)
            && value.Label.GetValueOrDefault("de") is { Length: > 0 } label) return label;
        return raw;
    }
}

/// <summary>Ein Wert auf seinen Achsen — einfach oder als Liste, bei vermehrbaren Attributen mit Zeile.</summary>
/// <param name="Number">Eintrag, der den Wert zuletzt setzte — der Client vergleicht damit Mastersprache gegen Übersetzung.</param>
public sealed record ValueView(string Attribute, string? Locale, string? Channel, string? Value, string[]? Values, string? Row = null, long Number = 0)
{
    public static IEnumerable<ValueView> Of(Medium m) =>
        m.Values.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, kv.Value, null, kv.Key.Row, m.SetAt.GetValueOrDefault(kv.Key)))
            .Concat(m.Lists.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, null, kv.Value, kv.Key.Row, m.SetAt.GetValueOrDefault(kv.Key))));

    public static IEnumerable<ValueView> Of(Relation r) =>
        r.Values.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, kv.Value, null, kv.Key.Row, r.SetAt.GetValueOrDefault(kv.Key)))
            .Concat(r.Lists.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, null, kv.Value, kv.Key.Row, r.SetAt.GetValueOrDefault(kv.Key))));

    public static IEnumerable<ValueView> Of(Node n) =>
        n.Values.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, kv.Value, null, kv.Key.Row, n.SetAt.GetValueOrDefault(kv.Key)))
            .Concat(n.Lists.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, null, kv.Value, kv.Key.Row, n.SetAt.GetValueOrDefault(kv.Key))));
}

/// <summary>Ergebnis eines Formel-Attributs an diesem Knoten (null = kein Skript oder ein Wert fehlt).</summary>
public sealed record ComputedView(string Attribute, string? Value, string? Locale);

/// <summary>Ein Vorfahr mit seinen Werten — der Client rechnet die Vererbung damit wie <see cref="Tree.Resolve"/>.</summary>
public sealed record AncestorView(string Id, string Role, string Label, List<ValueView> Values);

/// <summary>Eine Gruppe, die am Knoten gilt: woher (angehängt hier oder oben), ob hier aktiv, welche Attribute sie hier hat.</summary>
public sealed record GroupView(string Key, string From, string FromLabel, bool Active, List<string> Attributes);

/// <summary>Ein Knoten vollständig — Kopie aus dem Abbild, ausserhalb der Sperre ungefährlich.</summary>
/// <summary>Ein ★ am Pfad: Attribut, wo es gesetzt ist, ob es an diesem Knoten gilt.</summary>
public sealed record StarView(string Attribute, string From, string FromLabel, bool Applies);

public sealed record NodeView(string Id, string Role, string? Parent, Labels Label, string? Name, List<StarView> Stars, string? Family, string[] Axes,
    Dictionary<string, string> AxisValues, string Status, Dictionary<string, string> External, List<ValueView> Values, Dictionary<string, List<string>> Rows,
    List<AncestorView> Ancestors, string[] AttachedGroups, List<GroupView> Groups, List<string> Orphans, List<ComputedView> Computed,
    List<string> Categories, List<Release> Releases, List<Completeness> Completeness,
    int Children, int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor)
{
    public static NodeView Of(Tree tree, ModelCatalog model, Node n)
    {
        var effective = tree.EffectiveGroups(n);
        var groups = effective.Select(g => new GroupView(g.Group, g.From.Id, NodeRow.LabelOf(tree, model, g.From), model.GroupActiveAt(g.Group, n.Role),
            model.AttributesOf(g.Group).Where(a => a.AllowedAt(n.Role)).Select(a => a.Key).ToList())).ToList();
        var covered = groups.SelectMany(g => g.Attributes).ToHashSet();
        // Verwaist: eigene Werte für Attribute, die hier über keine Gruppe gelten (z. B. nach dem Umhängen).
        var orphans = n.Values.Keys.Select(k => k.Attribute).Concat(n.Lists.Keys.Select(k => k.Attribute)).Concat(n.Rows.Keys).Distinct().Where(a => !covered.Contains(a)).Order().ToList();
        var stars = tree.LabelAttributesOf(n).Select(s => new StarView(s.Attribute, s.From.Id, NodeRow.LabelOf(tree, model, s.From), NodeRow.AppliesAt(model, s.Attribute, n.Role))).ToList();
        return new(
        n.Id, n.Role, n.Parent, n.Label, n.Name, stars, n.Family, n.Axes, n.AxisValues, n.Status, n.External,
        ValueView.Of(n).ToList(), n.Rows,
        tree.Ancestors(n).Select(a => new AncestorView(a.Id, a.Role, NodeRow.LabelOf(tree, model, a), ValueView.Of(a).ToList())).ToList(),
        n.Groups, groups, orphans,
        CompletenessRules.ActiveAttributes(tree, model, n).Where(a => a.IsComputed)
            .SelectMany(a => a.PerLocale ? model.Locales.Keys.Select(l => new ComputedView(a.Key, tree.Compute(model, n, a, l), l)) : [new ComputedView(a.Key, tree.Compute(model, n, a, null), null)]).ToList(),
        n.Categories.Order().ToList(), n.Releases.ToList(),
        CompletenessRules.Of(tree, model, n),
        tree.Children(n.Id).Count(),
        n.Entries, n.LastNumber, n.LastAt, n.LastActor);
    }
}
