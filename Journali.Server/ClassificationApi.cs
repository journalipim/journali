using System.Text.RegularExpressions;
using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Klassifikation (ETIM, GPC, …): was für jedes System gleich ist, liegt hier im Server — die Plugins lesen ihre Dateien
/// und wissen, was ein Merkmal in ihrem System ist; der Server legt dazu im Modell an, was gebraucht wird, weist eine Klasse zu
/// und sagt, ob sie danach pflegbar ist. Er kennt kein System, nur die neutrale Beschreibung, die ein Plugin schickt.
/// <para><b>Eine Klasse, eine Attributgruppe</b> (30.09.2026, docs/pflegestruktur.md 36): wer einem Knoten eine Klasse zuweist, bekommt eine
/// Attributgruppe, die so heisst wie die Klasse (<c>etim_ec002712</c>, Bezeichnung „EC002712 Name“). Die Attribute der Klasse werden
/// angelegt, wo es sie noch nicht gibt, und sonst nur dieser Gruppe zugeordnet — ein Attribut gilt in beliebig vielen Gruppen, ohne Kopie (n:m).
/// Die Gruppe hängt an dem Knoten, dem die Klasse zugewiesen wird, und gilt von dort abwärts. Dasselbe Vorgehen wie bei DPP und PPWR: eine
/// Gruppe mit ihren Attributen, die man zuordnet oder füllt. Die Gruppe des Systems (<c>etim</c>, <c>gpc</c>) trägt nur das Klassenattribut.</para>
/// <list type="bullet">
/// <item><c>POST /api/classification/ensure</c> — Gruppe des Systems, Klassenattribut mit Werteliste; auf Wunsch die Gruppen einzelner Klassen mit ihren Attributen.</item>
/// <item><c>POST /api/classification/assign</c> — dasselbe für eine Klasse, dazu die Klassengruppe an den Knoten und die Klasse als Wert.</item>
/// <item><c>POST /api/classification/clear</c> — die eigene Klasse vom Knoten nehmen, samt ihrer Gruppe.</item>
/// <item><c>POST /api/classification/migrate</c> — Bestand der früheren Bauart (eine Sammelgruppe, Attribute mit Bedingung) auf Klassengruppen umstellen.</item>
/// <item><c>POST /api/classification/readiness</c> — fehlt der Klasse am Knoten noch etwas?</item>
/// </list>
/// Wo das Modell sich ändern müsste, verlangt der Server das Modell-Recht; ist schon alles da, genügt das Schreib-Recht.
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
    /// <summary>Ein Merkmal, neutral: Typ ist decimal, boolean, text oder enum. <c>Classes</c>: alle Klassen, die es führen;
    /// <c>Target</c>: das Attribut, in dem es tatsächlich gepflegt wird, wenn das nicht <c>Key</c> ist (Zuordnung) — nur für die Bereitschaft.</summary>
    public sealed record FeatureSpec(string Key, Dictionary<string, string>? Name, string Type, UnitSpec? Unit = null, string? Pattern = null,
        string? PatternHint = null, ValueSpec[]? Values = null, string[]? Classes = null, string? Target = null);
    /// <param name="GroupOnly">nur die Gruppe: beim Einschalten eines Systems entsteht sie allein</param>
    /// <param name="ClassGroups">die Klassen, für die die Gruppen mit ihren Attributen entstehen (ein Merkmal kommt in die Gruppe jeder
    /// seiner Klassen, die hier steht); ohne Angabe entstehen nur das Klassenattribut und seine Liste</param>
    public sealed record EnsureBody(SystemSpec System, ClassSpec[]? Classes = null, FeatureSpec[]? Features = null, bool GroupOnly = false, ClassSpec[]? ClassGroups = null);
    public sealed record AssignBody(string Node, string Class, SystemSpec System, ClassSpec[]? Classes = null, FeatureSpec[]? Features = null);
    public sealed record ClearBody(string Node, SystemSpec System);
    public sealed record MigrateBody(SystemSpec System, bool DryRun = false);
    public sealed record ReadinessBody(string Node, string Group, string[]? Attributes = null);

    public sealed record Readiness(bool Ready, bool GroupExists, bool GroupOn, string[] Missing);
    public sealed record Renamed(string From, string To);
    public sealed record Ensured(string Group, string ClassAttr, int Attributes, Renamed? GroupRenamed, Renamed? ClassAttrRenamed);
    public sealed record Assigned(string Group, string ClassAttr, string ClassGroup, int Attributes, Renamed? GroupRenamed, Renamed? ClassAttrRenamed, bool GroupAttached, Readiness Readiness);
    public sealed record Cleared(string? Class, string? ClassGroup);
    public sealed record Migrated(int Groups, int Attributes, int Nodes);

    /// <summary>Auf jeder Ebene pflegbar, erbt nach unten.</summary>
    private static readonly string[] FeatureLevels = [Roles.Group, Roles.Product, Roles.Variant];
    /// <summary>Was frühere Fassungen anlegten — wird beim nächsten Durchlauf gehoben.</summary>
    private static readonly string[] OldLevels = [Roles.Product, Roles.Variant];

    public static void Map(RouteGroupBuilder api)
    {
        api.MapPost("/classification/ensure", (EnsureBody b, HttpRequest req, Catalog c) => Run(req, c, (x, mayModel) => Ensure(x, b, mayModel)));
        api.MapPost("/classification/assign", (AssignBody b, HttpRequest req, Catalog c) => Run(req, c, (x, mayModel) => Assign(x, b, mayModel)));
        api.MapPost("/classification/clear", (ClearBody b, HttpRequest req, Catalog c) => Run(req, c, (x, mayModel) => Clear(x, b, mayModel)));
        api.MapPost("/classification/migrate", (MigrateBody b, HttpRequest req, Catalog c) => Run(req, c, (x, mayModel) => Migrate(x, b, mayModel)));
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
        /// <summary>Gruppen, die dieser Plan anlegt (für Merkmale in derselben Anfrage)</summary>
        public readonly HashSet<string> NewGroups = [];
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

    /// <summary>Der Schlüssel der Gruppe einer Klasse: die Gruppe des Systems, ein Unterstrich, der Code in Kleinschrift.</summary>
    public static string ClassGroupKey(string systemGroup, string code) => $"{systemGroup}_{Regex.Replace((code ?? "").ToLowerInvariant(), "[^a-z0-9]+", "_").Trim('_')}";

    /// <summary>Gehört die Gruppe dem System? Sie tut es, wenn sie leer ist oder nur dessen Attribute und das Klassenattribut enthält.</summary>
    private static bool IsOurs(ModelCatalog model, SystemSpec s, string group)
    {
        var own = s.OwnPattern is { Length: > 0 } p ? new Regex(p) : null;
        return model.Attributes.Values.Where(a => a.Group == group).All(a => a.Key == s.ClassAttr || (own?.IsMatch(a.Key) ?? false));
    }

    /// <summary>Die Schlüssel, die in diesem Journal gelten: die gewünschten, oder — bei einer Namenskollision — die, auf die das System ausweicht.</summary>
    private static (string Group, Renamed? GroupRenamed, string ClassAttr, Renamed? ClassAttrRenamed) Resolve(ModelCatalog model, SystemSpec s)
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
        var key = s.ClassAttr;
        Renamed? ca = null;
        // ein vorhandenes Attribut dieses Schlüssels, das nicht zu uns gehört (andere Gruppe, keine Liste der Klassen), wird nicht übernommen
        if (model.Attributes.TryGetValue(key, out var a0) && !(a0.Group == g || (a0.Type == AttributeTypes.Enum && a0.List == key)))
        {
            var alt = (s.ClassAttrAlternatives ?? []).Concat([key + "_std"]).FirstOrDefault(k => !model.Attributes.ContainsKey(k)) ?? key + "_std";
            ca = new Renamed(key, alt); key = alt;
        }
        return (g, g != s.Group ? new Renamed(s.Group, g) : null, key, ca);
    }

    private static Plan PlanSystemGroup(ModelCatalog model, SystemSpec s, Plan plan)
    {
        var r = Resolve(model, s);
        plan.Group = r.Group; plan.GroupRenamed = r.GroupRenamed; plan.ClassAttr = r.ClassAttr; plan.ClassAttrRenamed = r.ClassAttrRenamed;
        var g = r.Group;
        var label = s.GroupLabel is { Count: > 0 } gl ? new Labels(gl) : new Labels { ["de"] = g, ["en"] = g };
        if (g != s.Group && s.GroupLabel is { Count: > 0 }) label = new Labels(label.ToDictionary(kv => kv.Key, kv => $"{kv.Value} ({g})"));
        if (!model.Groups.TryGetValue(g, out var have)) plan.Writes.Add((Model.GroupStream + g, Types.AttributeGroupDefined, new AttributeGroupDefinition(g, label)));
        else if (have.ActiveFrom is not null) plan.Writes.Add((Model.GroupStream + g, Types.AttributeGroupDefined, have with { ActiveFrom = null }));   // überall aktiv
        return plan;
    }

    /// <summary>Die Gruppe einer Klasse: heisst wie die Klasse (Code und Name), überall aktiv.</summary>
    private static string PlanClassGroup(ModelCatalog model, Plan plan, ClassSpec cls)
    {
        var key = ClassGroupKey(plan.Group, cls.Code);
        if (model.Groups.TryGetValue(key, out var have))
        {
            if (have.ActiveFrom is not null && plan.NewGroups.Add(key)) plan.Writes.Add((Model.GroupStream + key, Types.AttributeGroupDefined, have with { ActiveFrom = null }));
            return key;
        }
        if (!plan.NewGroups.Add(key)) return key;
        var label = new Labels(LabelsOf(model, cls.Name).ToDictionary(kv => kv.Key, kv => $"{cls.Code} {kv.Value}".Trim()));
        plan.Writes.Add((Model.GroupStream + key, Types.AttributeGroupDefined, new AttributeGroupDefinition(key, label)));
        return key;
    }

    private static void PlanClassAttr(ModelCatalog model, SystemSpec s, ClassSpec[] classes, Plan plan)
    {
        var key = plan.ClassAttr;
        var existing = model.Attributes.GetValueOrDefault(key);
        if (existing is not null && !(existing.Type == AttributeTypes.Enum && existing.List == key)) return;   // ein vorhandenes Text-/Listenattribut bleibt, wie es ist

        var label = s.ClassLabel is { Count: > 0 } cl ? new Labels(cl) : new Labels { ["de"] = key, ["en"] = key };
        model.Lists.TryGetValue(key, out var list);
        var rewrite = false;
        if (list is null) plan.Writes.Add((Model.ListStream + key, Types.ListDefined, new ListDefinition(key, label, ["group"], Closed: true)));
        else if (!(list.Columns ?? []).Contains("group"))
        {
            rewrite = true;   // Gruppe nachtragen: alle Werte neu schreiben
            plan.Writes.Add((Model.ListStream + key, Types.ListDefined, new ListDefinition(key, list.Label, [.. (list.Columns ?? []), "group"], Closed: true)));
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

    /// <summary>
    /// Die Merkmale in die Gruppen ihrer Klassen: angelegt, wo es sie nicht gibt (Heimat ist die erste Gruppe), sonst nur den Gruppen
    /// zugeordnet. <paramref name="groups"/>: Klassencode → Gruppe, für die dieser Plan arbeitet. Ein Merkmal aus der früheren Bauart
    /// (Sammelgruppe, Bedingung <c>when</c>) verliert beides: die Bedingung hielt es an Knoten zurück, die die Gruppe jetzt von selbst zurückhält.
    /// </summary>
    private static void PlanFeatures(ModelCatalog model, SystemSpec s, FeatureSpec[] features, Dictionary<string, string> groups, Plan plan)
    {
        var madeUnits = new Dictionary<string, string>();
        var done = new HashSet<string>();
        var own = s.OwnPattern is { Length: > 0 } p ? new Regex(p) : null;
        foreach (var f in features)
        {
            var key = f.Key;
            if (string.IsNullOrWhiteSpace(key) || !done.Add(key)) continue;
            var targets = (f.Classes ?? []).Where(groups.ContainsKey).Select(c => groups[c]).Distinct().Order(StringComparer.Ordinal).ToArray();
            if (targets.Length == 0 && groups.Count == 1) targets = [groups.Values.First()];
            if (targets.Length == 0) continue;
            // Ist das Merkmal einem vorhandenen Attribut zugeordnet (Target), wird dieses Attribut gepflegt: es kommt in die Gruppen der Klasse,
            // ein eigenes entsteht nicht
            if (!string.IsNullOrWhiteSpace(f.Target) && f.Target != key && model.Attributes.TryGetValue(f.Target, out var mapped))
            {
                var haveM = model.GroupsOf(f.Target).ToHashSet();
                var wantM = haveM.Union(targets).Where(g => g != mapped.Group).Order(StringComparer.Ordinal).ToArray();
                var beforeM = (model.AttributeGroups.GetValueOrDefault(f.Target) ?? []).Order(StringComparer.Ordinal).ToArray();
                if (!Same(wantM, beforeM)) plan.Writes.Add((Model.AttributeStream + f.Target, Types.AttributeGroupsSet, new AttributeGroupsSet(f.Target, wantM)));
                continue;
            }
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
                var legacy = a.When?.Attribute == plan.ClassAttr || (own?.IsMatch(key) ?? false) && a.Group == plan.Group;   // aus der früheren Bauart
                var def = a;
                if (legacy && (a.When is not null || a.Group == plan.Group)) def = def with { When = null, Group = a.Group == plan.Group ? targets[0] : a.Group };
                if (def.Levels is null || !Same(def.Levels, lv) || !def.Inheritable) def = def with { Inheritable = true, Levels = lv };
                if (def != a) plan.Writes.Add((Model.AttributeStream + key, Types.AttributeDefined, def));
                // die Gruppen, in denen es schon ist (ohne die Sammelgruppe des Systems, die es nicht mehr tragen soll), und die neuen dazu
                var have = model.GroupsOf(key).Where(g => !(legacy && g == plan.Group)).ToHashSet();
                var want = have.Union(targets).Where(g => g != def.Group).Order(StringComparer.Ordinal).ToArray();
                var before = (model.AttributeGroups.GetValueOrDefault(key) ?? []).Order(StringComparer.Ordinal).ToArray();
                if (!Same(want, before)) plan.Writes.Add((Model.AttributeStream + key, Types.AttributeGroupsSet, new AttributeGroupsSet(key, want)));
                continue;
            }
            var label = LabelsOf(model, f.Name);
            var baseDef = new AttributeDefinition(key, label, f.Type, Group: targets[0], Inheritable: true, Levels: FeatureLevels);
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
            if (targets.Length > 1) plan.Writes.Add((Model.AttributeStream + key, Types.AttributeGroupsSet, new AttributeGroupsSet(key, targets.Skip(1).ToArray())));
            plan.Attributes++;
        }
    }

    private static Plan PlanAll(ModelCatalog model, SystemSpec s, ClassSpec[] classes, FeatureSpec[] features, bool groupOnly = false, ClassSpec[]? classGroups = null)
    {
        var plan = PlanSystemGroup(model, s, new Plan());
        if (groupOnly) return plan;
        PlanClassAttr(model, s, classes, plan);
        PlanClosedLists(model, s, plan);
        var groups = new Dictionary<string, string>();
        foreach (var cls in classGroups ?? []) if (!string.IsNullOrWhiteSpace(cls.Code)) groups[cls.Code] = PlanClassGroup(model, plan, cls);
        if (groups.Count > 0) PlanFeatures(model, s, features, groups, plan);
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
        var plan = PlanAll(c.Model, b.System, b.Classes ?? [], b.Features ?? [], b.GroupOnly, b.ClassGroups);
        if (Apply(c, plan, mayModel) is { } e) return e;
        return new Answer(new Ensured(plan.Group, plan.ClassAttr, plan.Attributes, plan.GroupRenamed, plan.ClassAttrRenamed));
    }

    /// <summary>Die eigene Klasse eines Knotens (ohne die geerbte), null wenn er keine hat.</summary>
    private static string? OwnClass(Node node, string classAttr) => node.Values.TryGetValue(new Axis(classAttr, null, null), out var v) && !string.IsNullOrWhiteSpace(v) ? v : null;

    public static Answer Assign(Ctx c, AssignBody b, bool mayModel)
    {
        if (Check(b.System) is { } bad) return bad;
        if (!c.Tree.Nodes.TryGetValue(b.Node ?? "", out var node)) return Answer.Bad("Knoten gibt es nicht.");
        if (string.IsNullOrWhiteSpace(b.Class)) return Answer.Bad("Klasse fehlt.");
        // die zugewiesene Klasse gehört in jedem Fall in die Werteliste und bekommt ihre Gruppe
        var self = b.Classes?.FirstOrDefault(x => x.Code == b.Class) ?? new ClassSpec(b.Class, new() { ["de"] = b.Class });
        var classes = (b.Classes ?? []).Where(x => x.Code != b.Class).Append(self).ToArray();
        var plan = PlanAll(c.Model, b.System, classes, b.Features ?? [], false, [self]);
        if (Apply(c, plan, mayModel) is { } e) return e;
        var classGroup = ClassGroupKey(plan.Group, b.Class);

        // Die Gruppe des Systems (sie trägt das Klassenattribut) am Pfad des Knotens — hängt sie nirgends darüber, kommt sie an die Wurzel dieses Baums
        var attached = false;
        if (!c.Tree.EffectiveGroups(node).Any(x => x.Group == plan.Group))
        {
            var top = node;
            while (top.Parent is { } p && c.Tree.Nodes.TryGetValue(p, out var up)) top = up;
            var r = Commands.AttachGroups(c, top.Id, [.. top.Groups, plan.Group]);
            if (r.Entry is null) return Answer.Of(r, "Gruppe anhängen schlug fehl.");
            attached = true;
        }
        // Die Gruppe der Klasse an den Knoten; die der bisherigen eigenen Klasse geht dabei weg
        var old = OwnClass(node, plan.ClassAttr);
        var geerbt = c.Tree.EffectiveGroups(node).Any(x => x.Group == classGroup && x.From.Id != node.Id);
        var groups = node.Groups.Where(g => old is null || old == b.Class || g != ClassGroupKey(plan.Group, old)).ToList();
        if (!geerbt && !groups.Contains(classGroup)) groups.Add(classGroup);
        if (!groups.ToHashSet().SetEquals(node.Groups))
        {
            var r = Commands.AttachGroups(c, node.Id, groups.ToArray());
            if (r.Entry is null) return Answer.Of(r, "Gruppe anhängen schlug fehl.");
            attached = true;
        }
        var set = Commands.SetAttribute(c, node.Id, plan.ClassAttr, null, null, b.Class, null);
        if (set.Entry is null) return Answer.Of(set, "Klasse setzen schlug fehl.");
        var readiness = ReadinessOf(c.Model, c.Tree, c.Tree.Nodes[node.Id], classGroup, (b.Features ?? []).Select(f => f.Target ?? f.Key).ToArray());
        return new Answer(new Assigned(plan.Group, plan.ClassAttr, classGroup, plan.Attributes, plan.GroupRenamed, plan.ClassAttrRenamed, attached, readiness));
    }

    /// <summary>Die eigene Klasse vom Knoten nehmen — samt der Gruppe dieser Klasse. Danach gilt die geerbte Klasse, sonst keine.</summary>
    public static Answer Clear(Ctx c, ClearBody b, bool mayModel)
    {
        if (Check(b.System) is { } bad) return bad;
        if (!c.Tree.Nodes.TryGetValue(b.Node ?? "", out var node)) return Answer.Bad("Knoten gibt es nicht.");
        var r = Resolve(c.Model, b.System);
        var old = OwnClass(node, r.ClassAttr);
        if (old is null) return new Answer(new Cleared(null, null));
        var classGroup = ClassGroupKey(r.Group, old);
        var set = Commands.SetAttribute(c, node.Id, r.ClassAttr, null, null, "", null);
        if (set.Entry is null) return Answer.Of(set, "Klasse entfernen schlug fehl.");
        if (node.Groups.Contains(classGroup))
        {
            var g = Commands.AttachGroups(c, node.Id, node.Groups.Where(x => x != classGroup).ToArray());
            if (g.Entry is null) return Answer.Of(g, "Gruppe abnehmen schlug fehl.");
        }
        return new Answer(new Cleared(old, classGroup));
    }

    /// <summary>
    /// Bestand der früheren Bauart umstellen: Attribute mit Bedingung auf das Klassenattribut (<c>when</c>) kommen in die Gruppe jeder Klasse,
    /// die sie nennt, und verlieren Bedingung und Sammelgruppe; jede Klasse, die ein Knoten als eigenen Wert trägt, bekommt ihre Gruppe an diesem
    /// Knoten. <c>DryRun</c> zählt nur.
    /// </summary>
    public static Answer Migrate(Ctx c, MigrateBody b, bool mayModel)
    {
        if (Check(b.System) is { } bad) return bad;
        var model = c.Model;
        var plan = PlanSystemGroup(model, b.System, new Plan());
        var list = model.Lists.GetValueOrDefault(plan.ClassAttr);
        Dictionary<string, string> NameOfClass(string code) => list?.Values.GetValueOrDefault(code)?.Label is { } l ? new(l) : new() { ["de"] = code };
        var alt = model.Attributes.Values.Where(a => a.When?.Attribute == plan.ClassAttr).OrderBy(a => a.Key, StringComparer.Ordinal).ToList();
        var classes = alt.SelectMany(a => a.When!.Values).Distinct().Order(StringComparer.Ordinal).ToList();
        var groups = new Dictionary<string, string>();
        foreach (var code in classes) groups[code] = PlanClassGroup(model, plan, new ClassSpec(code, NameOfClass(code)));
        // die Merkmale: jedes in die Gruppen seiner Klassen
        PlanFeatures(model, b.System, alt.Select(a => new FeatureSpec(a.Key, null, a.Type, Classes: a.When!.Values, Target: a.Key)).ToArray(), groups, plan);
        var nodes = c.Tree.Nodes.Values.Select(n => (n, code: OwnClass(n, plan.ClassAttr))).Where(x => x.code is not null).ToList();
        if (b.DryRun) return new Answer(new Migrated(groups.Count, alt.Count, nodes.Count));
        if (Apply(c, plan, mayModel) is { } e) return e;
        var n2 = 0;
        foreach (var (n, code) in nodes)
        {
            var key = ClassGroupKey(plan.Group, code!);
            if (n.Groups.Contains(key) || c.Tree.EffectiveGroups(n).Any(x => x.Group == key)) continue;
            var r = Commands.AttachGroups(c, n.Id, [.. n.Groups, key]);
            if (r.Entry is not null) n2++;
        }
        return new Answer(new Migrated(groups.Count, alt.Count, n2));
    }

    /// <summary>Ist die Klasse am Knoten pflegbar? Die Gruppe der Klasse gibt es, sie gilt hier, und jedes Merkmal hat sein Attribut in ihr.</summary>
    public static Readiness ReadinessOf(ModelCatalog model, Tree tree, Node node, string group, string[] attributes)
    {
        var exists = model.Groups.ContainsKey(group);
        var on = tree.EffectiveGroups(node).Any(x => x.Group == group) && model.GroupActiveAt(group, node.Role);
        var missing = attributes.Where(a => !model.Attributes.ContainsKey(a) || !model.GroupsOf(a).Contains(group)).Distinct().ToArray();
        return new Readiness(exists && on && missing.Length == 0, exists, on, missing);
    }
}
