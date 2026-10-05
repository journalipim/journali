using System.Net.Http.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Licensing;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Nutzungsberichte (05.10.2026): schaltet ein Administrator sie ein, meldet die Instanz einmal im Monat einen <see cref="Nutzungsbericht"/> an den
/// Lizenzserver — je Monat die Einträge nach Art (wie „▦ je Monat“ in ≡ Journal), die Version und eine zufällige Kennung. Aus ist die Voreinstellung.
/// Ein- und Ausschalten steht im Journal (Strom <see cref="Stream"/>), beim Einschalten mit dem Wortlaut <see cref="Text"/>; was gesendet würde,
/// zeigt <c>GET /api/usage/report</c> vorher.
/// </summary>
public static class NutzungsberichtApi
{
    public const string Stream = "report:usage";

    /// <summary>Der Wortlaut beim Einschalten — so steht er im Eintrag.</summary>
    public const string Text = "Einmal im Monat gehen an den Lizenzserver von journali: je Monat die Einträge nach Art, die Version und eine zufällige Kennung. "
        + "Keine Namen, keine Inhalte, keine Lizenzdaten. Der Lizenzserver sieht dabei die IP-Adresse dieses Servers.";

    /// <summary>Der letzte Stand aus dem Journal: an oder aus, die Kennung, seit wann und von wem.</summary>
    public static (bool An, string? Id, DateTimeOffset? Seit, string? Wer) Stand(IJournal journal)
    {
        var e = journal.ReadStream(Stream).LastOrDefault(x => x.Type == Types.UsageReportsSet);
        if (e is null) return (false, null, null, null);
        var p = Types.Deserialize<UsageReportsSet>(e.Payload);
        return (p.On, p.Id, e.At, e.Actor);
    }

    public static Nutzungsbericht Bericht(Catalog c, string id, string? version) =>
        new(id, version, c.ReadUsage(u => u.Months()).Select(m => new BerichtMonat(m.Month.ToString("yyyy-MM"), m.Kinds)).ToList());

    public static void Map(RouteGroupBuilder api, string? version)
    {
        api.MapGet("/usage/report", (Catalog c, IJournal journal) =>
        {
            var s = Stand(journal);
            return Results.Ok(new { on = s.An, since = s.Seit, by = s.Wer, report = Bericht(c, s.Id ?? new string('0', 32), version) });
        });
        api.MapPost("/usage/report", (HttpRequest req, Catalog c, IJournal journal) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var an = req.Query["on"] == "true";
            var s = Stand(journal);
            if (s.An == an) return Results.Ok(new { unchanged = true });
            // Die Kennung bleibt über Aus und wieder An dieselbe: der Lizenzserver ersetzt dann den Bericht, statt einen zweiten anzulegen
            var id = s.Id ?? Guid.NewGuid().ToString("N");
            return c.With((_, _, write) => Results.Ok(EntryView.Of(write(actor, Stream, Types.UsageReportsSet, new UsageReportsSet(an, id, an ? Text : ""), null))));
        });
    }

    /// <summary>
    /// Den Bericht senden, wenn er an ist und in diesem Monat noch nicht ging. Der Monat des letzten Versands steht in einer Datei beim Server, nicht im
    /// Journal: ein Versand ist Betrieb, kein Fakt der Daten. Null = nichts zu tun, sonst ein Satz für die Konsole.
    /// </summary>
    public static async Task<string?> SendenAsync(Catalog c, IJournal journal, HttpClient http, string adresse, string dataDir, string? version, DateOnly heute, CancellationToken ct = default)
    {
        var s = Stand(journal);
        if (!s.An || s.Id is null || adresse.Length == 0) return null;
        var datei = Path.Combine(dataDir, "nutzungsbericht.txt");
        var monat = heute.ToString("yyyy-MM");
        if (File.Exists(datei) && File.ReadAllText(datei).Trim() == monat) return null;
        using var antwort = await http.PostAsJsonAsync(adresse.TrimEnd('/') + "/v1/bericht", Bericht(c, s.Id, version), ct);
        if (!antwort.IsSuccessStatusCode) return $"usage report not accepted ({(int)antwort.StatusCode})";
        File.WriteAllText(datei, monat);
        return "usage report sent";
    }
}
