using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>Ein Lauf eines Jobs — begonnen, und wenn fertig: wie es ausging.</summary>
public sealed class JobRun
{
    public required string Id { get; init; }
    public required string Trigger { get; init; }          // schedule | manual
    public DateTimeOffset StartedAt { get; init; }
    public DateTimeOffset? FinishedAt { get; set; }
    public string? Status { get; set; }                     // ok | failed | timeout | cancelled — null = läuft
    public int? Exit { get; set; }
    public double? Seconds { get; set; }
    public string? Summary { get; set; }
    public long LogBytes { get; set; }
    public string Actor { get; init; } = "";
}

/// <summary>Ein Job: welches Plugin (Prozess) mit welchen Parametern, wann (cron), an oder aus — und seine Läufe.</summary>
/// <summary>Ein Beleg je Datei (JobFileConsumed / JobFileWritten).</summary>
public sealed class JobFile
{
    public required string Run { get; init; }
    public required string Name { get; init; }
    public required string Hash { get; init; }
    public long Bytes { get; init; }
    public string Status { get; init; } = "ok";     // Eingang: ok | failed | duplicate; Ausgabe: ok
    public bool Latest { get; init; }
    public string? MediaId { get; init; }
    public DateTimeOffset At { get; init; }
}

public sealed class JobState
{
    public required string Key { get; init; }
    public string Label { get; set; } = "";
    public string Plugin { get; set; } = "";
    public string Service { get; set; } = "";           // Dienst im Plugin (processes[].key); leer = process
    public Dictionary<string, string> Params { get; set; } = new();
    public string? Schedule { get; set; }                    // cron „m h dom mon dow“; null = nur von Hand
    public bool Enabled { get; set; } = true;
    public int TimeoutMinutes { get; set; } = 60;
    /// <summary>Rolle des Laufs (null = editor wie bisher) — daran hängen die Rechte des Dienst-Tokens.</summary>
    public string? Role { get; set; }
    /// <summary>Wem der Job gehört: auf dessen Kontingent geht, was der Lauf schreibt (null = niemandem).</summary>
    public string? Owner { get; set; }
    public List<JobRun> Runs { get; } = new();               // jüngste zuerst, höchstens 200
    public JobFiles? Files { get; set; }                     // Fächer (docs/tasker-dateien.md); null = wie bisher, jobs/<key>
    public List<JobFile> Consumed { get; } = new();          // verarbeitete Eingänge, jüngste zuerst, höchstens 500
    public List<JobFile> Written { get; } = new();           // Ausgaben, jüngste zuerst, höchstens 500
    public HashSet<string> ConsumedHashes { get; } = new();  // alle je erfolgreich verarbeiteten Eingänge — Duplikat nach Inhalt, nicht nach Namen
    public JobRun? Running => Runs.FirstOrDefault(r => r.Status is null);
    public JobRun? Last => Runs.FirstOrDefault(r => r.Status is not null);
    public long LastNumber { get; set; }
    public DateTimeOffset LastAt { get; set; }
}

/// <summary>
/// Abbild „die Jobs“: Strom <c>job:&lt;key&gt;</c>. Was ein Job ist, wann er läuft
/// und wie jeder Lauf ausging, steht im Journal — nachvollziehbar wie alles andere. Die Ausgabe eines Laufs (das Log)
/// liegt als Datei neben dem Programm (JOURNALI_JOBS), im Journal nur ihre Grösse; Geheimnisse (Token) nie im Journal.
/// </summary>
public sealed class Jobs : IProjection
{
    private readonly Dictionary<string, JobState> _all = new();
    public long LastApplied { get; private set; }
    public IReadOnlyDictionary<string, JobState> All => _all;
    public const string Stream = "job:";

    /// <summary>Strom der Server (pflegestruktur 41): <c>server:&lt;id&gt;</c>.</summary>
    public const string ServerStream = "server:";
    private string? _main;
    private readonly HashSet<string> _blocked = new(StringComparer.Ordinal);
    /// <summary>Der festgelegte Hauptserver (null = noch keiner) — er führt die Jobs aus.</summary>
    public string? MainServer => _main;
    /// <summary>Gesperrte Server.</summary>
    public IReadOnlySet<string> BlockedServers => _blocked;
    private readonly Dictionary<string, string> _serverNames = new(StringComparer.Ordinal);
    /// <summary>Namen der Server, die einen bekommen haben.</summary>
    public IReadOnlyDictionary<string, string> ServerNames => _serverNames;

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        if (entry.Stream.StartsWith(ServerStream, StringComparison.Ordinal))
        {
            var id = entry.Stream[ServerStream.Length..];
            if (entry.Type == Types.ServerMainSet) _main = id;
            else if (entry.Type == Types.ServerNamed) { if (Types.Deserialize<ServerNamed>(entry.Payload).Name is { Length: > 0 } n) _serverNames[id] = n; else _serverNames.Remove(id); }
            else if (entry.Type == Types.ServerBlockSet) { if (Types.Deserialize<ServerBlockSet>(entry.Payload).Blocked) _blocked.Add(id); else _blocked.Remove(id); }
            return;
        }
        if (!entry.Stream.StartsWith(Stream, StringComparison.Ordinal)) return;
        var key = entry.Stream[Stream.Length..];
        switch (entry.Type)
        {
            case Types.JobDefined:
            {
                var d = Types.Deserialize<JobDefined>(entry.Payload);
                if (!_all.TryGetValue(key, out var j)) _all[key] = j = new JobState { Key = key };
                j.Label = d.Label; j.Plugin = d.Plugin; j.Service = d.Service ?? ""; j.Params = d.Params ?? new(); j.Schedule = string.IsNullOrWhiteSpace(d.Schedule) ? null : d.Schedule.Trim();
                j.Enabled = d.Enabled; j.TimeoutMinutes = d.TimeoutMinutes is > 0 ? d.TimeoutMinutes.Value : 60;
                j.Role = string.IsNullOrWhiteSpace(d.Role) ? null : d.Role.Trim();
                j.Owner = string.IsNullOrWhiteSpace(d.Owner) ? null : d.Owner.Trim();
                j.Files = d.Files;
                Touch(j, entry);
                break;
            }
            case Types.JobFileConsumed:
            {
                if (!_all.TryGetValue(key, out var j)) break;
                var f = Types.Deserialize<JobFileConsumed>(entry.Payload);
                j.Consumed.Insert(0, new JobFile { Run = f.Run, Name = f.Name, Hash = f.Hash, Bytes = f.Bytes, Status = f.Status, MediaId = f.MediaId, At = entry.At });
                if (j.Consumed.Count > 500) j.Consumed.RemoveRange(500, j.Consumed.Count - 500);
                if (f.Status == "ok") j.ConsumedHashes.Add(f.Hash);
                Touch(j, entry);
                break;
            }
            case Types.JobFileWritten:
            {
                if (!_all.TryGetValue(key, out var j)) break;
                var f = Types.Deserialize<JobFileWritten>(entry.Payload);
                j.Written.Insert(0, new JobFile { Run = f.Run, Name = f.Name, Hash = f.Hash, Bytes = f.Bytes, Latest = f.Latest, MediaId = f.MediaId, At = entry.At });
                if (j.Written.Count > 500) j.Written.RemoveRange(500, j.Written.Count - 500);
                Touch(j, entry);
                break;
            }
            case Types.JobRetired:
                _all.Remove(key);
                break;
            case Types.JobRunStarted:
            {
                if (!_all.TryGetValue(key, out var j)) break;
                var s = Types.Deserialize<JobRunStarted>(entry.Payload);
                j.Runs.Insert(0, new JobRun { Id = s.Run, Trigger = s.Trigger, StartedAt = entry.At, Actor = entry.Actor });
                if (j.Runs.Count > 200) j.Runs.RemoveRange(200, j.Runs.Count - 200);
                Touch(j, entry);
                break;
            }
            case Types.JobRunFinished:
            {
                if (!_all.TryGetValue(key, out var j)) break;
                var f = Types.Deserialize<JobRunFinished>(entry.Payload);
                var run = j.Runs.FirstOrDefault(r => r.Id == f.Run);
                if (run is null) break;
                run.FinishedAt = entry.At; run.Status = f.Status; run.Exit = f.Exit; run.Seconds = f.Seconds; run.Summary = f.Summary; run.LogBytes = f.LogBytes;
                Touch(j, entry);
                break;
            }
        }
    }

    private static void Touch(JobState j, Entry e) { j.LastNumber = e.Number; j.LastAt = e.At; }
}
