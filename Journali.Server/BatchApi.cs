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
/// und in der Antwort — der Aufrufer sieht, wie weit er kam.
/// </summary>
public static class BatchApi
{
    public sealed record Command(string Op, string? Ref, JsonElement Args);
    public sealed record Request(List<Command> Commands, string? Batch);
    public sealed record Result(int Index, string? Ref, string Node, long Number, string Type);
    public sealed record Failure(int Index, string Op, string Message);
    public sealed record Response(string Batch, List<Result> Results, Failure? Error);

    public static void Map(RouteGroupBuilder api)
    {
        api.MapPost("/batch", (Request r, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (r.Commands is null || r.Commands.Count == 0) return Bad("commands fehlt.");
            if (r.Commands.Count > 10_000) return Bad("Höchstens 10 000 Befehle je Stapel.");
            var batch = Blank(r.Batch) ?? "b-" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();

            var response = c.With((model, tree, write) =>
            {
                var refs = new Dictionary<string, string>();
                var results = new List<Result>();
                var ctx = new Ctx { Model = model, Tree = tree, Write = (stream, type, payload) => write(actor, stream, type, payload, batch) };

                for (var i = 0; i < r.Commands.Count; i++)
                {
                    var cmd = r.Commands[i];
                    var a = new Args(cmd.Args, refs);
                    Outcome outcome;
                    try
                    {
                        outcome = cmd.Op switch
                        {
                            "group.create" => Commands.CreateGroup(ctx, a.Id("parent"), a.Labels("label")),
                            "group.rename" => Commands.RenameGroup(ctx, a.Node(), a.Labels("label")),
                            "product.create" => Commands.CreateProduct(ctx, a.Id("group"), a.Strings("axes")),
                            "groups.attach" => Commands.AttachGroups(ctx, a.Node(), a.Strings("groups")),
                            "variant.create" => Commands.CreateVariant(ctx, a.Id("product"), a.Map("axisValues")),
                            "node.move" => Commands.Move(ctx, a.Node(), a.Id("parent")),
                            "node.retire" => Commands.Retire(ctx, a.Node()),
                            "status.set" => Commands.SetStatus(ctx, a.Node(), a.Str("status")),
                            "attribute.set" => Commands.SetAttribute(ctx, a.Node(), a.Str("attribute"), a.Str("locale"), a.Str("channel"), a.Str("value"), a.Strings("values"), a.Id("row")),
                            "row.add" => Commands.AddRow(ctx, a.Node(), a.Str("attribute")),
                            "row.remove" => Commands.RemoveRow(ctx, a.Node(), a.Str("attribute"), a.Str("row")),
                            "row.order" => Commands.OrderRows(ctx, a.Node(), a.Str("attribute"), a.Strings("rows")),
                            "category.assign" => Commands.AssignCategory(ctx, a.Node(), a.Str("category")),
                            "category.remove" => Commands.RemoveCategory(ctx, a.Node(), a.Str("category") ?? ""),
                            "release.grant" => Commands.GrantRelease(ctx, a.Node(), a.Str("channel"), a.Str("locale")),
                            "release.revoke" => Commands.RevokeRelease(ctx, a.Node(), a.Str("channel") ?? "", a.Str("locale")),
                            "external.link" => Commands.LinkExternal(ctx, a.Node(), a.Str("system"), a.Str("id")),
                            "external.unlink" => Commands.UnlinkExternal(ctx, a.Node(), a.Str("system") ?? ""),
                            _ => Outcome.Bad($"Unbekannter Befehl: {cmd.Op}"),
                        };
                    }
                    catch (ArgumentException ex) { outcome = Outcome.Bad(ex.Message); }

                    if (outcome.Entry is not { } e)
                        return new Response(batch, results, new Failure(i, cmd.Op, outcome.NotFound ? "Knoten gibt es nicht." : outcome.Error!));

                    // Ein neuer Knoten oder eine neue Zeile bekommt den ref; bei Zeilen zeigt er auf die Zeilenkennung.
                    if (Blank(cmd.Ref) is { } key) refs[key] = e.Type == Types.RowAdded ? Types.Deserialize<RowAdded>(e.Payload).Row : e.Stream;
                    results.Add(new Result(i, cmd.Ref, e.Stream, e.Number, e.Type));
                }
                return new Response(batch, results, null);
            });

            return Results.Ok(response);
        });
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
