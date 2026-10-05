using Journali.Core.Entries;
using Journali.Core.Journal;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Hinweise zum Betrieb (05.10.2026): einmal je Anlage und Version zur Kenntnis genommen — von jemandem, der die Anlage verwaltet (Recht users).
/// Die Bestätigung steht mit Version und Wortlaut im Journal (Strom <see cref="Stream"/>); im Streitfall belegt sie, dass die Hinweise bekannt waren.
/// Ändert sich der Wortlaut, bekommt er eine neue <see cref="Version"/> und wird wieder gefragt.
/// </summary>
public static class BetriebshinweisApi
{
    public const string Stream = "notice:betrieb";
    public const string Version = "2026-10-05";

    public static readonly Dictionary<string, string> Titel = new() { ["de"] = "Hinweise zum Betrieb", ["en"] = "Notes on operation" };
    public static readonly Dictionary<string, string>[] Punkte =
    [
        new() { ["de"] = "journali wird kostenlos und ohne Gewähr bereitgestellt; es gilt die Lizenz (LICENSE).",
                ["en"] = "journali is provided free of charge and without warranty; the license (LICENSE) applies." },
        new() { ["de"] = "Sicherung, Aufbewahrung und die Probe der Wiederherstellung liegen beim Betreiber.",
                ["en"] = "Backup, retention and testing the restore are the operator's responsibility." },
        new() { ["de"] = "journali ist für Unternehmen bestimmt, nicht für Verbraucher.",
                ["en"] = "journali is intended for businesses, not for consumers." },
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
        api.MapPost("/notice/acknowledge", (HttpRequest req, Catalog c, IJournal journal) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            if (req.Query["version"] != Version) return Bad("Die Hinweise zum Betrieb in Version {0} sind nicht bestätigt.", Version);
            if (Bestaetigt(journal)?.Version == Version) return Results.Ok(new { unchanged = true });
            return c.With((_, _, write) => Results.Ok(EntryView.Of(write(actor, Stream, Types.NoticeAcknowledged, new NoticeAcknowledged(Version, Text), null))));
        });
    }
}
