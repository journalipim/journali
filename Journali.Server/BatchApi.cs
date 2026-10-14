using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Der Stapelbefehl: viele Befehle, ein Aufruf, eine Sperre, eine Stapelkennung
/// (docs/pflegestruktur.md, 12) — der Schreibweg für Import und Massenpflege.
/// Befehle laufen der Reihe nach; ein neuer Knoten bekommt einen <c>ref</c>,
/// spätere Befehle verweisen mit <c>@ref</c> darauf. Beim ersten Fehler
/// hält der Stapel an; was davor geschrieben wurde, steht im Journal (append-only)
/// und in der Antwort — der Aufrufer sieht, wie weit er kam. Mit <c>?skipErrors=true</c>
/// (Importe mit der Regel „überspringen“) wird ein
/// fehlgeschlagener Befehl übersprungen und in <c>skipped</c> genannt, der Rest läuft —
/// jeder Befehl ist für sich ganz oder gar nicht, ein Fehler schreibt nichts.
/// </summary>
public static class BatchApi
{
    public sealed record Command(string Op, string? Ref, JsonElement Args);
    public sealed record Request(List<Command> Commands, string? Batch);
    public sealed record Result(int Index, string? Ref, string Node, long Number, string Type);
    public sealed record Failure(int Index, string Op, string Message, string? Template = null, string[]? Args = null);
    public sealed record Response(string Batch, List<Result> Results, Failure? Error, List<Failure>? Skipped = null);

    public static void Map(RouteGroupBuilder api)
    {
        api.MapPost("/batch", (Request r, HttpRequest req, Catalog c, bool skipErrors = false) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (r.Commands is null || r.Commands.Count == 0) return Bad("commands fehlt.");
            if (r.Commands.Count > 10_000) return Bad("Höchstens 10 000 Befehle je Stapel.");
            // Demo: keine Massenbearbeitung. Die Grenze steht in der Meldung (14.10.2026): „nicht verfügbar“ las sich, als ginge Übernehmen in der Demo
            // überhaupt nicht — dabei gehen bis zu MaxStapel Befehle (in der Prüfansicht zwei je Wert: Wert und Beleg)
            if (Demo.An && actor == Demo.Anwender && r.Commands.Count > Demo.MaxStapel) return Bad("In der Demo höchstens {0} Befehle je Stapel.", Demo.MaxStapel);
            if (Demo.An && actor == Demo.Anwender && Demo.StapelGesperrt(r.Commands.Select(x => x.Op ?? "").ToList())) return Bad("In der Demo nicht verfügbar.");
            var batch = Blank(r.Batch) ?? "b-" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();

            var response = c.WithBatch(actor, batch, (model, tree, write) =>
            {
                var refs = new Dictionary<string, string>();
                var results = new List<Result>(); var skipped = new List<Failure>();
                var ctx = new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Write = (stream, type, payload) => write(actor, stream, type, payload, batch) };

                for (var i = 0; i < r.Commands.Count; i++)
                {
                    var cmd = r.Commands[i];
                    var outcome = Ausfuehren(ctx, cmd.Op, cmd.Args, refs);

                    if (outcome.Entry is not { } e)
                    {
                        var f = outcome.NotFound ? new Failure(i, cmd.Op, "Knoten gibt es nicht.", "Knoten gibt es nicht.") : new Failure(i, cmd.Op, outcome.Error!, outcome.Template, outcome.Args);
                        if (!skipErrors) return new Response(batch, results, f);
                        skipped.Add(f); continue;   // überspringen — ein Befehl, der auf diesen ref zeigt, scheitert dann ebenfalls (und wird übersprungen)
                    }

                    // Ein neuer Knoten oder eine neue Zeile bekommt den ref; bei Zeilen zeigt er auf die Zeilenkennung.
                    if (Blank(cmd.Ref) is { } key) refs[key] = Verweis(e);
                    results.Add(new Result(i, cmd.Ref, e.Stream, e.Number, e.Type));
                }
                return new Response(batch, results, null, skipped.Count > 0 ? skipped : null);
            });

            return Results.Ok(response);
        });
    }

    /// <summary>Worauf ein <c>ref</c> zeigt: auf den Knoten, die Relation oder das Medium des Eintrags — bei einer neuen Zeile auf die Zeilenkennung.</summary>
    public static string Verweis(Entry e) => e.Type == Types.RowAdded ? Types.Deserialize<RowAdded>(e.Payload).Row : e.Stream;

    /// <summary>Ein Befehl des Stapels — auch für den Start der Demo (Demo.Tannwald), der dieselben Befehle ohne Anfrage schreibt.
    /// <paramref name="refs"/>: die Verweise dieses Stapels (<c>@ref</c>).</summary>
    public static Outcome Ausfuehren(Ctx ctx, string op, JsonElement args, Dictionary<string, string> refs)
    {
        var a = new Args(args, refs);
        try
        {
            return op switch
            {
                "group.create" => Commands.CreateGroup(ctx, a.Id("parent"), a.Labels("label"), a.Str("name")),
                "group.rename" => Commands.RenameGroup(ctx, a.Node(), a.Labels("label")),   // Altlast
                "node.rename" => Commands.Rename(ctx, a.Node(), a.Str("name")),
                "label.set" => Commands.SetLabelAttribute(ctx, a.Node(), a.Str("attribute")),
                "product.create" => Commands.CreateProduct(ctx, a.Id("group"), a.Strings("axes")),
                "axes.set" => Commands.SetAxes(ctx, a.Node(), a.Strings("axes")),
                "groups.attach" => Commands.AttachGroups(ctx, a.Node(), a.Strings("groups")),
                "variant.create" => Commands.CreateVariant(ctx, a.Id("product"), a.Map("axisValues")),
                "node.move" => Commands.Move(ctx, a.Node(), a.Id("parent")),
                "node.retire" => Commands.Retire(ctx, a.Node()),
                "node.order" => Commands.Order(ctx, a.Node(), a.Id("parent"), a.Id("before")),   // Tabellenbearbeitung: Zeilen verschieben
                "status.set" => Commands.SetStatus(ctx, a.Node(), a.Str("status"), a.Str("from")),
                "attribute.set" => Commands.SetAttribute(ctx, a.Node(), a.Str("attribute"), a.Str("locale"), a.Str("channel"), a.Str("value"), a.Strings("values"), a.Id("row"), a.Str("unit")),
                "value.source" => Commands.SourceValue(ctx, a.Node(), a.Str("attribute"), a.Str("locale"), a.Str("channel"), a.Id("row"), a.Str("source"), a.Str("title"), a.Str("note"), a.Str("method"), a.Str("checkedAt")),
                "row.add" => Commands.AddRow(ctx, a.Node(), a.Str("attribute")),
                "row.remove" => Commands.RemoveRow(ctx, a.Node(), a.Str("attribute"), a.Str("row")),
                "row.order" => Commands.OrderRows(ctx, a.Node(), a.Str("attribute"), a.Strings("rows")),
                "category.assign" => Commands.AssignCategory(ctx, a.Node(), a.Str("category")),
                "category.remove" => Commands.RemoveCategory(ctx, a.Node(), a.Str("category") ?? ""),
                "release.grant" => Commands.GrantRelease(ctx, a.Node(), a.Str("channel"), a.Str("locale")),
                "release.revoke" => Commands.RevokeRelease(ctx, a.Node(), a.Str("channel") ?? "", a.Str("locale")),
                "external.link" => Commands.LinkExternal(ctx, a.Node(), a.Str("system"), a.Str("id")),
                "external.unlink" => Commands.UnlinkExternal(ctx, a.Node(), a.Str("system") ?? ""),
                "relation.create" => Commands.CreateRelation(ctx, a.Str("type"), a.Id("from"), a.Id("to")),
                "relation.retire" => Commands.RetireRelation(ctx, a.Id("relation") ?? ""),
                "relation.attribute.set" => Commands.SetRelationAttribute(ctx, a.Id("relation") ?? "", a.Str("attribute"), a.Str("locale"), a.Str("channel"), a.Str("value"), a.Strings("values"), a.Str("unit")),
                "media.attribute.set" => Commands.SetMediumAttribute(ctx, a.Id("media") ?? "", a.Str("attribute"), a.Str("locale"), a.Str("channel"), a.Str("value"), a.Strings("values")),
                "media.external.link" => Commands.LinkMediumExternal(ctx, a.Id("media") ?? "", a.Str("system"), a.Str("id")),
                "media.retire" => Commands.RetireMedium(ctx, a.Id("media") ?? ""),
                "media.file" => Commands.FileMedium(ctx, a.Id("media") ?? "", a.Str("folder")),   // in einen Ordner (leer = ohne Ordner), 04.10.2026
                "rubric.place" => Commands.Place(ctx, a.Id("rubric") ?? "", a.Node()),           // in eine Rubrik hängen, 04.10.2026
                "relation.external.link" => Commands.LinkRelationExternal(ctx, a.Id("relation") ?? "", a.Str("system"), a.Str("id")),
                _ => Outcome.Bad("Unbekannter Befehl: {0}", op),
            };
        }
        catch (ArgumentException ex) { return Outcome.Bad(ex.Message); }
    }

    /// <summary>Argumente eines Befehls: Felder aus dem JSON, <c>@ref</c> aufgelöst.</summary>
    private sealed class Args(JsonElement json, Dictionary<string, string> refs)
    {
        private JsonElement? Get(string name) =>
            json.ValueKind == JsonValueKind.Object && json.TryGetProperty(name, out var v) && v.ValueKind is not JsonValueKind.Null ? v : null;

        public string? Str(string name) => Get(name) is { } v ? (v.ValueKind == JsonValueKind.String ? v.GetString() : v.GetRawText()) : null;

        /// <summary>Eine Knoten-Id — oder <c>@ref</c> auf einen Knoten aus diesem Stapel.</summary>
        public string? Id(string name)
        {
            var s = Str(name);
            if (s is null || !s.StartsWith('@')) return s;
            return refs.TryGetValue(s[1..], out var id) ? id : throw new ArgumentException($"Unbekannter Verweis {s}.");
        }

        public string Node() => Id("node") ?? throw new ArgumentException("node fehlt.");

        public string[]? Strings(string name) =>
            Get(name) is { ValueKind: JsonValueKind.Array } v ? v.EnumerateArray().Select(x => x.GetString() ?? "").ToArray() : null;

        public Dictionary<string, string>? Map(string name) =>
            Get(name) is { ValueKind: JsonValueKind.Object } v
                ? v.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.ValueKind == JsonValueKind.String ? p.Value.GetString() ?? "" : p.Value.GetRawText())
                : null;

        public Labels? Labels(string name) => Map(name) is { } m ? new Labels(m) : null;
    }
}
