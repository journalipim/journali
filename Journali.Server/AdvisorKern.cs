using System.Diagnostics;
using System.Text.Json;

namespace Journali.Server;

/// <summary>
/// Der Kern des Beraters als Kindprozess (docs/pflegestruktur.md 44, 09.10.2026): <c>node plugins/advisor/kern/prozess.mjs</c>, ein Prozess für alle
/// Berater, gestartet beim ersten Bedarf, nach einem Absturz beim nächsten neu (Muster <see cref="Embedder"/>). Er dient der Vorschau unter
/// ⇪ Produktberatung: dieselbe Abwägung wie im Dienst an der Website, mit Gedächtnis je Gespräch. Der Prozess fragt journali über /api — mit einem
/// Token je Berater, das nur im Arbeitsspeicher liegt (<see cref="Auth.AdvisorProzessToken"/>); die Abwägung läuft nie im Serverprozess.
/// </summary>
public sealed class AdvisorKern : IDisposable
{
    private readonly string _dir;
    private readonly ILogger _log;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private Process? _p;
    private long _id;

    public AdvisorKern(string pluginDir, ILogger log) { _dir = Path.Combine(pluginDir, AdvisorApi.Plugin, "kern"); _log = log; }

    public bool Available => File.Exists(Path.Combine(_dir, "prozess.mjs"));

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /// <summary>Eine Eingabe an den Kern; die Antwort ist die, die auch das Chat-Fenster bekommt. Wirft mit Status, wenn der Kern nicht antwortet.</summary>
    public async Task<JsonElement> FrageAsync(string berater, string journali, string token, JsonElement eingabe, CancellationToken ct)
    {
        if (!Available) throw new KernFehler(400, "Plugin advisor ohne Kern.");
        await _gate.WaitAsync(ct);
        try
        {
            string? line;
            var id = ++_id;
            try
            {
                var p = Start();
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeout.CancelAfter(TimeSpan.FromSeconds(120));   // mit KI dauert eine Antwort Sekunden
                await p.StandardInput.WriteLineAsync(JsonSerializer.Serialize(new { id, journali, token, berater, eingabe }, Web).AsMemory(), timeout.Token);
                await p.StandardInput.FlushAsync(timeout.Token);
                line = await p.StandardOutput.ReadLineAsync(timeout.Token);
            }
            catch (Exception e)
            {
                _log.LogWarning("advisor: {Message} — stopping the child process", e.Message);
                Stop();
                throw new KernFehler(502, "Der Kern des Beraters antwortet nicht: " + e.Message);
            }
            if (string.IsNullOrWhiteSpace(line)) { Stop(); throw new KernFehler(502, "Der Kern des Beraters antwortet nicht."); }
            using var doc = JsonDocument.Parse(line);
            var r = doc.RootElement;
            if (r.TryGetProperty("error", out var err) && err.ValueKind == JsonValueKind.String)
                throw new KernFehler(r.TryGetProperty("status", out var s) && s.TryGetInt32(out var st) && st is >= 400 and < 600 ? st : 500, err.GetString()!);
            return r.GetProperty("antwort").Clone();
        }
        finally { _gate.Release(); }
    }

    public sealed class KernFehler(int status, string message) : Exception(message) { public int Status { get; } = status; }

    private Process Start()
    {
        if (_p is { HasExited: false }) return _p;
        Stop();
        var psi = new ProcessStartInfo("node", "prozess.mjs")
        {
            WorkingDirectory = _dir, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false,
            // node spricht UTF-8; ohne Angabe liest Windows mit der Codepage der Konsole („Zu ÔÇ×…“ statt „Zu „…“)
            StandardInputEncoding = new System.Text.UTF8Encoding(false), StandardOutputEncoding = System.Text.Encoding.UTF8, StandardErrorEncoding = System.Text.Encoding.UTF8,
        };
        var p = Process.Start(psi) ?? throw new KernFehler(502, "Der Kern des Beraters startet nicht.");
        p.ErrorDataReceived += (_, e) => { if (!string.IsNullOrWhiteSpace(e.Data)) _log.LogInformation("advisor: {Line}", e.Data); };
        p.BeginErrorReadLine();
        _p = p;
        return p;
    }

    private void Stop()
    {
        try { if (_p is { HasExited: false }) _p.Kill(true); } catch { /* schon weg */ }
        _p?.Dispose(); _p = null;
    }

    public void Dispose() { Stop(); _gate.Dispose(); }
}
