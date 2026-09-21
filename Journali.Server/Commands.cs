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
    public Workflows? Workflows { get; init; }
    /// <summary>Rolle des Anfragenden (null = offen, ohne Benutzer) — für Übergänge mit Rollen.</summary>
    public string? Role { get; init; }
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
    /// <param name="force">Uneindeutige Kombinationen hinnehmen (Taloan, 20.09.: nach Hinweisdialog) — die betroffenen Varianten verlieren ihre Achsenzuordnung, die Werte bleiben.</param>
    public static Outcome SetAxes(Ctx c, string id, string[]? axes, bool force = false)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        if (n.Role != Roles.Product) return Outcome.Bad("Nur ein Produkt hat Variantenachsen.");
        var clean = axes?.Select(a => a.Trim()).Where(a => a.Length > 0).Distinct().ToArray() ?? [];
        if (clean.Except(c.Model.Attributes.Keys).Any()) return Outcome.Bad("Variantenachse muss ein Attribut sein.");
        // Die Achse muss an den Varianten gelten (Taloan, 20.09.: „konnte eine Achse zufügen, die bei der Variante gar nicht zur Verfügung steht“):
        // Gruppe am Pfad des Produkts, an der Variante aktiv, Attribut an der Variante erlaubt
        var atVariant = c.Tree.EffectiveGroups(n).Where(g => c.Model.GroupActiveAt(g.Group, Roles.Variant)).SelectMany(g => c.Model.AttributesOf(g.Group)).Where(a => a.AllowedAt(Roles.Variant)).Select(a => a.Key).ToHashSet();
        foreach (var a in clean.Except(n.Axes)) if (!atVariant.Contains(a)) return Outcome.Bad(   // nur neue Achsen — eine vorhandene muss sich entfernen lassen (Taloan, 20.09.: Sackgasse)
            $"{a} gilt an den Varianten von „{n.Name ?? id}“ nicht — die Gruppe des Attributs hängt nicht am Pfad oder ist an Varianten nicht aktiv.");
        // Mit Varianten (Taloan, 20.09.: „im Nachhinein kann man keine Achse zufügen — warum nicht?“): eine neue Achse nimmt an jeder Variante
        // deren eigenen Wert des Attributs — der muss da sein; danach muss die Kombination der Achsenwerte je Produkt eindeutig sein.
        var variants = c.Tree.Children(id).ToList();
        if (variants.Count > 0)
        {
            // leere Felder zählen nicht (Taloan, 20.09.): eine Variante ohne Wert bleibt ohne Achsenwert — eindeutig sein müssen die vollständigen Kombinationen.
            // Uneindeutig? Ohne force eine Rückfrage; mit force verlieren die betroffenen Varianten ihre Achsenzuordnung (Projektion), Werte bleiben.
            if (clean.Length > 0 && !force)
            {
                var dupes = variants.Select(v => clean.Select(a => v.AxisValues.TryGetValue(a, out var have) ? have : v.Values.GetValueOrDefault(new Axis(a, null, null))).ToList())
                    .Where(vals => vals.All(x => !string.IsNullOrEmpty(x))).GroupBy(vals => string.Join(" · ", vals)).Where(g => g.Count() > 1).Select(g => $"{g.Key} × {g.Count()}").ToList();
                if (dupes.Count > 0) return Outcome.Bad($"Nicht eindeutig: {string.Join(", ", dupes)} — mit force verlieren diese Varianten ihre Achsenzuordnung (Werte bleiben), oder eine weitere Achse dazu.");
            }
        }
        // Entfällt eine Achse, bleibt ihr Wert als eigener Attributwert an der Variante (sonst wäre er nur noch im Journal) — je Variante ein AttributeSet vor dem Achsenwechsel
        foreach (var v in variants) foreach (var gone in v.AxisValues.Keys.Except(clean).ToList())
            if (!v.Values.ContainsKey(new Axis(gone, null, null)) && c.Model.Attributes.TryGetValue(gone, out var gd) && gd.Type != AttributeTypes.Rows)
                c.Write(v.Id, Types.AttributeSet, new AttributeSet(gone, null, null, v.AxisValues[gone]));
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
        // eine eindeutige Achse (SKU als Achse, Taloan 21.09.): der Achsenwert darf es nirgends im Baum schon geben
        foreach (var (axis, v) in values)
            if (c.Model.Attributes.TryGetValue(axis, out var ad) && ad.Unique && c.Tree.WithOwnValue(axis, v).FirstOrDefault() is { } other)
                return Outcome.Bad($"{ad.Label.GetValueOrDefault("de") ?? axis} {v} gibt es schon: {NodeRow.LabelOf(c.Tree, c.Model, other)} ({other.Id}).");
        return Outcome.Ok(c.Write(Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(product.Id, values)));
    }

    // ---- Publikationsbaum (Taloan, 20.09.2026): Rubriken sind Knoten, Pflegeknoten hängen per Verweis darin
    public static Outcome CreateRubric(Ctx c, string? parent, Labels? label, string? name = null, string? channel = null, string? market = null)
    {
        parent = Blank(parent); channel = Blank(channel); market = Blank(market);
        if (parent is not null && !IsRole(c.Tree, parent, Roles.Rubric)) return Outcome.Bad("Eine Rubrik hängt unter einer Rubrik.");
        if (parent is null && (channel is null || !c.Model.Channels.ContainsKey(channel))) return Outcome.Bad("Ein Publikationsbaum gehört zu einem Kanal.");
        if (parent is not null) { channel = null; market = null; }
        if (string.IsNullOrWhiteSpace(name) && (label is null || label.Count == 0)) return Outcome.Bad("Name fehlt.");
        // Zwei Bäume mit gleichem Namen für denselben Kanal × Markt sind nicht zu unterscheiden (Taloan, 21.09.: „der bestehende wird überschrieben“ — es war ein zweiter)
        if (parent is null && c.Tree.PubTrees.Any(r => r.Channel == channel && r.Market == market && string.Equals(r.Name, Blank(name), StringComparison.OrdinalIgnoreCase)))
            return Outcome.Bad($"Es gibt schon einen Publikationsbaum „{name}“ für {channel}{(market is null ? "" : " · " + market)} — anderer Name, oder den vorhandenen weiter benutzen.");
        return Outcome.Ok(c.Write(Ids.New(Roles.Rubric), Types.RubricCreated, new RubricCreated(parent, label ?? new(), Blank(name), channel, market)));
    }

    /// <summary>Stand einer Rubrik: eingefrieren bei #n (n = Journalkopf für „jetzt“), null = live. Gilt ab hier nach unten.</summary>
    public static Outcome SetStand(Ctx c, string id, long? number, long head)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        if (n.Role != Roles.Rubric) return Outcome.Bad("Ein Stand steht an einer Rubrik oder der Wurzel des Publikationsbaums.");
        if (number is { } k && (k < 1 || k > head)) return Outcome.Bad($"Stand: Journalnummer 1 … {head}.");
        return Outcome.Ok(c.Write(id, Types.PubStandSet, new PubStandSet(number)));
    }

    public static Outcome SetPubTree(Ctx c, string id, string? channel, string? market)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        if (n.Role != Roles.Rubric || n.Parent is not null) return Outcome.Bad("Kanal und Markt stehen an der Wurzel des Publikationsbaums.");
        channel = Blank(channel); market = Blank(market);
        if (channel is null || !c.Model.Channels.ContainsKey(channel)) return Outcome.Bad("Ein Publikationsbaum gehört zu einem Kanal.");
        return Outcome.Ok(c.Write(id, Types.PubTreeSet, new PubTreeSet(channel, market)));
    }

    /// <summary>Pflegeknoten in eine Rubrik hängen (Produktgruppe oder Produkt; Varianten kommen mit dem Produkt).</summary>
    /// <summary>Regel-Verweis setzen (Id leer = neue Regel) — unter einem Knoten, der es gibt; Art name braucht einen Namen, Art attribute ein Attribut des Modells und einen Wert.</summary>
    public static Outcome SetRule(Ctx c, string rubric, PubRule rule)
    {
        if (!c.Tree.Nodes.TryGetValue(rubric, out var r)) return Outcome.Missing;
        if (r.Role != Roles.Rubric) return Outcome.Bad("Regeln hängen an Rubriken.");
        if (rule.Kind is not ("name" or "attribute")) return Outcome.Bad("kind: name oder attribute.");
        if (Blank(rule.Under) is { } u && !c.Tree.Nodes.ContainsKey(u)) return Outcome.Bad("under: Knoten gibt es nicht.");
        if (rule.Kind == "name" && Blank(rule.Name) is null) return Outcome.Bad("name fehlt.");
        if (rule.Kind == "attribute" && (Blank(rule.Attribute) is not { } a || !c.Model.Attributes.ContainsKey(a))) return Outcome.Bad("attribute fehlt oder unbekannt.");
        if (rule.Kind == "attribute" && Blank(rule.Value) is null) return Outcome.Bad("value fehlt.");
        if (Blank(rule.Role) is { } ro && ro is not (Roles.Group or Roles.Product)) return Outcome.Bad("role: group oder product.");
        var gb = Blank(rule.GroupBy);
        if (gb is not null && gb != "none" && gb != "parent" && !(gb.StartsWith("attr:") && c.Model.Attributes.ContainsKey(gb[5..]))) return Outcome.Bad("groupBy: none, parent oder attr:<attribut>.");
        var id = Blank(rule.Id) ?? Guid.NewGuid().ToString("N")[..8];
        return Outcome.Ok(c.Write(rubric, Types.RulePlaced, new RulePlaced(rule with { Id = id, Under = Blank(rule.Under), Role = Blank(rule.Role), Name = Blank(rule.Name), Attribute = Blank(rule.Attribute), Value = Blank(rule.Value), GroupBy = gb, Label = Blank(rule.Label) })));
    }

    public static Outcome RemoveRule(Ctx c, string rubric, string id)
    {
        if (!c.Tree.Nodes.TryGetValue(rubric, out var r)) return Outcome.Missing;
        if (!r.Rules.Any(x => x.Id == id)) return Outcome.Bad("Die Regel gibt es hier nicht.");
        return Outcome.Ok(c.Write(rubric, Types.RuleRemoved, new RuleRemoved(id)));
    }

    /// <summary>Anzeigename eines Verweises (nur hier, nur intern); leer nimmt ihn weg.</summary>
    public static Outcome NamePlace(Ctx c, string rubric, string node, string? name)
    {
        if (!c.Tree.Nodes.TryGetValue(rubric, out var r)) return Outcome.Missing;
        if (!r.Placed.Contains(node)) return Outcome.Bad("Der Verweis hängt hier nicht.");
        return Outcome.Ok(c.Write(rubric, Types.PlaceNamed, new PlaceNamed(node, Blank(name))));
    }

    public static Outcome Place(Ctx c, string rubric, string? node, int? order = null)
    {
        if (!c.Tree.Nodes.TryGetValue(rubric, out var r)) return Outcome.Missing;
        if (r.Role != Roles.Rubric) return Outcome.Bad("Verweise hängen in Rubriken.");
        if (!c.Tree.Nodes.TryGetValue(Blank(node) ?? "", out var n)) return Outcome.Bad("Knoten gibt es nicht.");
        if (n.Role is not (Roles.Group or Roles.Product)) return Outcome.Bad("In eine Rubrik hängt man Produktgruppen und Produkte — Varianten kommen mit dem Produkt.");
        if (r.Placed.Contains(n.Id) && order is null) return Outcome.Bad("Hängt hier schon.");
        return Outcome.Ok(c.Write(rubric, Types.NodePlaced, new NodePlaced(n.Id, order)));
    }

    public static Outcome Unplace(Ctx c, string rubric, string node)
    {
        if (!c.Tree.Nodes.TryGetValue(rubric, out var r)) return Outcome.Missing;
        if (!r.Placed.Contains(node)) return Outcome.Bad("Hängt hier nicht.");
        return Outcome.Ok(c.Write(rubric, Types.NodeUnplaced, new NodeUnplaced(node)));
    }

    /// <summary>
    /// Aus dem Pflegebaum ableiten (Taloan, 20.09.: „den Pflegebaum als Grundlage nehmen und dann umbauen“): unter der Rubrik entsteht je
    /// Produktgruppe unter <paramref name="from"/> eine Rubrik (rekursiv), jedes Produkt wird ein Verweis. Danach ist der Baum entkoppelt.
    /// Liefert die Zahl der Einträge.
    /// </summary>
    public static Outcome Derive(Ctx c, string rubric, string? from, bool self, out int count)
    {
        var n = 0; count = 0;
        if (!c.Tree.Nodes.TryGetValue(rubric, out var r)) return Outcome.Missing;
        if (r.Role != Roles.Rubric) return Outcome.Bad("Ableiten geht in eine Rubrik.");
        if (!c.Tree.Nodes.TryGetValue(Blank(from) ?? "", out var src) || src.Role != Roles.Group) return Outcome.Bad("Abgeleitet wird ab einer Produktgruppe.");
        Entry? last = null;
        string NameOf(Node g) { var l = NodeRow.LabelOf(c.Tree, c.Model, g); return l == g.Id ? (g.Name ?? g.Id) : l; }   // wie die Oberfläche den Knoten zeigt
        void Walk(string target, Node g)
        {
            foreach (var child in c.Tree.Children(g.Id).OrderBy(NameOf, StringComparer.OrdinalIgnoreCase))   // wie im Baum: nach dem sichtbaren Namen (Taloan, 21.09.: „umsortiert nach irgendwas“)
            {
                if (child.Role == Roles.Group)
                {
                    var e = c.Write(Ids.New(Roles.Rubric), Types.RubricCreated, new RubricCreated(target, new Labels(child.Label), NameOf(child), Source: child.Id)); n++; last = e;
                    Walk(e.Stream, child);
                }
                else if (child.Role == Roles.Product) { last = c.Write(target, Types.NodePlaced, new NodePlaced(child.Id)); n++; }
            }
        }
        // self (Taloan, 21.09.: Ast von links nach rechts ziehen): die Gruppe selbst wird Rubrik, ihr Aufbau darunter
        if (self) { var e = c.Write(Ids.New(Roles.Rubric), Types.RubricCreated, new RubricCreated(rubric, new Labels(src.Label), NameOf(src), Source: src.Id)); n++; last = e; Walk(e.Stream, src); }
        else Walk(rubric, src);
        count = n;
        return last is null ? Outcome.Bad("Nichts abzuleiten: keine Gruppen oder Produkte darunter.") : Outcome.Ok(last);
    }

    public static Outcome Move(Ctx c, string id, string? parent)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        if (!c.Tree.Nodes.TryGetValue(parent ?? "", out var target)) return Outcome.Bad("Ziel gibt es nicht.");
        var need = n.Role == Roles.Variant ? Roles.Product : n.Role == Roles.Rubric ? Roles.Rubric : Roles.Group;
        if (target.Role != need) return Outcome.Bad($"{n.Role} hängt unter {need}.");
        if (target.Id == n.Id || c.Tree.Ancestors(target).Any(a => a.Id == n.Id)) return Outcome.Bad("Nicht unter sich selbst.");
        return Outcome.Ok(c.Write(id, Types.NodeMoved, new NodeMoved(target.Id)));
    }

    /// <summary>Einordnen: unter parent (fehlt = bleibt, null bei Wurzeln) vor before (null = ans Ende). Umhängen wie Move; dann die Geschwister
    /// in ihrer sichtbaren Folge (Platz, sonst Name) neu nummerieren — nur die, deren Platz sich ändert, bekommen einen Eintrag.</summary>
    public static Outcome Order(Ctx c, string id, string? parent, string? before)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        parent = Blank(parent); before = Blank(before);
        if (parent != n.Parent)
        {
            if (parent is null) return Outcome.Bad("An die Wurzel geht nur ein Publikationsbaum.");
            var moved = Move(c, id, parent); if (moved.Error is not null) return moved;
        }
        var siblings = c.Tree.Children(parent).Where(s => s.Id != id && s.Role == n.Role)
            .OrderBy(s => s.Order ?? int.MaxValue).ThenBy(s => s.Name ?? s.Id, StringComparer.OrdinalIgnoreCase).ToList();
        var at = before is null ? siblings.Count : siblings.FindIndex(s => s.Id == before);
        if (at < 0) return Outcome.Bad("before: kein Geschwister.");
        siblings.Insert(at, n);
        Entry? last = null;
        for (var i = 0; i < siblings.Count; i++)
            if (siblings[i].Order != i) last = c.Write(siblings[i].Id, Types.NodeOrdered, new NodeOrdered(i));
        return Outcome.Ok(last ?? c.Write(id, Types.NodeOrdered, new NodeOrdered(at)));   // nichts geändert: der Platz steht trotzdem einmal im Journal
    }

    public static Outcome Retire(Ctx c, string id)
    {
        if (!c.Tree.Nodes.ContainsKey(id)) return Outcome.Missing;
        if (c.Tree.Children(id).Any()) return Outcome.Bad("Erst die Kinder entfernen.");
        return Outcome.Ok(c.Write(id, Types.NodeRetired, new NodeRetired()));
    }

    /// <summary>Zurückholen: der Knoten liegt im Papierkorb, sein Vater steht im Baum (oder er ist eine Wurzel).</summary>
    public static Outcome Restore(Ctx c, string id)
    {
        if (!c.Tree.Retired.TryGetValue(id, out var n)) return c.Tree.Nodes.ContainsKey(id) ? Outcome.Bad("Der Knoten ist nicht zurückgezogen.") : Outcome.Missing;
        if (n.Parent is not null && !c.Tree.Nodes.ContainsKey(n.Parent)) return Outcome.Bad("Erst den Knoten darüber zurückholen.");
        return Outcome.Ok(c.Write(id, Types.NodeRestored, new NodeRestored()));
    }

    public static Outcome SetStatus(Ctx c, string id, string? status)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        if (n.Role == Roles.Group) return Outcome.Bad("Eine Gruppe hat keinen Status.");
        if (!Statuses.All.Contains(status ?? "")) return Outcome.Bad($"Status: {string.Join(", ", Statuses.All)}");
        return Outcome.Ok(c.Write(id, Types.StatusSet, new StatusSet(status!)));
    }

    /// <summary>Beleg an einem Wert (ValueSourced): das Attribut muss es geben; ob der Wert gerade da ist, ist egal — der Beleg gilt für die Achse.</summary>
    public static Outcome SourceValue(Ctx c, string id, string? attribute, string? locale, string? channel, string? row, string? source, string? title, string? note, string? method, string? checkedAt)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out _)) return Outcome.Missing;
        if (string.IsNullOrWhiteSpace(attribute)) return Outcome.Bad("attribute fehlt.");
        if (!c.Model.Attributes.ContainsKey(attribute)) return Outcome.Bad($"Unbekanntes Attribut: {attribute}");
        method = Blank(method) ?? "manual";
        if (method is not ("web" or "ai" or "rule" or "import" or "manual" or "pending")) return Outcome.Bad("method: web, ai, rule, import, manual oder pending (angefragt — checkedAt = Wiedervorlage).");
        if (Blank(checkedAt) is { } d && !DateOnly.TryParse(d, out _)) return Outcome.Bad("checkedAt: Datum (JJJJ-MM-TT).");
        return Outcome.Ok(c.Write(id, Types.ValueSourced, new ValueSourced(attribute, Blank(locale), Blank(channel), Blank(row), Blank(source), Blank(title), Blank(note), method, Blank(checkedAt))));
    }

    public static Outcome SetAttribute(Ctx c, string id, string? attribute, string? locale, string? channel, string? value, string[]? values, string? row = null)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        if (string.IsNullOrWhiteSpace(attribute)) return Outcome.Bad("attribute fehlt.");
        if (!c.Model.Attributes.TryGetValue(attribute, out var def)) return Outcome.Bad($"Unbekanntes Attribut: {attribute}");
        if (def.Type == AttributeTypes.Rows) return Outcome.Bad($"{def.Key} ist vermehrbar — Zeilen über RowAdded, Zellen mit row.");
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
        // Achsenattribut an einer Variante (Taloan, 20.09.: Lücken später füllen): der Wert wird ihr Achsenwert — die Kombination muss eindeutig bleiben
        if (n.Role == Roles.Variant && n.Parent is { } pid && c.Tree.Nodes.TryGetValue(pid, out var prod) && prod.Axes.Contains(def.Key) && locale is null && channel is null && row is null && value is not null)
        {
            var mine = prod.Axes.Select(a => a == def.Key ? value : n.AxisValues.GetValueOrDefault(a)).ToList();
            if (mine.All(x => !string.IsNullOrEmpty(x)) && c.Tree.Children(pid).Any(s => s.Id != n.Id && prod.Axes.All(a => s.AxisValues.TryGetValue(a, out var x) && x == mine[Array.IndexOf(prod.Axes, a)])))
                return Outcome.Bad($"Diese Variante gibt es schon ({string.Join(", ", mine)}).");
        }
        // Eindeutig (Merkmal unique, Taloan 21.09.): kein zweiter Knoten mit demselben eigenen Wert auf dem Stern
        if (def.Unique && value is not null && locale is null && channel is null && row is null && c.Tree.WithOwnValue(def.Key, value).FirstOrDefault(o => o.Id != n.Id) is { } other)
            return Outcome.Bad($"{def.Label.GetValueOrDefault("de") ?? def.Key} {value} gibt es schon: {NodeRow.LabelOf(c.Tree, c.Model, other)} ({other.Id}).");
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
        if (!c.Model.Channels.ContainsKey(channel ?? "")) return Outcome.Bad("channel fehlt oder unbekannt.");
        locale = Blank(locale);
        if (locale is not null && !c.Model.Locales.ContainsKey(locale)) return Outcome.Bad($"Unbekannte Sprache: {locale}");
        // Am Produkt (Workflow „freigeben“, Taloan 21.09.): jede vollständige Variante wird freigegeben; keine vollständige = nichts, mit dem, was fehlt
        if (n.Role is Roles.Product or Roles.Group)
        {
            var variants = c.Tree.DescendantsDeepestFirst(n.Id).Where(v => v.Role == Roles.Variant).ToList();   // Gruppe: alles Verkaufbare darunter (Taloan, 21.09.)
            if (variants.Count == 0) return Outcome.Bad("Keine Variante — Freigabe gibt es nur am Verkaufbaren.");
            Entry? last = null; var failed = new List<string>();
            foreach (var v in variants)
            {
                if (v.Releases.Contains(new Release(channel!, locale))) continue;
                var r = GrantRelease(c, v.Id, channel, locale);
                if (r.Entry is { } e) last = e; else failed.Add($"{v.Own(Model.SkuAttribute, null, null) ?? v.Id}: {r.Error}");
            }
            if (last is null && failed.Count > 0) return Outcome.Bad("Keine Variante freigegeben — " + string.Join(" · ", failed));
            if (last is null) return Outcome.Bad("schon freigegeben");
            return Outcome.Ok(last);
        }
        if (n.Role != Roles.Variant) return Outcome.Bad("Freigabe nur an der Variante — sie ist das Verkaufbare.");
        // Freigabe setzt Vollständigkeit voraus — Sperre (docs/pflegestruktur.md, entschieden).
        var (_, missing) = CompletenessRules.Check(c.Tree, c.Model, n, CompletenessRules.ActiveAttributes(c.Tree, c.Model, n).ToList(), channel!, locale);
        if (missing.Length > 0) return Outcome.Bad($"Unvollständig für {channel}/{locale ?? "*"}: {string.Join(", ", missing)}");
        var granted = c.Write(id, Types.ReleaseGranted, new ReleaseGranted(channel!, locale));
        // Gegenstück zum Zurückgehen (Taloan, 21.09.): hat das System ein Produkt/eine Gruppe zurückgesetzt, weil keine Variante mehr frei war,
        // geht es mit der ersten neuen Freigabe wieder vor — nur dann; ein von Hand gesetzter Zustand bleibt
        if (c.Workflows is not null)
            foreach (var up in c.Tree.Ancestors(n))
                foreach (var (wfKey, nw) in c.Workflows.Of(up.Id))
                {
                    if (nw.Transition is not null || nw.Note?.StartsWith("↓ " + channel + ":") != true) continue;
                    if (!c.Workflows.All.TryGetValue(wfKey, out var wf)) continue;
                    var fwd = wf.Transitions.FirstOrDefault(x => x.From == nw.State && (x.Effects ?? []).Contains("release:" + channel));
                    if (fwd is null) continue;
                    c.Write(up.Id, Types.WorkflowStateSet, new WorkflowStateSet(wfKey, fwd.To, fwd.Key, $"↑ {channel}: {n.Own(Model.SkuAttribute, null, null) ?? n.Id}"));
                }
        return Outcome.Ok(granted);
    }

    public static Outcome RevokeRelease(Ctx c, string id, string channel, string? locale)
    {
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        // Am Produkt oder an der Gruppe (Taloan, 21.09.: „die Freigabe hätte ich am Produkt zurückziehen müssen“): alle freigegebenen Varianten darunter
        if (n.Role is Roles.Product or Roles.Group)
        {
            Entry? last = null;
            foreach (var v in c.Tree.DescendantsDeepestFirst(n.Id).Where(v => v.Role == Roles.Variant && v.Releases.Contains(new Release(channel, Blank(locale)))).ToList())
                last = c.Write(v.Id, Types.ReleaseRevoked, new ReleaseRevoked(channel, Blank(locale)));
            return last is null ? Outcome.Bad("schon zurückgenommen") : Outcome.Ok(last);
        }
        var e = c.Write(id, Types.ReleaseRevoked, new ReleaseRevoked(channel, Blank(locale)));
        // Nach oben (Taloan, 21.09.: „Produkt hat jetzt keine Variante mehr mit Freigabe — müssten die Knoten darüber wieder auf Prüfung?“):
        // ein Produkt oder eine Gruppe, deren Zustand über eine Wirkung release:<kanal> erreicht wurde und unter der jetzt keine Variante
        // mehr für den Kanal freigegeben ist, geht zurück in den Zustand vor dem Freigeben — als eigener Schritt im Journal, mit Notiz
        if (c.Workflows is not null)
            foreach (var up in c.Tree.Ancestors(n))
            {
                if (c.Tree.DescendantsDeepestFirst(up.Id).Any(v => v.Role == Roles.Variant && v.Releases.Contains(new Release(channel, null)))) continue;
                foreach (var (wfKey, nw) in c.Workflows.Of(up.Id))
                {
                    if (!c.Workflows.All.TryGetValue(wfKey, out var wf) || nw.Transition is null) continue;
                    var t = wf.Transitions.FirstOrDefault(x => x.Key == nw.Transition);
                    if (t?.Effects?.Contains("release:" + channel) != true || nw.State != t.To) continue;
                    c.Write(up.Id, Types.WorkflowStateSet, new WorkflowStateSet(wfKey, t.From, null, $"↓ {channel}: {n.Own(Model.SkuAttribute, null, null) ?? n.Id}"));
                }
            }
        return Outcome.Ok(e);
    }

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
        // eindeutige Werte (SKU, EAN …) kommen nicht mit — die Kopie bekäme sie sonst nicht, der Rest ginge verloren
        foreach (var (axis, v) in src.Values.Where(kv => kv.Key.Row is null && !(c.Model.Attributes.TryGetValue(kv.Key.Attribute, out var ad) && ad.Unique)))
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

    // ---- Workflows (27, Taloan 21.09.2026): ein Schritt gehen — Zustand, Rolle, Notiz, Wirkungen

    public static Outcome DefineWorkflow(Ctx c, string key, WorkflowDefined d)
    {
        if (d.States is not { Count: > 0 }) return Outcome.Bad("Mindestens ein Zustand.");
        var keys = d.States.Select(s => s.Key).ToList();
        if (keys.Any(k => string.IsNullOrWhiteSpace(k) || !k.All(ch => char.IsAsciiLetterLower(ch) || char.IsAsciiDigit(ch) || ch == '_'))) return Outcome.Bad("Zustands-Keys: a-z, 0-9, _.");
        if (keys.Distinct().Count() != keys.Count) return Outcome.Bad("Zustands-Keys doppelt.");
        var start = d.Start ?? keys[0];
        if (!keys.Contains(start)) return Outcome.Bad($"Start „{start}“ ist kein Zustand.");
        foreach (var t in d.Transitions ?? new())
        {
            if (string.IsNullOrWhiteSpace(t.Key)) return Outcome.Bad("Übergang ohne Key.");
            if (!keys.Contains(t.From) || !keys.Contains(t.To)) return Outcome.Bad($"Übergang {t.Key}: von/nach muss ein Zustand sein.");
            if (t.EscalateAfterDays is { } ed && ed < 0) return Outcome.Bad($"Übergang {t.Key}: Eskalation nach n Tagen, n ≥ 0.");
            foreach (var e in t.Effects ?? []) if (!(e.StartsWith("release:") || e.StartsWith("revoke:") || e.StartsWith("status:"))) return Outcome.Bad($"Übergang {t.Key}: Wirkung „{e}“ unbekannt (release:<kanal>, revoke:<kanal>, status:<wert>).");
        }
        if ((d.Transitions ?? new()).Select(t => t.Key).Distinct().Count() != (d.Transitions ?? new()).Count) return Outcome.Bad("Übergangs-Keys doppelt.");
        return Outcome.Ok(c.Write(Workflows.Stream + key, Types.WorkflowDefined, d with { Start = start }));
    }

    public static Outcome RetireWorkflow(Ctx c, string key) =>
        c.Workflows?.All.ContainsKey(key) == true ? Outcome.Ok(c.Write(Workflows.Stream + key, Types.WorkflowRetired, new WorkflowRetired())) : Outcome.Missing;

    /// <summary>Welche Übergänge darf diese Rolle am Knoten jetzt gehen? (null-Rolle = offen, alles)</summary>
    public static IEnumerable<WfTransition> Allowed(Workflows w, WorkflowDef wf, string nodeId, string? role, DateTimeOffset? now = null)
    {
        var state = w.StateOf(nodeId, wf);
        var since = w.Of(nodeId).GetValueOrDefault(wf.Key)?.At;
        return wf.Transitions.Where(t => t.From == state && (role is null || role == "admin" || t.Roles is not { Length: > 0 } || t.Roles.Contains(role) || Escalated(t, role, since, now ?? DateTimeOffset.UtcNow)));
    }

    /// <summary>Eskalation: der Übergang hat EscalateAfterDays, der Zustand steht so lange, und die Rolle ist eine der EscalateRoles (leer = jede).</summary>
    public static bool Escalated(WfTransition t, string role, DateTimeOffset? since, DateTimeOffset now) =>
        t.EscalateAfterDays is { } d && since is { } s && (now - s).TotalDays >= d && (t.EscalateRoles is not { Length: > 0 } || t.EscalateRoles.Contains(role));

    /// <summary>Einen Schritt gehen: Übergang muss vom aktuellen Zustand ausgehen, die Rolle ihn dürfen, die Notiz da sein — dann Zustand und Wirkungen.</summary>
    /// <summary>Fehlender Pflichtwert „attr/locale“ mit Grund: steht nur über Master oder Fallback da → „nur Master-Text, Übersetzung fehlt“.</summary>
    private static string Explain(Ctx c, Node v, string missing)
    {
        var i = missing.IndexOf('/'); if (i < 0) return missing;
        var attr = missing[..i]; var loc = missing[(i + 1)..];
        if (!c.Model.Attributes.TryGetValue(attr, out var def)) return missing;
        var viaMaster = c.Tree.Resolve(v, attr, loc, null, def.Inheritable, masters: true).Value is not null;
        return viaMaster ? $"{missing} (nur Master-Text — Übersetzung fehlt)" : missing;
    }

    public static Outcome WorkflowStep(Ctx c, string id, string workflow, string transition, string? note)
    {
        if (c.Workflows is null || !c.Workflows.All.TryGetValue(workflow, out var wf)) return Outcome.Bad($"Unbekannter Workflow {workflow}.");
        if (!c.Tree.Nodes.TryGetValue(id, out var n)) return Outcome.Missing;
        if (!wf.AppliesTo(n)) return Outcome.Bad($"Workflow „{wf.Label.GetValueOrDefault("de") ?? wf.Key}“ gilt nicht für {n.Role}.");
        var t = wf.Transitions.FirstOrDefault(x => x.Key == transition);
        if (t is null) return Outcome.Bad($"Unbekannter Übergang {transition}.");
        var state = c.Workflows.StateOf(id, wf);
        if (t.From != state) return Outcome.Bad($"„{t.Label.GetValueOrDefault("de") ?? t.Key}“ geht von {t.From} aus, der Knoten ist in {state}.");
        var since = c.Workflows.Of(id).GetValueOrDefault(wf.Key)?.At;
        if (c.Role is { } role && role != "admin" && t.Roles is { Length: > 0 } && !t.Roles.Contains(role) && !Escalated(t, role, since, DateTimeOffset.UtcNow)) return Outcome.Bad($"Rolle {role} darf „{t.Label.GetValueOrDefault("de") ?? t.Key}“ nicht (erlaubt: {string.Join(", ", t.Roles)}).");
        note = Blank(note);
        if (t.NoteRequired && note is null) return Outcome.Bad("Notiz ist Pflicht bei diesem Schritt (was ist zu tun?).");
        foreach (var eff in t.Effects ?? [])
        {
            if (!eff.StartsWith("release:")) continue;
            var ch = eff[8..];
            var sellables = n.Role == Roles.Variant ? [n] : c.Tree.DescendantsDeepestFirst(n.Id).Where(v => v.Role == Roles.Variant).ToList();
            if (sellables.Count == 0) return Outcome.Bad($"„{t.Label.GetValueOrDefault("de") ?? t.Key}“ gibt für {ch} frei — hier gibt es aber nichts Verkaufbares (Freigabe nur an Varianten).");
            var problems = new List<string>();
            foreach (var v in sellables)
            {
                if (v.Releases.Contains(new Release(ch, null))) { problems.Clear(); break; }
                var (_, missing) = CompletenessRules.Check(c.Tree, c.Model, v, CompletenessRules.ActiveAttributes(c.Tree, c.Model, v).ToList(), ch, null);
                if (missing.Length == 0) { problems.Clear(); break; }
                problems.Add($"{v.Own(Model.SkuAttribute, null, null) ?? v.Id}: {string.Join(", ", missing.Select(m => Explain(c, v, m)))}");
            }
            if (problems.Count > 0) return Outcome.Bad($"„{t.Label.GetValueOrDefault("de") ?? t.Key}“ geht nicht: keine Variante ist vollständig für {ch} — {string.Join(" · ", problems)}");
        }
        var e = c.Write(id, Types.WorkflowStateSet, new WorkflowStateSet(workflow, t.To, t.Key, note));
        foreach (var eff in t.Effects ?? [])
        {
            var i = eff.IndexOf(':'); var kind = eff[..i]; var arg = eff[(i + 1)..];
            var r = kind switch { "release" => GrantRelease(c, id, arg, null), "revoke" => RevokeRelease(c, id, arg, null), "status" => SetStatus(c, id, arg), _ => Outcome.Bad(eff) };
            if (r.Error is { } err && !err.Contains("schon")) return Outcome.Bad($"Schritt gegangen, Wirkung {eff} nicht: {err}");
        }
        return Outcome.Ok(e);
    }

    public static Outcome AssignWorkflow(Ctx c, string id, string workflow, string? user)
    {
        if (c.Workflows is null || !c.Workflows.All.ContainsKey(workflow)) return Outcome.Bad($"Unbekannter Workflow {workflow}.");
        if (!c.Tree.Nodes.ContainsKey(id)) return Outcome.Missing;
        return Outcome.Ok(c.Write(id, Types.WorkflowAssigned, new WorkflowAssigned(workflow, Blank(user))));
    }

    // ---- Medienordner (Taloan, 21.09.2026: „wie ein interner Dateimanager“)

    public static Outcome CreateMediaFolder(Ctx c, string? name, string? parent)
    {
        if (Blank(name) is not { } n) return Outcome.Bad("Name fehlt.");
        parent = Blank(parent);
        if (parent is not null && !c.Media.Folders.ContainsKey(parent)) return Outcome.Bad("Vater: Ordner gibt es nicht.");
        if (c.Media.SubFolders(parent).Any(f => string.Equals(f.Name, n, StringComparison.OrdinalIgnoreCase))) return Outcome.Bad($"„{n}“ gibt es hier schon.");
        return Outcome.Ok(c.Write(Ids.MediaFolder(), Types.MediaFolderCreated, new MediaFolderCreated(n, parent)));
    }

    public static Outcome RenameMediaFolder(Ctx c, string id, string? name)
    {
        if (!c.Media.Folders.TryGetValue(id, out var f)) return Outcome.Missing;
        if (Blank(name) is not { } n) return Outcome.Bad("Name fehlt.");
        if (c.Media.SubFolders(f.Parent).Any(x => x.Id != id && string.Equals(x.Name, n, StringComparison.OrdinalIgnoreCase))) return Outcome.Bad($"„{n}“ gibt es hier schon.");
        return Outcome.Ok(c.Write(id, Types.MediaFolderRenamed, new MediaFolderRenamed(n)));
    }

    public static Outcome MoveMediaFolder(Ctx c, string id, string? parent)
    {
        if (!c.Media.Folders.TryGetValue(id, out var f)) return Outcome.Missing;
        parent = Blank(parent);
        if (parent is not null && !c.Media.Folders.ContainsKey(parent)) return Outcome.Bad("Ziel: Ordner gibt es nicht.");
        if (parent is not null && c.Media.FolderAndBelow(id).Contains(parent)) return Outcome.Bad("Nicht in sich selbst.");
        if (c.Media.SubFolders(parent).Any(x => x.Id != id && string.Equals(x.Name, f.Name, StringComparison.OrdinalIgnoreCase))) return Outcome.Bad($"„{f.Name}“ gibt es dort schon.");
        return Outcome.Ok(c.Write(id, Types.MediaFolderMoved, new MediaFolderMoved(parent)));
    }

    /// <summary>Nur leer — was drin ist, erst verschieben (Taloan: kein stilles Aufräumen, das Journal soll jede Ablage nennen).</summary>
    public static Outcome RetireMediaFolder(Ctx c, string id)
    {
        if (!c.Media.Folders.ContainsKey(id)) return Outcome.Missing;
        var subs = c.Media.SubFolders(id).Count(); var media = c.Media.InFolder(id).Count();
        if (subs + media > 0) return Outcome.Bad($"Nicht leer: {subs} Unterordner, {media} Medien — erst verschieben.");
        return Outcome.Ok(c.Write(id, Types.MediaFolderRetired, new MediaFolderRetired()));
    }

    /// <summary>Medium in einen Ordner legen (null = kein Ordner).</summary>
    public static Outcome FileMedium(Ctx c, string id, string? folder)
    {
        if (!c.Media.All.TryGetValue(id, out var m)) return Outcome.Missing;
        folder = Blank(folder);
        if (folder is not null && !c.Media.Folders.ContainsKey(folder)) return Outcome.Bad("Ordner gibt es nicht.");
        if (m.Folder == folder) return Outcome.Bad("Liegt schon dort.");
        return Outcome.Ok(c.Write(id, Types.MediaFiled, new MediaFiled(folder)));
    }

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
