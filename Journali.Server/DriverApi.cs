using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Zugänge (Treiber). Ein Plugin fragt nicht mehr selbst nach Adresse und Passwort, sondern nach einem <b>Zugang</b>
/// seiner Art: „gib mir die Zugänge vom Typ mysql“. Eingerichtet werden sie einmal unter ⬡ Plugins → Zugänge.
/// <para><b>Zwei Sorten.</b> Ein Zugang, der <i>Dateien liefert</i> (<c>file</c>, später ftp, webdav), kann auflisten
/// und bekommt einen Browser — dafür sind <see cref="Files"/> und die Verzeichnisbefehle. Ein Zugang, der nur
/// <i>Anmeldung</i> ist (mysql, solr, ixp), hat keine Verzeichnisse: der Treiber hält seine Felder bereit und reicht
/// sie an das Plugin weiter, das damit umzugehen weiss. <b>Der Treiber ist keine Schicht über Datenbanken</b> — er
/// kennt kein SQL und keinen Index (25.09.2026).</para>
/// <para><b>Wo was liegt:</b> die Felder ohne Geheimnis als Plugin-Daten im Journal (<c>plugin:driver</c>, Name
/// <c>zugang:&lt;key&gt;</c>), das Geheimnis über <see cref="Secrets"/> beim Server — nie im Journal, denn dort
/// lässt sich nichts löschen. <b>Ein Geheimnis geht nur an einen Prozess</b>, nie an die Oberfläche: der JobRunner
/// reicht es als <c>JOURNALI_*</c> an den Kindprozess; der Browser bekommt allenfalls den Namen des Zugangs.</para>
/// </summary>
public static class DriverApi
{
    /// <summary>Der eingebaute Zugang: das Dateisystem des Servers. Immer da, ohne Einrichtung, ohne Geheimnis.</summary>
    public const string Lokal = "lokal";

    /// <summary>Eine Art von Zugang und ihre Felder. <c>Dateien</c> sagt, ob der Zugang auflisten kann. Wie ein Feld im Formular
    /// heisst, sagt die Oberfläche des Plugins — dort wird es auch übersetzt.</summary>
    public sealed record Art(string Key, string Label, bool Dateien, string[] Felder, string[] Geheim);

    /// <summary>
    /// Was es gibt. <b>Nur was wirklich trägt</b> — eine Art, die noch nicht umgesetzt ist, steht hier nicht:
    /// angeboten wird nichts, was beim Anklicken „ist noch nicht gebaut“ antwortet (25.09.2026).
    /// <para>Alle Arten gehören zu diesem einen Plugin — kein Plugin je Art (28.09.2026). Dateien liefern <c>file</c>,
    /// <c>webdav</c> und <c>ftp</c>, alle hinter derselben Schnittstelle (<see cref="IDateiTreiber"/>); <c>ixp</c> und
    /// <c>solr</c> sind Anmeldungen: der Job bekommt ihre Felder, der Browser liest die Quelle über
    /// <c>/drivers/{zugang}/relay</c> — das Geheimnis verlässt den Server nicht. <c>mysql</c> kommt, sobald ein Plugin es liest.</para>
    /// </summary>
    public static readonly IReadOnlyList<Art> Arten =
    [
        new("file", "Dateisystem des Servers", true, [], []),
        new("webdav", "WebDAV", true, ["url", "user"], ["password"]),
        new("ftp", "FTP", true, ["host", "port", "user", "pfad", "tls"], ["password"]),
        new("ixp", "IXP (Anmeldung)", false, ["url"], ["token"]),
        new("solr", "Solr (Anmeldung)", false, ["url", "user"], ["password"]),
        new("http", "HTTP/REST", false, ["url", "auth", "user", "header"], ["secret"]),
    ];

    /// <summary>Arten, deren Quelle über die Weiterleitung gelesen und beschickt wird — nie direkt, denn das Geheimnis bleibt beim Server.</summary>
    public static readonly IReadOnlySet<string> Anmeldungen = new HashSet<string> { "ixp", "solr", "http" };

    /// <summary>
    /// Kopfzeilen, die die Weiterleitung vom Aufrufer an die Quelle durchreicht — nie sein Authorization (das ist
    /// journalis eigenes). Für Abläufe wie ERP-CSRF: den Token (<c>X-CSRF-Token</c>), die Vorbedingung (<c>If-Match</c>,
    /// ETag) und den Sitzungskeks als <c>X-Relay-Cookie</c> → <c>Cookie</c> — so, weil eine Node-fetch keine eigene
    /// Cookie-Kopfzeile setzen darf.
    /// </summary>
    private static readonly (string Ein, string Aus)[] RelayKopfDurch =
        [("X-CSRF-Token", "X-CSRF-Token"), ("If-Match", "If-Match"), ("X-Relay-Cookie", "Cookie")];

    public static Art? ArtVon(string? key) => Arten.FirstOrDefault(a => a.Key == key);

    /// <summary>Ein eingerichteter Zugang, wie er im Journal steht (ohne Geheimnis).</summary>
    public sealed record Zugang(string Key, string Art, string Label, Dictionary<string, string> Felder);

    /// <summary>Was die Oberfläche schickt. <c>Geheim</c> geht nur hinein — zurück kommen nur die Namen.</summary>
    public sealed record ZugangBody(string? Art, string? Label, Dictionary<string, string>? Felder, Dictionary<string, string?>? Geheim);

    private const string Plugin = "driver";
    private const string Praefix = "zugang:";

    public static void Map(RouteGroupBuilder api, string dataDir, IHostEnvironment env, string jobsDir)
    {
        // Welche Arten es gibt — die Oberfläche baut daraus das Formular je Zugang
        api.MapGet("/drivers/arten", () => Results.Ok(Arten.Select(a => new { a.Key, a.Label, a.Dateien, a.Felder, a.Geheim })));

        // Die eingerichteten Zugänge. Mit ?art=mysql fragt ein Plugin nur die seiner Art;
        // mit ?dateien=true nur die, die auflisten können
        api.MapGet("/drivers", (Catalog c, string? art, bool dateien = false) =>
        {
            var alle = Alle(c).Where(z => art is not { Length: > 0 } || z.Art == art)
                .Where(z => !dateien || (ArtVon(z.Art)?.Dateien ?? false))
                .Select(z => new
                {
                    z.Key, z.Art, z.Label, z.Felder,
                    dateien = ArtVon(z.Art)?.Dateien ?? false,
                    geheim = Secrets.Get(jobsDir, Secrets.ProfileKey(Plugin, z.Key)).Keys.Order().ToList(),   // nur die Namen
                });
            return Results.Ok(alle);
        });

        // Einrichten und ändern. Die offenen Felder gehen ins Journal, das Geheimnis in den Tresor beim Server —
        // nie ins Journal, denn dort lässt sich nichts löschen. Ein Geheimnis kommt von hier nie zurück
        api.MapPut("/drivers/{zugang}", (string zugang, ZugangBody body, HttpRequest req, Catalog c) =>
        {
            if (ModelApi.Actor(req) is not { } actor) return ModelApi.ActorMissing();
            if (zugang == Lokal) return Bad("Der Zugang {0} ist eingebaut und lässt sich nicht ändern.", Lokal);
            if (FileApi.Name(zugang) is null) return Bad("Name des Zugangs: ohne Trennzeichen, nicht leer.");
            if (ArtVon(body.Art) is not { } art) return Bad("Art {0} gibt es nicht.", body.Art ?? "");
            var felder = new Dictionary<string, string>();
            foreach (var f in art.Felder) if (body.Felder?.GetValueOrDefault(f) is { Length: > 0 } v) felder[f] = v.Trim();
            var z = new Zugang(zugang, art.Key, body.Label is { Length: > 0 } l ? l.Trim() : zugang, felder);
            var json = JsonSerializer.Serialize(z, Json);
            var eintrag = c.With((_, _, write) => write(actor, Plugins.Stream + Plugin, Types.PluginDataSet, new PluginDataSet(Praefix + zugang, json), null));
            // Geheimnisse: nur die, die die Art kennt, und nur wenn etwas mitkam — leer lassen behält das alte
            if (body.Geheim is { Count: > 0 })
            {
                var neu = art.Geheim.Where(g => body.Geheim.ContainsKey(g)).ToDictionary(g => g, g => body.Geheim[g]);
                if (neu.Count > 0) Secrets.Set(jobsDir, Secrets.ProfileKey(Plugin, zugang), neu);
            }
            return Results.Ok(new { z.Key, z.Art, z.Label, geheim = Secrets.Get(jobsDir, Secrets.ProfileKey(Plugin, zugang)).Keys.Order(), nummer = eintrag.Number });
        });

        api.MapDelete("/drivers/{zugang}", (string zugang, HttpRequest req, Catalog c) =>
        {
            if (ModelApi.Actor(req) is not { } actor) return ModelApi.ActorMissing();
            if (zugang == Lokal) return Bad("Der Zugang {0} ist eingebaut.", Lokal);
            c.With((_, _, write) => write(actor, Plugins.Stream + Plugin, Types.PluginDataSet, new PluginDataSet(Praefix + zugang, null), null));
            foreach (var a in Arten) Secrets.Set(jobsDir, Secrets.ProfileKey(Plugin, zugang), a.Geheim.ToDictionary(g => g, _ => (string?)null));
            return Results.Ok(new { entfernt = zugang });
        });

        // Auflisten — nur bei einem Zugang, der Dateien liefert. Das Dateisystem des Servers antwortet wie /api/files;
        // ein ferner Zugang geht über seinen Treiber und antwortet in derselben Form (Treiber.Antwort)
        api.MapGet("/drivers/{zugang}/files", async (string zugang, Catalog c, string? path, CancellationToken ct) =>
        {
            if (MitDatei(c, zugang, out var fehler) is not { } z) return fehler;
            if (z.Art == "file") return FileApi.Files(dataDir, env.ContentRootPath, path);
            return await Fern(async () =>
            {
                var t = TreiberFuer(z, jobsDir)!; var p = Treiber.Normal(path);
                return Results.Ok(Treiber.Antwort(z.Label, p, await t.ListeAsync(p, ct)));
            });
        });

        api.MapPost("/drivers/{zugang}/dir", async (string zugang, FileApi.NeuBody body, HttpRequest req, Catalog c, CancellationToken ct) =>
        {
            if (MitDatei(c, zugang, out var fehler) is not { } z) return fehler;
            if (z.Art == "file") return FileApi.NeuesVerzeichnis(body, req);
            if (ModelApi.Actor(req) is null) return ModelApi.ActorMissing();
            if (FileApi.Name(body.Name) is not { } name) return Bad("Name: ohne \\ / : * ? \" < > | und nicht leer.");
            return await Fern(async () => { var ziel = Treiber.Kind(body.Path ?? "/", name); await TreiberFuer(z, jobsDir)!.NeuesVerzeichnisAsync(ziel, ct); return Results.Ok(new { path = ziel }); });
        });

        api.MapPut("/drivers/{zugang}/dir", async (string zugang, FileApi.UmbenennenBody body, HttpRequest req, Catalog c, CancellationToken ct) =>
        {
            if (MitDatei(c, zugang, out var fehler) is not { } z) return fehler;
            if (z.Art == "file") return FileApi.VerzeichnisUmbenennen(body, req);
            if (ModelApi.Actor(req) is null) return ModelApi.ActorMissing();
            if (FileApi.Name(body.Name) is not { } name) return Bad("Name: ohne \\ / : * ? \" < > | und nicht leer.");
            return await Fern(async () =>
            {
                var alt = Treiber.Normal(body.Path); if (Treiber.Vater(alt) is not { } vater) return Bad("Die Wurzel eines Zugangs lässt sich nicht umbenennen.");
                var neuPfad = Treiber.Kind(vater, name);
                await TreiberFuer(z, jobsDir)!.UmbenennenAsync(alt, neuPfad, ct);
                return Results.Ok(new { path = neuPfad });
            });
        });

        // Prüfen: kommt der Zugang an? Dateien: die Wurzel auflisten; Anmeldung: die Quelle einmal fragen
        api.MapPost("/drivers/{zugang}/test", async (string zugang, Catalog c, CancellationToken ct) =>
        {
            if (Alle(c).FirstOrDefault(x => x.Key == zugang) is not { } z) return Bad("Zugang {0} gibt es nicht.", zugang);
            try
            {
                if (ArtVon(z.Art)?.Dateien ?? false)
                {
                    if (z.Art == "file") return Results.Ok(new { ok = true, text = "ok" });
                    var n = (await TreiberFuer(z, jobsDir)!.ListeAsync("/", ct)).Count;
                    return Results.Ok(new { ok = true, text = $"{n}" });
                }
                using var res = await Weiter(z, Geheim(jobsDir, z.Key), z.Art == "solr" ? "/admin/ping" : "/", ct);
                return Results.Ok(new { ok = res.IsSuccessStatusCode, text = $"{(int)res.StatusCode}" });
            }
            catch (Exception e) when (e is IOException or HttpRequestException or ArgumentException or TaskCanceledException or InvalidOperationException)
            { return Results.Ok(new { ok = false, text = e.Message }); }
        });

        // Die Weiterleitung: der Server liest die Quelle (IXP, Solr, HTTP) und beschickt sie, hängt die Anmeldung an —
        // das Geheimnis verlässt ihn nie. GET liest, POST/PUT/DELETE schreiben mit Rumpf; nur unterhalb der Adresse des
        // Zugangs (path relativ, ohne ..). Mit ?raw=1 kommt statt des Rumpfs ein Umschlag { status, headers, body }
        // zurück — für Abläufe, die eine Kopfzeile brauchen (ERP: X-CSRF-Token holen, dann mit Sitzungskeks schreiben).
        // Durchgereicht werden nur die Kopfzeilen aus RelayKopfDurch, nie das Authorization des Aufrufers
        api.MapMethods("/drivers/{zugang}/relay", ["GET", "POST", "PUT", "DELETE"], async (string zugang, string? path, bool raw, HttpContext http, Catalog c, CancellationToken ct) =>
        {
            if (Alle(c).FirstOrDefault(x => x.Key == zugang) is not { } z) return Bad("Zugang {0} gibt es nicht.", zugang);
            if (!Anmeldungen.Contains(z.Art)) return Bad("Zugang {0} liest und beschickt nicht über die Weiterleitung.", zugang);
            var methode = new HttpMethod(http.Request.Method);
            string? rumpf = null, rumpfTyp = null;
            if (methode != HttpMethod.Get && methode != HttpMethod.Delete)
            {
                using var sr = new StreamReader(http.Request.Body);
                rumpf = await sr.ReadToEndAsync(ct);
                rumpfTyp = http.Request.ContentType;
            }
            var durch = new List<KeyValuePair<string, string>>();
            foreach (var (ein, aus) in RelayKopfDurch)
                if (http.Request.Headers.TryGetValue(ein, out var v) && v.Count > 0) durch.Add(new(aus, v.ToString()));
            try
            {
                var res = await Weiter(z, Geheim(jobsDir, z.Key), path ?? "/", ct, methode, rumpf, rumpfTyp, durch);
                http.Response.RegisterForDispose(res);
                if (raw)
                {
                    var kopf = new Dictionary<string, object?>();
                    if (res.Headers.TryGetValues("X-CSRF-Token", out var tok)) kopf["x-csrf-token"] = tok.FirstOrDefault();
                    if (res.Headers.TryGetValues("Set-Cookie", out var keks)) kopf["set-cookie"] = keks.ToArray();
                    if (res.Headers.ETag is { } et) kopf["etag"] = et.ToString();
                    if (res.Content.Headers.ContentType is { } ctp) kopf["content-type"] = ctp.ToString();
                    return Results.Json(new { status = (int)res.StatusCode, headers = kopf, body = await res.Content.ReadAsStringAsync(ct) });
                }
                var typ = res.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
                return Results.Stream(await res.Content.ReadAsStreamAsync(ct), typ, enableRangeProcessing: false) is var ok && res.IsSuccessStatusCode
                    ? ok : Results.StatusCode((int)res.StatusCode);
            }
            catch (ArgumentException e) { return Bad(e.Message); }
            catch (HttpRequestException e) { return Bad("Quelle nicht erreichbar: {0}", e.Message); }
        });
    }

    /// <summary>Alle Zugänge: der eingebaute zuerst, dann die eingerichteten aus dem Journal.</summary>
    public static List<Zugang> Alle(Catalog c)
    {
        var aus = new List<Zugang> { new(Lokal, "file", "⌂ Dieser Server", new()) };
        foreach (var (name, json) in Daten(c))
        {
            if (!name.StartsWith(Praefix)) continue;
            try
            {
                var z = JsonSerializer.Deserialize<Zugang>(json, Json);
                if (z is not null && z.Key != Lokal) aus.Add(z with { Key = name[Praefix.Length..] });
            }
            catch (JsonException) { /* ein unlesbarer Eintrag darf die Liste nicht sprengen */ }
        }
        return aus;
    }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static IEnumerable<(string Name, string Json)> Daten(Catalog c) =>
        c.Lesen((_, _) => c.Plugins.All.TryGetValue(Plugin, out var p)
            ? p.Data.Select(kv => (kv.Key, kv.Value)).ToList() : []);

    /// <summary>Den Zugang holen und prüfen, dass er Dateien liefert. Sonst steht der Grund in <paramref name="fehler"/>.</summary>
    private static Zugang? MitDatei(Catalog c, string zugang, out IResult fehler)
    {
        var z = Alle(c).FirstOrDefault(x => x.Key == zugang);
        if (z is null) { fehler = Bad("Zugang {0} gibt es nicht.", zugang); return null; }
        if (!(ArtVon(z.Art)?.Dateien ?? false)) { fehler = Bad("Zugang {0} liefert keine Dateien — {1} ist eine Anmeldung.", zugang, z.Art); return null; }
        fehler = Results.Empty;
        return z;
    }

    private static IResult Bad(string vorlage, params object[] werte) => ModelApi.Bad(vorlage, werte);

    /// <summary>Die Geheimnisse eines Zugangs — nur für den Server und für Prozesse, nie für den Browser.</summary>
    public static Dictionary<string, string> Geheim(string jobsDir, string zugang) => Secrets.Get(jobsDir, Secrets.ProfileKey(Plugin, zugang));

    /// <summary>Zugang und Geheimnisse zu einem Namen — für den JobRunner (Parameter vom Typ driver, Fächer an einem Zugang).</summary>
    public static (Zugang Zugang, Dictionary<string, string> Geheim)? Aufloesen(Catalog c, string jobsDir, string? zugang) =>
        string.IsNullOrWhiteSpace(zugang) || Alle(c).FirstOrDefault(x => x.Key == zugang.Trim()) is not { } z ? null : (z, Geheim(jobsDir, z.Key));

    /// <summary>Der Treiber eines Zugangs, der Dateien liefert.</summary>
    public static IDateiTreiber? TreiberFuer(Zugang z, string jobsDir) => Treiber.Fuer(z, Geheim(jobsDir, z.Key), Handler);

    /// <summary>Nur für Prüfstände: ein eigener HTTP-Weg statt des Netzes (WebDAV, Weiterleitung).</summary>
    public static HttpMessageHandler? Handler { get; set; }

    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(60) };

    /// <summary>
    /// Die Adresse einer Weiterleitung: die URL des Zugangs plus ein relativer Pfad mit Abfrage. Kein Schema, kein
    /// <c>//</c> am Anfang, kein <c>..</c>, kein Rückstrich — sonst ginge die Anfrage an einen anderen Rechner als den des Zugangs.
    /// </summary>
    public static Uri WeiterUrl(Zugang z, string pfad)
    {
        var basis = (z.Felder.GetValueOrDefault("url") ?? "").Trim().TrimEnd('/');
        if (!Uri.TryCreate(basis, UriKind.Absolute, out var b) || b.Scheme is not ("http" or "https")) throw new ArgumentException("Zugang ohne Adresse (url mit http:// oder https://).");
        var p = (pfad ?? "/").Trim();
        if (!p.StartsWith('/')) p = "/" + p;
        if (p.StartsWith("//") || p.Contains("://") || p.Contains('\\') || p.Split('?')[0].Split('/').Any(t => t == "..")) throw new ArgumentException("Pfad: relativ zur Adresse des Zugangs, ohne ..");
        var u = new Uri(basis + p);
        if (!string.Equals(u.Host, b.Host, StringComparison.OrdinalIgnoreCase) || u.Port != b.Port) throw new ArgumentException("Pfad: relativ zur Adresse des Zugangs, ohne ..");
        return u;
    }

    /// <summary>
    /// Die Anmeldung einer Art als Authorization-Kopf: IXP Bearer mit Token, Solr Basic mit Name und Passwort; HTTP je
    /// nach Wahl (<c>auth</c>) Bearer oder Basic mit dem Geheimnis <c>secret</c>. Der eigene Kopf (auth=header) steht in
    /// <see cref="Kopf"/>, nicht hier — er ist kein Authorization.
    /// </summary>
    public static System.Net.Http.Headers.AuthenticationHeaderValue? Anmeldung(Zugang z, IReadOnlyDictionary<string, string> geheim) => z.Art switch
    {
        "ixp" when geheim.GetValueOrDefault("token") is { Length: > 0 } t => new("Bearer", t),
        "solr" when z.Felder.GetValueOrDefault("user") is { Length: > 0 } u =>
            new("Basic", Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{u}:{geheim.GetValueOrDefault("password")}"))),
        "http" when z.Felder.GetValueOrDefault("auth") == "bearer" && geheim.GetValueOrDefault("secret") is { Length: > 0 } t => new("Bearer", t),
        "http" when z.Felder.GetValueOrDefault("auth") == "basic" && z.Felder.GetValueOrDefault("user") is { Length: > 0 } u =>
            new("Basic", Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{u}:{geheim.GetValueOrDefault("secret")}"))),
        _ => null,
    };

    /// <summary>Ein Kopf über Authorization hinaus: HTTP mit <c>auth=header</c> trägt sein Geheimnis in einem eigenen Kopf (etwa <c>X-API-Key</c>).</summary>
    public static (string Name, string Wert)? Kopf(Zugang z, IReadOnlyDictionary<string, string> geheim) =>
        z.Art == "http" && z.Felder.GetValueOrDefault("auth") == "header"
            && z.Felder.GetValueOrDefault("header") is { Length: > 0 } h && geheim.GetValueOrDefault("secret") is { Length: > 0 } s
            ? (h, s) : null;

    private static async Task<HttpResponseMessage> Weiter(Zugang z, IReadOnlyDictionary<string, string> geheim, string pfad, CancellationToken ct,
        HttpMethod? methode = null, string? rumpf = null, string? typ = null, IEnumerable<KeyValuePair<string, string>>? extra = null)
    {
        using var req = new HttpRequestMessage(methode ?? HttpMethod.Get, WeiterUrl(z, pfad));
        req.Headers.Authorization = Anmeldung(z, geheim);
        if (Kopf(z, geheim) is { } k) req.Headers.TryAddWithoutValidation(k.Name, k.Wert);
        req.Headers.Accept.ParseAdd("application/json");
        if (extra is not null) foreach (var (n, v) in extra) req.Headers.TryAddWithoutValidation(n, v);
        if (rumpf is not null) req.Content = new StringContent(rumpf, System.Text.Encoding.UTF8, typ is { Length: > 0 } t ? t : "application/json");
        var http = Handler is null ? Http : new HttpClient(Handler, disposeHandler: false);
        return await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
    }

    /// <summary>Ein ferner Zugriff: was schiefgeht, ist eine Meldung, kein Absturz.</summary>
    private static async Task<IResult> Fern(Func<Task<IResult>> tun)
    {
        try { return await tun(); }
        catch (ArgumentException e) { return Bad(e.Message); }
        catch (Exception e) when (e is IOException or HttpRequestException or TaskCanceledException or System.Net.WebException or System.Xml.XmlException)
        { return Bad("Zugang nicht erreichbar: {0}", e.Message); }
    }
}
