using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Einstellungen → ⧉ Server (pflegestruktur 41): welche Server auf diese Datenbank zugreifen, welcher Hauptserver ist, wer gesperrt ist.
/// Die Entscheidungen gehen ins Journal (<c>ServerMainSet</c>, <c>ServerBlockSet</c>), die Liste kommt aus der Tabelle <c>server</c>.
/// </summary>
public static class ServerApi
{
    public sealed record SperreBody(bool? Gesperrt);

    /// <summary>Ein Server in der Liste: aus der Tabelle, dazu was das Journal über ihn sagt. Server, die nur im Journal vorkommen, stehen ohne Puls darin.</summary>
    public static List<object> Liste(Verbund v, DateTimeOffset jetzt)
    {
        var main = v.Festgelegt(); var gesperrt = v.Gesperrte();
        var zeilen = v.Zeilen.ToList();
        var bekannt = zeilen.Select(z => z.Id).ToHashSet();
        var liste = zeilen.Select(z => (object)new
        {
            id = z.Id, host = z.Host, version = z.Version, built = z.Built, started = z.Started, puls = z.Puls, head = z.Head, import = z.Import, jobs = z.Jobs,
            erreichbar = Verbund.Erreichbar(z, jetzt), haupt = z.Id == main, gesperrt = gesperrt.Contains(z.Id), selbst = z.Id == v.Id,
        }).ToList();
        foreach (var id in gesperrt.Append(main).OfType<string>().Distinct().Where(id => !bekannt.Contains(id)))
            liste.Add(new { id, host = id, version = (string?)null, built = (DateTimeOffset?)null, started = (DateTimeOffset?)null, puls = (DateTimeOffset?)null, head = 0L, import = false, jobs = (object?)null,
                erreichbar = false, haupt = id == main, gesperrt = gesperrt.Contains(id), selbst = id == v.Id });
        return liste;
    }

    public static void Map(RouteGroupBuilder api, Verbund v)
    {
        api.MapGet("/server", () => Results.Ok(new { self = v.Id, main = v.Festgelegt(), haupt = v.IstHaupt, version = typeof(ServerApi).Assembly.GetName().Version?.ToString(3), server = Liste(v, DateTimeOffset.UtcNow) }));

        // Zum Hauptserver machen: nur einen erreichbaren, nicht gesperrten — sonst liefe kein Job mehr
        api.MapPut("/server/{id}/haupt", (string id, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (v.Zeilen.FirstOrDefault(z => z.Id == id) is not { } z) return Bad("Server {0} gibt es nicht.", id);
            if (!Verbund.Erreichbar(z, DateTimeOffset.UtcNow)) return Bad("Server {0} ist nicht erreichbar.", z.Host);
            if (v.Gesperrte().Contains(id)) return Bad("Server {0} ist gesperrt.", z.Host);
            if (v.Festgelegt() != id) c.With((_, _, write) => write(actor, Jobs.ServerStream + id, Types.ServerMainSet, new ServerMainSet(z.Host), null));
            return Results.Ok(new { main = id });
        });

        // Sperren und wieder freigeben. Nicht den Hauptserver (dann liefe kein Job) und nicht sich selbst (dann käme niemand mehr hierher zurück)
        api.MapPut("/server/{id}/sperre", (string id, SperreBody body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var sperren = body.Gesperrt ?? true;
            var host = v.Zeilen.FirstOrDefault(z => z.Id == id)?.Host ?? id;
            if (sperren && v.Festgelegt() == id) return Bad("Der Hauptserver lässt sich nicht sperren.");
            if (sperren && id == v.Id) return Bad("Ein Server sperrt sich nicht selbst.");
            if (v.Zeilen.All(z => z.Id != id) && !v.Gesperrte().Contains(id)) return Bad("Server {0} gibt es nicht.", id);
            if (v.Gesperrte().Contains(id) != sperren) c.With((_, _, write) => write(actor, Jobs.ServerStream + id, Types.ServerBlockSet, new ServerBlockSet(sperren), null));
            return Results.Ok(new { id, host, gesperrt = sperren });
        });

        // Aus der Liste entfernen: nur einen, der nicht erreichbar ist. Eine Sperre im Journal bleibt — kommt er wieder, ist er weiter gesperrt
        api.MapDelete("/server/{id}", (string id, HttpRequest req) =>
        {
            if (Actor(req) is null) return ActorMissing();
            if (v.Zeilen.FirstOrDefault(z => z.Id == id) is not { } z) return Bad("Server {0} gibt es nicht.", id);
            if (Verbund.Erreichbar(z, DateTimeOffset.UtcNow)) return Bad("Server {0} ist erreichbar.", z.Host);
            if (v.Festgelegt() == id) return Bad("Der Hauptserver bleibt in der Liste.");
            return v.Entfernen(id) ? Results.Ok(new { id }) : Bad("Server {0} ist erreichbar.", z.Host);
        });
    }
}
