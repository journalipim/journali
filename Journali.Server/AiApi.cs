using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Der KI-Weg über den Server (Taloan, 23.09.2026, zu Teams: „je Team gibt es Limits und API-Keys“). Bis dahin fragte der
/// Browser den Anbieter selbst, mit dem Schlüssel aus dem localStorage — dann kann niemand zählen, niemand begrenzen, und
/// ein Job kann gar keine KI. Liegt der Schlüssel am Team, muss der Server fragen:
/// <list type="bullet">
/// <item>Der Schlüssel bleibt beim Server (Datenverzeichnis, nie im Journal, nie im Browser).</item>
/// <item>Jeder Aufruf wird festgehalten — beim <b>zahlenden</b> Team, mit Anbieter, Modell, Person und Anlass
/// (<c>AiUsed</c>), dazu das <b>gemessene Volumen</b>: Bytes hin, Bytes zurück (Taloan, 23.09.2026).</item>
/// <item>Keine Tokenzahl, keine Kosten, keine Umrechnung (Taloan, 23.09.2026: „was jedes Team an KI-Tokens auf den Putz
/// haut, ist journali völlig egal“). Was journali sagt, hat journali selbst gemessen.</item>
/// <item>Begrenzt wird hier nichts.</item>
/// <item>Jobs können KI, weil sie ein Token haben und damit einen Anwender — also ein Team.</item>
/// </list>
/// Einen anderen Weg gibt es seit dem 23.09.2026 nicht mehr (Taloan: „wieso sind die KI-Schlüssel immer noch auf der
/// Ich-Seite?“) — auch das Modell steht am Team, denn es bestimmt Kosten und Güte. Ohne Team: keine KI.
/// </summary>
public static class AiApi
{
    public sealed record AskBody(string? Provider, string? Model, string? System, string? User, int? MaxTokens, bool? Web, int? MaxSearches, string? Purpose);
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromMinutes(5) };

    /// <summary>Was die Anbieter sprechen — dieselben zwei wie im Browser (web/src/ai.js), hier serverseitig.</summary>
    private static async Task<(string Text, List<object> Sources, long BytesIn, long BytesOut)> Call(string provider, string key, string model, string? system, string user, int maxTokens, bool web, int maxSearches, CancellationToken ct)
    {
        using var req = new HttpRequestMessage();
        object body;
        if (provider == "anthropic")
        {
            req.RequestUri = new Uri("https://api.anthropic.com/v1/messages");
            req.Headers.TryAddWithoutValidation("x-api-key", key);
            req.Headers.TryAddWithoutValidation("anthropic-version", "2023-06-01");
            // temperature gibt es bei Claude 5 und Opus 4.7/4.8 nicht mehr — wir schicken es gar nicht erst
            body = web
                ? new { model, max_tokens = maxTokens, system, messages = new[] { new { role = "user", content = user } }, tools = new object[] { new { type = "web_search_20250305", name = "web_search", max_uses = maxSearches } } }
                : (object)new { model, max_tokens = maxTokens, system, messages = new[] { new { role = "user", content = user } } };
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
        using var res = await Http.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        var bytesOut = Encoding.UTF8.GetByteCount(raw);
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(raw) ? "{}" : raw);
        var root = doc.RootElement;
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException(root.TryGetProperty("error", out var err) && err.TryGetProperty("message", out var m) ? m.GetString() ?? res.ReasonPhrase ?? "Fehler" : $"{(int)res.StatusCode} {res.ReasonPhrase}");
        var sources = new List<object>(); var text = new StringBuilder();
        int tin = 0, tout = 0;
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
            if (root.TryGetProperty("usage", out var us))
            {
                tin = us.TryGetProperty("input_tokens", out var i) ? i.GetInt32() : 0;
                tout = us.TryGetProperty("output_tokens", out var o) ? o.GetInt32() : 0;
            }
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
        return (text.ToString(), sources, tin, tout);
    }

    public static void Map(RouteGroupBuilder api, string jobsDir)
    {
        // Was die Oberfläche wissen muss: welches Team zahlt, welche Anbieter eingerichtet sind, wie viel schon verbraucht ist
        api.MapGet("/ai/state", (HttpRequest req, Catalog c) => c.With((_, _, _) =>
        {
            var team = TeamApi.TeamOf(c, req.HttpContext.Items["user"] as string);
            if (team is null || c.Teams.Get(team) is not { } t) return Results.Ok(new { team = (string?)null, ready = false, reason = "kein Team" });
            var zahler = c.Teams.Payer(team); var zt = c.Teams.Get(zahler)!;
            var keys = Secrets.Get(jobsDir, TeamApi.SecretKey(zahler)).Keys.Order().ToList();
            var heute = DateOnly.FromDateTime(DateTime.Today);
            var tag = c.Teams.Day(zahler, heute);
            return Results.Ok(new
            {
                team, label = t.Label, payer = zahler, payerLabel = zt.Label, providers = keys, ready = t.Enabled && zt.Enabled && keys.Count > 0,
                models = zt.Models,   // welches Modell je Anbieter gefragt wird
                // Was journali selbst gemessen hat: Bytes hin und zurück. Keine Tokenzahl, keine Kosten.
                volume = new { today = tag.Bytes, todayIn = tag.BytesIn, todayOut = tag.BytesOut, month = c.Teams.Month(zahler, heute.ToString("yyyy-MM")) },
            });
        }));

        // Die eine Frage — mit dem Schlüssel des zahlenden Teams, gezählt bei ihm
        api.MapPost("/ai/ask", async (AskBody body, HttpRequest req, Catalog c, CancellationToken ct) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (Blank(body.User) is not { } frage) return Bad("user fehlt.");
            var (fehler, team, zahler, provider, key) = c.With((_, _, _) =>
            {
                var mein = TeamApi.TeamOf(c, req.HttpContext.Items["user"] as string);
                if (mein is null || c.Teams.Get(mein) is not { Enabled: true } t) return (Bad("Kein Team — ohne Team gibt es keine KI über den Server."), "", "", "", "");
                var zahlerKey = c.Teams.Payer(mein); var zt = c.Teams.Get(zahlerKey)!;
                if (!zt.Enabled) return (Bad($"Das zahlende Team „{zt.Label}“ ist abgeschaltet."), "", "", "", "");
                var keys = Secrets.Get(jobsDir, TeamApi.SecretKey(zahlerKey));
                var p = Blank(body.Provider) is { } want && keys.ContainsKey(want) ? want : keys.Keys.OrderBy(x => x).FirstOrDefault();
                if (p is null) return (Bad($"Für „{zt.Label}“ ist kein KI-Schlüssel hinterlegt."), "", "", "", "");
                return ((IResult?)null, mein, zahlerKey, p, keys[p]);
            });
            if (fehler is not null) return fehler;

            var amTeam = c.With((_, _, _) => c.Teams.Get(zahler)?.Models.GetValueOrDefault(provider));
            var model = Blank(amTeam) ?? Blank(body.Model) ?? (provider == "anthropic" ? "claude-sonnet-5" : "gpt-5");
            try
            {
                var (text, sources, hin, zurueck) = await Call(provider, key, model, Blank(body.System), frage, Math.Clamp(body.MaxTokens ?? 2000, 1, 64000), body.Web == true, Math.Clamp(body.MaxSearches ?? 5, 1, 20), ct);
                var heute = DateOnly.FromDateTime(DateTime.Today);
                var anlass = Blank(body.Purpose);
                c.With((_, _, write) => write(actor, Teams.UsageStream + zahler, Types.AiUsed,
                    new AiUsed(provider, model, actor, 0, 0, 1, heute.ToString("yyyy-MM-dd"), team == zahler ? null : team, hin, zurueck, anlass), null));
                return Results.Ok(new { text, sources, team, payer = zahler, provider, model });
            }
            catch (Exception e) { return Bad(e.Message); }
        });
    }
}
