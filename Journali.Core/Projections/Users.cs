using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>Ein Benutzer: Anzeigename, E-Mail, Rolle (admin | editor | reader), an/aus. Geheimnisse (Passwort, Token) stehen nie hier.</summary>
public sealed class UserState
{
    public required string Key { get; init; }
    public string Name { get; set; } = "";
    public string? Email { get; set; }
    public string Role { get; set; } = "editor";
    public bool Enabled { get; set; } = true;
    /// <summary>Team (Taloan, 23.09.2026): wessen KI-Schlüssel gelten und auf wessen Rechnung es läuft. Null = kein Team, keine KI über den Server.</summary>
    public string? Team { get; set; }
    public long LastNumber { get; set; }
    public DateTimeOffset LastAt { get; set; }
    public string LastActor { get; set; } = "";
    /// <summary>Eigene Einstellungen der Person (Darstellung, Sicht) — Werte als JSON-Text; siehe <see cref="UserPrefsSet"/>.</summary>
    public Dictionary<string, string> Prefs { get; } = new();
}

/// <summary>Eine Rolle: Bezeichnung und Rechte (Vokabular <see cref="Rights"/>).</summary>
public sealed class RoleState
{
    public required string Key { get; init; }
    public string Label { get; set; } = "";
    public HashSet<string> Rights { get; set; } = new();
    public long LastNumber { get; set; }
    public DateTimeOffset LastAt { get; set; }
    public string LastActor { get; set; } = "";
}

/// <summary>Abbild „die Benutzer“ (Taloan, 19.09.2026: Benutzer und Rollen): Strom <c>user:&lt;key&gt;</c>. Der letzte UserDefined gilt ganz; UserRetired nimmt ihn weg.</summary>
public sealed class Users : IProjection
{
    private readonly Dictionary<string, UserState> _all = new();
    public long LastApplied { get; private set; }
    public IReadOnlyDictionary<string, UserState> All => _all;
    public const string Stream = "user:";
    private readonly Dictionary<string, RoleState> _roles = new();
    public IReadOnlyDictionary<string, RoleState> Roles => _roles;
    public const string RoleStream = "role:";
    /// <summary>Die Rechte einer Rolle; unbekannte Rolle = keine Rechte.</summary>
    public IReadOnlySet<string> RightsOf(string role) => _roles.TryGetValue(role, out var r) ? r.Rights : new HashSet<string>();

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        if (entry.Stream.StartsWith(RoleStream, StringComparison.Ordinal))
        {
            var rk = entry.Stream[RoleStream.Length..];
            if (entry.Type == Types.RoleDefined)
            {
                var d = Types.Deserialize<RoleDefined>(entry.Payload);
                if (!_roles.TryGetValue(rk, out var r)) _roles[rk] = r = new RoleState { Key = rk };
                r.Label = d.Label; r.Rights = d.Rights.Where(Rights.All.Contains).ToHashSet(); r.LastNumber = entry.Number; r.LastAt = entry.At; r.LastActor = entry.Actor;
            }
            else if (entry.Type == Types.RoleRetired) _roles.Remove(rk);
            return;
        }
        if (!entry.Stream.StartsWith(Stream, StringComparison.Ordinal)) return;
        var key = entry.Stream[Stream.Length..];
        switch (entry.Type)
        {
            case Types.UserDefined:
            {
                var d = Types.Deserialize<UserDefined>(entry.Payload);
                if (!_all.TryGetValue(key, out var u)) _all[key] = u = new UserState { Key = key };
                u.Name = d.Name; u.Email = d.Email; u.Role = d.Role; u.Enabled = d.Enabled; u.Team = string.IsNullOrWhiteSpace(d.Team) ? null : d.Team;
                u.LastNumber = entry.Number; u.LastAt = entry.At; u.LastActor = entry.Actor;
                break;
            }
            case Types.UserPrefsSet:
            {
                // nur Genanntes setzen, leerer Wert nimmt weg — so bleibt ein Eintrag klein, auch wenn nur die Darstellung wechselt
                var d = Types.Deserialize<UserPrefsSet>(entry.Payload);
                if (!_all.TryGetValue(key, out var u)) break;   // ohne Benutzer keine Einstellung
                foreach (var (k, v) in d.Prefs ?? new())
                    if (string.IsNullOrEmpty(v)) u.Prefs.Remove(k); else u.Prefs[k] = v;
                break;
            }
            case Types.UserRetired:
                _all.Remove(key);
                break;
        }
    }
}
