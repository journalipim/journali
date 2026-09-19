using System.Text.Encodings.Web;
using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Npgsql;
using static Journali.Server.ModelApi;

// Der Server: Journal in PostgreSQL, Abbilder „Modell" und „Baum" im
// Speicher, Befehle als Endpunkte unter /api, die Oberfläche (web/, gebaut
// nach wwwroot) daneben. Regel: kein Schreibpfad am Catalog vorbei.

var builder = WebApplication.CreateBuilder(args);

// Verbindung: JOURNALI_DB (ohne Passwort, appsettings.json) plus
// JOURNALI_DB_PASSWORD aus user-secrets oder Umgebung. Nie im Repo (docs/betrieb.md).
var connection = new NpgsqlConnectionStringBuilder(
    builder.Configuration["JOURNALI_DB"]
    ?? throw new InvalidOperationException("JOURNALI_DB fehlt — siehe docs/betrieb.md."));
if (builder.Configuration["JOURNALI_DB_PASSWORD"] is { Length: > 0 } password)
    connection.Password = password;

PostgresJournal.EnsureDatabase(connection.ConnectionString);
var db = NpgsqlDataSource.Create(connection.ConnectionString);
var journal = new PostgresJournal(db);
journal.EnsureSchema();
var catalog = new Catalog(journal);
var rebuilt = catalog.Rebuild();
var seeded = catalog.SeedMissing();

builder.Services.AddSingleton<IJournal>(journal);
builder.Services.AddSingleton(catalog);

// Medien: Treiber per JOURNALI_MEDIA — postgres (Vorgabe: Tabelle media_blob neben dem Journal), Verzeichnis, s3://bucket
// (docs/betrieb.md). Taloan, 19.09.: Datenbank hier, Assets im Object Storage; ein Journal, ein Speicher.
// Einstellung: media.json im Datenverzeichnis (Einstellungen → Storage), sonst die Umgebung
var dataDir = Path.GetFullPath(builder.Configuration["JOURNALI_JOBS"] ?? Path.Combine(builder.Environment.ContentRootPath, "jobs"));
var mediaStore = new SwitchableMediaStore(MediaConfigFile.Load(dataDir) ?? MediaConfig.FromEnv(builder.Configuration), db, LoggerFactory.Create(b => b.AddConsole()).CreateLogger("media"), builder.Environment.ContentRootPath);
builder.Services.AddSingleton(db);
builder.Services.AddSingleton(mediaStore);
builder.Services.AddSingleton<IMediaStore>(mediaStore);
builder.Services.AddHttpClient("media", h => { h.Timeout = TimeSpan.FromMinutes(2); h.DefaultRequestHeaders.UserAgent.ParseAdd("journali/1.0"); });   // Medien von URL holen (Import)

// Plugins: plugins/<key>/plugin.json — beim Entwickeln das Verzeichnis im Repo, im Container /app/plugins (docs/pflegestruktur.md, 19)
var pluginDir = builder.Configuration["JOURNALI_PLUGINS"]
    ?? new[] { Path.Combine(builder.Environment.ContentRootPath, "..", "plugins"), Path.Combine(builder.Environment.ContentRootPath, "plugins") }.FirstOrDefault(Directory.Exists)
    ?? Path.Combine(builder.Environment.ContentRootPath, "plugins");
pluginDir = Path.GetFullPath(pluginDir);
var autoInstalled = PluginApi.AutoInstall(catalog, pluginDir);

// Jobs (Plugin tasker, Taloan 19.09.): laufen im Server als Kindprozesse, unabhängig vom Browser; Logs und Geheimnisse
// unter JOURNALI_JOBS (Vorgabe jobs/ neben dem Programm, im Repo ignoriert)
var jobDir = dataDir;
var jobRunner = new JobRunner(catalog, pluginDir, jobDir, LoggerFactory.Create(b => b.AddConsole()).CreateLogger<JobRunner>());
builder.Services.AddSingleton(jobRunner);
builder.Services.AddHostedService(sp => sp.GetRequiredService<JobRunner>());

// Umlaute lesbar lassen statt \u00fc — das Journal ist zum Anschauen da.
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping);

// Vite-Entwicklungsserver (localhost:5173) darf direkt auf die API, wenn
// in den Einstellungen ein anderer Server eingetragen ist als der eigene.
if (builder.Environment.IsDevelopment())
    builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.Logger.LogInformation("Abbilder aus {Count} Einträgen gebaut, Stand #{Head}, Saatgut {Seeded}, Medien: {Media}, Plugins unter {Plugins} ({Auto} neu installiert)", rebuilt, catalog.Head, seeded, mediaStore.Kind, pluginDir, autoInstalled);

app.UseCors();   // auch im Betrieb: das OnlyOffice-Plugin ruft /api aus dem Editor-Origin; noch keine Anmeldung, daher offen

// Die Adresse, unter der Jobs den Server erreichen: die, mit der die Oberfläche kommt (localhost:5000 oder rossibox)
app.Use(async (ctx, next) => { if (ctx.Request.Path.StartsWithSegments("/api")) jobRunner.Origin = $"{ctx.Request.Scheme}://{ctx.Request.Host}"; await next(); });

// Benutzer & Rollen (Taloan, 19.09.): ohne Benutzer offen wie bisher; mit Benutzern Sitzung oder Token noetig, X-Actor kommt aus der Sitzung
app.Use(Auth.Middleware(catalog, dataDir));

var api = app.MapGroup("/api");
Auth.Map(api, dataDir);

// ---- Stand und Modell ----------------------------------------------------

api.MapGet("/health", (Catalog c) => new
{
    head = c.Head,
    nodes = c.Read(t => t.Nodes.Count),
});

ModelApi.Map(api);

// ---- Baum: Knoten, Werte, Kategorien, Freigaben — einzeln und im Stapel ---------

TreeApi.Map(api);
RelationApi.Map(api);
MediaApi.Map(api);
VersionApi.Map(api, pluginDir, LoggerFactory.Create(b => b.AddConsole()).CreateLogger("versions"));   // Versionen (Taloan, 19.09.)
PluginApi.Map(api, pluginDir);
BatchApi.Map(api);
TransferApi.Map(api);   // Rohdaten eines Teilbaums hin und zurück (JSON, wiederherstellbar — Taloan)
JobApi.Map(api, jobRunner);   // Jobs: Definition, Läufe, Logs (Plugin tasker)

// Dateien der Plugins (Browser-Plugins: ihr Modul, Bilder, Unterlagen) — nur lesend, nur unter plugins/
app.MapGet("/plugins/{key}/{**path}", (string key, string path, HttpContext ctx) =>
{
    if (!ModelApi.ValidKey(key) || path.Contains("..")) return Results.NotFound();
    // Paket: das ganze Plugin-Verzeichnis als ZIP — OnlyOffice installiert eine .plugin-Datei (config.json an der Wurzel)
    if (path == "package.plugin")
    {
        var dir = Path.Combine(pluginDir, key);
        if (!Directory.Exists(dir)) return Results.NotFound();
        var ms = new MemoryStream();
        using (var zip = new System.IO.Compression.ZipArchive(ms, System.IO.Compression.ZipArchiveMode.Create, leaveOpen: true))
            foreach (var f in Directory.GetFiles(dir))
                if (!f.EndsWith("plugin.json") && !f.EndsWith(".md")) System.IO.Compression.ZipFileExtensions.CreateEntryFromFile(zip, f, Path.GetFileName(f));
        ms.Position = 0;
        return Results.File(ms, "application/zip", $"journali-{key}.plugin");
    }
    var file = Path.GetFullPath(Path.Combine(pluginDir, key, path));
    if (!file.StartsWith(Path.Combine(pluginDir, key), StringComparison.Ordinal) || !File.Exists(file)) return Results.NotFound();
    var ext = Path.GetExtension(file).ToLowerInvariant();
    // Office-Manifest: den Origin dieses Servers einsetzen, damit Excel den Aufgabenbereich hier lädt
    if (ext == ".xml")
    {
        var origin = $"{ctx.Request.Scheme}://{ctx.Request.Host}";
        return Results.Text(File.ReadAllText(file).Replace("{{ORIGIN}}", origin), "application/xml");
    }
    var mime = ext switch { ".js" or ".mjs" => "text/javascript", ".json" => "application/json", ".css" => "text/css", ".md" => "text/markdown", ".png" => "image/png", ".svg" => "image/svg+xml", ".html" => "text/html", _ => "application/octet-stream" };
    // Plugin-Dateien nie aus dem Browser-Cache: sonst laeuft nach einem Update das alte Modul weiter (F5 muss reichen, Taloan)
    ctx.Response.Headers.CacheControl = "no-cache";
    return Results.File(file, mime);
});

// ---- Journal (roh) ---------------------------------------------------------

api.MapPost("/journal", (AppendRequest r, Catalog c) =>
{
    if (string.IsNullOrWhiteSpace(r.Actor) || string.IsNullOrWhiteSpace(r.Stream)
        || string.IsNullOrWhiteSpace(r.Type) || r.Payload.ValueKind is JsonValueKind.Undefined)
        return Bad("actor, stream, type und payload sind Pflicht.");

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

// index.html nie cachen — sonst zeigt ein Browser nach einem Bau noch auf die alte JS-Datei;
// die Dateien unter /assets tragen einen Hash im Namen und dürfen ewig im Cache bleiben.
var staticOptions = new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var headers = ctx.Context.Response.Headers;
        headers.CacheControl = ctx.Context.Request.Path.StartsWithSegments("/assets")
            ? "public, max-age=31536000, immutable"
            : "no-cache";
    },
};
app.UseDefaultFiles();
app.UseStaticFiles(staticOptions);
app.MapFallbackToFile("index.html", staticOptions);

app.Run();

/// <summary>Rumpf von POST /api/journal. Payload ist beliebiges JSON, die Form hängt von Type ab.</summary>
sealed record AppendRequest(string Actor, string Stream, string Type, JsonElement Payload);

/// <summary>
/// Ein Eintrag in der Antwort: wie <see cref="Entry"/>, nur ist der Payload
/// eingebettetes JSON statt eines Strings mit JSON darin — der Client parst einmal.
/// </summary>
sealed record EntryView(long Number, DateTimeOffset At, string Actor, string Stream, string Type, JsonElement Payload, string? Batch)
{
    public static EntryView Of(Entry e) =>
        new(e.Number, e.At, e.Actor, e.Stream, e.Type, JsonDocument.Parse(e.Payload).RootElement.Clone(), e.Batch);
}
