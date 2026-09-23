using System.Net;
using System.Net.Mail;
using System.Text.Json;
using System.Text.Json.Serialization;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Mailserver (Taloan, 23.09.2026: „was wir in den Settings noch brauchen, ist eine Mailserver-Konfiguration zum
/// Versenden von Mails“). Liegt als <c>mail.json</c> im Datenverzeichnis, neben <c>media.json</c> und
/// <c>auth.json</c> — nie im Journal, denn da steht ein Passwort drin.
/// <para>Gesendet wird mit dem, was .NET mitbringt (<see cref="SmtpClient"/>): Klartext auf 25, STARTTLS auf 587.
/// Implizites TLS auf 465 kann diese Klasse nicht — dafür bräuchte es ein Paket, und der Server hat nur Npgsql.</para>
/// </summary>
public sealed record MailConfig(
    string? Host = null,
    int Port = 587,
    bool StartTls = true,
    string? User = null,
    string? Password = null,
    string? From = null,          // Absenderadresse
    string? FromName = null,      // Anzeigename
    string? ReplyTo = null)
{
    public bool Ready => !string.IsNullOrWhiteSpace(Host) && !string.IsNullOrWhiteSpace(From);
    public MailConfig Masked() => this with { Password = string.IsNullOrEmpty(Password) ? null : "••••••••" };
    /// <summary>Kurzform für Meldungen — ohne Geheimnis.</summary>
    public string Spec => Ready ? $"{Host}:{Port}{(StartTls ? " (STARTTLS)" : "")} als {From}" : "nicht eingerichtet";
}

public static class MailConfigFile
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    public static string PathOf(string dir) => Path.Combine(dir, "mail.json");
    public static MailConfig Load(string dir)
    {
        try { return (File.Exists(PathOf(dir)) ? JsonSerializer.Deserialize<MailConfig>(File.ReadAllText(PathOf(dir)), Json) : null) ?? new MailConfig(); }
        catch { return new MailConfig(); }
    }
    public static void Save(string dir, MailConfig c) { Directory.CreateDirectory(dir); File.WriteAllText(PathOf(dir), JsonSerializer.Serialize(c, Json)); }
}

/// <summary>Der Versand — einer für alle, die Mail brauchen (Jobs, Workflows). Ohne Einstellung tut er nichts und sagt es.</summary>
public sealed class Mailer(string dataDir)
{
    private MailConfig _config = MailConfigFile.Load(dataDir);
    public MailConfig Config => _config;
    public void Set(MailConfig c) { _config = c; MailConfigFile.Save(dataDir, c); }

    /// <summary>Senden. Liefert null, wenn es ging, sonst die Fehlmeldung — nie eine Ausnahme nach aussen.</summary>
    public async Task<string?> SendAsync(string to, string subject, string body, bool html = false, CancellationToken ct = default)
    {
        var c = _config;
        if (!c.Ready) return "Kein Mailserver eingerichtet (Einstellungen → Mail).";
        if (string.IsNullOrWhiteSpace(to)) return "Empfänger fehlt.";
        try
        {
            using var client = new SmtpClient(c.Host, c.Port) { EnableSsl = c.StartTls, Timeout = 20_000 };
            if (!string.IsNullOrWhiteSpace(c.User)) client.Credentials = new NetworkCredential(c.User, c.Password);
            using var mail = new MailMessage
            {
                From = new MailAddress(c.From!, string.IsNullOrWhiteSpace(c.FromName) ? c.From! : c.FromName),
                Subject = subject,
                Body = body,
                IsBodyHtml = html,
            };
            mail.To.Add(to);
            if (!string.IsNullOrWhiteSpace(c.ReplyTo)) mail.ReplyToList.Add(c.ReplyTo);
            await client.SendMailAsync(mail, ct);
            return null;
        }
        catch (Exception e) { return e.InnerException?.Message ?? e.Message; }
    }
}

/// <summary>Einstellungen → Mail: lesen (ohne Passwort), speichern, eine Probe senden.</summary>
public static class MailApi
{
    public sealed record TestBody(string To);

    public static void Map(RouteGroupBuilder api, Mailer mailer)
    {
        api.MapGet("/mail", () => Results.Ok(new { config = mailer.Config.Masked(), ready = mailer.Config.Ready }));

        api.MapPut("/mail", (MailConfig body, HttpRequest req) =>
        {
            if (Actor(req) is null) return ActorMissing();
            // Ein maskiertes Passwort heisst „unverändert“ — sonst überschriebe das Speichern es mit Punkten
            var c = body with { Password = body.Password is null or "••••••••" ? mailer.Config.Password : body.Password };
            if (!string.IsNullOrWhiteSpace(c.Host) && c.Port is < 1 or > 65535) return Bad("Port: 1 bis 65535.");
            if (!string.IsNullOrWhiteSpace(c.From) && !c.From.Contains('@')) return Bad("Absender: eine Adresse erwartet.");
            mailer.Set(c);
            return Results.Ok(new { config = mailer.Config.Masked(), ready = mailer.Config.Ready });
        });

        api.MapPost("/mail/test", async (TestBody body, HttpRequest req, CancellationToken ct) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var fehler = await mailer.SendAsync(body.To, "journali PIM — Probe",
                $"Diese Nachricht kommt von {mailer.Config.Spec}.\nAusgelöst von {actor}.", html: false, ct);
            return fehler is null ? Results.Ok(new { sent = true, to = body.To }) : Bad(fehler);
        });
    }
}
