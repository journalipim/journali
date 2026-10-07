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
// Die erste Zeile: welche Version startet — Build wie in der Kopfleiste (TTMM.hhmm, Ortszeit des Servers).
// Die Konsole spricht Englisch, gleich welche Sprache die Oberfläche hat (04.10.2026): sonst mischen sich die eigenen Zeilen mit denen von ASP.NET.
{
    var gebaut = System.IO.File.GetLastWriteTimeUtc(typeof(Program).Assembly.Location).ToLocalTime();
    Console.WriteLine($"journali {typeof(Program).Assembly.GetName().Version?.ToString(3)} · Build {gebaut:ddMM.HHmm} ({gebaut:yyyy-MM-dd HH:mm} {gebaut:zzz})");
}

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
foreach (var datei in Tresor.Uebernehmen(dataDir, tresor)) Console.WriteLine($"journali: {datei} moved into the database");
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
    Console.WriteLine("journali: test issuer from JOURNALI_LICENCE_KEY accepted (debug build)");
}
#endif
// Schnappschuss der Abbilder: Stand #n als Datei, der Start liest nur den Rest;
// JOURNALI_SNAPSHOT=off schaltet ihn ab. Geschrieben nach dem Start (im Hintergrund) und beim Beenden.
var snapshotPath = betrieb.Snapshot ? Path.Combine(dataDir, $"snapshot-{connection.Host}-{connection.Port}-{connection.Database}.json") : null;
var snapshotAt = snapshotPath is null ? 0 : catalog.LoadSnapshot(snapshotPath);
Console.WriteLine($"journali: reading journal …{(snapshotAt > 0 ? $" (snapshot up to #{snapshotAt})" : "")}{(journal is CachedJournal cj && cj.CachedHead > 0 ? $" (mirror up to #{cj.CachedHead}, rest from the database)" : "")}");   // vor dem Logger — damit der Start nicht stumm ist
var sw0 = System.Diagnostics.Stopwatch.StartNew();
// Fortschritt etwa je Sekunde — Ziel ist der Kopf des Journals
var head0 = journal.Head; var mirror0 = journal is CachedJournal c0 ? c0.CachedHead : 0; var lastTick = 0L;
void Progress(int n, long number, bool final)
{
    if (!final && sw0.ElapsedMilliseconds - lastTick < 1000) return;
    lastTick = sw0.ElapsedMilliseconds;
    var src = number <= mirror0 ? "mirror" : "database";   // Stand beim Start — der Spiegel wächst beim Lesen mit
    Console.WriteLine($"journali:   … #{number} of #{head0} ({Math.Min(100, number * 100 / Math.Max(1, head0))} %, {n} entries, {sw0.Elapsed.TotalSeconds:0} s, {src})");
}
var rebuilt = catalog.Rebuild(out var timing, (n, number) => Progress(n, number, false));
if (lastTick > 0) Progress(rebuilt, journal.Head, true);   // der Allerletzte bei 100 %
// Wann sich ein Schnappschuss lohnt (01.10.2026): erst nach 10 000 neuen Einträgen oder nach einem Tag, wenn überhaupt etwas Neues da ist.
// Er kostet Sekunden (340 MB); ihn zu verpassen kostet beim nächsten Start nur, den Rest aus dem Journal anzuwenden (~18 µs je Eintrag).
const int SchnappschussAb = 10_000;
var SchnappschussAlter = TimeSpan.FromDays(1);
// Gab es beim Start keinen brauchbaren Schnappschuss (neue Version des Kerns, erster Start, Datei gelöscht), wird nach dem Start einer geschrieben, sobald
// das Journal mindestens SchnappschussAb Einträge hat (04.10.2026). Davor zählte der Start als Ausgangspunkt: ein Server, der öfter als täglich neu startet
// und keine 10 000 neuen Einträge sieht, schrieb nie einen — jeder Start las 1,4 Mio. Einträge aus dem Spiegel (11 s).
var schnappschussStand = snapshotAt > 0 ? snapshotAt : catalog.Head >= SchnappschussAb ? 0 : catalog.Head;
var schnappschussZeit = snapshotAt > 0 && snapshotPath is not null && File.Exists(snapshotPath) ? File.GetLastWriteTimeUtc(snapshotPath) : DateTime.UtcNow;
bool SchnappschussFaellig(long kopf) => kopf - schnappschussStand >= SchnappschussAb || (kopf > schnappschussStand && DateTime.UtcNow - schnappschussZeit >= SchnappschussAlter);
void WriteSnapshot(string why)
{
    if (snapshotPath is null) return;
    try
    {
        var sw = System.Diagnostics.Stopwatch.StartNew(); var n = catalog.SaveSnapshot(snapshotPath);
        if (n > 0) { schnappschussStand = n; schnappschussZeit = DateTime.UtcNow; Console.WriteLine($"journali: snapshot up to #{n} written ({sw.ElapsedMilliseconds} ms, {why})"); }
    }
    catch (Exception e) { Console.WriteLine($"journali: snapshot not written — {e.Message}"); }
}
Console.WriteLine($"journali: {rebuilt} entries in {sw0.ElapsedMilliseconds} ms — {timing}");   // wo die Zeit hingeht
// Die Lizenz liegt signiert und verschlüsselt in der Datenbank
// („jegliche eingespielte Lizenz kommt signiert und verschlüsselt in einen Container — die DB“); eine Datei von früher
// wird beim ersten Lesen übernommen. Muss vor dem Saatgut stehen: daraus bekommt das Init Team seine Limits.
var instanz = new Instanz(db);   // Kennung dieser Instanz — steht in der Lizenz, geht nicht in die Sicherung
builder.Services.AddSingleton(instanz);
// Uploads: ein Video darf einige hundert MB gross sein. Kestrel erlaubt sonst 30 MB je Anfrage; die Grenze hebt unten nur der Weg der Medien an, und nur für Angemeldete.
// Einstellbar mit JOURNALI_UPLOAD_MB (Vorgabe 2048)
var uploadMax = (long.TryParse(builder.Configuration["JOURNALI_UPLOAD_MB"], out var umb) && umb > 0 ? umb : 2048) * 1024 * 1024;
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o => o.MultipartBodyLengthLimit = uploadMax);
// Obergrenze je Absender im Netz (siehe Begrenzung): eine Flut von einer Adresse bekommt 429
builder.Services.AddRateLimiter(o => { o.RejectionStatusCode = 429; o.GlobalLimiter = System.Threading.RateLimiting.PartitionedRateLimiter.Create<Microsoft.AspNetCore.Http.HttpContext, string>(ctx => Begrenzung.Partition(ctx)); });
var licences = new Licences(dataDir, new LicenceStore(db), instanz) { ErsterTag = () => catalog.ErsterTag, Tarife = () => catalog.Tarife };   // ohne Lizenz: Test ab dem ersten Eintrag
// Abo über den Lizenzserver: seine Adresse ist eingebaut (Core.Licensing.Aussteller.Adresse), geprüft wird mit
// seinem eingebauten Schlüssel. Der Shop-Schlüssel liegt in jobs/secrets.json
// Startphase (05.10.2026, Core.Licensing.Startphase): alles ohne Grenzen, ein Server, kein Lizenzserver. Der Schalter steht hier, nicht in der
// Umgebung; nur der Debug-Bau kann ihn zum Prüfen der Lizenzfunktionen ausschalten (JOURNALI_STARTPHASE=0)
Journali.Core.Licensing.Startphase.An = true;
#if DEBUG
if (Environment.GetEnvironmentVariable("JOURNALI_STARTPHASE") == "0") { Journali.Core.Licensing.Startphase.An = false; Console.WriteLine("journali: start phase off (debug build)"); }
#endif
// ohne Adresse fragt kein Weg den Lizenzserver (Abos: „Kein Lizenzserver eingebaut.“)
var lizenzserver = Journali.Core.Licensing.Startphase.An ? "" : Journali.Core.Licensing.Aussteller.Adresse;
#if DEBUG
// Nur im Debug-Bau: gegen einen Lizenzserver der Entwicklung arbeiten. Der Release-Bau fragt immer den eingebauten
if (!Journali.Core.Licensing.Startphase.An && Environment.GetEnvironmentVariable("JOURNALI_LIZENZSERVER") is { } eigener)
{
    lizenzserver = eigener.Trim();
    Console.WriteLine($"journali: licence server from JOURNALI_LIZENZSERVER: {(lizenzserver.Length is 0 ? "none" : lizenzserver)} (debug build)");
}
#endif
var abos = new Abos(instanz, dataDir, new HttpClient { Timeout = TimeSpan.FromSeconds(20) }, () => lizenzserver);
catalog.LicenceDir = dataDir;
catalog.Licences = licences;
catalog.ZaehltAb = licences.Lic.CountFrom;   // ab wann gezählt wird
var seeded = catalog.SeedMissing();
// Demo (07.10.2026): eingerichtet wird nach den Plugins (Demo.Einrichten unten), gilt aber von hier an
Demo.An = Environment.GetEnvironmentVariable("JOURNALI_DEMO") == "1";
// Server auf derselben Datenbank (pflegestruktur 41): Kennung, Puls, Rolle. Der erste Takt gleich hier, damit der Start weiss, ob er Hauptserver ist
var verbund = new Verbund(db, catalog, dataDir, typeof(Program).Assembly.GetName().Version?.ToString(3), System.IO.File.GetLastWriteTimeUtc(typeof(Program).Assembly.Location));
try { verbund.Takt(); } catch (Exception e) { Console.WriteLine($"journali: server not registered — {e.Message}"); }
Console.WriteLine($"journali: server {verbund.NameVon(verbund.Id, verbund.Host)} ({verbund.Host}, {verbund.Id}) — {(verbund.IstHaupt ? "main server" : "worker server")}{(verbund.Gesperrt ? ", blocked" : "")}{(verbund.OhneLizenz ? $", unlicensed (allowed: {verbund.Erlaubt} {(verbund.Erlaubt == 1 ? "server" : "servers")})" : "")}");
_ = Task.Run(async () =>
{
    var war = verbund.IstHaupt; string? fehler = null;
    while (true)
    {
        await Task.Delay(TimeSpan.FromSeconds(2));
        try
        {
            var ist = verbund.Takt(); fehler = null;
            if (ist != war) Console.WriteLine($"journali: this server is now {(ist ? "the main server" : "a worker server")}");
            war = ist;
        }
        catch (Exception e) { if (e.Message != fehler) Console.WriteLine($"journali: heartbeat not written — {e.Message}"); fehler = e.Message; }   // einmal je neuem Fehler, nicht alle 2 s
    }
});
// Läuft eine Lizenz (oder der Test) im Betrieb ab, gilt Kostenlos — das Init Team trägt dann dessen Limits. Stündlich
// nachsehen; LimitsAusLizenz schreibt nur, wenn sich etwas ändert
_ = Task.Run(async () =>
{
    // Der Hauptserver fragt (von den lizenzierten nur er: alle schreiben ins Journal, und zwei Server schrieben dasselbe zweimal):
    //  - sobald er Hauptserver ist — nach dem Start und nach einer Übernahme (04.10.2026: sonst galt nach der Übernahme bis zu einer Stunde der alte Stand),
    //  - danach stündlich,
    //  - alle 5 Minuten, solange ein Server ohne Lizenz läuft: ein eben gekaufter Zusatz Multi-Server soll ihn freigeben.
    // Ein Server ohne Lizenz fragt dazu selbst, unten.
    var letzte = DateTime.MinValue; var warHaupt = false;
    if (Journali.Core.Licensing.Startphase.An) return;   // Startphase: keine Lizenz, kein Abo, kein Lizenzserver
    while (true)
    {
        var haupt = verbund.IstHaupt;
        var seit = DateTime.UtcNow - letzte;
        // eben Hauptserver geworden oder ein Server ohne Lizenz: jeden Stand neu fragen, auch einen jungen — stündlich nur die, die älter als 20 h sind
        var sofort = !warHaupt || (verbund.OhneLizenzAnzahl > 0 && seit >= TimeSpan.FromMinutes(5));
        // Ein Server ohne Lizenz fragt selbst (04.10.2026): gleich nach dem Start und dann alle 5 Minuten — er hängt nicht davon ab, dass der Hauptserver einen
        // eben gekauften oder eingetragenen Zusatz Multi-Server kennt. Was er bekommt, steht im Journal; erlaubt es ihn, arbeitet er beim nächsten Takt.
        var selbst = !haupt && verbund.OhneLizenz && (letzte == DateTime.MinValue || seit >= TimeSpan.FromMinutes(5));
        if ((haupt && (sofort || seit >= TimeSpan.FromHours(1))) || selbst)
        {
            letzte = DateTime.UtcNow;
            try { catalog.Lesen((_, _) => catalog.LimitsAusLizenz()); } catch { }
            try { await abos.AuffrischenAsync(catalog, sofort: sofort || selbst); } catch (Exception e) { Console.WriteLine($"journali: subscriptions not refreshed — {e.Message}"); }
        }
        warHaupt = haupt;
        await Task.Delay(TimeSpan.FromSeconds(10));
    }
});

// Mehrere Server auf einer Datenbank (26.09.2026): was ein anderer ins Journal geschrieben hat, in die eigenen
// Abbilder holen. Der Takt steht in betrieb.json (JOURNALI_NACHZIEHEN, Sekunden; 0 = nicht nachziehen — dann sieht
// dieser Server fremde Einträge erst beim Neustart).
if (betrieb.NachziehenSekunden > 0)
    _ = Task.Run(async () =>
    {
        while (true)
        {
            await Task.Delay(TimeSpan.FromSeconds(betrieb.NachziehenSekunden));
            try { catalog.Nachziehen(); } catch (Exception e) { Console.WriteLine($"journali: catching up with the journal failed — {e.Message}"); }
        }
    });

// Wer gerade wo arbeitet (26.09.2026) — flüchtig, neben dem Journal; die Oberfläche meldet es mit ihrem Puls
var presence = new Presence(db);

var mailer = new Mailer(dataDir);   // Mailversand (Einstellungen → Mail)
builder.Services.AddSingleton(mailer);
builder.Services.AddSingleton<IJournal>(journal);
builder.Services.AddSingleton(catalog);

// Medien: Treiber per JOURNALI_MEDIA — postgres (Vorgabe: Tabelle media_blob neben dem Journal), Verzeichnis, s3://bucket
// (docs/betrieb.md). Datenbank hier, Assets im Object Storage; ein Journal, ein Speicher.
// Einstellung: im Tresor (Einstellungen → Storage; eine media.json von früher übernimmt der Start), sonst die Umgebung
var mediaStore = new SwitchableMediaStore(MediaConfigFile.Load(dataDir) ?? MediaConfig.FromEnv(builder.Configuration), db, LoggerFactory.Create(b => b.AddConsole()).CreateLogger("media"), builder.Environment.ContentRootPath);
builder.Services.AddSingleton(db);
builder.Services.AddSingleton(mediaStore);
builder.Services.AddSingleton(new DocText(db));   // Text der Dokumente: abgeleitet, eigene Tabelle neben dem Journal (pflegestruktur 32)
builder.Services.AddSingleton(new Vectors(db));   // Vektoren je Abschnitt und Knoten (pgvector): abgeleitet, gerechnet vom Plugin embed (35)
builder.Services.AddSingleton<IMediaStore>(mediaStore);
// Stellt ein anderer Server auf derselben Datenbank den Medienspeicher um, folgt dieser — sonst lägen Bytes mal hier, mal dort (pflegestruktur 41)
_ = Task.Run(async () =>
{
    while (true)
    {
        await Task.Delay(TimeSpan.FromSeconds(10));
        try
        {
            if (MediaConfigFile.Load(dataDir) is { } cfg && cfg != mediaStore.Config && await mediaStore.SwitchAsync(cfg, CancellationToken.None) is null)
                Console.WriteLine($"journali: media store switched to {cfg.Spec} (set on another server)");
        }
        catch (Exception) { }   // Datenbank kurz weg: beim nächsten Mal
    }
});

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
// Die Adresse für die Läufe fest (JOURNALI_ORIGIN) — sonst die der letzten Anfrage, hinter einem Proxy der öffentliche Name
if (builder.Configuration["JOURNALI_ORIGIN"] is { Length: > 0 } festeAdresse) jobRunner.Fest = festeAdresse.TrimEnd('/');
// Demo: Beispielkatalog mit Bildern in ein leeres Journal, Plugins aus, Rolle und Anwender demo — Demo.cs
var demoBilder = 0;
if (Demo.An)
{
    var (demoEintraege, neueBilder) = Demo.Einrichten(catalog, mediaStore, pluginDir);
    demoBilder = neueBilder;
    Console.WriteLine($"journali: demo mode — {demoEintraege} entries, {neueBilder} images written");
}
jobRunner.IstHaupt = () => verbund.IstHaupt;
jobRunner.Aktiv = () => !verbund.Gesperrt && !verbund.OhneLizenz;   // ein gesperrter Server und einer ohne Lizenz führen keine Jobs aus
jobRunner.ImportAnderswo = () => verbund.ImportAnderswo;
verbund.ImportHier = () => jobRunner.ImportHier;
verbund.JobsHier = () => jobRunner.Laufende();
// Jeder Job läuft auf seinem Server, ein Systemjob auf dem Hauptserver (pflegestruktur 41). Start, Anhalten und Abbrechen eines Jobs, der woanders
// läuft, gehen als Auftrag dorthin; was dort läuft, kommt aus dessen Puls, das Log aus der Datenbank
jobRunner.HierId = verbund.Id;
jobRunner.TeamDes = key => catalog.Lesen((_, _) => Abrechnung.TeamDesJobs(catalog.Jobs, catalog.Users, key, Model.InitTeam));
jobRunner.TeamName = key => catalog.Lesen((_, _) => catalog.Teams.Get(key)?.Label ?? key);
jobRunner.Verfuegbar = team => catalog.VerfuegbarFuerJob(team);
jobRunner.HauptId = verbund.Festgelegt;
jobRunner.ServerName = verbund.NameVon;
jobRunner.AnServer = (an, art, key, ausloeser) => verbund.Auftrag(an, art, key, ausloeser);
jobRunner.Anderswo = verbund.LaufendAnderswo;
jobRunner.LogFertig = verbund.ProtokollFertig;
verbund.LogsHier = () => jobRunner.LaufendeLogs();
builder.Services.AddSingleton(verbund);
builder.Services.AddSingleton(new Embedder(pluginDir, LoggerFactory.Create(b => b.AddConsole()).CreateLogger("embed"))
{ Eingeschaltet = () => catalog.Lesen((_, _) => catalog.Plugins.All.TryGetValue(Embedder.PluginKey, out var e) && e.Enabled) });   // eine Suchfrage einbetten: Kindprozess plugins/embed/serve.mjs
builder.Services.AddHostedService(sp => sp.GetRequiredService<JobRunner>());

// Umlaute lesbar lassen statt \u00fc — das Journal ist zum Anschauen da.
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping);

// CORS gilt in jeder Umgebung (app.UseCors unten): das OnlyOffice-Plugin ruft /api aus dem Editor-Origin, der
// Vite-Entwicklungsserver (localhost:5173) aus seinem. Registriert war der Dienst bis 26.09.2026 nur in Development —
// ohne launchSettings.json (Development) und im Paket brach der Start mit „Unable to resolve ICorsService“ ab.
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.Logger.LogInformation("Projections built from {Count} entries, head #{Head}, created from defaults {Seeded}, media: {Media}, plugins in {Plugins} ({Auto} newly installed)", rebuilt, catalog.Head, seeded, mediaStore.Kind, pluginDir, autoInstalled);

// Langsame Anfragen stehen in der Konsole: Pfad und Dauer. Wer eine Wartezeit meldet, sieht dort, welche Anfrage sie verursacht hat.
app.Use(async (ctx, next) =>
{
    var uhr = System.Diagnostics.Stopwatch.StartNew();
    Teilzeit.Beginn();
    try { await next(); }
    finally { if (uhr.ElapsedMilliseconds >= 300 && ctx.Request.Path.StartsWithSegments("/api")) app.Logger.LogWarning("slow: {Methode} {Pfad} {Ms} ms ({Status}){Stapel}", ctx.Request.Method, ctx.Request.Path + ctx.Request.QueryString, uhr.ElapsedMilliseconds, ctx.Response.StatusCode, (ctx.Request.Path.Value?.EndsWith("/batch") == true && Catalog.LetzterStapel is { } z ? " · " + z : "") + Teilzeit.Text()); }
});

app.UseCors();   // auch im Betrieb: das OnlyOffice-Plugin ruft /api aus dem Editor-Origin; noch keine Anmeldung, daher offen

// Die Adresse, unter der Jobs den Server erreichen: die, mit der die Oberfläche kommt (localhost:5000 oder der Host im Netz)
app.Use(async (ctx, next) => { if (ctx.Request.Path.StartsWithSegments("/api")) jobRunner.Origin = $"{ctx.Request.Scheme}://{ctx.Request.Host}"; await next(); });

// Wieviele Posten hat ein Systemjob offen? Aus dem progress-Endpunkt seines Manifests — derselbe, den die Kachel im
// Tasker liest. Der Takt des JobRunners zieht damit nach, solange etwas offen ist (28.09.2026)
var offenClient = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
jobRunner.Offen = async plugin =>
{
    var m = PluginApi.Scan(jobRunner.PluginDir);
    if (!m.TryGetValue(plugin, out var mf) || !mf.Raw.TryGetProperty("progress", out var pg) || pg.ValueKind != JsonValueKind.String) return 0;
    var pfad = pg.GetString();
    if (string.IsNullOrWhiteSpace(pfad)) return 0;
    // Mit Anwendern ist auch ein Lesen geschuetzt: der Takt weist sich als Dienst aus, wie ein Joblauf es tut.
    // Das Token gilt nur fuer diese eine Anfrage und wird danach zurueckgezogen
    var token = Auth.IssueServiceToken("system:nachziehen", "editor");
    using var anfrage = new HttpRequestMessage(HttpMethod.Get, jobRunner.Origin.TrimEnd('/') + pfad);
    anfrage.Headers.Add("X-Actor", "system:nachziehen");
    anfrage.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
    HttpResponseMessage a;
    try { a = await offenClient.SendAsync(anfrage); } finally { Auth.RevokeServiceToken(token); }
    using var _ = a;
    if (!a.IsSuccessStatusCode) return 0;
    using var d = JsonDocument.Parse(await a.Content.ReadAsStringAsync());
    // ready: false heisst, das Plugin kann gerade nicht arbeiten — dann waere ein Lauf vergeblich
    if (d.RootElement.TryGetProperty("ready", out var r) && r.ValueKind == JsonValueKind.False) return 0;
    return d.RootElement.TryGetProperty("offen", out var o) && o.TryGetInt32(out var n) ? n : 0;
};

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
app.UseRateLimiter();
// Ein gesperrter Server (pflegestruktur 41) beantwortet unter /api nur noch /api/health — entsperrt wird er von einem anderen Server aus
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.StartsWithSegments("/api") && !ctx.Request.Path.StartsWithSegments("/api/health") && (verbund.Gesperrt || verbund.OhneLizenz))
    {
        ctx.Response.StatusCode = 503;
        // mehr Server, als die Lizenz erlaubt (04.10.2026): dieser antwortet nicht — der Hauptserver hat Vorfahrt
        await ctx.Response.WriteAsJsonAsync(verbund.Gesperrt ? ModelApi.Err("Dieser Server ist gesperrt.")
            : Journali.Core.Licensing.Startphase.An ? ModelApi.Err("Auf dieser Datenbank arbeitet schon ein Server.") : ModelApi.Err("Für einen weiteren Server fehlt die Lizenz."));
        return;
    }
    await next();
});
app.Use(Auth.Middleware(catalog, dataDir));
// Nach der Anmeldung: der Weg der Medien nimmt grosse Dateien an (POST /api/media, PUT /api/media/blob/…); alles andere bleibt bei der Grenze von Kestrel
app.Use(async (ctx, next) =>
{
    if (Begrenzung.IstUpload(ctx.Request) && ctx.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>() is { IsReadOnly: false } f) f.MaxRequestBodySize = uploadMax;
    await next();
});
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
long dbGeprueft = -10_000;   // wann die Datenbank zuletzt geantwortet hat (TickCount64)
var gebautAm = System.IO.File.GetLastWriteTimeUtc(typeof(Program).Assembly.Location);
var laufendeVersion = typeof(Program).Assembly.GetName().Version?.ToString(3);

var api = app.MapGroup("/api");
ServerApi.Map(api, verbund);
BetriebApi.Map(api, dataDir, cachePath, Path.Combine(dataDir, $"snapshot-{connection.Host}-{connection.Port}-{connection.Database}.json"), builder.Configuration);
Auth.Map(api, dataDir);
if (Auth.Recover(catalog, dataDir, builder.Configuration["JOURNALI_ADMIN_PASSWORD"], builder.Configuration["JOURNALI_ADMIN_USER"]) is { } recovered) Console.WriteLine("journali: " + recovered);
// Einrichtungscode, solange ein Administrator fehlt oder keiner ein Passwort hat — sonst gibt es keinen
if (Auth.Lage(catalog, dataDir) is var anmeldung && anmeldung == Auth.Anmeldung.Anmelden) Einrichtungscode.Erledigt(dataDir);
else Console.WriteLine($"journali: {(anmeldung == Auth.Anmeldung.Einrichten ? "no administrator yet" : "no administrator has a password")} — setup code {Einrichtungscode.Aktiv(dataDir)} (also in {Einrichtungscode.PathOf(dataDir)})");

// ---- Stand und Modell ----------------------------------------------------

// Ohne Sitzung (es gibt Benutzer, der Fragende hat keine) sagt /health nur, dass der Server und seine Datenbank da sind, dazu Version und Bau —
// Journalstand, Knotenzahl, Nutzung und Tarif gehören zur angemeldeten Person (01.10.2026).
// Die Beschreibung der Schnittstelle (OpenAPI 3.0), aus den Endpunkten erzeugt: wer sie ruft, braucht eine Sitzung oder ein Token wie bei jedem anderen Aufruf
api.MapGet("/openapi.json", (EndpointDataSource quelle) => Results.Json(OpenApiDoc.Build(quelle.Endpoints, laufendeVersion), new System.Text.Json.JsonSerializerOptions { WriteIndented = false, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull }));

api.MapGet("/health", (HttpRequest req, Catalog c) =>
{
    DatenbankPruefen();   // wirft bei unerreichbarer Datenbank; die Wache oben macht daraus 503
    var wer = req.HttpContext.Items["user"] as string;
    if (string.IsNullOrEmpty(wer) && Auth.Enabled(c)) wer = Auth.Resolve(req.HttpContext, c, dataDir)?.User;
    if (Auth.Enabled(c) && string.IsNullOrEmpty(wer)) return Results.Ok(new { ok = true, abgemeldet = true, built = gebautAm, version = laufendeVersion, startphase = Journali.Core.Licensing.Startphase.An ? true : (bool?)null, testversion = BetriebshinweisApi.Testversion ? true : (bool?)null, demo = Demo.An ? true : (bool?)null, gesperrt = verbund.Gesperrt ? true : (bool?)null, ohneLizenz = verbund.OhneLizenz ? true : (bool?)null });
    return Results.Ok(new
{
    head = c.Head,
    modelAt = c.ReadModel(m => m.Changed),   // letzte Änderung am Modell: die Oberfläche lädt es nur dann neu
    nodes = c.Read(t => t.Nodes.Count),
    // Nutzung für die Statusleiste: Woche und Monat, mehr steht in den Einstellungen.
    // Wessen Nutzung: „die beiden kleinen Balken oben sollen dem Anwender anzeigen, was für ein
    // Verbrauchsstand in seinem Team ist“ — das Team der Mitgliedschaft, am Ende der Zahlerkette. Auch beim
    // Administrator: er führt vielleicht viele Teams, gehört aber genau einem an.
    usage = Journali.Core.Licensing.Startphase.An ? null : Nutzung(req, c),   // Startphase: nichts zu journali-Token
    startphase = Journali.Core.Licensing.Startphase.An ? true : (bool?)null,    // die Oberfläche blendet Lizenz, Limits und Token aus
    testversion = BetriebshinweisApi.Testversion ? true : (bool?)null,    // oben das rote Feld „Testversion“
    demo = Demo.An ? true : (bool?)null,    // Demo: kein eigenes Konto, kein Abmelden
    built = gebautAm,      // Stand der LAUFENDEN Version — einmal beim Start gelesen
    version = laufendeVersion,     // die Version, die läuft — steht oben in der Leiste
    // der Tarif dieser Instanz: die Oberfläche richtet sich danach, was sie überhaupt anbietet
    tarif = new { key = catalog.InstanzTarif.Key, label = catalog.InstanzTarif.Label, schedules = catalog.InstanzTarif.Zeitplan },
    // wer sonst noch dort ist, wo der Fragende gerade steht (?ort=<Knoten oder Ansicht>) — leer ohne Angabe
    presence = Dort(req, c),
    // Registrierung beim Lizenzserver: null = noch nicht gefragt. Die Oberfläche fragt dann einmal (Recht users).
    registriert = c.Registriert,
    // dieser Server (pflegestruktur 41): Rolle und Sperre — die Leiste zeigt, wenn es ein Arbeitsserver ist
    // erlaubt: wie viele Server laufen dürfen — erst ab zweien gibt es in den Einstellungen den Reiter ⧉ Server
    server = new { id = verbund.Id, host = verbund.Host, haupt = verbund.IstHaupt, gesperrt = verbund.Gesperrt, ohneLizenz = verbund.OhneLizenz, erlaubt = verbund.Erlaubt },
});
});

/// <summary>Fragt die Datenbank, höchstens alle 5 Sekunden: der Punkt unten links in der Oberfläche soll sagen, ob die eingestellte Datenbank da ist.
/// Der Journalstand im Speicher sagt das nicht. Fällt die Anfrage aus, wirft sie, und der nächste Aufruf versucht es sofort wieder.</summary>
void DatenbankPruefen()
{
    var jetzt = Environment.TickCount64;
    if (jetzt - Interlocked.Read(ref dbGeprueft) < 5000) return;
    _ = journal.Head;
    Interlocked.Exchange(ref dbGeprueft, jetzt);
}

/// <summary>Der Puls der Präsenz: „ich bin hier“ und wer sonst noch — mit Namen, wie die Oberfläche sie zeigt.</summary>
object[] Dort(HttpRequest req, Catalog c)
{
    var ort = req.Query["ort"].FirstOrDefault();
    if (string.IsNullOrWhiteSpace(ort)) return [];
    var ich = req.HttpContext.Items["user"] as string;
    if (string.IsNullOrEmpty(ich) && Auth.Enabled(c)) ich = Auth.Resolve(req.HttpContext, c, dataDir)?.User;
    var andere = presence.Puls(ich, ort, DateTimeOffset.UtcNow);
    if (andere.Count == 0) return [];
    return c.Lesen((_, _) => andere.Select(a => (object)new { key = a, name = c.Users.All.GetValueOrDefault(a)?.Name ?? a }).ToArray());
}

/// <summary>Die Zahlen der Statusleiste — für die Instanz oder für das eigene Team, je nachdem, wer fragt.</summary>
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
    return c.Lesen((_, _) =>
    {
        // Ohne Anmeldung (offene Instanz) gilt die Lizenz
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
                week = Teil(u.Sum(c.Jobs.MitJobs([ich!]), Usage.WeekStart(today), today), 0, woche, "kein Team"),
                month = Teil(u.Sum(c.Jobs.MitJobs([ich!]), Usage.MonthStart(today), today), 0, monat, "kein Team"),
            });
        var zahler = c.Teams.Payer(mein);
        var zt = c.Teams.Get(zahler)!;
        var leute = Abrechnung.Urheber(c.Teams, c.Users, c.Jobs, zahler, Model.InitTeam);   // Mitglieder und Jobs der Teams dieses Zahlers
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
// Nutzungsstatistik (05.10.2026): je Monat, wie viele Einträge welcher Art ins Journal gingen — zum Ansehen und als CSV in ≡ Journal;
// nichts davon verlässt den Server von selbst
api.MapGet("/usage/months", (Catalog c, int limit = 120) => c.ReadUsage(u => u.Months(Math.Clamp(limit, 1, 600)))
    .Select(m => new { month = m.Month.ToString("yyyy-MM"), kinds = m.Kinds, total = m.Kinds.Values.Sum() }).ToList());
NutzungsberichtApi.Map(api, laufendeVersion);
BetriebshinweisApi.Map(api);   // Hinweise zum Betrieb: einmal bestätigt, im Journal
// Nutzungsberichte (05.10.2026): nur eingeschaltet, einmal im Monat, nur vom Hauptserver. Auch in der Startphase — dann ist das der einzige Weg zum
// Lizenzserver, und den schaltet ein Administrator selbst ein
var berichtAdresse = Journali.Core.Licensing.Aussteller.Adresse;
#if DEBUG
if (Environment.GetEnvironmentVariable("JOURNALI_LIZENZSERVER") is { } berichtEigener) berichtAdresse = berichtEigener.Trim();
#endif
_ = Task.Run(async () =>
{
    using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
    await Task.Delay(TimeSpan.FromMinutes(2));
    while (true)
    {
        if (verbund.IstHaupt)
            try { if (await NutzungsberichtApi.SendenAsync(catalog, journal, http, berichtAdresse, dataDir, laufendeVersion, DateOnly.FromDateTime(DateTime.Now)) is { } was) Console.WriteLine($"journali: {was}"); }
            catch (Exception e) { Console.WriteLine($"journali: usage report not sent — {e.Message}"); }
        await Task.Delay(TimeSpan.FromHours(6));
    }
});

ModelApi.Map(api);
DocsApi.Map(api);
SemanticApi.Map(api, jobDir);   // Vektoren (35): offene Postenliste für embed, Frage an die Dokumente, ähnliche Knoten

// ---- Baum: Knoten, Werte, Kategorien, Freigaben — einzeln und im Stapel ---------

TreeApi.Map(api);
RelationApi.Map(api);
ClassificationApi.Map(api);
MediaApi.Map(api);
DeriveApi.Map(api);   // Vorschau-Presets und Ableitungen (Plugin derive rechnet)
ProbeApi.Map(api);
MediaWorkflowApi.Map(api, jobRunner);   // derselbe Workflow auch für Assets, wenn seine Rollen media nennen   // Bildabmessungen: der Server liest, der Job probe treibt an (Tasker führt ihn)
TranslateApi.Map(api);
WorkflowApi.Map(api, jobRunner);   // Workflows (27): Definitionen, Zustand je Knoten, Schritte, Meine Aufgaben   // Übersetzungsmanagement: Einheiten je Sprachrichtung, Rückweg mit Quellprüfung (Plugin xliff)
VersionApi.Map(api, pluginDir, LoggerFactory.Create(b => b.AddConsole()).CreateLogger("versions"));   // Versionen
PluginApi.Map(api, pluginDir);
BatchApi.Map(api);
TransferApi.Map(api);   // Rohdaten eines Teilbaums hin und zurück (JSON, wiederherstellbar)
RestoreApi.Map(api);   // Teilbaum aus einer Rohdaten-Datei zurueck (Einstellungen, kein Plugin)
BackupApi.Map(api, journal, dataDir, pluginDir);
DatenbankApi.Map(api, ziel, dataDir, app.Logger, db);   // ⇅ B&R → Datenbank: Verbindung und Passwort (für die eigene Sicherung)   // Vollsicherung: Journal, Medien, Zugänge, Plugins — zurück in ein leeres System
MailApi.Map(api, mailer);   // Mailserver einstellen und eine Probe senden (Einstellungen → Mail)
LicenceKeys.Map(api, licences, new KeyRequests(db, instanz), instanz, abos);   // Schlüssel: signiert anfordern, einlösen — Reset oder Limit, an die Instanz gebunden, einmal
JobApi.Map(api, jobRunner, verbund.ProtokollLesen);   // Jobs: Definition, Läufe, Logs (Plugin tasker)
ScriptumApi.Map(api, jobRunner);   // Skripte (37): im Journal geschrieben, als Job gelaufen — der Quelltext nur für das Schreibrecht
ConfiguratorApi.Map(api);   // Konfigurator (39): eine Auswahl gegen die Regeln im Journal prüfen — für den Shop
TeamApi.Map(api, jobDir);   // Teams: Kostenstelle der KI — Schlüssel, Verbuchung, Führung
AiApi.Map(api, jobDir);     // KI über den Server: Schlüssel des zahlenden Teams; begrenzt wird hier nichts
LicenceApi.Map(api, licences, abos);      // Lizenz ansehen, Abo verbinden und auffrischen
FileApi.Map(api, dataDir, builder.Environment);   // Dateibrowser des Servers: Storage-Verzeichnis, Job-Quellen und -Ziele
DriverApi.Map(api, dataDir, builder.Environment, jobDir);   // Zugänge: dieselben Dateien über einen benannten Zugang, später auch ferne

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
// brief=true (Oberfläche): eine Nutzlast über 4 KB kommt gekürzt — Plugin-Daten sind bis 4 MB je Eintrag, und die Journal-Ansicht braucht
// nur, was sie beschreibt (04.10.2026). Der ganze Eintrag: /journal/{nummer}.
api.MapGet("/journal", (IJournal j, long after = 0, int limit = 1000, bool brief = false) =>
    j.ReadAfter(after).Take(Math.Clamp(limit, 1, 10_000)).Select(e => EntryView.Gekuerzt(e, brief ? EntryView.BriefBytes : null)));

api.MapGet("/journal/{number:long}", (long number, IJournal j) =>
    j.ReadAfter(number - 1).FirstOrDefault() is { } e && e.Number == number
        ? Results.Ok(EntryView.Of(e))
        : Results.NotFound());

// limit: nur die neuesten so viele (die Knotenansicht: 500 — ein oft bearbeiteter Knoten hat tausende Einträge); types: nur diese Typen (Workflow-Verlauf)
api.MapGet("/streams/{stream}", (string stream, IJournal j, int? limit = null, string? types = null) =>
{
    var typen = types?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet(StringComparer.Ordinal);
    var alle = j.ReadStream(stream).Where(e => typen is null || typen.Contains(e.Type));
    return (limit is { } n && n > 0 ? alle.TakeLast(n) : alle).Select(EntryView.Of);
});

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
    if (SchnappschussFaellig(catalog.Head)) _ = Task.Run(() => WriteSnapshot("after start"));   // im Hintergrund — der Start wartet nicht
    app.Lifetime.ApplicationStopping.Register(() => { if (SchnappschussFaellig(catalog.Head)) WriteSnapshot("on shutdown"); });
    // Stündlich nachsehen, ob sich einer lohnt: nach einem Absturz sind höchstens 10 000 Einträge oder die eines Tages nachzuspielen
    _ = Task.Run(async () =>
    {
        while (true)
        {
            await Task.Delay(TimeSpan.FromHours(1));
            try { if (SchnappschussFaellig(catalog.Head)) WriteSnapshot("due"); } catch { }
        }
    });
}
// Jeder Server hört auf die Aufträge an ihn (LISTEN journali_server)
_ = Task.Run(() => verbund.HoerenAsync(jobRunner.Ausfuehren, app.Lifetime.ApplicationStopping));
// Die Adresse, unter der die Jobs diesen Server erreichen, bevor die erste Anfrage kam: ein Hauptserver bekommt vielleicht nie eine —
// die Oberfläche läuft auf den Arbeitsservern. Die eigene Adresse, mit localhost statt „alle Adressen“
app.Lifetime.ApplicationStarted.Register(() =>
{
    if (app.Urls.FirstOrDefault() is { } eigene && jobRunner.Origin == "http://localhost:5000")
        jobRunner.Origin = System.Text.RegularExpressions.Regex.Replace(eigene, @"//(\+|\*|0\.0\.0\.0|\[::\])(?=[:/]|$)", "//localhost");
    // Demo: die neuen Bilder brauchen Abmessungen und Vorschauen — wie nach einem Hochladen
    if (demoBilder > 0 && verbund.IstHaupt)
        _ = Task.Run(async () =>
        {
            await Task.Delay(TimeSpan.FromSeconds(5));
            foreach (var (was, kick) in new (string, Func<(string? Job, string? Error)>)[] { ("probe", () => ProbeApi.Kick(catalog, jobRunner, Demo.Anwender)), ("derive", () => DeriveApi.Kick(catalog, jobRunner, Demo.Anwender)) })
                try { if (kick().Error is { } fehler) Console.WriteLine($"journali: demo {was} — {fehler}"); }
                catch (Exception e) { Console.WriteLine($"journali: demo {was} — {e.Message}"); }
        });
});
app.Lifetime.ApplicationStopping.Register(verbund.Dispose);   // die Sperre des Hauptservers freigeben, bevor der Prozess endet
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
    public const int BriefBytes = 4096;

    public static EntryView Of(Entry e) => Gekuerzt(e, null);

    /// <summary>Mit <paramref name="max"/> kommt eine längere Nutzlast gekürzt (JournalBrief).</summary>
    public static EntryView Gekuerzt(Entry e, int? max) =>
        new(e.Number, e.At, e.Actor, e.Stream, e.Type, JournalBrief.Payload(e.Payload, max), e.Batch, e.Kind ?? Kinds.Of(e.Type));   // alte Einträge ohne Spalte: aus dem Typ
}
