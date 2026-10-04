using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Was an Lizenz gilt: der Test des Init Teams, die Abos der Teams, der Tarif der Instanz. Lesen darf jeder, der lesen
/// darf: die Grenzen betreffen alle. Abo verbinden: Recht <c>users</c>; den Stand eines Teams holen darf auch, wer das
/// Team führt — er bestellt sein Kontingent selbst (26.09.2026).
/// </summary>
public static class LicenceApi
{
    public sealed record AboBody(string? Team, string? Key);
    public sealed record RegistrierungBody(bool Ja);

    public static void Map(RouteGroupBuilder api, Licences licences, Abos abos)
    {
        api.MapGet("/licence", (Catalog c) =>
        {
            var l = licences.Lic; var roh = licences.Roh;
            var t = c.InstanzTarif;
            var liste = c.Tarife;
            var lt = l.TarifIn(liste);
            var baeume = c.Read(tree => tree.PubTrees.Count());
            var quelle = Herkunft(c, t, roh.Trial == true && !roh.Abgelaufen);
            return Results.Ok(new
            {
                l.Plan, l.Holder, validUntil = roh.ValidUntil, entriesWeek = lt.Week, entriesMonth = lt.Month, l.CountFrom, l.AiTokensMonth, l.AiTokensDay,
                geprueft = licences.Geprueft, grund = licences.Grund, abgelaufen = roh.Abgelaufen, ort = licences.Ort,
                instanz = licences.InstanzId,
                // der Tarif: aus der Lizenz, der Test, und was für die ganze Instanz gilt
                tarif = new { key = lt.Key, label = lt.Label }, trial = roh.Trial == true, trialPlan = roh.TarifIn(liste).Label,
                tarifblatt = liste.Version,
                instanzTarif = new { key = t.Key, label = t.Label, pubTrees = t.PubTrees == Tarife.Ohne ? (int?)null : t.PubTrees },
                // woher er kommt (03.10.2026): sonst steht „Pro“ da, ohne dass jemand sieht, warum — aus der Lizenz, dem Test, einem Abo oder einem Schlüssel
                quelle,
                // die Schlüssel, die heute gelten: Tarif und Grenzen, die sie einem Team geben, und bis wann
                schluessel = c.Lesen((_, _) => c.Teams.All.Values.SelectMany(x => x.Windows.Where(w => w.Gilt(DateOnly.FromDateTime(DateTime.Now))).Select(w => new
                {
                    team = x.Key, teamLabel = x.Label, id = w.Key, plan = w.Plan, planLabel = w.Plan is { } pl ? liste.Von(pl)?.Label ?? pl : null,
                    week = w.Week, month = w.Month, from = w.From, until = w.Until,
                    zaehlt = Teams.SchluesselZaehlen(x),   // false: das Team hat einen Stand vom Lizenzserver, und der allein gilt
                })).OrderBy(w => w.until).ToList()),
                // Die Adresse des Shops aus dem Tarifblatt: die Oberfläche hängt Instanz und Team daran, und was gekauft
                // wird, findet über den Lizenzserver zum Team zurück — niemand fügt danach etwas ein.
                // Die Aktionen nur, solange sie gelten: danach steht nichts da und nichts hängt an der Adresse
                kauf = liste.Kauf,
                rabatte = liste.RabatteAm(DateOnly.FromDateTime(DateTime.Now)).Select(r => new { r.Code, r.Text, r.Bis }).ToList(),
                pubTrees = baeume,
                // Server auf dieser Datenbank (04.10.2026): wie viele erlaubt sind, und wie viele davon der Zusatz Multi-Server gibt
                erlaubteServer = c.ErlaubteServer, serverZusatz = c.Lesen((_, _) => c.Teams.ServerZusatz(DateOnly.FromDateTime(DateTime.Now))),
                // die Abos der Teams: letzter Stand vom Lizenzserver, und ob er heute gilt
                lizenzserver = abos.Eingestellt, registriert = c.Registriert,
                // Der Weg von Hand steht nur da, wenn der Lizenzserver ihn dieser Instanz freigegeben hat (26.09.2026)
                vonHand = abos.VonHand,
                abos = c.Lesen((_, _) => c.Teams.All.Values.Where(x => x.Abo is not null).Select(x => new
                {
                    team = x.Key, teamLabel = x.Label, plan = x.Abo!.Plan, planLabel = liste.Von(x.Abo.Plan)?.Label ?? x.Abo.Plan, status = x.Abo.Status,
                    paidUntil = x.Abo.PaidUntil, validUntil = x.Abo.ValidUntil, issued = x.Abo.Issued, geprueft = x.Abo.Geprueft,
                    gilt = c.Teams.AboAt(x.Key, DateOnly.FromDateTime(DateTime.Now)) is not null,
                }).ToList()),
            });
        });

        // Abo verbinden: Lizenzschlüssel aus dem Shop für ein Team — Recht users, wie das Einspielen

        api.MapPost("/licence/abo", async (AboBody body, HttpRequest req, Catalog c, CancellationToken ct) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (string.IsNullOrWhiteSpace(body.Team) || string.IsNullOrWhiteSpace(body.Key)) return Bad("Team und Schlüssel fehlen.");
            var (stand, fehler) = await abos.VerbindenAsync(c, body.Team.Trim(), body.Key, actor, ct);
            if (stand is null) return Bad(fehler ?? "Abo nicht verbunden.");
            return Results.Ok(new { stand.Team, stand.Plan, planLabel = c.Tarife.Von(stand.Plan)?.Label ?? stand.Plan, stand.Status, stand.PaidUntil, stand.Geprueft });
        });

        // Auffrischen: den Stand eines Teams sofort neu holen, mit dem gemerkten Shop-Schlüssel
        api.MapPost("/licence/abo/{team}/auffrischen", async (string team, HttpRequest req, Catalog c, CancellationToken ct) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (!TeamApi.Fuehrt(req, c, team)) return Bad("Dieses Team führst du nicht.");
            var (stand, fehler) = await abos.AuffrischenAsync(c, team, actor, ct);
            if (stand is null) return Bad(fehler ?? "Abo nicht aufgefrischt.");
            return Results.Ok(new { stand.Team, stand.Plan, planLabel = c.Tarife.Von(stand.Plan)?.Label ?? stand.Plan, stand.Status, stand.PaidUntil, stand.Geprueft });
        });
        // Registrieren: die Anlage holt das Tarifblatt beim Lizenzserver und kennt damit Tarife und Aktionen des Shops.
        // Gefragt wird einmal; ein Nein bleibt ein Nein, bis es hier geändert wird.
        api.MapPost("/licence/registrierung", async (RegistrierungBody body, HttpRequest req, Catalog c, CancellationToken ct) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            c.Registrierung(body.Ja, actor);
            var fehler = body.Ja ? await abos.TarifblattAsync(c, ct) : null;
            return Results.Ok(new { registriert = body.Ja, tarifblatt = c.Tarife.Version, fehler });
        });

        // Eine Lizenz für die ganze Instanz wird nicht eingespielt (25.09.2026): jede gehört einem Team — Abo
        // (/licence/abo) oder Schlüssel zum Kopieren (/licence/keys). Übrig ist der Test des Init Teams (Licences).
    }

    /// <summary>
    /// Woher der Tarif der Instanz kommt: das Abo eines Teams, ein eingelöster Schlüssel, der Test einer neuen Instanz oder die Lizenz. Gilt mehreres, nennt
    /// es das, was den Tarif trägt — in dieser Reihenfolge, weil ein Abo bezahlt ist und ein Schlüssel ausgestellt.
    /// </summary>
    public static object Herkunft(Catalog c, Tarif instanz, bool test)
    {
        var heute = DateOnly.FromDateTime(DateTime.Now);
        var liste = c.Tarife;
        return c.Lesen<object>((_, _) =>
        {
            foreach (var t in c.Teams.All.Values)
                if (c.Teams.AboAt(t.Key, heute) is { } a && liste.Von(a.Plan)?.Key == instanz.Key)
                    return new { art = "abo", team = t.Key, teamLabel = t.Label, bis = (DateOnly?)a.PaidUntil };
            foreach (var t in c.Teams.All.Values)
                if (Teams.SchluesselZaehlen(t) && t.Windows.Where(w => w.Gilt(heute) && w.Plan is not null && liste.Von(w.Plan)?.Key == instanz.Key).OrderByDescending(w => w.Until).FirstOrDefault() is { } w)
                    return new { art = "schluessel", team = t.Key, teamLabel = t.Label, bis = (DateOnly?)w.Until };
            return new { art = test ? "test" : "lizenz", team = (string?)null, teamLabel = (string?)null, bis = (DateOnly?)null };
        });
    }
}
