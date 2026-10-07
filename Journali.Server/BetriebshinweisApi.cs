using Journali.Core.Entries;
using Journali.Core.Journal;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Hinweise zum Betrieb (05.10.2026): einmal je Instanz und Version zur Kenntnis genommen — von jemandem, der die Instanz verwaltet (Recht users).
/// Die Bestätigung steht mit Version und Wortlaut im Journal (Strom <see cref="Stream"/>); im Streitfall belegt sie, dass die Hinweise bekannt waren.
/// Ändert sich der Wortlaut, bekommt er eine neue <see cref="Version"/> und wird wieder gefragt.
/// </summary>
public static class BetriebshinweisApi
{
    public const string Stream = "notice:betrieb";
    public const string Version = "2026-10-07.3";

    /// <summary>
    /// Testversion (07.10.2026): alles, was derzeit herausgegeben wird, ist eine Testversion — die Aussagen auf journali.de beziehen sich auf das
    /// produktive Release. Solange das gilt, zeigt die Oberfläche oben „Testversion“ (ein Klick zeigt <see cref="Testhinweis"/>, auch ohne
    /// Anmeldung über /api/testversion), und der Testhinweis steht vorn in den Hinweisen zum Betrieb.
    /// </summary>
    public const bool Testversion = true;

    public static readonly Dictionary<string, string> TestTitel = new() { ["de"] = "Testversion", ["en"] = "Test version" };
    public static readonly Dictionary<string, string>[] Testhinweis =
    [
        new() { ["de"] = "Diese Software befindet sich in der Entwicklung (Alpha/Beta) und wird ausschließlich zu Test- und Evaluationszwecken bereitgestellt. Sie ist ausdrücklich nicht für den Produktiveinsatz oder kritische Systemumgebungen geeignet.",
                ["en"] = "This software is under development (alpha/beta) and is provided solely for testing and evaluation purposes. It is expressly not suitable for production use or critical system environments." },
        new() { ["de"] = "Die Nutzung erfolgt auf eigene Gefahr.",
                ["en"] = "Use is at your own risk." },
    ];

    public static readonly Dictionary<string, string> Titel = new() { ["de"] = "Hinweise zum Betrieb", ["en"] = "Notes on operation" };
    /// <summary>Die Punkte, die bestätigt werden: in einer Testversion zuerst der Testhinweis.</summary>
    public static Dictionary<string, string>[] Punkte => Testversion ? [.. Testhinweis, .. Grundpunkte] : Grundpunkte;

    static readonly Dictionary<string, string>[] Grundpunkte =
    [
        new() { ["de"] = "Sicherung, Aufbewahrung und die Probe der Wiederherstellung liegen beim Betreiber.",
                ["en"] = "Backup, retention and testing the restore are the operator's responsibility." },
    ];

    /// <summary>Der Wortlaut, so wie er im Eintrag steht: Titel und Punkte auf Deutsch, je eine Zeile.</summary>
    public static string Text => string.Join("\n", new[] { Titel["de"] }.Concat(Punkte.Select(p => p["de"])));

    /// <summary>Die zuletzt bestätigte Version — mit wann und wer; null, solange niemand bestätigt hat.</summary>
    public static (string Version, DateTimeOffset At, string Wer)? Bestaetigt(IJournal journal) =>
        journal.ReadStream(Stream).LastOrDefault(e => e.Type == Types.NoticeAcknowledged) is { } e
            ? (Types.Deserialize<NoticeAcknowledged>(e.Payload).Version, e.At, e.Actor) : null;

    public static void Map(RouteGroupBuilder api)
    {
        api.MapGet("/notice", (IJournal journal) =>
        {
            var b = Bestaetigt(journal);
            return Results.Ok(new { version = Version, title = Titel, points = Punkte, acknowledged = b?.Version, at = b?.At, by = b?.Wer });
        });
        // ohne Sitzung zu haben (Auth.ApiOhneSitzung), wie Version und Bau: das rote Feld steht auch vor der Anmeldung
        api.MapGet("/testversion", () => Results.Ok(new { test = Testversion, demo = Demo.An, title = TestTitel, points = Demo.An ? [.. Testhinweis, Demo.Hinweis] : Testhinweis }));
        api.MapPost("/notice/acknowledge", (HttpRequest req, Catalog c, IJournal journal) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (req.Query["version"] != Version) return Bad("Die Hinweise zum Betrieb in Version {0} sind nicht bestätigt.", Version);
            if (Bestaetigt(journal)?.Version == Version) return Results.Ok(new { unchanged = true });
            return c.With((_, _, write) => Results.Ok(EntryView.Of(write(actor, Stream, Types.NoticeAcknowledged, new NoticeAcknowledged(Version, Text), null))));
        });
    }
}
