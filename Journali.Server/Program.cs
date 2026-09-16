using System.Text.Encodings.Web;
using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Npgsql;

// Der Server: Journal in PostgreSQL, Abbild „Produkte" im Speicher, Befehle
// als Endpunkte unter /api, die Oberfläche (web/, gebaut nach wwwroot) daneben.
// Regel: kein Schreibpfad an Catalog.Execute vorbei (docs/architektur.md).

var builder = WebApplication.CreateBuilder(args);

// Verbindung: JOURNALI_DB (ohne Passwort, appsettings.json) plus
// JOURNALI_DB_PASSWORD aus user-secrets oder Umgebung. Nie im Repo (docs/betrieb.md).
var connection = new NpgsqlConnectionStringBuilder(
    builder.Configuration["JOURNALI_DB"]
    ?? throw new InvalidOperationException("JOURNALI_DB fehlt — siehe docs/betrieb.md."));
if (builder.Configuration["JOURNALI_DB_PASSWORD"] is { Length: > 0 } password)
    connection.Password = password;

PostgresJournal.EnsureDatabase(connection.ConnectionString);
var journal = new PostgresJournal(NpgsqlDataSource.Create(connection.ConnectionString));
journal.EnsureSchema();
var catalog = new Catalog(journal);
var rebuilt = catalog.Rebuild();

builder.Services.AddSingleton<IJournal>(journal);
builder.Services.AddSingleton(catalog);

// Umlaute lesbar lassen statt \u00fc — das Journal ist zum Anschauen da.
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping);

// Vite-Entwicklungsserver (localhost:5173) darf direkt auf die API, wenn
// in den Einstellungen ein anderer Server eingetragen ist als der eigene.
if (builder.Environment.IsDevelopment())
    builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.Logger.LogInformation("Abbild aus {Count} Einträgen gebaut, Stand #{Head}", rebuilt, catalog.Head);

if (app.Environment.IsDevelopment()) app.UseCors();

var api = app.MapGroup("/api");

// ---- Stand und Modell ----------------------------------------------------

api.MapGet("/health", (Catalog c) => new
{
    head = c.Head,
    products = c.Read(p => p.Count),
});

api.MapGet("/model", () => new
{
    locales = Model.Locales,
    channels = Model.Channels,
    attributes = Model.Attributes,
});

// ---- Produkte (Abbild) ---------------------------------------------------

api.MapGet("/products", (Catalog c, string? q) => c.Read(products =>
    products.Values
        .Where(p => q is null || p.Sku.Contains(q, StringComparison.OrdinalIgnoreCase)
                    || (p.Resolve("name", "de", null)?.Contains(q, StringComparison.OrdinalIgnoreCase) ?? false))
        .OrderBy(p => p.Sku)
        .Select(ProductRow.Of)
        .ToList()));

api.MapGet("/products/{sku}", (string sku, Catalog c) =>
    c.Read(products => products.TryGetValue(sku, out var p) ? ProductView.Of(p) : null)
        is { } view ? Results.Ok(view) : Results.NotFound());

// ---- Befehle: genau ein Eintrag je Aufruf ----------------------------------

api.MapPost("/products/{sku}/attributes", (string sku, AttributeSet body, HttpRequest req, Catalog c) =>
{
    if (Actor(req) is not { } actor) return ActorMissing();
    if (string.IsNullOrWhiteSpace(body.Attribute)) return Results.BadRequest(new { error = "attribute fehlt." });
    if (Model.Attributes.FirstOrDefault(a => a.Name == body.Attribute) is not { } def)
        return Results.BadRequest(new { error = $"Unbekanntes Attribut: {body.Attribute}" });
    var locale = Blank(body.Locale);
    var channel = Blank(body.Channel);
    if ((locale is not null && !def.PerLocale) || (channel is not null && !def.PerChannel))
        return Results.BadRequest(new { error = $"{body.Attribute} hat diese Achse nicht." });

    var entry = c.Execute(actor, sku, Types.AttributeSet,
        new AttributeSet(body.Attribute, locale, channel, body.Value ?? ""));
    return Results.Ok(EntryView.Of(entry));
});

api.MapPost("/products/{sku}/categories", (string sku, CategoryAssigned body, HttpRequest req, Catalog c) =>
    Actor(req) is { } actor
        ? string.IsNullOrWhiteSpace(body.Category)
            ? Results.BadRequest(new { error = "category fehlt." })
            : Results.Ok(EntryView.Of(c.Execute(actor, sku, Types.CategoryAssigned, body)))
        : ActorMissing());

api.MapDelete("/products/{sku}/categories/{category}", (string sku, string category, HttpRequest req, Catalog c) =>
    Actor(req) is { } actor
        ? Results.Ok(EntryView.Of(c.Execute(actor, sku, Types.CategoryRemoved, new CategoryRemoved(category))))
        : ActorMissing());

api.MapPost("/products/{sku}/releases", (string sku, ReleaseGranted body, HttpRequest req, Catalog c) =>
    Actor(req) is { } actor
        ? string.IsNullOrWhiteSpace(body.Channel)
            ? Results.BadRequest(new { error = "channel fehlt." })
            : Results.Ok(EntryView.Of(c.Execute(actor, sku, Types.ReleaseGranted, body with { Locale = Blank(body.Locale) })))
        : ActorMissing());

api.MapDelete("/products/{sku}/releases", (string sku, string channel, string? locale, HttpRequest req, Catalog c) =>
    Actor(req) is { } actor
        ? Results.Ok(EntryView.Of(c.Execute(actor, sku, Types.ReleaseRevoked, new ReleaseRevoked(channel, Blank(locale)))))
        : ActorMissing());

// ---- Journal (roh) ---------------------------------------------------------

api.MapPost("/journal", (AppendRequest r, Catalog c) =>
{
    if (string.IsNullOrWhiteSpace(r.Actor) || string.IsNullOrWhiteSpace(r.Stream)
        || string.IsNullOrWhiteSpace(r.Type) || r.Payload.ValueKind is JsonValueKind.Undefined)
        return Results.BadRequest(new { error = "actor, stream, type und payload sind Pflicht." });

    var entry = c.AppendRaw(r.Actor, r.Stream, r.Type, r.Payload.GetRawText());
    return Results.Created($"/api/journal/{entry.Number}", EntryView.Of(entry));
});

// Delta: alles nach Nummer `after`, höchstens `limit` Stück — der Abnehmer
// merkt sich die letzte Nummer und fragt wieder.
api.MapGet("/journal", (IJournal j, long after = 0, int limit = 1000) =>
    j.ReadAfter(after).Take(Math.Clamp(limit, 1, 10_000)).Select(EntryView.Of));

api.MapGet("/journal/{number:long}", (long number, IJournal j) =>
    j.ReadAfter(number - 1).FirstOrDefault() is { } e && e.Number == number
        ? Results.Ok(EntryView.Of(e))
        : Results.NotFound());

api.MapGet("/streams/{stream}", (string stream, IJournal j) => j.ReadStream(stream).Select(EntryView.Of));

// ---- Oberfläche: web/ gebaut nach wwwroot, alles Unbekannte an index.html ----

app.UseDefaultFiles();
app.UseStaticFiles();
app.MapFallbackToFile("index.html");

app.Run();

// Wer handelt, sagt der Client im Kopf X-Actor (Einstellungen). Bis es eine
// Anmeldung gibt, ist das die ganze Wahrheit über den Urheber.
static string? Actor(HttpRequest req) =>
    req.Headers.TryGetValue("X-Actor", out var v) && !string.IsNullOrWhiteSpace(v) ? v.ToString() : null;

static IResult ActorMissing() => Results.BadRequest(new { error = "Kopf X-Actor fehlt — Name in den Einstellungen setzen." });

static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s;

/// <summary>Rumpf von POST /api/journal. Payload ist beliebiges JSON, die Form hängt von Type ab.</summary>
sealed record AppendRequest(string Actor, string Stream, string Type, JsonElement Payload);

/// <summary>
/// Ein Eintrag in der Antwort: wie <see cref="Entry"/>, nur ist der Payload
/// eingebettetes JSON statt eines Strings mit JSON darin — der Client parst einmal.
/// </summary>
sealed record EntryView(long Number, DateTimeOffset At, string Actor, string Stream, string Type, JsonElement Payload)
{
    public static EntryView Of(Entry e) =>
        new(e.Number, e.At, e.Actor, e.Stream, e.Type, JsonDocument.Parse(e.Payload).RootElement.Clone());
}

/// <summary>Zeile in der Produktliste.</summary>
sealed record ProductRow(string Sku, string? Name, int Categories, int Releases, int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor)
{
    public static ProductRow Of(ProductState p) =>
        new(p.Sku, p.Resolve("name", "de", null), p.Categories.Count, p.Releases.Count, p.Entries, p.LastNumber, p.LastAt, p.LastActor);
}

/// <summary>Ein Wert auf seinen Achsen, wie er im Abbild steht.</summary>
sealed record ValueView(string Attribute, string? Locale, string? Channel, string Value);

/// <summary>Ein Produkt vollständig — Kopie aus dem Abbild, ausserhalb der Sperre ungefährlich.</summary>
sealed record ProductView(string Sku, List<ValueView> Values, List<string> Categories, List<Release> Releases, int Entries, long LastNumber, DateTimeOffset LastAt, string LastActor)
{
    public static ProductView Of(ProductState p) => new(
        p.Sku,
        p.Values.Select(kv => new ValueView(kv.Key.Attribute, kv.Key.Locale, kv.Key.Channel, kv.Value)).ToList(),
        p.Categories.Order().ToList(),
        p.Releases.ToList(),
        p.Entries, p.LastNumber, p.LastAt, p.LastActor);
}
