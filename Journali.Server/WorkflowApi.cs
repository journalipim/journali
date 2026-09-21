using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Workflows (27, Taloan 21.09.2026): Definitionen (Einstellungen → Workflows), Zustand und erlaubte Übergänge je Knoten (Band
/// „Workflow“ in der Knotenansicht), ein Schritt gehen, Zuständigkeit, und „Meine Aufgaben“ — alle Knoten, deren nächster
/// Schritt meiner Rolle (oder mir) gehört. Der Verlauf steht im Journal des Knotens.
/// </summary>
public static class WorkflowApi
{
    public sealed record StepBody(string? Note);
    public sealed record AssignBody(string? User);

    public static void Map(RouteGroupBuilder api)
    {
        api.MapGet("/workflows", (Catalog c) => c.With((_, tree, _) => c.Workflows.All.Values.OrderBy(w => w.Key).Select(w => View(c, tree, w)).ToList()));
        api.MapPut("/workflows/{key}", (string key, WorkflowDefined body, HttpRequest req, Catalog c) =>
            !ValidKey(key) ? Bad("Key: a-z, 0-9, _.") : TreeApi.Run(req, c, x => Commands.DefineWorkflow(x, key, body)));
        api.MapDelete("/workflows/{key}", (string key, HttpRequest req, Catalog c) => TreeApi.Run(req, c, x => Commands.RetireWorkflow(x, key)));

        // Meine Aufgaben: Knoten, an denen meine Rolle (oder ich) jetzt einen Schritt gehen darf — nach Alter im Zustand
        api.MapGet("/workflows/tasks", (HttpRequest req, Catalog c, string? workflow = null, string? state = null, int limit = 500) => c.With((model, tree, _) =>
        {
            var role = req.HttpContext.Items["role"] as string; var user = req.HttpContext.Items["user"] as string;
            // leere Parameter = alle (Taloan, 21.09.: „Korrektur dem admin zugewiesen — aber der hat nichts zu tun“: die Oberfläche schickt workflow= und state= leer)
            if (string.IsNullOrWhiteSpace(workflow)) workflow = null; if (string.IsNullOrWhiteSpace(state)) state = null;
            var out_ = new List<(DateTimeOffset? Since, object Row)>();
            foreach (var wf in c.Workflows.All.Values.Where(w => workflow is null || w.Key == workflow))
            {
                foreach (var n in tree.Nodes.Values.Where(wf.AppliesTo))
                {
                    var st = c.Workflows.StateOf(n.Id, wf);
                    if (state is not null && st != state) continue;
                    if (wf.State(st)?.Final == true && state is null) continue;
                    var nw = c.Workflows.Of(n.Id).GetValueOrDefault(wf.Key);
                    if (state is null && nw is null) continue;   // nie angefasst: keine Aufgabe (sonst wäre jeder Knoten eine)
                    var allowed = Commands.Allowed(c.Workflows, wf, n.Id, role).ToList();
                    if (allowed.Count == 0) continue;
                    if (nw?.Assigned is { } a && user is not null && a != user && state is null) continue;   // jemand anderem zugewiesen
                    out_.Add((nw?.At, new { node = n.Id, label = NodeRow.LabelOf(tree, model, n), n.Role, workflow = wf.Key, workflowLabel = wf.Label, state = st, stateLabel = wf.State(st)?.Label, color = wf.State(st)?.Color, since = nw?.At, actor = nw?.Actor, note = nw?.Note, assigned = nw?.Assigned, transitions = allowed.Select(t => new { t.Key, t.Label, t.NoteRequired, t.Effects }).ToList() }));
                    if (out_.Count >= limit) break;
                }
            }
            return Results.Ok(out_.OrderBy(o => o.Since ?? DateTimeOffset.MaxValue).Select(o => o.Row).ToList());
        }));

        // Am Knoten: je geltendem Workflow Zustand, Verlaufskopf, erlaubte Übergänge für meine Rolle
        api.MapGet("/nodes/{id}/workflow", (string id, HttpRequest req, Catalog c) => c.With((model, tree, _) =>
        {
            if (!tree.Nodes.TryGetValue(id, out var n)) return Results.NotFound();
            var role = req.HttpContext.Items["role"] as string;
            return Results.Ok(c.Workflows.All.Values.Where(w => w.AppliesTo(n)).OrderBy(w => w.Key).Select(wf =>
            {
                var st = c.Workflows.StateOf(id, wf); var nw = c.Workflows.Of(id).GetValueOrDefault(wf.Key);
                return new
                {
                    workflow = wf.Key, label = wf.Label, state = st, stateLabel = wf.State(st)?.Label, color = wf.State(st)?.Color, final = wf.State(st)?.Final ?? false,
                    since = nw?.At, actor = nw?.Actor, note = nw?.Note, transition = nw?.Transition, assigned = nw?.Assigned,
                    // Wirkungen des Schritts, der hierher führte, die (noch) nicht eingetreten sind — z. B. „Freigegeben“ ohne Freigabe für web
                    // (Taloan, 21.09.: „wieso steht das immer noch in der Liste?“ — der Schritt lief, als die Saat noch keine Wirkung hatte)
                    pending = Pending(c, tree, model, n, wf, nw?.Transition),
                    states = wf.States.Select(s => new { s.Key, s.Label, s.Color, s.Final }).ToList(),
                    transitions = Commands.Allowed(c.Workflows, wf, id, role).Select(t => new { t.Key, t.Label, t.To, t.NoteRequired, t.Effects, toLabel = wf.State(t.To)?.Label }).ToList(),
                    // auch die, die ich nicht darf — zum Zeigen, wer dran ist; mit Eskalation: ab wann auch wer
                    all = wf.Transitions.Where(t => t.From == st).Select(t => new { t.Key, t.Label, t.To, t.Roles, t.EscalateAfterDays, t.EscalateRoles, escalatesAt = t.EscalateAfterDays is { } d && nw is not null ? nw.At.AddDays(d) : (DateTimeOffset?)null, escalated = t.EscalateAfterDays is { } d2 && nw is not null && (DateTimeOffset.UtcNow - nw.At).TotalDays >= d2 }).ToList(),
                };
            }).ToList());
        }));
        // Ausstehende Wirkung je Zustand: { effect, why, canFix } — canFix false, wenn eine Variante den Weg bewusst zurückging (Taloan, 21.09.:
        // Variante „wieder geöffnet“ → das Produkt darf die Freigabe nicht einfach nachholen, das würde die Variante wieder freigeben)
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
                    ? sellables.Where(v => c.Workflows.Of(v.Id).ContainsKey(wf.Key) && c.Workflows.StateOf(v.Id, wf) != t.To).Select(v => $"{NodeRow.LabelOf(tree, model, v)}: {wf.State(c.Workflows.StateOf(v.Id, wf))?.Label.GetValueOrDefault("de") ?? c.Workflows.StateOf(v.Id, wf)}").ToList()
                    : [];
                // Produkt/Gruppe mit Freigabe-Zustand, aber ohne freigegebene Variante: die Ausleitung lässt es weg — Tatsache zeigen, nicht den Zustand ändern (Taloan, 21.09.)
                pending.Add(new { effect = eff, canFix = back.Count == 0 && n.Role == Roles.Variant, why = back.Count > 0 ? string.Join(" · ", back) : null });
            }
            return pending;
        }
        api.MapPost("/nodes/{id}/workflow/{wf}/{transition}", (string id, string wf, string transition, StepBody? body, HttpRequest req, Catalog c) =>
            TreeApi.Run(req, c, x => Commands.WorkflowStep(x, id, wf, transition, body?.Note)));
        api.MapPut("/nodes/{id}/workflow/{wf}/assign", (string id, string wf, AssignBody body, HttpRequest req, Catalog c) =>
            TreeApi.Run(req, c, x => Commands.AssignWorkflow(x, id, wf, body.User)));
    }

    private static object View(Catalog c, Tree tree, WorkflowDef w)
    {
        var counts = new Dictionary<string, int>();
        foreach (var n in tree.Nodes.Values.Where(w.AppliesTo)) { var s = c.Workflows.StateOf(n.Id, w); counts[s] = counts.GetValueOrDefault(s) + 1; }
        return new { w.Key, w.Label, w.Start, w.Roles, w.Families, states = w.States.Select(s => new { s.Key, s.Label, s.Color, s.Final, s.X, s.Y, count = counts.GetValueOrDefault(s.Key) }).ToList(), transitions = w.Transitions, w.LastNumber };
    }
}
