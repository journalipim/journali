using System.Text.Encodings.Web;
using System.Text.Json;
using Journali.Core.Journal;
using Journali.Server;
using Npgsql;

// Der Server: ein Journal in PostgreSQL hinter vier HTTP-Endpunkten.
// Anhängen, Delta lesen, Strom lesen, Stand. Sonst nichts — Abbilder
// kommen als eigene Leser dazu (docs/architektur.md).

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
builder.Services.AddSingleton<IJournal>(journal);

// Umlaute lesbar lassen statt \u00fc — das Journal ist zum Anschauen da.
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping);

var app = builder.Build();

app.MapGet("/health", (IJournal j) => new { head = j.Head });

app.MapPost("/journal", (AppendRequest r, IJournal j) =>
{
    if (string.IsNullOrWhiteSpace(r.Actor) || string.IsNullOrWhiteSpace(r.Stream)
        || string.IsNullOrWhiteSpace(r.Type) || r.Payload.ValueKind is JsonValueKind.Undefined)
        return Results.BadRequest(new { error = "actor, stream, type und payload sind Pflicht." });

    var entry = j.Append(r.Actor, r.Stream, r.Type, r.Payload.GetRawText());
    return Results.Created($"/journal/{entry.Number}", EntryView.Of(entry));
});

// Delta: alles nach Nummer `after`, höchstens `limit` Stück — der Abnehmer
// merkt sich die letzte Nummer und fragt wieder.
app.MapGet("/journal", (IJournal j, long after = 0, int limit = 1000) =>
    j.ReadAfter(after).Take(Math.Clamp(limit, 1, 10_000)).Select(EntryView.Of));

app.MapGet("/journal/{number:long}", (long number, IJournal j) =>
    j.ReadAfter(number - 1).FirstOrDefault() is { } e && e.Number == number
        ? Results.Ok(EntryView.Of(e))
        : Results.NotFound());

app.MapGet("/streams/{stream}", (string stream, IJournal j) => j.ReadStream(stream).Select(EntryView.Of));

app.Run();

/// <summary>Rumpf von POST /journal. Payload ist beliebiges JSON, die Form hängt von Type ab.</summary>
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
