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

        // Suche über Label, SKU, Id und Werte; liefert Zeilen mit Fundstelle.
        api.MapGet("/search", (string q, Catalog c, int limit = 200) =>
            string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2
                ? Results.BadRequest(new { error = "q: mindestens 2 Zeichen." })
                : Results.Ok(c.With((model, tree, _) => tree.Search(q.Trim()).Take(Math.Clamp(limit, 1, 1000)).Select(h => new { row = NodeRow.Of(tree, model, h.Node), hit = h.Hit }).ToList())));

        api.MapGet("/nodes/external/{system}/{externalId}", (string system, string externalId, Catalog c) =>
            c.With((model, tree, _) => tree.ByExternal(system, externalId) is { } n ? NodeView.Of(tree, model, n) : null)
                is { } view ? Results.Ok(view) : Results.NotFound());

        // ---- Befehle: genau ein Eintrag je Aufruf ------------------------------

        api.MapPost("/groups", (GroupCreated b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.CreateGroup(x, b.Parent, b.Label)));
        api.MapPut("/groups/{id}/label", (string id, GroupRenamed b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.RenameGroup(x, id, b.Label)));
        api.MapPost("/products", (ProductCreated b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.CreateProduct(x, b.Group, b.Family, b.Axes)));
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
                var ctx = new Ctx { Model = model, Tree = tree, Write = (stream, type, payload) => write(actor, stream, type, payload, batch) };
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
                new Ctx { Model = model, Tree = tree, Write = (stream, type, payload) => write(actor, stream, type, payload, batch) }, id, deep));
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
            Model = model, Tree = tree,
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
public sealed record NodeRow(string Id, string Role, string? Parent, string Label, string? Family, string[] Axes,
    Dictionary<string, string> AxisValues, string Status, string? Sku, Dictionary<string, string> External,
    int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor)
{
    public static NodeRow Of(Tree tree, ModelCatalog model, Node n) => new(
        n.Id, n.Role, n.Parent, LabelOf(tree, model, n), n.Family, n.Axes, n.AxisValues, n.Status,
        n.Own(Model.SkuAttribute, null, null), n.External, n.Entries, n.LastNumber, n.LastAt, n.LastActor);

    /// <summary>
    /// Gruppe: ihr Label. Produkt: das Label-Attribut seiner Familie (Vorgabe name).
    /// Variante: SKU, sonst die Achsenwerte, sonst das Label-Attribut — geerbt zählt.
    /// </summary>
    public static string LabelOf(Tree tree, ModelCatalog model, Node n)
    {
        if (n.Role == Roles.Group) return n.Label.GetValueOrDefault("de") ?? n.Label.Values.FirstOrDefault() ?? n.Id;
        var attr = CompletenessRules.FamilyOf(tree, model, n)?.LabelAttribute ?? "name";
        string? byAttr()
        {
            if (tree.Resolve(n, attr, "de", null).Value is { } de) return de;
            foreach (var l in model.Locales.Keys) if (tree.Resolve(n, attr, l, null).Value is { } v) return v;
            return tree.Resolve(n, attr, null, null).Value;
        }
        if (n.Role == Roles.Product) return byAttr() ?? n.Id;
        return n.Own(Model.SkuAttribute, null, null)
            ?? (n.AxisValues.Count > 0 ? string.Join(" · ", n.AxisValues.Values) : null)
            ?? byAttr()
            ?? n.Id;
    }
}

/// <summary>Ein Wert auf seinen Achsen — einfach oder als Liste, bei vermehrbaren Attributen mit Zeile.</summary>
public sealed record ValueView(string Attribute, string? Locale, string? Channel, string? Value, string[]? Values, string? Row = null)
{
    public static IEnumerable<ValueView> Of(Node n) =>
        n.Values.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, kv.Value, null, kv.Key.Row))
            .Concat(n.Lists.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, null, kv.Value, kv.Key.Row)));
}

/// <summary>Ein Vorfahr mit seinen Werten — der Client rechnet die Vererbung damit wie <see cref="Tree.Resolve"/>.</summary>
public sealed record AncestorView(string Id, string Role, string Label, List<ValueView> Values);

/// <summary>Ein Knoten vollständig — Kopie aus dem Abbild, ausserhalb der Sperre ungefährlich.</summary>
public sealed record NodeView(string Id, string Role, string? Parent, Labels Label, string? Family, string[] Axes,
    Dictionary<string, string> AxisValues, string Status, Dictionary<string, string> External, List<ValueView> Values, Dictionary<string, List<string>> Rows,
    List<AncestorView> Ancestors, List<string> Categories, List<Release> Releases, List<Completeness> Completeness,
    int Children, int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor)
{
    public static NodeView Of(Tree tree, ModelCatalog model, Node n) => new(
        n.Id, n.Role, n.Parent, n.Label, n.Family, n.Axes, n.AxisValues, n.Status, n.External,
        ValueView.Of(n).ToList(), n.Rows,
        tree.Ancestors(n).Select(a => new AncestorView(a.Id, a.Role, NodeRow.LabelOf(tree, model, a), ValueView.Of(a).ToList())).ToList(),
        n.Categories.Order().ToList(), n.Releases.ToList(),
        n.Role == Roles.Group ? [] : CompletenessRules.Of(tree, model, n),
        tree.Children(n.Id).Count(),
        n.Entries, n.LastNumber, n.LastAt, n.LastActor);
}
