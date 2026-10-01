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
    /// <summary>Das Grundrauschen je Monat: Inklusivtoken ohne eigenen Schlüssel. Nur das erste Team
    /// darf es haben, sonst wäre ein neues Team ein neuer Freibetrag. Aufgebraucht heisst hier wirklich Schluss.</summary>
    public long IncludedTokens { get; set; }
    /// <summary>Reissleine je Tag in Token (0 = keine): hier wird abgewiesen. Hoch ansetzen — sie soll den Amoklauf stoppen, nicht die Arbeit.</summary>
    public long DailyTokens { get; set; }
    public bool Enabled { get; set; } = true;
    /// <summary>Benutzt die Schlüssel dieses Teams mit (null = eigene). Wer keine eigenen hat, hat auch kein eigenes Kontingent.</summary>
    public string? KeysFrom { get; set; }
    /// <summary>Wer dieses Team führt: trägt Mitglieder ein und aus, pflegt Schlüssel und Grenzen.
    /// Ein Team ohne Manager gibt es nicht — der Administrator benennt beim Anlegen mindestens einen.</summary>
    public string[] Managers { get; set; } = [];
    /// <summary>Welches Modell je Anbieter gefragt wird — das bestimmt Kosten und Güte, also gehört es zum Team.</summary>
    public Dictionary<string, string> Models { get; } = new();
    /// <summary>Limits, die der Administrator aus der Lizenz verteilt: Einträge je Woche und Monat (0 = keine Zuteilung).</summary>
    public int EntriesWeek { get; set; }
    public int EntriesMonth { get; set; }
    /// <summary>Ab wann dieses Team zählt — gesetzt von einem Reset-Schlüssel (null = wie die Instanz).</summary>
    public DateOnly? ResetAt { get; set; }
    /// <summary>Eintrag des Resets — ab ihm wird gezählt, nicht erst ab dem nächsten Tag.</summary>
    public long? ResetNumber { get; set; }
    /// <summary>Die eingelösten Limit-Schlüssel dieses Teams, in der Reihenfolge des Einlösens.</summary>
    public List<LimitWindow> Windows { get; } = new();
    /// <summary>Der letzte Stand seines Abos vom Lizenzserver — null ohne Abo.</summary>
    public EntitlementReceived? Abo { get; set; }
    /// <summary>Nummer des Eintrags, der das Team zuerst angelegt hat — daran hängt, wer „Team 1“ ist.</summary>
    public long CreatedNumber { get; set; }
    public long LastNumber { get; set; }
    public DateTimeOffset LastAt { get; set; }
    public string LastActor { get; set; } = "";
}

/// <summary>Ein eingelöster Limit-Schlüssel: von–bis (eingeschlossen), was er zusichert, und welcher Schlüssel es war.</summary>
public sealed record LimitWindow(string Key, DateOnly From, DateOnly Until, int Week, int Month, long Number, string? Plan = null)
{
    public bool Gilt(DateOnly d) => From <= d && d <= Until;
}

/// <summary>Ein eingelöster Schlüssel, wie ihn die Übersicht zeigt.</summary>
public sealed record Redemption(string Id, string Kind, string Team, DateOnly From, DateOnly? Until, int Week, int Month, int Days, int Carried, string Actor, DateTimeOffset At, string? Plan = null);

/// <summary>Ein Tag KI: Aufrufe und das gemessene Volumen, aufgeschlüsselt nach Anbieter, Person und Anlass.
/// <see cref="In"/> und <see cref="Out"/> sind die Tokenzahlen alter Einträge — sie wachsen nicht mehr und werden
/// nirgends ausgewertet.</summary>
public sealed class UsageDay
{
    public long Calls { get; set; }
    public long In { get; set; }
    public long Out { get; set; }
    /// <summary>Was journali hingeschickt hat, in Bytes.</summary>
    public long BytesIn { get; set; }
    /// <summary>Was zurückkam, in Bytes.</summary>
    public long BytesOut { get; set; }
    public long Bytes => BytesIn + BytesOut;
    public Dictionary<string, long> ByProvider { get; } = new();
    public Dictionary<string, long> ByUser { get; } = new();
    public Dictionary<string, long> ByPurpose { get; } = new();
}

/// <summary>
/// Abbild „Teams“. Strom <c>team:&lt;key&gt;</c>. Hier steht auch der KI-Verbrauch je Team und Tag
/// (<see cref="AiUsed"/>, Strom <c>ai-usage:&lt;team&gt;</c>): wer zahlt, ist damit eine Frage der Buchung — nicht der Sperre.
/// </summary>
public sealed class Teams : IProjection
{
    public const string Stream = "team:";
    public const string UsageStream = "ai-usage:";
    private readonly Dictionary<string, TeamState> _all = new();
    private readonly Dictionary<string, Dictionary<string, UsageDay>> _usage = new();   // Team → Tag (yyyy-MM-dd) → Verbrauch
    private readonly Dictionary<string, Redemption> _eingeloest = new();              // Schlüssel-Id → Einlösung (einmal je Schlüssel)
    // Das geltende Tarifblatt: Text und Signatur, wie sie im Journal stehen (null = Saatgut). Nicht readonly — der
    // Schnappschuss schreibt private Felder zurück.
    private string? _blatt;
    private string? _blattSig;
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, Tarifliste> Gelesen = new();
    public long LastApplied { get; private set; }

    /// <summary>
    /// Ist diese Anlage beim Lizenzserver registriert? null: noch nicht gefragt. Registriert holt sie das Tarifblatt und
    /// kennt damit die Aktionen des Shops; ohne spricht sie nur, wenn ein Team ein Abo hat.
    /// </summary>
    public bool? Registriert { get; private set; }

    /// <summary>Die Tarife dieser Instanz: aus dem höchsten echten Tarifblatt im Journal, sonst das Saatgut.</summary>
    public Tarifliste Tarife => _blatt is { } b && _blattSig is { } s
        ? Gelesen.GetOrAdd(b + "\n" + s, _ => new Licensing.Tarifblatt(b, s).Pruefe().Inhalt is { } i ? Tarifliste.Aus(i) : Projections.Tarife.Saat)
        : Projections.Tarife.Saat;
    public IReadOnlyDictionary<string, TeamState> All => _all;
    public TeamState? Get(string key) => _all.GetValueOrDefault(key);
    /// <summary>Team 1: das zuerst angelegte. Nur dort gibt es das Grundrauschen, und dorthin fällt, wer kein Team hat.</summary>
    public TeamState? Primary => _all.Values.OrderBy(t => t.CreatedNumber).FirstOrDefault();

    /// <summary>
    /// Wer zahlt: das Team selbst, oder am Ende der Kette das, dessen Kontingent gilt. Ein Kreis
    /// (a→b→a) endet hier beim zuletzt gesehenen Team, statt die Anwendung stehenzulassen — verhindert wird er
    /// beim Setzen. Darum bringt ein Team ohne eigenes Kontingent keins dazu: alle hängen am selben Zahler.
    /// </summary>
    public string Payer(string team)
    {
        var gesehen = new HashSet<string>();
        var cur = team;
        while (gesehen.Add(cur) && _all.GetValueOrDefault(cur)?.KeysFrom is { Length: > 0 } f && _all.ContainsKey(f)) cur = f;
        return cur;
    }

    /// <summary>Würde <paramref name="team"/> mit diesem Zahler im Kreis laufen? (a→b→a, a→b→c→a)</summary>
    public bool WaereKreis(string team, string zahler)
    {
        var gesehen = new HashSet<string> { team };
        var cur = zahler;
        while (true)
        {
            if (!gesehen.Add(cur)) return true;
            if (_all.GetValueOrDefault(cur)?.KeysFrom is { Length: > 0 } f && _all.ContainsKey(f)) cur = f; else return false;
        }
    }
    /// <summary>Die Teams, die an diesem Zahler hängen (er selbst eingeschlossen).</summary>
    public IEnumerable<string> Dependents(string payer) => _all.Keys.Where(k => Payer(k) == payer);

    /// <summary>Führt diese Person das Team? (Der Administrator darf ohnehin alles — das prüft der Server.)</summary>
    public bool Leads(string team, string? user) => user is { Length: > 0 } u && _all.GetValueOrDefault(team)?.Managers.Contains(u) == true;
    /// <summary>Die Teams, die diese Person führt.</summary>
    public IEnumerable<TeamState> Led(string? user) => user is { Length: > 0 } u ? _all.Values.Where(t => t.Managers.Contains(u)) : [];

    /// <summary>Ist dieser Schlüssel schon eingelöst? Ein Schlüssel gilt einmal, egal für welches Team.</summary>
    public bool Eingeloest(string id) => _eingeloest.ContainsKey(id);
    /// <summary>Alle Einlösungen, neueste zuerst.</summary>
    public IEnumerable<Redemption> Einloesungen => _eingeloest.Values.OrderByDescending(r => r.At);

    /// <summary>
    /// Das Kontingent eines Teams an einem Tag: das zugeteilte, angehoben durch einen Limit-Schlüssel, der an dem Tag
    /// gilt. Gelten mehrere, zählt der zuletzt eingelöste — sein Zeitraum enthält schon das Restvolumen des vorigen.
    /// Ein Schlüssel hebt an, er senkt nie: gilt je Woche und Monat der höhere Wert.
    /// </summary>
    public (int Week, int Month) LimitAt(string team, DateOnly d)
    {
        if (_all.GetValueOrDefault(team) is not { } t) return (0, 0);
        var w = t.Windows.Where(x => x.Gilt(d)).OrderByDescending(x => x.Number).FirstOrDefault();
        var (woche, monat) = w is null ? (t.EntriesWeek, t.EntriesMonth) : (Math.Max(t.EntriesWeek, w.Week), Math.Max(t.EntriesMonth, w.Month));
        // ein Abo hebt an, solange es gilt — senkt nie
        return AboAt(team, d) is { } a ? (Math.Max(woche, a.EntriesWeek), Math.Max(monat, a.EntriesMonth)) : (woche, monat);
    }

    /// <summary>
    /// Der Stand des Abos, wenn er an diesem Tag gilt: bezahlt bis mindestens zu diesem Tag und nicht älter als die Kulanz
    /// (gilt ohne neue Abfrage bis). Sonst null — dann gilt, was das Team ohne Abo hat.
    /// </summary>
    public EntitlementReceived? AboAt(string team, DateOnly d) =>
        _all.GetValueOrDefault(team)?.Abo is { Geprueft: true } a && d <= a.PaidUntil && d <= DateOnly.FromDateTime(a.ValidUntil.LocalDateTime) ? a : null;

    /// <summary>Der Tarif, den ein eingelöster Limit-Schlüssel diesem Team an dem Tag gibt — null ohne.</summary>
    public Tarif? TarifAt(string team, DateOnly d) =>
        (_all.GetValueOrDefault(team)?.Windows.Where(x => x.Gilt(d)).Select(x => Tarife.Von(x.Plan)) ?? [])
            .Append(AboAt(team, d) is { } a ? Tarife.Von(a.Plan) : null)
            .Where(x => x is not null)
            .Aggregate((Tarif?)null, (a, b) => a is null ? b : Projections.Tarife.Hoeher(a, b!));

    /// <summary>Der höchste Tarif, den an dem Tag irgendein Team per Schlüssel hat — er gilt für die ganze Instanz.</summary>
    public Tarif? HoechsterTarif(DateOnly d) =>
        _all.Keys.Select(k => TarifAt(k, d)).Where(x => x is not null).Aggregate((Tarif?)null, (a, b) => a is null ? b : Projections.Tarife.Hoeher(a, b!));

    /// <summary>Der Limit-Schlüssel, der an diesem Tag gilt — für die Umrechnung beim nächsten Einlösen.</summary>
    public LimitWindow? WindowAt(string team, DateOnly d) =>
        _all.GetValueOrDefault(team)?.Windows.Where(x => x.Gilt(d)).OrderByDescending(x => x.Number).FirstOrDefault();

    /// <summary>Ab wann dieses Team zählt: der spätere von Instanz-Zählbeginn und eigenem Reset.</summary>
    /// <summary>
    /// Der Eintrag, ab dem dieses Team zählt — sein letzter Reset, sofern der nicht vor dem Zählbeginn der Instanz liegt.
    /// Zusammen mit <see cref="CountFrom"/> an <c>Usage.Sum</c>: der Tag grenzt ab, der Eintrag schneidet den Tag.
    /// </summary>
    public long? ResetCut(string team, DateOnly? instanz) =>
        _all.GetValueOrDefault(team) is { ResetAt: { } a, ResetNumber: { } n } && (instanz is not { } b || a >= b) ? n : null;

    public DateOnly? CountFrom(string team, DateOnly? instanz)
    {
        var r = _all.GetValueOrDefault(team)?.ResetAt;
        return r is { } a && (instanz is not { } b || a > b) ? a : instanz;
    }

    /// <summary>Verbrauch eines Tages (leer = nichts verbraucht).</summary>
    public UsageDay Day(string team, DateOnly day) => _usage.TryGetValue(team, out var d) && d.TryGetValue(day.ToString("yyyy-MM-dd"), out var u) ? u : new UsageDay();
    /// <summary>Alle Tage eines Teams, neueste zuerst.</summary>
    public IEnumerable<(string Day, UsageDay Usage)> Days(string team) =>
        _usage.TryGetValue(team, out var d) ? d.OrderByDescending(kv => kv.Key).Select(kv => (kv.Key, kv.Value)) : [];
    /// <summary>Volumen eines Monats („2026-09“) in Bytes — hin und zurück zusammen.</summary>
    public long Month(string team, string yyyyMM) => Days(team).Where(x => x.Day.StartsWith(yyyyMM, StringComparison.Ordinal)).Sum(x => x.Usage.Bytes);

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
            u.BytesIn += d.BytesIn; u.BytesOut += d.BytesOut;
            var t = d.BytesIn + d.BytesOut;   // aufgeschlüsselt wird das Volumen; alte Einträge tragen hier 0
            if (!string.IsNullOrEmpty(d.Provider)) u.ByProvider[d.Provider] = u.ByProvider.GetValueOrDefault(d.Provider) + t;
            var who = string.IsNullOrEmpty(d.User) ? entry.Actor : d.User;
            if (!string.IsNullOrEmpty(who)) u.ByUser[who] = u.ByUser.GetValueOrDefault(who) + t;
            if (!string.IsNullOrEmpty(d.Purpose)) u.ByPurpose[d.Purpose] = u.ByPurpose.GetValueOrDefault(d.Purpose) + t;
            return;
        }
        if (entry.Type == Types.RegistrationSet)
        {
            Registriert = Types.Deserialize<RegistrationSet>(entry.Payload).Registered;
            return;
        }
        if (entry.Type == Types.TarifeReceived)
        {
            // nur eine echte, stimmige und neuere Fassung ersetzt die geltende
            var d = Types.Deserialize<TarifeReceived>(entry.Payload);
            if (new Licensing.Tarifblatt(d.Blatt, d.Sig).Pruefe().Inhalt is { } neu && neu.Fassung > Tarife.Fassung) { _blatt = d.Blatt; _blattSig = d.Sig; }
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
            case Types.EntitlementReceived:
            {
                var e = Types.Deserialize<EntitlementReceived>(entry.Payload);
                if (_all.GetValueOrDefault(key) is not { } t) break;
                if (t.Abo is null || e.Issued >= t.Abo.Issued) t.Abo = e;   // der jüngste Stand gilt
                t.LastNumber = entry.Number; t.LastAt = entry.At; t.LastActor = entry.Actor;
                break;
            }
            case Types.KeyRedeemed:
            {
                var k = Types.Deserialize<KeyRedeemed>(entry.Payload);
                // eingelöst ist eingelöst — auch wenn das Team später verschwindet
                _eingeloest[k.Id] = new Redemption(k.Id, k.Kind, key, k.From, k.Until, k.EntriesWeek, k.EntriesMonth, k.Days, k.Carried, entry.Actor, entry.At, k.Plan);
                if (_all.GetValueOrDefault(key) is not { } t) break;
                if (k.Kind == Schluessel.Reset && (t.ResetAt is not { } vorher || k.From >= vorher)) { t.ResetAt = k.From; t.ResetNumber = entry.Number; }
                else if (k.Kind == Schluessel.Limit && k.Until is { } bis) t.Windows.Add(new LimitWindow(k.Id, k.From, bis, k.EntriesWeek, k.EntriesMonth, entry.Number, k.Plan));
                t.LastNumber = entry.Number; t.LastAt = entry.At; t.LastActor = entry.Actor;
                break;
            }
        }
    }
}
