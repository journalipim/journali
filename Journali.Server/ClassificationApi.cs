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
/// <item><c>GET /api/classification/systems</c> und <c>POST /api/classification/retire</c> — die Klassifikationen im Modell und das Zurücknehmen einer ganzen.</item>
/// </list>
/// <para><b>Systemobjekte</b> (30.09.2026): das Plugin eines Systems sagt, wie die Gruppe und das Klassenattribut heissen, die es zum Betrieb
/// braucht (<c>plugin</c> in der Beschreibung des Systems); der Server legt sie beim Einschalten an und meldet sie im Journal an
/// (Plugin-Daten <c>system</c> des Plugins). Solange das Plugin eingeschaltet ist, braucht es sie, und das Zurückziehen fragt die Plugins: was
/// eines braucht, lässt sich nicht löschen — ohne diese Objekte kann das Plugin nicht arbeiten, es gilt alles oder nichts. Ist das Plugin aus
/// (das Ausschalten verlangt das Recht auf Plugins), nimmt man die Klassifikation als Ganzes zurück (<c>retire</c>): in allen Bäumen gehen die
/// Klassen und ihre Werte weg, mit den Gruppen der Klassen und ihren Attributen, und die Anmeldung fällt. Danach ist das Plugin „nicht bereit“
/// (<c>health</c>), bis es seine Objekte wieder anlegt.</para>
/// Wo das Modell sich ändern müsste, verlangt der Server das Modell-Recht; ist schon alles da, genügt das Schreib-Recht.
/// </summary>
public static class ClassificationApi
{
    /// <summary>Das System: Schlüssel der Attributgruppe und des Klassenattributs, deren Bezeichnungen, Ausweichnamen bei einer
    /// Namenskollision und das Muster der Attributschlüssel, die dem System gehören (nur an ihnen erkennt der Server „unsere“ Gruppe).</summary>
    public sealed record SystemSpec(string Group, Dictionary<string, string>? GroupLabel, string ClassAttr, Dictionary<string, string>? ClassLabel,
        string[]? ClassAttrAlternatives = null, string? OwnPattern = null, string? Plugin = null);
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
    public sealed record RetireBody(string Group, bool DryRun = false);
    /// <summary>Was das Zurücknehmen kostet (oder gekostet hat): Gruppen, Attribute, Knoten mit einer Klasse und die Werte, die dabei weggehen.</summary>
    public sealed record Retired(int Groups, int Attributes, int Nodes, int Values);
    /// <summary>Eine Klassifikation im Modell: die Gruppe des Systems und ihr Klassenattribut, dazu was an ihr hängt.</summary>
    public sealed record SystemInfo(string Plugin, bool Enabled, string Group, string ClassAttr, int ClassGroups);
    public sealed record RegisterBody(SystemSpec System);
    public sealed record Health(bool Ready, string? Reason);
    /// <summary>Die Systemobjekte eines Plugins: die Gruppen und Attribute, die es zum Betrieb braucht.</summary>
    public sealed record SystemBody(string[]? Groups, string[]? Attributes);
    public sealed record RegisterResult(bool Registered);

    /// <summary>Auf jeder Ebene pflegbar, erbt nach unten.</summary>
    private static readonly string[] FeatureLevels = [Roles.Group, Roles.Product, Roles.Variant];
    /// <summary>Was frühere Versionen anlegten — wird beim nächsten Durchlauf gehoben.</summary>
    private static readonly string[] OldLevels = [Roles.Product, Roles.Variant];

    public static void Map(RouteGroupBuilder api)
    {
        api.MapPost("/classification/ensure", (EnsureBody b, HttpRequest req, Catalog c) => Run(req, c, (x, mayModel) => Ensure(x, b, mayModel)));
        api.MapPost("/classification/assign", (AssignBody b, HttpRequest req, Catalog c) => Run(req, c, (x, mayModel) => Assign(x, b, mayModel)));
        api.MapPost("/classification/clear", (ClearBody b, HttpRequest req, Catalog c) => Run(req, c, (x, mayModel) => Clear(x, b, mayModel)));
        api.MapPost("/classification/migrate", (MigrateBody b, HttpRequest req, Catalog c) => Run(req, c, (x, mayModel) => Migrate(x, b, mayModel)));
        api.MapPost("/classification/retire", (RetireBody b, HttpRequest req, Catalog c) => Run(req, c, (x, mayModel) => Retire(x, b, mayModel || Auth.Has(req, c, Rights.Plugins))));   // wer das Plugin verwaltet, räumt auch seine Objekte weg
        api.MapPost("/classification/register", (RegisterBody b, HttpRequest req, Catalog c) => Run(req, c, (x, mayModel) => Register(x, b)));
        api.MapGet("/classification/systems", (Catalog c) => c.ReadModel(m => Results.Ok(Systems(m, c.Plugins).Select(s => new SystemInfo(s.Plugin, c.Plugins.All.TryGetValue(s.Plugin, out var ps) && ps.Enabled, s.Group, s.ClassAttr, ClassGroupsOf(m, s).Count)).ToList())));
        // Allgemein für jedes Plugin mit Systemobjekten (Klassifikation, Datenanalyse): anmelden und fragen, ob es arbeiten kann
        api.MapPut("/plugins/{key}/system", (string key, SystemBody b, HttpRequest req, Catalog c) => Run(req, c, (x, _) => RegisterObjects(x, key, b)));
        api.MapGet("/plugins/{key}/system/health", (string key, Catalog c) => c.ReadModel(m => Results.Ok(HealthOf(m, c.Plugins, key))));
        // Was eingeschaltete Plugins brauchen: die Oberfläche fragt vor der Rückfrage, ob sich etwas zurückziehen lässt, statt es erst zu versuchen
        api.MapGet("/classification/protected", (Catalog c) => Results.Ok(Registered(c.Plugins).Where(r => r.Enabled).Select(r => new { plugin = r.Plugin, groups = r.Groups, attributes = r.Attributes }).ToList()));
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
            Role = req.HttpContext.Items["role"] as string, Plugins = c.Plugins,
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
        /// <summary>Die Anmeldung der Systemobjekte beim Plugin (Plugin, JSON) — Plugin-Daten, kein Modell: dafür genügt das Schreib-Recht</summary>
        public (string Plugin, string Json)? Registration;
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
        plan.Registration = RegistrationOf(s, r.Group, r.ClassAttr);
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
        WriteRegistration(c, plan.Registration);
        return null;
    }

    // ---- Die Anmeldung der Systemobjekte: Plugin-Daten „system“ des Plugins, im Journal
    private static (string Plugin, string Json)? RegistrationOf(SystemSpec s, string group, string classAttr) =>
        string.IsNullOrWhiteSpace(s.Plugin) ? null
            : (s.Plugin, System.Text.Json.JsonSerializer.Serialize(new { groups = new[] { group }, attributes = new[] { classAttr }, classification = new { group, classAttr } }));

    /// <summary>Schreibt die Anmeldung, wenn sie fehlt oder anders ist.</summary>
    private static void WriteRegistration(Ctx c, (string Plugin, string Json)? r)
    {
        if (r is not { } reg) return;
        if (c.Plugins?.All.TryGetValue(reg.Plugin, out var p) == true && p.Data.TryGetValue("system", out var have) && have == reg.Json) return;
        c.Write(Plugins.Stream + reg.Plugin, Types.PluginDataSet, new PluginDataSet("system", reg.Json));
    }

    /// <summary>Was die Plugins angemeldet haben: Plugin → ob es eingeschaltet ist, die Gruppen und Attribute, die es zum Betrieb braucht, und seine Klassifikation.</summary>
    /// <summary>Die Plugins, deren Attribute vererbbar sind (07.10.2026): ihre Werte pflegt man am Produkt oder an der Gruppe, sie gelten nach unten.</summary>
    public static readonly string[] VererbbarePlugins = ["dpp", "ppwr", "geo", "etim", "gpc"];
    /// <summary>Kennungen erben nicht: eine GTIN oder Charge gilt für genau ein Produkt (im Katalog von dpp mit <c>inheritable: false</c>).</summary>
    public static readonly string[] NichtVererbbar = ["dpp_gtin", "dpp_batch"];

    /// <summary>
    /// Beim Start: die angemeldeten Attribute dieser Plugins vererbbar, wo sie es noch nicht sind — Instanzen von vorher ziehen nach. Nur Attribute, die
    /// in einer angemeldeten Gruppe des Plugins zu Hause sind; ein eigenes Attribut, das einem Plugin zugeordnet ist, bleibt, wie es ist.
    /// </summary>
    public static int PluginAttributeVererbbar(Catalog c) => c.With((model, _, write) =>
    {
        var n = 0;
        foreach (var r in Registered(c.Plugins).Where(r => VererbbarePlugins.Contains(r.Plugin)))
            foreach (var key in r.Attributes)
                if (model.Attributes.GetValueOrDefault(key) is { Inheritable: false, Unique: false } def && !NichtVererbbar.Contains(key) && def.Group is { } g && r.Groups.Contains(g))
                { write("system", Model.AttributeStream + key, Types.AttributeDefined, def with { Inheritable = true }, null); n++; }
        return n;
    });

    public static List<(string Plugin, bool Enabled, string[] Groups, string[] Attributes, string? Group, string? ClassAttr)> Registered(Plugins? plugins)
    {
        var list = new List<(string, bool, string[], string[], string?, string?)>();
        foreach (var p in plugins?.All.Values ?? [])
        {
            if (!p.Data.TryGetValue("system", out var json)) continue;
            try
            {
                using var d = System.Text.Json.JsonDocument.Parse(json);
                string[] Strings(string name) => d.RootElement.TryGetProperty(name, out var a) && a.ValueKind == System.Text.Json.JsonValueKind.Array ? a.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x.Length > 0).ToArray() : [];
                string? group = null, attr = null;
                if (d.RootElement.TryGetProperty("classification", out var cl)) { group = cl.TryGetProperty("group", out var g) ? g.GetString() : null; attr = cl.TryGetProperty("classAttr", out var a) ? a.GetString() : null; }
                list.Add((p.Key, p.Enabled, Strings("groups"), Strings("attributes"), group, attr));
            }
            catch (System.Text.Json.JsonException) { /* eine unlesbare Anmeldung schützt nichts */ }
        }
        return list;
    }

    /// <summary>Das eingeschaltete Plugin, das dieses Objekt (<c>group</c> oder <c>attribute</c>) zum Arbeiten braucht; null, wenn keines es braucht.</summary>
    public static string? ProtectedBy(Plugins? plugins, string kind, string key) =>
        Registered(plugins).Where(r => r.Enabled && (kind == "group" ? r.Groups : r.Attributes).Contains(key)).Select(r => r.Plugin).FirstOrDefault();

    /// <summary>Anmelden, was es schon gibt (Bestand von früher): die Gruppe und das Klassenattribut müssen im Modell stehen.</summary>
    public static Answer Register(Ctx c, RegisterBody b)
    {
        if (Check(b.System) is { } bad) return bad;
        if (string.IsNullOrWhiteSpace(b.System.Plugin)) return Answer.Bad("Plugin fehlt.");
        var r = Resolve(c.Model, b.System);
        if (!c.Model.Groups.ContainsKey(r.Group) || !c.Model.Attributes.ContainsKey(r.ClassAttr)) return new Answer(new RegisterResult(false));
        WriteRegistration(c, RegistrationOf(b.System, r.Group, r.ClassAttr));
        return new Answer(new RegisterResult(true));
    }

    /// <summary>
    /// Ein Plugin meldet die Gruppen und Attribute an, die es zum Betrieb braucht (DPP, PPWR; die Klassifikationen melden sich selbst an). Sie müssen
    /// im Modell stehen. Eine vorhandene Angabe zur Klassifikation bleibt.
    /// </summary>
    public static Answer RegisterObjects(Ctx c, string plugin, SystemBody b)
    {
        if (!ModelApi.ValidKey(plugin)) return Answer.Bad("Schlüssel „{0}“: nur a-z, 0-9 und _, beginnt mit Buchstabe.", plugin);
        var groups = (b.Groups ?? []).Distinct().Order(StringComparer.Ordinal).ToArray();
        var attributes = (b.Attributes ?? []).Distinct().Order(StringComparer.Ordinal).ToArray();
        if (groups.FirstOrDefault(g => !c.Model.Groups.ContainsKey(g)) is { } g0) return Answer.Bad("Gruppe {0} gibt es im Modell nicht.", g0);
        if (attributes.FirstOrDefault(a => !c.Model.Attributes.ContainsKey(a)) is { } a0) return Answer.Bad("Attribut {0} gibt es im Modell nicht.", a0);
        var klass = Registered(c.Plugins).FirstOrDefault(r => r.Plugin == plugin);
        var json = new Dictionary<string, object?>
        {
            ["groups"] = klass.Plugin is not null ? groups.Union(klass.Groups).Order(StringComparer.Ordinal).ToArray() : groups,
            ["attributes"] = klass.Plugin is not null ? attributes.Union(klass.Attributes).Order(StringComparer.Ordinal).ToArray() : attributes,
        };
        if (klass.Plugin is not null && klass.Group is not null) json["classification"] = new { group = klass.Group, classAttr = klass.ClassAttr };
        var text = System.Text.Json.JsonSerializer.Serialize(json);
        WriteRegistration(c, (plugin, text));
        return new Answer(new RegisterResult(true));
    }

    /// <summary>Kann das Plugin arbeiten? Seine angemeldeten Objekte müssen im Modell stehen — fehlen sie, gilt alles oder nichts.</summary>
    public static Health HealthOf(ModelCatalog m, Plugins? plugins, string plugin)
    {
        var r = Registered(plugins).FirstOrDefault(x => x.Plugin == plugin);
        if (r.Plugin is null) return new Health(false, "Die Systemobjekte sind nicht angemeldet.");
        var group = r.Groups.FirstOrDefault(g => !m.Groups.ContainsKey(g));
        if (group is not null) return new Health(false, $"Die Gruppe {group} fehlt im Modell.");
        var attr = r.Attributes.FirstOrDefault(a => !m.Attributes.ContainsKey(a));
        return attr is not null ? new Health(false, $"Das Attribut {attr} fehlt im Modell.") : new Health(true, null);
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
        // Gibt es das Klassenattribut im Modell nicht mehr (Modell geleert, Attribut gelöscht), steht der Wert verwaist am Knoten und lässt
        // sich nicht nehmen: erst entsteht das Klassenattribut wieder, dann geht der Wert
        if (!c.Model.Attributes.ContainsKey(r.ClassAttr))
        {
            var plan = PlanAll(c.Model, b.System, [], []);
            if (Apply(c, plan, mayModel) is { } e) return e;
        }
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

    /// <summary>Die Klassifikationen, die Plugins angemeldet haben und die im Modell stehen.</summary>
    public static List<(string Plugin, string Group, string ClassAttr)> Systems(ModelCatalog m, Plugins? plugins) =>
        Registered(plugins).Where(r => r.Group is not null && r.ClassAttr is not null && m.Groups.ContainsKey(r.Group) && m.Attributes.ContainsKey(r.ClassAttr))
            .Select(r => (r.Plugin, r.Group!, r.ClassAttr!)).ToList();

    /// <summary>Die Gruppen der Klassen eines Systems: für jede Klasse der Liste die Gruppe, die es im Modell gibt.</summary>
    public static HashSet<string> ClassGroupsOf(ModelCatalog m, (string Plugin, string Group, string ClassAttr) s) =>
        m.Lists.TryGetValue(s.ClassAttr, out var l) ? l.Values.Keys.Select(code => ClassGroupKey(s.Group, code)).Where(m.Groups.ContainsKey).ToHashSet() : [];

    /// <summary>
    /// Eine Klassifikation als Ganzes zurücknehmen: in allen Bäumen gehen die Klassen weg und die Werte ihrer Attribute, die Gruppen der Klassen
    /// werden abgenommen und zurückgezogen, ebenso ihre eigenen Attribute (mit den Listen), das Klassenattribut und die Gruppe des Systems.
    /// Ein Attribut, das auch anderswo steht (ein zugeordnetes des Kunden), verliert nur die Gruppen des Systems und behält seine Werte.
    /// <c>DryRun</c> zählt nur. Das Journal behält alles, was geschrieben war; zurückgenommen wird im Modell und an den Knoten.
    /// </summary>
    public static Answer Retire(Ctx c, RetireBody b, bool mayModel)
    {
        var m = c.Model;
        var found = Systems(m, c.Plugins).Where(x => x.Group == b.Group).Select(x => ((string Plugin, string Group, string ClassAttr)?)x).FirstOrDefault();
        if (found is not { } sys) return Answer.Bad("Keine Klassifikation mit der Gruppe {0}.", b.Group);
        var classGroups = ClassGroupsOf(m, sys);
        var all = classGroups.Append(sys.Group).ToHashSet();
        // eigene Attribute: ihre Heimat ist eine Gruppe des Systems und sie stehen in keiner anderen; die übrigen verlieren nur die Gruppen des Systems
        bool NurSystem(AttributeDefinition a) => all.Contains(a.Group ?? "") && m.GroupsOf(a.Key).All(all.Contains);
        var eigene = m.Attributes.Values.Where(a => a.Key != sys.ClassAttr && NurSystem(a)).Select(a => a.Key).ToHashSet();
        var geteilt = m.Attributes.Values.Where(a => a.Key != sys.ClassAttr && !eigene.Contains(a.Key) && m.GroupsOf(a.Key).Any(all.Contains)).ToList();
        var weg = eigene.Append(sys.ClassAttr).ToHashSet();
        var knoten = c.Tree.Nodes.Values.ToList();
        var werte = knoten.SelectMany(n => n.Values.Keys.Concat(n.Lists.Keys).Where(ax => weg.Contains(ax.Attribute)).Select(ax => (n, ax))).ToList();
        var mitKlasse = knoten.Count(n => n.Values.ContainsKey(new Axis(sys.ClassAttr, null, null)));
        var zaehlt = new Retired(classGroups.Count + 1, weg.Count, mitKlasse, werte.Count);
        if (c.Plugins?.All.TryGetValue(sys.Plugin, out var besitzer) == true && besitzer.Enabled) return Answer.Bad("{0} wird vom eingeschalteten Plugin {1} gebraucht.", sys.Group, sys.Plugin);
        if (b.DryRun) return new Answer(zaehlt);
        if (!mayModel) return Answer.Bad("Das Modell ändert sich ({0} Änderungen) — das verlangt das Modell-Recht.", zaehlt.Groups + zaehlt.Attributes + geteilt.Count);

        // 1. die Werte weg — solange es die Attribute noch gibt; direkt geschrieben, denn eine Gruppe, die nirgends mehr hängt, lässt kein Setzen mehr zu
        foreach (var (n, ax) in werte) c.Write(n.Id, Types.AttributeSet, new AttributeSet(ax.Attribute, ax.Locale, ax.Channel, "", null, ax.Row));
        // 2. die Gruppen von den Knoten
        foreach (var n in knoten.Where(n => n.Groups.Any(all.Contains)).ToList()) c.Write(n.Id, Types.GroupsAttached, new GroupsAttached(n.Groups.Where(g => !all.Contains(g)).ToArray()));
        // 3. das Modell: geteilte Attribute ohne die Gruppen des Systems, die eigenen und das Klassenattribut samt Listen, dann die Gruppen
        foreach (var a in geteilt)
        {
            var rest = m.GroupsOf(a.Key).Where(g => !all.Contains(g)).Order(StringComparer.Ordinal).ToArray();
            var heimat = all.Contains(a.Group ?? "") ? rest.FirstOrDefault() : a.Group;
            if (heimat != a.Group) c.Write(Model.AttributeStream + a.Key, Types.AttributeDefined, a with { Group = heimat });
            c.Write(Model.AttributeStream + a.Key, Types.AttributeGroupsSet, new AttributeGroupsSet(a.Key, rest.Where(g => g != heimat).ToArray()));
        }
        foreach (var key in weg)
        {
            var list = m.Attributes[key].List;
            c.Write(Model.AttributeStream + key, Types.AttributeRetired, new AttributeRetired(key));
            if (list is not null && m.Lists.ContainsKey(list) && !m.Attributes.Values.Any(x => x.List == list && !weg.Contains(x.Key))) c.Write(Model.ListStream + list, Types.ListRetired, new ListRetired(list));
        }
        foreach (var g in all) c.Write(Model.GroupStream + g, Types.AttributeGroupRetired, new AttributeGroupRetired(g));
        // 4. die Anmeldung fällt: das Plugin hat seine Objekte nicht mehr und ist nicht bereit, bis es sie wieder anlegt
        c.Write(Plugins.Stream + sys.Plugin, Types.PluginDataSet, new PluginDataSet("system", null));
        return new Answer(zaehlt);
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
