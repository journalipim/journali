using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;

// Sandbox: ein Journal füllen, die Abbilder daraus bauen, ausgeben.
// Zeigt den Kern: Modell säen, Baum anlegen, Werte setzen, Vererbung ablesen.

var journal = new MemoryJournal();

// Das Modell zuerst — es steht im Journal wie alles andere.
foreach (var s in Model.Seeds())
    journal.Append("system", s.Stream, s.Type, s.Payload);
journal.Append("anna", Model.FamilyStream + "shoe", Types.FamilyDefined,
    Types.Serialize(new FamilyDefinition("shoe", Labels.Of("Schuh", "Shoe"), [new("name"), new("weight"), new("sku")])));

// Baum: Gruppe → Produkt → zwei Varianten
var root = Ids.New(Roles.Group);
var product = Ids.New(Roles.Product);
var v1 = Ids.New(Roles.Variant);
var v2 = Ids.New(Roles.Variant);
journal.Append("anna", root, Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("Winterschuhe", "Winter shoes"))));
journal.Append("anna", product, Types.ProductCreated, Types.Serialize(new ProductCreated(root, "shoe")));
journal.Append("anna", v1, Types.VariantCreated, Types.Serialize(new VariantCreated(product, new() { ["size"] = "42" })));
journal.Append("anna", v2, Types.VariantCreated, Types.Serialize(new VariantCreated(product, new() { ["size"] = "43" })));

Set("anna", root, "weight", null, null, "1.0");                 // Gruppe: gilt für alles darunter
Set("anna", product, "name", "de", null, "Stiefel");
Set("anna", product, "name", "en", null, "Boots");
Set("anna", product, "name", "de", "web", "Winterstiefel, gefüttert");
Set("bert", v1, "sku", null, null, "ST-42");
Set("bert", v2, "sku", null, null, "ST-43");
Set("bert", v2, "weight", null, null, "1.1");                   // Variante überschreibt die Gruppe
journal.Append("anna", v1, Types.ReleaseGranted, Types.Serialize(new ReleaseGranted("web", "de")));

var model = new ModelCatalog();
Projector.CatchUp(journal, model);
var tree = new Tree();
var applied = Projector.CatchUp(journal, tree);

Console.WriteLine($"Journal: {journal.Head} Einträge, Abbild nachgezogen um {applied}");
Console.WriteLine($"Modell: {model.Locales.Count} Sprachen, {model.Channels.Count} Kanäle, {model.Attributes.Count} Attribute, {model.Families.Count} Familien");
Console.WriteLine();
foreach (var e in journal.ReadAfter(0).Where(e => !e.Stream.Contains(':')))
    Console.WriteLine($"#{e.Number,-3} {e.Actor,-5} {e.Stream,-11} {e.Type,-15} {e.Payload}");

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
            Roles.Product => $"▦ {n.Family} {tree.Resolve(n, "name", "de", null).Value}",
            _ => $"◆ {string.Join(",", n.AxisValues.Select(kv => $"{kv.Key}={kv.Value}"))} sku={n.Own("sku", null, null)}",
        };
        Console.WriteLine($"{pad}{head}  [{n.Id}, {n.Entries} Einträge, {n.Status}]");
        foreach (var attr in new[] { "name", "weight" })
        {
            var (value, from) = tree.Resolve(n, attr, "de", "web");
            if (value is not null)
                Console.WriteLine($"{pad}    {attr} de/web → {value}{(from == n ? "" : $"  (geerbt von {from!.Id})")}");
        }
        Print(tree.Children(n.Id), depth + 1);
    }
}

void Set(string actor, string node, string attribute, string? locale, string? channel, string value) =>
    journal.Append(actor, node, Types.AttributeSet, Types.Serialize(new AttributeSet(attribute, locale, channel, value)));
