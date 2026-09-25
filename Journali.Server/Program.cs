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

// Datenverzeichnis (JOURNALI_JOBS): Jobs, Medien-Einstellung, die Verbindung zur Datenbank (db.json) — und der lokale
// Spiegel des Journals. Im Paket ein Volume, beim Entwickeln jobs/ neben dem Server; jeder Server hat seins.
var dataDir = Path.GetFullPath(builder.Configuration["JOURNALI_JOBS"] ?? Path.Combine(builder.Environment.ContentRootPath, "jobs"));
Directory.CreateDirectory(dataDir);

// Verbindung: aus dem Einrichtungsdialog (db.json im Datenverzeichnis), sonst aus der Umgebung (JOURNALI_DB und
// JOURNALI_DB_PASSWORD — im Paket setzt compose.yaml beide). Steht sie nicht, läuft erst die Einrichtungsstufe auf
// derselben Adresse und wartet, bis sie steht (Einrichtung.cs).
var ziel = await Einrichtung.VerbindenAsync(args, builder, dataDir);
var connection = new NpgsqlConnectionStringBuilder(ziel.ConnectionString());
var db = NpgsqlDataSource.Create(connection.ConnectionString);
var pg = new PostgresJournal(db);
pg.EnsureSchema();
// Tresor in der Datenbank: Anmeldedaten, Mailserver, Geheimnisse der Jobs und Teams — alle Server auf dieser Datenbank
// teilen ihn. Dateien von früher (auth.json, mail.json, secrets.json) werden übernommen.
var tresor = new PostgresTresor(db);
Tresor.Nutze(tresor);
foreach (var datei in Tresor.Uebernehmen(dataDir, tresor)) Console.WriteLine($"journali: {datei} in die Datenbank übernommen");
// Spiegel und Schnappschuss stellt der Administrator ein — betrieb.json im Datenverzeichnis,
// ohne Datei zählt die Umgebung (JOURNALI_JOURNAL_CACHE=off, JOURNALI_SNAPSHOT=off). Gelesen wird das hier, vor dem
// Journal: der Spiegel entscheidet, wie das Journal überhaupt gelesen wird.
var betrieb = BetriebConfigFile.Effektiv(dataDir, builder.Configuration);
var cachePath = Path.Combine(dataDir, $"journal-{connection.Host}-{connection.Port}-{connection.Database}.cache.jsonl");
IJournal journal = betrieb.JournalCache ? new CachedJournal(pg, cachePath) : pg;
var catalog = new Catalog(journal);
#if DEBUG
// Nur im Debug-Bau: ein Prüf-Aussteller für die Entwicklung (JOURNALI_LICENCE_KEY = sein öffentlicher Schlüssel). Der
// Release-Bau glaubt allein dem eingebauten Schlüssel des Lizenzservers (Core.Licensing.Aussteller). Vor dem
// Neuaufbau: das Abbild prüft Tarifblätter beim Anwenden.
if (Environment.GetEnvironmentVariable("JOURNALI_LICENCE_KEY") is { Length: > 0 } pruefAussteller)
{
    Journali.Core.Licensing.Aussteller.Vertraue(pruefAussteller);
    Console.WriteLine("journali: Prüf-Aussteller aus JOURNALI_LICENCE_KEY angenommen (Debug-Bau)");
}
#endif
// Schnappschuss der Abbilder: Stand #n als Datei, der Start liest nur den Rest;
// JOURNALI_SNAPSHOT=off schaltet ihn ab. Geschrieben nach dem Start (im Hintergrund) und beim Beenden.
var snapshotPath = betrieb.Snapshot ? Path.Combine(dataDir, $"snapshot-{connection.Host}-{connection.Port}-{connection.Database}.json") : null;
var snapshotAt = snapshotPath is null ? 0 : catalog.LoadSnapshot(snapshotPath);
Console.WriteLine($"journali: Journal wird gelesen …{(snapshotAt > 0 ? $" (Schnappschuss bis #{snapshotAt})" : "")}{(journal is CachedJournal cj && cj.CachedHead > 0 ? $" (Spiegel bis #{cj.CachedHead}, Rest aus der Datenbank)" : "")}");   // vor dem Logger — damit der Start nicht stumm ist
var sw0 = System.Diagnostics.Stopwatch.StartNew();
// Fortschritt etwa je Sekunde — Ziel ist der Kopf des Journals
var head0 = journal.Head; var mirror0 = journal is CachedJournal c0 ? c0.CachedHead : 0; var lastTick = 0L;
void Progress(int n, long number, bool final)
{
    if (!final && sw0.ElapsedMilliseconds - lastTick < 1000) return;
    lastTick = sw0.ElapsedMilliseconds;
    var src = number <= mirror0 ? "Spiegel" : "Datenbank";   // Stand beim Start — der Spiegel wächst beim Lesen mit
    Console.WriteLine($"journali:   … #{number} von #{head0} ({Math.Min(100, number * 100 / Math.Max(1, head0))} %, {n} Einträge, {sw0.Elapsed.TotalSeconds:0} s, {src})");
}
var rebuilt = catalog.Rebuild(out var timing, (n, number) => Progress(n, number, false));
if (lastTick > 0) Progress(rebuilt, journal.Head, true);   // der Allerletzte bei 100 %
void WriteSnapshot(string why)
{
    if (snapshotPath is null) return;
    try { var sw = System.Diagnostics.Stopwatch.StartNew(); var n = catalog.SaveSnapshot(snapshotPath); if (n > 0) Console.WriteLine($"journali: Schnappschuss bis #{n} geschrieben ({sw.ElapsedMilliseconds} ms, {why})"); }
    catch (Exception e) { Console.WriteLine($"journali: Schnappschuss nicht geschrieben — {e.Message}"); }
}
Console.WriteLine($"journali: {rebuilt} Einträge in {sw0.ElapsedMilliseconds} ms — {timing}");   // wo die Zeit hingeht
// Die Lizenz liegt signiert und verschlüsselt in der Datenbank
// („jegliche eingespielte Lizenz kommt signiert und verschlüsselt in einen Container — die DB“); eine Datei von früher
// wird beim ersten Lesen übernommen. Muss vor dem Saatgut stehen: daraus bekommt das Init Team seine Limits.
var instanz = new Instanz(db);   // Kennung dieser Instanz — steht in der Lizenz, geht nicht in die Sicherung
builder.Services.AddSingleton(instanz);
var licences = new Licences(dataDir, new LicenceStore(db), instanz) { ErsterTag = () => catalog.ErsterTag, Tarife = () => catalog.Tarife };   // ohne Lizenz: Test ab dem ersten Eintrag
// Abo über den Lizenzserver: JOURNALI_LIZENZSERVER; geprüft wird mit dem eingebauten Schlüssel (Aussteller). Der
// Shop-Schlüssel liegt in jobs/secrets.json
var abos = new Abos(instanz, dataDir, new HttpClient { Timeout = TimeSpan.FromSeconds(20) },
    () => Environment.GetEnvironmentVariable("JOURNALI_LIZENZSERVER"));
catalog.LicenceDir = dataDir;
catalog.Licences = licences;
catalog.ZaehltAb = licences.Lic.CountFrom;   // ab wann gezählt wird
var seeded = catalog.SeedMissing();
// Läuft eine Lizenz (oder der Test) im Betrieb ab, gilt Kostenlos — das Init Team trägt dann dessen Limits. Stündlich
// nachsehen; LimitsAusLizenz schreibt nur, wenn sich etwas ändert
_ = Task.Run(async () =>
{
    while (true)
    {
        await Task.Delay(TimeSpan.FromHours(1));
        try { catalog.With((_, _, _) => catalog.LimitsAusLizenz()); } catch { }
        try { await abos.AuffrischenAsync(catalog); } catch (Exception e) { Console.WriteLine($"journali: Abos nicht aufgefrischt — {e.Message}"); }
    }
});

var mailer = new Mailer(dataDir);   // Mailversand (Einstellungen → Mail)
builder.Services.AddSingleton(mailer);
builder.Services.AddSingleton<IJournal>(journal);
builder.Services.AddSingleton(catalog);

// Medien: Treiber per JOURNALI_MEDIA — postgres (Vorgabe: Tabelle media_blob neben dem Journal), Verzeichnis, s3://bucket
// (docs/betrieb.md). Datenbank hier, Assets im Object Storage; ein Journal, ein Speicher.
// Einstellung: media.json im Datenverzeichnis (Einstellungen → Storage), sonst die Umgebung
var mediaStore = new SwitchableMediaStore(MediaConfigFile.Load(dataDir) ?? MediaConfig.FromEnv(builder.Configuration), db, LoggerFactory.Create(b => b.AddConsole()).CreateLogger("media"), builder.Environment.ContentRootPath);
builder.Services.AddSingleton(db);
builder.Services.AddSingleton(mediaStore);
builder.Services.AddSingleton(new DocText(db));   // Text der Dokumente: abgeleitet, eigene Tabelle neben dem Journal (pflegestruktur 32)
builder.Services.AddSingleton<IMediaStore>(mediaStore);
builder.Services.AddHttpClient("media", h => { h.Timeout = TimeSpan.FromMinutes(2); h.DefaultRequestHeaders.UserAgent.ParseAdd("journali/1.0"); });   // Medien von URL holen (Import)

// Plugins: plugins/<key>/plugin.json — beim Entwickeln das Verzeichnis im Repo, im Container /app/plugins (docs/pflegestruktur.md, 19)
var pluginDir = builder.Configuration["JOURNALI_PLUGINS"]
    ?? new[] { Path.Combine(builder.Environment.ContentRootPath, "..", "plugins"), Path.Combine(builder.Environment.ContentRootPath, "plugins") }.FirstOrDefault(Directory.Exists)
    ?? Path.Combine(builder.Environment.ContentRootPath, "plugins");
pluginDir = Path.GetFullPath(pluginDir);
var autoInstalled = PluginApi.AutoInstall(catalog, pluginDir);

// Jobs (Plugin tasker): laufen im Server als Kindprozesse, unabhängig vom Browser; Logs und Geheimnisse
// unter JOURNALI_JOBS (Vorgabe jobs/ neben dem Programm, im Repo ignoriert)
var jobDir = dataDir;
builder.Services.AddSingleton(licences);
var jobRunner = new JobRunner(catalog, pluginDir, jobDir, LoggerFactory.Create(b => b.AddConsole()).CreateLogger<JobRunner>()) { Store = mediaStore };   // Store: Archiv der Fächer
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

// Die Adresse, unter der Jobs den Server erreichen: die, mit der die Oberfläche kommt (localhost:5000 oder der Host im Netz)
app.Use(async (ctx, next) => { if (ctx.Request.Path.StartsWithSegments("/api")) jobRunner.Origin = $"{ctx.Request.Scheme}://{ctx.Request.Host}"; await next(); });

// Datenbank im Betrieb weg: eine Meldung statt eines Serverfehlers — die Oberfläche zeigt sie oben, bis wieder eine
// Anfrage durchgeht. Die Verbindung bleibt, wie sie ist; Npgsql verbindet neu, sobald die Datenbank zurück ist.
app.Use(async (ctx, next) =>
{
    try { await next(); }
    catch (Exception e) when (!ctx.Response.HasStarted && (e is NpgsqlException or TimeoutException || e.InnerException is NpgsqlException) && Einrichtung.Einordnen(e).Lage == DbLage.Unerreichbar)
    {
        ctx.Response.StatusCode = 503;
        await ctx.Response.WriteAsJsonAsync(new { error = "Datenbank nicht erreichbar.", template = "Datenbank nicht erreichbar.", args = Array.Empty<string>(), db = false });
    }
});

// Benutzer & Rollen: ohne Benutzer offen wie bisher; mit Benutzern Sitzung oder Token noetig, X-Actor kommt aus der Sitzung
app.Use(Auth.Middleware(catalog, dataDir));
// Kein Kontingent: der Schreibpfad wirft, die Antwort sagt es sachlich — nicht als Serverfehler
app.Use(async (ctx, next) =>
{
    try { await next(); }
    catch (InvalidOperationException e) when (e is KeinKontingentException or TarifException && !ctx.Response.HasStarted)
    {
        ctx.Response.StatusCode = 403;
        await ctx.Response.WriteAsJsonAsync(ModelApi.Err(e.Message));
    }
});

// Was hier wirklich läuft: beides einmal beim Start lesen. Der Zeitstempel der Datei ändert sich
// beim nächsten Bau — wer ihn bei jedem Aufruf liest, meldet einen Stand, den er gar nicht geladen hat.
var gebautAm = System.IO.File.GetLastWriteTimeUtc(typeof(Program).Assembly.Location);
var fassung = typeof(Program).Assembly.GetName().Version?.ToString(3);

var api = app.MapGroup("/api");
BetriebApi.Map(api, dataDir, cachePath, Path.Combine(dataDir, $"snapshot-{connection.Host}-{connection.Port}-{connection.Database}.json"), builder.Configuration);
Auth.Map(api, dataDir);
if (Auth.Recover(catalog, dataDir, builder.Configuration["JOURNALI_ADMIN_PASSWORD"], builder.Configuration["JOURNALI_ADMIN_USER"]) is { } recovered) Console.WriteLine("journali: " + recovered);
// Einrichtungscode, solange ein Administrator fehlt oder keiner ein Passwort hat — sonst gibt es keinen
if (Auth.Lage(catalog, dataDir) is var anmeldung && anmeldung == Auth.Anmeldung.Anmelden) Einrichtungscode.Erledigt(dataDir);
else Console.WriteLine($"journali: {(anmeldung == Auth.Anmeldung.Einrichten ? "noch kein Administrator" : "kein Administrator hat ein Passwort")} — Einrichtungscode {Einrichtungscode.Aktiv(dataDir)} (auch in {Einrichtungscode.PathOf(dataDir)})");

// ---- Stand und Modell ----------------------------------------------------

api.MapGet("/health", (HttpRequest req, Catalog c) => new
{
    head = c.Head,
    nodes = c.Read(t => t.Nodes.Count),
    // Nutzung für die Statusleiste: Woche und Monat, mehr steht in den Einstellungen.
    // Wessen Nutzung: „die beiden kleinen Balken oben sollen dem Anwender anzeigen, was für ein
    // Verbrauchsstand in seinem Team ist“ — das Team der Mitgliedschaft, am Ende der Zahlerkette. Auch beim
    // Administrator: er führt vielleicht viele Teams, gehört aber genau einem an.
    usage = Nutzung(req, c),
    built = gebautAm,      // Stand der LAUFENDEN Fassung — einmal beim Start gelesen
    version = fassung,     // die Fassung, die läuft — steht oben in der Leiste
    // der Tarif dieser Instanz: die Oberfläche richtet sich danach, was sie überhaupt anbietet
    tarif = new { key = catalog.InstanzTarif.Key, label = catalog.InstanzTarif.Label, schedules = catalog.InstanzTarif.Zeitplan },
});

/// <summary>Die Zahlen der Statusleiste — für die Anlage oder für das eigene Team, je nachdem, wer fragt.</summary>
object? Nutzung(HttpRequest req, Catalog c)
{
    var today = DateOnly.FromDateTime(DateTime.Now);
    object Teil(int used, int max, DateOnly next, string wofuer) => new
    {
        used, max, resetAt = next.ToString("yyyy-MM-dd"), scope = wofuer,
    };
    var woche = Usage.WeekStart(today).AddDays(7);
    var monat = Usage.MonthStart(today).AddMonths(1);
    // /health ist von der Sperre ausgenommen (es antwortet auch ohne Sitzung) — wer fragt, lösen wir hier selbst auf
    var ich = req.HttpContext.Items["user"] as string;
    if (string.IsNullOrEmpty(ich) && Auth.Enabled(c)) ich = Auth.Resolve(req.HttpContext, c, dataDir)?.User;
    return c.With((_, _, _) =>
    {
        // Ohne Anmeldung (offene Anlage) gilt die Lizenz
        if (string.IsNullOrEmpty(ich))
            return c.ReadUsage(u => new
            {
                week = Teil(u.Between(Usage.Ab(Usage.WeekStart(today), catalog.ZaehltAb), today), catalog.LizenzTarif.Week, woche, "Instanz"),
                month = Teil(u.Between(Usage.Ab(Usage.MonthStart(today), catalog.ZaehltAb), today), catalog.LizenzTarif.Month, monat, "Instanz"),
            });
        // Kein Team: Kontingent 0 — die Balken stehen voll und rot, denn 0 ist sofort erreicht
        if (TeamApi.TeamOf(c, ich) is not { } mein || c.Teams.Get(mein) is null)
            return c.ReadUsage(u => new
            {
                week = Teil(u.Sum(new HashSet<string> { ich! }, Usage.WeekStart(today), today), 0, woche, "kein Team"),
                month = Teil(u.Sum(new HashSet<string> { ich! }, Usage.MonthStart(today), today), 0, monat, "kein Team"),
            });
        var zahler = c.Teams.Payer(mein);
        var zt = c.Teams.Get(zahler)!;
        var leute = c.Teams.Dependents(zahler).SelectMany(x => c.Users.All.Values.Where(v => v.Team == x)).Select(v => v.Key).ToHashSet();
        var (kw, km) = c.Teams.LimitAt(zahler, today);
        var ab = c.Teams.CountFrom(zahler, catalog.ZaehltAb);
        var cut = c.Teams.ResetCut(zahler, catalog.ZaehltAb);
        return c.ReadUsage(u => new
        {
            week = Teil(u.Sum(leute, Usage.Ab(Usage.WeekStart(today), ab), today, cut), kw, woche, zt.Label),
            month = Teil(u.Sum(leute, Usage.Ab(Usage.MonthStart(today), ab), today, cut), km, monat, zt.Label),
        });
    });
}

// Nutzung: was pro Tag, Woche, Monat ins Journal ging — die Grenzen sind vorerst Annahmen zum Messen,
// keine Lizenz. Lesen und Exportieren zählen nicht mit, weil sie nichts schreiben.
api.MapGet("/usage", (Catalog c, string? history = null, int limit = 90) => c.ReadUsage(u =>
{
    var today = DateOnly.FromDateTime(DateTime.Now);
    object Part(string key, int used, int max, DateOnly start, DateOnly next) => new
    {
        key, used, max = max > 0 ? max : (int?)null, start = start.ToString("yyyy-MM-dd"), resetAt = next.ToString("yyyy-MM-dd"),
    };
    return new
    {
        today = today.ToString("yyyy-MM-dd"),
        head = c.Head,
        day = Part("day", u.Day(today), 0, today, today.AddDays(1)),   // ohne Grenze: nur die Zahl
        week = Part("week", u.Between(Usage.Ab(Usage.WeekStart(today), c.ZaehltAb), today), c.LizenzTarif.Week, Usage.WeekStart(today), Usage.WeekStart(today).AddDays(7)),
        month = Part("month", u.Between(Usage.Ab(Usage.MonthStart(today), c.ZaehltAb), today), c.LizenzTarif.Month, Usage.MonthStart(today), Usage.MonthStart(today).AddMonths(1)),
        // daneben, was gar nicht zählt (Modell, Struktur, Kataloge, Betrieb) — zum Vergleich beim Messen
        all = new { day = u.Day(today, true), week = u.Week(today, true), month = u.Month(today, true) },
        history = history is null ? null : u.History(history, today, Math.Clamp(limit, 1, 400))
            .Select(h => new { start = h.Start.ToString("yyyy-MM-dd"), count = h.Count, all = h.All }).ToList(),
    };
}));

ModelApi.Map(api);
DocsApi.Map(api);

// ---- Baum: Knoten, Werte, Kategorien, Freigaben — einzeln und im Stapel ---------

TreeApi.Map(api);
RelationApi.Map(api);
MediaApi.Map(api);
DeriveApi.Map(api);   // Vorschau-Presets und Ableitungen (Plugin derive rechnet)
TranslateApi.Map(api);
WorkflowApi.Map(api);   // Workflows (27): Definitionen, Zustand je Knoten, Schritte, Meine Aufgaben   // Übersetzungsmanagement: Einheiten je Sprachrichtung, Rückweg mit Quellprüfung (Plugin xliff)
VersionApi.Map(api, pluginDir, LoggerFactory.Create(b => b.AddConsole()).CreateLogger("versions"));   // Versionen
PluginApi.Map(api, pluginDir);
BatchApi.Map(api);
TransferApi.Map(api);   // Rohdaten eines Teilbaums hin und zurück (JSON, wiederherstellbar)
RestoreApi.Map(api);   // Teilbaum aus einer Rohdaten-Datei zurueck (Einstellungen, kein Plugin)
BackupApi.Map(api, journal, dataDir, pluginDir);
DatenbankApi.Map(api, ziel, dataDir, app.Logger);   // ⇅ B&R → Datenbank: Verbindung und Passwort (für die eigene Sicherung)   // Vollsicherung: Journal, Medien, Zugänge, Plugins — zurück in ein leeres System
MailApi.Map(api, mailer);   // Mailserver einstellen und eine Probe senden (Einstellungen → Mail)
LicenceKeys.Map(api, licences, new KeyRequests(db, instanz), instanz, abos);   // Schlüssel: signiert anfordern, einlösen — Reset oder Limit, an die Instanz gebunden, einmal
JobApi.Map(api, jobRunner);   // Jobs: Definition, Läufe, Logs (Plugin tasker)
TeamApi.Map(api, jobDir);   // Teams: Kostenstelle der KI — Schlüssel, Verbuchung, Führung
AiApi.Map(api, jobDir);     // KI über den Server: Schlüssel des zahlenden Teams; begrenzt wird hier nichts
LicenceApi.Map(api, licences, abos);      // Lizenz ansehen, Abo verbinden und auffrischen
FileApi.Map(api, dataDir, builder.Environment);   // Dateibrowser des Servers: Storage-Verzeichnis, Job-Quellen und -Ziele

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
    // Plugin-Dateien nie aus dem Browser-Cache: sonst laeuft nach einem Update das alte Modul weiter (F5 muss reichen)
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

if (snapshotPath is not null)
{
    if (rebuilt > 0) _ = Task.Run(() => WriteSnapshot("nach dem Start"));   // im Hintergrund — der Start wartet nicht
    app.Lifetime.ApplicationStopping.Register(() => WriteSnapshot("beim Beenden"));
    // Stündlich, wenn Neues dazukam (Taloan, 24.09.2026): nach einem Absturz ist höchstens eine Stunde nachzuspielen,
    // nicht alles seit dem letzten Start
    _ = Task.Run(async () =>
    {
        var zuletzt = catalog.Head;
        while (true)
        {
            await Task.Delay(TimeSpan.FromHours(1));
            try { var kopf = catalog.Head; if (kopf > zuletzt) { WriteSnapshot("stündlich"); zuletzt = kopf; } } catch { }
        }
    });
}
app.Run();
return 0;

/// <summary>Rumpf von POST /api/journal. Payload ist beliebiges JSON, die Form hängt von Type ab.</summary>
sealed record AppendRequest(string Actor, string Stream, string Type, JsonElement Payload);

/// <summary>
/// Ein Eintrag in der Antwort: wie <see cref="Entry"/>, nur ist der Payload
/// eingebettetes JSON statt eines Strings mit JSON darin — der Client parst einmal.
/// </summary>
sealed record EntryView(long Number, DateTimeOffset At, string Actor, string Stream, string Type, JsonElement Payload, string? Batch, string Kind)
{
    public static EntryView Of(Entry e) =>
        new(e.Number, e.At, e.Actor, e.Stream, e.Type, JsonDocument.Parse(e.Payload).RootElement.Clone(), e.Batch, e.Kind ?? Kinds.Of(e.Type));   // alte Einträge ohne Spalte: aus dem Typ
}
