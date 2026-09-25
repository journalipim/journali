using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Zugänge (Treiber). Ein Plugin fragt nicht mehr selbst nach Adresse und Passwort, sondern nach einem <b>Zugang</b>
/// seiner Art: „gib mir die Zugänge vom Typ mysql“. Eingerichtet werden sie einmal unter ⌁ Plugins → Zugänge.
/// <para><b>Zwei Sorten.</b> Ein Zugang, der <i>Dateien liefert</i> (<c>file</c>, später ftp, webdav), kann auflisten
/// und bekommt einen Browser — dafür sind <see cref="Files"/> und die Verzeichnisbefehle. Ein Zugang, der nur
/// <i>Anmeldung</i> ist (mysql, solr, ixp), hat keine Verzeichnisse: der Treiber hält seine Felder bereit und reicht
/// sie an das Plugin weiter, das damit umzugehen weiss. <b>Der Treiber ist keine Schicht über Datenbanken</b> — er
/// kennt kein SQL und keinen Index (25.09.2026).</para>
/// <para><b>Wo was liegt:</b> die Felder ohne Geheimnis als Plugin-Daten im Journal (<c>plugin:driver</c>, Name
/// <c>zugang:&lt;key&gt;</c>), das Geheimnis über <see cref="Secrets"/> beim Server — nie im Journal, denn dort
/// lässt sich nichts löschen. <b>Ein Geheimnis geht nur an einen Prozess</b>, nie an die Oberfläche: der JobRunner
/// reicht es als <c>JOURNALI_*</c> an den Kindprozess; der Browser bekommt allenfalls den Namen des Zugangs.</para>
/// </summary>
public static class DriverApi
{
    /// <summary>Der eingebaute Zugang: das Dateisystem des Servers. Immer da, ohne Einrichtung, ohne Geheimnis.</summary>
    public const string Lokal = "lokal";

    /// <summary>Eine Art von Zugang und ihre Felder. <c>Dateien</c> sagt, ob der Zugang auflisten kann.</summary>
    public sealed record Art(string Key, string Label, bool Dateien, string[] Felder, string[] Geheim);

    /// <summary>
    /// Was es gibt. <b>Nur was wirklich trägt</b> — eine Art, die noch nicht umgesetzt ist, steht hier nicht:
    /// angeboten wird nichts, was beim Anklicken „ist noch nicht gebaut“ antwortet (25.09.2026).
    /// <para>Vorgesehen, sobald der jeweilige Treiber steht: <c>ftp</c> und <c>webdav</c> (liefern Dateien),
    /// <c>mysql</c>, <c>solr</c> und <c>ixp</c> (nur Anmeldung). Für die letzten beiden gibt es die Plugins schon,
    /// sie führen ihren Zugang aber noch selbst.</para>
    /// </summary>
    public static readonly IReadOnlyList<Art> Arten =
    [
        new("file", "Dateisystem des Servers", true, [], []),
    ];

    public static Art? ArtVon(string? key) => Arten.FirstOrDefault(a => a.Key == key);

    /// <summary>Ein eingerichteter Zugang, wie er im Journal steht (ohne Geheimnis).</summary>
    public sealed record Zugang(string Key, string Art, string Label, Dictionary<string, string> Felder);

    /// <summary>Was die Oberfläche schickt. <c>Geheim</c> geht nur hinein — zurück kommen nur die Namen.</summary>
    public sealed record ZugangBody(string? Art, string? Label, Dictionary<string, string>? Felder, Dictionary<string, string?>? Geheim);

    private const string Plugin = "driver";
    private const string Praefix = "zugang:";

    public static void Map(RouteGroupBuilder api, string dataDir, IHostEnvironment env, string jobsDir)
    {
        // Welche Arten es gibt — die Oberfläche baut daraus das Formular je Zugang
        api.MapGet("/drivers/arten", () => Results.Ok(Arten.Select(a => new { a.Key, a.Label, a.Dateien, a.Felder, a.Geheim })));

        // Die eingerichteten Zugänge. Mit ?art=mysql fragt ein Plugin nur die seiner Art;
        // mit ?dateien=true nur die, die auflisten können
        api.MapGet("/drivers", (Catalog c, string? art, bool dateien = false) =>
        {
            var alle = Alle(c).Where(z => art is not { Length: > 0 } || z.Art == art)
                .Where(z => !dateien || (ArtVon(z.Art)?.Dateien ?? false))
                .Select(z => new
                {
                    z.Key, z.Art, z.Label, z.Felder,
                    dateien = ArtVon(z.Art)?.Dateien ?? false,
                    geheim = Secrets.Get(jobsDir, Secrets.ProfileKey(Plugin, z.Key)).Keys.Order().ToList(),   // nur die Namen
                });
            return Results.Ok(alle);
        });

        // Einrichten und ändern. Die offenen Felder gehen ins Journal, das Geheimnis in den Tresor beim Server —
        // nie ins Journal, denn dort lässt sich nichts löschen. Ein Geheimnis kommt von hier nie zurück
        api.MapPut("/drivers/{zugang}", (string zugang, ZugangBody body, HttpRequest req, Catalog c) =>
        {
            if (ModelApi.Actor(req) is not { } actor) return ModelApi.ActorMissing();
            if (zugang == Lokal) return Bad("Der Zugang {0} ist eingebaut und lässt sich nicht ändern.", Lokal);
            if (FileApi.Name(zugang) is null) return Bad("Name des Zugangs: ohne Trennzeichen, nicht leer.");
            if (ArtVon(body.Art) is not { } art) return Bad("Art {0} gibt es nicht.", body.Art ?? "");
            var felder = new Dictionary<string, string>();
            foreach (var f in art.Felder) if (body.Felder?.GetValueOrDefault(f) is { Length: > 0 } v) felder[f] = v.Trim();
            var z = new Zugang(zugang, art.Key, body.Label is { Length: > 0 } l ? l.Trim() : zugang, felder);
            var json = JsonSerializer.Serialize(z, Json);
            var eintrag = c.With((_, _, write) => write(actor, Plugins.Stream + Plugin, Types.PluginDataSet, new PluginDataSet(Praefix + zugang, json), null));
            // Geheimnisse: nur die, die die Art kennt, und nur wenn etwas mitkam — leer lassen behält das alte
            if (body.Geheim is { Count: > 0 })
            {
                var neu = art.Geheim.Where(g => body.Geheim.ContainsKey(g)).ToDictionary(g => g, g => body.Geheim[g]);
                if (neu.Count > 0) Secrets.Set(jobsDir, Secrets.ProfileKey(Plugin, zugang), neu);
            }
            return Results.Ok(new { z.Key, z.Art, z.Label, geheim = Secrets.Get(jobsDir, Secrets.ProfileKey(Plugin, zugang)).Keys.Order(), nummer = eintrag.Number });
        });

        api.MapDelete("/drivers/{zugang}", (string zugang, HttpRequest req, Catalog c) =>
        {
            if (ModelApi.Actor(req) is not { } actor) return ModelApi.ActorMissing();
            if (zugang == Lokal) return Bad("Der Zugang {0} ist eingebaut.", Lokal);
            c.With((_, _, write) => write(actor, Plugins.Stream + Plugin, Types.PluginDataSet, new PluginDataSet(Praefix + zugang, null), null));
            foreach (var a in Arten) Secrets.Set(jobsDir, Secrets.ProfileKey(Plugin, zugang), a.Geheim.ToDictionary(g => g, _ => (string?)null));
            return Results.Ok(new { entfernt = zugang });
        });

        // Auflisten — nur bei einem Zugang, der Dateien liefert
        api.MapGet("/drivers/{zugang}/files", (string zugang, Catalog c, string? path) =>
            MitDatei(c, zugang, out var fehler) is { } z
                ? FileApi.Files(dataDir, env.ContentRootPath, path) : fehler);

        api.MapPost("/drivers/{zugang}/dir", (string zugang, FileApi.NeuBody body, HttpRequest req, Catalog c) =>
            MitDatei(c, zugang, out var fehler) is { } z
                ? FileApi.NeuesVerzeichnis(body, req) : fehler);

        api.MapPut("/drivers/{zugang}/dir", (string zugang, FileApi.UmbenennenBody body, HttpRequest req, Catalog c) =>
            MitDatei(c, zugang, out var fehler) is { } z
                ? FileApi.VerzeichnisUmbenennen(body, req) : fehler);
    }

    /// <summary>Alle Zugänge: der eingebaute zuerst, dann die eingerichteten aus dem Journal.</summary>
    public static List<Zugang> Alle(Catalog c)
    {
        var aus = new List<Zugang> { new(Lokal, "file", "⌂ Dieser Server", new()) };
        foreach (var (name, json) in Daten(c))
        {
            if (!name.StartsWith(Praefix)) continue;
            try
            {
                var z = JsonSerializer.Deserialize<Zugang>(json, Json);
                if (z is not null && z.Key != Lokal) aus.Add(z with { Key = name[Praefix.Length..] });
            }
            catch (JsonException) { /* ein unlesbarer Eintrag darf die Liste nicht sprengen */ }
        }
        return aus;
    }

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static IEnumerable<(string Name, string Json)> Daten(Catalog c) =>
        c.With((_, _, _) => c.Plugins.All.TryGetValue(Plugin, out var p)
            ? p.Data.Select(kv => (kv.Key, kv.Value)).ToList() : []);

    /// <summary>Den Zugang holen und prüfen, dass er Dateien liefert. Sonst steht der Grund in <paramref name="fehler"/>.</summary>
    private static Zugang? MitDatei(Catalog c, string zugang, out IResult fehler)
    {
        var z = Alle(c).FirstOrDefault(x => x.Key == zugang);
        if (z is null) { fehler = Bad("Zugang {0} gibt es nicht.", zugang); return null; }
        if (!(ArtVon(z.Art)?.Dateien ?? false)) { fehler = Bad("Zugang {0} liefert keine Dateien — {1} ist eine Anmeldung.", zugang, z.Art); return null; }
        fehler = Results.Empty;
        return z;
    }

    private static IResult Bad(string vorlage, params object[] werte) => ModelApi.Bad(vorlage, werte);
}
