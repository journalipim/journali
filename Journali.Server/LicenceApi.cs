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
            return Results.Ok(new
            {
                l.Plan, l.Holder, validUntil = roh.ValidUntil, entriesWeek = lt.Week, entriesMonth = lt.Month, l.CountFrom, l.AiTokensMonth, l.AiTokensDay,
                geprueft = licences.Geprueft, grund = licences.Grund, abgelaufen = roh.Abgelaufen, ort = licences.Ort,
                instanz = licences.InstanzId,
                // der Tarif: aus der Lizenz, der Test, und was für die ganze Instanz gilt
                tarif = new { key = lt.Key, label = lt.Label }, trial = roh.Trial == true, trialPlan = roh.TarifIn(liste).Label,
                tarifblatt = liste.Fassung,
                instanzTarif = new { key = t.Key, label = t.Label, pubTrees = t.PubTrees == Tarife.Ohne ? (int?)null : t.PubTrees },
                // Die Adresse des Shops aus dem Tarifblatt: die Oberfläche hängt Instanz und Team daran, und was gekauft
                // wird, findet über den Lizenzserver zum Team zurück — niemand fügt danach etwas ein.
                // Die Aktionen nur, solange sie gelten: danach steht nichts da und nichts hängt an der Adresse
                kauf = liste.Kauf,
                rabatte = liste.RabatteAm(DateOnly.FromDateTime(DateTime.Now)).Select(r => new { r.Code, r.Text, r.Bis }).ToList(),
                pubTrees = baeume,
                // die Abos der Teams (Taloan, 24.09.2026): letzter Stand vom Lizenzserver, und ob er heute gilt
                lizenzserver = abos.Eingestellt, registriert = c.Registriert,
                abos = c.With((_, _, _) => c.Teams.All.Values.Where(x => x.Abo is not null).Select(x => new
                {
                    team = x.Key, teamLabel = x.Label, plan = x.Abo!.Plan, planLabel = liste.Von(x.Abo.Plan)?.Label ?? x.Abo.Plan, status = x.Abo.Status,
                    paidUntil = x.Abo.PaidUntil, validUntil = x.Abo.ValidUntil, issued = x.Abo.Issued, geprueft = x.Abo.Geprueft,
                    gilt = c.Teams.AboAt(x.Key, DateOnly.FromDateTime(DateTime.Now)) is not null,
                }).ToList()),
            });
        });

        // Abo verbinden: Lizenzschlüssel aus dem Shop für ein Team (Taloan, 24.09.2026) — Recht users, wie das Einspielen
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
            return Results.Ok(new { registriert = body.Ja, tarifblatt = c.Tarife.Fassung, fehler });
        });

        // Eine Lizenz für die ganze Instanz wird nicht eingespielt (25.09.2026): jede gehört einem Team — Abo
        // (/licence/abo) oder Schlüssel zum Kopieren (/licence/keys). Übrig ist der Test des Init Teams (Licences).
    }
}
