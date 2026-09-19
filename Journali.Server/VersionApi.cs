using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Versionen (Taloan, 19.09.2026): eine Freigabe ist eine Version — Zeiger auf den Journalstand plus eingefrorene Belege,
/// die nach draussen gingen (das zählt in der Haftungsfrage). Belege liefern Erzeuger-Plugins (Manifest <c>renderer</c>:
/// ein Prozess-Dienst, der das Dokument rendert, per POST /api/media hochlädt und hier anhängt). „Stand bei Version n“
/// ist eine reine Lesesicht (Journal bis dahin abgespielt); Zurückrollen schreibt vorwärts — eigene Werte des Knotens
/// als Stapel, mit Plan vorab, nie durch Löschen.
/// </summary>
public static class VersionApi
{
    public sealed record CreateBody(string? Channel, string? Locale, string? Note, int? RetentionYears, bool? Render);
    public sealed record DocumentBody(string? Kind, string? MediaId, string? Renderer);
    public sealed record WithdrawBody(string? Reason);
    public sealed record RollbackBody(bool? DryRun, string[]? Skip);
    /// <summary>Eine Zeile des Vergleichs: eigener Wert damals und heute.</summary>
    public sealed record DiffRow(string Kind, string? Attribute, string? Locale, string? Channel, string? Row, string? Then, string? Now, bool Same, bool Known, bool Active, string? Note, string[]? ThenList = null);

    public static void Map(RouteGroupBuilder api, string pluginDir, ILogger log)
    {
        api.MapGet("/nodes/{id}/versions", (string id, Catalog c) =>
            c.With((_, tree, _) => tree.Nodes.ContainsKey(id) ? Results.Ok(c.Versions.Of(id).Select(View).ToList()) : Results.NotFound()));

        // Version erzeugen: Vollständigkeit wie bei der Freigabe (wenn Kanal genannt), dann VersionCreated mit dem Stand jetzt;
        // danach die Erzeuger — jeder rendert seinen Beleg und hängt ihn an (asynchron; die Liste zeigt, was schon da ist).
        api.MapPost("/nodes/{id}/versions", (string id, CreateBody body, HttpRequest req, Catalog c, IHostApplicationLifetime life) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var origin = $"{req.Scheme}://{req.Host}";
            var result = c.With<(IResult Result, int Nr)>((model, tree, write) =>
            {
                if (!tree.Nodes.TryGetValue(id, out var n)) return (Results.NotFound(), 0);
                var channel = Blank(body.Channel); var locale = Blank(body.Locale);
                if (channel is not null)
                {
                    if (!model.Channels.ContainsKey(channel)) return (Bad($"Unbekannter Kanal: {channel}"), 0);
                    if (locale is not null && !model.Locales.ContainsKey(locale)) return (Bad($"Unbekannte Sprache: {locale}"), 0);
                    if (n.Role != Roles.Group)
                    {
                        var (_, missing) = CompletenessRules.Check(tree, model, n, CompletenessRules.ActiveAttributes(tree, model, n).ToList(), channel, locale);
                        if (missing.Length > 0) return (Results.BadRequest(new { error = $"Unvollständig für {channel}/{locale ?? "*"}: {string.Join(", ", missing)}", missing }), 0);
                    }
                }
                var nr = c.Versions.NextNr(id);
                write(actor, id, Types.VersionCreated, new VersionCreated(nr, tree.LastApplied, channel, locale, Blank(body.Note), body.RetentionYears is > 0 and <= 100 ? body.RetentionYears.Value : 10), null);
                return (Results.Ok(View(c.Versions.Get(id, nr)!)), nr);
            });
            if (result.Nr > 0 && body.Render != false)
                _ = Task.Run(() => RenderAsync(c, pluginDir, id, result.Nr, actor, origin, log, life.ApplicationStopping));
            return result.Result;
        });

        // Belege nochmal erzeugen (Erzeuger nachinstalliert, Lauf fehlgeschlagen)
        api.MapPost("/nodes/{id}/versions/{nr:int}/render", (string id, int nr, HttpRequest req, Catalog c, IHostApplicationLifetime life) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (c.With((_, _, _) => c.Versions.Get(id, nr)) is null) return Results.NotFound();
            var origin = $"{req.Scheme}://{req.Host}";
            _ = Task.Run(() => RenderAsync(c, pluginDir, id, nr, actor, origin, log, life.ApplicationStopping));
            return Results.Ok(new { started = Renderers(pluginDir, c).Select(r => r.Key).ToList() });
        });

        // Beleg anhängen — ruft der Erzeuger nach dem Hochladen (POST /api/media → Medium)
        api.MapPost("/nodes/{id}/versions/{nr:int}/documents", (string id, int nr, DocumentBody body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (Blank(body.Kind) is not { } kind || Blank(body.MediaId) is not { } mediaId) return Bad("kind und mediaId sind Pflicht.");
            return c.With((_, _, write) =>
            {
                if (c.Versions.Get(id, nr) is null) return Results.NotFound();
                if (!c.Media.All.TryGetValue(mediaId, out var m)) return Bad($"Medium {mediaId} unbekannt.");
                write(actor, id, Types.VersionDocumentAdded, new VersionDocumentAdded(nr, kind, m.Id, m.Sha256, m.Mime, m.Name, m.Bytes, Blank(body.Renderer)), null);
                return Results.Ok(View(c.Versions.Get(id, nr)!));
            });
        });

        api.MapPost("/nodes/{id}/versions/{nr:int}/withdraw", (string id, int nr, WithdrawBody body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            return c.With((_, _, write) =>
            {
                if (c.Versions.Get(id, nr) is not { } v) return Results.NotFound();
                if (v.Withdrawn) return Results.Ok(View(v));
                write(actor, id, Types.VersionWithdrawn, new VersionWithdrawn(nr, Blank(body.Reason)), null);
                return Results.Ok(View(c.Versions.Get(id, nr)!));
            });
        });

        // Stand bei Version n gegen heute: Name, Status, eigene Werte (Achse für Achse)
        api.MapGet("/nodes/{id}/versions/{nr:int}/diff", (string id, int nr, Catalog c) =>
        {
            var v = c.With((_, _, _) => c.Versions.Get(id, nr));
            if (v is null) return Results.NotFound();
            var rows = Diff(c, id, v.JournalNumber);
            return rows is null ? Results.NotFound(new { error = "Knoten gab es bei diesem Stand nicht." }) : Results.Ok(new { version = View(v), rows, changed = rows.Count(r => !r.Same) });
        });

        // Zurückrollen: Plan (dryRun) oder Stapel — eigene Werte, Name, Status; unbekannte oder hier nicht geltende Attribute werden übersprungen
        api.MapPost("/nodes/{id}/versions/{nr:int}/rollback", (string id, int nr, RollbackBody body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var v = c.With((_, _, _) => c.Versions.Get(id, nr));
            if (v is null) return Results.NotFound();
            var rows = Diff(c, id, v.JournalNumber);
            if (rows is null) return Results.NotFound(new { error = "Knoten gab es bei diesem Stand nicht." });
            var skip = new HashSet<string>(body.Skip ?? Array.Empty<string>());
            var todo = rows.Where(r => r.Kind != "label" && !r.Same && r.Known && r.Active && r.Row is null && !skip.Contains(Key(r))).ToList();   // label ist abgeleitet
            var skipped = rows.Where(r => r.Kind != "label" && !r.Same && !(r.Known && r.Active && r.Row is null)).ToList();
            if (body.DryRun != false) return Results.Ok(new { plan = todo, skipped, batch = (string?)null });
            var batch = $"rollback-{id}-{nr}-{Guid.NewGuid():n}";
            var errors = new List<string>(); var done = 0;
            c.With((model, tree, write) =>
            {
                var ctx = new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Write = (stream, type, payload) => write(actor, stream, type, payload, batch) };
                foreach (var r in todo)
                {
                    var o = r.Kind switch
                    {
                        "name" => Commands.Rename(ctx, id, r.Then),
                        "status" => Commands.SetStatus(ctx, id, r.Then),
                        _ => Commands.SetAttribute(ctx, id, r.Attribute, r.Locale, r.Channel, r.ThenList is null ? r.Then : null, r.ThenList),
                    };
                    if (o.Error is not null) errors.Add($"{Key(r)}: {o.Error}"); else if (o.Entry is not null) done++;
                }
                return 0;
            });
            return Results.Ok(new { plan = todo, skipped, batch, done, errors });
        });
    }

    private static string Key(DiffRow r) => r.Kind == "value" ? $"{r.Attribute}|{r.Locale}|{r.Channel}|{r.Row}" : r.Kind;

    /// <summary>Eigene Werte damals (Journal bis #n) gegen heute — nur dieser Knoten, geerbt bleibt aussen vor (Taloan: nicht die Welt von damals).</summary>
    public static List<DiffRow>? Diff(Catalog c, string id, long number)
    {
        var (thenModel, thenTree) = c.AsOf(number);
        if (!thenTree.Nodes.TryGetValue(id, out var then)) return null;
        return c.With((model, tree, _) =>
        {
            if (!tree.Nodes.TryGetValue(id, out var now)) return null;
            var rows = new List<DiffRow>();
            var thenLabel = NodeRow.LabelOf(thenTree, thenModel, then); var nowLabel = NodeRow.LabelOf(tree, model, now);
            rows.Add(new DiffRow("label", null, null, null, null, thenLabel, nowLabel, thenLabel == nowLabel, true, true, "Anzeigename (aus Sternchen oder eigenem Namen)"));
            rows.Add(new DiffRow("name", null, null, null, null, then.Name, now.Name, then.Name == now.Name, true, true, null));
            if (now.Role != Roles.Group) rows.Add(new DiffRow("status", null, null, null, null, then.Status, now.Status, then.Status == now.Status, true, true, null));
            var active = CompletenessRules.ActiveAttributes(tree, model, now).Select(a => a.Key).ToHashSet();
            var axes = then.Values.Keys.Concat(then.Lists.Keys).Concat(now.Values.Keys).Concat(now.Lists.Keys).Distinct().OrderBy(a => a.Attribute).ThenBy(a => a.Locale).ThenBy(a => a.Channel);
            foreach (var a in axes)
            {
                string[]? thenList = then.Lists.TryGetValue(a, out var xl) ? xl : null;
                var tv = then.Values.TryGetValue(a, out var x) ? x : thenList is not null ? string.Join(", ", thenList) : null;
                var nv = now.Values.TryGetValue(a, out var y) ? y : now.Lists.TryGetValue(a, out var yl) ? string.Join(", ", yl) : null;
                var known = model.Attributes.ContainsKey(a.Attribute);
                var note = !known ? "Attribut gibt es heute nicht mehr" : !active.Contains(a.Attribute) ? "gilt an diesem Knoten heute nicht" : a.Row is not null ? "Zeile eines vermehrbaren Attributs — von Hand" : null;
                rows.Add(new DiffRow("value", a.Attribute, a.Locale, a.Channel, a.Row, tv, nv, tv == nv, known, active.Contains(a.Attribute), note, thenList));
            }
            return rows;
        });
    }

    /// <summary>Erzeuger: Plugins mit <c>renderer: { kind, service }</c> im Manifest, installiert und an.</summary>
    private static List<(string Key, string Kind, JsonElement Proc)> Renderers(string pluginDir, Catalog c)
    {
        var manifests = PluginApi.Scan(pluginDir);
        var on = c.With((_, _, _) => c.Plugins.All.Values.Where(p => p.Enabled).Select(p => p.Key).ToHashSet());
        var list = new List<(string, string, JsonElement)>();
        foreach (var m in manifests.Values)
        {
            if (!on.Contains(m.Key) || !m.Raw.TryGetProperty("renderer", out var r) || r.ValueKind != JsonValueKind.Object) continue;
            var kind = r.TryGetProperty("kind", out var k) ? k.GetString() ?? "document" : "document";
            var service = r.TryGetProperty("service", out var s) ? s.GetString() : null;
            if (PluginApi.ProcessOf(m.Raw, service) is { } proc) list.Add((m.Key, kind, proc));
        }
        return list;
    }

    private static async Task RenderAsync(Catalog c, string pluginDir, string id, int nr, string actor, string origin, ILogger log, CancellationToken ct)
    {
        foreach (var (key, kind, proc) in Renderers(pluginDir, c))
        {
            try
            {
                var token = Auth.IssueServiceToken(actor);
                var values = new Dictionary<string, string> { ["journali"] = origin, ["actor"] = actor, ["node"] = id, ["version"] = nr.ToString(), ["kind"] = kind, ["token"] = token };
                int exit; string output;
                try { (exit, output) = await PluginApi.RunProcessAsync(pluginDir, key, proc, values, TimeSpan.FromMinutes(30), ct); } finally { Auth.RevokeServiceToken(token); }
                if (exit != 0) log.LogWarning("Erzeuger {Plugin} für {Node} Version {Nr}: Rückgabe {Exit} — {Output}", key, id, nr, exit, output.Length > 500 ? output[^500..] : output);
                else log.LogInformation("Erzeuger {Plugin}: {Node} Version {Nr} — {Kind}", key, id, nr, kind);
            }
            catch (Exception e) { log.LogWarning("Erzeuger {Plugin} für {Node} Version {Nr}: {Error}", key, id, nr, e.Message); }
        }
    }

    private static object View(VersionState v) => new
    {
        v.Node, v.Nr, v.JournalNumber, v.Channel, v.Locale, v.Note, v.RetentionYears, v.At, v.Actor, v.Withdrawn, v.WithdrawnReason,
        retainUntil = v.At.AddYears(v.RetentionYears),
        documents = v.Documents.Select(d => new { d.Kind, d.MediaId, d.Sha256, d.Mime, d.Name, d.Bytes, d.Renderer, d.At, d.Actor, url = $"/api/media/{d.MediaId}/file" }).ToList(),
    };
}
