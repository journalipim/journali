using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>Ergebnis eines Befehls: der Eintrag, oder warum nicht.</summary>
public sealed record Outcome(Entry? Entry, string? Error = null, bool NotFound = false)
{
    public static Outcome Ok(Entry e) => new(e);
    public static Outcome Bad(string error) => new(null, error);
    public static readonly Outcome Missing = new(null, null, true);
}

/// <summary>Was ein Befehl braucht: Modell, Baum, und einen Schreiber, der Urheber und Stapel kennt.</summary>
public sealed class Ctx
{
    public required ModelCatalog Model { get; init; }
    public required Tree Tree { get; init; }
    public required Relations Relations { get; init; }
    public required Media Media { get; init; }
    public required Func<string, string, object, Entry> Write { get; init; }   // stream, type, payload
}

/// <summary>
/// Alle Befehle am Baum als Funktionen — dieselbe Prüfung, ob sie einzeln
/// (TreeApi) oder im Stapel (BatchApi) kommen. Jeder Befehl ist genau ein Eintrag.
/// </summary>
public static class Commands
{
    public static Outcome CreateGroup(Ctx c, string? parent, Labels? label, string? name = null)
    {
        parent = Blank(parent);
        if (parent is not null && !IsRole(c.Tree, parent, Roles.Group)) return Outcome.Bad("Eltern müssen eine Produktgruppe sein.");
        return Outcome.Ok(c.Write(Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(parent, label ?? new(), Blank(name))));
    }

    /// <summary>Altlast: Label je Sprache — nur noch für Stapel und Import, die es so schicken.</summary>
    public static Outcome RenameGroup(Ctx c, string id, Labels? label) =>
        IsRole(c.Tree, id, Roles.Group) ? Outcome.Ok(c.Write(id, Types.GroupRenamed, new GroupRenamed(label ?? new()))) : Outcome.Missing;

    /// <summary>Eigener Name im Baum, jede Rolle; leer = weg, die Automatik greift wieder.</summary>
    public static Outcome Rename(Ctx c, string id, string? name) =>
        c.Tree.Nodes.ContainsKey(id) ? Outcome.Ok(c.Write(id, Types.NodeNamed, new NodeNamed(Blank(name)))) : Outcome.Missing;

    /// <summary>
    /// Das Sternchen: ab hier benennt dieses Attribut alle Knoten ohne eigenen Namen.
    /// Null nimmt es weg. Das Attribut muss über eine Gruppe am Pfad gelten — aktiv
    /// darf es erst weiter unten sein (SKU am Produkt gesetzt benennt die Varianten).
    /// </summary>
    public static Outcome SetLabelAttribute(Ctx c, string id, string? attribute)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        attribute = Blank(attribute);
        if (attribute is not null)
        {
            if (!c.Model.Attributes.TryGetValue(attribute, out var def)) return Outcome.Bad($"Unbekanntes Attribut: {attribute}");
            if (def.Type is AttributeTypes.Html or AttributeTypes.Rows) return Outcome.Bad($"{def.Key} ({def.Type}) taugt nicht als Name im Baum.");
            if (!c.Tree.EffectiveGroups(n).Any(g => g.Group == (def.Group ?? ""))) return Outcome.Bad($"{def.Key} gilt hier nicht: Gruppe {def.Group} hängt an keinem Knoten des Pfads.");
        }
        return Outcome.Ok(c.Write(id, Types.LabelAttributeSet, new LabelAttributeSet(attribute)));
    }

    public static Outcome CreateProduct(Ctx c, string? group, string[]? axes)
    {
        if (!IsRole(c.Tree, group, Roles.Group)) return Outcome.Bad("Ein Produkt hängt unter einer Produktgruppe.");
        var clean = axes?.Where(a => a.Length > 0).Distinct().ToArray() ?? [];
        if (clean.Except(c.Model.Attributes.Keys).Any()) return Outcome.Bad("Variantenachse muss ein Attribut sein.");
        return Outcome.Ok(c.Write(Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(group!, null, clean.Length > 0 ? clean : null)));
    }

    /// <summary>Variantenachsen eines Produkts setzen (ganze Liste) — nur ohne Varianten, denn deren Achsenwerte sind fest.</summary>
    public static Outcome SetAxes(Ctx c, string id, string[]? axes)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        if (n.Role != Roles.Product) return Outcome.Bad("Nur ein Produkt hat Variantenachsen.");
        if (c.Tree.Children(id).Any()) return Outcome.Bad("Achsen sind fest, sobald Varianten da sind — erst die Varianten zurückziehen.");
        var clean = axes?.Select(a => a.Trim()).Where(a => a.Length > 0).Distinct().ToArray() ?? [];
        if (clean.Except(c.Model.Attributes.Keys).Any()) return Outcome.Bad("Variantenachse muss ein Attribut sein.");
        return Outcome.Ok(c.Write(id, Types.ProductAxesSet, new ProductAxesSet(clean)));
    }

    /// <summary>Attributgruppen an einen Knoten hängen (ganze Liste); die Definition gilt ab hier nach unten.</summary>
    public static Outcome AttachGroups(Ctx c, string id, string[]? groups)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        var list = groups?.Select(g => g.Trim()).Where(g => g.Length > 0).Distinct().ToArray() ?? [];
        foreach (var g in list)
            if (!c.Model.Groups.ContainsKey(g) && !c.Model.Attributes.Values.Any(a => a.Group == g)) return Outcome.Bad($"Unbekannte Gruppe: {g}");
        return Outcome.Ok(c.Write(id, Types.GroupsAttached, new GroupsAttached(list)));
    }

    public static Outcome CreateVariant(Ctx c, string? productId, Dictionary<string, string>? axisValues)
    {
        if (!c.Tree.Nodes.TryGetValue(productId ?? "", out var product) || product.Role != Roles.Product) return Outcome.Bad("Eine Variante hängt unter einem Produkt.");
        var values = axisValues ?? new();
        if (!values.Keys.ToHashSet().SetEquals(product.Axes)) return Outcome.Bad($"Achsenwerte für genau: {string.Join(", ", product.Axes)}");
        foreach (var (axis, value) in values.ToList())
        {
            if (!c.Model.Attributes.TryGetValue(axis, out var def)) return Outcome.Bad($"Unbekannte Achse: {axis}");
            string? v = value; string[]? none = null;
            if (CheckValue(c.Model, def, ref v, ref none) is { } error) return Outcome.Bad(error);
            if (v is null) return Outcome.Bad($"Achse {axis} braucht einen Wert.");
            values[axis] = v;
        }
        // Ohne Achsen darf ein Produkt beliebig viele Varianten haben (Import aus Systemen ohne Achsen);
        // mit Achsen ist die Kombination je Produkt eindeutig.
        if (product.Axes.Length > 0 && c.Tree.Children(product.Id).Any(s => s.AxisValues.Count == values.Count && s.AxisValues.All(kv => values.TryGetValue(kv.Key, out var x) && x == kv.Value)))
            return Outcome.Bad("Diese Variante gibt es schon.");
        return Outcome.Ok(c.Write(Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(product.Id, values)));
    }

    public static Outcome Move(Ctx c, string id, string? parent)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        if (!c.Tree.Nodes.TryGetValue(parent ?? "", out var target)) return Outcome.Bad("Ziel gibt es nicht.");
        var need = n.Role == Roles.Variant ? Roles.Product : Roles.Group;
        if (target.Role != need) return Outcome.Bad($"{n.Role} hängt unter {need}.");
        if (target.Id == n.Id || c.Tree.Ancestors(target).Any(a => a.Id == n.Id)) return Outcome.Bad("Nicht unter sich selbst.");
        return Outcome.Ok(c.Write(id, Types.NodeMoved, new NodeMoved(target.Id)));
    }

    public static Outcome Retire(Ctx c, string id)
    {
        if (!c.Tree.Nodes.ContainsKey(id)) return Outcome.Missing;
        if (c.Tree.Children(id).Any()) return Outcome.Bad("Erst die Kinder entfernen.");
        return Outcome.Ok(c.Write(id, Types.NodeRetired, new NodeRetired()));
    }

    public static Outcome SetStatus(Ctx c, string id, string? status)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        if (n.Role == Roles.Group) return Outcome.Bad("Eine Gruppe hat keinen Status.");
        if (!Statuses.All.Contains(status ?? "")) return Outcome.Bad($"Status: {string.Join(", ", Statuses.All)}");
        return Outcome.Ok(c.Write(id, Types.StatusSet, new StatusSet(status!)));
    }

    public static Outcome SetAttribute(Ctx c, string id, string? attribute, string? locale, string? channel, string? value, string[]? values, string? row = null)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        if (string.IsNullOrWhiteSpace(attribute)) return Outcome.Bad("attribute fehlt.");
        if (!c.Model.Attributes.TryGetValue(attribute, out var def)) return Outcome.Bad($"Unbekanntes Attribut: {attribute}");
        if (def.Type == AttributeTypes.Rows) return Outcome.Bad($"{def.Key} ist vermehrbar — Zeilen über RowAdded, Zellen mit row.");
        if (def.IsComputed) return Outcome.Bad($"{def.Key} ist kombiniert ({def.Formula}) — wird gerechnet, nicht gesetzt.");
        row = Blank(row);
        // Gilt das Attribut hier? Über eine Gruppe am Pfad, die an dieser Rolle aktiv ist (oder als Zelle einer Zeile).
        if (row is null && !CompletenessRules.ActiveAttributes(c.Tree, c.Model, n).Any(a => a.Key == def.Key))
            return Outcome.Bad(WhyNotActive(c, n, def));
        if (row is not null)
        {
            // Zelle einer Zeile: die Zeile muss es am Knoten geben, das Attribut muss Spalte dieses vermehrbaren Attributs sein.
            var owner = n.Rows.FirstOrDefault(kv => kv.Value.Contains(row)).Key;
            if (owner is null) return Outcome.Bad($"Zeile {row} gibt es hier nicht.");
            if (!(c.Model.Attributes.GetValueOrDefault(owner)?.Columns?.Contains(def.Key) ?? false)) return Outcome.Bad($"{def.Key} ist keine Spalte von {owner}.");
        }
        locale = Blank(locale);
        channel = Blank(channel);
        if ((locale is not null && !def.PerLocale) || (channel is not null && !def.PerChannel)) return Outcome.Bad($"{def.Key} hat diese Achse nicht.");
        if (locale is not null && !c.Model.Locales.ContainsKey(locale)) return Outcome.Bad($"Unbekannte Sprache: {locale}");
        if (channel is not null && !c.Model.Channels.ContainsKey(channel)) return Outcome.Bad($"Unbekannter Kanal: {channel}");
        if (channel is not null && def.Channels is { } only && !only.Contains(channel)) return Outcome.Bad($"{def.Key} gibt es nur für: {string.Join(", ", only)}");
        if (CheckValue(c.Model, def, ref value, ref values) is { } error) return Outcome.Bad(error);
        // SKU: eindeutig über alle Varianten — die kleine synchrone Prüf-Projektion.
        if (def.Key == Model.SkuAttribute && value is not null && c.Tree.BySku(value).Any(o => o.Id != n.Id))
            return Outcome.Bad($"SKU {value} gibt es schon.");
        return Outcome.Ok(c.Write(id, Types.AttributeSet, new AttributeSet(def.Key, locale, channel, value, values, row)));
    }

    /// <summary>Warum ein Attribut an diesem Knoten nicht erfassbar ist — für die Fehlermeldung.</summary>
    private static string WhyNotActive(Ctx c, Node n, AttributeDefinition def)
    {
        var g = def.Group ?? "";
        var effective = c.Tree.EffectiveGroups(n).Select(x => x.Group).ToHashSet();
        if (g.Length == 0) return $"{def.Key} hat keine Gruppe — im Modell zuordnen.";
        if (!effective.Contains(g)) return $"{def.Key} gilt hier nicht: Gruppe {g} hängt an keinem Knoten des Pfads.";
        if (!c.Model.GroupActiveAt(g, n.Role)) return $"{def.Key} gilt hier nicht: Gruppe {g} ist erst ab {c.Model.Groups[g].ActiveFrom} aktiv.";
        return $"{def.Key} gibt es nur an: {string.Join(", ", def.Levels ?? [])}";
    }

    public static Outcome AddRow(Ctx c, string id, string? attribute)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        if (!c.Model.Attributes.TryGetValue(attribute ?? "", out var def) || def.Type != AttributeTypes.Rows) return Outcome.Bad($"{attribute} ist kein vermehrbares Attribut.");
        if (!CompletenessRules.ActiveAttributes(c.Tree, c.Model, n).Any(a => a.Key == def.Key)) return Outcome.Bad(WhyNotActive(c, n, def));
        var rowId = "r-" + Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(3)).ToLowerInvariant();
        return Outcome.Ok(c.Write(id, Types.RowAdded, new RowAdded(def.Key, rowId)));
    }

    public static Outcome RemoveRow(Ctx c, string id, string? attribute, string? row)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        if (!n.Rows.TryGetValue(attribute ?? "", out var rows) || !rows.Contains(row ?? "")) return Outcome.Bad("Zeile gibt es nicht.");
        return Outcome.Ok(c.Write(id, Types.RowRemoved, new RowRemoved(attribute!, row!)));
    }

    public static Outcome OrderRows(Ctx c, string id, string? attribute, string[]? rows)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        if (!n.Rows.TryGetValue(attribute ?? "", out var have)) return Outcome.Bad("Keine Zeilen.");
        if (rows is null || rows.Except(have).Any()) return Outcome.Bad("Unbekannte Zeile in der Reihenfolge.");
        return Outcome.Ok(c.Write(id, Types.RowOrdered, new RowOrdered(attribute!, rows)));
    }

    public static Outcome AssignCategory(Ctx c, string id, string? category) =>
        !c.Tree.Nodes.ContainsKey(id) ? Outcome.Missing
        : string.IsNullOrWhiteSpace(category) ? Outcome.Bad("category fehlt.")
        : Outcome.Ok(c.Write(id, Types.CategoryAssigned, new CategoryAssigned(category)));

    public static Outcome RemoveCategory(Ctx c, string id, string category) =>
        c.Tree.Nodes.ContainsKey(id) ? Outcome.Ok(c.Write(id, Types.CategoryRemoved, new CategoryRemoved(category))) : Outcome.Missing;

    public static Outcome GrantRelease(Ctx c, string id, string? channel, string? locale)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        if (n.Role != Roles.Variant) return Outcome.Bad("Freigabe nur an der Variante — sie ist das Verkaufbare.");
        if (!c.Model.Channels.ContainsKey(channel ?? "")) return Outcome.Bad("channel fehlt oder unbekannt.");
        locale = Blank(locale);
        if (locale is not null && !c.Model.Locales.ContainsKey(locale)) return Outcome.Bad($"Unbekannte Sprache: {locale}");
        // Freigabe setzt Vollständigkeit voraus — Sperre (docs/pflegestruktur.md, entschieden).
        var (_, missing) = CompletenessRules.Check(c.Tree, c.Model, n, CompletenessRules.ActiveAttributes(c.Tree, c.Model, n).ToList(), channel!, locale);
        if (missing.Length > 0) return Outcome.Bad($"Unvollständig für {channel}/{locale ?? "*"}: {string.Join(", ", missing)}");
        return Outcome.Ok(c.Write(id, Types.ReleaseGranted, new ReleaseGranted(channel!, locale)));
    }

    public static Outcome RevokeRelease(Ctx c, string id, string channel, string? locale) =>
        c.Tree.Nodes.ContainsKey(id) ? Outcome.Ok(c.Write(id, Types.ReleaseRevoked, new ReleaseRevoked(channel, Blank(locale)))) : Outcome.Missing;

    public static Outcome LinkExternal(Ctx c, string id, string? system, string? externalId)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        if (string.IsNullOrWhiteSpace(system) || string.IsNullOrWhiteSpace(externalId)) return Outcome.Bad("system und id sind Pflicht.");
        if (c.Tree.ByExternal(system, externalId) is { } other && other.Id != n.Id) return Outcome.Bad($"{system}:{externalId} hängt schon an {other.Id}.");
        return Outcome.Ok(c.Write(id, Types.ExternalLinked, new ExternalLinked(system, externalId)));
    }

    public static Outcome UnlinkExternal(Ctx c, string id, string system) =>
        c.Tree.Nodes.ContainsKey(id) ? Outcome.Ok(c.Write(id, Types.ExternalUnlinked, new ExternalUnlinked(system))) : Outcome.Missing;

    /// <summary>
    /// Kopie eines Knotens neben dem Original: gleiche Rolle, alle eigenen Werte,
    /// Zeilen und Kategorien — ohne SKU (eindeutig), ohne Freigaben, ohne externe
    /// Kennung, Status Entwurf. <paramref name="deep"/> nimmt den Unterbaum mit.
    /// Varianten mit Achsen lassen sich nicht kopieren: dieselben Achsenwerte gibt es schon.
    /// Liefert die Id der Kopie oder einen Fehler.
    /// </summary>
    public static (string? Id, string? Error, int Count) Duplicate(Ctx c, string id, bool deep)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var src)) return (null, null, 0);
        if (src.Role == Roles.Variant && src.AxisValues.Count > 0) return (null, "Variante mit Achsen: die Kopie hätte dieselben Achsenwerte — neu anlegen.", 0);
        var count = 0;
        var copy = CopyOne(c, src, src.Parent, ref count, suffix: true);
        if (copy is null) return (null, "Kopie fehlgeschlagen.", count);
        if (deep) CopyChildren(c, src.Id, copy, ref count);
        return (copy, null, count);
    }

    private static void CopyChildren(Ctx c, string fromId, string toId, ref int count)
    {
        foreach (var child in c.Tree.Children(fromId).ToList())
        {
            var n = CopyOne(c, child, toId, ref count, suffix: false);
            if (n is not null) CopyChildren(c, child.Id, n, ref count);
        }
    }

    private static string? CopyOne(Ctx c, Node src, string? parent, ref int count, bool suffix)
    {
        string? id;
        switch (src.Role)
        {
            case Roles.Group:
                // „(Kopie)“ vorne, damit man es im Baum sieht.
                id = CreateGroup(c, parent, new Labels(src.Label), src.Name is { } gn ? (suffix ? "(Kopie) " + gn : gn) : null).Entry?.Stream; break;
            case Roles.Product:
                id = CreateProduct(c, parent, src.Axes).Entry?.Stream; break;
            default:
                id = CreateVariant(c, parent, new(src.AxisValues)).Entry?.Stream; break;
        }
        if (id is null) return null;
        count++;
        if (src.Role != Roles.Group && src.Name is { } own && Rename(c, id, suffix ? "(Kopie) " + own : own).Entry is not null) count++;
        if (src.LabelAttribute is { } star && SetLabelAttribute(c, id, star).Entry is not null) count++;
        if (src.Groups.Length > 0 && AttachGroups(c, id, src.Groups).Entry is not null) count++;
        foreach (var (attr, rows) in src.Rows)
        {
            foreach (var row in rows)
            {
                var added = AddRow(c, id, attr).Entry;
                if (added is null) continue;
                count++;
                var newRow = Types.Deserialize<RowAdded>(added.Payload).Row;
                foreach (var (axis, v) in src.Values.Where(kv => kv.Key.Row == row))
                    if (SetAttribute(c, id, axis.Attribute, axis.Locale, axis.Channel, v, null, newRow).Entry is not null) count++;
                foreach (var (axis, l) in src.Lists.Where(kv => kv.Key.Row == row))
                    if (SetAttribute(c, id, axis.Attribute, axis.Locale, axis.Channel, null, l, newRow).Entry is not null) count++;
            }
        }
        foreach (var (axis, v) in src.Values.Where(kv => kv.Key.Row is null && kv.Key.Attribute != Model.SkuAttribute))
            if (SetAttribute(c, id, axis.Attribute, axis.Locale, axis.Channel, suffix && axis.Attribute == "name" ? "(Kopie) " + v : v, null).Entry is not null) count++;
        foreach (var (axis, l) in src.Lists.Where(kv => kv.Key.Row is null))
            if (SetAttribute(c, id, axis.Attribute, axis.Locale, axis.Channel, null, l).Entry is not null) count++;
        foreach (var cat in src.Categories)
            if (AssignCategory(c, id, cat).Entry is not null) count++;
        return id;
    }

    // ---- Relationen (18)

    /// <summary>Relation anlegen: Typ aus dem Modell, Rollen erlaubt, nicht auf sich selbst, je Typ nur einmal zwischen denselben Knoten.</summary>
    public static Outcome CreateRelation(Ctx c, string? type, string? from, string? to)
    {
        if (!c.Model.RelationTypes.TryGetValue(type ?? "", out var def)) return Outcome.Bad($"Unbekannter Relationstyp: {type}");
        if (!c.Tree.Nodes.TryGetValue(from ?? "", out var a)) return Outcome.Bad("from: Knoten gibt es nicht.");
        // Ziel: ein Knoten — oder ein Medium (20), dann Rolle „media“.
        string toId, toRole;
        if (c.Tree.Nodes.TryGetValue(to ?? "", out var b)) { toId = b.Id; toRole = b.Role; }
        else if (c.Media.All.TryGetValue(to ?? "", out var m)) { toId = m.Id; toRole = Roles.Media; }
        else return Outcome.Bad("to: Knoten oder Medium gibt es nicht.");
        if (a.Id == toId) return Outcome.Bad("Nicht auf sich selbst.");
        if (!def.FromAllowed(a.Role)) return Outcome.Bad($"{def.Key} geht nicht von {a.Role} aus (erlaubt: {string.Join(", ", def.From ?? [])}).");
        if (!def.ToAllowed(toRole)) return Outcome.Bad($"{def.Key} geht nicht zu {toRole} (erlaubt: {string.Join(", ", def.To ?? [])}).");
        if (c.Relations.From(a.Id).Any(r => r.Type == def.Key && r.To == toId)) return Outcome.Bad("Diese Relation gibt es schon.");
        // beidseitig: je Paar nur einmal, egal von welchem Ende aus angelegt
        if (def.Symmetric && c.Relations.From(toId).Any(r => r.Type == def.Key && r.To == a.Id)) return Outcome.Bad("Diese Relation gibt es schon (vom anderen Ende).");
        return Outcome.Ok(c.Write(Ids.Relation(), Types.RelationCreated, new RelationCreated(def.Key, a.Id, toId)));
    }

    public static Outcome RetireRelation(Ctx c, string id) =>
        c.Relations.All.ContainsKey(id) ? Outcome.Ok(c.Write(id, Types.RelationRetired, new RelationRetired())) : Outcome.Missing;

    /// <summary>Wert an der Relation: nur Attribute der Gruppe des Relationstyps; Achsen und Wert wie am Knoten.</summary>
    public static Outcome SetRelationAttribute(Ctx c, string id, string? attribute, string? locale, string? channel, string? value, string[]? values)
    {
        if (!c.Relations.All.TryGetValue(id, out var r)) return Outcome.Missing;
        if (!c.Model.Attributes.TryGetValue(attribute ?? "", out var def)) return Outcome.Bad($"Unbekanntes Attribut: {attribute}");
        var type = c.Model.RelationTypes.GetValueOrDefault(r.Type);
        if (type?.Group is null) return Outcome.Bad($"Relationstyp {r.Type} hat keine Attributgruppe — im Modell zuordnen.");
        if (def.Group != type.Group) return Outcome.Bad($"{def.Key} gehört nicht zur Gruppe {type.Group} des Relationstyps.");
        if (def.Type == AttributeTypes.Rows) return Outcome.Bad("Vermehrbare Attribute gibt es an Relationen nicht.");
        locale = Blank(locale); channel = Blank(channel);
        if ((locale is not null && !def.PerLocale) || (channel is not null && !def.PerChannel)) return Outcome.Bad($"{def.Key} hat diese Achse nicht.");
        if (locale is not null && !c.Model.Locales.ContainsKey(locale)) return Outcome.Bad($"Unbekannte Sprache: {locale}");
        if (channel is not null && !c.Model.Channels.ContainsKey(channel)) return Outcome.Bad($"Unbekannter Kanal: {channel}");
        if (CheckValue(c.Model, def, ref value, ref values) is { } error) return Outcome.Bad(error);
        return Outcome.Ok(c.Write(id, Types.AttributeSet, new AttributeSet(def.Key, locale, channel, value, values)));
    }

    public static Outcome LinkRelationExternal(Ctx c, string id, string? system, string? externalId)
    {
        if (!c.Relations.All.TryGetValue(id, out var r)) return Outcome.Missing;
        if (string.IsNullOrWhiteSpace(system) || string.IsNullOrWhiteSpace(externalId)) return Outcome.Bad("system und id sind Pflicht.");
        if (c.Relations.ByExternal(system, externalId) is { } other && other.Id != r.Id) return Outcome.Bad($"{system}:{externalId} hängt schon an {other.Id}.");
        return Outcome.Ok(c.Write(id, Types.ExternalLinked, new ExternalLinked(system, externalId)));
    }

    // ---- Medien (20)

    public static Outcome RetireMedium(Ctx c, string id) =>
        c.Media.All.ContainsKey(id) ? Outcome.Ok(c.Write(id, Types.MediaRetired, new MediaRetired())) : Outcome.Missing;

    /// <summary>Wert am Medium: Attribute der Gruppe media (Alt-Text, Rechte …).</summary>
    public static Outcome SetMediumAttribute(Ctx c, string id, string? attribute, string? locale, string? channel, string? value, string[]? values)
    {
        if (!c.Media.All.ContainsKey(id)) return Outcome.Missing;
        if (!c.Model.Attributes.TryGetValue(attribute ?? "", out var def)) return Outcome.Bad($"Unbekanntes Attribut: {attribute}");
        if (def.Group != Model.MediaGroup) return Outcome.Bad($"{def.Key} gehört nicht zur Gruppe {Model.MediaGroup}.");
        if (def.Type == AttributeTypes.Rows) return Outcome.Bad("Vermehrbare Attribute gibt es an Medien nicht.");
        locale = Blank(locale); channel = Blank(channel);
        if ((locale is not null && !def.PerLocale) || (channel is not null && !def.PerChannel)) return Outcome.Bad($"{def.Key} hat diese Achse nicht.");
        if (locale is not null && !c.Model.Locales.ContainsKey(locale)) return Outcome.Bad($"Unbekannte Sprache: {locale}");
        if (channel is not null && !c.Model.Channels.ContainsKey(channel)) return Outcome.Bad($"Unbekannter Kanal: {channel}");
        if (CheckValue(c.Model, def, ref value, ref values) is { } error) return Outcome.Bad(error);
        return Outcome.Ok(c.Write(id, Types.AttributeSet, new AttributeSet(def.Key, locale, channel, value, values)));
    }

    public static Outcome LinkMediumExternal(Ctx c, string id, string? system, string? externalId)
    {
        if (!c.Media.All.TryGetValue(id, out var m)) return Outcome.Missing;
        if (string.IsNullOrWhiteSpace(system) || string.IsNullOrWhiteSpace(externalId)) return Outcome.Bad("system und id sind Pflicht.");
        if (c.Media.ByExternal(system, externalId) is { } other && other.Id != m.Id) return Outcome.Bad($"{system}:{externalId} hängt schon an {other.Id}.");
        return Outcome.Ok(c.Write(id, Types.ExternalLinked, new ExternalLinked(system, externalId)));
    }

    private static bool IsRole(Tree tree, string? id, string role) =>
        id is not null && tree.Nodes.TryGetValue(id, out var n) && n.Role == role;
}
