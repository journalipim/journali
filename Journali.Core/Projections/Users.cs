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

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        if (!entry.Stream.StartsWith(Stream, StringComparison.Ordinal)) return;
        var key = entry.Stream[Stream.Length..];
        switch (entry.Type)
        {
            case Types.UserDefined:
            {
                var d = Types.Deserialize<UserDefined>(entry.Payload);
                if (!_all.TryGetValue(key, out var u)) _all[key] = u = new UserState { Key = key };
                u.Name = d.Name; u.Email = d.Email; u.Role = d.Role; u.Enabled = d.Enabled;
                u.LastNumber = entry.Number; u.LastAt = entry.At; u.LastActor = entry.Actor;
                break;
            }
            case Types.UserRetired:
                _all.Remove(key);
                break;
        }
    }
}
