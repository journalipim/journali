using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Workflows an Assets (27.09.2026): derselbe Workflow wie am Knoten, wenn seine Rollen <c>media</c> nennen. Der Zustand
/// steht am Medienstrom (<c>WorkflowStateSet</c>), ohne Vererbung — ein Medium hat keinen Vater. Freigabe eines Bildes,
/// Korrekturschleife, Zuständiger: alles wie am Produkt, mit demselben Vokabular. Wirkungen eines Schritts gelten am
/// Medium nicht (<see cref="Commands.WorkflowStepMedium"/>).
/// </summary>
public static class MediaWorkflowApi
{
    /// <summary>Ein Zustand am Asset — für die Liste und die Facetten.</summary>
    public sealed record MediaState(string Workflow, Labels Label, string State, Labels? StateLabel, string? Color, bool Final);

    /// <summary>Die Zustände eines Mediums in allen Workflows, die für Assets gelten (Start, wenn nie ein Schritt ging).</summary>
    public static List<MediaState> States(Catalog c, Medium m) => c.Workflows.All.Values.Where(w => w.AppliesToMedium()).OrderBy(w => w.Key)
        .Select(wf => { var st = c.Workflows.StateOf(m.Id, wf); return new MediaState(wf.Key, wf.Label, st, wf.State(st)?.Label, wf.State(st)?.Color, wf.State(st)?.Final ?? false); }).ToList();

    /// <summary>
    /// Freigegeben ist ein Medium, wenn jeder Workflow, der für Assets gilt, an ihm in einem Endzustand steht (27.09.2026).
    /// Ohne Medien-Workflow ist alles freigegeben; sobald einer gilt, ist der Startzustand nicht frei — genau das will,
    /// wer einen Freigabe-Workflow für Bilder einschaltet. Die Ausleitung fragt hier (<c>RelationEnd.Released</c>).
    /// </summary>
    public static bool Freigegeben(Workflows wfs, Medium m) =>
        wfs.All.Values.Where(w => w.AppliesToMedium()).All(w => w.State(wfs.StateOf(m.Id, w))?.Final ?? false);

    public static void Map(RouteGroupBuilder api, JobRunner runner)
    {
        // Was am Asset gilt: je Workflow der Zustand, die Schritte, die meine Rolle gehen darf, und wer sonst dran ist
        api.MapGet("/media/{id}/workflow", (string id, HttpRequest req, Catalog c) => c.With((model, _, _) =>
        {
            if (!c.Media.All.TryGetValue(id, out var m)) return Results.NotFound();
            var role = req.HttpContext.Items["role"] as string;
            return Results.Ok(c.Workflows.All.Values.Where(w => w.AppliesToMedium()).OrderBy(w => w.Key).Select(wf =>
            {
                var st = c.Workflows.StateOf(m.Id, wf); var nw = c.Workflows.Of(m.Id).GetValueOrDefault(wf.Key);
                return new
                {
                    workflow = wf.Key, label = wf.Label, state = st, stateLabel = wf.State(st)?.Label, color = wf.State(st)?.Color, final = wf.State(st)?.Final ?? false,
                    since = nw?.At, actor = nw?.Actor, note = nw?.Note, transition = nw?.Transition, assigned = nw?.Assigned,
                    states = wf.States.Select(s => new { s.Key, s.Label, s.Color, s.Final }).ToList(),
                    // Wirkungen stehen dabei, damit die Oberfläche sagen kann: am Asset ohne Wirkung
                    transitions = Commands.Allowed(c.Workflows, wf, m.Id, role).Select(t => new { t.Key, t.Label, t.To, t.NoteRequired, t.Effects, toLabel = wf.State(t.To)?.Label }).ToList(),
                    all = wf.Transitions.Where(t => t.From == st).Select(t => new { t.Key, t.Label, t.To, t.Roles }).ToList(),
                };
            }).ToList());
        }));
        api.MapPost("/media/{id}/workflow/{wf}/{transition}", (string id, string wf, string transition, WorkflowApi.StepBody? body, HttpRequest req, Catalog c, string? locale = null) =>
        {
            var r = TreeApi.Run(req, c, x => Commands.WorkflowStepMedium(x, id, wf, transition, body?.Note, locale));
            WorkflowApi.Nachlauf(r, c, runner, req, wf, transition);   // die Brücke gilt auch am Asset
            return r;
        });
        api.MapPut("/media/{id}/workflow/{wf}/assign", (string id, string wf, WorkflowApi.AssignBody body, HttpRequest req, Catalog c) =>
            TreeApi.Run(req, c, x => Commands.AssignWorkflowMedium(x, id, wf, body.User)));
    }
}
