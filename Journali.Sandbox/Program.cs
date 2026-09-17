using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;

// Sandbox: ein Journal füllen, die Abbilder daraus bauen, ausgeben.
// Zeigt den Kern: Modell säen, Gruppen an den Baum hängen, Werte setzen, Vererbung ablesen.

var journal = new MemoryJournal();

// Das Modell zuerst — es steht im Journal wie alles andere.
foreach (var s in Model.Seeds())
    journal.Append("system", s.Stream, s.Type, s.Payload);
// Kategorie: vererbbar — der Wert gilt nach unten.
journal.Append("anna", Model.AttributeStream + "category", Types.AttributeDefined,
    Types.Serialize(new AttributeDefinition("category", Labels.Of("Kategorie", "Category"), AttributeTypes.Text, Group: "texts", Inheritable: true)));

// Baum: Gruppe → Produkt → zwei Varianten; Attributgruppen hängen an der Wurzel und vererben ihre Definition.
var root = Ids.New(Roles.Group);
var product = Ids.New(Roles.Product);
var v1 = Ids.New(Roles.Variant);
var v2 = Ids.New(Roles.Variant);
journal.Append("anna", root, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("Winterschuhe", "Winter shoes"))));
journal.Append("anna", root, Types.GroupsAttached, Types.Serialize(new GroupsAttached(["texts", "physical", "logistics"])));
journal.Append("anna", product, Types.ProductCreated, Types.Serialize(new ProductCreated(root)));
journal.Append("anna", v1, Types.VariantCreated, Types.Serialize(new VariantCreated(product, new())));
journal.Append("anna", v2, Types.VariantCreated, Types.Serialize(new VariantCreated(product, new())));

Set("anna", root, "category", null, null, "Schuhe");             // vererbbar: gilt für alles darunter
Set("anna", root, "weight", null, null, "1.0");                 // nicht vererbbar: nur die Gruppe selbst
Set("anna", product, "name", "de", null, "Stiefel");
Set("anna", product, "name", "en", null, "Boots");
Set("bert", v1, "sku", null, null, "ST-42");
Set("bert", v2, "sku", null, null, "ST-43");
Set("bert", v2, "name", "de", null, "Stiefel 43");

var model = new ModelCatalog();
Projector.CatchUp(journal, model);
var tree = new Tree();
var applied = Projector.CatchUp(journal, tree);

Console.WriteLine($"Journal: {journal.Head} Einträge, Abbild nachgezogen um {applied}");
Console.WriteLine($"Modell: {model.Locales.Count} Sprachen, {model.Channels.Count} Kanäle, {model.Attributes.Count} Attribute, {model.Groups.Count} Gruppen");
Console.WriteLine();
Print(tree.Roots, 0);

void Print(IEnumerable<Node> nodes, int depth)
{
    foreach (var n in nodes)
    {
        var pad = new string(' ', depth * 2);
        var head = n.Role switch
        {
            Roles.Group => $"▣ {n.Label.GetValueOrDefault("de")}",
            Roles.Product => $"▦ {tree.Resolve(model, n, "name", "de", null).Value}",
            _ => $"◆ sku={n.Own("sku", null, null)}",
        };
        var groups = string.Join(", ", tree.EffectiveGroups(n).Select(g => $"{g.Group}{(model.GroupActiveAt(g.Group, n.Role) ? "" : "(gesperrt)")}"));
        Console.WriteLine($"{pad}{head}  [{n.Id}, Gruppen: {groups}]");
        foreach (var attr in new[] { "name", "category", "weight" })
        {
            var (value, from) = tree.Resolve(model, n, attr, "de", null);
            Console.WriteLine($"{pad}    {attr,-9} → {value ?? "–"}{(from is not null && from != n ? $"  (geerbt von {from.Id})" : "")}");
        }
        foreach (var c in CompletenessRules.Of(tree, model, n))
            Console.WriteLine($"{pad}    {c.Channel}/{c.Locale}: {c.Filled}/{c.Required}{(c.Missing.Length > 0 ? " fehlt " + string.Join(", ", c.Missing) : "")}");
        Print(tree.Children(n.Id), depth + 1);
    }
}

void Set(string actor, string node, string attribute, string? locale, string? channel, string value) =>
    journal.Append(actor, node, Types.AttributeSet, Types.Serialize(new AttributeSet(attribute, locale, channel, value)));
