using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;

// Sandbox: ein Journal füllen, ein Abbild daraus bauen, beides ausgeben.
// Zeigt den Kern in dreissig Zeilen: anhängen, nachziehen, ablesen.

var journal = new MemoryJournal();

Set("anna", "4711", "name", "de", null, "Stiefel");
Set("anna", "4711", "name", "en", null, "Boots");
Set("anna", "4711", "name", "de", "web", "Winterstiefel, gefüttert");
Set("anna", "4711", "weight", null, null, "1.2");
Set("bert", "4711", "name", "de", null, "Winterstiefel");
journal.Append("anna", "4711", Types.CategoryAssigned, Types.Serialize(new CategoryAssigned("schuhe/winter")));
journal.Append("anna", "4711", Types.ReleaseGranted, Types.Serialize(new ReleaseGranted("web", "de")));

var catalog = new ProductCatalog();
var applied = Projector.CatchUp(journal, catalog);

Console.WriteLine($"Journal: {journal.Head} Einträge, Abbild nachgezogen um {applied}");
Console.WriteLine();
foreach (var e in journal.ReadAfter(0))
    Console.WriteLine($"#{e.Number,-3} {e.At:HH:mm:ss} {e.Actor,-5} {e.Stream,-5} {e.Type,-16} {e.Payload}");

foreach (var p in catalog.Products.Values)
{
    Console.WriteLine();
    Console.WriteLine($"Produkt {p.Sku}: {p.Entries} Einträge, zuletzt #{p.LastNumber} von {p.LastActor}");
    Console.WriteLine("  Werte (Attribut | Sprache | Kanal → Wert):");
    foreach (var (axis, value) in p.Values.OrderBy(kv => kv.Key.ToString()))
        Console.WriteLine($"    {axis.Attribute,-12} {axis.Locale ?? "*",-3} {axis.Channel ?? "*",-5} → {value}");
    Console.WriteLine($"  Kategorien: {string.Join(", ", p.Categories)}");
    Console.WriteLine($"  Freigaben:  {string.Join(", ", p.Releases.Select(r => $"{r.Channel}/{r.Locale ?? "*"}"))}");
    Console.WriteLine($"  name de web → {p.Resolve("name", "de", "web")}, name en print → {p.Resolve("name", "en", "print")}");
}

void Set(string actor, string sku, string attribute, string? locale, string? channel, string value) =>
    journal.Append(actor, sku, Types.AttributeSet, Types.Serialize(new AttributeSet(attribute, locale, channel, value)));
