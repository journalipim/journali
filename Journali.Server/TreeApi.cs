using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Der Baum unter /api: Lesen, und jeder Befehl aus <see cref="Commands"/>
/// einzeln als Endpunkt. Die Prüfung steckt in Commands, hier ist nur HTTP.
/// </summary>
public static class TreeApi
{
    public sealed record RolesBody(string[]? Roles);
    /// <summary>Die Abfrage einer Tabelle (GET: aus den Parametern, POST: aus dem Rumpf).</summary>
    public sealed record TableQuery(string? Role = null, string[]? Attributes = null, string? Locale = null, string? Channel = null, bool Deep = false, bool Self = false,
        long? At = null, int? Take = null, int Skip = 0, bool Children = true, bool Sparse = false, string? Types = null);

    static IResult Tabelle(Catalog c, string id, TableQuery q)
    {
        var (role, wanted, locale, channel, deep, self, at, take, skip, children, sparse, types) = (q.Role, q.Attributes, q.Locale, q.Channel, q.Deep, q.Self, q.At, q.Take, q.Skip, q.Children, q.Sparse, q.Types);
        return             c.Lesen((liveModel, liveTree) =>
            {
                var (model, tree) = at is { } n ? c.AsOf(n) : (liveModel, liveTree);   // at: der Stand von damals
                if (!tree.Nodes.TryGetValue(id, out var root)) return Results.NotFound();
                var nodes = !children ? [] : (deep ? tree.DescendantsDeepestFirst(id).Reverse() : tree.Children(id)).Where(n => role is null || n.Role == role).ToList();
                if (self) nodes.Insert(0, root);
                var cols = wanted is { Length: > 0 }
                    ? wanted.Distinct().Select(k => model.Attributes.GetValueOrDefault(k)).Where(a => a is not null).Select(a => a!).ToList()
                    : SpaltenVon(model, tree, nodes, $"{at ?? tree.LastApplied}|{id}|{role}|{deep}|{self}|{children}");
                if (types?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) is { Length: > 0 } typen)
                    cols = cols.Where(a => typen.Contains(a.Type, StringComparer.OrdinalIgnoreCase)).ToList();
                var total = nodes.Count;
                var breite = Math.Max(1, cols.Count);
                if (take is null && (long)total * breite > MaxCells)
                    return Bad("Tabelle zu gross: {0} Zeilen × {1} Spalten, höchstens {2} Zellen je Abruf.", total, cols.Count, MaxCells);
                skip = Math.Max(0, skip);
                var seite = Math.Clamp(take ?? total, 0, Math.Max(1, MaxCells / breite));
                var page = nodes.Skip(skip).Take(seite).ToList();
                var rows = page.Select(n =>
                {
                    var aktiv = sparse ? null : CompletenessRules.ActiveAttributes(tree, model, n).Select(x => x.Key).ToHashSet();   // einmal je Knoten, nicht je Spalte
                    var values = new Dictionary<string, object>(StringComparer.Ordinal);
                    foreach (var a in cols)
                    {
                        var (v, from) = tree.Resolve(model, n, a.Key, a.PerLocale ? locale : null, a.PerChannel ? channel : null);
                        // Formel/Vorlage: das Ergebnis zeigen, nicht das Skript — die Spalte ist in der Tabelle ohnehin gesperrt
                        if (a.IsComputed) v = tree.Compute(model, n, a, locale);
                        // Beleg am Wert (auch ohne Wert: „angefragt bei … bis …“)
                        var source = SourceView.Of(n, new Axis(a.Key, a.PerLocale ? locale : null, a.PerChannel ? channel : null));
                        if (sparse && v is null && source is null) continue;
                        values[a.Key] = new { value = v, own = from is not null && from.Id == n.Id, from = from is not null && from.Id != n.Id ? from.Id : null, source };
                    }
                    return new
                    {
                        row = NodeRow.Of(tree, model, n),
                        // Spalten, die an diesem Knoten nicht gelten (Gruppe erst ab tieferer Rolle, Attribut nicht erlaubt) —
                        // bei deep ist die Spaltenliste die Vereinigung über alle Knoten (Datenqualität); bei sparse weggelassen
                        inactive = aktiv is null ? null : cols.Where(a => !aktiv.Contains(a.Key)).Select(a => a.Key).ToList(),
                        values,
                    };
                }).ToList();
                var next = skip + page.Count < total ? skip + page.Count : (int?)null;
                return Results.Ok(new { node = NodeRow.Of(tree, model, root), columns = cols.Select(a => new { a.Key, a.Type, a.Label, a.Unit, a.PerLocale, a.Required, a.List, a.Inheritable, a.Multiple, a.Pattern, computed = a.IsComputed }).ToList(), rows, total, skip, next });
            });
    }

    /// <summary>Die Attribute mit eigenen Werten im Teilbaum (Knoten und Nachfahren, die die Rolle sieht), sortiert, und die Zahl der Knoten;
    /// null, wenn es den Knoten nicht gibt. Werte in Zeilen zählen mit ihrer Spalte, ein Zeilenattribut mit Zeilen zählt selbst.</summary>
    public static (List<string> Attributes, int Nodes)? UsedAttributes(Tree tree, string id, string? role, bool admin)
    {
        if (!tree.Nodes.TryGetValue(id, out var root)) return null;
        var used = new HashSet<string>(StringComparer.Ordinal);
        void Add(Node n)
        {
            foreach (var a in n.Values.Keys) used.Add(a.Attribute);
            foreach (var a in n.Lists.Keys) used.Add(a.Attribute);
            foreach (var (k, rows) in n.Rows) if (rows.Count > 0) used.Add(k);
        }
        Add(root);
        var nodes = 1;
        foreach (var d in tree.DescendantsDeepestFirst(id))
            if (tree.Visible(d, role, admin)) { Add(d); nodes++; }
        return (used.OrderBy(x => x, StringComparer.Ordinal).ToList(), nodes);
    }

    /// <summary>Höchstens so viele Zellen (Zeilen × Spalten) liefert /table je Abruf — rund 70 MB JSON.</summary>
    public static int MaxCells { get; set; } = 1_000_000;

    /// <summary>
    /// Die Spalten einer Tabelle ohne attributes: alle Attribute, die an einem der Knoten gelten. Bei tausenden Knoten kostet das, und
    /// wer seitenweise liest, fragt dieselbe Liste für jede Seite — darum je Stand des Journals und Abfrage gemerkt (die letzten 16).
    /// </summary>
    static List<AttributeDefinition> SpaltenVon(ModelCatalog model, Tree tree, List<Node> nodes, string schluessel)
    {
        lock (SpaltenCache)
        {
            if (SpaltenCache.FirstOrDefault(x => x.Key == schluessel) is { Key: not null } da) return da.Value;
        }
        var cols = nodes.SelectMany(n => CompletenessRules.ActiveAttributes(tree, model, n)).DistinctBy(a => a.Key).ToList();
        lock (SpaltenCache)
        {
            SpaltenCache.Insert(0, new(schluessel, cols));
            if (SpaltenCache.Count > 16) SpaltenCache.RemoveAt(SpaltenCache.Count - 1);
        }
        return cols;
    }
    static readonly List<KeyValuePair<string, List<AttributeDefinition>>> SpaltenCache = [];

    public static void Map(RouteGroupBuilder api)
    {
        // ---- Lesen -----------------------------------------------------------

        // Der Baum in der Sicht der Rolle: Knoten, die sie nicht sieht (NodeRestricted am Pfad), fehlen samt allem darunter
        api.MapGet("/tree", (HttpRequest req, Catalog c) => c.Lesen((model, tree) => { var s = Auth.Sicht(req); return tree.Nodes.Values.Where(n => tree.Visible(n, s.Role, s.Admin)).Select(n => NodeRow.Of(tree, model, n)).ToList(); }));

        // Welche Attribute im Teilbaum eigene Werte haben (Knoten und alle Nachfahren, die der Aufrufer sieht) — nur die Schlüssel. Für die
        // Prüfung vor dem Umhängen: die ganze Tabelle eines grossen Zweigs (zehntausende Zeilen, hunderte Spalten) ist für den Browser zu gross.
        api.MapGet("/nodes/{id}/used-attributes", (string id, HttpRequest req, Catalog c) => c.Lesen((_, tree) =>
        {
            var (role, admin) = Auth.Sicht(req);
            return UsedAttributes(tree, id, role, admin) is { } u ? Results.Ok(new { attributes = u.Attributes, nodes = u.Nodes }) : Results.NotFound();
        }));

        // Die eigenen Werte eines Attributs (ohne Sprache, Kanal, Zeile): je Knoten Id, Wert, Name, Rolle — nur, wo der Wert am Knoten selbst steht.
        // Für Plugins, die wissen müssen, wo etwas zugewiesen ist (Klasse eines Klassifikationssystems), ohne den ganzen Baum als Tabelle zu laden
        // (04.10.2026: vorher je Wurzel /table?deep=true — bei 19 500 Knoten rund 15 MB je Abruf). root begrenzt auf einen Teilbaum.
        api.MapGet("/values/{attribute}", (string attribute, HttpRequest req, Catalog c, string? root = null) => c.Lesen((model, tree) =>
        {
            var (role, admin) = Auth.Sicht(req);
            IEnumerable<Node> nodes = tree.Nodes.Values;
            if (root is not null)
            {
                if (!tree.Nodes.TryGetValue(root, out var r)) return Results.NotFound();
                nodes = tree.DescendantsDeepestFirst(root).Prepend(r);
            }
            var values = nodes.Where(n => tree.Visible(n, role, admin))
                .Select(n => (n, v: n.Own(attribute, null, null)))
                .Where(x => !string.IsNullOrEmpty(x.v))
                .Select(x => new { id = x.n.Id, value = x.v, label = NodeRow.LabelOf(tree, model, x.n), role = x.n.Role })
                .ToList();
            return Results.Ok(new { attribute, values });
        }));

        // Sichtbar für Rollen (27.09.2026): ab hier abwärts; leer = für alle
        api.MapPut("/nodes/{id}/roles", (string id, RolesBody b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.RestrictNode(x, id, b.Roles)));

        api.MapGet("/nodes/{id}", (string id, Catalog c) =>
            c.Lesen((model, tree) => tree.Nodes.TryGetValue(id, out var n) ? NodeView.Of(tree, model, n) : null)
                is { } view ? Results.Ok(view) : Results.NotFound());

        // Tabelle unter einem Knoten (Massenpflege, Export, Datenqualität): die Kinder — oder mit deep=true alle
        // Nachfahren — als Zeilen, die Attribute als Spalten, Werte wie in der Knotenansicht aufgelöst (geerbt zählt,
        // own sagt, ob der Wert am Knoten selbst steht). role filtert die Zeilen; attributes (a,b,c) die Spalten,
        // sonst alle Attribute, die an der Rolle der Zeilen gelten. locale/channel = die Achse; ohne = Grundwert.
        // self: der Knoten selbst als erste Zeile, aufgelöst wie die Nachfahren — geerbt zählt; children=false: nur er.
        // Grösse (04.10.2026): ein Zweig mit 17 782 Zeilen × 783 Spalten waren 1 GB JSON, und der Browser stürzte ab. Darum:
        //   take/skip  — Seiten; die Antwort nennt total und next (null auf der letzten Seite). take wird so geklemmt, dass eine Seite
        //                höchstens MaxCells Zellen hat.
        //   ohne take  — mehr als MaxCells Zellen lehnt der Server mit Meldung ab, statt sie zu schicken.
        //   sparse     — nur Zellen mit Wert oder Beleg, ohne die Liste der inaktiven Spalten (Export, Prüfungen).
        //   types      — nur Spalten dieser Typen (text,html): wer nur Texte prüft, braucht die übrigen nicht, und die Adresse bleibt kurz.
        api.MapGet("/nodes/{id}/table", (string id, Catalog c, string? role = null, string? attributes = null, string? locale = null, string? channel = null, bool deep = false, bool self = false,
            long? at = null, int? take = null, int skip = 0, bool children = true, bool sparse = false, string? types = null) =>
            Tabelle(c, id, new TableQuery(role, attributes?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries), locale, channel, deep, self, at, take, skip, children, sparse, types)));
        // Dieselbe Tabelle als POST: die Spaltenliste im Rumpf — hunderte Attribute (alle Merkmale der Klassen eines Teilbaums) passen nicht in die
        // Adresse (über rund 8 KB lehnt der Webserver sie ab). Ändert nichts; das Recht ist lesen (Auth.Needed).
        api.MapPost("/nodes/{id}/table", (string id, TableQuery q, Catalog c) => Tabelle(c, id, q));


        // Suche über Label, SKU, Id und Werte; liefert Zeilen mit Fundstelle.
        api.MapGet("/search", (string q, HttpRequest req, Catalog c, int limit = 200) =>
            string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2
                ? Results.BadRequest(new { error = "q: mindestens 2 Zeichen." })
                : Results.Ok(c.Lesen((model, tree) => tree.Query(model, q.Trim(), c.Relations, c.Media, c.Workflows).Where(h => tree.Visible(h.Node, Auth.Sicht(req).Role, Auth.Sicht(req).Admin)).Take(Math.Clamp(limit, 1, 1000)).Select(h => new { row = NodeRow.Of(tree, model, h.Node), hit = h.Hit }).ToList())));

        api.MapGet("/nodes/external/{system}/{externalId}", (string system, string externalId, Catalog c) =>
            c.Lesen((model, tree) => tree.ByExternal(system, externalId) is { } n ? NodeView.Of(tree, model, n) : null)
                is { } view ? Results.Ok(view) : Results.NotFound());

        // ---- Befehle: genau ein Eintrag je Aufruf ------------------------------

        api.MapPost("/groups", (GroupCreated b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.CreateGroup(x, b.Parent, b.Label, b.Name)));
        api.MapPut("/groups/{id}/label", (string id, GroupRenamed b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.RenameGroup(x, id, b.Label)));   // Altlast
        api.MapPut("/nodes/{id}/name", (string id, NodeNamed b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.Rename(x, id, b.Name)));
        // Publikationsbäume: Wurzel = Baum eines Kanals (× Markt), Rubriken darunter, Pflegeknoten per Verweis
        api.MapGet("/pub", (Catalog c) => c.Lesen((model, tree) => tree.PubTrees.Select(n => new { n.Id, n.Channel, n.Market, label = NodeRow.LabelOf(tree, model, n), rubrics = CountRubrics(tree, n), placed = CountPlaced(tree, n) }).ToList()));
        // Ausleitung: je Produkt im Baum drin/draussen mit Grund — Freigabe für den Kanal, Markt in den Verkaufsländern (Publication.cs)
        api.MapGet("/pub/{id}/export", (string id, Catalog c, string? locale = null) => c.Lesen((model, tree) =>
        {
            if (!tree.Nodes.TryGetValue(id, out var root) || root.Role != Roles.Rubric || root.Parent is not null) return Results.NotFound();
            var rows = Publication.Export(tree, model, root, locale, c.AsOf).Select(r => new
            {
                path = r.Rubrics.Select(x => new { x.Id, x.Role, label = x.Label, x.Rule }).ToList(),
                product = new { r.Product.Id, label = NodeRow.LabelOf(tree, model, r.Product), keys = tree.KeysOf(model, r.Product) },
                r.In, r.Why, r.Stand, r.Rule,
                variants = r.Variants.Select(v => new { v.Variant.Id, label = NodeRow.LabelOf(tree, model, v.Variant), keys = tree.KeysOf(model, v.Variant), v.Verdict.In, v.Verdict.Why }).ToList(),
            }).ToList();
            return Results.Ok(new { tree = new { root.Id, root.Channel, root.Market, root.Stand, label = NodeRow.LabelOf(tree, model, root) }, locale, @in = rows.Count(r => r.In), @out = rows.Count(r => !r.In), rows });
        }));
        api.MapPost("/rubrics", (RubricCreated b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.CreateRubric(x, b.Parent, b.Label, b.Name, b.Channel, b.Market)));
        api.MapPut("/rubrics/{id}/tree", (string id, PubTreeSet b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.SetPubTree(x, id, b.Channel, b.Market)));
        // Stand: {journalNumber: n} einfrieren bei n, {now: true} bei jetzt, {} = live
        api.MapPut("/rubrics/{id}/stand", (string id, StandBody b, HttpRequest req, Catalog c) => { var head = c.Head; return Run(req, c, x => Commands.SetStand(x, id, b.Now == true ? head : b.JournalNumber, head)); });
        api.MapPost("/rubrics/{id}/place", (string id, NodePlaced b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.Place(x, id, b.Node, b.Order)));
        api.MapDelete("/rubrics/{id}/place/{node}", (string id, string node, HttpRequest req, Catalog c) => Run(req, c, x => Commands.Unplace(x, id, node)));
        // Regel-Verweise: setzen (Id leer = neu), entfernen, Vorschau (ungespeichert) und Auflösung der gespeicherten
        api.MapPut("/rubrics/{id}/rules", (string id, PubRule b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.SetRule(x, id, b)));
        api.MapDelete("/rubrics/{id}/rules/{rule}", (string id, string rule, HttpRequest req, Catalog c) => Run(req, c, x => Commands.RemoveRule(x, id, rule)));
        api.MapGet("/rubrics/{id}/rules/preview", (string id, Catalog c, string kind, string? under = null, string? role = null, string? name = null, string? attribute = null, string? value = null, string? groupBy = null) =>
            c.Lesen((model, tree) => Results.Ok(RuleView(tree, model, new PubRule("", kind, under, role, name, attribute, value, groupBy)))));
        api.MapGet("/rubrics/{id}/rules/expand", (string id, Catalog c) => c.Lesen((model, tree) =>
        {
            if (!tree.Nodes.TryGetValue(id, out var r) || r.Role != Roles.Rubric) return Results.NotFound();
            var (stand, _) = tree.StandOf(r);
            var (m, tr) = stand is { } s ? c.AsOf(s) : (model, tree);
            return Results.Ok(r.Rules.Select(rule => new { rule, result = RuleView(tr, m, rule) }).ToList());
        }));
        api.MapPut("/rubrics/{id}/place/{node}/name", (string id, string node, NameBody b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.NamePlace(x, id, node, b.Name)));   // Anzeigename, intern
        api.MapPost("/rubrics/{id}/derive", (string id, DeriveBody b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.Derive(x, id, b.From, b.Self, out _)));
        // die Verweise einer Rubrik als Zeilen (tote Verweise auf zurückgezogene Knoten fallen weg) und wo ein Pflegeknoten überall hängt
        api.MapGet("/rubrics/{id}/placed", (string id, Catalog c) => c.Lesen((model, tree) => tree.Nodes.TryGetValue(id, out var r) && r.Role == Roles.Rubric
            ? Results.Ok(r.Placed.Select(p => tree.Nodes.GetValueOrDefault(p)).Where(n => n is not null).Select(n => NodeRow.Of(tree, model, n!)).ToList()) : Results.NotFound()));
        api.MapGet("/nodes/{id}/placed-in", (string id, Catalog c) => c.Lesen((model, tree) => tree.PlacedIn(id).Select(r => new { r.Id, label = NodeRow.LabelOf(tree, model, r), tree = tree.PubTreeOf(r).Id, path = string.Join(" › ", tree.Ancestors(r).Reverse().Append(r).Select(a => NodeRow.LabelOf(tree, model, a))) }).ToList()));
        api.MapPut("/nodes/{id}/label-attribute", (string id, LabelAttributeSet b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.SetLabelAttribute(x, id, b.Attribute)));
        api.MapPost("/products", (ProductCreated b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.CreateProduct(x, b.Group, b.Axes)));
        api.MapPut("/nodes/{id}/axes", (string id, ProductAxesSet b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.SetAxes(x, id, b.Axes, b.Force)));
        api.MapPut("/nodes/{id}/groups", (string id, GroupsAttached b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.AttachGroups(x, id, b.Groups)));
        api.MapPost("/variants", (VariantCreated b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.CreateVariant(x, b.Product, b.AxisValues)));
        api.MapPost("/nodes/{id}/move", (string id, NodeMoved b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.Move(x, id, b.Parent)));
        // Einordnen: unter parent (null = Wurzeln) vor den Knoten before (null = ans Ende) — umhängen und Platz in einem
        api.MapPost("/nodes/{id}/order", (string id, OrderBody b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.Order(x, id, b.Parent, b.Before)));
        // recursive ohne Vorgabe = Pflichtparameter: ohne ?recursive antwortete ASP.NET mit 400 als Text („Microsoft.AspNetCore…“)
        api.MapDelete("/nodes/{id}", (string id, HttpRequest req, Catalog c, bool recursive = false) =>
        {
            if (!recursive) return Run(req, c, x => Commands.Retire(x, id));
            // Unterbaum: tiefste zuerst, alles in einem Stapel — Rückgängig je Aktion.
            if (Actor(req) is not { } actor) return ActorMissing();
            var batch = "b-" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();
            var result = c.With((model, tree, write) =>
            {
                if (!tree.Nodes.ContainsKey(id)) return (Count: -1, Batch: batch);
                var ctx = new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Write = (stream, type, payload) => write(actor, stream, type, payload, batch) };
                var n = 0;
                foreach (var d in tree.DescendantsDeepestFirst(id).ToList()) { Commands.Retire(ctx, d.Id); n++; }
                Commands.Retire(ctx, id); n++;
                return (Count: n, Batch: batch);
            });
            return result.Count < 0 ? Results.NotFound() : Results.Ok(new { retired = result.Count, batch = result.Batch });
        });
        // Wiederherstellen: den Knoten, mit recursive auch die zurückgezogenen Knoten darunter — von oben nach unten, ein Stapel
        api.MapPost("/nodes/{id}/restore", (string id, HttpRequest req, Catalog c, bool recursive = false) =>
        {
            if (!recursive) return Run(req, c, x => Commands.Restore(x, id));
            if (Actor(req) is not { } actor) return ActorMissing();
            var batch = "b-" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();
            var result = c.With((model, tree, write) =>
            {
                if (!tree.Retired.ContainsKey(id)) return (Count: -1, Batch: batch, Error: (string?)null);
                var ctx = new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Write = (stream, type, payload) => write(actor, stream, type, payload, batch) };
                var first = Commands.Restore(ctx, id);
                if (first.Error is not null) return (Count: 0, Batch: batch, Error: first.Error);
                var n = 1;
                var queue = new Queue<string>([id]);
                while (queue.TryDequeue(out var cur))
                    foreach (var child in tree.RetiredChildren(cur).ToList()) { if (Commands.Restore(ctx, child.Id).Error is null) { n++; queue.Enqueue(child.Id); } }
                return (Count: n, Batch: batch, Error: null);
            });
            return result.Count < 0 ? Results.NotFound() : result.Error is not null ? Results.BadRequest(new { error = result.Error }) : Results.Ok(new { restored = result.Count, batch = result.Batch });
        });
        // Rückgängig je Aktion: ein Stapel = eine Aktion (Rückzug, Tabellen-Sitzung, Import). Undo.cs plant die
        // Schritte (alter Wert je Achse, Status, Name, Platz, Wiederherstellen) und schreibt sie als neuen Stapel.
        // Rückgängig am Knoten: was zuletzt hier geändert wurde, aus dem Journal zurückholen.
        // Der Stapel in der Oberfläche lebt nur in der Sitzung; das Journal weiss es auch danach noch.
        api.MapGet("/nodes/{id}/undo", (string id, IJournal j, Catalog c) => c.Lesen((model, tree) =>
        {
            if (!tree.Nodes.ContainsKey(id) && !tree.Retired.ContainsKey(id)) return Results.NotFound();
            var plan = Undo.LetzterAmKnoten(j, model, tree, id);
            return Results.Ok(new { possible = plan.Steps.Count > 0, what = plan.Steps.FirstOrDefault()?.What, plan.Actor, plan.At });
        }));
        api.MapPost("/nodes/{id}/undo", (string id, HttpRequest req, IJournal j, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var undo = "b-" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();
            return c.With((model, tree, write) =>
            {
                if (!tree.Nodes.ContainsKey(id) && !tree.Retired.ContainsKey(id)) return Results.NotFound();
                var plan = Undo.LetzterAmKnoten(j, model, tree, id);
                if (plan.Steps.Count == 0) return Bad("Hier gibt es nichts rückgängig zu machen.");
                var ctx = new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Write = (stream, type, payload) => write(actor, stream, type, payload, undo) };
                var result = Undo.Run(plan, ctx, tree);
                return result.Failed.Count > 0 && result.Done == 0
                    ? Bad(string.Join(" · ", result.Failed))
                    : Results.Ok(new { undone = result.Done, what = plan.Steps[0].What, batch = undo });
            });
        });

        api.MapPost("/batches/{batch}/undo", (string batch, HttpRequest req, IJournal j, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var undo = "b-" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();
            var result = c.With((model, tree, write) =>
            {
                var plan = Undo.Of(j, model, tree, batch);
                if (plan.Steps.Count == 0) return (Done: 0, Failed: new List<string>(), Skipped: plan.Skipped, Error: (string?)$"Stapel {batch}: nichts, was sich rückgängig machen lässt ({plan.Entries} Einträge: {string.Join(", ", plan.Skipped.Take(3))})");
                var ctx = new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Write = (stream, type, payload) => write(actor, stream, type, payload, undo) };
                var (done, failed) = Undo.Run(plan, ctx, tree);
                return (Done: done, Failed: failed, Skipped: plan.Skipped, Error: null);
            });
            return result.Error is not null ? Results.BadRequest(new { error = result.Error })
                : Results.Ok(new { undone = result.Done, failed = result.Failed, skipped = result.Skipped, batch = undo });
        });
        // Vorschau fürs Mouseover: was würde Rückgängig tun? Schritte in Worten, Urheber, Übersprungenes
        api.MapGet("/batches/{batch}/preview", (string batch, IJournal j, Catalog c) =>
            c.Lesen((model, tree) =>
            {
                var plan = Undo.Of(j, model, tree, batch);
                return Results.Ok(new { plan.Entries, plan.Actor, plan.At, steps = plan.Steps.Select(s => new { s.Stream, s.Kind, s.What }).ToList(), plan.Skipped });
            }));
        api.MapPost("/nodes/{id}/duplicate", (string id, HttpRequest req, Catalog c, bool deep = false) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var batch = "b-" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();
            var r = c.With((model, tree, write) => Commands.Duplicate(
                new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Write = (stream, type, payload) => write(actor, stream, type, payload, batch) }, id, deep));
            return r.Id is not null ? Results.Ok(new { id = r.Id, entries = r.Count, batch })
                : r.Error is not null ? Bad(r.Error) : Results.NotFound();
        });
        api.MapPost("/nodes/{id}/status", (string id, StatusBody b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.SetStatus(x, id, b.Status, b.From)));
        api.MapPost("/nodes/{id}/attributes", (string id, AttributeSet b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.SetAttribute(x, id, b.Attribute, b.Locale, b.Channel, b.Value, b.Values, b.Row, b.Unit)));
        // Ausdrücklich leer: hier gilt nichts, auch wenn oben etwas steht. Zurück zur Vererbung führt ein leerer AttributeSet.
        api.MapPost("/nodes/{id}/attributes/clear", (string id, AttributeCleared b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.ClearAttribute(x, id, b.Attribute, b.Locale, b.Channel, b.Row)));
        // Beleg an einem Wert: Quelle (URL oder Text), Weg, Prüfdatum — leere Quelle nimmt den Beleg weg
        api.MapPost("/nodes/{id}/sources", (string id, ValueSourced b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.SourceValue(x, id, b.Attribute, b.Locale, b.Channel, b.Row, b.Source, b.Title, b.Note, b.Method, b.CheckedAt)));
        api.MapPost("/nodes/{id}/rows", (string id, RowAdded b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.AddRow(x, id, b.Attribute)));
        api.MapDelete("/nodes/{id}/rows/{attribute}/{row}", (string id, string attribute, string row, HttpRequest req, Catalog c) => Run(req, c, x => Commands.RemoveRow(x, id, attribute, row)));
        api.MapPut("/nodes/{id}/rows/{attribute}", (string id, string attribute, RowOrdered b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.OrderRows(x, id, attribute, b.Rows)));
        api.MapPost("/nodes/{id}/categories", (string id, CategoryAssigned b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.AssignCategory(x, id, b.Category)));
        api.MapDelete("/nodes/{id}/categories/{category}", (string id, string category, HttpRequest req, Catalog c) => Run(req, c, x => Commands.RemoveCategory(x, id, category)));
        api.MapPost("/nodes/{id}/releases", (string id, ReleaseGranted b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.GrantRelease(x, id, b.Channel, b.Locale)));
        api.MapDelete("/nodes/{id}/releases", (string id, string channel, string? locale, HttpRequest req, Catalog c) => Run(req, c, x => Commands.RevokeRelease(x, id, channel, locale)));
        api.MapPut("/nodes/{id}/external/{system}", (string id, string system, ExternalLinked b, HttpRequest req, Catalog c) => Run(req, c, x => Commands.LinkExternal(x, id, system, b.Id)));
        api.MapDelete("/nodes/{id}/external/{system}", (string id, string system, HttpRequest req, Catalog c) => Run(req, c, x => Commands.UnlinkExternal(x, id, system)));
    }

    /// <summary>Ein Befehl: Urheber aus dem Kopf, Prüfen und Schreiben unter der Sperre, Ergebnis als HTTP.</summary>
    static int CountRubrics(Tree tree, Node n) => tree.Children(n.Id).Sum(ch => 1 + CountRubrics(tree, ch));
    static int CountPlaced(Tree tree, Node n) => n.Placed.Count + tree.Children(n.Id).Sum(ch => CountPlaced(tree, ch));
    public sealed record DeriveBody(string? From, bool Self = false);
    public sealed record OrderBody(string? Parent, string? Before);
    public sealed record NameBody(string? Name);
    /// <summary>Status setzen; From ist der Tag (JJJJ-MM-TT), ab dem er gilt — leer heisst ab sofort.</summary>
    public sealed record StatusBody(string? Status, string? From);
    public sealed record StandBody(long? JournalNumber, bool? Now);
    /// <summary>Treffer einer Regel als Ansicht: Gliederungen mit Knoten (Id, Rolle, Name, Anzahl darunter).</summary>
    public static object RuleView(Tree tree, ModelCatalog model, PubRule rule)
    {
        var groups = Rules.Expand(tree, model, rule);
        int below(Node n) => tree.DescendantsDeepestFirst(n.Id).Count(d => d.Role == Roles.Product);
        var items = groups.Select(g => new { g.Key, g.Label, node = g.Node?.Id, matches = g.Matches.Select(n => new { n.Id, n.Role, label = NodeRow.LabelOf(tree, model, n), products = n.Role == Roles.Product ? 1 : below(n) }).ToList() }).ToList();
        return new { groups = items.Count(g => g.Key.Length > 0), hits = items.Sum(g => g.matches.Count), products = items.Sum(g => g.matches.Sum(x => x.products)), items };
    }   // Self: die Gruppe selbst wird Rubrik, darunter ihr Aufbau

    public static IResult Run(HttpRequest req, Catalog c, Func<Ctx, Outcome> command)
    {
        if (Actor(req) is not { } actor) return ActorMissing();
        var outcome = c.With((model, tree, write) => command(new Ctx
        {
            Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Workflows = c.Workflows, Translations = c.Translations,
            Role = req.HttpContext.Items["role"] as string,   // für Übergänge mit Rollen (null = offen)
            Write = (stream, type, payload) => write(actor, stream, type, payload, null),
        }));
        return outcome switch
        {
            { Entry: { } e } => Results.Ok(EntryView.Of(e)),
            { NotFound: true } => Results.NotFound(),
            _ => Bad(outcome.Error!),
        };
    }
}

/// <summary>Eine Zeile im Baum: genug für die Anzeige, ohne Werte.</summary>
public sealed record NodeRow(string Id, string Role, string? Parent, string Label, string? Name, string? Groups, string[] Axes,
    Dictionary<string, string> AxisValues, string Status, Dictionary<string, string>? Keys, Dictionary<string, string> External,
    int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor, string? LabelAttribute = null,
    string? Channel = null, string? Market = null, string[]? Placed = null, int? Order = null, string? Source = null, Dictionary<string, string>? PlacedNames = null, long? Stand = null, List<PubRule>? Rules = null,
    bool HasStatus = true, string[]? VisibleTo = null,
    string? StatusAb = null, string? StatusNext = null, string? StatusNextAb = null)
{
    /// <summary>Ein Tag geht als JJJJ-MM-TT hinaus — dieselbe Schreibweise, die die Oberfläche zurückschickt.</summary>
    internal static string? Tag(DateOnly? d) => d?.ToString("yyyy-MM-dd");

    public static NodeRow Of(Tree tree, ModelCatalog model, Node n) => new(
        n.Id, n.Role, n.Parent, LabelOf(tree, model, n), n.Name, n.Groups.Length > 0 ? string.Join(",", n.Groups) : null, n.Axes, n.AxisValues, n.Status,
        tree.KeysOf(model, n), n.External, n.Entries, n.LastNumber, n.LastAt, n.LastActor, LabelAttributeOf(tree, model, n),
        n.Channel, n.Market, n.Role == Roles.Rubric ? n.Placed.ToArray() : null, n.Order, n.Source, n.Role == Roles.Rubric && n.PlacedNames.Count > 0 ? n.PlacedNames : null, n.Stand, n.Role == Roles.Rubric && n.Rules.Count > 0 ? n.Rules : null,
        n.HasStatus, n.VisibleTo.Length > 0 ? n.VisibleTo : null,
        Tag(n.StatusAb), n.StatusGeplant?.Status, Tag(n.StatusGeplant?.Ab));

    /// <summary>Das ★-Attribut, das diesen Knoten benennt (Tabelle): null bei fixiertem Namen; sonst das nächste ★ am Pfad,
    /// das hier gilt und einen Wert hat — hat keins einen Wert, das nächste, das hier gilt (dann benennt der Wert, sobald er da ist).</summary>
    public static string? LabelAttributeOf(Tree tree, ModelCatalog model, Node n)
    {
        if (!string.IsNullOrWhiteSpace(n.Name)) return null;
        string? first = null;
        foreach (var (attr, _) in tree.LabelAttributesOf(n))
        {
            if (!AppliesAt(model, attr, n.Role)) continue;
            if (ByAttribute(tree, model, n, attr) is not null) return attr;
            first ??= attr;
        }
        return first;
    }

    /// <summary>
    /// Name im Baum (docs/pflegestruktur.md, 17), in dieser Reihenfolge:
    /// 1. eigener Name (NodeNamed); 2. die Sternchen am Pfad, das nächste zuerst — ein ★
    /// zählt nur, wo sein Attribut an dieser Rolle gilt und einen Wert hat (de zuerst,
    /// dann die anderen Sprachen, dann ohne — geerbt zählt; Werteliste zeigt ihr Label),
    /// sonst das nächste weiter oben; 3. bei der Variante SKU, dann Achsenwerte; 4. die Id.
    /// </summary>
    public static string LabelOf(Tree tree, ModelCatalog model, Node n)
    {
        if (!string.IsNullOrWhiteSpace(n.Name)) return n.Name;
        foreach (var (attr, _) in tree.LabelAttributesOf(n))
            if (AppliesAt(model, attr, n.Role) && ByAttribute(tree, model, n, attr) is { } v) return v;
        if (n.Role == Roles.Variant)
        {
            // ohne ★: der erste Schlüssel (eindeutiger Wert, Attribute nach Schlüssel geordnet), sonst die Achsenwerte
            if (tree.KeysOf(model, n) is { } keys) return keys.Values.First();
            if (n.AxisValues.Count > 0) return string.Join(" · ", n.AxisValues.Values);
        }
        return n.Id;
    }

    /// <summary>Gilt das Attribut an dieser Rolle (Gruppe aktiv, levels)? Ein ★ an SKU benennt Varianten, nicht die Produkte darüber.</summary>
    public static bool AppliesAt(ModelCatalog model, string attr, string role) =>
        model.Attributes.TryGetValue(attr, out var d) && d.AllowedAt(role) && model.GroupActiveAt(d.Group ?? "", role);

    /// <summary>Wert eines Attributs als Text fürs Label — null, wenn leer.</summary>
    public static string? ByAttribute(Tree tree, ModelCatalog model, Node n, string attr)
    {
        var raw = tree.Resolve(model, n, attr, "de", null).Value;
        if (raw is null) foreach (var l in model.Locales.Keys) if (tree.Resolve(model, n, attr, l, null).Value is { } lv) { raw = lv; break; }
        raw ??= tree.Resolve(model, n, attr, null, null).Value;
        if (string.IsNullOrWhiteSpace(raw)) return null;
        if (model.Attributes.TryGetValue(attr, out var def) && def.Type == AttributeTypes.Enum
            && model.Lists.TryGetValue(def.List ?? "", out var list) && list.Values.TryGetValue(raw, out var value)
            && value.Label.GetValueOrDefault("de") is { Length: > 0 } label) return label;
        return raw;
    }
}

/// <summary>Ein Wert auf seinen Achsen — einfach oder als Liste, bei vermehrbaren Attributen mit Zeile.</summary>
/// <param name="Number">Eintrag, der den Wert zuletzt setzte — der Client vergleicht damit Mastersprache gegen Übersetzung.</param>
/// <param name="Unit">Einheit, in der der Wert eingegeben wurde; <c>Value</c> steht immer in der des Attributs (AttributeSet.Unit).</param>
public sealed record ValueView(string Attribute, string? Locale, string? Channel, string? Value, string[]? Values, string? Row = null, long Number = 0, SourceView? Source = null, string? Unit = null)
{
    public static IEnumerable<ValueView> Of(Medium m) =>
        m.Values.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, kv.Value, null, kv.Key.Row, m.SetAt.GetValueOrDefault(kv.Key)))
            .Concat(m.Lists.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, null, kv.Value, kv.Key.Row, m.SetAt.GetValueOrDefault(kv.Key))));

    public static IEnumerable<ValueView> Of(Relation r) =>
        r.Values.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, kv.Value, null, kv.Key.Row, r.SetAt.GetValueOrDefault(kv.Key), null, r.Units.GetValueOrDefault(kv.Key)))
            .Concat(r.Lists.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, null, kv.Value, kv.Key.Row, r.SetAt.GetValueOrDefault(kv.Key))));

    public static IEnumerable<ValueView> Of(Node n) =>
        n.Values.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, kv.Value, null, kv.Key.Row, n.SetAt.GetValueOrDefault(kv.Key), SourceView.Of(n, kv.Key), n.Units.GetValueOrDefault(kv.Key)))
            .Concat(n.Lists.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, null, kv.Value, kv.Key.Row, n.SetAt.GetValueOrDefault(kv.Key), SourceView.Of(n, kv.Key))));
}

/// <summary>Beleg am Wert (ValueSourced); <paramref name="Stale"/>: der Wert wurde nach dem Beleg geändert.</summary>
public sealed record SourceView(string Source, string? Title, string? Note, string Method, string CheckedAt, long Number, string Actor, bool Stale)
{
    public static SourceView? Of(Node n, Axis axis) => n.Sources.TryGetValue(axis, out var s) ? new SourceView(s.Source, s.Title, s.Note, s.Method, s.CheckedAt, s.Number, s.Actor, n.SetAt.GetValueOrDefault(axis) > s.Number) : null;
}

/// <summary>Ergebnis eines Formel-Attributs an diesem Knoten (null = kein Skript oder ein Wert fehlt).</summary>
public sealed record ComputedView(string Attribute, string? Value, string? Locale, string? Row = null);   // Row: Ergebnis einer berechneten Spalte in dieser Zeile

/// <summary>Ein Vorfahr mit seinen Werten — der Client rechnet die Vererbung damit wie <see cref="Tree.Resolve"/>.</summary>
public sealed record AncestorView(string Id, string Role, string Label, List<ValueView> Values);

/// <summary>Eine Gruppe, die am Knoten gilt: woher (angehängt hier oder oben), ob hier aktiv, welche Attribute sie hier hat.</summary>
public sealed record GroupView(string Key, string From, string FromLabel, bool Active, List<string> Attributes, string? FromRole = null);   // FromRole rubric: Gruppe aus einem Publikationsbaum

/// <summary>Ein Knoten vollständig — Kopie aus dem Abbild, ausserhalb der Sperre ungefährlich.</summary>
/// <summary>Ein ★ am Pfad: Attribut, wo es gesetzt ist, ob es an diesem Knoten gilt.</summary>
public sealed record StarView(string Attribute, string From, string FromLabel, bool Applies);

/// <summary>Freigabe, die nicht eigen ist, sondern über den Fallback-Kanal gilt.</summary>
public sealed record ReleasedVia(string Channel, string? Locale, string Via);

public sealed record NodeView(string Id, string Role, string? Parent, Labels Label, string? Name, List<StarView> Stars, string? Family, string[] Axes,
    Dictionary<string, string> AxisValues, string Status, Dictionary<string, string> External, List<ValueView> Values, Dictionary<string, List<string>> Rows,
    List<AncestorView> Ancestors, string[] AttachedGroups, List<GroupView> Groups, List<string> Orphans, List<ComputedView> Computed,
    List<string> Categories, List<Release> Releases, List<ReleasedVia> ReleasedVia, List<Completeness> Completeness,
    int Children, int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor, string? Source = null, string? SourceLabel = null,
    bool HasStatus = true, string? StatusAb = null, string? StatusNext = null, string? StatusNextAb = null)
{
    public static NodeView Of(Tree tree, ModelCatalog model, Node n)
    {
        var effective = tree.EffectiveGroups(n);
        var groups = effective.Select(g => new GroupView(g.Group, g.From.Id, NodeRow.LabelOf(tree, model, g.From), model.GroupActiveAt(g.Group, n.Role),
            model.AttributesOf(g.Group).Where(a => a.AllowedAt(n.Role) && CompletenessRules.WhenHolds(tree, model, n, a)).Select(a => a.Key).ToList(), g.From.Role)).ToList();
        var covered = groups.SelectMany(g => g.Attributes).ToHashSet();
        // Verwaist: eigene Werte für Attribute, die hier über keine Gruppe gelten (z. B. nach dem Umhängen).
        var orphans = n.Values.Keys.Select(k => k.Attribute).Concat(n.Lists.Keys.Select(k => k.Attribute)).Concat(n.Rows.Keys).Distinct().Where(a => !covered.Contains(a)).Order().ToList();
        var stars = tree.LabelAttributesOf(n).Select(s => new StarView(s.Attribute, s.From.Id, NodeRow.LabelOf(tree, model, s.From), NodeRow.AppliesAt(model, s.Attribute, n.Role))).ToList();
        return new(
        n.Id, n.Role, n.Parent, n.Label, n.Name, stars, n.Family, n.Axes, n.AxisValues, n.Status, n.External,
        ValueView.Of(n).ToList(), n.Rows,
        tree.Ancestors(n).Select(a => new AncestorView(a.Id, a.Role, NodeRow.LabelOf(tree, model, a), ValueView.Of(a).ToList())).ToList(),
        n.Groups, groups, orphans,
        CompletenessRules.ActiveAttributes(tree, model, n).Where(a => a.IsComputed)
            .SelectMany(a => a.PerLocale ? model.Locales.Keys.Select(l => new ComputedView(a.Key, tree.Compute(model, n, a, l), l)) : [new ComputedView(a.Key, tree.Compute(model, n, a, null), null)])
            .Concat(tree.ComputeRows(model, n, model.Locales.Keys).Select(r => new ComputedView(r.Column, r.Value, r.Locale, r.Row))).ToList(),
        n.Categories.Order().ToList(), n.Releases.ToList(),
        // Freigaben, die über den Fallback-Kanal gelten (Sortiment geerbt) — nur die, die nicht eigen sind
        model.Channels.Keys.SelectMany(ch => new string?[] { null }.Concat(model.Locales.Keys).Select(l => (ch, l, via: tree.ReleasedVia(n, ch, l))))
            .Where(x => x.via is not null && x.via != x.ch).Select(x => new ReleasedVia(x.ch, x.l, x.via!)).ToList(),
        CompletenessRules.Of(tree, model, n),
        tree.Children(n.Id).Count(),
        n.Entries, n.LastNumber, n.LastAt, n.LastActor,
        n.Source, n.Source is { } src && tree.Nodes.TryGetValue(src, out var sn) ? NodeRow.LabelOf(tree, model, sn) : null,
        n.HasStatus, NodeRow.Tag(n.StatusAb), n.StatusGeplant?.Status, NodeRow.Tag(n.StatusGeplant?.Ab));
    }
}
