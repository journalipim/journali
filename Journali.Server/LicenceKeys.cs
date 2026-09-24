using System.Text.Json;
using System.Text.Json.Serialization;
using Journali.Core.Entries;
using Journali.Core.Licensing;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

public static class LicenceKeys
{
    /// <summary>
    /// Darf dieser Schlüssel für dieses Team eingelöst werden? null = ja, sonst der Grund. Geprüft wird alles, was
    /// ohne Schreiben geht: Art, Id, Instanz, die Anforderung dazu, schon eingelöst, das Team — und ob das Team sein
    /// Kontingent selbst trägt. <paramref name="anforderung"/> ist die eigene Anforderung mit der Id des Schlüssels,
    /// <paramref name="pub"/> der öffentliche Schlüssel dieser Instanz, <paramref name="teamTarif"/> der Tarif des Teams
    /// (für den Reset: getrennt für Pro und Enterprise).
    /// </summary>
    public static string? Fehler(LicenceKey k, string team, string? instanz, Teams teams, SignedRequest? anforderung, string? pub, Tarif? teamTarif = null)
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
        if (a.Plan != k.Plan) return $"Angefordert: {a.Plan ?? "ohne Tarif"}, ausgestellt: {k.Plan ?? "ohne Tarif"}.";
        if (teams.Eingeloest(k.Id)) return $"Schlüssel {k.Id} ist schon eingelöst.";
        if (teams.Get(team) is not { } t) return $"Team „{team}“ gibt es nicht.";
        // wer über ein anderes Team abrechnet, hat kein eigenes Kontingent — der Schlüssel gehört dorthin
        if (teams.Payer(team) is { } zahler && zahler != team) return $"„{t.Label}“ rechnet über „{teams.Get(zahler)?.Label ?? zahler}“ ab — den Schlüssel dort einlösen.";
        // Reset Pro für Teams mit Pro (und Pro+), Reset Enterprise für Enterprise
        if (art == Schluessel.Reset && k.Plan is { } fuer && teamTarif is { } tt && Tarife.ResetFuer(tt) != fuer)
            return $"Reset {Tarife.Von(fuer)?.Label ?? fuer} gilt nicht für Tarif {tt.Label} („{t.Label}“).";
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
        if (k.Kind == Schluessel.Reset) return new KeyRedeemed(k.Id!, Schluessel.Reset, heute, Plan: k.Plan);
        var (bis, dazu) = Schluessel.Bis(heute, k.Days, k.EntriesWeek, k.EntriesMonth, teams.WindowAt(team, heute));
        return new KeyRedeemed(k.Id!, Schluessel.Limit, heute, bis, k.EntriesWeek, k.EntriesMonth, k.Days, dazu, k.Plan);
    }

    public sealed record Body(JsonElement Key, string Team);

    /// <summary>Angefordert wird Reset oder ein Paket — die Zahlen kommen aus dem Paket, nie aus der Anfrage.</summary>
    public sealed record RequestBody(string? Kind, string? Plan, int Count = 1);

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
                    r?.Id, r?.Kind, r?.Plan, week = r?.EntriesWeek ?? 0, month = r?.EntriesMonth ?? 0, days = r?.Days ?? 0, created = z.At, who = z.Who,
                    hash = z.Signiert.Hash, text = z.Signiert.Text,
                    team = e?.Team, teamLabel = e is null ? null : c.Teams.Get(e.Team)?.Label ?? e.Team,
                };
            }).ToList()));
        });

        api.MapPost("/licence/requests", (RequestBody body, HttpRequest req) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (body.Kind is not { } art || !Schluessel.Arten.Contains(art)) return Bad("Art: {0}.", string.Join(", ", Schluessel.Arten));
            if (body.Count is < 1 or > 20) return Bad("Anzahl: 1 bis 20.");
            var paket = art == Schluessel.Limit ? Schluessel.PaketVon(body.Plan) : null;
            if (art == Schluessel.Limit && paket is null) return Bad("Paket: {0}.", string.Join(", ", Schluessel.Pakete.Select(p => p.Key)));
            // Reset: getrennt für Pro und Enterprise
            if (art == Schluessel.Reset && body.Plan is not (Tarife.ProKey or Tarife.EnterpriseKey)) return Bad("Reset: {0} oder {1}.", Tarife.ProKey, Tarife.EnterpriseKey);
            var neu = Enumerable.Range(0, body.Count)
                .Select(_ => paket is { } p ? anforderungen.Neu(art, p.Week, p.Month, p.Days, actor, p.Key) : anforderungen.Neu(art, 0, 0, 0, actor, body.Plan)).ToList();
            return Results.Ok(neu.Select(s => new { s.Inhalt!.Id, hash = s.Hash, text = s.Text }).ToList());
        });

        // Eine offene Anforderung wegwerfen — eine eingelöste bleibt, sie steht im Journal
        api.MapDelete("/licence/requests/{id}", (string id, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is null) return ActorMissing();
            if (anforderungen.Get(id) is null) return Results.NotFound();
            if (c.With((_, _, _) => c.Teams.Einloesungen.Any(x => x.Id == id))) return Bad("{0} ist eingelöst.", id);
            return anforderungen.Loesche(id) ? Results.Ok(new { removed = id }) : Results.NotFound();
        });

        // alle: das Paket enthält alle Plugins (Pro+, Enterprise, Unlimited) — steht in der Auswahl (Taloan, 24.09.2026)
        api.MapGet("/licence/packages", () => Results.Ok(Schluessel.Pakete.Select(p => new { p.Key, p.Label, week = p.Week, month = p.Month, days = p.Days, alle = Tarife.Von(p.Key)?.Plugins is null })));

        api.MapGet("/licence/keys", (Catalog c) => c.With((_, _, _) => Results.Ok(c.Teams.Einloesungen.Select(r => new
        {
            r.Id, r.Kind, r.Team, teamLabel = c.Teams.Get(r.Team)?.Label ?? r.Team, r.From, r.Until, week = r.Week, month = r.Month, r.Days, r.Carried, r.Actor, r.At, r.Plan,
        }).ToList())));

        // Einlösen: Schlüssel und Team — geschrieben wird in einem Zug, damit derselbe Schlüssel nicht zweimal durchgeht
        api.MapPost("/licence/keys", (Body body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            LicenceKey? k;
            try { k = body.Key.ValueKind == JsonValueKind.String ? JsonSerializer.Deserialize<LicenceKey>(body.Key.GetString()!, LicenceKey.Json) : body.Key.Deserialize<LicenceKey>(LicenceKey.Json); }
            catch (Exception e) { return Bad("Kein gültiger Schlüssel: {0}", e.Message); }
            if (k is null) return Bad("Kein Schlüssel.");
            var team = (body.Team ?? "").Trim();
            var (geprueft, grund) = Signatur.Pruefe(k.Rumpf, k.Sig);
            var heute = DateOnly.FromDateTime(DateTime.Now);
            var anforderung = anforderungen.Get(k.Id);
            var ergebnis = c.With((_, _, write) =>
            {
                var tarif = c.Teams.Get(team) is null ? null : c.TeamTarif(team);
                if (Fehler(k, team, licences.InstanzId, c.Teams, anforderung, instanz.PublicKey, tarif) is { } f) return (Fehler: f, Eintrag: (KeyRedeemed?)null);
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
