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

        api.MapGet("/tree", (Catalog c) => c.Read(tree => tree.Nodes.Values.Select(n => NodeRow.Of(tree, n)).ToList()));

        api.MapGet("/nodes/{id}", (string id, Catalog c) =>
            c.Read(tree => tree.Nodes.TryGetValue(id, out var n) ? NodeView.Of(tree, n) : null)
                is { } view ? Results.Ok(view) : Results.NotFound());

        api.MapGet("/nodes/external/{system}/{externalId}", (string system, string externalId, Catalog c) =>
            c.Read(tree => tree.ByExternal(system, externalId) is { } n ? NodeView.Of(tree, n) : null)
                is { } view ? Results.Ok(view) : Results.NotFound());

        // ---- Befehle: genau ein Eintrag je Aufruf ------------------------------

        api.MapPost("/groups", (GroupCreated b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.CreateGroup(x, b.Parent, b.Label)));
        api.MapPut("/groups/{id}/label", (string id, GroupRenamed b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.RenameGroup(x, id, b.Label)));
        api.MapPost("/products", (ProductCreated b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.CreateProduct(x, b.Group, b.Family, b.Axes)));
        api.MapPost("/variants", (VariantCreated b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.CreateVariant(x, b.Product, b.AxisValues)));
        api.MapPost("/nodes/{id}/move", (string id, NodeMoved b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.Move(x, id, b.Parent)));
        api.MapDelete("/nodes/{id}", (string id, HttpRequest req, Catalog c) => Run(req, c, x => Commands.Retire(x, id)));
        api.MapPost("/nodes/{id}/status", (string id, StatusSet b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.SetStatus(x, id, b.Status)));
        api.MapPost("/nodes/{id}/attributes", (string id, AttributeSet b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.SetAttribute(x, id, b.Attribute, b.Locale, b.Channel, b.Value, b.Values)));
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
    public static NodeRow Of(Tree tree, Node n) => new(
        n.Id, n.Role, n.Parent, LabelOf(tree, n), n.Family, n.Axes, n.AxisValues, n.Status,
        n.Own(Model.SkuAttribute, null, null), n.External, n.Entries, n.LastNumber, n.LastAt, n.LastActor);

    /// <summary>Gruppe: ihr Label; Produkt: sein Name; Variante: SKU oder die Achsenwerte.</summary>
    public static string LabelOf(Tree tree, Node n) => n.Role switch
    {
        Roles.Group => n.Label.GetValueOrDefault("de") ?? n.Label.Values.FirstOrDefault() ?? n.Id,
        Roles.Product => tree.Resolve(n, "name", "de", null).Value ?? n.Id,
        _ => n.Own(Model.SkuAttribute, null, null)
             ?? (n.AxisValues.Count > 0 ? string.Join(" · ", n.AxisValues.Values) : null)
             ?? n.Own("name", "de", null)
             ?? n.Id,
    };
}

/// <summary>Ein Wert auf seinen Achsen — einfach oder als Liste.</summary>
public sealed record ValueView(string Attribute, string? Locale, string? Channel, string? Value, string[]? Values)
{
    public static IEnumerable<ValueView> Of(Node n) =>
        n.Values.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, kv.Value, null))
            .Concat(n.Lists.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, null, kv.Value)));
}

/// <summary>Ein Vorfahr mit seinen Werten — der Client rechnet die Vererbung damit wie <see cref="Tree.Resolve"/>.</summary>
public sealed record AncestorView(string Id, string Role, string Label, List<ValueView> Values);

/// <summary>Ein Knoten vollständig — Kopie aus dem Abbild, ausserhalb der Sperre ungefährlich.</summary>
public sealed record NodeView(string Id, string Role, string? Parent, Labels Label, string? Family, string[] Axes,
    Dictionary<string, string> AxisValues, string Status, Dictionary<string, string> External, List<ValueView> Values, List<AncestorView> Ancestors,
    List<string> Categories, List<Release> Releases, int Children, int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor)
{
    public static NodeView Of(Tree tree, Node n) => new(
        n.Id, n.Role, n.Parent, n.Label, n.Family, n.Axes, n.AxisValues, n.Status, n.External,
        ValueView.Of(n).ToList(),
        tree.Ancestors(n).Select(a => new AncestorView(a.Id, a.Role, NodeRow.LabelOf(tree, a), ValueView.Of(a).ToList())).ToList(),
        n.Categories.Order().ToList(), n.Releases.ToList(), tree.Children(n.Id).Count(),
        n.Entries, n.LastNumber, n.LastAt, n.LastActor);
}
