using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Journali.Server;

/// <summary>
/// Fremde Quellen des Produktberaters (19.10.2026, docs/pflegestruktur.md 43, docs/todo-berater-mcp.md): MCP-Server, eingerichtet als Zugang der
/// Art <c>mcp</c>; am Berater steht, welche Werkzeuge welcher Zugänge er nutzen darf (<see cref="AdvisorApi.Definition.Quellen"/>). Daraus werden
/// die Werkzeuge der KI — gerufen von journali, nie vom Dienst an der Website; das Geheimnis bleibt beim Server. Jeder Aufruf steht im Log des
/// Servers (Berater, Zugang, Werkzeug, Dauer, ob er ging), ohne Inhalt.
/// </summary>
public static partial class AdvisorQuellen
{
    /// <summary>Die Werkzeuglisten je Zugang, zehn Minuten lang — sie ändern sich selten, und jede Frage fragte sonst den fremden Server.</summary>
    private static readonly ConcurrentDictionary<string, (DateTime Zeit, List<McpClient.Werkzeug> Liste)> Vorrat = new();
    public static TimeSpan Gueltig { get; set; } = TimeSpan.FromMinutes(10);
    public static void VorratLeeren() => Vorrat.Clear();

    /// <summary>Der Name eines Werkzeugs für die KI: Zugang und Werkzeug, nur Buchstaben, Ziffern, _ und -, höchstens 64 Zeichen.</summary>
    public static string Name(string zugang, string werkzeug)
    {
        var n = Unerlaubt().Replace($"{zugang}__{werkzeug}", "_");
        return n.Length <= 64 ? n : n[..64];
    }
    [GeneratedRegex("[^a-zA-Z0-9_-]")] private static partial Regex Unerlaubt();

    /// <summary>Die Werkzeuge, die die KI dieses Beraters nutzen darf — fehlt ein Zugang oder antwortet sein Server nicht, fehlen seine.</summary>
    public static async Task<List<AiApi.KiWerkzeug>> WerkzeugeAsync(Catalog c, AdvisorApi.Definition d, string berater, string jobsDir, CancellationToken ct)
    {
        var aus = new List<AiApi.KiWerkzeug>();
        if (d.Quellen is not { Count: > 0 } quellen) return aus;
        var zugaenge = DriverApi.Alle(c);
        foreach (var q in quellen)
        {
            if (zugaenge.FirstOrDefault(z => z.Key == q.Zugang && z.Art == "mcp") is not { } z || q.Werkzeuge is not { Length: > 0 } erlaubt) continue;
            var url = z.Felder.GetValueOrDefault("url") ?? "";
            var anmeldung = DriverApi.McpAnmeldung(z, jobsDir);
            List<McpClient.Werkzeug> liste;
            try { liste = await ListeAsync(z.Key, url, anmeldung, ct); }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or McpClient.McpException or InvalidOperationException or UriFormatException)
            {
                Console.WriteLine($"journali: advisor {berater} mcp {z.Key} tools/list: {e.Message}");
                continue;
            }
            foreach (var w in liste.Where(w => erlaubt.Contains(w.Name)))
            {
                var werkzeug = w.Name;
                aus.Add(new AiApi.KiWerkzeug(Name(z.Key, werkzeug), $"{w.Beschreibung ?? werkzeug} (Quelle: {z.Label})", w.Schema, async (argumente, t) =>
                {
                    var uhr = Stopwatch.StartNew();
                    try
                    {
                        var r = await McpClient.AufrufAsync(url, anmeldung, werkzeug, argumente, t);
                        Console.WriteLine($"journali: advisor {berater} mcp {z.Key}/{werkzeug} {uhr.ElapsedMilliseconds} ms {(r.Fehler ? "error" : "ok")}");
                        return r;
                    }
                    catch (Exception e) when (e is HttpRequestException or TaskCanceledException or McpClient.McpException or InvalidOperationException)
                    {
                        Console.WriteLine($"journali: advisor {berater} mcp {z.Key}/{werkzeug} {uhr.ElapsedMilliseconds} ms failed: {e.Message}");
                        return ("Die Quelle antwortet nicht.", true);
                    }
                }));
            }
        }
        return aus;
    }

    private static async Task<List<McpClient.Werkzeug>> ListeAsync(string zugang, string url, McpClient.Anmeldung anmeldung, CancellationToken ct)
    {
        if (Vorrat.TryGetValue(zugang + "|" + url, out var v) && DateTime.UtcNow - v.Zeit < Gueltig) return v.Liste;
        var liste = await McpClient.WerkzeugeAsync(url, anmeldung, ct);
        Vorrat[zugang + "|" + url] = (DateTime.UtcNow, liste);
        return liste;
    }
}
