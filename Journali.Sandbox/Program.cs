using System.Text.Json;
using Journali.Core.Journal;
using Journali.Core.Projections;

// Sandbox: ein Journal füllen, ein Abbild daraus bauen, beides ausgeben.
// Zeigt den Kern in dreissig Zeilen: anhängen, nachziehen, ablesen.

var journal = new MemoryJournal();
// Umlaute lesbar lassen statt ü — das Journal ist zum Anschauen da.
var Json = new JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

Set("anna", "4711", "name", "de", null, "Stiefel");
Set("anna", "4711", "name", "en", null, "Boots");
Set("anna", "4711", "name", "de", "web", "Winterstiefel, gefüttert");
Set("anna", "4711", "weight", null, null, "1.2");
Set("bert", "4711", "name", "de", null, "Winterstiefel");
journal.Append("anna", "4711", "ReleaseGranted", """{"channel":"web","locale":"de"}""");

var current = new CurrentValues();
var applied = Projector.CatchUp(journal, current);

Console.WriteLine($"Journal: {journal.Head} Einträge, Abbild nachgezogen um {applied}");
Console.WriteLine();
foreach (var e in journal.ReadAfter(0))
    Console.WriteLine($"#{e.Number,-3} {e.At:HH:mm:ss} {e.Actor,-5} {e.Stream,-5} {e.Type,-13} {e.Payload}");

Console.WriteLine();
Console.WriteLine("Aktuelle Werte (Strom | Attribut | Sprache | Kanal → Wert):");
foreach (var (key, value) in current.Values.OrderBy(kv => kv.Key))
    Console.WriteLine($"  {key,-28} → {value}");

void Set(string actor, string sku, string attribute, string? locale, string? channel, string value)
{
    var payload = JsonSerializer.Serialize(new { attribute, locale, channel, value }, Json);
    journal.Append(actor, sku, "AttributeSet", payload);
}

/// <summary>
/// Abbild „aktueller Wert je Achse": der letzte AttributeSet gewinnt.
/// Schlüssel ist Strom|Attribut|Sprache|Kanal — die Achsen aus docs/architektur.md.
/// </summary>
sealed class CurrentValues : IProjection
{
    public long LastApplied { get; private set; }
    public Dictionary<string, string> Values { get; } = new();

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        if (entry.Type != "AttributeSet") return;

        var p = JsonSerializer.Deserialize<AttributeSet>(entry.Payload)!;
        var key = $"{entry.Stream}|{p.attribute}|{p.locale ?? "*"}|{p.channel ?? "*"}";
        Values[key] = p.value;
    }

    private sealed record AttributeSet(string attribute, string? locale, string? channel, string value);
}
