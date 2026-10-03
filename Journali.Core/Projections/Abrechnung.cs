namespace Journali.Core.Projections;

/// <summary>
/// Über welches Team ein Eintrag abgerechnet wird (03.10.2026). Ein Anwender über sein Team; ein Job über das Team, dem er zugeordnet ist — einen Besitzer
/// braucht er dafür nicht. Ein Job ohne Team (Systemjobs, Jobs von früher) geht über das Team seines Besitzers, ohne Besitzer über das Team des Administrators
/// (<see cref="Users.Verwalter"/>). Jedes Team zahlt am Ende seiner Zahlerkette.
/// </summary>
public static class Abrechnung
{
    /// <summary>Das Team, über das ein Job abgerechnet wird.</summary>
    public static string? TeamDesJobs(Jobs jobs, Users users, string key, string initTeam)
    {
        if (jobs.TeamVon(key) is { Length: > 0 } t) return t;
        // ein Besitzer ohne Team bekommt auch über einen Job kein Kontingent — nur ein Job ganz ohne Besitzer geht über den Administrator
        if (jobs.BesitzerVon(key, null) is { Length: > 0 } b) return users.All.GetValueOrDefault(b)?.Team is { Length: > 0 } bt ? bt : null;
        return users.Verwalter(initTeam) is { } v && users.All.GetValueOrDefault(v)?.Team is { Length: > 0 } vt ? vt : initTeam;
    }

    /// <summary>
    /// Die Urheber, die auf diesen Zahler zählen: die Mitglieder aller Teams, die über ihn abrechnen, und die Jobs dieser Teams (<c>job:&lt;key&gt;</c>) —
    /// auch entfernte, denn was sie geschrieben haben, bleibt geschrieben.
    /// </summary>
    public static HashSet<string> Urheber(Teams teams, Users users, Jobs jobs, string zahler, string initTeam)
    {
        var alle = teams.Dependents(zahler).ToHashSet(StringComparer.Ordinal);
        var menge = users.All.Values.Where(u => u.Team is { } t && alle.Contains(t)).Select(u => u.Key).ToHashSet(StringComparer.Ordinal);
        foreach (var key in jobs.Bekannte)
            if (TeamDesJobs(jobs, users, key, initTeam) is { } t && alle.Contains(t)) menge.Add(Jobs.Stream + key);
        return menge;
    }
}
