using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Journali.Server;

/// <summary>
/// Ein MCP-Client (19.10.2026, docs/pflegestruktur.md 43, docs/todo-berater-mcp.md): journali fragt einen fremden MCP-Server — Streamable HTTP,
/// JSON-RPC über POST, die Antwort als JSON oder als Ereignisstrom (<c>text/event-stream</c>). Ohne Paket: das Protokoll ist klein. Jede Abfrage
/// beginnt mit <c>initialize</c> und <c>notifications/initialized</c> (die Sitzung über <c>Mcp-Session-Id</c>, wenn der Server eine vergibt);
/// danach <c>tools/list</c> oder <c>tools/call</c>. Die Anmeldung kommt aus dem Zugang (Bearer oder eigener Kopf), das Geheimnis verlässt den
/// Server nie.
/// </summary>
public static class McpClient
{
    public const string ProtokollVersion = "2025-06-18";
    /// <summary>So lange darf ein Aufruf dauern — ein langsamer fremder Server hält die Antwort an den Besucher nicht länger auf.</summary>
    public static TimeSpan Zeitgrenze { get; set; } = TimeSpan.FromSeconds(15);
    /// <summary>Für Tests: der Weg zum Server (sonst ein gewöhnlicher HttpClient).</summary>
    public static HttpMessageHandler? Handler { get; set; }

    /// <summary>Ein Werkzeug, wie der Server es beschreibt.</summary>
    public sealed record Werkzeug(string Name, string? Beschreibung, JsonElement Schema);

    /// <summary>Wie journali sich anmeldet: Authorization (Bearer) und/oder ein eigener Kopf.</summary>
    public sealed record Anmeldung(AuthenticationHeaderValue? Authorization, (string Name, string Wert)? Kopf);

    public sealed class McpException(string meldung) : Exception(meldung);

    /// <summary>Die Werkzeuge des Servers (alle Seiten, höchstens zehn).</summary>
    public static async Task<List<Werkzeug>> WerkzeugeAsync(string url, Anmeldung anmeldung, CancellationToken ct)
    {
        using var http = Neu();
        var sitzung = await AnfangAsync(http, url, anmeldung, ct);
        var aus = new List<Werkzeug>();
        string? weiter = null;
        for (var seite = 0; seite < 10; seite++)
        {
            var antwort = await RufeAsync(http, url, anmeldung, sitzung, "tools/list", weiter is null ? new JsonObject() : new JsonObject { ["cursor"] = weiter }, ct);
            if (antwort.TryGetProperty("tools", out var tools) && tools.ValueKind == JsonValueKind.Array)
                foreach (var t in tools.EnumerateArray())
                    if (t.TryGetProperty("name", out var n) && n.GetString() is { Length: > 0 } name)
                        aus.Add(new Werkzeug(name, t.TryGetProperty("description", out var d) ? d.GetString() : null,
                            t.TryGetProperty("inputSchema", out var s) ? s.Clone() : JsonDocument.Parse("{\"type\":\"object\"}").RootElement.Clone()));
            weiter = antwort.TryGetProperty("nextCursor", out var c) && c.ValueKind == JsonValueKind.String ? c.GetString() : null;
            if (weiter is null) break;
        }
        return aus;
    }

    /// <summary>Ein Werkzeug aufrufen. Liefert den Text des Ergebnisses (die Textteile, sonst das strukturierte Ergebnis als JSON) und ob der
    /// Server einen Fehler meldet.</summary>
    public static async Task<(string Text, bool Fehler)> AufrufAsync(string url, Anmeldung anmeldung, string werkzeug, JsonElement argumente, CancellationToken ct)
    {
        using var http = Neu();
        var sitzung = await AnfangAsync(http, url, anmeldung, ct);
        var antwort = await RufeAsync(http, url, anmeldung, sitzung, "tools/call",
            new JsonObject { ["name"] = werkzeug, ["arguments"] = argumente.ValueKind == JsonValueKind.Object ? JsonNode.Parse(argumente.GetRawText()) : new JsonObject() }, ct);
        var fehler = antwort.TryGetProperty("isError", out var e) && e.ValueKind == JsonValueKind.True;
        var text = new StringBuilder();
        if (antwort.TryGetProperty("content", out var inhalt) && inhalt.ValueKind == JsonValueKind.Array)
            foreach (var teil in inhalt.EnumerateArray())
            {
                var art = teil.TryGetProperty("type", out var a) ? a.GetString() : null;
                if (art == "text" && teil.TryGetProperty("text", out var tx)) text.AppendLine(tx.GetString());
                else if (art == "resource" && teil.TryGetProperty("resource", out var r) && r.TryGetProperty("text", out var rt)) text.AppendLine(rt.GetString());
            }
        if (text.Length == 0 && antwort.TryGetProperty("structuredContent", out var sc)) text.Append(sc.GetRawText());
        return (text.ToString().Trim(), fehler);
    }

    private static HttpClient Neu() => Handler is { } h ? new HttpClient(h, disposeHandler: false) { Timeout = Zeitgrenze } : new HttpClient { Timeout = Zeitgrenze };

    /// <summary><c>initialize</c> und <c>notifications/initialized</c> — liefert die Kennung der Sitzung, wenn der Server eine vergibt.</summary>
    private static async Task<string?> AnfangAsync(HttpClient http, string url, Anmeldung anmeldung, CancellationToken ct)
    {
        var (antwort, sitzung) = await SendeAsync(http, url, anmeldung, null, Anfrage(1, "initialize", new JsonObject
        {
            ["protocolVersion"] = ProtokollVersion, ["capabilities"] = new JsonObject(),
            ["clientInfo"] = new JsonObject { ["name"] = "journali", ["version"] = "1" },
        }), 1, ct);
        if (antwort is null) throw new McpException("Der MCP-Server antwortet nicht auf initialize.");
        await SendeAsync(http, url, anmeldung, sitzung, new JsonObject { ["jsonrpc"] = "2.0", ["method"] = "notifications/initialized" }, null, ct);
        return sitzung;
    }

    private static async Task<JsonElement> RufeAsync(HttpClient http, string url, Anmeldung anmeldung, string? sitzung, string methode, JsonObject parameter, CancellationToken ct)
    {
        var (antwort, _) = await SendeAsync(http, url, anmeldung, sitzung, Anfrage(2, methode, parameter), 2, ct);
        if (antwort is not { } a) throw new McpException($"Der MCP-Server antwortet nicht auf {methode}.");
        if (a.TryGetProperty("error", out var f))
            throw new McpException(f.TryGetProperty("message", out var m) ? m.GetString() ?? methode : methode);
        return a.TryGetProperty("result", out var r) ? r : default;
    }

    private static JsonObject Anfrage(int id, string methode, JsonObject parameter) =>
        new() { ["jsonrpc"] = "2.0", ["id"] = id, ["method"] = methode, ["params"] = parameter };

    /// <summary>Ein POST; mit <paramref name="id"/> die Antwort dazu — aus JSON oder aus dem Ereignisstrom —, ohne (eine Benachrichtigung) nichts.</summary>
    private static async Task<(JsonElement? Antwort, string? Sitzung)> SendeAsync(HttpClient http, string url, Anmeldung anmeldung, string? sitzung, JsonObject nachricht, int? id, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, url) { Content = new StringContent(nachricht.ToJsonString(), Encoding.UTF8, "application/json") };
        req.Headers.Accept.ParseAdd("application/json");
        req.Headers.Accept.ParseAdd("text/event-stream");
        if (anmeldung.Authorization is { } auth) req.Headers.Authorization = auth;
        if (anmeldung.Kopf is { } kopf) req.Headers.TryAddWithoutValidation(kopf.Name, kopf.Wert);
        if (sitzung is not null) req.Headers.TryAddWithoutValidation("Mcp-Session-Id", sitzung);
        if (nachricht["method"]?.GetValue<string>() != "initialize") req.Headers.TryAddWithoutValidation("MCP-Protocol-Version", ProtokollVersion);
        using var res = await http.SendAsync(req, ct);
        var neueSitzung = res.Headers.TryGetValues("Mcp-Session-Id", out var s) ? s.FirstOrDefault() : sitzung;
        if (id is null) return (null, neueSitzung);
        if (!res.IsSuccessStatusCode) throw new McpException($"Der MCP-Server antwortet mit {(int)res.StatusCode}.");
        var text = await res.Content.ReadAsStringAsync(ct);
        var typ = res.Content.Headers.ContentType?.MediaType ?? "";
        foreach (var json in typ == "text/event-stream" ? Ereignisse(text) : [text])
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                var r = doc.RootElement;
                if (r.ValueKind == JsonValueKind.Object && r.TryGetProperty("id", out var rid) && rid.ValueKind == JsonValueKind.Number && rid.GetInt32() == id)
                    return (r.Clone(), neueSitzung);
            }
            catch (JsonException) { /* kein JSON-RPC: weiter */ }
        }
        return (null, neueSitzung);
    }

    /// <summary>Die Daten der Ereignisse eines Stroms: je Ereignis die <c>data:</c>-Zeilen zusammen.</summary>
    public static IEnumerable<string> Ereignisse(string strom)
    {
        var daten = new StringBuilder();
        foreach (var zeile in strom.Replace("\r\n", "\n").Split('\n'))
        {
            if (zeile.Length == 0) { if (daten.Length > 0) { yield return daten.ToString(); daten.Clear(); } continue; }
            if (zeile.StartsWith("data:", StringComparison.Ordinal)) { if (daten.Length > 0) daten.Append('\n'); daten.Append(zeile[5..].TrimStart()); }
        }
        if (daten.Length > 0) yield return daten.ToString();
    }
}
