using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Der Baum unter /api: Knoten anlegen, umhängen, zurückziehen, Status;
/// Werte, Kategorien, Freigaben je Knoten. Jeder Befehl ein Eintrag,
/// geprüft gegen Modell und Baum unter der Sperre (docs/pflegestruktur.md, 5 und 8).
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

        // ---- Anlegen ---------------------------------------------------------

        api.MapPost("/groups", (GroupCreated body, HttpRequest req, Catalog c) =>
            Command(req, c, (model, tree, write) =>
            {
                var parent = Blank(body.Parent);
                if (parent is not null && !IsRole(tree, parent, Roles.Group)) return Bad("Eltern müssen eine Produktgruppe sein.");
                return write(Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(parent, body.Label ?? new()));
            }));

        api.MapPost("/products", (ProductCreated body, HttpRequest req, Catalog c) =>
            Command(req, c, (model, tree, write) =>
            {
                if (!IsRole(tree, body.Group, Roles.Group)) return Bad("Ein Produkt hängt unter einer Produktgruppe.");
                if (!model.Families.TryGetValue(body.Family ?? "", out var family)) return Bad($"Unbekannte Familie: {body.Family}");
                var axes = body.Axes?.Where(a => a.Length > 0).Distinct().ToArray() ?? [];
                if (axes.Except(family.Axes ?? []).Any()) return Bad($"Variantenachsen der Familie {family.Key}: {string.Join(", ", family.Axes ?? [])}");
                return write(Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(body.Group, family.Key, axes.Length > 0 ? axes : null));
            }));

        api.MapPost("/variants", (VariantCreated body, HttpRequest req, Catalog c) =>
            Command(req, c, (model, tree, write) =>
            {
                if (!tree.Nodes.TryGetValue(body.Product ?? "", out var product) || product.Role != Roles.Product) return Bad("Eine Variante hängt unter einem Produkt.");
                var values = body.AxisValues ?? new();
                if (!values.Keys.ToHashSet().SetEquals(product.Axes)) return Bad($"Achsenwerte für genau: {string.Join(", ", product.Axes)}");
                foreach (var (axis, value) in values)
                {
                    if (!model.Attributes.TryGetValue(axis, out var def)) return Bad($"Unbekannte Achse: {axis}");
                    string? v = value; string[]? none = null;
                    if (CheckValue(model, def, ref v, ref none) is { } error) return Bad(error);
                    if (v is null) return Bad($"Achse {axis} braucht einen Wert.");
                    values[axis] = v;
                }
                if (tree.Children(product.Id).Any(s => s.AxisValues.Count == values.Count && s.AxisValues.All(kv => values.TryGetValue(kv.Key, out var x) && x == kv.Value)))
                    return Bad("Diese Variante gibt es schon.");
                return write(Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(product.Id, values));
            }));

        // ---- Ändern ----------------------------------------------------------

        api.MapPut("/groups/{id}/label", (string id, GroupRenamed body, HttpRequest req, Catalog c) =>
            Command(req, c, (model, tree, write) =>
                IsRole(tree, id, Roles.Group) ? write(id, Types.GroupRenamed, new GroupRenamed(body.Label ?? new())) : Results.NotFound()));

        api.MapPost("/nodes/{id}/move", (string id, NodeMoved body, HttpRequest req, Catalog c) =>
            Command(req, c, (model, tree, write) =>
            {
                if (!tree.Nodes.TryGetValue(id, out var n)) return Results.NotFound();
                if (!tree.Nodes.TryGetValue(body.Parent ?? "", out var target)) return Bad("Ziel gibt es nicht.");
                var need = n.Role == Roles.Variant ? Roles.Product : Roles.Group;
                if (target.Role != need) return Bad($"{n.Role} hängt unter {need}.");
                if (target.Id == n.Id || tree.Ancestors(target).Any(a => a.Id == n.Id)) return Bad("Nicht unter sich selbst.");
                return write(id, Types.NodeMoved, new NodeMoved(target.Id));
            }));

        api.MapDelete("/nodes/{id}", (string id, HttpRequest req, Catalog c) =>
            Command(req, c, (model, tree, write) =>
            {
                if (!tree.Nodes.ContainsKey(id)) return Results.NotFound();
                if (tree.Children(id).Any()) return Bad("Erst die Kinder entfernen.");
                return write(id, Types.NodeRetired, new NodeRetired());
            }));

        api.MapPost("/nodes/{id}/status", (string id, StatusSet body, HttpRequest req, Catalog c) =>
            Command(req, c, (model, tree, write) =>
            {
                if (!tree.Nodes.TryGetValue(id, out var n)) return Results.NotFound();
                if (n.Role == Roles.Group) return Bad("Eine Gruppe hat keinen Status.");
                if (!Statuses.All.Contains(body.Status ?? "")) return Bad($"Status: {string.Join(", ", Statuses.All)}");
                return write(id, Types.StatusSet, new StatusSet(body.Status!));
            }));

        // ---- Werte -----------------------------------------------------------

        api.MapPost("/nodes/{id}/attributes", (string id, AttributeSet body, HttpRequest req, Catalog c) =>
            Command(req, c, (model, tree, write) =>
            {
                if (!tree.Nodes.TryGetValue(id, out var n)) return Results.NotFound();
                if (string.IsNullOrWhiteSpace(body.Attribute)) return Bad("attribute fehlt.");
                if (!model.Attributes.TryGetValue(body.Attribute, out var def)) return Bad($"Unbekanntes Attribut: {body.Attribute}");
                if (!def.AllowedAt(n.Role)) return Bad($"{def.Key} gibt es nur an: {string.Join(", ", def.Levels!)}");
                var locale = Blank(body.Locale);
                var channel = Blank(body.Channel);
                if ((locale is not null && !def.PerLocale) || (channel is not null && !def.PerChannel)) return Bad($"{def.Key} hat diese Achse nicht.");
                if (locale is not null && !model.Locales.ContainsKey(locale)) return Bad($"Unbekannte Sprache: {locale}");
                if (channel is not null && !model.Channels.ContainsKey(channel)) return Bad($"Unbekannter Kanal: {channel}");
                if (channel is not null && def.Channels is { } only && !only.Contains(channel)) return Bad($"{def.Key} gibt es nur für: {string.Join(", ", only)}");
                var value = body.Value;
                var values = body.Values;
                if (CheckValue(model, def, ref value, ref values) is { } error) return Bad(error);
                // SKU: eindeutig über alle Varianten — die kleine synchrone Prüf-Projektion.
                if (def.Key == Model.SkuAttribute && value is not null && tree.BySku(value).Any(o => o.Id != n.Id))
                    return Bad($"SKU {value} gibt es schon.");
                return write(id, Types.AttributeSet, new AttributeSet(def.Key, locale, channel, value, values));
            }));

        api.MapPost("/nodes/{id}/categories", (string id, CategoryAssigned body, HttpRequest req, Catalog c) =>
            Command(req, c, (model, tree, write) =>
                !tree.Nodes.ContainsKey(id) ? Results.NotFound()
                : string.IsNullOrWhiteSpace(body.Category) ? Bad("category fehlt.")
                : write(id, Types.CategoryAssigned, body)));

        api.MapDelete("/nodes/{id}/categories/{category}", (string id, string category, HttpRequest req, Catalog c) =>
            Command(req, c, (model, tree, write) =>
                tree.Nodes.ContainsKey(id) ? write(id, Types.CategoryRemoved, new CategoryRemoved(category)) : Results.NotFound()));

        api.MapPost("/nodes/{id}/releases", (string id, ReleaseGranted body, HttpRequest req, Catalog c) =>
            Command(req, c, (model, tree, write) =>
            {
                if (!tree.Nodes.TryGetValue(id, out var n)) return Results.NotFound();
                if (n.Role != Roles.Variant) return Bad("Freigabe nur an der Variante — sie ist das Verkaufbare.");
                if (!model.Channels.ContainsKey(body.Channel ?? "")) return Bad("channel fehlt oder unbekannt.");
                var locale = Blank(body.Locale);
                if (locale is not null && !model.Locales.ContainsKey(locale)) return Bad($"Unbekannte Sprache: {locale}");
                return write(id, Types.ReleaseGranted, new ReleaseGranted(body.Channel!, locale));
            }));

        api.MapDelete("/nodes/{id}/releases", (string id, string channel, string? locale, HttpRequest req, Catalog c) =>
            Command(req, c, (model, tree, write) =>
                tree.Nodes.ContainsKey(id) ? write(id, Types.ReleaseRevoked, new ReleaseRevoked(channel, Blank(locale))) : Results.NotFound()));
    }

    private static bool IsRole(Tree tree, string? id, string role) =>
        id is not null && tree.Nodes.TryGetValue(id, out var n) && n.Role == role;

    private static IResult Command(HttpRequest req, Catalog c,
        Func<ModelCatalog, Tree, Func<string, string, object, IResult>, IResult> body)
    {
        if (Actor(req) is not { } actor) return ActorMissing();
        return c.With((model, tree, write) => body(model, tree, (stream, type, payload) => Results.Ok(EntryView.Of(write(actor, stream, type, payload)))));
    }
}

/// <summary>Eine Zeile im Baum: genug für die Anzeige, ohne Werte.</summary>
public sealed record NodeRow(string Id, string Role, string? Parent, string Label, string? Family, string[] Axes,
    Dictionary<string, string> AxisValues, string Status, string? Sku, int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor)
{
    public static NodeRow Of(Tree tree, Node n) => new(
        n.Id, n.Role, n.Parent, LabelOf(tree, n), n.Family, n.Axes, n.AxisValues, n.Status,
        n.Own(Model.SkuAttribute, null, null), n.Entries, n.LastNumber, n.LastAt, n.LastActor);

    /// <summary>Gruppe: ihr Label; Produkt: sein Name; Variante: SKU oder die Achsenwerte.</summary>
    public static string LabelOf(Tree tree, Node n) => n.Role switch
    {
        Roles.Group => n.Label.GetValueOrDefault("de") ?? n.Label.Values.FirstOrDefault() ?? n.Id,
        Roles.Product => tree.Resolve(n, "name", "de", null).Value ?? n.Id,
        _ => n.Own(Model.SkuAttribute, null, null)
             ?? (n.AxisValues.Count > 0 ? string.Join(" · ", n.AxisValues.Values) : n.Id),
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
    Dictionary<string, string> AxisValues, string Status, List<ValueView> Values, List<AncestorView> Ancestors,
    List<string> Categories, List<Release> Releases, int Children, int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor)
{
    public static NodeView Of(Tree tree, Node n) => new(
        n.Id, n.Role, n.Parent, n.Label, n.Family, n.Axes, n.AxisValues, n.Status,
        ValueView.Of(n).ToList(),
        tree.Ancestors(n).Select(a => new AncestorView(a.Id, a.Role, NodeRow.LabelOf(tree, a), ValueView.Of(a).ToList())).ToList(),
        n.Categories.Order().ToList(), n.Releases.ToList(), tree.Children(n.Id).Count(),
        n.Entries, n.LastNumber, n.LastAt, n.LastActor);
}
