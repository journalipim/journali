using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Rückgängig je Aktion (Taloan, 18.09.2026): ein Stapel (batch) verbindet die Einträge einer Aktion — Rückzug eines
/// Teilbaums, Tabellen-Sitzung, Import. Rückgängig schreibt neue Einträge, die den Stand VOR dem Stapel wiederherstellen;
/// das Journal bleibt lückenlos, der Rückgängig-Schritt ist selbst ein Stapel und damit wieder rückgängig-fähig.
/// Je Strom und Achse zählt der erste Eintrag des Stapels: sein Vorgänger im Strom ist der alte Stand.
/// Getragen: AttributeSet (alter Wert oder leer), StatusSet, NodeNamed, NodeMoved, NodeRetired (→ NodeRestored).
/// Anderes (Anlegen, Gruppen, Relationen …) wird gezählt, nicht angefasst.
/// </summary>
public static class Undo
{
    public sealed record Step(string Stream, string Kind, string What, string? Payload = null);
    public sealed record Plan(List<Step> Steps, List<string> Skipped, string? Actor, DateTimeOffset? At, int Entries);

    /// <summary>Was Rückgängig tun würde — für die Vorschau und für den Lauf selbst.</summary>
    public static Plan Of(IJournal journal, ModelCatalog model, Tree tree, string batch)
    {
        var entries = journal.ReadBatch(batch).OrderBy(e => e.Number).ToList();
        var steps = new List<Step>();
        var skipped = new List<string>();
        var seen = new HashSet<string>();   // Strom|Typ|Achse — der erste Eintrag zählt
        foreach (var e in entries)
        {
            switch (e.Type)
            {
                case Types.AttributeSet:
                {
                    var a = Types.Deserialize<AttributeSet>(e.Payload);
                    var key = $"{e.Stream}|attr|{a.Attribute}|{a.Locale}|{a.Channel}|{a.Row}";
                    if (!seen.Add(key)) break;
                    var prev = journal.ReadStream(e.Stream).Where(x => x.Number < e.Number && x.Type == Types.AttributeSet)
                        .Select(x => Types.Deserialize<AttributeSet>(x.Payload))
                        .LastOrDefault(p => p.Attribute == a.Attribute && p.Locale == a.Locale && p.Channel == a.Channel && p.Row == a.Row);
                    var old = prev is null ? new AttributeSet(a.Attribute, a.Locale, a.Channel, null, a.Values is not null ? [] : null, a.Row) : prev;
                    var label = model.Attributes.TryGetValue(a.Attribute, out var d) ? d.Label.GetValueOrDefault("de") ?? a.Attribute : a.Attribute;
                    var was = old.Values is { } vs ? string.Join(", ", vs) : old.Value;
                    steps.Add(new(e.Stream, Types.AttributeSet, $"{label}{(a.Locale is null ? "" : " " + a.Locale)}{(a.Channel is null ? "" : " " + a.Channel)}: {(string.IsNullOrEmpty(was) ? "leer" : "„" + Snip(was) + "“")} statt „{Snip(a.Values is { } nv ? string.Join(", ", nv) : a.Value ?? "")}“", Types.Serialize(old)));
                    break;
                }
                case Types.StatusSet:
                {
                    if (!seen.Add($"{e.Stream}|status")) break;
                    var prev = journal.ReadStream(e.Stream).Where(x => x.Number < e.Number && x.Type == Types.StatusSet).Select(x => Types.Deserialize<StatusSet>(x.Payload).Status).LastOrDefault() ?? Statuses.Draft;
                    steps.Add(new(e.Stream, Types.StatusSet, $"Status {prev}", Types.Serialize(new StatusSet(prev))));
                    break;
                }
                case Types.NodeNamed:
                {
                    if (!seen.Add($"{e.Stream}|name")) break;
                    var prev = journal.ReadStream(e.Stream).Where(x => x.Number < e.Number && x.Type == Types.NodeNamed).Select(x => Types.Deserialize<NodeNamed>(x.Payload).Name).LastOrDefault();
                    steps.Add(new(e.Stream, Types.NodeNamed, string.IsNullOrWhiteSpace(prev) ? "Name: Automatik (★)" : $"Name „{prev}“", Types.Serialize(new NodeNamed(prev))));
                    break;
                }
                case Types.NodeMoved:
                {
                    if (!seen.Add($"{e.Stream}|move")) break;
                    var history = journal.ReadStream(e.Stream).Where(x => x.Number < e.Number).ToList();
                    var prev = history.Where(x => x.Type == Types.NodeMoved).Select(x => Types.Deserialize<NodeMoved>(x.Payload).Parent).LastOrDefault()
                        ?? history.Select(x => x.Type switch
                        {
                            Types.GroupCreated => Types.Deserialize<GroupCreated>(x.Payload).Parent,
                            Types.ProductCreated => Types.Deserialize<ProductCreated>(x.Payload).Group,
                            Types.VariantCreated => Types.Deserialize<VariantCreated>(x.Payload).Product,
                            _ => null,
                        }).FirstOrDefault(p => p is not null);
                    if (prev is null) { skipped.Add($"{e.Stream}: Umhängen (kein früherer Platz bekannt)"); break; }
                    steps.Add(new(e.Stream, Types.NodeMoved, $"zurück unter {(tree.Nodes.TryGetValue(prev, out var pn) ? NodeRow.LabelOf(tree, model, pn) : prev)}", Types.Serialize(new NodeMoved(prev))));
                    break;
                }
                case Types.NodeRetired:
                    if (!seen.Add($"{e.Stream}|retire")) break;
                    steps.Add(new(e.Stream, Types.NodeRestored, tree.Retired.TryGetValue(e.Stream, out var rn) ? $"{NodeRow.LabelOf(tree, model, rn)} zurück" : $"{e.Stream}: schon zurück"));
                    break;
                default:
                    skipped.Add($"{e.Stream}: {e.Type}");
                    break;
            }
        }
        return new Plan(steps, skipped, entries.FirstOrDefault()?.Actor, entries.FirstOrDefault()?.At, entries.Count);
    }

    /// <summary>Den Plan ausführen: neue Einträge im Stapel <paramref name="undo"/>. Liefert die Anzahl der geschriebenen Schritte.</summary>
    public static (int Done, List<string> Failed) Run(Plan plan, Ctx ctx, Tree tree)
    {
        var done = 0; var failed = new List<string>();
        // erst Werte, Status, Namen, Umhängen — dann Wiederherstellen von oben nach unten
        for (var i = 0; i < plan.Steps.Count; i++)
        {
            var s = plan.Steps[i];
            if (s.Kind == Types.NodeRestored) continue;
            if (!tree.Nodes.ContainsKey(s.Stream)) { failed.Add($"{s.Stream}: nicht im Baum"); continue; }
            if (s.Kind == Types.NodeMoved)
            {
                var o = Commands.Move(ctx, s.Stream, Types.Deserialize<NodeMoved>(s.Payload!).Parent);
                if (o.Error is null) done++; else failed.Add($"{s.Stream}: {o.Error}");
                continue;
            }
            ctx.Write(s.Stream, s.Kind, s.Payload!); done++;
        }
        var open = plan.Steps.Where(s => s.Kind == Types.NodeRestored && tree.Retired.ContainsKey(s.Stream)).Select(s => s.Stream).ToHashSet();
        for (var progress = true; progress && open.Count > 0;)
        {
            progress = false;
            foreach (var id in open.ToList())
                if (Commands.Restore(ctx, id).Error is null) { done++; open.Remove(id); progress = true; }
        }
        foreach (var id in open) failed.Add($"{id}: Vater fehlt");
        return (done, failed);
    }

    private static string Snip(string v) { var p = System.Text.RegularExpressions.Regex.Replace(v, "<[^>]+>", " ").Trim(); return p.Length > 40 ? p[..40] + "…" : p; }
}
