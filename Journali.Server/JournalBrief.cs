using System.Text.Json;

namespace Journali.Server;

/// <summary>
/// Die Nutzlast eines Eintrags für die Journal-Ansicht (04.10.2026): Plugin-Daten sind bis 4 MB je Eintrag, die Ansicht braucht nur, was sie beschreibt.
/// Ist die Nutzlast länger als <c>max</c>, bleiben ihre kurzen Felder (Zeichenketten bis 200 Zeichen, Zahlen, Wahrheitswerte), dazu <c>truncated</c> und <c>bytes</c>.
/// </summary>
public static class JournalBrief
{
    public static JsonElement Payload(string json, int? max)
    {
        var payload = JsonDocument.Parse(json).RootElement.Clone();
        if (max is not { } m || json.Length <= m) return payload;
        var kurz = new Dictionary<string, object?> { ["truncated"] = true, ["bytes"] = json.Length };
        if (payload.ValueKind == JsonValueKind.Object)
            foreach (var p in payload.EnumerateObject())
                if (p.Value.ValueKind is JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False
                    || (p.Value.ValueKind == JsonValueKind.String && p.Value.GetString()!.Length <= 200)) kurz[p.Name] = p.Value;
        return JsonSerializer.SerializeToElement(kurz);
    }
}
