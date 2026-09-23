using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using System.Text.Json;
using System.Text.Json.Serialization;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Mailserver (Taloan, 23.09.2026: „was wir in den Settings noch brauchen, ist eine Mailserver-Konfiguration zum
/// Versenden von Mails“). Liegt als <c>mail.json</c> im Datenverzeichnis, neben <c>media.json</c> und
/// <c>auth.json</c> — nie im Journal, denn da steht ein Passwort drin.
/// <para>Gesendet wird mit MailKit — das zweite Paket im Server neben Npgsql (Taloan, 23.09.2026, auf den Hinweis, dass
/// implizites TLS auf 465 fehlte: „ich weiss zwar, was ich kann, aber nicht, was die anderen für Möglichkeiten
/// haben“). Damit gehen alle drei Wege: ohne Verschlüsselung (25), STARTTLS (587) und implizites TLS (465).</para>
/// </summary>
public sealed record MailConfig(
    string? Host = null,
    int Port = 587,
    /// <summary>Verschlüsselung: <c>starttls</c> (587), <c>ssl</c> (465, implizit), <c>none</c> (25).</summary>
    string Security = MailConfig.StartTlsMode,
    string? User = null,
    string? Password = null,
    string? From = null,          // Absenderadresse
    string? FromName = null,      // Anzeigename
    string? ReplyTo = null)
{
    public const string StartTlsMode = "starttls";
    public const string SslMode = "ssl";
    public const string NoneMode = "none";
    public static readonly string[] Modes = [StartTlsMode, SslMode, NoneMode];

    public bool Ready => !string.IsNullOrWhiteSpace(Host) && !string.IsNullOrWhiteSpace(From);
    public MailConfig Masked() => this with { Password = string.IsNullOrEmpty(Password) ? null : "••••••••" };
    /// <summary>Kurzform für Meldungen — ohne Geheimnis.</summary>
    public string Spec => Ready ? $"{Host}:{Port} ({Security}) als {From}" : "nicht eingerichtet";
    /// <summary>Was MailKit daraus macht. Unbekanntes wird STARTTLS — der übliche Fall.</summary>
    public SecureSocketOptions Socket => Security switch
    {
        SslMode => SecureSocketOptions.SslOnConnect,
        NoneMode => SecureSocketOptions.None,
        _ => SecureSocketOptions.StartTls,
    };
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
        if (c is not { Host: { Length: > 0 } host, From: { Length: > 0 } from }) return "Kein Mailserver eingerichtet (Einstellungen → Mail).";
        if (string.IsNullOrWhiteSpace(to)) return "Empfänger fehlt.";
        try
        {
            var mail = new MimeMessage();
            mail.From.Add(new MailboxAddress(string.IsNullOrWhiteSpace(c.FromName) ? from : c.FromName, from));
            mail.To.Add(MailboxAddress.Parse(to));
            if (!string.IsNullOrWhiteSpace(c.ReplyTo)) mail.ReplyTo.Add(MailboxAddress.Parse(c.ReplyTo));
            mail.Subject = subject;
            mail.Body = new TextPart(html ? "html" : "plain") { Text = body };

            using var client = new SmtpClient { Timeout = 20_000 };
            await client.ConnectAsync(host, c.Port, c.Socket, ct);
            if (!string.IsNullOrWhiteSpace(c.User)) await client.AuthenticateAsync(c.User, c.Password ?? "", ct);
            await client.SendAsync(mail, ct);
            await client.DisconnectAsync(true, ct);
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
            if (!MailConfig.Modes.Contains(c.Security)) return Bad($"Verschlüsselung: {string.Join(", ", MailConfig.Modes)}.");
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
