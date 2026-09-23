using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>Ein Team: Bezeichnung, Grenzen, an/aus. Die API-Schlüssel stehen nie hier — sie liegen im Datenverzeichnis
/// (<c>jobs/secrets.json</c> unter <c>team:&lt;key&gt;</c>), wie Mailpasswort und Job-Token.</summary>
public sealed class TeamState
{
    public required string Key { get; init; }
    public string Label { get; set; } = "";
    public string? Note { get; set; }
    /// <summary>Warnschwelle je Monat in Token (0 = keine). Sie sperrt nicht — sie zeigt und warnt.</summary>
    public long MonthlyTokens { get; set; }
    /// <summary>Das Grundrauschen je Monat (Taloan, 23.09.2026: „Team 1 hat Grundrauschen, jedes neue Team hat keins —
    /// wer Teams braucht, hat eindeutig Business-Interesse“): Inklusivtoken ohne eigenen Schlüssel. Nur das erste Team
    /// darf es haben, sonst wäre ein neues Team ein neuer Freibetrag. Aufgebraucht heisst hier wirklich Schluss.</summary>
    public long IncludedTokens { get; set; }
    /// <summary>Reissleine je Tag in Token (0 = keine): hier wird abgewiesen. Hoch ansetzen — sie soll den Amoklauf stoppen, nicht die Arbeit.</summary>
    public long DailyTokens { get; set; }
    public bool Enabled { get; set; } = true;
    /// <summary>Benutzt die Schlüssel dieses Teams mit (null = eigene). Wer keine eigenen hat, hat auch kein eigenes Kontingent.</summary>
    public string? KeysFrom { get; set; }
    /// <summary>Wer dieses Team führt (Taloan, 23.09.2026): trägt Mitglieder ein und aus, pflegt Schlüssel und Grenzen.
    /// Ein Team ohne Manager gibt es nicht — der Administrator benennt beim Anlegen mindestens einen.</summary>
    public string[] Managers { get; set; } = [];
    /// <summary>Welches Modell je Anbieter gefragt wird — das bestimmt Kosten und Güte, also gehört es zum Team.</summary>
    public Dictionary<string, string> Models { get; } = new();
    /// <summary>Limits, die der Administrator aus der Lizenz verteilt: Einträge je Woche und Monat (0 = keine Zuteilung).</summary>
    public int EntriesWeek { get; set; }
    public int EntriesMonth { get; set; }
    /// <summary>Nummer des Eintrags, der das Team zuerst angelegt hat — daran hängt, wer „Team 1“ ist.</summary>
    public long CreatedNumber { get; set; }
    public long LastNumber { get; set; }
    public DateTimeOffset LastAt { get; set; }
    public string LastActor { get; set; } = "";
}

/// <summary>Verbrauch eines Tages: Aufrufe und Token, aufgeschlüsselt nach Anbieter und Person.</summary>
public sealed class UsageDay
{
    public long Calls { get; set; }
    public long In { get; set; }
    public long Out { get; set; }
    public Dictionary<string, long> ByProvider { get; } = new();
    public Dictionary<string, long> ByUser { get; } = new();
    public long Tokens => In + Out;
}

/// <summary>
/// Abbild „Teams“ (Taloan, 23.09.2026: „dann richten wir die neue Ebene Teams ein → je Team gibt es Limits und API-Keys,
/// Benutzer gehören einem Team an“). Strom <c>team:&lt;key&gt;</c>. Hier steht auch der KI-Verbrauch je Team und Tag
/// (<see cref="AiUsed"/>, Strom <c>ai-usage:&lt;team&gt;</c>): wer zahlt, ist damit eine Frage der Buchung — nicht der Sperre.
/// </summary>
public sealed class Teams : IProjection
{
    public const string Stream = "team:";
    public const string UsageStream = "ai-usage:";
    private readonly Dictionary<string, TeamState> _all = new();
    private readonly Dictionary<string, Dictionary<string, UsageDay>> _usage = new();   // Team → Tag (yyyy-MM-dd) → Verbrauch
    public long LastApplied { get; private set; }
    public IReadOnlyDictionary<string, TeamState> All => _all;
    public TeamState? Get(string key) => _all.GetValueOrDefault(key);
    /// <summary>Team 1: das zuerst angelegte. Nur dort gibt es das Grundrauschen, und dorthin fällt, wer kein Team hat.</summary>
    public TeamState? Primary => _all.Values.OrderBy(t => t.CreatedNumber).FirstOrDefault();

    /// <summary>Wer zahlt: das Team selbst, oder das, dessen Schlüssel es mitbenutzt (eine Stufe, kein Kettenschluss).
    /// Darum bringt ein zweites Team ohne eigenen Schlüssel kein zweites Kontingent — beide hängen am selben Zahler.</summary>
    public string Payer(string team) => _all.GetValueOrDefault(team)?.KeysFrom is { Length: > 0 } f && _all.ContainsKey(f) ? f : team;
    /// <summary>Die Teams, die an diesem Zahler hängen (er selbst eingeschlossen).</summary>
    public IEnumerable<string> Dependents(string payer) => _all.Keys.Where(k => Payer(k) == payer);

    /// <summary>Führt diese Person das Team? (Der Administrator darf ohnehin alles — das prüft der Server.)</summary>
    public bool Leads(string team, string? user) => user is { Length: > 0 } u && _all.GetValueOrDefault(team)?.Managers.Contains(u) == true;
    /// <summary>Die Teams, die diese Person führt.</summary>
    public IEnumerable<TeamState> Led(string? user) => user is { Length: > 0 } u ? _all.Values.Where(t => t.Managers.Contains(u)) : [];

    /// <summary>Verbrauch eines Tages (leer = nichts verbraucht).</summary>
    public UsageDay Day(string team, DateOnly day) => _usage.TryGetValue(team, out var d) && d.TryGetValue(day.ToString("yyyy-MM-dd"), out var u) ? u : new UsageDay();
    /// <summary>Alle Tage eines Teams, neueste zuerst.</summary>
    public IEnumerable<(string Day, UsageDay Usage)> Days(string team) =>
        _usage.TryGetValue(team, out var d) ? d.OrderByDescending(kv => kv.Key).Select(kv => (kv.Key, kv.Value)) : [];
    /// <summary>Summe eines Monats („2026-09“) in Token.</summary>
    public long Month(string team, string yyyyMM) => Days(team).Where(x => x.Day.StartsWith(yyyyMM, StringComparison.Ordinal)).Sum(x => x.Usage.Tokens);

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        if (entry.Stream.StartsWith(UsageStream, StringComparison.Ordinal))
        {
            if (entry.Type != Types.AiUsed) return;
            var team = entry.Stream[UsageStream.Length..];
            var d = Types.Deserialize<AiUsed>(entry.Payload);
            var day = (d.Day is { Length: 10 } s ? s : entry.At.ToString("yyyy-MM-dd"));
            if (!_usage.TryGetValue(team, out var byDay)) _usage[team] = byDay = new();
            if (!byDay.TryGetValue(day, out var u)) byDay[day] = u = new UsageDay();
            u.Calls += Math.Max(1, d.Calls); u.In += d.In; u.Out += d.Out;
            var t = d.In + d.Out;
            if (!string.IsNullOrEmpty(d.Provider)) u.ByProvider[d.Provider] = u.ByProvider.GetValueOrDefault(d.Provider) + t;
            var who = string.IsNullOrEmpty(d.User) ? entry.Actor : d.User;
            if (!string.IsNullOrEmpty(who)) u.ByUser[who] = u.ByUser.GetValueOrDefault(who) + t;
            return;
        }
        if (!entry.Stream.StartsWith(Stream, StringComparison.Ordinal)) return;
        var key = entry.Stream[Stream.Length..];
        switch (entry.Type)
        {
            case Types.TeamDefined:
            {
                var d = Types.Deserialize<TeamDefined>(entry.Payload);
                if (!_all.TryGetValue(key, out var t)) _all[key] = t = new TeamState { Key = key, CreatedNumber = entry.Number };
                t.Label = d.Label; t.Note = d.Note; t.MonthlyTokens = d.MonthlyTokens; t.DailyTokens = d.DailyTokens; t.Enabled = d.Enabled; t.KeysFrom = d.KeysFrom; t.IncludedTokens = d.IncludedTokens; t.Managers = d.Managers ?? []; t.EntriesWeek = d.EntriesWeek; t.EntriesMonth = d.EntriesMonth;
                t.Models.Clear(); foreach (var (a, m) in d.Models ?? new()) t.Models[a] = m;
                t.LastNumber = entry.Number; t.LastAt = entry.At; t.LastActor = entry.Actor;
                break;
            }
            case Types.TeamRetired:
                _all.Remove(key);   // der Verbrauch bleibt stehen — er ist eine Tatsache, kein Stammdatum
                break;
        }
    }
}
