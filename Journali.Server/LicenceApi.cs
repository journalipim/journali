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
    public static void Map(RouteGroupBuilder api, Licences licences)
    {
        api.MapGet("/licence", (Catalog c) =>
        {
            var l = licences.Lic; var roh = licences.Roh;
            var t = c.InstanzTarif;
            var baeume = c.Read(tree => tree.PubTrees.Count());
            return Results.Ok(new
            {
                l.Plan, l.Holder, validUntil = roh.ValidUntil, l.EntriesWeek, l.EntriesMonth, l.CountFrom, l.AiTokensMonth, l.AiTokensDay,
                geprueft = licences.Geprueft, grund = licences.Grund, abgelaufen = roh.Abgelaufen, ort = licences.Ort,
                instanz = licences.InstanzId,
                // der Tarif: aus der Lizenz, der Test, und was für die ganze Instanz gilt
                tarif = new { key = l.Tarif.Key, label = l.Tarif.Label }, trial = roh.Trial == true, trialPlan = roh.Tarif.Label,
                instanzTarif = new { key = t.Key, label = t.Label, pubTrees = t.PubTrees == Tarife.Ohne ? (int?)null : t.PubTrees },
                pubTrees = baeume,
            });
        });

        // Einspielen: die Datei kommt so, wie sie ausgestellt wurde — Signatur inbegriffen
        api.MapPut("/licence", (Licence body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (body.EntriesWeek < 0 || body.EntriesMonth < 0 || body.AiTokensMonth < 0 || body.AiTokensDay < 0) return Bad("Grenzen: 0 oder mehr.");
            licences.Neu(body, actor);
            // Das Init Team trägt die Limits der Lizenz — es soll sie sofort haben und nicht erst nach einem Neustart.
            // LimitsAusLizenz setzt dabei auch den Zählbeginn und wirft den mitgeführten Stand weg.
            var uebernommen = c.With((_, _, _) => c.LimitsAusLizenz()) > 0;
            return Results.Ok(new { licences.Lic.Plan, licences.Lic.ValidUntil, geprueft = licences.Geprueft, grund = licences.Grund, uebernommen });
        });
    }
}
