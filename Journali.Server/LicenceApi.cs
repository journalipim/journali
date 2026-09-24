using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Die Lizenz ansehen und einspielen. Sie ist kein Stammdatum,
/// das man pflegt — sie kommt von aussen und wird eingespielt; darum liegt sie als Datei im Datenverzeichnis und nicht
/// im Journal. Lesen darf jeder, der lesen darf: die Grenzen betreffen alle. Einspielen: Recht <c>users</c>.
/// </summary>
public static class LicenceApi
{
    public sealed record AboBody(string? Team, string? Key);

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
                pubTrees = baeume,
                // die Abos der Teams (Taloan, 24.09.2026): letzter Stand vom Lizenzserver, und ob er heute gilt
                lizenzserver = abos.Eingestellt,
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

        // Einspielen: die Datei kommt so, wie sie ausgestellt wurde — Signatur inbegriffen
        api.MapPut("/licence", (Licence body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (body.AiTokensMonth < 0 || body.AiTokensDay < 0) return Bad("Grenzen: 0 oder mehr.");
            // Die Grenzen kommen aus dem Tarif — eine Lizenz mit unbekanntem Tarif wäre Kostenlos, und das sagt sie besser vorher
            if (body.Plan is { Length: > 0 } p && c.Tarife.Von(p) is null) return Bad("Unbekannter Tarif {0} — bekannt sind: {1}", p, string.Join(", ", c.Tarife.Alle.Select(x => x.Key)));
            // Nur Signiertes zählt (25.09.2026) — eine Lizenz ohne passende Signatur gälte als Kostenlos; die Testlizenz legt die Instanz selbst an
            if (body.Trial == true) return Bad("Die Testlizenz legt die Instanz selbst an.");
            if (Core.Licensing.Aussteller.Pruefe(body.Rumpf, body.Sig) is (false, var warum)) return Bad("Lizenz nicht angenommen: {0}", warum ?? "");
            licences.Neu(body, actor);
            // Das Init Team trägt die Limits der Lizenz — es soll sie sofort haben und nicht erst nach einem Neustart.
            // LimitsAusLizenz setzt dabei auch den Zählbeginn und wirft den mitgeführten Stand weg.
            var uebernommen = c.With((_, _, _) => c.LimitsAusLizenz()) > 0;
            return Results.Ok(new { licences.Lic.Plan, licences.Lic.ValidUntil, geprueft = licences.Geprueft, grund = licences.Grund, uebernommen });
        });
    }
}
