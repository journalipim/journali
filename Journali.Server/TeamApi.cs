using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Teams (Taloan, 23.09.2026: „dann richten wir die neue Ebene Teams ein → je Team gibt es Limits und API-Keys, Benutzer
/// gehören einem Team an“). Ein Team ist die Kostenstelle der KI: an ihm hängen die Schlüssel (im Datenverzeichnis, nie im
/// Journal), die Grenzen und der Verbrauch.
/// <list type="bullet">
/// <item><b>Das Inklusivkontingent gibt es einmal</b> (Taloan: „dann lege ich mir 20 Teams an und habe 20× Grundrauschen“):
/// <c>includedTokens</c> lässt sich nur dort setzen. Jedes weitere Team bringt entweder eigene Schlüssel mit — dann zahlt es
/// selbst — oder es hängt an einem Zahler (<c>keysFrom</c>), und dessen Grenzen gelten für die Summe.</item>
/// <item><b>Wer was darf</b> (Taloan, 23.09.2026): <em>Nur der Administrator legt ein Team an</em>, und dabei benennt er
/// mindestens einen <b>Teammanager</b> — notfalls sich selbst. Der Manager führt sein Team: Bezeichnung, Grenzen,
/// Schlüssel, und er trägt Mitglieder ein und aus. <b>Eintragen kann er nur, wer in keinem Team ist</b>; wer wechseln
/// will, wird erst ausgetragen und ist so lange teamlos. Die Limits und <c>keysFrom</c> bleiben beim
/// Administrator.</item>
/// <item><b>Teamlos heisst 0</b>: ohne Team gibt es keinen Schlüssel, keine Grenze und keine KI. Neue Benutzer stehen
/// darum standardmässig im Init Team.</item>
/// </list>
/// </summary>
public static class TeamApi
{
    public sealed record TeamBody(string? Label, string? Note, long? MonthlyTokens, long? DailyTokens, bool? Enabled, string? KeysFrom, long? IncludedTokens, string[]? Managers, Dictionary<string, string?>? Models, int? EntriesWeek, int? EntriesMonth);
    public sealed record KeysBody(Dictionary<string, string?>? Keys);

    /// <summary>Schlüssel der Geheimnisse eines Teams — neben den Job-Token in derselben Datei.</summary>
    public static string SecretKey(string team) => "team:" + team;
    /// <summary>Das Team, auf dessen Rechnung dieser Benutzer arbeitet — null, wenn er in keinem ist (dann gilt 0).</summary>
    public static string? TeamOf(Catalog c, string? user) =>
        c.With((_, _, _) => user is { Length: > 0 } u ? c.Users.All.GetValueOrDefault(u)?.Team : null);

    /// <summary>Darf der Anfragende dieses Team führen? Der Administrator immer; sonst nur sein Manager (Recht <c>team</c>).</summary>
    private static bool Fuehrt(HttpRequest req, Catalog c, string team) =>
        Auth.Has(req, c, Rights.Users) || (Auth.Has(req, c, Rights.Team) && c.With((_, _, _) => c.Teams.Leads(team, req.HttpContext.Items["user"] as string)));

    public static void Map(RouteGroupBuilder api, string jobsDir)
    {
        // Übersicht: wer es gibt, Grenzen, Verbrauch heute und diesen Monat, welche Anbieter Schlüssel haben
        api.MapGet("/teams", (HttpRequest req, Catalog c) => c.With((_, _, _) =>
        {
            var heute = DateOnly.FromDateTime(DateTime.Today); var monat = heute.ToString("yyyy-MM");
            var wer = req.HttpContext.Items["user"] as string;
            var meins = TeamOf(c, wer);
            var alle = Auth.Has(req, c, Rights.Users);
            return Results.Ok(c.Teams.All.Values.Where(t => alle || t.Key == meins || c.Teams.Leads(t.Key, wer)).OrderBy(t => t.CreatedNumber).Select(t => View(c, jobsDir, t, heute, monat)).ToList());
        }));

        api.MapPut("/teams/{key}", (string key, TeamBody body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (!ValidKey(key)) return Bad("Key: a-z, 0-9, _.");
            var darfAlles = Auth.Has(req, c, Rights.Users);
            var fuehrt = Fuehrt(req, c, key);
            return c.With((_, _, write) =>
            {
                var cur = c.Teams.Get(key);
                if (!darfAlles)
                {
                    if (cur is null) return Bad("Ein neues Team legt der Administrator an.");
                    if (!fuehrt) return Bad("Dieses Team führst du nicht.");
                    // Die Grenzen setzt der Administrator (Taloan, 23.09.2026: „das wäre schön, wenn jeder seine Werte selbst
                    // festlegen könnte, oder?“) — ein Manager, der sein eigenes Budget schreibt, ist keine Grenze.
                    if (body.IncludedTokens is not null && body.IncludedTokens != cur.IncludedTokens) return Bad("Das Grundkontingent setzt der Administrator.");
                    if (body.MonthlyTokens is not null && body.MonthlyTokens != cur.MonthlyTokens) return Bad("Die Limits verteilt der Administrator.");
                    if (body.DailyTokens is not null && body.DailyTokens != cur.DailyTokens) return Bad("Die Limits verteilt der Administrator.");
                    if (body.EntriesWeek is not null && body.EntriesWeek != cur.EntriesWeek) return Bad("Die Limits verteilt der Administrator.");
                    if (body.EntriesMonth is not null && body.EntriesMonth != cur.EntriesMonth) return Bad("Die Limits verteilt der Administrator.");
                    if (body.KeysFrom is not null && Blank(body.KeysFrom) != cur.KeysFrom) return Bad("Woher die Schlüssel kommen, entscheidet der Administrator.");
                    if (body.Managers is not null) return Bad("Wer das Team führt, bestimmt der Administrator.");
                }
                // Ein Team ohne Manager gibt es nicht (Taloan, 23.09.2026): beim Anlegen benennt der Administrator mindestens einen
                var managers = body.Managers?.Select(Blank).OfType<string>().Distinct().ToArray() ?? cur?.Managers ?? [];
                foreach (var m in managers) if (!c.Users.All.ContainsKey(m)) return Bad($"Unbekannter Benutzer {m}.");
                if (managers.Length == 0 && cur is null && c.Users.All.Count > 0) return Bad("Mindestens ein Teammanager — notfalls du selbst.");
                var keysFrom = body.KeysFrom is null ? cur?.KeysFrom : Blank(body.KeysFrom);
                if (keysFrom == key) return Bad("Ein Team kann nicht seine eigenen Schlüssel mitbenutzen.");
                if (keysFrom is { } f)
                {
                    if (c.Teams.Get(f) is not { } zahler) return Bad($"Unbekanntes Team {f}.");
                    if (zahler.KeysFrom is { Length: > 0 }) return Bad($"„{zahler.Label}“ benutzt selbst fremde Schlüssel — eine Stufe, keine Kette.");
                }
                var included = body.IncludedTokens ?? cur?.IncludedTokens ?? 0;
                // Das Inklusivkontingent gibt es einmal, am ersten Team (Taloan, 23.09.2026): sonst wäre jedes neue Team ein neuer Freibetrag
                var ersteres = c.Teams.Primary;
                if (included > 0 && ersteres is not null && ersteres.Key != key) return Bad($"Das Grundkontingent hat „{ersteres.Label}“ — das erste Team. Ein weiteres Team bringt eigene Schlüssel mit oder hängt an einem Zahler.");
                if (Blank(body.Label) is null && cur is null) return Bad("Bezeichnung fehlt.");
                foreach (var (n, v) in new[] { ("monatlich", body.MonthlyTokens), ("täglich", body.DailyTokens), ("Grundkontingent", body.IncludedTokens) })
                    if (v is < 0) return Bad($"Grenze {n}: 0 oder mehr (0 = keine).");
                var modelle = cur?.Models is { Count: > 0 } mm ? new Dictionary<string, string>(mm) : new Dictionary<string, string>();
                foreach (var (a, m) in body.Models ?? new()) { if (string.IsNullOrWhiteSpace(m)) modelle.Remove(a); else modelle[a] = m!; }
                var def = new TeamDefined(Blank(body.Label) ?? cur!.Label, body.Note is null ? cur?.Note : Blank(body.Note),
                    body.MonthlyTokens ?? cur?.MonthlyTokens ?? 0, body.DailyTokens ?? cur?.DailyTokens ?? 0,
                    body.Enabled ?? cur?.Enabled ?? true, keysFrom, included, managers, modelle,
                    body.EntriesWeek ?? cur?.EntriesWeek ?? 0, body.EntriesMonth ?? cur?.EntriesMonth ?? 0);
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
                if (c.Teams.Primary?.Key == key) return Bad("Das erste Team bleibt — umbenennen geht, entfernen nicht.");
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
            if (!Fuehrt(req, c, key)) return Bad("Dieses Team führst du nicht.");
            if (c.With((_, _, _) => c.Teams.Get(key)) is null) return Results.NotFound();
            Secrets.Set(jobsDir, SecretKey(key), body.Keys ?? new());
            return Results.Ok(new { keys = Secrets.Get(jobsDir, SecretKey(key)).Keys.Order().ToList() });
        });

        // Wer zum Team gehört (Taloan, 23.09.2026: „auf der Teamseite sehe ich, wer alles zu meinem Team gehört“)
        api.MapGet("/teams/{key}/members", (string key, HttpRequest req, Catalog c) => c.With((_, _, _) =>
        {
            if (!Darf(req, c, key)) return Bad("Das ist nicht dein Team.");
            if (c.Teams.Get(key) is null) return Results.NotFound();
            return Results.Ok(c.Users.All.Values
                .Where(u => u.Team == key)
                .OrderBy(u => u.Name ?? u.Key)
                .Select(u => new { u.Key, u.Name, u.Role, u.Enabled, own = u.Team == key, u.LastAt }).ToList());
        }));

        // Mitglieder eintragen und austragen (Taloan, 23.09.2026): eintragen nur, wer in keinem Team ist — wer wechseln will,
        // wird erst ausgetragen und ist so lange teamlos. Das verhindert, dass zwei Manager sich Leute wegnehmen.
        api.MapPost("/teams/{key}/members/{user}", (string key, string user, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (!Fuehrt(req, c, key)) return Bad("Dieses Team führst du nicht.");
            return c.With((_, _, write) =>
            {
                if (c.Teams.Get(key) is null) return Results.NotFound();
                if (c.Users.All.GetValueOrDefault(user) is not { } u) return Bad($"Unbekannter Benutzer {user}.");
                if (u.Team == key) return Bad($"{u.Name ?? u.Key} ist schon hier.");
                if (u.Team is { Length: > 0 } andere) return Bad($"{u.Name ?? u.Key} steht im Team {c.Teams.Get(andere)?.Label ?? andere} — dort erst austragen.");
                write(actor, Users.Stream + user, Types.UserDefined, new UserDefined(u.Name, u.Email, u.Role, u.Enabled, key), null);
                return Results.Ok(new { user, team = key });
            });
        });

        api.MapDelete("/teams/{key}/members/{user}", (string key, string user, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (!Fuehrt(req, c, key)) return Bad("Dieses Team führst du nicht.");
            return c.With((_, _, write) =>
            {
                if (c.Users.All.GetValueOrDefault(user) is not { } u) return Results.NotFound();
                if (u.Team != key) return Bad($"{u.Name ?? u.Key} steht nicht in diesem Team.");
                if (c.Teams.Leads(key, user)) return Bad($"{u.Name ?? u.Key} führt dieses Team — erst die Führung ändern.");
                write(actor, Users.Stream + user, Types.UserDefined, new UserDefined(u.Name, u.Email, u.Role, u.Enabled, null), null);
                return Results.Ok(new { user, team = (string?)null });   // teamlos: keine Schlüssel, keine Grenzen, keine KI
            });
        });

        // Wer noch in keinem Team ist — nur diese lassen sich eintragen
        api.MapGet("/teams/free", (HttpRequest req, Catalog c) => c.With((_, _, _) =>
            Results.Ok(c.Users.All.Values.Where(u => u.Enabled && u.Team is null).OrderBy(u => u.Name ?? u.Key)
                .Select(u => new { u.Key, u.Name, u.Role }).ToList())));

        // Die Token der Mitglieder (Taloan, 23.09.2026): ein Token arbeitet mit den Rechten seiner Person und auf die Rechnung
        // ihres Teams — darum sieht das Team, welche es gibt, und kann sie widerrufen. Der Token selbst steht nirgends.
        api.MapGet("/teams/{key}/tokens", (string key, HttpRequest req, Catalog c) =>
        {
            if (!Darf(req, c, key)) return Bad("Das ist nicht dein Team.");
            var mitglieder = Mitglieder(c, key);
            if (mitglieder is null) return Results.NotFound();
            return Results.Ok(Auth.TokensOf(jobsDir, mitglieder).Select(t => new { t.Id, t.User, t.Label, t.At }).ToList());
        });

        api.MapDelete("/teams/{key}/tokens/{id}", (string key, string id, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is null) return ActorMissing();
            if (!Fuehrt(req, c, key)) return Bad("Dieses Team führst du nicht.");
            var mitglieder = Mitglieder(c, key);
            if (mitglieder is null) return Results.NotFound();
            var n = Auth.RevokeToken(jobsDir, id, mitglieder);
            return n > 0 ? Results.Ok(new { removed = n }) : Results.NotFound();
        });

        // Die journali-Token eines Teams: was seine Mitglieder geschrieben haben, gegen seine Limits. Rechnet es über
        // ein anderes Team ab, zählt alles dort zusammen (Taloan, 23.09.2026).
        api.MapGet("/teams/{key}/tokens/journali", (string key, HttpRequest req, Catalog c) =>
        {
            if (!Darf(req, c, key)) return Bad("Das ist nicht dein Team.");
            return c.With((_, _, _) =>
            {
                if (c.Teams.Get(key) is not { } t) return Results.NotFound();
                var zahler = c.Teams.Payer(key);
                var zt = c.Teams.Get(zahler)!;
                // wer auf diese Rechnung geht: die Mitglieder des Zahlers und aller, die an ihm hängen
                var leute = c.Teams.Dependents(zahler).SelectMany(x => c.Users.All.Values.Where(u => u.Team == x)).Select(u => u.Key).ToHashSet();
                var eigene = c.Users.All.Values.Where(u => u.Team == key).Select(u => u.Key).ToHashSet();
                var heute = DateOnly.FromDateTime(DateTime.Now);
                return c.ReadUsage(u => Results.Ok(new
                {
                    team = key, payer = zahler, payerLabel = zt.Label,
                    limits = new { week = zt.EntriesWeek, month = zt.EntriesMonth },
                    used = new
                    {
                        week = u.Sum(leute, Usage.WeekStart(heute), heute),
                        month = u.Sum(leute, Usage.MonthStart(heute), heute),
                        day = u.Sum(leute, heute, heute),
                    },
                    mine = new   // was dieses Team beisteuert, wenn es über ein anderes abrechnet
                    {
                        week = u.Sum(eigene, Usage.WeekStart(heute), heute),
                        month = u.Sum(eigene, Usage.MonthStart(heute), heute),
                    },
                }));
            });
        });

        // Verbrauch der letzten Tage — je Anbieter und je Person, damit die Rechnung nachvollziehbar ist
        api.MapGet("/teams/{key}/usage", (string key, HttpRequest req, Catalog c, int days = 30) => c.With((_, _, _) =>
        {
            if (!Darf(req, c, key)) return Bad("Das ist nicht dein Team.");
            if (c.Teams.Get(key) is null) return Results.NotFound();
            return Results.Ok(new
            {
                team = key,
                days = c.Teams.Days(key).Take(Math.Clamp(days, 1, 400)).Select(d => new { day = d.Day, d.Usage.Calls, d.Usage.In, d.Usage.Out, tokens = d.Usage.Tokens, byProvider = d.Usage.ByProvider, byUser = d.Usage.ByUser }).ToList(),
                dependents = c.Teams.Dependents(key).Where(t => t != key).ToList(),   // wer sonst noch auf diese Rechnung geht
            });
        }));
    }

    /// <summary>Wer zu diesem Team gehört. Null = kein solches Team. Teamlose gehören nirgends dazu — sie haben 0.</summary>
    private static HashSet<string>? Mitglieder(Catalog c, string key) => c.With((_, _, _) =>
        c.Teams.Get(key) is null ? null : c.Users.All.Values.Where(u => u.Team == key).Select(u => u.Key).ToHashSet());

    /// <summary>Darf der Anfragende dieses Team sehen? Sein eigenes, eines, das er führt — oder alles als Administrator.</summary>
    private static bool Darf(HttpRequest req, Catalog c, string team) =>
        Auth.Has(req, c, Rights.Users) || team == TeamOf(c, req.HttpContext.Items["user"] as string)
        || c.With((_, _, _) => c.Teams.Leads(team, req.HttpContext.Items["user"] as string));

    private static object View(Catalog c, string jobsDir, TeamState t, DateOnly heute, string monat)
    {
        var zahler = c.Teams.Payer(t.Key);
        var keys = Secrets.Get(jobsDir, SecretKey(t.Key)).Keys.Order().ToList();
        var tag = c.Teams.Day(t.Key, heute);
        return new
        {
            t.Key, t.Label, t.Note, t.Enabled, t.MonthlyTokens, t.DailyTokens, t.IncludedTokens, t.KeysFrom, t.EntriesWeek, t.EntriesMonth,
            primary = c.Teams.Primary?.Key == t.Key,
            keys,                                                    // welche Anbieter eingerichtet sind — nie der Schlüssel selbst
            payer = zahler,
            members = c.Users.All.Values.Count(u => u.Team == t.Key),
            t.Managers, models = t.Models,
            today = tag.Tokens, month = c.Teams.Month(t.Key, monat), calls = tag.Calls,
            t.LastAt, t.LastActor,
        };
    }
}
