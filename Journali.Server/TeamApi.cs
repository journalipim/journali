using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Teams (Taloan, 23.09.2026: „dann richten wir die neue Ebene Teams ein → je Team gibt es Limits und API-Keys, Benutzer
/// gehören einem Team an“). Ein Team ist die Kostenstelle der KI: an ihm hängen die Schlüssel (im Datenverzeichnis, nie im
/// Journal), die Grenzen und der Verbrauch.
/// <list type="bullet">
/// <item><b>Grundrauschen nur am ersten Team</b> (Taloan: „dann lege ich mir 20 Teams an und habe 20× Grundrauschen“):
/// <c>includedTokens</c> lässt sich nur dort setzen. Jedes weitere Team bringt entweder eigene Schlüssel mit — dann zahlt es
/// selbst — oder es hängt an einem Zahler (<c>keysFrom</c>), und dessen Grenzen gelten für die Summe.</item>
/// <item><b>Team-Admin</b> (Recht <c>team</c>): pflegt sein eigenes Team — Bezeichnung, Grenzen, Schlüssel. Anlegen, Löschen,
/// das Grundrauschen und <c>keysFrom</c> bleiben bei „Benutzer und Rollen“ (<c>users</c>): sonst hängt sich jeder an eine
/// fremde Kasse oder holt sich Mitglieder in die eigene.</item>
/// </list>
/// </summary>
public static class TeamApi
{
    public sealed record TeamBody(string? Label, string? Note, long? MonthlyTokens, long? DailyTokens, bool? Enabled, string? KeysFrom, long? IncludedTokens);
    public sealed record KeysBody(Dictionary<string, string?>? Keys);

    /// <summary>Schlüssel der Geheimnisse eines Teams — neben den Job-Token in derselben Datei.</summary>
    public static string SecretKey(string team) => "team:" + team;
    /// <summary>Das Team, auf dessen Rechnung dieser Benutzer arbeitet: sein eigenes, sonst das erste Team (Team 1).</summary>
    public static string? TeamOf(Catalog c, string? user) =>
        c.With((_, _, _) => (user is { Length: > 0 } u ? c.Users.All.GetValueOrDefault(u)?.Team : null) ?? c.Teams.Primary?.Key);

    public static void Map(RouteGroupBuilder api, string jobsDir)
    {
        // Übersicht: wer es gibt, Grenzen, Verbrauch heute und diesen Monat, welche Anbieter Schlüssel haben
        api.MapGet("/teams", (HttpRequest req, Catalog c) => c.With((_, _, _) =>
        {
            var heute = DateOnly.FromDateTime(DateTime.Today); var monat = heute.ToString("yyyy-MM");
            var meins = TeamOf(c, req.HttpContext.Items["user"] as string);
            var alle = Auth.Has(req, c, Rights.Users);
            return Results.Ok(c.Teams.All.Values.Where(t => alle || t.Key == meins).OrderBy(t => t.CreatedNumber).Select(t => View(c, jobsDir, t, heute, monat)).ToList());
        }));

        api.MapPut("/teams/{key}", (string key, TeamBody body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (!ValidKey(key)) return Bad("Key: a-z, 0-9, _.");
            var darfAlles = Auth.Has(req, c, Rights.Users);
            var meins = TeamOf(c, req.HttpContext.Items["user"] as string);
            return c.With((_, _, write) =>
            {
                var cur = c.Teams.Get(key);
                if (!darfAlles)
                {
                    if (cur is null) return Bad("Neue Teams legt an, wer Benutzer und Rollen verwaltet.");
                    if (key != meins) return Bad("Das ist nicht dein Team.");
                    if (body.IncludedTokens is not null && body.IncludedTokens != cur.IncludedTokens) return Bad("Das Grundkontingent gehört zur Anlage, nicht zum Team.");
                    if (body.KeysFrom is not null && Blank(body.KeysFrom) != cur.KeysFrom) return Bad("Woher die Schlüssel kommen, entscheidet die Anlage — nicht das Team.");
                }
                var keysFrom = body.KeysFrom is null ? cur?.KeysFrom : Blank(body.KeysFrom);
                if (keysFrom == key) return Bad("Ein Team kann nicht seine eigenen Schlüssel mitbenutzen.");
                if (keysFrom is { } f)
                {
                    if (c.Teams.Get(f) is not { } zahler) return Bad($"Unbekanntes Team {f}.");
                    if (zahler.KeysFrom is { Length: > 0 }) return Bad($"„{zahler.Label}“ benutzt selbst fremde Schlüssel — eine Stufe, keine Kette.");
                }
                var included = body.IncludedTokens ?? cur?.IncludedTokens ?? 0;
                // Das Grundrauschen gibt es einmal, am ersten Team (Taloan, 23.09.2026): sonst wäre jedes neue Team ein neuer Freibetrag
                var ersteres = c.Teams.Primary;
                if (included > 0 && ersteres is not null && ersteres.Key != key) return Bad($"Das Grundkontingent hat „{ersteres.Label}“ — das erste Team. Ein weiteres Team bringt eigene Schlüssel mit oder hängt an einem Zahler.");
                if (Blank(body.Label) is null && cur is null) return Bad("Bezeichnung fehlt.");
                foreach (var (n, v) in new[] { ("monatlich", body.MonthlyTokens), ("täglich", body.DailyTokens), ("Grundkontingent", body.IncludedTokens) })
                    if (v is < 0) return Bad($"Grenze {n}: 0 oder mehr (0 = keine).");
                var def = new TeamDefined(Blank(body.Label) ?? cur!.Label, body.Note is null ? cur?.Note : Blank(body.Note),
                    body.MonthlyTokens ?? cur?.MonthlyTokens ?? 0, body.DailyTokens ?? cur?.DailyTokens ?? 0,
                    body.Enabled ?? cur?.Enabled ?? true, keysFrom, included);
                write(actor, Teams.Stream + key, Types.TeamDefined, def, null);
                var heute = DateOnly.FromDateTime(DateTime.Today);
                return Results.Ok(View(c, jobsDir, c.Teams.Get(key)!, heute, heute.ToString("yyyy-MM")));
            });
        });

        api.MapDelete("/teams/{key}", (string key, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (!Auth.Has(req, c, Rights.Users)) return Bad("Teams entfernt, wer Benutzer und Rollen verwaltet.");
            return c.With((_, _, write) =>
            {
                if (c.Teams.Get(key) is null) return Results.NotFound();
                var drin = c.Users.All.Values.Where(u => u.Team == key).Select(u => u.Name ?? u.Key).ToList();
                if (drin.Count > 0) return Bad($"Noch {drin.Count} im Team: {string.Join(", ", drin.Take(5))}{(drin.Count > 5 ? " …" : "")}.");
                if (c.Teams.All.Values.Any(t => t.KeysFrom == key)) return Bad("Andere Teams benutzen die Schlüssel dieses Teams.");
                write(actor, Teams.Stream + key, Types.TeamRetired, new TeamRetired(), null);
                Secrets.Remove(jobsDir, SecretKey(key));   // der Schlüssel geht mit; der Verbrauch bleibt als Tatsache stehen
                return Results.Ok(new { retired = key });
            });
        });

        // Schlüssel hinterlegen (nie im Journal, nie zurückgelesen — nur, welche Anbieter eingerichtet sind)
        api.MapPut("/teams/{key}/keys", (string key, KeysBody body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is null) return ActorMissing();
            var darfAlles = Auth.Has(req, c, Rights.Users);
            if (!darfAlles && key != TeamOf(c, req.HttpContext.Items["user"] as string)) return Bad("Das ist nicht dein Team.");
            if (c.With((_, _, _) => c.Teams.Get(key)) is null) return Results.NotFound();
            Secrets.Set(jobsDir, SecretKey(key), body.Keys ?? new());
            return Results.Ok(new { keys = Secrets.Get(jobsDir, SecretKey(key)).Keys.Order().ToList() });
        });

        // Die Token der Mitglieder (Taloan, 23.09.2026): ein Token arbeitet mit den Rechten seiner Person und auf die Rechnung
        // ihres Teams — darum sieht das Team, welche es gibt, und kann sie widerrufen. Der Token selbst steht nirgends.
        api.MapGet("/teams/{key}/tokens", (string key, HttpRequest req, Catalog c) =>
        {
            if (!Auth.Has(req, c, Rights.Users) && key != TeamOf(c, req.HttpContext.Items["user"] as string)) return Bad("Das ist nicht dein Team.");
            var mitglieder = Mitglieder(c, key);
            if (mitglieder is null) return Results.NotFound();
            return Results.Ok(Auth.TokensOf(jobsDir, mitglieder).Select(t => new { t.Id, t.User, t.Label, t.At }).ToList());
        });

        api.MapDelete("/teams/{key}/tokens/{id}", (string key, string id, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is null) return ActorMissing();
            if (!Auth.Has(req, c, Rights.Users) && key != TeamOf(c, req.HttpContext.Items["user"] as string)) return Bad("Das ist nicht dein Team.");
            var mitglieder = Mitglieder(c, key);
            if (mitglieder is null) return Results.NotFound();
            var n = Auth.RevokeToken(jobsDir, id, mitglieder);
            return n > 0 ? Results.Ok(new { removed = n }) : Results.NotFound();
        });

        // Verbrauch der letzten Tage — je Anbieter und je Person, damit die Rechnung nachvollziehbar ist
        api.MapGet("/teams/{key}/usage", (string key, HttpRequest req, Catalog c, int days = 30) => c.With((_, _, _) =>
        {
            if (!Auth.Has(req, c, Rights.Users) && key != TeamOf(c, req.HttpContext.Items["user"] as string)) return Bad("Das ist nicht dein Team.");
            if (c.Teams.Get(key) is null) return Results.NotFound();
            return Results.Ok(new
            {
                team = key,
                days = c.Teams.Days(key).Take(Math.Clamp(days, 1, 400)).Select(d => new { day = d.Day, d.Usage.Calls, d.Usage.In, d.Usage.Out, tokens = d.Usage.Tokens, byProvider = d.Usage.ByProvider, byUser = d.Usage.ByUser }).ToList(),
                dependents = c.Teams.Dependents(key).Where(t => t != key).ToList(),   // wer sonst noch auf diese Rechnung geht
            });
        }));
    }

    /// <summary>Wer zu diesem Team gehört; beim ersten Team auch alle ohne eigenes (dort fallen sie hin). Null = kein solches Team.</summary>
    private static HashSet<string>? Mitglieder(Catalog c, string key) => c.With((_, _, _) =>
    {
        if (c.Teams.Get(key) is null) return null;
        var erstes = c.Teams.Primary?.Key == key;
        return c.Users.All.Values.Where(u => u.Team == key || (erstes && u.Team is null)).Select(u => u.Key).ToHashSet();
    });

    private static object View(Catalog c, string jobsDir, TeamState t, DateOnly heute, string monat)
    {
        var zahler = c.Teams.Payer(t.Key);
        var keys = Secrets.Get(jobsDir, SecretKey(t.Key)).Keys.Order().ToList();
        var tag = c.Teams.Day(t.Key, heute);
        return new
        {
            t.Key, t.Label, t.Note, t.Enabled, t.MonthlyTokens, t.DailyTokens, t.IncludedTokens, t.KeysFrom,
            primary = c.Teams.Primary?.Key == t.Key,
            keys,                                                    // welche Anbieter eingerichtet sind — nie der Schlüssel selbst
            payer = zahler,
            members = c.Users.All.Values.Count(u => u.Team == t.Key || (c.Teams.Primary?.Key == t.Key && u.Team is null)),
            today = tag.Tokens, month = c.Teams.Month(t.Key, monat), calls = tag.Calls,
            t.LastAt, t.LastActor,
        };
    }
}
