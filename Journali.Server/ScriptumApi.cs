using System.Text.Json;
using System.Text.Json.Serialization;
using Journali.Core.Entries;
using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Skripte, die der Anwender schreibt und anstösst (docs/pflegestruktur.md 37, 29.09.2026). Das Programm liegt nicht
/// in einem Plugin-Verzeichnis, sondern <b>im Journal</b> (Plugin-Daten von <c>scriptum</c>, Name <c>script:&lt;key&gt;</c>):
/// versioniert, rückholbar, in der Sicherung enthalten. Ein Geheimnis steht nie darin — dafür sind Zugänge und der Tresor da.
/// <para><b>Gelaufen wird als Job.</b> Von Hand anstossen legt den Job <c>scriptum_&lt;key&gt;</c> an (oder frischt ihn auf)
/// und startet ihn über den <see cref="JobRunner"/> — derselbe Kindprozess, dasselbe Log, dieselbe Zeitgrenze wie bei
/// jedem Plugin. Kein Skript läuft im Serverprozess. Das Ergebnis steht als letzte Zeile auf stdout und damit im Log
/// des Laufs; <c>GET /scriptum/runs/{job}/{run}</c> liest es von dort.</para>
/// <para><b>Zwei Rechte.</b> <see cref="Rights.ScriptumWrite"/> schreibt und liest den Quelltext; wer es hat, kann alles,
/// was der Serverbenutzer kann. <see cref="Rights.ScriptumRun"/> stösst ein <b>freigegebenes</b> Skript an und sieht sein
/// Ergebnis — den Quelltext sieht es nie. Freigegeben heisst: am Skript steht, welches Recht sein Lauf braucht
/// (<c>run</c>). Den Quelltext bekommt ausserdem der Lauf selbst: ein Dienst-Token gehört einem Prozess auf diesem
/// Server, nicht einem Browser (<see cref="Auth.IstDienst"/>).</para>
/// <para><b>Das Token trägt die Rolle, die am Skript steht</b> — ein Skript darf nie mehr als ein Anwender mit dieser
/// Rolle. Ohne Rolle gilt <c>editor</c>, wie bei einem Job ohne Rolle.</para>
/// </summary>
public static class ScriptumApi
{
    public const string Plugin = "scriptum";
    public const string Praefix = "script:";
    /// <summary>Womit ein Lauf sein Ergebnis meldet: die letzte Zeile mit dieser Marke. Alles andere ist Protokoll.</summary>
    public const string Marke = "⟦scriptum⟧";
    /// <summary>Der Job eines Skripts — einer je Skript, damit Läufe, Log und Fächer dort stehen, wo sie hingehören.</summary>
    public static string JobKey(string script) => "scriptum_" + script;

    /// <summary>
    /// Ein Skript, wie es im Journal steht. <c>Params</c> ist der Kopf des Quelltexts (<c>export const meta</c>), beim
    /// Speichern gelesen — daraus baut die Oberfläche das Formular. <c>Run</c> ist das Recht, das sein Lauf braucht:
    /// gesetzt heisst freigegeben, leer heisst „nur wer Skripte schreiben darf“.
    /// </summary>
    public sealed record Skript(string Key, string Label, string? Role, string? Run, string Source,
        List<Param>? Params = null, string? Note = null, int Limit = 0)
    {
        /// <summary>Ohne Quelltext — das sieht, wer nur ausführen darf.</summary>
        public object Offen(long? number = null) => new { Key, Label, Role, Run, released = Freigegeben, Params = Params ?? [], Note, Limit = Grenze, Number = number };
        /// <summary>Freigegeben: am Skript steht, welches Recht sein Lauf braucht.</summary>
        [JsonIgnore] public bool Freigegeben => Run is { Length: > 0 };
        /// <summary>Zeitgrenze eines Laufs in Sekunden: was am Skript steht, sonst eine Minute; höchstens eine Stunde.</summary>
        [JsonIgnore] public int Grenze => Math.Clamp(Limit <= 0 ? 60 : Limit, 5, 3600);
    }

    /// <summary>Ein Parameter aus dem Kopf des Skripts: daraus baut die Oberfläche das Formular.</summary>
    public sealed record Param(string Key, string? Label = null, string? Type = null, string? Default = null);

    public sealed record SkriptBody(string? Label, string? Role, string? Run, string? Source, List<Param>? Params, string? Note, int? Limit);
    public sealed record RunBody(Dictionary<string, string>? Params);

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static void Map(RouteGroupBuilder api, JobRunner runner)
    {
        // Die Skripte, ohne Quelltext — für die Liste, das Formular und die Auswahl im Job-Dialog
        api.MapGet("/scriptum/scripts", (Catalog c) => Results.Ok(Alle(c).Select(s => s.Offen()).ToList()));

        // Eines, mit Quelltext: nur mit dem Schreibrecht (Auth.Needed)
        api.MapGet("/scriptum/scripts/{key}", (string key, Catalog c) =>
            Lies(c, key) is { } s ? Results.Ok(new { s.Key, s.Label, s.Role, s.Run, released = s.Freigegeben, s.Source, Params = s.Params ?? [], s.Note, Limit = s.Grenze }) : Results.NotFound());

        // Nur der Quelltext, roh — den holt der Lauf mit seinem Dienst-Token
        api.MapGet("/scriptum/scripts/{key}/source", (string key, Catalog c) =>
            Lies(c, key) is { } s ? Results.Text(s.Source, "text/plain; charset=utf-8") : Results.NotFound());

        api.MapPut("/scriptum/scripts/{key}", (string key, SkriptBody body, HttpRequest req, Catalog c) =>
        {
            if (ModelApi.Actor(req) is not { } actor) return ModelApi.ActorMissing();
            if (!ModelApi.ValidKey(key)) return Bad("Schlüssel „{0}“: nur a-z, 0-9 und _, beginnt mit Buchstabe.", key);
            var alt = Lies(c, key);
            var quelle = body.Source ?? alt?.Source ?? "";
            if (quelle.Length > 400_000) return Bad("Höchstens 400 000 Zeichen je Skript.");
            if (Blank(body.Role) is { } r && !c.Lesen((_, _) => c.Users.Roles.ContainsKey(r))) return Bad("Rolle {0} gibt es nicht.", r);
            if (Blank(body.Run) is { } recht && !Rights.All.Contains(recht)) return Bad("Recht {0} gibt es nicht.", recht);
            var prm = (body.Params ?? alt?.Params ?? []).Where(p => !string.IsNullOrWhiteSpace(p.Key)).Take(50)
                .Select(p => new Param(p.Key.Trim(), Blank(p.Label), Blank(p.Type), p.Default)).ToList();
            if (prm.FirstOrDefault(p => !ModelApi.ValidKey(p.Key)) is { } schief) return Bad("Parameter „{0}“: nur a-z, 0-9 und _, beginnt mit Buchstabe.", schief.Key);
            // Ein Feld, das nicht mitkam, bleibt stehen; ein leeres Feld löscht es
            var s = new Skript(key, Blank(body.Label) ?? alt?.Label ?? key,
                body.Role is null ? alt?.Role : Blank(body.Role), body.Run is null ? alt?.Run : Blank(body.Run),
                quelle, prm, body.Note is null ? alt?.Note : Blank(body.Note), body.Limit ?? alt?.Limit ?? 0);
            var eintrag = c.With((_, _, write) => write(actor, Plugins.Stream + Plugin, Types.PluginDataSet,
                new PluginDataSet(Praefix + key, JsonSerializer.Serialize(s, Json)), null));
            return Results.Ok(s.Offen(eintrag.Number));
        });

        api.MapDelete("/scriptum/scripts/{key}", (string key, HttpRequest req, Catalog c) =>
        {
            if (ModelApi.Actor(req) is not { } actor) return ModelApi.ActorMissing();
            if (Lies(c, key) is null) return Results.NotFound();
            c.With((_, _, write) => write(actor, Plugins.Stream + Plugin, Types.PluginDataSet, new PluginDataSet(Praefix + key, null), null));
            return Results.Ok(new { entfernt = key });
        });

        // Von Hand anstossen — als Job, wie alles andere auch: der Job entsteht oder wird aufgefrischt und läuft los.
        // Der Browser bekommt Job und Lauf und fragt damit nach Stand und Ergebnis
        api.MapPost("/scriptum/scripts/{key}/run", (string key, RunBody? body, HttpRequest req, Catalog c) =>
        {
            if (ModelApi.Actor(req) is not { } actor) return ModelApi.ActorMissing();
            if (Lies(c, key) is not { } s) return Results.NotFound();
            if (DarfStarten(req, c, s) is { } nein) return nein;
            var state = c.Lesen((_, _) => c.Plugins.All.GetValueOrDefault(Plugin));
            if (state is null || !state.Enabled) return Bad("Plugin {0} ist nicht installiert oder aus.", Plugin);
            if (PluginApi.NichtImTarif(c, Plugin) is { } tarif) return tarif;
            var job = JobKey(key);
            var prm = new Dictionary<string, string> { ["script"] = key, ["limit"] = s.Grenze.ToString(), ["args"] = JsonSerializer.Serialize(body?.Params ?? new(), Json) };
            c.With((_, _, write) =>
            {
                var cur = c.Jobs.All.GetValueOrDefault(job);
                return write(actor, Jobs.Stream + job, Types.JobDefined,
                    new JobDefined(s.Label, Plugin, prm, cur?.Schedule, true, Math.Max(1, (s.Grenze + 119) / 60), null, cur?.Files, s.Role, actor), null);
            });
            runner.Origin = $"{req.Scheme}://{req.Host}";
            var run = runner.Start(job, "manual", out var fehler);
            return run is null ? Bad(fehler ?? "nicht gestartet") : Results.Ok(new { job, run });
        });

        // Stand und Ergebnis eines Laufs: aus dem Journal, was aus ihm wurde, und aus dem Log, was er gemeldet hat.
        // Wer ausführen darf, sieht das — ohne das Recht auf Jobs und ohne den Quelltext
        api.MapGet("/scriptum/runs/{job}/{run}", (string job, string run, Catalog c) =>
        {
            if (!ModelApi.ValidKey(job) || !job.StartsWith("scriptum_", StringComparison.Ordinal)) return Results.NotFound();
            if (run.Contains("..") || run.Contains('/') || run.Contains('\\')) return Results.NotFound();
            var lauf = c.Lesen((_, _) => c.Jobs.All.GetValueOrDefault(job)?.Runs.FirstOrDefault(r => r.Id == run));
            var text = Log(runner.LogPath(job, run));
            return Results.Ok(new
            {
                job, run, laeuft = lauf is not null && lauf.Status is null, status = lauf?.Status, exit = lauf?.Exit, sekunden = lauf?.Seconds,
                ergebnis = Ergebnis(text), log = Protokoll(text),
            });
        });

        // Eine Datei, die ein Lauf geschrieben hat: sie liegt im Fach out/ des Jobs, im Ordner dieses Laufs.
        // Herunterladen darf, wer das Skript anstossen darf — die Datei ist sein Ergebnis
        api.MapGet("/scriptum/runs/{job}/{run}/file", (string job, string run, string name, Catalog c) =>
        {
            if (!ModelApi.ValidKey(job) || !job.StartsWith("scriptum_", StringComparison.Ordinal)) return Results.NotFound();
            if (Schlecht(run) || Schlecht(name)) return Results.NotFound();
            if (c.Lesen((_, _) => c.Jobs.All.GetValueOrDefault(job)) is not { } j) return Results.NotFound();
            var fach = new JobFach(runner.Dir).Fach(j, "out");
            if (!Directory.Exists(fach)) return Results.NotFound();
            var ordner = Directory.EnumerateDirectories(fach).FirstOrDefault(d => Path.GetFileName(d).EndsWith("-" + run, StringComparison.Ordinal));
            var pfad = ordner is null ? null : Path.Combine(ordner, name);
            return pfad is not null && File.Exists(pfad)
                ? Results.File(File.OpenRead(pfad), "application/octet-stream", name) : Results.NotFound();
        });
    }

    /// <summary>Ein Name, der aus seinem Verzeichnis führt — den gibt es hier nicht.</summary>
    private static bool Schlecht(string s) => s.Length == 0 || s.Contains("..") || s.Contains('/') || s.Contains('\\');

    /// <summary>
    /// Darf dieser Aufruf das Skript starten? Wer Skripte schreibt, immer. Sonst nur ein freigegebenes, und nur mit dem
    /// Recht, das am Skript steht — so bedient jemand die Auswertung, ohne je Quelltext zu sehen.
    /// </summary>
    private static IResult? DarfStarten(HttpRequest req, Catalog c, Skript s)
    {
        if (Auth.Has(req, c, Rights.ScriptumWrite)) return null;
        if (!s.Freigegeben) return Bad("Skript {0} ist nicht freigegeben.", s.Key);
        return Auth.Has(req, c, s.Run!) ? null : Bad("Skript {0} braucht das Recht {1}.", s.Key, Rights.Label.GetValueOrDefault(s.Run!) ?? s.Run!);
    }

    /// <summary>Alle Skripte im Journal, nach Schlüssel.</summary>
    public static List<Skript> Alle(Catalog c) =>
        [.. Daten(c).Where(kv => kv.Key.StartsWith(Praefix, StringComparison.Ordinal))
            .Select(kv => Lesen(kv.Key[Praefix.Length..], kv.Value)).Where(s => s is not null).Select(s => s!).OrderBy(s => s.Key, StringComparer.Ordinal)];

    /// <summary>Ein Skript — null, wenn es das nicht gibt oder der Eintrag unlesbar ist.</summary>
    public static Skript? Lies(Catalog c, string key) =>
        Daten(c).TryGetValue(Praefix + key, out var json) ? Lesen(key, json) : null;

    private static Dictionary<string, string> Daten(Catalog c) =>
        c.Lesen((_, _) => c.Plugins.All.TryGetValue(Plugin, out var p) ? new Dictionary<string, string>(p.Data) : []);

    private static Skript? Lesen(string key, string json)
    {
        try { return JsonSerializer.Deserialize<Skript>(json, Json) is { } s ? s with { Key = key } : null; }
        catch (JsonException) { return null; }   // ein unlesbarer Eintrag darf die Liste nicht sprengen
    }

    private static string Log(string pfad)
    {
        if (!File.Exists(pfad)) return "";
        try
        {
            using var fs = new FileStream(pfad, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            using var sr = new StreamReader(fs);
            return sr.ReadToEnd();
        }
        catch (IOException) { return ""; }
    }

    /// <summary>
    /// Das Ergebnis aus der Ausgabe eines Laufs: die letzte Zeile mit der Marke. Das Log trägt vor jeder Zeile die
    /// Uhrzeit — gesucht wird darum die Marke in der Zeile, nicht am Anfang.
    /// </summary>
    public static JsonElement? Ergebnis(string output)
    {
        foreach (var zeile in output.Split('\n').Reverse())
        {
            var i = zeile.IndexOf(Marke, StringComparison.Ordinal);
            if (i < 0) continue;
            try { return JsonDocument.Parse(zeile[(i + Marke.Length)..].TrimEnd('\r')).RootElement.Clone(); } catch (JsonException) { return null; }
        }
        return null;
    }

    /// <summary>Die Ausgabe ohne die Ergebniszeile — das Protokoll des Laufs.</summary>
    public static string Protokoll(string output) =>
        string.Join("\n", output.Split('\n').Where(z => !z.Contains(Marke, StringComparison.Ordinal))).Trim();

    private static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
    private static IResult Bad(string vorlage, params object[] werte) => ModelApi.Bad(vorlage, werte);
}
