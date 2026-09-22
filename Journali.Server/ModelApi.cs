using System.Globalization;
using System.Text.RegularExpressions;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Modell-Endpunkte unter /api/model: Sprachen, Kanäle, Attribute, Wertelisten,
/// Familien — jede Änderung ein Eintrag mit der ganzen Definition
/// (docs/pflegestruktur.md). Prüft Schlüssel, Typen, Achsen, Verweise.
/// </summary>
public static partial class ModelApi
{
    [GeneratedRegex("^[a-z][a-z0-9_]*$")]
    private static partial Regex KeyPattern();
    // Sprach- und Kanalschlüssel dürfen einen Bindestrich tragen (fr-ch, Taloan 20.09.) — Attributschlüssel nicht (Vorlagen, Formeln)
    [GeneratedRegex("^[a-z][a-z0-9_-]*$")]
    private static partial Regex CodePattern();
    public static bool ValidCode(string key) => CodePattern().IsMatch(key);

    public static bool ValidKey(string key) => KeyPattern().IsMatch(key);

    public static void Map(RouteGroupBuilder api)
    {
        var m = api.MapGroup("/model");

        m.MapGet("/", (Catalog c) => c.ReadModel(View));

        // Zuletzt Zurückgezogenes je Bereich (Taloan, 20.09.: „bis zu 5 zur Wiederherstellung anbieten — weiter zurück muss man ins Journal“):
        // nur Schlüssel, die im Abbild noch fehlen; wer was sehen darf (admin alles, sonst nur Eigenes), entscheidet die Oberfläche am Akteur
        m.MapGet("/retired", (string kind, IJournal j, Catalog c, int limit = 5) =>
        {
            var type = kind switch
            {
                "attributes" => Types.AttributeRetired, "groups" => Types.AttributeGroupRetired, "lists" => Types.ListRetired, "views" => Types.ViewRetired,
                "units" => Types.UnitRetired, "relationTypes" => Types.RelationTypeRetired, "locales" => Types.LocaleRetired, "channels" => Types.ChannelRetired, "statuses" => Types.StatusRetired, _ => null,
            };
            if (type is null) return Bad("kind: attributes, groups, lists, views, units, relationTypes, locales, channels oder statuses.");
            return c.With((model, _, _) =>
            {
                bool Missing(string stream) { var key = stream[(stream.IndexOf(':') + 1)..]; return kind switch
                {
                    "attributes" => !model.Attributes.ContainsKey(key), "groups" => !model.Groups.ContainsKey(key), "lists" => !model.Lists.ContainsKey(key), "views" => !model.Views.ContainsKey(key),
                    "units" => !model.Units.ContainsKey(key), "relationTypes" => !model.RelationTypes.ContainsKey(key), "locales" => !model.Locales.ContainsKey(key), "statuses" => !model.Statuses.ContainsKey(key), _ => !model.Channels.ContainsKey(key),
                }; }
                var seen = new HashSet<string>();
                return Results.Ok(j.ReadRecent(type, Math.Clamp(limit, 1, 100) * 4).Where(e => seen.Add(e.Stream) && Missing(e.Stream)).Take(Math.Clamp(limit, 1, 100)).Select(EntryView.Of).ToList());
            });
        });

        m.MapPut("/locales/{code}", (string code, LocaleDefinition body, HttpRequest req, Catalog c) =>
            Command(req, c, code, ValidCode, (model, write) =>
                body.Fallback is { } fb && (fb == code || !model.Locales.ContainsKey(fb)) ? Bad($"Fallback {fb}: muss eine andere Sprache des Modells sein.")
                : write(Model.LocaleStream + code, Types.LocaleDefined, body with { Code = code })));

        m.MapPut("/relations/{key}", (string key, RelationTypeDefinition body, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidKey, (model, write) =>
            {
                var from = Clean(body.From); var to = Clean(body.To);
                if (from?.Except(Roles.All).Any() ?? false) return Bad("from: nur group, product, variant.");
                if (to?.Except(Roles.All).Except([Roles.Media]).Any() ?? false) return Bad("to: nur group, product, variant, media.");
                var group = Blank(body.Group);
                if (group is not null && !model.Groups.ContainsKey(group) && !model.Attributes.Values.Any(a => a.Group == group)) return Bad($"Unbekannte Gruppe: {group}");
                return write(Model.RelationStream + key, Types.RelationTypeDefined, body with { Key = key, Label = body.Label ?? new(), From = from, To = to, Group = group });
            }));

        m.MapDelete("/relations/{key}", (string key, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            return c.With((model, _, write) =>
                !model.RelationTypes.ContainsKey(key) ? Results.NotFound()
                : c.Relations.OfType(key).Any() ? Bad($"{key} hat noch {c.Relations.OfType(key).Count()} Relationen.")
                : Results.Ok(EntryView.Of(write(actor, Model.RelationStream + key, Types.RelationTypeRetired, new RelationTypeRetired(key), null))));
        });

        // Syntaxprüfung fürs Skript beim Tippen — liest nichts, schreibt nichts. Mit node: dazu das momentane
        // Ergebnis am Knoten (value; null = kein Wert) und ein Laufzeitfehler (runtime), wenn einer auftritt.
        m.MapPost("/formula/check", (FormulaCheck body, Catalog c) =>
        {
            var isTemplate = body.Type == AttributeTypes.Template;
            var (keys, error) = isTemplate ? Template.Check(body.Formula ?? "") : Formula.Check(body.Formula ?? "");
            if (error is not null || body.Node is null) return Results.Ok(new { ok = error is null, error, keys, value = (string?)null, runtime = (string?)null });
            return c.With((model, tree, _) =>
            {
                if (!tree.Nodes.TryGetValue(body.Node, out var node)) return Results.Ok(new { ok = true, error, keys, value = (string?)null, runtime = (string?)"Knoten unbekannt" });
                string? runtime = null;
                var value = isTemplate ? tree.Render(model, node, body.Formula, body.Locale) : tree.Evaluate(model, node, body.Formula, body.Locale, out runtime);
                return Results.Ok(new { ok = true, error, keys, value, runtime });
            });
        });

        m.MapPut("/master-locale", (MasterLocaleDefined body, HttpRequest req, Catalog c) =>
            Command(req, c, body.Code ?? "", ValidCode, (model, write) =>
                !model.Locales.ContainsKey(body.Code ?? "") ? Bad($"Sprache {body.Code} gibt es nicht.")
                : write(Model.MasterLocaleStream, Types.MasterLocaleDefined, new MasterLocaleDefined(body.Code!))));

        m.MapPut("/master-channel", (MasterChannelDefined body, HttpRequest req, Catalog c) =>
            Command(req, c, body.Key ?? "", ValidCode, (model, write) =>
                !model.Channels.ContainsKey(body.Key ?? "") ? Bad($"Kanal {body.Key} gibt es nicht.")
                : write(Model.MasterChannelStream, Types.MasterChannelDefined, new MasterChannelDefined(body.Key!))));

        // Sprache zurückziehen: nicht die Mastersprache, nicht die letzte; Werte auf ihr bleiben im Journal
        m.MapDelete("/locales/{code}", (string code, HttpRequest req, Catalog c) =>
            Command(req, c, code, ValidCode, (model, write) =>
                !model.Locales.ContainsKey(code) ? Results.NotFound()
                : model.MasterLocale == code ? Bad($"{code} ist die Mastersprache — erst eine andere zur Mastersprache machen.")
                : model.Locales.Count <= 1 ? Bad("Die letzte Sprache bleibt.")
                : write(Model.LocaleStream + code, Types.LocaleRetired, new LocaleRetired(code))));

        m.MapPut("/channels/{key}", (string key, ChannelDefinition body, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidCode, (model, write) =>
                body.Fallback is { } fb && (fb == key || !model.Channels.ContainsKey(fb)) ? Bad($"Fallback {fb}: muss ein anderer Kanal des Modells sein.")
                : write(Model.ChannelStream + key, Types.ChannelDefined, body with { Key = key, Label = body.Label ?? new() })));

        // Kanal zurückziehen: kein Attribut darf ihn nennen (channels, required)
        m.MapDelete("/channels/{key}", (string key, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidCode, (model, write) =>
            {
                if (!model.Channels.ContainsKey(key)) return Results.NotFound();
                if (model.MasterChannel == key) return Bad($"{key} ist der Masterkanal — erst einen anderen zum Masterkanal machen.");
                var users = model.Attributes.Values.Where(a => (a.Channels?.Contains(key) ?? false) || (a.Required?.ContainsKey(key) ?? false)).Select(a => a.Key).ToList();
                return users.Count > 0 ? Bad($"{key} wird benutzt von: {string.Join(", ", users)}") : write(Model.ChannelStream + key, Types.ChannelRetired, new ChannelRetired(key));
            }));

        // Status-Vokabular (Taloan, 22.09.2026): frei benennbar, je Sprache; draft bleibt (Startstatus neuer Knoten)
        m.MapPut("/statuses/{key}", (string key, StatusDefinition body, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidCode, (model, write) => write(Model.StatusStream + key, Types.StatusDefined, body with { Key = key, Label = body.Label ?? new() })));
        m.MapDelete("/statuses/{key}", (string key, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is null) return ActorMissing();
            return c.With((model, tree, write) =>
            {
                if (!model.Statuses.ContainsKey(key)) return Results.NotFound();
                if (key == Statuses.Draft) return Bad("draft ist der Startstatus neuer Knoten und bleibt.");
                var n = tree.Nodes.Values.Count(x => x.Status == key);
                if (n > 0) return Bad($"{key} steht an {n} Knoten — erst umsetzen (Tabelle, Workflow-Wirkung).");
                var wf = c.Workflows.All.Values.Where(x => x.Transitions.Any(t => (t.Effects ?? []).Contains("status:" + key))).Select(x => x.Key).ToList();
                return wf.Count > 0 ? Bad($"{key} ist Wirkung in Workflow {string.Join(", ", wf)}.") : Results.Ok(EntryView.Of(write(Actor(req)!, Model.StatusStream + key, Types.StatusRetired, new StatusRetired(key), null)));
            });
        });

        m.MapPut("/attributes/{key}", (string key, AttributeDefinition body, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidKey, (model, write) =>
            {
                var force = string.Equals(req.Query["force"], "true", StringComparison.OrdinalIgnoreCase);
                var def = body with { Key = key, Label = body.Label ?? new(), Axes = Clean(body.Axes), Channels = Clean(body.Channels),
                                      Unit = Blank(body.Unit), Group = Blank(body.Group), List = Blank(body.List), Columns = Clean(body.Columns),
                                      Required = body.Required is { Count: > 0 } r ? r.Where(kv => kv.Value is { Length: > 0 }).ToDictionary(kv => kv.Key, kv => kv.Value) : null };
                if (def.When is { } w && (string.IsNullOrWhiteSpace(w.Attribute) || w.Values is null || w.Values.Length == 0)) return Bad("when: Attribut und mindestens ein Wert.");
                foreach (var (channel, locales) in def.Required ?? new())
                {
                    if (!model.Channels.ContainsKey(channel)) return Bad($"Pflicht für unbekannten Kanal: {channel}");
                    if (locales.Except(model.Locales.Keys).Except(["*"]).Any()) return Bad($"Pflicht für unbekannte Sprache bei {channel}");
                }
                if (def.Required is { Count: 0 }) def = def with { Required = null };
                if (!AttributeTypes.All.Contains(def.Type)) return Bad($"Unbekannter Typ: {def.Type}");
                // Was zum Typ nicht passt, fällt stillschweigend weg (Taloan, 17.09.: kein Fehler für Felder, die nicht infrage kommen) —
                // ein Typwechsel nimmt Muster, Einheit, Werteliste, Spalten, Achsen, mehrfach mit, wo sie nicht gelten.
                var number = def.Type is AttributeTypes.Integer or AttributeTypes.Decimal;
                def = def with
                {
                    Pattern = def.Type == AttributeTypes.Text ? Blank(body.Pattern) : null,
                    PatternHint = def.Type == AttributeTypes.Text ? Blank(body.PatternHint) : null,
                    Unit = number ? def.Unit : null,
                    List = def.Type == AttributeTypes.Enum ? def.List : null,
                    Columns = def.Type == AttributeTypes.Rows ? def.Columns : null,
                    Multiple = def.Multiple && def.Type is not (AttributeTypes.Rows or AttributeTypes.Formula or AttributeTypes.Boolean or AttributeTypes.Html),
                    // eindeutig nur, wo ein Wert je Knoten steht: Text/Zahl, einwertig — Zeilen, Formeln, Vorlagen, Ja/Nein, HTML nicht
                    Unique = def.Unique && (def.Type is AttributeTypes.Text or AttributeTypes.Integer or AttributeTypes.Decimal) && !def.Multiple,
                    Axes = def.Type == AttributeTypes.Rows ? null : def.Type == AttributeTypes.Formula ? Clean(def.Axes?.Where(a => a == Axes.Locale).ToArray()) : def.Axes,
                };
                if (def.Pattern is not null)
                {
                    try { _ = new System.Text.RegularExpressions.Regex(def.Pattern, System.Text.RegularExpressions.RegexOptions.None, TimeSpan.FromMilliseconds(200)); }
                    catch (ArgumentException e) { return Bad($"Muster: {e.Message}"); }
                }
                if (def.Axes?.Except([Axes.Locale, Axes.Channel]).Any() ?? false) return Bad("Achsen: nur locale und channel.");
                if (def.Channels?.Except(model.Channels.Keys).Any() ?? false) return Bad("Unbekannter Kanal in channels.");
                // Ein Typwechsel darf unvollständig sein (Taloan, 17.09.: Durchschalten ohne Fehler) — enum ohne Liste, rows ohne Spalten;
                // Werte setzen geht dann noch nicht, das Modell zeigt den fehlenden Teil an.
                if (def.List is not null && !model.Lists.ContainsKey(def.List)) return Bad($"Werteliste {def.List} gibt es nicht.");
                if (def.Unit is not null && !model.Units.ContainsKey(def.Unit)) return Bad($"Unbekannte Einheit: {def.Unit} — unter Einheiten anlegen.");
                // Typwechsel mit Bestand (Taloan, 21.09.: „ich kann wirklich den Datentyp ändern, obwohl schon Werte erfasst sind?“): erst gegen die
                // vorhandenen Werte prüfen — was zum neuen Typ (oder ohne die Achse) nicht mehr passt, wird gezählt und der Wechsel verweigert;
                // ?force=true schreibt trotzdem (die Werte bleiben im Journal, lesen sie sich dann als Text ohne Prüfung — die Datenanalyse findet sie)
                // eindeutig einschalten mit Doppelten im Bestand: kein force — das Merkmal wäre sonst eine Lüge
                if (model.Attributes.TryGetValue(key, out var b0) && !b0.Unique && def.Unique && Clash(c, model, b0 with { Unique = false }, b0 with { Unique = true }) is { Count: > 0 } dup)
                    return Bad($"{dup.Count} Werte von {key} sind nicht eindeutig — z. B. {string.Join(" · ", dup.Examples)}. Erst bereinigen (Suche attr:{key}).");
                if (model.Attributes.TryGetValue(key, out var before) && !force && Clash(c, model, before, def with { Unique = before.Unique }) is { Count: > 0 } clash)
                    return Results.BadRequest(new { error = $"{clash.Count} vorhandene Werte passen nicht zur neuen Definition — z. B. {string.Join(" · ", clash.Examples)}. Erst die Werte bereinigen (Suche attr:{key}), oder mit force=true trotzdem ändern.", count = clash.Count, examples = clash.Examples, force = true });
                if (def.Type == AttributeTypes.Rows)
                {
                    foreach (var col in def.Columns ?? [])
                    {
                        if (!model.Attributes.TryGetValue(col, out var cd)) return Bad($"Spalte {col}: kein Attribut.");
                        if (cd.Type == AttributeTypes.Rows) return Bad($"Spalte {col}: keine Zeilen in Zeilen.");
                    }
                }
                return write(Model.AttributeStream + key, Types.AttributeDefined, def);
            }));

        m.MapDelete("/attributes/{key}", (string key, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            return c.With((model, tree, write) =>
                !model.Attributes.ContainsKey(key) ? Results.NotFound()
                // Sperre: solange das Attribut irgendwo das Sternchen trägt, verlöre der Baum dort seine Namen.
                : tree.WithLabelAttribute(key).FirstOrDefault() is { } n
                    ? Bad($"{key} ist ★ Name im Baum ab {NodeRow.LabelOf(tree, model, n)} ({n.Id}) — erst dort das Sternchen umsetzen.")
                    : Results.Ok(EntryView.Of(write(actor, Model.AttributeStream + key, Types.AttributeRetired, new AttributeRetired(key), null))));
        });

        m.MapPut("/lists/{key}", (string key, ListDefinition body, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidKey, (model, write) =>
            {
                var cols = Clean(body.Columns);
                if (cols?.Any(x => !ValidKey(x)) ?? false) return Bad("Spalten: nur a-z, 0-9, _.");
                return write(Model.ListStream + key, Types.ListDefined, body with { Key = key, Label = body.Label ?? new(), Columns = cols });
            }));

        // Werteliste zurückziehen: kein Attribut darf sie benutzen
        m.MapDelete("/lists/{key}", (string key, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidKey, (model, write) =>
                !model.Lists.ContainsKey(key) ? Results.NotFound()
                : model.Attributes.Values.Any(a => a.List == key) ? Bad($"{key} wird benutzt von: {string.Join(", ", model.Attributes.Values.Where(a => a.List == key).Select(a => a.Key))}")
                : write(Model.ListStream + key, Types.ListRetired, new ListRetired(key))));

        m.MapPut("/lists/{key}/values/{value}", (string key, string value, ListValueDefinition body, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidKey, (model, write) =>
                model.Lists.ContainsKey(key) && model.Lists[key].Closed && !Auth.Has(req, c, Rights.Model) ? Bad($"Werteliste {key} ist geschlossen — Werte kommen aus der Quelle (Modell-Recht nötig).")
                : model.Lists.ContainsKey(key)
                    ? write(Model.ListStream + key, Types.ListValueDefined, body with { Value = value, Label = body.Label ?? new() })
                    : Bad($"Werteliste {key} gibt es nicht.")));

        // Sammel-PUT: [ { value, label, extra? }, … ] — ein Stapel (etim: alle Klassen einer Version als Werte der Liste ETIM-Klasse)
        m.MapPut("/lists/{key}/values", (string key, ListValueDefinition[] body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (!ValidKey(key)) return Bad("Schlüssel ungültig.");
            if (!c.ReadModel(m => m.Lists.ContainsKey(key))) return Bad($"Werteliste {key} gibt es nicht.");
            if (c.ReadModel(m => m.Lists[key].Closed) && !Auth.Has(req, c, Rights.Model)) return Bad($"Werteliste {key} ist geschlossen — Werte kommen aus der Quelle (Modell-Recht nötig).");
            var items = body.Where(v => !string.IsNullOrWhiteSpace(v.Value)).Select(v => (Model.ListStream + key, Types.ListValueDefined, (object)(v with { Label = v.Label ?? new() }))).ToList();
            if (items.Count == 0) return Bad("Leer.");
            var entries = c.WriteMany(actor, items, Guid.NewGuid().ToString("N")[..12]);
            return Results.Ok(new { count = entries.Count, last = EntryView.Of(entries[^1]) });
        });
        m.MapDelete("/lists/{key}/values/{value}", (string key, string value, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidKey, (model, write) =>
                model.Lists.TryGetValue(key, out var list) && list.Values.ContainsKey(value)
                    ? write(Model.ListStream + key, Types.ListValueRetired, new ListValueRetired(value))
                    : Results.NotFound()));

        m.MapPut("/groups/{key}", (string key, AttributeGroupDefinition body, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidKey, (model, write) =>
            {
                var from = Blank(body.ActiveFrom);
                if (from is not null && !Roles.All.Contains(from)) return Bad($"activeFrom: {string.Join(", ", Roles.All)} oder leer.");
                return write(Model.GroupStream + key, Types.AttributeGroupDefined, body with { Key = key, Label = body.Label ?? new(), ActiveFrom = from, Order = null });
            }));

        m.MapDelete("/groups/{key}", (string key, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidKey, (model, write) =>
                !model.Groups.ContainsKey(key) ? Results.NotFound()
                : model.Attributes.Values.Any(a => a.Group == key) ? Bad($"{key} hat noch Attribute.")
                : write(Model.GroupStream + key, Types.AttributeGroupRetired, new AttributeGroupRetired(key))));

        m.MapPut("/views/{key}", (string key, ViewDefinition body, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidKey, (model, write) =>
            {
                var def = body with { Key = key, Label = body.Label ?? new(), Items = body.Items ?? new(), Level = Blank(body.Level) ?? "" };
                if (!Roles.All.Contains(def.Level)) return Bad($"Eine Sicht gilt für einen Knotentyp: {string.Join(", ", Roles.All)}.");
                foreach (var it in def.Items)
                {
                    if (string.IsNullOrWhiteSpace(it.Group)) return Bad("Sicht-Eintrag ohne group.");
                    if (!model.Groups.ContainsKey(it.Group) && !model.Attributes.Values.Any(a => a.Group == it.Group)) return Bad($"Unbekannte Gruppe in der Sicht: {it.Group}");
                    if (it.Order?.Except(model.Attributes.Keys).Any() ?? false) return Bad($"Reihenfolge in {it.Group} nennt ein unbekanntes Attribut.");
                }
                if (def.Items.Select(i => i.Group).Distinct().Count() != def.Items.Count) return Bad("Eine Gruppe nur einmal je Sicht.");
                return write(Model.ViewStream + key, Types.ViewDefined, def);
            }));

        m.MapDelete("/views/{key}", (string key, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidKey, (model, write) =>
                model.Views.ContainsKey(key) ? write(Model.ViewStream + key, Types.ViewRetired, new ViewRetired(key)) : Results.NotFound()));

        m.MapPut("/units/{key}", (string key, UnitDefinition body, HttpRequest req, Catalog c) =>
            key.Length is 0 or > 8 || key.Any(char.IsWhiteSpace) ? Bad($"Einheit „{key}“: das Symbol ist der Schlüssel — höchstens 8 Zeichen, kein Leerraum.") :
            Command(req, c, key, _ => true, (model, write) =>
                string.IsNullOrWhiteSpace(body.Quantity) ? Bad("quantity fehlt (mass, length, volume, data, count, …).")
                : body.Factor <= 0 ? Bad("factor muss > 0 sein.")
                : write(Model.UnitStream + key, Types.UnitDefined, body with { Key = key, Label = body.Label ?? new(), Quantity = body.Quantity.Trim().ToLowerInvariant() })));

        // Wörterbuch (9): Begriff → Text je Sprache — Glossar und Gedächtnis der Übersetzung (Taloan, 21.09.)
        m.MapGet("/terms", (Catalog c) => c.With((model, _, _) => model.Terms.Values.OrderBy(t => t.Key).Select(t => new { t.Key, text = t.Text, t.Note, t.LastNumber }).ToList()));
        m.MapPut("/terms/{key}", (string key, TermDefined body, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidKey, (model, write) =>
                body.Text is not { Count: > 0 } || body.Text.Values.All(string.IsNullOrWhiteSpace) ? Bad("text: mindestens eine Sprache.")
                : write(Model.TermStream + key, Types.TermDefined, new TermDefined(new Labels(body.Text.Where(kv => !string.IsNullOrWhiteSpace(kv.Value)).ToDictionary(kv => kv.Key, kv => kv.Value.Trim())), Blank(body.Note)))));
        m.MapDelete("/terms/{key}", (string key, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidKey, (model, write) => model.Terms.ContainsKey(key) ? write(Model.TermStream + key, Types.TermRetired, new TermRetired()) : Results.NotFound()));

        m.MapDelete("/units/{key}", (string key, HttpRequest req, Catalog c) =>
            Command(req, c, key, k => true, (model, write) =>
                !model.Units.ContainsKey(key) ? Results.NotFound()
                : model.Attributes.Values.Any(a => a.Unit == key) ? Bad($"{key} wird benutzt von: {string.Join(", ", model.Attributes.Values.Where(a => a.Unit == key).Select(a => a.Key))}")
                : write(Model.UnitStream + key, Types.UnitRetired, new UnitRetired(key))));

    }

    /// <summary>Das Modell, wie die Oberfläche es braucht.</summary>
    public static object View(ModelCatalog model) => new
    {
        locales = model.Locales.Values.OrderBy(l => l.Code).ToList(),
        masterLocale = model.MasterLocale,
        masterChannel = model.MasterChannel,
        channels = model.Channels.Values.OrderBy(c => c.Key).ToList(),
        statuses = model.StatusesOrdered.ToList(),
        attributes = model.Attributes.Values.OrderBy(a => a.Group).ThenBy(a => a.Key).ToList(),
        lists = model.Lists.Values.OrderBy(l => l.Key).Select(l => new { l.Key, l.Label, columns = l.Columns ?? [], closed = l.Closed, values = l.Ordered.ToList() }).ToList(),
        units = model.Units.Values.OrderBy(u => u.Quantity).ThenByDescending(u => u.Factor).ToList(),
        views = model.Views.Values.OrderBy(v => v.Key).ToList(),
        relationTypes = model.RelationTypes.Values.OrderBy(r => r.Key).ToList(),
        // Gruppen: definierte plus die, die nur an Attributen vorkommen (z. B. „import“ aus dem Werkzeug) — mit Attributen in Reihenfolge
        groups = model.Groups.Keys.Union(model.Attributes.Values.Select(a => a.Group ?? "")).Where(g => g.Length > 0).Distinct().Order()
            .Select(g => new { key = g, label = model.Groups.GetValueOrDefault(g)?.Label ?? new Labels(), activeFrom = model.Groups.GetValueOrDefault(g)?.ActiveFrom, attributes = model.AttributesOf(g).Select(a => a.Key).ToList(), defined = model.Groups.ContainsKey(g) }).ToList(),
        types = AttributeTypes.All,
    };

    /// <summary>Vorhandene Werte (Knoten, Relationen, Medien), die zur neuen Definition nicht passen: Typ, mehrfach → einfach, Achse weg, Liste.</summary>
    public static (int Count, List<string> Examples)? Clash(Catalog c, ModelCatalog model, AttributeDefinition before, AttributeDefinition after)
    {
        var changed = before.Type != after.Type || (before.Multiple && !after.Multiple) || before.List != after.List || before.Pattern != after.Pattern
            || (before.PerLocale && !after.PerLocale) || (before.PerChannel && !after.PerChannel) || (!before.Unique && after.Unique);
        if (!changed) return null;
        var count = 0; var examples = new List<string>();
        var tree = c.With((_, t, _) => t);   // die Sperre ist schon gehalten (Command läuft in With) — Monitor ist wiedereintrittsfähig
        // eindeutig wird eingeschaltet (Taloan, 21.09.): jeder Wert, den es schon an einem anderen Knoten gibt, zählt — sonst wäre das Merkmal eine Lüge
        if (!before.Unique && after.Unique)
        {
            var ax = new Axis(before.Key, null, null); var seen = new Dictionary<string, Node>();
            foreach (var n in tree.Nodes.Values)
            {
                var v = n.Values.GetValueOrDefault(ax) ?? n.AxisValues.GetValueOrDefault(before.Key);   // Achsenwerte zählen mit (SKU als Achse)
                if (v is null) continue;
                if (seen.TryGetValue(v, out var first)) { count++; if (examples.Count < 3) examples.Add($"„{v.Truncate(40)}“ an {NodeRow.LabelOf(tree, model, first)} und {NodeRow.LabelOf(tree, model, n)}"); }
                else seen[v] = n;
            }
        }
        void Check(string where, Axis ax, string? value, string[]? values)
        {
            if (ax.Attribute != before.Key) return;
            string? why = null;
            if (ax.Locale is not null && !after.PerLocale) why = $"Sprache {ax.Locale}";
            else if (ax.Channel is not null && !after.PerChannel) why = $"Kanal {ax.Channel}";
            else if (values is not null && !after.Multiple) why = "mehrfach";
            else
            {
                var v = value; var vs = values;
                why = CheckValue(model, after, ref v, ref vs);
            }
            if (why is null) return;
            count++;
            if (examples.Count < 3) examples.Add($"{where}: „{(value ?? string.Join(", ", values ?? [])).Truncate(40)}“ ({why.Replace(before.Key + ": ", "")})");
        }
        foreach (var n in tree.Nodes.Values) { foreach (var (ax, v) in n.Values) Check(NodeRow.LabelOf(tree, model, n), ax, v, null); foreach (var (ax, vs) in n.Lists) Check(NodeRow.LabelOf(tree, model, n), ax, null, vs); }
        foreach (var r in c.Relations.All.Values) { foreach (var (ax, v) in r.Values) Check("Relation " + r.Id, ax, v, null); foreach (var (ax, vs) in r.Lists) Check("Relation " + r.Id, ax, null, vs); }
        foreach (var mm in c.Media.All.Values) { foreach (var (ax, v) in mm.Values) Check(mm.Name, ax, v, null); foreach (var (ax, vs) in mm.Lists) Check(mm.Name, ax, null, vs); }
        return (count, examples);
    }
    private static string Truncate(this string s, int n) => s.Length <= n ? s : s[..n] + "…";

    /// <summary>
    /// Prüft den Wert eines Attributs gegen seine Definition. Liefert den
    /// bereinigten Wert oder eine Fehlermeldung.
    /// </summary>
    public static string? CheckValue(ModelCatalog model, AttributeDefinition def, ref string? value, ref string[]? values)
    {
        if (def.Multiple)
        {
            values ??= string.IsNullOrWhiteSpace(value) ? [] : [value];
            value = null;
            values = values.Select(v => v.Trim()).Where(v => v.Length > 0).ToArray();
            foreach (var v in values)
                if (CheckOne(model, def, v) is { } error) return error;
            return null;
        }
        if (values is not null) return $"{def.Key} ist nicht mehrfach.";
        value = value?.Trim();
        if (string.IsNullOrEmpty(value)) { value = null; return null; }   // leer = Wert weg
        return CheckOne(model, def, value);
    }

    private static string? CheckOne(ModelCatalog model, AttributeDefinition def, string v) => def.Type switch
    {
        AttributeTypes.Integer => long.TryParse(v, NumberStyles.Integer, CultureInfo.InvariantCulture, out _) ? null : $"{def.Key}: ganze Zahl erwartet, nicht „{v}“.",
        AttributeTypes.Decimal => decimal.TryParse(v, NumberStyles.Number, CultureInfo.InvariantCulture, out _) ? null : $"{def.Key}: Zahl mit Punkt erwartet, nicht „{v}“.",
        AttributeTypes.Boolean => v is "true" or "false" ? null : $"{def.Key}: true oder false erwartet.",
        AttributeTypes.Date => DateOnly.TryParseExact(v, "yyyy-MM-dd", out _) ? null : $"{def.Key}: Datum als JJJJ-MM-TT erwartet.",
        AttributeTypes.Enum => model.Lists.TryGetValue(def.List ?? "", out var list) && list.Values.ContainsKey(v) ? null : $"{def.Key}: „{v}“ steht nicht in der Werteliste {def.List}.",
        AttributeTypes.Formula => Formula.Check(v).Error is { } fe ? $"{def.Key}: Skript — {fe}" : null,
        AttributeTypes.Text when def.Pattern is not null => Matches(def.Pattern, v) ? null : $"{def.Key}: „{v}“ passt nicht zum Muster{(def.PatternHint is not null ? " — " + def.PatternHint : " " + def.Pattern)}.",
        _ => null,
    };

    /// <summary>Ganzer Wert gegen das Muster; ein Muster, das nicht terminiert, gilt als Treffer (nie den Nutzer aussperren).</summary>
    private static bool Matches(string pattern, string v)
    {
        try { return System.Text.RegularExpressions.Regex.IsMatch(v, "^(?:" + pattern + ")$", System.Text.RegularExpressions.RegexOptions.None, TimeSpan.FromMilliseconds(200)); }
        catch (System.Text.RegularExpressions.RegexMatchTimeoutException) { return true; }
        catch (ArgumentException) { return true; }
    }

    private static IResult Command(HttpRequest req, Catalog c, string key, Func<string, bool> keyOk,
        Func<ModelCatalog, Func<string, string, object, IResult>, IResult> body)
    {
        if (Actor(req) is not { } actor) return ActorMissing();
        if (!keyOk(key)) return Bad($"Schlüssel „{key}“: nur a-z, 0-9 und _, beginnt mit Buchstabe.");
        return c.With((model, _, write) => body(model, (stream, type, payload) => Results.Ok(EntryView.Of(write(actor, stream, type, payload, null)))));
    }

    public sealed record FormulaCheck(string? Formula, string? Node = null, string? Locale = null, string? Type = null);

    public static string? Actor(HttpRequest req) =>
        req.Headers.TryGetValue("X-Actor", out var v) && !string.IsNullOrWhiteSpace(v) ? v.ToString() : null;

    public static IResult ActorMissing() => Bad("Kopf X-Actor fehlt — Name in den Einstellungen setzen.");

    public static IResult Bad(string error) => Results.BadRequest(new { error });

    public static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static string[]? Clean(string[]? a) =>
        a is null ? null : a.Select(x => x.Trim()).Where(x => x.Length > 0).Distinct().ToArray() is { Length: > 0 } r ? r : null;
}
