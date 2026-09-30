using System.Text.RegularExpressions;
using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Klassifikation (ETIM, eCl@ss, …): was für jedes System gleich ist, liegt hier im Server — die Plugins lesen ihre Dateien
/// und wissen, was ein Merkmal in ihrem System ist; der Server legt dazu im Modell an, was gebraucht wird, weist eine Klasse zu
/// und sagt, ob sie danach pflegbar ist. Er kennt kein System, nur die neutrale Beschreibung, die ein Plugin schickt.
/// <list type="bullet">
/// <item><c>POST /api/classification/ensure</c> — Gruppe des Systems, Klassenattribut mit Werteliste, Merkmalsattribute.</item>
/// <item><c>POST /api/classification/assign</c> — dasselbe, dazu die Gruppe an den Pfad des Knotens, die Klasse an den Knoten.</item>
/// <item><c>POST /api/classification/readiness</c> — fehlt der Klasse am Knoten noch etwas?</item>
/// </list>
/// Wo das Modell sich ändern müsste, verlangt der Server das Modell-Recht; ist schon alles da, genügt das Schreib-Recht.
/// Die Merkmale gelten auf jeder Ebene und vererben nach unten; die Bedingung (<c>when</c>) hält sie dort zurück, wo die Klasse
/// sie nicht führt. Die Klasse darf an jeder Ebene stehen.
/// </summary>
public static class ClassificationApi
{
    /// <summary>Das System: Schlüssel der Attributgruppe und des Klassenattributs, deren Bezeichnungen, Ausweichnamen bei einer
    /// Namenskollision und das Muster der Attributschlüssel, die dem System gehören (nur an ihnen erkennt der Server „unsere“ Gruppe).</summary>
    public sealed record SystemSpec(string Group, Dictionary<string, string>? GroupLabel, string ClassAttr, Dictionary<string, string>? ClassLabel,
        string[]? ClassAttrAlternatives = null, string? OwnPattern = null);
    /// <summary>Eine Klasse: Code, Namen je Sprache und der Text der Oberklasse (Spalte „group“ der Werteliste).</summary>
    public sealed record ClassSpec(string Code, Dictionary<string, string>? Name, string? Section = null);
    public sealed record UnitSpec(string Code, Dictionary<string, string>? Abbr, Dictionary<string, string>? Name);
    public sealed record ValueSpec(string Code, Dictionary<string, string>? Name);
    /// <summary>Ein Merkmal, neutral: Typ ist decimal, boolean, text oder enum. <c>Classes</c>: alle Klassen, die es führen (Bedingung);
    /// <c>Target</c>: das Attribut, in dem es tatsächlich gepflegt wird, wenn das nicht <c>Key</c> ist (Zuordnung) — nur für die Bereitschaft.</summary>
    public sealed record FeatureSpec(string Key, Dictionary<string, string>? Name, string Type, UnitSpec? Unit = null, string? Pattern = null,
        string? PatternHint = null, ValueSpec[]? Values = null, string[]? Classes = null, string? Target = null);
    /// <param name="GroupOnly">nur die Gruppe: beim Einschalten eines Systems entsteht sie allein, die Attribute erst mit der ersten Klasse</param>
    public sealed record EnsureBody(SystemSpec System, ClassSpec[]? Classes = null, FeatureSpec[]? Features = null, bool GroupOnly = false);
    public sealed record AssignBody(string Node, string Class, SystemSpec System, ClassSpec[]? Classes = null, FeatureSpec[]? Features = null);
    public sealed record ReadinessBody(string Node, string Group, string[]? Attributes = null);

    public sealed record Readiness(bool Ready, bool GroupExists, bool GroupOn, string[] Missing);
    public sealed record Renamed(string From, string To);
    public sealed record Ensured(string Group, string ClassAttr, int Attributes, Renamed? GroupRenamed, Renamed? ClassAttrRenamed);
    public sealed record Assigned(string Group, string ClassAttr, int Attributes, Renamed? GroupRenamed, Renamed? ClassAttrRenamed, bool GroupAttached, Readiness Readiness);

    /// <summary>Auf jeder Ebene pflegbar, erbt nach unten.</summary>
    private static readonly string[] FeatureLevels = [Roles.Group, Roles.Product, Roles.Variant];
    /// <summary>Was frühere Fassungen anlegten — wird beim nächsten Durchlauf gehoben.</summary>
    private static readonly string[] OldLevels = [Roles.Product, Roles.Variant];

    public static void Map(RouteGroupBuilder api)
    {
        api.MapPost("/classification/ensure", (EnsureBody b, HttpRequest req, Catalog c) =>
            Run(req, c, (x, mayModel) => Ensure(x, b, mayModel)));
        api.MapPost("/classification/assign", (AssignBody b, HttpRequest req, Catalog c) =>
            Run(req, c, (x, mayModel) => Assign(x, b, mayModel)));
        api.MapPost("/classification/readiness", (ReadinessBody b, Catalog c) =>
            c.Lesen((model, tree) => tree.Nodes.TryGetValue(b.Node ?? "", out var n) ? Results.Ok(ReadinessOf(model, tree, n, b.Group, b.Attributes ?? [])) : Results.NotFound()));
    }

    /// <summary>Antwort eines Befehls: ein Ergebnis oder ein Fehler mit Vorlage (die Oberfläche übersetzt sie).</summary>
    public sealed record Answer(object? Ok, string? Error = null, string[]? Args = null)
    {
        public static Answer Bad(string template, params object?[] args) => new(null, template, args.Select(a => a?.ToString() ?? "").ToArray());
        /// <summary>Der Fehler eines Befehls mit seiner Vorlage, damit die Oberfläche ihn übersetzt.</summary>
        public static Answer Of(Outcome o, string fallback) => o.Template is { } t ? new(null, t, o.Args ?? []) : Bad("{0}", o.Error ?? fallback);
    }

    private static IResult Run(HttpRequest req, Catalog c, Func<Ctx, bool, Answer> f)
    {
        if (Actor(req) is not { } actor) return ActorMissing();
        var mayModel = Auth.Has(req, c, Rights.Model);
        var a = c.With((model, tree, write) => f(new Ctx
        {
            Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Workflows = c.Workflows, Translations = c.Translations,
            Role = req.HttpContext.Items["role"] as string,
            Write = (stream, type, payload) => write(actor, stream, type, payload, null),
        }, mayModel));
        return a.Error is { } e ? Bad(e, a.Args ?? []) : Results.Ok(a.Ok);
    }

    // ---- Der Plan: was im Modell zu schreiben ist. Er rechnet nur gegen das Modell, wie es ist — so lässt sich das Recht
    // prüfen, bevor etwas geschrieben wird.

    private sealed class Plan
    {
        public readonly List<(string Stream, string Type, object Payload)> Writes = [];
        public string Group = "", ClassAttr = "";
        public Renamed? GroupRenamed, ClassAttrRenamed;
        public int Attributes;
    }

    private static string NameOf(Dictionary<string, string>? names, string locale) =>
        names is null ? "" : names.GetValueOrDefault(locale) ?? names.GetValueOrDefault("de") ?? names.GetValueOrDefault("en") ?? names.Values.FirstOrDefault() ?? "";

    /// <summary>Bezeichnung je Sprache des Modells; fehlt die Leitsprache, steht dort der Name, den es gibt (ETIM International: nur Englisch) —
    /// sonst zeigt die Oberfläche den Schlüssel.</summary>
    private static Labels LabelsOf(ModelCatalog model, Dictionary<string, string>? names)
    {
        var locale = model.MasterLocale ?? "de";
        var o = new Labels();
        foreach (var l in model.Locales.Keys) if (names is not null && names.TryGetValue(l, out var n) && !string.IsNullOrEmpty(n)) o[l] = n;
        if (!o.ContainsKey(locale)) o[locale] = NameOf(names, locale);
        return o;
    }

    private static bool Same(string[]? a, string[]? b) => (a ?? []).SequenceEqual(b ?? []);

    /// <summary>Gehört die Gruppe dem System? Sie tut es, wenn sie leer ist oder nur dessen Attribute und das Klassenattribut enthält.</summary>
    private static bool IsOurs(ModelCatalog model, SystemSpec s, string group)
    {
        var own = s.OwnPattern is { Length: > 0 } p ? new Regex(p) : null;
        return model.Attributes.Values.Where(a => a.Group == group).All(a => a.Key == s.ClassAttr || (own?.IsMatch(a.Key) ?? false));
    }

    private static Plan PlanGroup(ModelCatalog model, SystemSpec s, Plan plan)
    {
        // freier Gruppenschlüssel: der gewünschte, wenn er frei oder unserer ist — sonst <gruppe>_std, <gruppe>_std2 …
        string Free()
        {
            if (!model.Groups.ContainsKey(s.Group) || IsOurs(model, s, s.Group)) return s.Group;
            for (var i = 0; i < 20; i++)
            {
                var k = i == 0 ? s.Group + "_std" : $"{s.Group}_std{i + 1}";
                if (!model.Groups.ContainsKey(k) || IsOurs(model, s, k)) return k;
            }
            return s.Group;
        }
        var g = Free();
        plan.Group = g;
        if (g != s.Group) plan.GroupRenamed = new Renamed(s.Group, g);
        var label = s.GroupLabel is { Count: > 0 } gl ? new Labels(gl) : new Labels { ["de"] = g, ["en"] = g };
        if (g != s.Group && s.GroupLabel is { Count: > 0 }) label = new Labels(label.ToDictionary(kv => kv.Key, kv => $"{kv.Value} ({g})"));
        if (!model.Groups.TryGetValue(g, out var have)) plan.Writes.Add((Model.GroupStream + g, Types.AttributeGroupDefined, new AttributeGroupDefinition(g, label)));
        else if (have.ActiveFrom is not null) plan.Writes.Add((Model.GroupStream + g, Types.AttributeGroupDefined, have with { ActiveFrom = null }));   // überall aktiv
        return plan;
    }

    private static void PlanClassAttr(ModelCatalog model, SystemSpec s, ClassSpec[] classes, Plan plan)
    {
        var key = s.ClassAttr;
        // Kollision: ein vorhandenes Attribut dieses Schlüssels, das nicht zu uns gehört (andere Gruppe, keine Liste der Klassen), wird nicht übernommen
        if (model.Attributes.TryGetValue(key, out var a0) && !(a0.Group == plan.Group || (a0.Type == AttributeTypes.Enum && a0.List == key)))
        {
            var alt = (s.ClassAttrAlternatives ?? []).Concat([key + "_std"]).FirstOrDefault(k => !model.Attributes.ContainsKey(k)) ?? key + "_std";
            plan.ClassAttrRenamed = new Renamed(key, alt);
            key = alt;
        }
        plan.ClassAttr = key;
        var existing = model.Attributes.GetValueOrDefault(key);
        if (existing is not null && !(existing.Type == AttributeTypes.Enum && existing.List == key)) return;   // ein vorhandenes Text-/Listenattribut bleibt, wie es ist

        var label = s.ClassLabel is { Count: > 0 } cl ? new Labels(cl) : new Labels { ["de"] = key, ["en"] = key };
        model.Lists.TryGetValue(key, out var list);
        var rewrite = false;
        string[] columns;
        if (list is null) { columns = ["group"]; plan.Writes.Add((Model.ListStream + key, Types.ListDefined, new ListDefinition(key, label, columns, Closed: true))); }
        else
        {
            columns = list.Columns ?? [];
            if (!(list.Columns ?? []).Contains("group")) { columns = [.. (list.Columns ?? []), "group"]; rewrite = true; plan.Writes.Add((Model.ListStream + key, Types.ListDefined, new ListDefinition(key, list.Label, columns, Closed: true))); }   // Gruppe nachtragen: alle Werte neu schreiben
        }
        var have = rewrite || list is null ? new HashSet<string>() : list.Values.Keys.ToHashSet();
        foreach (var cls in classes.Where(x => !string.IsNullOrWhiteSpace(x.Code) && !have.Contains(x.Code)).OrderBy(x => x.Code, StringComparer.Ordinal))
        {
            if (!have.Add(cls.Code)) continue;
            plan.Writes.Add((Model.ListStream + key, Types.ListValueDefined, new ListValueDefinition(cls.Code, LabelsOf(model, cls.Name),
                string.IsNullOrEmpty(cls.Section) ? null : new Dictionary<string, string> { ["group"] = cls.Section })));
        }
        if (existing is null) plan.Writes.Add((Model.AttributeStream + key, Types.AttributeDefined, new AttributeDefinition(key, label, AttributeTypes.Enum, Group: plan.Group, List: key, Inheritable: true)));
        else if (existing.Levels is not null) plan.Writes.Add((Model.AttributeStream + key, Types.AttributeDefined, existing with { Levels = null }));   // die Klasse darf an jeder Ebene stehen
    }

    /// <summary>Die Werteliste eines Merkmals ist Norm: geschlossen.</summary>
    private static void PlanClosedLists(ModelCatalog model, SystemSpec s, Plan plan)
    {
        var own = s.OwnPattern is { Length: > 0 } p ? new Regex(p) : null;
        foreach (var l in model.Lists.Values.Where(l => !l.Closed && (l.Key == plan.ClassAttr || (own?.IsMatch(l.Key) ?? false))))
            if (!plan.Writes.Any(w => w.Stream == Model.ListStream + l.Key && w.Type == Types.ListDefined))
                plan.Writes.Add((Model.ListStream + l.Key, Types.ListDefined, new ListDefinition(l.Key, l.Label, l.Columns, Closed: true)));
    }

    private static string UnitKey(ModelCatalog model, UnitSpec u, Plan plan, Dictionary<string, string> made)
    {
        var locale = model.MasterLocale ?? "de";
        var abbr = NameOf(u.Abbr, locale); if (abbr.Length == 0) abbr = u.Code;
        var hit = model.Units.Values.FirstOrDefault(x => x.Key == abbr.ToLowerInvariant() || x.Label.Values.Any(l => l == abbr));
        if (hit is not null) return hit.Key;
        var key = ("u_" + Regex.Replace(abbr.ToLowerInvariant(), "[^a-z0-9]+", "_").TrimEnd('_'));
        if (key.Length > 30) key = key[..30];
        if (!model.Units.ContainsKey(key) && made.TryAdd(key, key))
        {
            var quantity = NameOf(u.Name, locale); if (quantity.Length == 0) quantity = abbr;
            plan.Writes.Add((Model.UnitStream + key, Types.UnitDefined, new UnitDefinition(key, new Labels { ["de"] = abbr, ["en"] = abbr }, quantity, 1)));
        }
        return key;
    }

    /// <summary>Die Bedingung: alle Klassen, die das Merkmal führen, über Fassungen hinweg vereinigt — sonst nähme ein Wechsel auf eine neuere
    /// Fassung den Klassen der älteren ihre Merkmale weg.</summary>
    private static AttributeCondition WhenOf(FeatureSpec f, AttributeCondition? have, string classAttr) =>
        new(classAttr, (have?.Attribute == classAttr ? have.Values : []).Concat(f.Classes ?? []).Distinct().Order(StringComparer.Ordinal).ToArray());

    private static void PlanFeatures(ModelCatalog model, SystemSpec s, FeatureSpec[] features, Plan plan)
    {
        var madeUnits = new Dictionary<string, string>();
        var done = new HashSet<string>();
        foreach (var f in features)
        {
            var key = f.Key;
            if (string.IsNullOrWhiteSpace(key) || !done.Add(key)) continue;
            var when = WhenOf(f, model.Attributes.GetValueOrDefault(key)?.When, plan.ClassAttr);
            if (model.Attributes.TryGetValue(key, out var a))
            {
                // Werte, die eine weitere Klasse dem Merkmal zufügt: sie gehören in die Liste (die Liste ist die Vereinigung aller Klassen)
                if (f.Type == AttributeTypes.Enum && a.List is { } listKey && model.Lists.TryGetValue(listKey, out var vl))
                {
                    var next = vl.Values.Count == 0 ? 0 : vl.Values.Values.Max(v => v.Order) + 1;
                    foreach (var v in (f.Values ?? []).Where(v => !string.IsNullOrWhiteSpace(v.Code) && !vl.Values.ContainsKey(v.Code)))
                        plan.Writes.Add((Model.ListStream + listKey, Types.ListValueDefined, new ListValueDefinition(v.Code, LabelsOf(model, v.Name), null, next++)));
                }
                var lv = a.Levels is null || Same(a.Levels.Order().ToArray(), OldLevels.Order().ToArray()) ? FeatureLevels : a.Levels;
                if (a.Group == plan.Group && (!Same(a.When?.Values, when.Values) || !a.Inheritable || !Same(a.Levels, lv)))
                    plan.Writes.Add((Model.AttributeStream + key, Types.AttributeDefined, a with { When = when, Inheritable = true, Levels = lv }));
                continue;
            }
            var label = LabelsOf(model, f.Name);
            var baseDef = new AttributeDefinition(key, label, f.Type, Group: plan.Group, When: when, Inheritable: true, Levels: FeatureLevels);
            switch (f.Type)
            {
                case AttributeTypes.Decimal: baseDef = baseDef with { Unit = f.Unit is null ? null : UnitKey(model, f.Unit, plan, madeUnits) }; break;
                case AttributeTypes.Boolean: break;
                case AttributeTypes.Text: baseDef = baseDef with { Pattern = f.Pattern, PatternHint = f.PatternHint }; break;
                case AttributeTypes.Enum:
                    if (!model.Lists.ContainsKey(key)) plan.Writes.Add((Model.ListStream + key, Types.ListDefined, new ListDefinition(key, label, null, Closed: true)));   // die Werte sind Norm: geschlossen
                    var i = 0;
                    foreach (var v in f.Values ?? []) plan.Writes.Add((Model.ListStream + key, Types.ListValueDefined, new ListValueDefinition(v.Code, LabelsOf(model, v.Name), null, i++)));
                    baseDef = baseDef with { List = key };
                    break;
                default: continue;
            }
            plan.Writes.Add((Model.AttributeStream + key, Types.AttributeDefined, baseDef));
            plan.Attributes++;
        }
    }

    private static Plan PlanAll(ModelCatalog model, SystemSpec s, ClassSpec[] classes, FeatureSpec[] features, bool groupOnly = false)
    {
        var plan = PlanGroup(model, s, new Plan());
        plan.ClassAttr = s.ClassAttr;
        if (groupOnly) return plan;
        PlanClassAttr(model, s, classes, plan);
        PlanClosedLists(model, s, plan);
        PlanFeatures(model, s, features, plan);
        return plan;
    }

    private static Answer? Check(SystemSpec? s)
    {
        if (s is null || string.IsNullOrWhiteSpace(s.Group) || string.IsNullOrWhiteSpace(s.ClassAttr)) return Answer.Bad("System: Gruppe und Klassenattribut fehlen.");
        if (!ModelApi.ValidKey(s.Group) || !ModelApi.ValidKey(s.ClassAttr)) return Answer.Bad("Schlüssel „{0}“: nur a-z, 0-9 und _, beginnt mit Buchstabe.", !ModelApi.ValidKey(s.Group) ? s.Group : s.ClassAttr);
        if (s.OwnPattern is { Length: > 0 } p)
        {
            try { _ = new Regex(p, RegexOptions.None, TimeSpan.FromMilliseconds(200)); }
            catch (ArgumentException e) { return Answer.Bad("Muster: {0}", e.Message); }
        }
        return null;
    }

    private static Answer? Apply(Ctx c, Plan plan, bool mayModel)
    {
        if (plan.Writes.Count > 0 && !mayModel) return Answer.Bad("Das Modell ändert sich ({0} Änderungen) — das verlangt das Modell-Recht.", plan.Writes.Count);
        foreach (var (stream, type, payload) in plan.Writes) c.Write(stream, type, payload);
        return null;
    }

    public static Answer Ensure(Ctx c, EnsureBody b, bool mayModel)
    {
        if (Check(b.System) is { } bad) return bad;
        var plan = PlanAll(c.Model, b.System, b.Classes ?? [], b.Features ?? [], b.GroupOnly);
        if (Apply(c, plan, mayModel) is { } e) return e;
        return new Answer(new Ensured(plan.Group, plan.ClassAttr, plan.Attributes, plan.GroupRenamed, plan.ClassAttrRenamed));
    }

    public static Answer Assign(Ctx c, AssignBody b, bool mayModel)
    {
        if (Check(b.System) is { } bad) return bad;
        if (!c.Tree.Nodes.TryGetValue(b.Node ?? "", out var node)) return Answer.Bad("Knoten gibt es nicht.");
        if (string.IsNullOrWhiteSpace(b.Class)) return Answer.Bad("Klasse fehlt.");
        // die zugewiesene Klasse gehört in jedem Fall in die Werteliste
        var classes = (b.Classes ?? []).Where(x => x.Code != b.Class).Append(b.Classes?.FirstOrDefault(x => x.Code == b.Class) ?? new ClassSpec(b.Class, new() { ["de"] = b.Class })).ToArray();
        var plan = PlanAll(c.Model, b.System, classes, b.Features ?? []);
        if (Apply(c, plan, mayModel) is { } e) return e;

        // Die Gruppe am Pfad des Knotens — hängt sie nirgends darüber, kommt sie an die Wurzel dieses Baums
        var attached = false;
        if (!c.Tree.EffectiveGroups(node).Any(x => x.Group == plan.Group))
        {
            var top = node;
            while (top.Parent is { } p && c.Tree.Nodes.TryGetValue(p, out var up)) top = up;
            var r = Commands.AttachGroups(c, top.Id, [.. top.Groups, plan.Group]);
            if (r.Entry is null) return Answer.Of(r, "Gruppe anhängen schlug fehl.");
            attached = true;
        }
        var set = Commands.SetAttribute(c, node.Id, plan.ClassAttr, null, null, b.Class, null);
        if (set.Entry is null) return Answer.Of(set, "Klasse setzen schlug fehl.");
        var readiness = ReadinessOf(c.Model, c.Tree, c.Tree.Nodes[node.Id], plan.Group, (b.Features ?? []).Select(f => f.Target ?? f.Key).ToArray());
        return new Answer(new Assigned(plan.Group, plan.ClassAttr, plan.Attributes, plan.GroupRenamed, plan.ClassAttrRenamed, attached, readiness));
    }

    /// <summary>Ist die Klasse am Knoten pflegbar? Die Gruppe gibt es, sie gilt hier, und jedes Merkmal hat sein Attribut.</summary>
    public static Readiness ReadinessOf(ModelCatalog model, Tree tree, Node node, string group, string[] attributes)
    {
        var exists = model.Groups.ContainsKey(group);
        var on = tree.EffectiveGroups(node).Any(x => x.Group == group) && model.GroupActiveAt(group, node.Role);
        var missing = attributes.Where(a => !model.Attributes.ContainsKey(a)).Distinct().ToArray();
        return new Readiness(exists && on && missing.Length == 0, exists, on, missing);
    }
}
