using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>
/// Workflows (docs/pflegestruktur.md 27):
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
    /// <summary>Je Sprache ein eigener Zustand.
    /// Der Zustand ohne Sprache bleibt daneben gültig — er ist der des Knotens.</summary>
    public bool PerLocale { get; set; }
    public long LastNumber { get; set; }
    public WfState? State(string key) => States.FirstOrDefault(s => s.Key == key);
    public bool AppliesTo(Node n) => n.Role != Entries.Roles.Rubric && (Roles.Length == 0 || Roles.Contains(n.Role)) && (Families.Length == 0 || (n.Family is { } f && Families.Contains(f)));
    /// <summary>Gilt der Workflow für Assets (27.09.2026)? Nur ausdrücklich: eine leere Liste heisst „alle Pflegeknoten“,
    /// nicht „auch jedes Bild“. Der Zustand steht dann am Medienstrom, ohne Vererbung — ein Medium hat keinen Vater.</summary>
    public bool AppliesToMedium() => Roles.Contains(Entries.Roles.Media);
}

/// <summary>Zustand eines Knotens in einem Workflow — der letzte Schritt. Bei einem Workflow je Sprache trägt er die Sprache.</summary>
public sealed class NodeWorkflow
{
    public required string Workflow { get; init; }
    public string? Locale { get; init; }
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
    private readonly Dictionary<string, Dictionary<string, NodeWorkflow>> _nodes = new();   // Knoten → Workflow (bei PerLocale „workflow@sprache“) → Zustand
    /// <summary>Schlüssel im Knoten: der Workflow, bei einem Zustand je Sprache mit der Sprache dahinter.</summary>
    public static string Slot(string workflow, string? locale) => string.IsNullOrEmpty(locale) ? workflow : workflow + "@" + locale;
    private readonly HashSet<string> _ever = new();   // je definiert — fürs Saatgut
    public bool Ever(string key) => _ever.Contains(key);
    public long LastApplied { get; private set; }
    public IReadOnlyDictionary<string, WorkflowDef> All => _defs;

    /// <summary>Zustände eines Knotens (nur, was je gesetzt wurde — der Startzustand steht nirgends).</summary>
    public IReadOnlyDictionary<string, NodeWorkflow> Of(string nodeId) => _nodes.TryGetValue(nodeId, out var d) ? d : new Dictionary<string, NodeWorkflow>();
    /// <summary>Der wirksame Zustand eines Knotens in einem Workflow: gesetzt oder Start. Mit Sprache bei einem Workflow je Sprache.</summary>
    public string StateOf(string nodeId, WorkflowDef wf, string? locale = null) => Own(nodeId, wf, locale) ?? wf.Start;
    /// <summary>Eigener Zustand am Knoten, null = nie gesetzt. Bei einem Workflow je Sprache fällt die Sprache auf den Zustand ohne Sprache zurück —
    /// so gilt jeder Eintrag von früher weiter.</summary>
    public string? Own(string nodeId, WorkflowDef wf, string? locale = null)
    {
        if (!_nodes.TryGetValue(nodeId, out var d)) return null;
        if (!string.IsNullOrEmpty(locale) && wf.PerLocale && d.TryGetValue(Slot(wf.Key, locale), out var ls) && wf.State(ls.State) is not null) return ls.State;
        return d.TryGetValue(wf.Key, out var s) && wf.State(s.State) is not null ? s.State : null;
    }
    /// <summary>Die Sprachen, für die an diesem Knoten ein eigener Zustand steht (nur bei einem Workflow je Sprache).</summary>
    public IEnumerable<string> LocalesAt(string nodeId, WorkflowDef wf) =>
        _nodes.TryGetValue(nodeId, out var d) ? d.Keys.Where(k => k.StartsWith(wf.Key + "@", StringComparison.Ordinal)).Select(k => k[(wf.Key.Length + 1)..]) : [];
    /// <summary>Wirksamer Zustand: eigener, sonst der des nächsten Vorfahren mit eigenem (Variante folgt dem Produkt, Produkt der Gruppe),
    /// sonst Start. Liefert auch, von wem er kommt (null = eigen oder Start).</summary>
    public (string State, string? From) StateOf(string nodeId, WorkflowDef wf, Func<string, string?> parentOf, string? locale = null)
    {
        if (Own(nodeId, wf, locale) is { } own) return (own, null);
        for (var p = parentOf(nodeId); p is not null; p = parentOf(p))
            if (Own(p, wf, locale) is { } s) return (s, p);
        return (wf.Start, null);
    }
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
                    _ever.Add(key);
                    var d = Types.Deserialize<WorkflowDefined>(entry.Payload);
                    _defs[key] = new WorkflowDef { Key = key, Label = d.Label ?? new(), States = d.States ?? new(), Transitions = d.Transitions ?? new(), Start = d.Start ?? d.States?.FirstOrDefault()?.Key ?? "", Roles = d.Roles ?? [], Families = d.Families ?? [], PerLocale = d.PerLocale, LastNumber = entry.Number };
                    break;
                case Types.WorkflowRetired:
                    _defs.Remove(key);
                    foreach (var n in _nodes.Values)
                        foreach (var slot in n.Keys.Where(k => k == key || k.StartsWith(key + "@", StringComparison.Ordinal)).ToList()) n.Remove(slot);
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
                var slotKey = Slot(s.Workflow, s.Locale);
                if (string.IsNullOrEmpty(s.State)) { d.Remove(slotKey); break; }   // aufgehoben: kein eigener Eintrag mehr, der Vater gilt
                if (!d.TryGetValue(slotKey, out var nw)) d[slotKey] = nw = new NodeWorkflow { Workflow = s.Workflow, Locale = string.IsNullOrEmpty(s.Locale) ? null : s.Locale };
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
            case Types.MediaRetired:   // ein Medium führt seinen Zustand am eigenen Strom — weg mit dem Medium
                _nodes.Remove(entry.Stream);
                break;
        }
    }
}
