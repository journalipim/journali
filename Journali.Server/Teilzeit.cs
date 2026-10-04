using System.Diagnostics;

namespace Journali.Server;

/// <summary>
/// Teilzeiten einer Anfrage: wohin die Zeit ging (Wartezeit auf die Lesesperre, Abfragen an die Datenbank, Rechnen im Speicher).
/// Die Zeile „slow:“ in der Konsole hängt sie an, wenn eine Anfrage 300 ms überschreitet. Ohne laufende Anfrage (Jobs, Start) wird nichts notiert.
/// </summary>
public static class Teilzeit
{
    private static readonly AsyncLocal<List<(string Name, long Ms)>?> _teile = new();
    /// <summary>Teile unter dieser Dauer werden nicht notiert — sie machen die Zeile nur länger.</summary>
    private const long Mindestens = 20;

    public static void Beginn() => _teile.Value = [];

    public static void Notiere(string name, long ms)
    {
        if (ms < Mindestens || _teile.Value is not { } liste) return;
        lock (liste) liste.Add((name, ms));
    }

    /// <summary>„ · read lock 8120 ms, stats 310 ms“ — oder leer, wenn nichts auffiel. Die Namen sind englisch wie die ganze Konsole.</summary>
    public static string Text()
    {
        if (_teile.Value is not { } liste) return "";
        lock (liste) return liste.Count == 0 ? "" : " · " + string.Join(", ", liste.Select(t => $"{t.Name} {t.Ms} ms"));
    }

    public static T Messen<T>(string name, Func<T> f)
    {
        var uhr = Stopwatch.StartNew();
        try { return f(); } finally { Notiere(name, uhr.ElapsedMilliseconds); }
    }

    public static async Task<T> MessenAsync<T>(string name, Func<Task<T>> f)
    {
        var uhr = Stopwatch.StartNew();
        try { return await f(); } finally { Notiere(name, uhr.ElapsedMilliseconds); }
    }
}
