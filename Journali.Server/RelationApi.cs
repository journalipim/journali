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
    /// <summary>
    /// Geerbte Medien: Medien-Relationen der Vorfahren mit inherit=true, der nächste Vorfahr zuerst.
    /// Je Relationstyp gilt die nächste Ebene, die etwas hat: hat der Knoten selbst ein Medium dieses Typs, erbt er keins;
    /// sonst zählt der nächste Vorfahr mit vererbten Medien dieses Typs — darunterliegende Vorfahren nicht mehr.
    /// </summary>
    /// <summary>
    /// Geerbte Medien: Medien-Zuordnungen der Vorfahren mit inherit=true, als Ableitung — je
    /// Medium. Ein geerbtes Medium lässt sich an keiner Ebene entfernen, nur stoppen: eine Zuordnung zum selben Medium mit
    /// stop=true am Knoten oder einem näheren Vorfahren nimmt es dort und darunter heraus. Eigene und geerbte bestehen
    /// nebeneinander; ein Medium, das der Knoten selbst zugeordnet hat, wird nicht noch einmal als geerbt gezeigt.
    /// </summary>
    private static List<object> Inherited(Tree tree, ModelCatalog model, Catalog c, string id, bool export = false, (string? Role, bool Admin) sicht = default)
    {
        if (!tree.Nodes.TryGetValue(id, out var node)) return new();
        var mediaTypes = model.RelationTypes.Values.Where(t => t.To is not null && t.To.Contains(Roles.Media)).Select(t => t.Key).ToHashSet();
        static bool Flag(Relation r, string key) => r.Values.TryGetValue(new Axis(key, null, null), out var v) && v == "true";
        var own = c.Relations.From(id).Where(r => mediaTypes.Contains(r.Type)).ToList();
        var blocked = own.Where(r => Flag(r, "stop")).Select(r => $"{r.Type}|{r.To}").ToHashSet();
        var seen = own.Select(r => $"{r.Type}|{r.To}").ToHashSet();
        var outList = new List<object>();
        foreach (var a in tree.Ancestors(node))
        {
            var here = c.Relations.From(a.Id).Where(r => mediaTypes.Contains(r.Type)).OrderBy(r => r.LastNumber).ToList();
            foreach (var r in here)
            {
                var key = $"{r.Type}|{r.To}";
                if (Flag(r, "stop")) { blocked.Add(key); continue; }
                if (!Flag(r, "inherit") || blocked.Contains(key) || !seen.Add(key)) continue;
                var view = RelationView.Of(tree, model, c.Media, r, "out", c.Workflows);
                if (export && !RelationView.Ausleitbar(view.Other)) continue;   // abgelaufen oder nicht freigegeben: nicht in die Ausleitung
                if (c.Media.All.TryGetValue(r.To, out var mm) && !c.Media.Visible(mm, sicht.Role, sicht.Admin)) continue;   // Ordner, den die Rolle nicht sieht
                outList.Add(new { relation = view, from = new { a.Id, Label = NodeRow.LabelOf(tree, model, a) } });
            }
        }
        return outList;
    }

    public static void Map(RouteGroupBuilder api)
    {
        // export=true: die Sicht der Ausleitung — ein Medium, das heute nicht gilt (Frist) oder nicht freigegeben ist
        // (Medien-Workflow), fehlt in out und inherited. Die Erzeuger (xport, rag, Datenblatt) fragen so; die Pflege sieht alles.
        api.MapGet("/nodes/{id}/relations", (string id, HttpRequest req, Catalog c, bool export = false) =>
            c.Lesen((model, tree) =>
            {
                if (!tree.Nodes.ContainsKey(id)) return null;
                var s = Auth.Sicht(req);
                // das andere Ende, das die Rolle nicht sieht (Knoten in einem gesperrten Teilbaum, Medium in einem gesperrten Ordner), fehlt
                bool Sichtbar(RelationView v) => v.Other.Role == Roles.Media ? !c.Media.All.TryGetValue(v.Other.Id, out var m) || c.Media.Visible(m, s.Role, s.Admin)
                    : !tree.Nodes.TryGetValue(v.Other.Id, out var n) || tree.Visible(n, s.Role, s.Admin);
                return new
                {
                    @out = c.Relations.From(id).OrderBy(r => r.Type).ThenBy(r => r.LastNumber).Select(r => RelationView.Of(tree, model, c.Media, r, "out", c.Workflows)).Where(v => Sichtbar(v) && (!export || RelationView.Ausleitbar(v.Other))).ToList(),
                    @in = c.Relations.To(id).OrderBy(r => r.Type).ThenBy(r => r.LastNumber).Select(r => RelationView.Of(tree, model, c.Media, r, "in", c.Workflows)).Where(Sichtbar).ToList(),
                    inherited = Inherited(tree, model, c, id, export, s),
                };
            }) is { } v ? Results.Ok(v) : Results.NotFound());

        api.MapGet("/relations/{id}", (string id, Catalog c) =>
            c.Lesen((model, tree) => c.Relations.All.TryGetValue(id, out var r) ? RelationView.Of(tree, model, c.Media, r, "out", c.Workflows) : null) is { } v ? Results.Ok(v) : Results.NotFound());

        api.MapPost("/relations", (RelationCreated b, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.CreateRelation(x, b.Type, b.From, b.To)));
        api.MapDelete("/relations/{id}", (string id, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.RetireRelation(x, id)));
        api.MapPost("/relations/{id}/attributes", (string id, AttributeSet b, HttpRequest req, Catalog c) =>
            TreeApi.Run(req, c, x => Commands.SetRelationAttribute(x, id, b.Attribute, b.Locale, b.Channel, b.Value, b.Values)));
        api.MapPut("/relations/{id}/external/{system}", (string id, string system, ExternalLinked b, HttpRequest req, Catalog c) =>
            TreeApi.Run(req, c, x => Commands.LinkRelationExternal(x, id, system, b.Id)));
    }
}

/// <summary>Das andere Ende einer Relation: Knoten oder Medium (dann mit Typ und Bild-Flag) — oder verwaist, wenn es weg ist.</summary>
public sealed record RelationEnd(string Id, string? Role, string Label, bool Missing, string? Mime = null, bool IsImage = false, long Bytes = 0, bool HasThumb = false, bool Valid = true, bool Released = true);

/// <summary>Eine Relation aus Sicht eines Knotens: Richtung, das andere Ende, die Werte.</summary>
public sealed record RelationView(string Id, string Type, string From, string To, string Dir, RelationEnd Other, List<ValueView> Values,
    Dictionary<string, string> External, int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor)
{
    /// <summary>Geht das andere Ende in die Ausleitung? Ein Knoten immer; ein Medium, wenn es heute gilt (Frist) und freigegeben ist (Medien-Workflow).</summary>
    public static bool Ausleitbar(RelationEnd e) => e.Role != Roles.Media || (e.Valid && e.Released);

    public static RelationView Of(Tree tree, ModelCatalog model, Media media, Relation r, string dir, Workflows? wfs = null)
    {
        var otherId = dir == "out" ? r.To : r.From;
        var other = tree.Nodes.TryGetValue(otherId, out var n)
            ? new RelationEnd(n.Id, n.Role, NodeRow.LabelOf(tree, model, n), false)
            : media.All.TryGetValue(otherId, out var m)
                ? new RelationEnd(m.Id, Roles.Media, m.Name, false, m.Mime, m.IsImage, m.Bytes, m.IsImage || m.Derived.ContainsKey(Media.ThumbPreset), m.GueltigAm(DateOnly.FromDateTime(DateTime.Now)),
                    wfs is null || MediaWorkflowApi.Freigegeben(wfs, m))
                : new RelationEnd(otherId, null, otherId, true);
        return new(r.Id, r.Type, r.From, r.To, dir, other, ValueView.Of(r).ToList(), r.External, r.Entries, r.LastNumber, r.LastAt, r.LastActor);
    }
}
