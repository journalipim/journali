using Journali.Core.Configurator;
using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Der Konfigurator als Schnittstelle (docs/pflegestruktur.md 39, 02.10.2026). Ein Shop schickt, was ausgewählt ist, und bekommt zurück, was geht —
/// die Regeln kennt er nicht. Die Definitionen liegen als Plugin-Daten von <c>configurator</c> im Journal (Name <c>def:&lt;key&gt;</c>, ein JSON-Dokument,
/// <see cref="Definition"/>); gepflegt werden sie in der Ansicht des Plugins. Geprüft wird hier, mit derselben Funktion wie in den Tests
/// (<see cref="Checker"/>): es gibt keine zweite Umsetzung der Logik im Browser.
/// <para><b>Gruppen</b> (docs/pflegestruktur.md 40): <c>group:&lt;key&gt;</c> (Bezeichnung, gleiche Werte) und <c>member:&lt;knoten&gt;</c> (die Zeilen eines Teils)
/// stehen ebenfalls in den Plugin-Daten und gelten für alle Konfiguratoren.</para>
/// <para><b>Recht.</b> Prüfen ändert nichts und braucht darum nur das Recht zu lesen, auch wenn es ein POST ist (<see cref="Auth.Needed"/>).
/// Ein Teil, das die Rolle des Aufrufers nicht sieht, gibt es für ihn nicht.</para>
/// </summary>
public static class ConfiguratorApi
{
    public const string Plugin = "configurator";
    public const string Prefix = "def:";
    public const int MaxLines = 500;
    public const int MaxAmount = 9999;
    public const int MaxSelectable = 2000;

    /// <summary>Ein Teil der Auswahl: <c>Id</c> ist eine Knoten-Id oder der eindeutige Wert eines Attributs (SKU, EAN …).</summary>
    public sealed record SelectionLine(string? Id, int? Amount = null);
    public sealed record Check(List<SelectionLine>? Selection, bool? Selectable = null);

    public static void Map(RouteGroupBuilder api)
    {
        // Die Konfiguratoren dieser Instanz
        api.MapGet("/configurator", (Catalog c) =>
        {
            if (Ready(c) is { } no) return no;
            return Results.Ok(c.Lesen((_, _) => All(c).Select(kv =>
            {
                var (d, error) = Definition.Read(kv.Value);
                return new { key = kv.Key, label = d?.Label, root = d?.Root, rules = d?.All.Count ?? 0, errors = error is not null ? 1 : d!.Errors().Count };
            }).ToList()));
        });

        // Die Konfiguratorgruppen und die Zeilen der Teile, wie die Prüfung sie liest — mit dem, was an ihnen nicht stimmt
        api.MapGet("/configurator-groups", (Catalog c) =>
        {
            if (Ready(c) is { } no) return no;
            return Results.Ok(c.Lesen((_, _) =>
            {
                var data = Data(c);
                var (groups, ge) = Groups.ReadGroups(data);
                var (rows, re) = Groups.ReadRows(data);
                var members = rows.Values.SelectMany(l => l.Where(r => !r.IsLimit).Select(r => r.Group!)).GroupBy(g => g).ToDictionary(g => g.Key, g => g.Count());
                var keys = groups.Keys.Concat(rows.Values.SelectMany(l => l.Select(r => r.Group!))).Distinct().OrderBy(k => k, StringComparer.Ordinal);
                return new
                {
                    groups = keys.Select(k => new { key = k, label = groups.GetValueOrDefault(k)?.Label, equal = groups.GetValueOrDefault(k)?.Equal ?? false, defined = groups.ContainsKey(k), members = members.GetValueOrDefault(k) }).ToList(),
                    parts = rows.OrderBy(kv => kv.Key, StringComparer.Ordinal).Select(kv => new { node = kv.Key, rows = kv.Value }).ToList(),
                    errors = ge.Concat(re).ToList(),
                };
            }));
        });

        // Eine Definition mit dem, was an ihr nicht stimmt
        api.MapGet("/configurator/{key}", (string key, Catalog c) =>
        {
            if (Ready(c) is { } no) return no;
            var def = c.Lesen((_, _) => All(c).FirstOrDefault(kv => kv.Key == key).Value);
            if (def is null) return Unknown(key);
            var (d, readError) = Definition.Read(def);
            return Results.Ok(new { key, definition = d, errors = readError is not null ? new List<string> { readError } : d!.Errors() });
        });

        // Die Auswahl prüfen
        api.MapPost("/configurator/{key}/check", (string key, Check body, HttpRequest req, Catalog c) =>
        {
            if (Ready(c) is { } no) return no;
            var def = c.Lesen((_, _) => All(c).FirstOrDefault(kv => kv.Key == key).Value);
            if (def is null) return Unknown(key);
            var (d, readError) = Definition.Read(def);
            if (d is null) return Bad("Konfigurator {0}: {1}", key, readError ?? "");
            if (d.Errors() is { Count: > 0 } faults) return Bad("Konfigurator {0} hat Fehler: {1}", key, faults[0]);
            var lines = body.Selection ?? [];
            if (lines.Count > MaxLines) return Bad("Höchstens {0} Zeilen in der Auswahl.", MaxLines);
            var view = Auth.Sicht(req);

            return c.Lesen((model, tree) =>
            {
                var data = Data(c);
                var (groups, _) = Groups.ReadGroups(data);
                var (memberRows, _) = Groups.ReadRows(data);

                // Aus der Kennung des Aufrufers wird ein Knoten: Id, sonst der eindeutige Wert eines Attributs
                Dictionary<string, List<Node>>? byValue = null;
                var chosen = new List<(string Ref, Node Node, int Amount)>();
                foreach (var z in lines)
                {
                    var reference = z.Id?.Trim();
                    if (string.IsNullOrEmpty(reference)) return Bad("Eine Zeile der Auswahl hat keine Id.");
                    var amount = z.Amount ?? 1;
                    if (amount < 1 || amount > MaxAmount) return Bad("Menge {0} gilt nicht (1 bis {1}).", amount, MaxAmount);
                    Node? n = null;
                    if (tree.Nodes.TryGetValue(reference, out var direct)) n = direct;
                    else
                    {
                        byValue ??= ValueIndex(tree, model);
                        if (byValue.TryGetValue(reference, out var hits))
                        {
                            if (hits.Count > 1) return Bad("{0} ist nicht eindeutig.", reference);
                            n = hits[0];
                        }
                    }
                    if (n is null || !tree.Visible(n, view.Role, view.Admin)) return Bad("Teil {0} gibt es nicht.", reference);
                    chosen.Add((reference, n, amount));
                }

                var resources = d.ResourcesAttribute;
                var parts = chosen.Select(g => new Line(Parts.From(tree, model, g.Node, resources, memberRows), g.Amount)).ToList();
                IReadOnlyList<Part>? candidates = null;
                if (body.Selectable == true)
                {
                    candidates = Parts.Candidates(tree, model, d.Root, resources, memberRows).Where(t => tree.Nodes.TryGetValue(t.Id, out var k) && tree.Visible(k, view.Role, view.Admin)).ToList();
                    if (candidates.Count > MaxSelectable) return Bad("Mehr als {0} wählbare Teile — die Wurzel des Konfigurators begrenzt sie.", MaxSelectable);
                }

                var e = Checker.Check(d, parts, candidates, groups);
                // Der Aufrufer kennt seine Kennungen, nicht unsere Ids: zurück in seiner Sprache
                var back = chosen.GroupBy(g => g.Node.Id).ToDictionary(g => g.Key, g => g.First().Ref);
                string Ref(string id) => back.GetValueOrDefault(id, id);
                object Sentence(Violation v) => new { v.Kind, v.Text, affects = v.Affects.Select(Ref).ToList(), v.Rule, v.Group };

                return Results.Ok(new
                {
                    valid = e.Valid,
                    complete = e.Complete,
                    selection = chosen.Select(g => new { @ref = g.Ref, id = g.Node.Id, name = NodeRow.LabelOf(tree, model, g.Node), amount = g.Amount }).ToList(),
                    violations = e.Violations.Select(Sentence).ToList(),
                    missing = e.Missing.Select(Sentence).ToList(),
                    balance = e.Balance.OrderBy(kv => kv.Key, StringComparer.Ordinal).ToDictionary(kv => kv.Key, kv => kv.Value),
                    groups = e.Groups!.OrderBy(kv => kv.Key, StringComparer.Ordinal).ToDictionary(kv => kv.Key, kv => new { label = Groups.Label(groups, kv.Key), count = kv.Value.Count, min = kv.Value.Min, max = kv.Value.Max, allowed = kv.Value.Allowed, values = kv.Value.Values }),
                    selectable = e.Selectable?.Select(w =>
                    {
                        var k = tree.Nodes[w.Id];
                        return new { id = w.Id, name = NodeRow.LabelOf(tree, model, k), keys = tree.KeysOf(model, k), ok = w.Ok, reasons = w.Reasons.Select(Sentence).ToList(), lifts = w.Lifts ?? [] };
                    }).ToList(),
                });
            });
        });
    }

    /// <summary>Alle Plugin-Daten von <c>configurator</c>: Name (mit Präfix) und JSON-Dokument — Definitionen, Gruppen, Zeilen der Teile und Testfälle.</summary>
    private static List<KeyValuePair<string, string>> Data(Catalog c) =>
        c.Plugins.All.TryGetValue(Plugin, out var p) ? p.Data.Where(kv => kv.Key.StartsWith(Groups.GroupPrefix, StringComparison.Ordinal) || kv.Key.StartsWith(Groups.MemberPrefix, StringComparison.Ordinal)).ToList() : [];

    /// <summary>Die Definitionen im Journal: Name ohne Präfix und das JSON-Dokument.</summary>
    private static List<KeyValuePair<string, string>> All(Catalog c) =>
        c.Plugins.All.TryGetValue(Plugin, out var p)
            ? p.Data.Where(kv => kv.Key.StartsWith(Prefix, StringComparison.Ordinal)).Select(kv => new KeyValuePair<string, string>(kv.Key[Prefix.Length..], kv.Value)).OrderBy(kv => kv.Key, StringComparer.Ordinal).ToList()
            : [];

    /// <summary>Das Plugin muss da, an und im Tarif sein — sonst gibt es keinen Konfigurator.</summary>
    private static IResult? Ready(Catalog c)
    {
        if (!c.Lesen((_, _) => c.Plugins.All.TryGetValue(Plugin, out var p) && p.Enabled)) return Bad("Plugin {0} ist nicht installiert oder aus.", Plugin);
        return PluginApi.NichtImTarif(c, Plugin);
    }

    /// <summary>Wert → Knoten, für jedes eindeutige Attribut (SKU, EAN …) einmal je Anfrage gebaut.</summary>
    private static Dictionary<string, List<Node>> ValueIndex(Tree tree, ModelCatalog model)
    {
        var index = new Dictionary<string, List<Node>>(StringComparer.Ordinal);
        foreach (var n in tree.Nodes.Values)
            if (tree.KeysOf(model, n) is { } keys)
                foreach (var v in keys.Values)
                {
                    if (!index.TryGetValue(v, out var l)) index[v] = l = [];
                    if (!l.Contains(n)) l.Add(n);
                }
        return index;
    }

    private static IResult Unknown(string key) => Results.Json(ModelApi.Err("Konfigurator {0} gibt es nicht.", key), statusCode: 404);
    private static IResult Bad(string template, params object[] values) => ModelApi.Bad(template, values);
}
