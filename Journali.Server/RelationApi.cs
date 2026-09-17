using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Relationen unter /api (docs/pflegestruktur.md, 18): je Knoten ausgehend und eingehend
/// lesen; anlegen, zurückziehen, Werte setzen, externe Kennung — jeder Befehl ein Eintrag,
/// die Prüfung in <see cref="Commands"/>.
/// </summary>
public static class RelationApi
{
    public static void Map(RouteGroupBuilder api)
    {
        api.MapGet("/nodes/{id}/relations", (string id, Catalog c) =>
            c.With((model, tree, _) => tree.Nodes.ContainsKey(id)
                ? new
                {
                    @out = c.Relations.From(id).OrderBy(r => r.Type).ThenBy(r => r.LastNumber).Select(r => RelationView.Of(tree, model, r, "out")).ToList(),
                    @in = c.Relations.To(id).OrderBy(r => r.Type).ThenBy(r => r.LastNumber).Select(r => RelationView.Of(tree, model, r, "in")).ToList(),
                }
                : null) is { } v ? Results.Ok(v) : Results.NotFound());

        api.MapGet("/relations/{id}", (string id, Catalog c) =>
            c.With((model, tree, _) => c.Relations.All.TryGetValue(id, out var r) ? RelationView.Of(tree, model, r, "out") : null) is { } v ? Results.Ok(v) : Results.NotFound());

        api.MapPost("/relations", (RelationCreated b, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.CreateRelation(x, b.Type, b.From, b.To)));
        api.MapDelete("/relations/{id}", (string id, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.RetireRelation(x, id)));
        api.MapPost("/relations/{id}/attributes", (string id, AttributeSet b, HttpRequest req, Catalog c) =>
            TreeApi.Run(req, c, x => Commands.SetRelationAttribute(x, id, b.Attribute, b.Locale, b.Channel, b.Value, b.Values)));
        api.MapPut("/relations/{id}/external/{system}", (string id, string system, ExternalLinked b, HttpRequest req, Catalog c) =>
            TreeApi.Run(req, c, x => Commands.LinkRelationExternal(x, id, system, b.Id)));
    }
}

/// <summary>Das andere Ende einer Relation, wie der Baum es zeigt — oder verwaist, wenn der Knoten weg ist.</summary>
public sealed record RelationEnd(string Id, string? Role, string Label, bool Missing);

/// <summary>Eine Relation aus Sicht eines Knotens: Richtung, das andere Ende, die Werte.</summary>
public sealed record RelationView(string Id, string Type, string From, string To, string Dir, RelationEnd Other, List<ValueView> Values,
    Dictionary<string, string> External, int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor)
{
    public static RelationView Of(Tree tree, ModelCatalog model, Relation r, string dir)
    {
        var otherId = dir == "out" ? r.To : r.From;
        var other = tree.Nodes.TryGetValue(otherId, out var n)
            ? new RelationEnd(n.Id, n.Role, NodeRow.LabelOf(tree, model, n), false)
            : new RelationEnd(otherId, null, otherId, true);
        return new(r.Id, r.Type, r.From, r.To, dir, other, ValueView.Of(r).ToList(), r.External, r.Entries, r.LastNumber, r.LastAt, r.LastActor);
    }
}
