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
    public List<JobRun> Runs { get; } = new();               // jüngste zuerst, höchstens 200
    public JobRun? Running => Runs.FirstOrDefault(r => r.Status is null);
    public JobRun? Last => Runs.FirstOrDefault(r => r.Status is not null);
    public long LastNumber { get; set; }
    public DateTimeOffset LastAt { get; set; }
}

/// <summary>
/// Abbild „die Jobs“ (Taloan, 19.09.2026, Plugin tasker): Strom <c>job:&lt;key&gt;</c>. Was ein Job ist, wann er läuft
/// und wie jeder Lauf ausging, steht im Journal — nachvollziehbar wie alles andere. Die Ausgabe eines Laufs (das Log)
/// liegt als Datei neben dem Programm (JOURNALI_JOBS), im Journal nur ihre Grösse; Geheimnisse (Token) nie im Journal.
/// </summary>
public sealed class Jobs : IProjection
{
    private readonly Dictionary<string, JobState> _all = new();
    public long LastApplied { get; private set; }
    public IReadOnlyDictionary<string, JobState> All => _all;
    public const string Stream = "job:";

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
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
