using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>
/// Workflows (docs/pflegestruktur.md 27; Taloan, 21.09.2026: „brauchen wir auf jeden Fall — Designer, Freigaben, Korrekturschleifen“):
/// der Bearbeitungszustand über dem Status. Ein Workflow (Strom <c>workflow:&lt;key&gt;</c>) hat freie Zustände und Übergänge;
/// ein Übergang trägt die Rollen, die ihn gehen dürfen, ob eine Notiz Pflicht ist (Korrekturschleife) und Wirkungen
/// (<c>release:web</c>, <c>revoke:web</c>, <c>status:active</c>). Am Knoten steht je Workflow genau ein Zustand
/// (<c>WorkflowStateSet</c>); ohne Eintrag gilt der Startzustand. Der Verlauf ist das Journal.
/// </summary>
public sealed class WorkflowDef
{
    public required string Key { get; init; }
    public Labels Label { get; set; } = new();
    public List<WfState> States { get; set; } = new();
    public List<WfTransition> Transitions { get; set; } = new();
    public string Start { get; set; } = "";
    /// <summary>Für welche Knotentypen (leer = alle Pflegeknoten) und Familien (leer = alle) der Workflow gilt.</summary>
    public string[] Roles { get; set; } = [];
    public string[] Families { get; set; } = [];
    public long LastNumber { get; set; }
    public WfState? State(string key) => States.FirstOrDefault(s => s.Key == key);
    public bool AppliesTo(Node n) => n.Role != Entries.Roles.Rubric && (Roles.Length == 0 || Roles.Contains(n.Role)) && (Families.Length == 0 || (n.Family is { } f && Families.Contains(f)));
}

/// <summary>Zustand eines Knotens in einem Workflow — der letzte Schritt.</summary>
public sealed class NodeWorkflow
{
    public required string Workflow { get; init; }
    public string State { get; set; } = "";
    public string? Transition { get; set; }
    public string? Note { get; set; }
    public string? Assigned { get; set; }     // Person (Benutzer-Key), null = die Rolle des nächsten Übergangs
    public long Number { get; set; }
    public DateTimeOffset At { get; set; }
    public string Actor { get; set; } = "";
}

public sealed class Workflows : IProjection
{
    public const string Stream = "workflow:";
    private readonly Dictionary<string, WorkflowDef> _defs = new();
    private readonly Dictionary<string, Dictionary<string, NodeWorkflow>> _nodes = new();   // Knoten → Workflow → Zustand
    public long LastApplied { get; private set; }
    public IReadOnlyDictionary<string, WorkflowDef> All => _defs;

    /// <summary>Zustände eines Knotens (nur, was je gesetzt wurde — der Startzustand steht nirgends).</summary>
    public IReadOnlyDictionary<string, NodeWorkflow> Of(string nodeId) => _nodes.TryGetValue(nodeId, out var d) ? d : new Dictionary<string, NodeWorkflow>();
    /// <summary>Der wirksame Zustand eines Knotens in einem Workflow: gesetzt oder Start.</summary>
    public string StateOf(string nodeId, WorkflowDef wf) => _nodes.TryGetValue(nodeId, out var d) && d.TryGetValue(wf.Key, out var s) && wf.State(s.State) is not null ? s.State : wf.Start;
    /// <summary>Alle Knoten, die in diesem Workflow in diesem Zustand gesetzt wurden (Start = auch die ohne Eintrag ist Sache des Aufrufers).</summary>
    public IEnumerable<(string Node, NodeWorkflow State)> InState(string workflow, string state) => _nodes.SelectMany(kv => kv.Value.Values.Where(s => s.Workflow == workflow && s.State == state).Select(s => (kv.Key, s)));

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        if (entry.Stream.StartsWith(Stream, StringComparison.Ordinal))
        {
            var key = entry.Stream[Stream.Length..];
            switch (entry.Type)
            {
                case Types.WorkflowDefined:
                    var d = Types.Deserialize<WorkflowDefined>(entry.Payload);
                    _defs[key] = new WorkflowDef { Key = key, Label = d.Label ?? new(), States = d.States ?? new(), Transitions = d.Transitions ?? new(), Start = d.Start ?? d.States?.FirstOrDefault()?.Key ?? "", Roles = d.Roles ?? [], Families = d.Families ?? [], LastNumber = entry.Number };
                    break;
                case Types.WorkflowRetired:
                    _defs.Remove(key);
                    foreach (var n in _nodes.Values) n.Remove(key);
                    break;
            }
            return;
        }
        switch (entry.Type)
        {
            case Types.WorkflowStateSet:
            {
                var s = Types.Deserialize<WorkflowStateSet>(entry.Payload);
                if (!_nodes.TryGetValue(entry.Stream, out var d)) _nodes[entry.Stream] = d = new();
                if (!d.TryGetValue(s.Workflow, out var nw)) d[s.Workflow] = nw = new NodeWorkflow { Workflow = s.Workflow };
                nw.State = s.State; nw.Transition = s.Transition; nw.Note = s.Note; nw.Number = entry.Number; nw.At = entry.At; nw.Actor = entry.Actor;
                nw.Assigned = null;   // ein Schritt löst die Zuständigkeit — der nächste Übergang gehört wieder der Rolle
                break;
            }
            case Types.WorkflowAssigned:
            {
                var a = Types.Deserialize<WorkflowAssigned>(entry.Payload);
                if (!_nodes.TryGetValue(entry.Stream, out var d)) _nodes[entry.Stream] = d = new();
                if (!d.TryGetValue(a.Workflow, out var nw)) d[a.Workflow] = nw = new NodeWorkflow { Workflow = a.Workflow, State = _defs.GetValueOrDefault(a.Workflow)?.Start ?? "" };
                nw.Assigned = a.User;
                break;
            }
            case Types.NodeRetired:
                _nodes.Remove(entry.Stream);
                break;
        }
    }
}
