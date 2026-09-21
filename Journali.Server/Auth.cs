using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using Journali.Core.Entries;
using Journali.Core.Projections;
using static Journali.Server.ModelApi;

namespace Journali.Server;

/// <summary>
/// Benutzer und Rollen (Taloan, 19.09.2026: Voraussetzung für Workflow-Zuständigkeiten und Hosting). Wer es gibt und welche Rolle
/// gilt, steht im Journal (Strom <c>user:&lt;key&gt;</c>, UserDefined/UserRetired — nachvollziehbar wie alles). Was geheim ist —
/// Passwort-Hashes, API-Token, Sitzungen — liegt in <c>auth.json</c> im Datenverzeichnis, nie im Journal (Regel wie bei
/// secrets.json). Solange kein Benutzer angelegt ist, bleibt der Server offen wie bisher (X-Actor frei) — der erste
/// Administrator wird unter /login angelegt (POST /api/auth/setup), danach ist alles unter /api ausser health und auth gesperrt.
/// Rollen: admin (alles), editor (Daten pflegen), reader (nur lesen). Jobs und Belegerzeuger bekommen je Lauf ein Dienst-Token.
/// </summary>
public static class Auth
{
    public const string Stream = "user:";
    /// <summary>Rechte einer Rolle aus dem Journal; das Dienst-Token der Jobs bekommt die Rolle editor — fehlt sie, das feste Minimum zum Pflegen.</summary>
    public static IReadOnlySet<string> RightsOf(Catalog c, string role) => role == "$service" ? ServiceRights : c.With((_, _, _) => c.Users.RightsOf(role));
    private static readonly HashSet<string> ServiceRights = [Rights.Read, Rights.Write, Rights.Retire, Rights.Release];
    /// <summary>Darf ein Benutzer mit dieser Rolle Benutzer verwalten? („Administrator“ heißt: das Recht users)</summary>
    public static bool IsAdmin(Catalog c, string role) => RightsOf(c, role).Contains(Rights.Users);
    private static int AdminsLeft(Catalog c) => c.With((_, _, _) => c.Users.All.Values.Count(u => u.Enabled && c.Users.RightsOf(u.Role).Contains(Rights.Users)));
    private const string Cookie = "journali.session";

    public sealed record LoginBody(string? User, string? Password);
    public sealed record SetupBody(string? User, string? Name, string? Password);
    public sealed record UserBody(string? Name, string? Email, string? Role, string? Password, bool? Enabled);
    public sealed record RoleBody(string? Label, string[]? Rights);
    public sealed record PasswordBody(string? Current, string? Password);
    public sealed record TokenBody(string? Label);

    // ---- Geheimnisse: auth.json ----
    private sealed class Store
    {
        public Dictionary<string, string> Passwords { get; set; } = new();           // user → pbkdf2$iter$salt$hash
        public Dictionary<string, TokenRec> Tokens { get; set; } = new();            // sha256(token) → { user, label, at }
        public Dictionary<string, SessionRec> Sessions { get; set; } = new();        // sha256(cookie) → { user, until }
    }
    public sealed record TokenRec(string User, string Label, DateTimeOffset At);
    public sealed record SessionRec(string User, DateTimeOffset Until);

    private static readonly object Gate = new();
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private static string File(string dir) => Path.Combine(dir, "auth.json");
    private static Store Load(string dir) { try { return System.IO.File.Exists(File(dir)) ? JsonSerializer.Deserialize<Store>(System.IO.File.ReadAllText(File(dir)), Json) ?? new() : new(); } catch { return new(); } }
    private static void Save(string dir, Store s) { Directory.CreateDirectory(dir); System.IO.File.WriteAllText(File(dir), JsonSerializer.Serialize(s, Json)); }
    private static T With<T>(string dir, Func<Store, T> f, bool save = false) { lock (Gate) { var s = Load(dir); var r = f(s); if (save) Save(dir, s); return r; } }

    // ---- Hashing (PBKDF2-SHA256, kein Paket) ----
    private static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16); const int iter = 210_000;
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, iter, HashAlgorithmName.SHA256, 32);
        return $"pbkdf2${iter}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }
    private static bool Verify(string password, string stored)
    {
        var p = stored.Split('$'); if (p.Length != 4 || p[0] != "pbkdf2") return false;
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, Convert.FromBase64String(p[2]), int.Parse(p[1]), HashAlgorithmName.SHA256, 32);
        return CryptographicOperations.FixedTimeEquals(hash, Convert.FromBase64String(p[3]));
    }
    private static string Sha(string s) => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(s))).ToLowerInvariant();
    private static string NewSecret() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).Replace('+', '-').Replace('/', '_').TrimEnd('=');

    // ---- Dienst-Token für Jobs und Belegerzeuger: nur im Speicher, gültig bis zum Ende des Laufs ----
    private static readonly ConcurrentDictionary<string, string> Service = new();   // token → actor
    public static string IssueServiceToken(string actor) { var t = "svc_" + NewSecret(); Service[t] = actor; return t; }
    public static void RevokeServiceToken(string token) => Service.TryRemove(token, out _);

    /// <summary>Gibt es Benutzer? Dann ist der Server gesperrt und X-Actor kommt aus der Sitzung.</summary>
    public static bool Enabled(Catalog c) => c.With((_, _, _) => c.Users.All.Values.Any(u => u.Enabled));

    /// <summary>Wer ruft? Sitzung (Cookie), API-Token oder Dienst-Token (Bearer). Null = niemand.</summary>
    public static (string User, string Role)? Resolve(HttpContext ctx, Catalog c, string dir)
    {
        var auth = ctx.Request.Headers.Authorization.ToString();
        if (auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var token = auth[7..].Trim();
            if (token.StartsWith("svc_") && Service.TryGetValue(token, out var actor)) return (actor, c.With((_, _, _) => c.Users.Roles.ContainsKey("editor")) ? "editor" : "$service");
            var rec = With(dir, s => s.Tokens.GetValueOrDefault(Sha(token)));
            if (rec is not null && c.With((_, _, _) => c.Users.All.GetValueOrDefault(rec.User)) is { Enabled: true } tu) return (tu.Key, tu.Role);
            return null;
        }
        if (ctx.Request.Cookies.TryGetValue(Cookie, out var cookie) && cookie is { Length: > 0 })
        {
            var sess = With(dir, s => s.Sessions.GetValueOrDefault(Sha(cookie)));
            if (sess is not null && sess.Until > DateTimeOffset.UtcNow && c.With((_, _, _) => c.Users.All.GetValueOrDefault(sess.User)) is { Enabled: true } su) return (su.Key, su.Role);
        }
        return null;
    }

    /// <summary>Welches Recht braucht diese Anfrage? Null = eigenes Konto, immer erlaubt. Die Rollen sagen dann, wer es hat (Taloan, 20.09.: Rollen sind Daten, Rechte sind Code).</summary>
    public static string? Needed(HttpRequest req)
    {
        var path = req.Path.Value ?? ""; var method = req.Method;
        var read = method is "GET" or "HEAD" or "OPTIONS";
        if (path.StartsWith("/api/auth/me") || path.StartsWith("/api/auth/logout") || path.StartsWith("/api/auth/password") || path.StartsWith("/api/auth/tokens")) return null;   // eigenes Konto
        if (path.StartsWith("/api/auth/rights")) return null;                                                                         // das Vokabular darf jeder lesen
        if (path.StartsWith("/api/auth/users") || path.StartsWith("/api/auth/roles")) return read && path.StartsWith("/api/auth/roles") ? Rights.Read : Rights.Users;
        if (path.StartsWith("/api/media/store") || path.StartsWith("/api/media/copy")) return Rights.Storage;
        if (path.StartsWith("/api/media/presets") && !read) return Rights.Model;   // Vorschau-Presets sind Modell
        if (path.StartsWith("/api/files")) return Rights.Jobs;   // Dateibrowser des Servers: Jobs — oder Storage (Allowed)
        if (path.StartsWith("/api/jobs")) return read && !path.Contains("/log") && !path.Contains("/runs") ? Rights.Read : Rights.Jobs;
        if (read) return Rights.Read;
        if (path.StartsWith("/api/model/lists/") && (path.Contains("/values/") || path.EndsWith("/values")) && method == "PUT") return Rights.Write;   // Listenwert(e) zufügen ist Pflege (Taloan, 20.09.: ad hoc wie in Excel)
        if (path.StartsWith("/api/model")) return Rights.Model;
        if (path.StartsWith("/api/workflows/") && method is "PUT" or "DELETE") return Rights.Model;   // Workflow definieren = Modell; Schritte sind Schreiben
        if (path.StartsWith("/api/plugins") && path.Contains("/secrets/")) return Rights.Write;   // Token am Profil: wer importiert, hinterlegt ihn (der Wert bleibt beim Server)
        if (path.StartsWith("/api/plugins") && !path.Contains("/data/") && !path.EndsWith("/data") && !path.EndsWith("/run")) return Rights.Plugins;   // Plugin-Daten (auch der Sammel-PUT …/data) sind Pflege
        if (path.Contains("/retire") || path.Contains("/restore") || path.Contains("/undo") || (method == "DELETE" && path.StartsWith("/api/nodes/") && path.Count(ch => ch == '/') == 3)) return Rights.Retire;
        if (path.Contains("/release") || path.StartsWith("/api/versions") || path.Contains("/versions")) return Rights.Release;
        return Rights.Write;
    }
    public static bool Allowed(Catalog c, string role, HttpRequest req) => Needed(req) is not { } need || RightsOf(c, role).Contains(need)
        || (req.Path.StartsWithSegments("/api/files") && RightsOf(c, role).Contains(Rights.Storage));   // der Dateibrowser dient auch dem Medienspeicher
    /// <summary>Hat der Anfragende dieses Recht? Ohne Benutzer (offen) ja; sonst die Rolle aus der Sitzung (Middleware legt sie in Items).</summary>
    public static bool Has(HttpRequest req, Catalog c, string right) => !Enabled(c) || (req.HttpContext.Items["role"] is string role && RightsOf(c, role).Contains(right));

    /// <summary>Die Sperre: vor allem unter /api. Ohne Benutzer offen (X-Actor wie bisher); sonst Sitzung/Token nötig, X-Actor wird gesetzt.</summary>
    public static Func<HttpContext, Func<Task>, Task> Middleware(Catalog c, string dir) => async (ctx, next) =>
    {
        var path = ctx.Request.Path.Value ?? "";
        if (!path.StartsWith("/api") || path.StartsWith("/api/health") || path.StartsWith("/api/auth/login") || path.StartsWith("/api/auth/setup") || path.StartsWith("/api/auth/state")) { await next(); return; }
        if (!Enabled(c)) { await next(); return; }   // noch kein Benutzer: offen
        var who = Resolve(ctx, c, dir);
        if (who is null) { ctx.Response.StatusCode = 401; await ctx.Response.WriteAsJsonAsync(new { error = "Anmeldung nötig.", login = true }); return; }
        if (!Allowed(c, who.Value.Role, ctx.Request)) { ctx.Response.StatusCode = 403; await ctx.Response.WriteAsJsonAsync(new { error = $"Rolle {who.Value.Role} darf das nicht ({Rights.Label.GetValueOrDefault(Needed(ctx.Request) ?? "") ?? Needed(ctx.Request)})." }); return; }
        ctx.Request.Headers["X-Actor"] = who.Value.User;   // der Urheber kommt aus der Sitzung, nicht vom Client
        ctx.Items["user"] = who.Value.User; ctx.Items["role"] = who.Value.Role;
        await next();
    };

    /// <summary>
    /// Ausgesperrt (Taloan, 21.09.2026: Benutzer im Journal, aber kein auth.json im Datenverzeichnis dieses Rechners — „Benutzer
    /// oder Passwort falsch“ bei jedem Versuch): mit JOURNALI_ADMIN_PASSWORD in der Umgebung setzt der Start das Passwort von
    /// <paramref name="user"/> (Vorgabe admin) neu und legt den Benutzer an, wenn es ihn nicht gibt. Wer die Umgebung des Servers
    /// setzen kann, hat ohnehin Zugriff auf auth.json. Danach die Variable wieder entfernen.
    /// </summary>
    public static string? Recover(Catalog c, string dir, string? password, string? user = null)
    {
        if (string.IsNullOrWhiteSpace(password)) return null;
        var key = Key(user) ?? "admin";
        if (password.Trim().Length < 8) return $"JOURNALI_ADMIN_PASSWORD: mindestens 8 Zeichen — nichts geändert.";
        var exists = c.With((_, _, _) => c.Users.All.ContainsKey(key));
        if (!exists) c.With((_, _, write) => write("system", Stream + key, Types.UserDefined, new UserDefined(key, null, "admin", true), null));
        With(dir, s => { s.Passwords[key] = Hash(password.Trim()); return 0; }, save: true);
        return $"Passwort von {key} aus JOURNALI_ADMIN_PASSWORD gesetzt{(exists ? "" : " (Benutzer angelegt, Rolle admin)")} — Variable jetzt wieder entfernen.";
    }

    public static void Map(RouteGroupBuilder api, string dir)
    {
        // Zustand: gesperrt? wer bin ich?
        api.MapGet("/auth/state", (HttpContext ctx, Catalog c) =>
        {
            var enabled = Enabled(c); var who = enabled ? Resolve(ctx, c, dir) : null;
            return Results.Ok(new { enabled, setup = !enabled, user = who?.User, role = who?.Role, rights = who is { } r ? RightsOf(c, r.Role).ToArray() : null, name = who is { } w ? c.With((_, _, _) => c.Users.All.GetValueOrDefault(w.User)?.Name) : null });
        });
        api.MapGet("/auth/me", (HttpContext ctx, Catalog c) =>
        {
            var who = Resolve(ctx, c, dir); if (who is null) return Results.Unauthorized();
            var u = c.With((_, _, _) => c.Users.All.GetValueOrDefault(who.Value.User));
            var tokens = With(dir, s => s.Tokens.Where(t => t.Value.User == who.Value.User).Select(t => new { id = t.Key[..12], t.Value.Label, t.Value.At }).ToList());
            return Results.Ok(new { user = who.Value.User, role = who.Value.Role, rights = RightsOf(c, who.Value.Role).ToArray(), name = u?.Name, email = u?.Email, tokens });
        });

        // Ersten Administrator anlegen — nur solange es keinen Benutzer gibt
        api.MapPost("/auth/setup", (SetupBody body, HttpContext ctx, Catalog c) =>
        {
            if (Enabled(c)) return Bad("Es gibt schon Benutzer — bitte anmelden.");
            var key = Key(body.User); if (key is null) return Bad("Benutzername: a-z, 0-9, ., _, - (2–40 Zeichen).");
            if (Blank(body.Password) is not { Length: >= 8 } pw) return Bad("Passwort: mindestens 8 Zeichen.");
            c.With((_, _, write) => write(key, Stream + key, Types.UserDefined, new UserDefined(Blank(body.Name) ?? key, null, "admin", true), null));
            With(dir, s => { s.Passwords[key] = Hash(pw); return 0; }, save: true);
            StartSession(ctx, dir, key);
            return Results.Ok(new { user = key, role = "admin" });
        });

        api.MapPost("/auth/login", (LoginBody body, HttpContext ctx, Catalog c) =>
        {
            var key = Key(body.User); var pw = body.Password ?? "";
            var u = key is null ? null : c.With((_, _, _) => c.Users.All.GetValueOrDefault(key));
            var stored = key is null ? null : With(dir, s => s.Passwords.GetValueOrDefault(key));
            if (u is null || !u.Enabled || stored is null || !Verify(pw, stored)) { Thread.Sleep(300); return Results.Json(new { error = "Benutzer oder Passwort falsch." }, statusCode: 401); }
            StartSession(ctx, dir, key!);
            return Results.Ok(new { user = key, role = u.Role, name = u.Name });
        });
        api.MapPost("/auth/logout", (HttpContext ctx) =>
        {
            if (ctx.Request.Cookies.TryGetValue(Cookie, out var cookie)) With(dir, s => s.Sessions.Remove(Sha(cookie)), save: true);
            ctx.Response.Cookies.Delete(Cookie, new CookieOptions { Path = "/" });
            return Results.Ok(new { ok = true });
        });

        // eigenes Konto: Passwort, API-Token (für Excel-Add-in, OnlyOffice, Skripte)
        api.MapPost("/auth/password", (PasswordBody body, HttpContext ctx, Catalog c) =>
        {
            var who = Resolve(ctx, c, dir); if (who is null) return Results.Unauthorized();
            var stored = With(dir, s => s.Passwords.GetValueOrDefault(who.Value.User));
            if (stored is null || !Verify(body.Current ?? "", stored)) return Bad("Aktuelles Passwort falsch.");
            if (Blank(body.Password) is not { Length: >= 8 } pw) return Bad("Passwort: mindestens 8 Zeichen.");
            With(dir, s => { s.Passwords[who.Value.User] = Hash(pw); return 0; }, save: true);
            return Results.Ok(new { ok = true });
        });
        api.MapPost("/auth/tokens", (TokenBody body, HttpContext ctx, Catalog c) =>
        {
            var who = Resolve(ctx, c, dir); if (who is null) return Results.Unauthorized();
            var token = "jt_" + NewSecret();
            With(dir, s => { s.Tokens[Sha(token)] = new TokenRec(who.Value.User, Blank(body.Label) ?? "Token", DateTimeOffset.UtcNow); return 0; }, save: true);
            return Results.Ok(new { token, label = Blank(body.Label) ?? "Token", hint = "Nur jetzt sichtbar — als Authorization: Bearer <token> senden." });
        });
        api.MapDelete("/auth/tokens/{id}", (string id, HttpContext ctx, Catalog c) =>
        {
            var who = Resolve(ctx, c, dir); if (who is null) return Results.Unauthorized();
            var n = With(dir, s => { var keys = s.Tokens.Where(t => t.Key.StartsWith(id) && t.Value.User == who.Value.User).Select(t => t.Key).ToList(); foreach (var k in keys) s.Tokens.Remove(k); return keys.Count; }, save: true);
            return n > 0 ? Results.Ok(new { removed = n }) : Results.NotFound();
        });

        // Verwaltung (admin): Liste, anlegen/ändern, Passwort setzen, sperren, entfernen
        api.MapGet("/auth/users", (Catalog c) => Results.Ok(c.With((_, _, _) => c.Users.All.Values.OrderBy(u => u.Key).Select(u => new { u.Key, u.Name, u.Email, u.Role, u.Enabled, u.LastAt, u.LastActor, hasPassword = With(dir, s => s.Passwords.ContainsKey(u.Key)) }).ToList())));
        api.MapPut("/auth/users/{key}", (string key, UserBody body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var k = Key(key); if (k is null) return Bad("Benutzername: a-z, 0-9, ., _, - (2–40 Zeichen).");
            var cur = c.With((_, _, _) => c.Users.All.GetValueOrDefault(k));
            var roles = c.With((_, _, _) => c.Users.Roles.Keys.Order().ToList());
            var role = Blank(body.Role) ?? cur?.Role ?? (roles.Contains("editor") ? "editor" : roles.FirstOrDefault(r => r != "admin") ?? "admin"); if (!roles.Contains(role)) return Bad($"Rolle: {string.Join(", ", roles)}");
            var enabled = body.Enabled ?? cur?.Enabled ?? true;
            if (cur is not null && cur.Enabled && IsAdmin(c, cur.Role) && (!IsAdmin(c, role) || !enabled) && AdminsLeft(c) <= 1) return Bad("Der letzte Administrator (Recht „Benutzer und Rollen“) bleibt.");
            c.With((_, _, write) => write(actor, Stream + k, Types.UserDefined, new UserDefined(Blank(body.Name) ?? cur?.Name ?? k, Blank(body.Email) ?? cur?.Email, role, enabled), null));
            if (Blank(body.Password) is { } pw) { if (pw.Length < 8) return Bad("Passwort: mindestens 8 Zeichen."); With(dir, s => { s.Passwords[k] = Hash(pw); return 0; }, save: true); }
            return Results.Ok(c.With((_, _, _) => c.Users.All[k]));
        });
        // Rollen (Taloan, 20.09.): Namen und Rechte bestimmt der Anwender; das Vokabular der Rechte ist Code
        api.MapGet("/auth/rights", () => Results.Ok(Rights.All.Select(r => new { key = r, label = Rights.Label[r] }).ToList()));
        api.MapGet("/auth/roles", (Catalog c) => Results.Ok(c.With((_, _, _) => c.Users.Roles.Values.OrderBy(r => r.Key).Select(r => new { r.Key, r.Label, rights = r.Rights.Order().ToArray(), users = c.Users.All.Values.Count(u => u.Role == r.Key), r.LastAt, r.LastActor }).ToList())));
        api.MapPut("/auth/roles/{key}", (string key, RoleBody body, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var k = Key(key); if (k is null) return Bad("Rollenschlüssel: a-z, 0-9, ., _, - (2–40 Zeichen).");
            var cur = c.With((_, _, _) => c.Users.Roles.GetValueOrDefault(k));
            var rights = (body.Rights ?? cur?.Rights.ToArray() ?? []).Where(Rights.All.Contains).Distinct().ToArray();
            if (rights.Length > 0 && !rights.Contains(Rights.Read)) rights = [Rights.Read, .. rights];   // ohne Lesen geht nichts
            // das Recht users darf nicht aus der letzten Rolle verschwinden, die ein aktiver Benutzer hat
            if (cur is not null && cur.Rights.Contains(Rights.Users) && !rights.Contains(Rights.Users) && c.With((_, _, _) => c.Users.All.Values.Count(u => u.Enabled && u.Role != k && c.Users.RightsOf(u.Role).Contains(Rights.Users))) == 0) return Bad("Damit hätte kein aktiver Benutzer mehr das Recht „Benutzer und Rollen“.");
            c.With((_, _, write) => write(actor, Users.RoleStream + k, Types.RoleDefined, new RoleDefined(Blank(body.Label) ?? cur?.Label ?? k, rights), null));
            return Results.Ok(c.With((_, _, _) => c.Users.Roles[k]));
        });
        api.MapDelete("/auth/roles/{key}", (string key, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var cur = c.With((_, _, _) => c.Users.Roles.GetValueOrDefault(key)); if (cur is null) return Results.NotFound();
            var used = c.With((_, _, _) => c.Users.All.Values.Count(u => u.Role == key)); if (used > 0) return Bad($"{key} hat noch {used} Benutzer.");
            if (key == "admin") return Bad("admin bleibt.");
            c.With((_, _, write) => write(actor, Users.RoleStream + key, Types.RoleRetired, new RoleRetired(), null));
            return Results.Ok(new { ok = true });
        });
        api.MapDelete("/auth/users/{key}", (string key, HttpRequest req, Catalog c) =>
        {
            if (Actor(req) is not { } actor) return ActorMissing();
            var cur = c.With((_, _, _) => c.Users.All.GetValueOrDefault(key)); if (cur is null) return Results.NotFound();
            if (cur.Enabled && IsAdmin(c, cur.Role) && AdminsLeft(c) <= 1) return Bad("Der letzte Administrator (Recht „Benutzer und Rollen“) bleibt.");
            c.With((_, _, write) => write(actor, Stream + key, Types.UserRetired, new UserRetired(), null));
            With(dir, s => { s.Passwords.Remove(key); foreach (var t in s.Tokens.Where(t => t.Value.User == key).Select(t => t.Key).ToList()) s.Tokens.Remove(t); foreach (var t in s.Sessions.Where(t => t.Value.User == key).Select(t => t.Key).ToList()) s.Sessions.Remove(t); return 0; }, save: true);
            return Results.Ok(new { ok = true });
        });
    }

    private static void StartSession(HttpContext ctx, string dir, string user)
    {
        var cookie = NewSecret(); var until = DateTimeOffset.UtcNow.AddDays(30);
        With(dir, s => { foreach (var k in s.Sessions.Where(x => x.Value.Until < DateTimeOffset.UtcNow).Select(x => x.Key).ToList()) s.Sessions.Remove(k); s.Sessions[Sha(cookie)] = new SessionRec(user, until); return 0; }, save: true);
        ctx.Response.Cookies.Append(Cookie, cookie, new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Lax, Secure = ctx.Request.IsHttps, Path = "/", Expires = until });
    }

    private static string? Key(string? s) => Blank(s)?.ToLowerInvariant() is { Length: >= 2 and <= 40 } k && k.All(ch => char.IsAsciiLetterOrDigit(ch) || ch is '.' or '_' or '-') ? k : null;
}
