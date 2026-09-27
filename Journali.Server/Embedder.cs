using System.Diagnostics;
using System.Text.Json;

namespace Journali.Server;

/// <summary>
/// Der Einbetter für Anfragen (27.09.2026, pflegestruktur 35): eine Suchfrage muss in denselben Raum wie die
/// Abschnitte, und das Modell läuft nicht im Server — es gehört dem Plugin <c>embed</c>. Der Server hält darum
/// <b>einen</b> Kindprozess <c>node plugins/embed/serve.mjs</c> vor, der das Modell einmal lädt und danach je Zeile
/// eine Frage nimmt und einen Vektor gibt (JSON je Zeile, stdin → stdout). Er startet beim ersten Bedarf, lebt, bis
/// der Server endet, und wird nach einem Absturz beim nächsten Bedarf neu gestartet. Der Stapel der Dokumente und
/// Knoten läuft nicht hier, sondern als Job des Tasker (<c>job.mjs</c>) — anhalten, fortsetzen, sehen.
/// <para>Ohne das Plugin (kein <c>serve.mjs</c>, keine Pakete) ist <see cref="Available"/> falsch; die Wortsuche
/// läuft dann weiter, und die Oberfläche sagt, was fehlt.</para>
/// </summary>
public sealed class Embedder : IDisposable
{
    public const string PluginKey = "embed";
    public const string DefaultModelName = "Xenova/multilingual-e5-small";
    private readonly string _dir;
    private readonly ILogger _log;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private Process? _p;
    private bool _warm;

    public Embedder(string pluginDir, ILogger log) { _dir = Path.Combine(pluginDir, PluginKey); _log = log; }

    /// <summary>Das Modell, das der Kindprozess laden soll — die Umgebung zuerst, sonst der feste Name des Plugins.</summary>
    public string Model => Environment.GetEnvironmentVariable("JOURNALI_EMBED_MODEL") is { Length: > 0 } m ? m : DefaultModelName;
    public bool Available => File.Exists(Path.Combine(_dir, "serve.mjs")) && Directory.Exists(Path.Combine(_dir, "node_modules"));
    public string? Reason => !File.Exists(Path.Combine(_dir, "serve.mjs")) ? "Plugin embed fehlt."
        : !Directory.Exists(Path.Combine(_dir, "node_modules")) ? "Plugin embed ohne Pakete (npm install im Plugin-Verzeichnis)." : null;

    /// <summary>Eine Antwort des Kindprozesses: Modell, Dimension und Vektor — oder ein Fehler.</summary>
    public sealed record Reply(string? Model, int? Dims, float[]? Vector, string? Error);
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
    public static Reply? Parse(string? line) => string.IsNullOrWhiteSpace(line) ? null : JsonSerializer.Deserialize<Reply>(line, Web);

    /// <summary>Was an den Kindprozess geht: der Text und seine Art — <c>query</c> (eine Frage) oder <c>passage</c> (ein Abschnitt).</summary>
    public static string Request(string text, string kind) => JsonSerializer.Serialize(new { text, kind }, Web);

    /// <summary>Eine Frage einbetten. Wirft, wenn das Plugin fehlt oder der Prozess nicht antwortet.</summary>
    public async Task<(string Model, float[] Vector)> EmbedAsync(string text, string kind = "query", CancellationToken ct = default)
    {
        if (!Available) throw new InvalidOperationException(Reason ?? "Plugin embed fehlt.");
        await _gate.WaitAsync(ct);
        try
        {
            string? line;
            try
            {
                var p = Start();
                // Der erste Aufruf lädt das Modell (beim allerersten Mal holt er es auch): dafür Zeit, danach nicht mehr.
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeout.CancelAfter(TimeSpan.FromSeconds(_warm ? 30 : 300));
                await p.StandardInput.WriteLineAsync(Request(text, kind).AsMemory(), timeout.Token);
                await p.StandardInput.FlushAsync(timeout.Token);
                line = await p.StandardOutput.ReadLineAsync(timeout.Token);
            }
            catch (Exception e)
            {
                // Prozess weg, keine Antwort in der Zeit: beenden und beim nächsten Bedarf neu starten
                _log.LogWarning("embed: {Message} — der Kindprozess wird beendet", e.Message);
                Stop();
                throw new InvalidOperationException("Der Einbetter antwortet nicht: " + e.Message);
            }
            var reply = Parse(line);
            if (reply is null) { Stop(); throw new InvalidOperationException("Der Einbetter antwortet nicht."); }
            if (reply.Error is { } err) throw new InvalidOperationException(err);   // ein Fehler zu diesem Text — der Prozess lebt weiter
            if (reply.Vector is not { Length: > 0 }) throw new InvalidOperationException("Der Einbetter liefert keinen Vektor.");
            _warm = true;
            return (reply.Model ?? Model, reply.Vector);
        }
        finally { _gate.Release(); }
    }

    private Process Start()
    {
        if (_p is { HasExited: false }) return _p;
        Stop();
        var psi = new ProcessStartInfo("node", "serve.mjs")
        {
            WorkingDirectory = _dir, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false,
        };
        psi.Environment["JOURNALI_EMBED_MODEL"] = Model;
        var p = Process.Start(psi) ?? throw new InvalidOperationException("Der Einbetter startet nicht.");
        p.ErrorDataReceived += (_, e) => { if (!string.IsNullOrWhiteSpace(e.Data)) _log.LogInformation("embed: {Line}", e.Data); };
        p.BeginErrorReadLine();
        _p = p; _warm = false;
        return p;
    }

    private void Stop()
    {
        try { if (_p is { HasExited: false }) _p.Kill(true); } catch { /* schon weg */ }
        _p?.Dispose(); _p = null; _warm = false;
    }

    public void Dispose() { Stop(); _gate.Dispose(); }
}
