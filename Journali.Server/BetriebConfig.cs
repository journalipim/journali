using System.Text.Json;

namespace Journali.Server;

/// <summary>
/// Was der Start tut, bevor es ein Journal gibt (Taloan, 24.09.2026: „ich möchte das nicht per Umgebungsvariablen,
/// sondern in den Admin-Settings einstellen können“). Genau deshalb steht es <b>nicht</b> im Journal: Spiegel und
/// Schnappschuss entscheiden, wie das Journal überhaupt gelesen wird. Die Datei liegt als <c>betrieb.json</c> im
/// Datenverzeichnis, neben <c>media.json</c> und <c>mail.json</c>.
/// <para>Ohne Datei gilt die Umgebung (<c>JOURNALI_JOURNAL_CACHE=off</c>, <c>JOURNALI_SNAPSHOT=off</c>) und sonst
/// beides an. Eine Änderung wirkt beim nächsten Start — vorher liest niemand die Datei noch einmal.</para>
/// </summary>
public sealed record BetriebConfig(bool JournalCache = true, bool Snapshot = true);

public static class BetriebConfigFile
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    public static string PathOf(string dir) => Path.Combine(dir, "betrieb.json");

    /// <summary>Die Datei — oder null, wenn es keine gibt (dann zählt die Umgebung).</summary>
    public static BetriebConfig? Load(string dir)
    {
        var p = PathOf(dir);
        if (!File.Exists(p)) return null;
        try { return JsonSerializer.Deserialize<BetriebConfig>(File.ReadAllText(p), Json); }
        catch { return null; }   // unlesbar ist wie nicht vorhanden: der Start darf daran nicht scheitern
    }

    public static void Save(string dir, BetriebConfig c)
    {
        Directory.CreateDirectory(dir);
        File.WriteAllText(PathOf(dir), JsonSerializer.Serialize(c, Json));
    }

    /// <summary>Was jetzt gilt: die Datei, sonst die Umgebung, sonst beides an.</summary>
    public static BetriebConfig Effektiv(string dir, IConfiguration cfg)
    {
        if (Load(dir) is { } datei) return datei;
        var aus = (string? v) => string.Equals(v, "off", StringComparison.OrdinalIgnoreCase);
        return new BetriebConfig(!aus(cfg["JOURNALI_JOURNAL_CACHE"]), !aus(cfg["JOURNALI_SNAPSHOT"]));
    }
}
