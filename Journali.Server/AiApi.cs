using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Der KI-Weg über den Server. Bis dahin fragte der
/// Browser den Anbieter selbst, mit dem Schlüssel aus dem localStorage — dann kann niemand zählen, niemand begrenzen, und
/// ein Job kann gar keine KI. Liegt der Schlüssel am Team, muss der Server fragen:
/// <list type="bullet">
/// <item>Der Schlüssel bleibt beim Server (Datenverzeichnis, nie im Journal, nie im Browser).</item>
/// <item>Jeder Aufruf wird festgehalten — beim <b>zahlenden</b> Team, mit Anbieter, Modell, Person und Anlass
/// (<c>AiUsed</c>), dazu das <b>gemessene Volumen</b>: Bytes hin, Bytes zurück.</item>
/// <item>Keine Tokenzahl, keine Kosten, keine Umrechnung. Was journali sagt, hat journali selbst gemessen.</item>
/// <item>Begrenzt wird hier nichts.</item>
/// <item>Jobs können KI, weil sie ein Token haben und damit einen Anwender — also ein Team.</item>
/// </list>
/// Einen anderen Weg gibt es seit dem 23.09.2026 nicht mehr — auch das Modell steht am Team, denn es bestimmt Kosten und Güte. Ohne Team: keine KI.
/// </summary>
public static class AiApi
{
    public sealed record AskBody(string? Provider, string? Model, string? System, string? User, int? MaxTokens, bool? Web, int? MaxSearches, string? Purpose);
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromMinutes(5) };
    /// <summary>Für Tests: statt des Anbieters (sonst der HttpClient oben).</summary>
    public static Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>>? Senden { get; set; }
    private static Task<HttpResponseMessage> SendeAsync(HttpRequestMessage req, CancellationToken ct) => Senden is { } s ? s(req, ct) : Http.SendAsync(req, ct);

    /// <summary>
    /// Ein Werkzeug für die KI (19.10.2026, pflegestruktur 43): Name (Buchstaben, Ziffern, _ und -), Beschreibung, Eingabe als JSON-Schema — und
    /// was journali tut, wenn die KI es ruft. Der Aufruf läuft in journali (das Geheimnis des Zugangs bleibt beim Server); die KI bekommt nur das Ergebnis.
    /// </summary>
    public sealed record KiWerkzeug(string Name, string? Beschreibung, JsonElement Schema, Func<JsonElement, CancellationToken, Task<(string Text, bool Fehler)>> Aufruf);
    /// <summary>So viele Werkzeugaufrufe je Anfrage — danach antwortet die KI mit dem, was sie hat.</summary>
    public const int MaxWerkzeugAufrufe = 4;
    /// <summary>So lang darf ein Ergebnis sein, das an die KI geht.</summary>
    public const int MaxWerkzeugErgebnis = 6000;

    /// <summary>Der dritte Anbieter (29.09.2026): ein Modell auf dem eigenen Server, erreichbar über die Ollama-Schnittstelle.</summary>
    public const string Lokal = "lokal";
    /// <summary>Wer die Plugins fragen — steht am Team in <c>Models</c> unter diesem Schlüssel; kein eigener Eintragstyp.</summary>
    public const string AnbieterWahl = "*";
    /// <summary>Die Adresse des lokalen Modells aus der Umgebung (<c>JOURNALI_KI_LOKAL</c>, z. B. http://localhost:11434); null = kein lokales Modell.</summary>
    public static string? LokalUrl => Normalisiere(Environment.GetEnvironmentVariable("JOURNALI_KI_LOKAL"));
    /// <summary>Das Modell, wenn das Team keines gewählt hat (<c>JOURNALI_KI_LOKAL_MODELL</c>); sonst das erste, das der Dienst kennt.</summary>
    public static string? LokalModell => Blank(Environment.GetEnvironmentVariable("JOURNALI_KI_LOKAL_MODELL"));
    public static string? Normalisiere(string? url) => Blank(url) is { } u ? u.Trim().TrimEnd('/') : null;
    /// <summary>
    /// Die Adresse des lokalen Modells für ein Team: die eigene, wie ein Schlüssel im Tresor abgelegt (29.09.2026) —
    /// ein Team trägt sie über denselben Weg ein wie einen echten Schlüssel (<c>PUT /teams/{key}/keys</c>, Anbieter
    /// <c>lokal</c>), kein eigener Eintragstyp. Ohne eigene Adresse gilt die der Umgebung (<see cref="LokalUrl"/>).
    /// </summary>
    public static string? LokalUrlFuer(IReadOnlyDictionary<string, string> teamKeys) =>
        Normalisiere(teamKeys.GetValueOrDefault(Lokal)) ?? LokalUrl;

    /// <summary>
    /// Die Anbieter eines Teams in der Reihenfolge, in der sie ohne Wahl gefragt werden: die bezahlten mit Schlüssel,
    /// sortiert, dann das lokale Modell — ein hinterlegter Schlüssel ist eine Entscheidung, das lokale Modell der Rückfall.
    /// </summary>
    public static List<string> Anbieter(IEnumerable<string> keys, bool lokal)
    {
        var list = keys.Where(k => k != Lokal).Order().ToList();
        if (lokal) list.Add(Lokal);
        return list;
    }

    /// <summary>Der Anbieter, der gefragt wird: der gewünschte, wenn es ihn gibt; sonst die Wahl des Teams; sonst der erste.</summary>
    public static string? Gewaehlt(string? want, string? wahl, IReadOnlyList<string> anbieter) =>
        Blank(want) is { } w && anbieter.Contains(w) ? w : Blank(wahl) is { } x && anbieter.Contains(x) ? x : anbieter.FirstOrDefault();

    /// <summary>Obergrenze des Kontextfensters — gemessen am 29.09.2026 auf 4 Kernen mit 8 GB: 16k passen mit einem 4B-Modell in 5 GB.</summary>
    public const int LokalKontextMax = 16384;
    /// <summary>
    /// Das Kontextfenster zur Eingabe: Ollama nimmt sonst 2048–4096 Token und schneidet still ab. Geschätzt mit 3 Zeichen je
    /// Token (deutscher Text), dazu die Antwort, in 2048er-Schritten aufgerundet, bis zur Obergrenze.
    /// </summary>
    public static int LokalKontext(int zeichen, int maxTokens)
    {
        var noetig = zeichen / 3 + maxTokens + 256;
        var stufe = (int)Math.Ceiling(noetig / 2048.0) * 2048;
        return Math.Clamp(stufe, 2048, LokalKontextMax);
    }

    /// <summary>Die Anfrage an das lokale Modell (Ollama: POST /api/chat, ohne Strom). num_predict begrenzt die Antwort wie max_tokens, num_ctx das Fenster.</summary>
    public static object LokalBody(string model, string? system, string user, int maxTokens)
    {
        var messages = new List<object>();
        if (!string.IsNullOrWhiteSpace(system)) messages.Add(new { role = "system", content = system });
        messages.Add(new { role = "user", content = user });
        return new { model, messages, stream = false, options = new { num_predict = maxTokens, num_ctx = LokalKontext((system?.Length ?? 0) + user.Length, maxTokens) } };
    }

    /// <summary>Eingang und Ausgang aus der Antwort des lokalen Modells: prompt_eval_count und eval_count.</summary>
    public static (int In, int Out) LokalUsage(JsonElement root)
    {
        int Feld(string name) => root.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : 0;
        return (Feld("prompt_eval_count"), Feld("eval_count"));
    }

    /// <summary>Die Modelle, die der lokale Dienst kennt (GET /api/tags) — für die Wahl am Team und als Rückfall.</summary>
    public static async Task<List<string>> LokalModelleAsync(string? url, CancellationToken ct)
    {
        if (url is null) return [];
        // Der Dienst ist nicht erreichbar (Tunnel zu, Dienst aus, falsche Adresse): keine Modelle, kein Fehler — die Wahl am Team bleibt offen
        using var frist = CancellationTokenSource.CreateLinkedTokenSource(ct);
        frist.CancelAfter(TimeSpan.FromSeconds(5));
        try
        {
            using var res = await Http.GetAsync(url + "/api/tags", frist.Token);
            if (!res.IsSuccessStatusCode) return [];
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(frist.Token));
            return doc.RootElement.TryGetProperty("models", out var ms) && ms.ValueKind == JsonValueKind.Array
                ? ms.EnumerateArray().Select(m => m.TryGetProperty("name", out var n) ? n.GetString() : null).Where(n => !string.IsNullOrWhiteSpace(n)).Select(n => n!).ToList()
                : [];
        }
        catch (Exception e) when (e is HttpRequestException or JsonException || (e is OperationCanceledException && !ct.IsCancellationRequested)) { return []; }
    }

    /// <summary>Was die Anbieter sprechen — dieselben zwei wie im Browser (web/src/ai.js), hier serverseitig.</summary>
    /// <summary>
    /// Die Anfrage an die Anthropic-API. Der Systemtext geht als Block mit <c>cache_control</c>: wiederholt sich der Anfang
    /// einer Anfrage innerhalb weniger Minuten — dieselbe Attributliste für das zweite Dokument eines Knotens, derselbe
    /// Katalog für den nächsten Knoten der Prüfmaschine —, liest der Dienst ihn aus dem Cache statt ihn neu zu rechnen
    /// (28.09.2026). Unter der Mindestlänge des Dienstes bleibt der Block ein gewöhnlicher Systemtext; ein Nachteil entsteht
    /// nicht. temperature gibt es bei Claude 5 nicht mehr — wir schicken es gar nicht erst.
    /// </summary>
    public static object AnthropicBody(string model, int maxTokens, string? system, string user, bool web, int maxSearches)
    {
        maxTokens = Math.Max(maxTokens, AnthropicMindestTokens);
        var sys = string.IsNullOrWhiteSpace(system) ? null : new object[] { new { type = "text", text = system, cache_control = new { type = "ephemeral" } } };
        var messages = new[] { new { role = "user", content = user } };
        return web
            ? new { model, max_tokens = maxTokens, system = sys, messages, tools = new object[] { new { type = "web_search_20250305", name = "web_search", max_uses = maxSearches } } }
            : (object)new { model, max_tokens = maxTokens, system = sys, messages };
    }

    /// <summary>
    /// Untergrenze für <c>max_tokens</c> bei Anthropic (18.10.2026): die aktuellen Modelle denken vor der Antwort (adaptiv; abschalten lehnt die API bei
    /// Claude Sonnet 5.5 und Opus 5.5 ab), und das Denken zählt gegen <c>max_tokens</c>. Mit 200 (Produktberater, „glück“) und 300 (Angaben aus einem
    /// Satz) endete die Antwort vor dem ersten Textblock — leer, ohne Fehler. Berechnet wird, was erzeugt wird, nicht die Grenze.
    /// </summary>
    public const int AnthropicMindestTokens = 4096;

    /// <summary>Eingang und Ausgang aus <c>usage</c>: die Cache-Felder zählen zum Eingang — auch gelesener Cache ging über die Leitung.</summary>
    public static (int In, int Out) AnthropicUsage(JsonElement us)
    {
        int Feld(string name) => us.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : 0;
        return (Feld("input_tokens") + Feld("cache_creation_input_tokens") + Feld("cache_read_input_tokens"), Feld("output_tokens"));
    }

    /// <summary>Ein Aufruf beim Anbieter: Text und Quellen, die gemessenen Bytes hin und zurück, die gemeldeten Tokenzahlen — und warum die Antwort
    /// endete (bei Anthropic <c>stop_reason</c>; ein leerer Text ohne ihn hiesse nichts)</summary>
    public static async Task<(string Text, List<object> Sources, long BytesIn, long BytesOut, int TokensIn, int TokensOut, string? Ende)> Call(string provider, string key, string model, string? system, string user, int maxTokens, bool web, int maxSearches, CancellationToken ct)
    {
        using var req = new HttpRequestMessage();
        object body;
        if (provider == "anthropic")
        {
            req.RequestUri = new Uri("https://api.anthropic.com/v1/messages");
            req.Headers.TryAddWithoutValidation("x-api-key", key);
            req.Headers.TryAddWithoutValidation("anthropic-version", "2023-06-01");
            body = AnthropicBody(model, maxTokens, system, user, web, maxSearches);
        }
        else if (provider == Lokal)
        {
            req.RequestUri = new Uri((Normalisiere(key) ?? LokalUrl ?? "http://localhost:11434") + "/api/chat");
            body = LokalBody(model, system, user, maxTokens);
        }
        else
        {
            req.RequestUri = new Uri("https://api.openai.com/v1/responses");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
            body = web
                ? new { model, max_output_tokens = maxTokens, instructions = system, input = user, tools = new object[] { new { type = "web_search" } }, max_tool_calls = maxSearches }
                : (object)new { model, max_output_tokens = maxTokens, instructions = system, input = user };
        }
        req.Method = HttpMethod.Post;
        // Gemessen wird, was wirklich über die Leitung geht: die Bytes des Anfrage-JSON und die der Antwort
        var gesendet = JsonSerializer.Serialize(body, new JsonSerializerOptions { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull });
        var bytesIn = Encoding.UTF8.GetByteCount(gesendet);
        req.Content = new StringContent(gesendet, Encoding.UTF8, "application/json");
        using var res = await SendeAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        var bytesOut = Encoding.UTF8.GetByteCount(raw);
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(raw) ? "{}" : raw);
        var root = doc.RootElement;
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException(root.TryGetProperty("error", out var err) && err.TryGetProperty("message", out var m) ? m.GetString() ?? res.ReasonPhrase ?? "Fehler" : $"{(int)res.StatusCode} {res.ReasonPhrase}");
        var sources = new List<object>(); var text = new StringBuilder();
        int tin = 0, tout = 0; string? ende = null;
        if (provider == "anthropic")
        {
            foreach (var block in root.GetProperty("content").EnumerateArray())
            {
                if (block.TryGetProperty("type", out var ty) && ty.GetString() == "text" && block.TryGetProperty("text", out var tx)) text.Append(tx.GetString());
                if (block.TryGetProperty("citations", out var cits) && cits.ValueKind == JsonValueKind.Array)
                    foreach (var cit in cits.EnumerateArray())
                        if (cit.TryGetProperty("url", out var url) && url.GetString() is { Length: > 0 } u)
                            sources.Add(new { url = u, title = cit.TryGetProperty("title", out var ti) ? ti.GetString() ?? u : u });
            }
            if (root.TryGetProperty("usage", out var us)) (tin, tout) = AnthropicUsage(us);
            if (root.TryGetProperty("stop_reason", out var sr) && sr.ValueKind == JsonValueKind.String) ende = sr.GetString();
        }
        else if (provider == Lokal)
        {
            if (root.TryGetProperty("message", out var msg) && msg.TryGetProperty("content", out var ctn)) text.Append(ctn.GetString());
            (tin, tout) = LokalUsage(root);
        }
        else
        {
            foreach (var o in root.GetProperty("output").EnumerateArray())
            {
                if (!o.TryGetProperty("type", out var ty) || ty.GetString() != "message" || !o.TryGetProperty("content", out var cs)) continue;
                foreach (var cpart in cs.EnumerateArray())
                {
                    if (cpart.TryGetProperty("type", out var ct2) && ct2.GetString() == "output_text" && cpart.TryGetProperty("text", out var tx)) text.Append(tx.GetString());
                    if (cpart.TryGetProperty("annotations", out var anns) && anns.ValueKind == JsonValueKind.Array)
                        foreach (var a in anns.EnumerateArray())
                            if (a.TryGetProperty("url", out var url) && url.GetString() is { Length: > 0 } u)
                                sources.Add(new { url = u, title = a.TryGetProperty("title", out var ti) ? ti.GetString() ?? u : u });
                }
            }
            if (root.TryGetProperty("usage", out var us))
            {
                tin = us.TryGetProperty("input_tokens", out var i) ? i.GetInt32() : 0;
                tout = us.TryGetProperty("output_tokens", out var o) ? o.GetInt32() : 0;
            }
        }
        // 04.10.2026: zurück gingen hier die Tokenzahlen als Bytes — das Austauschvolumen zeigte Token statt gemessener Bytes
        return (text.ToString(), sources, bytesIn, bytesOut, tin, tout, ende);
    }

    /// <summary>
    /// Die Anfrage an die Anthropic-API mit Werkzeugen (19.10.2026): ruft die KI eines (stop_reason tool_use), führt journali es aus und schickt das
    /// Ergebnis zurück — die Antwort der KI bleibt dabei unverändert im Gespräch (auch ihr Nachdenken). Höchstens <see cref="MaxWerkzeugAufrufe"/>
    /// Aufrufe; danach bekommt sie „keine weiteren“ und antwortet. Bytes und Tokens zählen über alle Runden.
    /// </summary>
    public static async Task<(string Text, List<object> Sources, long BytesIn, long BytesOut, int TokensIn, int TokensOut, string? Ende)> CallMitWerkzeugen(
        string key, string model, string? system, string user, int maxTokens, IReadOnlyList<KiWerkzeug> werkzeuge, CancellationToken ct)
    {
        var sys = string.IsNullOrWhiteSpace(system) ? null : new JsonArray(new JsonObject { ["type"] = "text", ["text"] = system, ["cache_control"] = new JsonObject { ["type"] = "ephemeral" } });
        var tools = new JsonArray(werkzeuge.Select(w => (JsonNode)new JsonObject
        {
            ["name"] = w.Name, ["description"] = w.Beschreibung ?? w.Name, ["input_schema"] = JsonNode.Parse(w.Schema.ValueKind == JsonValueKind.Object ? w.Schema.GetRawText() : "{\"type\":\"object\"}"),
        }).ToArray());
        var gespraech = new JsonArray(new JsonObject { ["role"] = "user", ["content"] = user });
        long hin = 0, zurueck = 0; int tin = 0, tout = 0, aufrufe = 0; string? ende = null; var text = new StringBuilder();
        for (var runde = 0; runde <= MaxWerkzeugAufrufe + 1; runde++)
        {
            var body = new JsonObject { ["model"] = model, ["max_tokens"] = Math.Max(maxTokens, AnthropicMindestTokens), ["messages"] = gespraech.DeepClone(), ["tools"] = tools.DeepClone() };
            if (sys is not null) body["system"] = sys.DeepClone();
            using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
            req.Headers.TryAddWithoutValidation("x-api-key", key);
            req.Headers.TryAddWithoutValidation("anthropic-version", "2023-06-01");
            var gesendet = body.ToJsonString();
            hin += Encoding.UTF8.GetByteCount(gesendet);
            req.Content = new StringContent(gesendet, Encoding.UTF8, "application/json");
            using var res = await SendeAsync(req, ct);
            var raw = await res.Content.ReadAsStringAsync(ct);
            zurueck += Encoding.UTF8.GetByteCount(raw);
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(raw) ? "{}" : raw);
            var root = doc.RootElement;
            if (!res.IsSuccessStatusCode)
                throw new InvalidOperationException(root.TryGetProperty("error", out var err) && err.TryGetProperty("message", out var m) ? m.GetString() ?? "Fehler" : $"{(int)res.StatusCode} {res.ReasonPhrase}");
            if (root.TryGetProperty("usage", out var us)) { var (i, o) = AnthropicUsage(us); tin += i; tout += o; }
            ende = root.TryGetProperty("stop_reason", out var sr) && sr.ValueKind == JsonValueKind.String ? sr.GetString() : null;
            text.Clear();
            var rufe = new List<(string Id, string Name, JsonElement Eingabe)>();
            var inhalt = root.TryGetProperty("content", out var ct2) && ct2.ValueKind == JsonValueKind.Array ? ct2 : default;
            if (inhalt.ValueKind == JsonValueKind.Array)
                foreach (var block in inhalt.EnumerateArray())
                {
                    var art = block.TryGetProperty("type", out var ty) ? ty.GetString() : null;
                    if (art == "text" && block.TryGetProperty("text", out var tx)) text.Append(tx.GetString());
                    else if (art == "tool_use" && block.TryGetProperty("id", out var id) && block.TryGetProperty("name", out var nm))
                        rufe.Add((id.GetString() ?? "", nm.GetString() ?? "", block.TryGetProperty("input", out var ein) ? ein.Clone() : default));
                }
            if (ende != "tool_use" || rufe.Count == 0) return (text.ToString(), [], hin, zurueck, tin, tout, ende);
            gespraech.Add(new JsonObject { ["role"] = "assistant", ["content"] = JsonNode.Parse(inhalt.GetRawText()) });
            var ergebnisse = new JsonArray();
            foreach (var (id, name, eingabe) in rufe)
            {
                string ergebnis; bool fehler;
                if (werkzeuge.FirstOrDefault(w => w.Name == name) is not { } w) (ergebnis, fehler) = ("Dieses Werkzeug gibt es nicht.", true);
                else if (aufrufe >= MaxWerkzeugAufrufe) (ergebnis, fehler) = ("Keine weiteren Werkzeugaufrufe — antworte mit dem, was da ist.", true);
                else
                {
                    aufrufe++;
                    try { (ergebnis, fehler) = await w.Aufruf(eingabe, ct); }
                    catch (Exception e) when (e is not OperationCanceledException || !ct.IsCancellationRequested) { (ergebnis, fehler) = ("Das Werkzeug antwortet nicht: " + e.Message, true); }
                }
                if (ergebnis.Length > MaxWerkzeugErgebnis) ergebnis = ergebnis[..MaxWerkzeugErgebnis] + " …";
                ergebnisse.Add(new JsonObject { ["type"] = "tool_result", ["tool_use_id"] = id, ["content"] = ergebnis, ["is_error"] = fehler });
            }
            gespraech.Add(new JsonObject { ["role"] = "user", ["content"] = ergebnisse });
        }
        return (text.ToString(), [], hin, zurueck, tin, tout, ende);
    }

    public static void Map(RouteGroupBuilder api, string jobsDir)
    {
        // Was die Oberfläche wissen muss: welches Team zahlt, welche Anbieter eingerichtet sind, wie viel schon verbraucht ist
        api.MapGet("/ai/state", (HttpRequest req, Catalog c) => c.Lesen((_, _) =>
        {
            var team = TeamApi.TeamOf(c, req.HttpContext.Items["user"] as string);
            if (team is null || c.Teams.Get(team) is not { } t) return Results.Ok(new { team = (string?)null, ready = false, reason = "kein Team" });
            var zahler = c.Teams.Payer(team); var zt = c.Teams.Get(zahler)!;
            var keysDaZahler = Secrets.Get(jobsDir, TeamApi.SecretKey(zahler));
            var providers = Anbieter(keysDaZahler.Keys, LokalUrlFuer(keysDaZahler) is not null);
            var heute = DateOnly.FromDateTime(DateTime.Today);
            var tag = c.Teams.Day(zahler, heute);
            return Results.Ok(new
            {
                team, label = t.Label, payer = zahler, payerLabel = zt.Label, providers, ready = t.Enabled && zt.Enabled && providers.Count > 0,
                chosen = Gewaehlt(null, zt.Models.GetValueOrDefault(AnbieterWahl), providers),   // wen die Plugins fragen
                models = zt.Models,   // welches Modell je Anbieter gefragt wird
                // Was journali selbst gemessen hat: Bytes hin und zurück. Keine Tokenzahl, keine Kosten.
                volume = new { today = tag.Bytes, todayIn = tag.BytesIn, todayOut = tag.BytesOut, month = c.Teams.Month(zahler, heute.ToString("yyyy-MM")) },
            });
        }));

        // Die Modelle des lokalen Dienstes — an der Adresse des zahlenden Teams, sonst der der Umgebung. Für die Wahl
        // am Team; die Adresse selbst bleibt beim Server
        api.MapGet("/ai/lokal/models", async (HttpRequest req, Catalog c, CancellationToken ct, string? team = null) =>
        {
            var url = c.Lesen((_, _) =>
            {
                // team: das Team, dessen Seite gezeigt wird; ohne Angabe das eigene
                var gezeigt = team is { Length: > 0 } && c.Teams.Get(team) is not null ? team : TeamApi.TeamOf(c, req.HttpContext.Items["user"] as string);
                return gezeigt is null ? LokalUrl : LokalUrlFuer(Secrets.Get(jobsDir, TeamApi.SecretKey(c.Teams.Payer(gezeigt))));
            });
            return Results.Ok(new { ready = url is not null, models = url is null ? [] : await LokalModelleAsync(url, ct) });
        });

        // Die eine Frage — mit dem Schlüssel des zahlenden Teams, gezählt bei ihm
        api.MapPost("/ai/ask", async (AskBody body, HttpRequest req, Catalog c, CancellationToken ct) =>
        {
            if (Actor(req) is not { } _) return ActorMissing();
            if (Blank(body.User) is not { } frage) return Bad("user fehlt.");
            var r = await AskAsync(req, c, jobsDir, body.Provider, body.Model, Blank(body.System), frage, Math.Clamp(body.MaxTokens ?? 2000, 1, 64000), body.Web == true, Math.Clamp(body.MaxSearches ?? 5, 1, 20), Blank(body.Purpose), ct);
            return r.Fehler ?? Results.Ok(new { text = r.Text, sources = r.Sources, team = r.Team, payer = r.Payer, provider = r.Provider, model = r.Model });
        });
    }

    /// <summary>
    /// Die Frage an die KI als Methode — für <c>/ai/ask</c> und für andere Wege im Server (die Frage an die Dokumente,
    /// 35). Team und Schlüssel wie oben beschrieben, gezählt beim zahlenden Team. Ohne Team oder Schlüssel kommt der
    /// Fehler als fertige Antwort zurück.
    /// </summary>
    public static async Task<(IResult? Fehler, string Text, List<object> Sources, string Team, string Payer, string Provider, string Model)> AskAsync(
        HttpRequest req, Catalog c, string jobsDir, string? wantProvider, string? wantModel, string? system, string frage, int maxTokens, bool web, int maxSearches, string? purpose, CancellationToken ct,
        string? fuerTeam = null, IReadOnlyList<KiWerkzeug>? werkzeuge = null)
    {
        if (Actor(req) is not { } actor) return (ActorMissing(), "", [], "", "", "", "");
        // die Demo (18.10.2026): ihr Schlüssel, ihr Modell, ihre Grenzen — keine Suche im Internet, kurze Antworten, wenige Anfragen je Besucher
        if (Demo.An)
        {
            if (Demo.KiPruefen(Demo.Absender.Value ?? req.HttpContext.Connection.RemoteIpAddress?.ToString(), req.HttpContext.Items["advisor"] is string, web,
                    (system?.Length ?? 0) + frage.Length) is { } grenze)
                return (Bad(grenze.Vorlage, grenze.Werte), "", [], "", "", "", "");
            maxTokens = Math.Min(maxTokens, Demo.KiMaxTokens);
        }
        var (fehler, team, zahler, provider, key, lokalUrl) = c.Lesen((_, _) =>
        {
            // team: ein Berater (08.10.2026) gehört keinem Team — seine Definition nennt, wessen Schlüssel gilt
            var mein = fuerTeam ?? TeamApi.TeamOf(c, req.HttpContext.Items["user"] as string);
            if (mein is null || c.Teams.Get(mein) is not { Enabled: true } t) return (Bad("Kein Team — ohne Team gibt es keine KI über den Server."), "", "", "", "", (string?)null);
            var zahlerKey = c.Teams.Payer(mein); var zt = c.Teams.Get(zahlerKey)!;
            if (!zt.Enabled) return (Bad("Das zahlende Team „{0}“ ist abgeschaltet.", zt.Label), "", "", "", "", (string?)null);
            var keys = Secrets.Get(jobsDir, TeamApi.SecretKey(zahlerKey));
            var url = LokalUrlFuer(keys);
            var anbieter = Anbieter(keys.Keys, url is not null);
            var p = Gewaehlt(wantProvider, zt.Models.GetValueOrDefault(AnbieterWahl), anbieter);
            if (p is null) return (Bad("Für „{0}“ ist kein KI-Schlüssel hinterlegt.", zt.Label), "", "", "", "", (string?)null);
            return ((IResult?)null, mein, zahlerKey, p, p == Lokal ? (url ?? "") : keys[p], url);
        });
        if (fehler is not null) return (fehler, "", [], "", "", "", "");
        if (web && provider == Lokal) return (Bad("Das lokale Modell sucht nicht im Internet."), "", [], "", "", "", "");

        var amTeam = c.Lesen((_, _) => c.Teams.Get(zahler)?.Models.GetValueOrDefault(provider));
        var model = Blank(amTeam) ?? Blank(wantModel) ?? (provider == "anthropic" ? "claude-sonnet-5-5" : provider == Lokal ? (LokalModell ?? (await LokalModelleAsync(lokalUrl, ct)).FirstOrDefault() ?? "") : "gpt-5");
        if (Demo.An && provider == "anthropic") model = Blank(Demo.KiModell) ?? Demo.KiModellVorgabe;   // in der Demo gilt ihr Modell, gleich was die Anfrage nennt
        if (provider == Lokal && model == "") return (Bad("Das lokale Modell hat kein Modell geladen."), "", [], "", "", "", "");
        try
        {
            // mit Werkzeugen nur beim Anbieter anthropic (19.10.2026) — die anderen antworten ohne, wie bisher
            var (text, sources, hin, zurueck, tokenHin, tokenZurueck, ende) = werkzeuge is { Count: > 0 } && provider == "anthropic" && !web
                ? await CallMitWerkzeugen(key, model, system, frage, maxTokens, werkzeuge, ct)
                : await Call(provider, key, model, system, frage, maxTokens, web, Math.Max(1, maxSearches), ct);
            var heute = DateOnly.FromDateTime(DateTime.Today);
            c.With((_, _, write) => write(actor, Teams.UsageStream + zahler, Types.AiUsed,
                new AiUsed(provider, model, actor, tokenHin, tokenZurueck, 1, heute.ToString("yyyy-MM-dd"), team == zahler ? null : team, hin, zurueck, purpose), null));
            // ohne Text (18.10.2026): gezählt ist der Aufruf, gemeldet wird er als Fehler mit dem Grund — vorher ging ein leerer Text als Antwort durch
            if (string.IsNullOrWhiteSpace(text)) return (Bad("Die KI hat keinen Text geliefert ({0}).", ende ?? "leer"), "", sources, team, zahler, provider, model);
            return (null, text, sources, team, zahler, provider, model);
        }
        catch (Exception e) { return (Bad(e.Message), "", [], "", "", "", ""); }
    }
}
