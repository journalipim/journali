using System.Text.Json;
using System.Text.Json.Serialization;
using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Ein Lizenzschlüssel, wie ihn der Lizenzgeber ausstellt (Taloan, 23.09.2026: „ein Schlüssel erhält eine einmalig
/// verwendbare Id — wenn die zentrale IT sich zehn Sicherheits-Reset-Schlüssel auf Vorrat legt und bei Bedarf
/// verteilt, darf da keine Teambindung eingeprägt sein, sondern nur eine Systembindung“).
/// <para>Er nennt die Instanz, für die er gilt, aber kein Team — das wählt die IT beim Einlösen. Die Art sagt, was
/// er tut (<see cref="Schluessel.Reset"/> oder <see cref="Schluessel.Limit"/>), bei einem Limit auch wie viel und
/// wie lange. <c>Request</c> ist der Fingerabdruck der Anforderung, zu der er ausgestellt wurde (<see cref="KeyRequests"/>);
/// die Id ist die der Anforderung. Die Signatur deckt alles davon ab.</para>
/// </summary>
public sealed record LicenceKey(
    string? Id = null,
    string? Kind = null,
    string? Instance = null,
    int EntriesWeek = 0,
    int EntriesMonth = 0,
    int Days = 0,
    DateOnly? Issued = null,
    string? Request = null,
    string? Sig = null)
{
    internal static readonly JsonSerializerOptions Json = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    /// <summary>Was signiert wird: alles ausser der Signatur.</summary>
    [JsonIgnore] public string Rumpf => JsonSerializer.Serialize(this with { Sig = null }, Json);
}

public static class LicenceKeys
{
    /// <summary>
    /// Darf dieser Schlüssel für dieses Team eingelöst werden? null = ja, sonst der Grund. Geprüft wird alles, was
    /// ohne Schreiben geht: Art, Id, Instanz, die Anforderung dazu, schon eingelöst, das Team — und ob das Team sein
    /// Kontingent selbst trägt. <paramref name="anforderung"/> ist die eigene Anforderung mit der Id des Schlüssels,
    /// <paramref name="pub"/> der öffentliche Schlüssel dieser Instanz.
    /// </summary>
    public static string? Fehler(LicenceKey k, string team, string? instanz, Teams teams, SignedRequest? anforderung, string? pub)
    {
        if (string.IsNullOrWhiteSpace(k.Id)) return "Der Schlüssel hat keine Id.";
        if (k.Kind is not { } art || !Schluessel.Arten.Contains(art)) return $"Unbekannte Art „{k.Kind}“ — erwartet: {string.Join(", ", Schluessel.Arten)}.";
        // Systembindung ist Pflicht: ein Schlüssel ohne Instanz gälte überall
        if (string.IsNullOrWhiteSpace(k.Instance)) return "Der Schlüssel nennt keine Instanz.";
        if (instanz is { Length: > 0 } hier && !string.Equals(k.Instance, hier, StringComparison.OrdinalIgnoreCase))
            return $"Ausgestellt für eine andere Instanz ({k.Instance}).";
        // nur, was diese Instanz selbst angefordert hat — und genau das
        if (anforderung?.Inhalt is not { } a) return $"Zu Schlüssel {k.Id} gibt es hier keine Anforderung.";
        if (!string.Equals(k.Request, anforderung.Hash, StringComparison.OrdinalIgnoreCase)) return "Der Schlüssel gehört nicht zu dieser Anforderung.";
        if (anforderung.Pruefe() is (false, var warum)) return warum;
        if (a.Instance != instanz || a.Pub != pub) return "Die Anforderung stammt von einer anderen Instanz.";
        if (a.Kind != k.Kind) return $"Angefordert: {a.Kind}, ausgestellt: {k.Kind}.";
        if (teams.Eingeloest(k.Id)) return $"Schlüssel {k.Id} ist schon eingelöst.";
        if (teams.Get(team) is not { } t) return $"Team „{team}“ gibt es nicht.";
        // wer über ein anderes Team abrechnet, hat kein eigenes Kontingent — der Schlüssel gehört dorthin
        if (teams.Payer(team) is { } zahler && zahler != team) return $"„{t.Label}“ rechnet über „{teams.Get(zahler)?.Label ?? zahler}“ ab — den Schlüssel dort einlösen.";
        if (art == Schluessel.Limit)
        {
            if (k.Days <= 0) return "Ein Limit-Schlüssel braucht eine Dauer in Tagen.";
            if (k.EntriesWeek < 0 || k.EntriesMonth < 0 || (k.EntriesWeek == 0 && k.EntriesMonth == 0)) return "Ein Limit-Schlüssel braucht eine Grenze je Woche oder Monat.";
        }
        return null;
    }

    /// <summary>Der Eintrag, der beim Einlösen geschrieben wird — mit schon umgerechneter Laufzeit.</summary>
    public static KeyRedeemed Einloesung(LicenceKey k, string team, DateOnly heute, Teams teams)
    {
        if (k.Kind == Schluessel.Reset) return new KeyRedeemed(k.Id!, Schluessel.Reset, heute);
        var (bis, dazu) = Schluessel.Bis(heute, k.Days, k.EntriesWeek, k.EntriesMonth, teams.WindowAt(team, heute));
        return new KeyRedeemed(k.Id!, Schluessel.Limit, heute, bis, k.EntriesWeek, k.EntriesMonth, k.Days, dazu);
    }

    public sealed record Body(JsonElement Key, string Team);

    public sealed record RequestBody(string? Kind, int EntriesWeek, int EntriesMonth, int Days, int Count = 1);

    public static void Map(RouteGroupBuilder api, Licences licences, KeyRequests anforderungen, Instanz instanz)
    {
        // Anforderungen: auf Vorrat, ohne Team — das Team kommt beim Einlösen
        api.MapGet("/licence/requests", (Catalog c) =>
        {
            var alle = anforderungen.Alle();
            return c.With((_, _, _) => Results.Ok(alle.Select(z =>
            {
                var r = z.Signiert.Inhalt;
                var e = c.Teams.Einloesungen.FirstOrDefault(x => x.Id == r?.Id);
                return new
                {
                    r?.Id, r?.Kind, week = r?.EntriesWeek ?? 0, month = r?.EntriesMonth ?? 0, days = r?.Days ?? 0, created = z.At, who = z.Who,
                    hash = z.Signiert.Hash, text = z.Signiert.Text,
                    team = e?.Team, teamLabel = e is null ? null : c.Teams.Get(e.Team)?.Label ?? e.Team,
                };
            }).ToList()));
        });

        api.MapPost("/licence/requests", (RequestBody body, HttpRequest req) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (body.Kind is not { } art || !Schluessel.Arten.Contains(art)) return Bad($"Art: {string.Join(", ", Schluessel.Arten)}.");
            if (body.Count is < 1 or > 20) return Bad("Anzahl: 1 bis 20.");
            if (art == Schluessel.Limit && (body.Days <= 0 || body.EntriesWeek < 0 || body.EntriesMonth < 0 || (body.EntriesWeek == 0 && body.EntriesMonth == 0)))
                return Bad("Limit: Tage und eine Grenze je Woche oder Monat.");
            var (w, m, d) = art == Schluessel.Limit ? (body.EntriesWeek, body.EntriesMonth, body.Days) : (0, 0, 0);
            var neu = Enumerable.Range(0, body.Count).Select(_ => anforderungen.Neu(art, w, m, d, actor)).ToList();
            return Results.Ok(neu.Select(s => new { s.Inhalt!.Id, hash = s.Hash, text = s.Text }).ToList());
        });

        api.MapGet("/licence/keys", (Catalog c) => c.With((_, _, _) => Results.Ok(c.Teams.Einloesungen.Select(r => new
        {
            r.Id, r.Kind, r.Team, teamLabel = c.Teams.Get(r.Team)?.Label ?? r.Team, r.From, r.Until, week = r.Week, month = r.Month, r.Days, r.Carried, r.Actor, r.At,
        }).ToList())));

        // Einlösen: Schlüssel und Team — geschrieben wird in einem Zug, damit derselbe Schlüssel nicht zweimal durchgeht
        api.MapPost("/licence/keys", (Body body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            LicenceKey? k;
            try { k = body.Key.ValueKind == JsonValueKind.String ? JsonSerializer.Deserialize<LicenceKey>(body.Key.GetString()!, LicenceKey.Json) : body.Key.Deserialize<LicenceKey>(LicenceKey.Json); }
            catch (Exception e) { return Bad("Kein gültiger Schlüssel: " + e.Message); }
            if (k is null) return Bad("Kein Schlüssel.");
            var team = (body.Team ?? "").Trim();
            var (geprueft, grund) = Signatur.Pruefe(k.Rumpf, k.Sig);
            var heute = DateOnly.FromDateTime(DateTime.Now);
            var anforderung = anforderungen.Get(k.Id);
            var ergebnis = c.With((_, _, write) =>
            {
                if (Fehler(k, team, licences.InstanzId, c.Teams, anforderung, instanz.PublicKey) is { } f) return (Fehler: f, Eintrag: (KeyRedeemed?)null);
                var e = Einloesung(k, team, heute, c.Teams);
                write(actor, Teams.Stream + team, Types.KeyRedeemed, e, null);
                return (Fehler: (string?)null, Eintrag: e);
            });
            if (ergebnis.Fehler is { } fehler) return Bad(fehler);
            var r = ergebnis.Eintrag!;
            return Results.Ok(new { r.Id, r.Kind, team, r.From, r.Until, r.Carried, geprueft, grund });
        });
    }
}
