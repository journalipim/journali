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
                    @out = c.Relations.From(id).OrderBy(r => r.Type).ThenBy(r => r.LastNumber).Select(r => RelationView.Of(tree, model, c.Media, r, "out")).ToList(),
                    @in = c.Relations.To(id).OrderBy(r => r.Type).ThenBy(r => r.LastNumber).Select(r => RelationView.Of(tree, model, c.Media, r, "in")).ToList(),
                }
                : null) is { } v ? Results.Ok(v) : Results.NotFound());

        api.MapGet("/relations/{id}", (string id, Catalog c) =>
            c.With((model, tree, _) => c.Relations.All.TryGetValue(id, out var r) ? RelationView.Of(tree, model, c.Media, r, "out") : null) is { } v ? Results.Ok(v) : Results.NotFound());

        api.MapPost("/relations", (RelationCreated b, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.CreateRelation(x, b.Type, b.From, b.To)));
        api.MapDelete("/relations/{id}", (string id, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.RetireRelation(x, id)));
        api.MapPost("/relations/{id}/attributes", (string id, AttributeSet b, HttpRequest req, Catalog c) =>
            TreeApi.Run(req, c, x => Commands.SetRelationAttribute(x, id, b.Attribute, b.Locale, b.Channel, b.Value, b.Values)));
        api.MapPut("/relations/{id}/external/{system}", (string id, string system, ExternalLinked b, HttpRequest req, Catalog c) =>
            TreeApi.Run(req, c, x => Commands.LinkRelationExternal(x, id, system, b.Id)));
    }
}

/// <summary>Das andere Ende einer Relation: Knoten oder Medium (dann mit Typ und Bild-Flag) — oder verwaist, wenn es weg ist.</summary>
public sealed record RelationEnd(string Id, string? Role, string Label, bool Missing, string? Mime = null, bool IsImage = false, long Bytes = 0);

/// <summary>Eine Relation aus Sicht eines Knotens: Richtung, das andere Ende, die Werte.</summary>
public sealed record RelationView(string Id, string Type, string From, string To, string Dir, RelationEnd Other, List<ValueView> Values,
    Dictionary<string, string> External, int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor)
{
    public static RelationView Of(Tree tree, ModelCatalog model, Media media, Relation r, string dir)
    {
        var otherId = dir == "out" ? r.To : r.From;
        var other = tree.Nodes.TryGetValue(otherId, out var n)
            ? new RelationEnd(n.Id, n.Role, NodeRow.LabelOf(tree, model, n), false)
            : media.All.TryGetValue(otherId, out var m)
                ? new RelationEnd(m.Id, Roles.Media, m.Name, false, m.Mime, m.IsImage, m.Bytes)
                : new RelationEnd(otherId, null, otherId, true);
        return new(r.Id, r.Type, r.From, r.To, dir, other, ValueView.Of(r).ToList(), r.External, r.Entries, r.LastNumber, r.LastAt, r.LastActor);
    }
}
