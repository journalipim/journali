using System.Globalization;
using System.Text.RegularExpressions;
using Journali.Core.Entries;
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

    public static bool ValidKey(string key) => KeyPattern().IsMatch(key);

    public static void Map(RouteGroupBuilder api)
    {
        var m = api.MapGroup("/model");

        m.MapGet("/", (Catalog c) => c.ReadModel(View));

        m.MapPut("/locales/{code}", (string code, LocaleDefinition body, HttpRequest req, Catalog c) =>
            Command(req, c, code, ValidKey, (model, write) =>
                write(Model.LocaleStream + code, Types.LocaleDefined, body with { Code = code })));

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

        m.MapPut("/master-locale", (MasterLocaleDefined body, HttpRequest req, Catalog c) =>
            Command(req, c, body.Code ?? "", ValidKey, (model, write) =>
                !model.Locales.ContainsKey(body.Code ?? "") ? Bad($"Sprache {body.Code} gibt es nicht.")
                : write(Model.MasterLocaleStream, Types.MasterLocaleDefined, new MasterLocaleDefined(body.Code!))));

        m.MapPut("/channels/{key}", (string key, ChannelDefinition body, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidKey, (model, write) =>
                write(Model.ChannelStream + key, Types.ChannelDefined, body with { Key = key, Label = body.Label ?? new() })));

        m.MapPut("/attributes/{key}", (string key, AttributeDefinition body, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidKey, (model, write) =>
            {
                var def = body with { Key = key, Label = body.Label ?? new(), Axes = Clean(body.Axes), Channels = Clean(body.Channels),
                                      Unit = Blank(body.Unit), Group = Blank(body.Group), List = Blank(body.List), Columns = Clean(body.Columns),
                                      Required = body.Required is { Count: > 0 } r ? r.Where(kv => kv.Value is { Length: > 0 }).ToDictionary(kv => kv.Key, kv => kv.Value) : null };
                foreach (var (channel, locales) in def.Required ?? new())
                {
                    if (!model.Channels.ContainsKey(channel)) return Bad($"Pflicht für unbekannten Kanal: {channel}");
                    if (locales.Except(model.Locales.Keys).Except(["*"]).Any()) return Bad($"Pflicht für unbekannte Sprache bei {channel}");
                }
                if (def.Required is { Count: 0 }) def = def with { Required = null };
                if (!AttributeTypes.All.Contains(def.Type)) return Bad($"Unbekannter Typ: {def.Type}");
                if (def.Axes?.Except([Axes.Locale, Axes.Channel]).Any() ?? false) return Bad("Achsen: nur locale und channel.");
                if (def.Channels?.Except(model.Channels.Keys).Any() ?? false) return Bad("Unbekannter Kanal in channels.");
                if (def.Type == AttributeTypes.Enum && (def.List is null || !model.Lists.ContainsKey(def.List))) return Bad("enum braucht eine vorhandene Werteliste.");
                if (def.Type != AttributeTypes.Enum && def.List is not null) return Bad("Nur enum hat eine Werteliste.");
                if (def.Unit is not null && def.Type is not (AttributeTypes.Integer or AttributeTypes.Decimal)) return Bad("Einheit nur bei Zahlen.");
                if (def.Unit is not null && !model.Units.ContainsKey(def.Unit)) return Bad($"Unbekannte Einheit: {def.Unit} — unter Einheiten anlegen.");
                if (def.Type == AttributeTypes.Rows)
                {
                    if (def.Columns is null) return Bad("rows braucht Spalten (columns) — jede ein Attribut.");
                    foreach (var col in def.Columns)
                    {
                        if (!model.Attributes.TryGetValue(col, out var cd)) return Bad($"Spalte {col}: kein Attribut.");
                        if (cd.Type == AttributeTypes.Rows) return Bad($"Spalte {col}: keine Zeilen in Zeilen.");
                    }
                    if (def.Multiple || def.Axes is not null) return Bad("rows hat keine Achsen und ist nicht mehrfach — das haben die Spalten.");
                }
                else if (def.Columns is not null) return Bad("Spalten nur bei rows.");
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

        m.MapPut("/lists/{key}/values/{value}", (string key, string value, ListValueDefinition body, HttpRequest req, Catalog c) =>
            Command(req, c, key, ValidKey, (model, write) =>
                model.Lists.ContainsKey(key)
                    ? write(Model.ListStream + key, Types.ListValueDefined, body with { Value = value, Label = body.Label ?? new() })
                    : Bad($"Werteliste {key} gibt es nicht.")));

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
            Command(req, c, key, k => k.Length > 0 && k.Length <= 8 && !k.Any(char.IsWhiteSpace), (model, write) =>
                string.IsNullOrWhiteSpace(body.Quantity) ? Bad("quantity fehlt (mass, length, volume, data, count, …).")
                : body.Factor <= 0 ? Bad("factor muss > 0 sein.")
                : write(Model.UnitStream + key, Types.UnitDefined, body with { Key = key, Label = body.Label ?? new(), Quantity = body.Quantity.Trim().ToLowerInvariant() })));

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
        channels = model.Channels.Values.OrderBy(c => c.Key).ToList(),
        attributes = model.Attributes.Values.OrderBy(a => a.Group).ThenBy(a => a.Key).ToList(),
        lists = model.Lists.Values.OrderBy(l => l.Key).Select(l => new { l.Key, l.Label, columns = l.Columns ?? [], values = l.Ordered.ToList() }).ToList(),
        units = model.Units.Values.OrderBy(u => u.Quantity).ThenByDescending(u => u.Factor).ToList(),
        views = model.Views.Values.OrderBy(v => v.Key).ToList(),
        relationTypes = model.RelationTypes.Values.OrderBy(r => r.Key).ToList(),
        // Gruppen: definierte plus die, die nur an Attributen vorkommen (z. B. „import“ aus dem Werkzeug) — mit Attributen in Reihenfolge
        groups = model.Groups.Keys.Union(model.Attributes.Values.Select(a => a.Group ?? "")).Where(g => g.Length > 0).Distinct().Order()
            .Select(g => new { key = g, label = model.Groups.GetValueOrDefault(g)?.Label ?? new Labels(), activeFrom = model.Groups.GetValueOrDefault(g)?.ActiveFrom, attributes = model.AttributesOf(g).Select(a => a.Key).ToList(), defined = model.Groups.ContainsKey(g) }).ToList(),
        types = AttributeTypes.All,
    };

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
        _ => null,
    };

    private static IResult Command(HttpRequest req, Catalog c, string key, Func<string, bool> keyOk,
        Func<ModelCatalog, Func<string, string, object, IResult>, IResult> body)
    {
        if (Actor(req) is not { } actor) return ActorMissing();
        if (!keyOk(key)) return Bad($"Schlüssel „{key}“: nur a-z, 0-9 und _, beginnt mit Buchstabe.");
        return c.With((model, _, write) => body(model, (stream, type, payload) => Results.Ok(EntryView.Of(write(actor, stream, type, payload, null)))));
    }

    public static string? Actor(HttpRequest req) =>
        req.Headers.TryGetValue("X-Actor", out var v) && !string.IsNullOrWhiteSpace(v) ? v.ToString() : null;

    public static IResult ActorMissing() => Bad("Kopf X-Actor fehlt — Name in den Einstellungen setzen.");

    public static IResult Bad(string error) => Results.BadRequest(new { error });

    public static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static string[]? Clean(string[]? a) =>
        a is null ? null : a.Select(x => x.Trim()).Where(x => x.Length > 0).Distinct().ToArray() is { Length: > 0 } r ? r : null;
}
