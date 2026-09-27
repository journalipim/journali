using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Workflows (27): Definitionen (Einstellungen → Workflows), Zustand und erlaubte Übergänge je Knoten (Band
/// „Workflow“ in der Knotenansicht), ein Schritt gehen, Zuständigkeit, und „Meine Aufgaben“ — alle Knoten, deren nächster
/// Schritt meiner Rolle (oder mir) gehört. Der Verlauf steht im Journal des Knotens.
/// </summary>
public static class WorkflowApi
{
    public sealed record StepBody(string? Note);
    public sealed record IdsBody(string[]? Ids);
    public sealed record AssignBody(string? User);

    /// <summary>Der Job, den ein Übergang anstösst (34 I): am Übergang genannt und im Tasker vorhanden — sonst null.</summary>
    public static string? JobOf(WorkflowDef? wf, string transition, Func<string, bool> jobExists) =>
        wf?.Transitions.FirstOrDefault(t => t.Key == transition)?.Job is { Length: > 0 } job && jobExists(job) ? job : null;

    /// <summary>
    /// Nach einem gelungenen Schritt den Job des Übergangs starten. Läuft er schon, ist das kein Fehler — er findet den
    /// neuen Stand in seiner nächsten Runde. Ein Fehler beim Start hält den Schritt nicht auf: der steht im Journal.
    /// </summary>
    public static void Nachlauf(IResult r, Catalog c, JobRunner runner, HttpRequest req, string wf, string transition)
    {
        if (r is not Microsoft.AspNetCore.Http.HttpResults.Ok<EntryView>) return;
        var job = c.Lesen((_, _) => JobOf(c.Workflows.All.GetValueOrDefault(wf), transition, k => c.Jobs.All.TryGetValue(k, out var j) && j.Enabled));
        if (job is null) return;
        runner.Origin = $"{req.Scheme}://{req.Host}";
        runner.Start(job, "workflow", out _);
    }

    public static void Map(RouteGroupBuilder api, JobRunner runner)
    {
        api.MapGet("/workflows", (Catalog c) => c.Lesen((_, tree) => c.Workflows.All.Values.OrderBy(w => w.Key).Select(w => View(c, tree, w)).ToList()));
        api.MapPut("/workflows/{key}", (string key, WorkflowDefined body, HttpRequest req, Catalog c) =>
            !ValidKey(key) ? Bad("Key: a-z, 0-9, _.") : TreeApi.Run(req, c, x => Commands.DefineWorkflow(x, key, body)));
        api.MapDelete("/workflows/{key}", (string key, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.RetireWorkflow(x, key)));

        // Meine Aufgaben: Knoten, an denen meine Rolle (oder ich) jetzt einen Schritt gehen darf — nach Alter im Zustand
        api.MapGet("/workflows/tasks", (HttpRequest req, Catalog c, string? workflow = null, string? state = null, int limit = 500) => c.Lesen((model, tree) =>
        {
            var role = req.HttpContext.Items["role"] as string; var user = req.HttpContext.Items["user"] as string;
            // leere Parameter = alle
            if (string.IsNullOrWhiteSpace(workflow)) workflow = null; if (string.IsNullOrWhiteSpace(state)) state = null;
            var out_ = new List<(DateTimeOffset? Since, object Row)>();
            foreach (var wf in c.Workflows.All.Values.Where(w => workflow is null || w.Key == workflow))
            {
                foreach (var n in tree.Nodes.Values.Where(wf.AppliesTo))
                {
                    // je Sprache eine Aufgabe, wo es einen eigenen Sprachzustand gibt; sonst wie bisher eine je Knoten
                    var slots = wf.PerLocale ? c.Workflows.LocalesAt(n.Id, wf).OrderBy(l => l).Select(l => (string?)l).DefaultIfEmpty(null).ToList() : [null];
                    foreach (var loc in slots)
                    {
                        var (st, _) = c.Workflows.StateOf(n.Id, wf, x => tree.Nodes.GetValueOrDefault(x)?.Parent, loc);
                        if (state is not null && st != state) continue;
                        if (wf.State(st)?.Final == true && state is null) continue;
                        var nw = c.Workflows.Of(n.Id).GetValueOrDefault(Workflows.Slot(wf.Key, loc));
                        if (state is null && nw is null) continue;   // nie angefasst: keine Aufgabe (sonst wäre jeder Knoten eine)
                        var allowed = Commands.Allowed(c.Workflows, wf, n.Id, role, null, tree, loc).ToList();
                        if (allowed.Count == 0) continue;
                        if (nw?.Assigned is { } a && user is not null && a != user && state is null) continue;   // jemand anderem zugewiesen
                        out_.Add((nw?.At, new { node = n.Id, label = NodeRow.LabelOf(tree, model, n), n.Role, workflow = wf.Key, workflowLabel = wf.Label, locale = loc, state = st, stateLabel = wf.State(st)?.Label, color = wf.State(st)?.Color, since = nw?.At, actor = nw?.Actor, note = nw?.Note, assigned = nw?.Assigned, roles = wf.Transitions.Where(t => t.From == st).SelectMany(t => t.Roles ?? []).Distinct().ToList(), transitions = allowed.Select(t => new { t.Key, t.Label, t.NoteRequired, t.Effects }).ToList() }));
                        if (out_.Count >= limit) break;
                    }
                }
            }
            return Results.Ok(out_.OrderBy(o => o.Since ?? DateTimeOffset.MaxValue).Select(o => o.Row).ToList());
        }));

        // Am Knoten: je geltendem Workflow Zustand, Verlaufskopf, erlaubte Übergänge für meine Rolle
        api.MapGet("/nodes/{id}/workflow", (string id, HttpRequest req, Catalog c) => c.Lesen((model, tree) =>
        {
            if (!tree.Nodes.TryGetValue(id, out var n)) return Results.NotFound();
            var role = req.HttpContext.Items["role"] as string;
            var ctxRead = new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Workflows = c.Workflows, Write = (_, _, _) => throw new InvalidOperationException("nur lesen") };
            return Results.Ok(c.Workflows.All.Values.Where(w => w.AppliesTo(n)).OrderBy(w => w.Key).Select(wf =>
            {
                var (st, inheritedFrom) = c.Workflows.StateOf(id, wf, x => tree.Nodes.GetValueOrDefault(x)?.Parent); var nw = c.Workflows.Of(inheritedFrom ?? id).GetValueOrDefault(wf.Key);
                return new
                {
                    perLocale = wf.PerLocale,
                    // je Sprache ein eigener Zustand — ohne eigenen gilt der des Knotens
                    locales = !wf.PerLocale ? null : model.Locales.Keys.OrderBy(l => l == model.MasterLocale ? 0 : 1).ThenBy(l => l).Select(l =>
                    {
                        var (ls, lfrom) = c.Workflows.StateOf(id, wf, x => tree.Nodes.GetValueOrDefault(x)?.Parent, l);
                        var lnw = c.Workflows.Of(lfrom ?? id).GetValueOrDefault(Workflows.Slot(wf.Key, l)) ?? c.Workflows.Of(lfrom ?? id).GetValueOrDefault(wf.Key);
                        return (object)new
                        {
                            locale = l, master = l == model.MasterLocale, state = ls, stateLabel = wf.State(ls)?.Label, color = wf.State(ls)?.Color, final = wf.State(ls)?.Final ?? false,
                            own = c.Workflows.Own(id, wf, l) is not null, since = lnw?.At, actor = lnw?.Actor, note = lnw?.Note, assigned = lnw?.Assigned,
                            transitions = Commands.Allowed(c.Workflows, wf, id, role, null, tree, l).Select(t => new { t.Key, t.Label, t.To, t.NoteRequired, t.Effects, toLabel = wf.State(t.To)?.Label, blocked = Commands.Blocker(ctxRead, n, t) }).ToList(),
                        };
                    }).ToList(),
                    workflow = wf.Key, label = wf.Label, state = st, stateLabel = wf.State(st)?.Label, color = wf.State(st)?.Color, final = wf.State(st)?.Final ?? false,
                    since = nw?.At, actor = nw?.Actor, note = nw?.Note, transition = nw?.Transition, assigned = nw?.Assigned,
                    inheritedFrom = inheritedFrom is null ? null : new { id = inheritedFrom, label = NodeRow.LabelOf(tree, model, tree.Nodes[inheritedFrom]), role = tree.Nodes[inheritedFrom].Role },   // Zustand vom Vater (Variante folgt dem Produkt)
                    // Wirkungen des Schritts, der hierher führte, die (noch) nicht eingetreten sind — z. B. „Freigegeben“ ohne Freigabe für web
                    //
                    pending = Pending(c, tree, model, n, wf, nw?.Transition),
                    states = wf.States.Select(s => new { s.Key, s.Label, s.Color, s.Final }).ToList(),
                    transitions = Commands.Allowed(c.Workflows, wf, id, role, null, tree).Select(t => new { t.Key, t.Label, t.To, t.NoteRequired, t.Effects, toLabel = wf.State(t.To)?.Label, blocked = Commands.Blocker(ctxRead, n, t) }).ToList(),
                    // auch die, die ich nicht darf — zum Zeigen, wer dran ist; mit Eskalation: ab wann auch wer
                    all = wf.Transitions.Where(t => t.From == st).Select(t => new { t.Key, t.Label, t.To, t.Roles, t.EscalateAfterDays, t.EscalateRoles, escalatesAt = t.EscalateAfterDays is { } d && nw is not null ? nw.At.AddDays(d) : (DateTimeOffset?)null, escalated = t.EscalateAfterDays is { } d2 && nw is not null && (DateTimeOffset.UtcNow - nw.At).TotalDays >= d2 }).ToList(),
                };
            }).ToList());
        }));
        // Ausstehende Wirkung je Zustand: { effect, why, canFix } — canFix false, wenn eine Variante den Weg bewusst zurückging
        static List<object> Pending(Catalog c, Tree tree, ModelCatalog model, Node n, WorkflowDef wf, string? transition)
        {
            var t = wf.Transitions.FirstOrDefault(x => x.Key == transition); if (t?.Effects is null) return [];
            var sellables = n.Role == Roles.Variant ? [n] : tree.DescendantsDeepestFirst(n.Id).Where(v => v.Role == Roles.Variant).ToList();   // Produkt und Gruppe: alles Verkaufbare darunter
            var pending = new List<object>();
            foreach (var eff in t.Effects)
            {
                var i = eff.IndexOf(':'); if (i < 0) continue; var kind = eff[..i]; var arg = eff[(i + 1)..];
                var chs = arg == "*" ? model.Channels.Keys.ToList() : [arg];
                var done = kind switch
                {
                    "release" => sellables.Count > 0 && chs.All(ch => sellables.Any(v => v.Releases.Contains(new Release(ch, null)))),
                    "revoke" => chs.All(ch => sellables.All(v => !v.Releases.Contains(new Release(ch, null)))),
                    "status" => n.Status == arg,
                    _ => true,
                };
                if (done) continue;
                // Varianten mit eigenem Stand in diesem Workflow, der nicht der Zielzustand ist: die haben den Weg bewusst verlassen
                var back = n.Role != Roles.Variant && kind == "release"
                    ? sellables.Where(v => c.Workflows.Own(v.Id, wf) is { } o && o != t.To).Select(v => $"{NodeRow.LabelOf(tree, model, v)}: {wf.State(c.Workflows.StateOf(v.Id, wf))?.Label.GetValueOrDefault("de") ?? c.Workflows.StateOf(v.Id, wf)}").ToList()
                    : [];
                // Produkt/Gruppe mit Freigabe-Zustand, aber ohne freigegebene Variante: die Ausleitung lässt es weg — Tatsache zeigen, nicht den Zustand ändern
                pending.Add(new { effect = eff, canFix = back.Count == 0 && n.Role == Roles.Variant, why = back.Count > 0 ? string.Join(" · ", back) : null });
            }
            return pending;
        }
        // Für die Mehrfachauswahl: je Übergang, wie viele der Knoten ihn jetzt gehen können
        api.MapPost("/workflows/applicable", (IdsBody body, HttpRequest req, Catalog c) => c.Lesen((model, tree) =>
        {
            var role = req.HttpContext.Items["role"] as string;
            var ctxRead = new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Workflows = c.Workflows, Write = (_, _, _) => throw new InvalidOperationException("nur lesen") };
            var nodes = (body.Ids ?? []).Select(id => tree.Nodes.GetValueOrDefault(id)).OfType<Node>().ToList();
            var out_ = new List<object>();
            foreach (var wf in c.Workflows.All.Values.OrderBy(w => w.Key))
                foreach (var t in wf.Transitions)
                {
                    var can = nodes.Where(n => wf.AppliesTo(n) && Commands.Allowed(c.Workflows, wf, n.Id, role, null, tree).Any(x => x.Key == t.Key)).ToList();
                    if (can.Count == 0) continue;
                    var blocked = can.Count(n => Commands.Blocker(ctxRead, n, t) is not null);
                    out_.Add(new { workflow = wf.Key, workflowLabel = wf.Label, t.Key, t.Label, t.To, toLabel = wf.State(t.To)?.Label, t.NoteRequired, t.Effects, count = can.Count - blocked, blocked, of = nodes.Count });
                }
            return Results.Ok(out_);
        }));
        api.MapPost("/nodes/{id}/workflow/{wf}/{transition}", (string id, string wf, string transition, StepBody? body, HttpRequest req, Catalog c, string? locale = null) =>
        {
            var r = TreeApi.Run(req, c, x => Commands.WorkflowStep(x, id, wf, transition, body?.Note, locale));
            Nachlauf(r, c, runner, req, wf, transition);   // die Brücke: ein Übergang mit job startet ihn
            return r;
        });
        api.MapDelete("/nodes/{id}/workflow/{wf}", (string id, string wf, HttpRequest req, Catalog c, string? locale = null) => TreeApi.Run(req, c, x => Commands.ClearWorkflowState(x, id, wf, locale)));   // eigenen Zustand aufheben → erben
        api.MapPut("/nodes/{id}/workflow/{wf}/assign", (string id, string wf, AssignBody body, HttpRequest req, Catalog c) =>
            TreeApi.Run(req, c, x => Commands.AssignWorkflow(x, id, wf, body.User)));
    }

    private static object View(Catalog c, Tree tree, WorkflowDef w)
    {
        var counts = new Dictionary<string, int>();
        foreach (var n in tree.Nodes.Values.Where(w.AppliesTo)) { var s = c.Workflows.StateOf(n.Id, w, x => tree.Nodes.GetValueOrDefault(x)?.Parent).State; counts[s] = counts.GetValueOrDefault(s) + 1; }
        return new { w.Key, w.Label, w.Start, w.Roles, w.Families, w.PerLocale, states = w.States.Select(s => new { s.Key, s.Label, s.Color, s.Final, s.X, s.Y, count = counts.GetValueOrDefault(s.Key) }).ToList(), transitions = w.Transitions, w.LastNumber };
    }
}
