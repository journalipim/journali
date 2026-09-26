using Npgsql;

namespace Journali.Server;

/// <summary>
/// Wer gerade wo arbeitet (26.09.2026). Flüchtiger Zustand — er gehört nicht ins Journal: ein Eintragstyp ist für
/// immer, und wer ein Formular offen hat, ist morgen keine Tatsache mehr. Darum eine eigene Tabelle neben dem Journal,
/// wie der Tresor: sie trägt je Anwender und Ort einen Zeitpunkt, der mit jedem Puls der Oberfläche nachrückt.
/// <para>Über die Datenbank statt im Speicher, weil mehrere Server auf derselben Datenbank laufen können — sonst sähe
/// der eine nicht, wer am anderen arbeitet. Für den häufigeren Fall (ein Server, mehrere Anwender) gilt dasselbe.</para>
/// <para>Ohne Datenbank (Tests, Sandbox) hält sie alles im Speicher.</para>
/// </summary>
public sealed class Presence(NpgsqlDataSource? db)
{
    /// <summary>So lange gilt ein Puls. Die Oberfläche pulst alle drei Sekunden.</summary>
    public static readonly TimeSpan Gilt = TimeSpan.FromSeconds(20);

    private readonly Dictionary<(string Actor, string Ort), DateTimeOffset> _speicher = new();
    private bool _tabelle;

    private void Tabelle()
    {
        if (_tabelle || db is null) return;
        using var conn = db.OpenConnection();
        using var cmd = new NpgsqlCommand("""
            CREATE TABLE IF NOT EXISTS praesenz (
                actor TEXT        NOT NULL,
                ort   TEXT        NOT NULL,
                at    TIMESTAMPTZ NOT NULL,
                PRIMARY KEY (actor, ort)
            );
            """, conn);
        cmd.ExecuteNonQuery();
        _tabelle = true;
    }

    /// <summary>„Ich bin hier“ — und wer sonst noch, ohne den Fragenden selbst.</summary>
    public IReadOnlyList<string> Puls(string? actor, string? ort, DateTimeOffset jetzt)
    {
        if (string.IsNullOrWhiteSpace(ort)) return [];
        if (db is null) return SpeicherPuls(actor, ort, jetzt);
        try
        {
            Tabelle();
            using var conn = db.OpenConnection();
            if (!string.IsNullOrWhiteSpace(actor))
            {
                using var setzen = new NpgsqlCommand("INSERT INTO praesenz (actor, ort, at) VALUES (@a, @o, @t) ON CONFLICT (actor, ort) DO UPDATE SET at = @t", conn);
                setzen.Parameters.AddWithValue("a", actor); setzen.Parameters.AddWithValue("o", ort); setzen.Parameters.AddWithValue("t", jetzt);
                setzen.ExecuteNonQuery();
            }
            using var lesen = new NpgsqlCommand("SELECT actor FROM praesenz WHERE ort = @o AND at > @seit AND actor <> @a ORDER BY actor", conn);
            lesen.Parameters.AddWithValue("o", ort); lesen.Parameters.AddWithValue("seit", jetzt - Gilt); lesen.Parameters.AddWithValue("a", actor ?? "");
            var andere = new List<string>();
            using (var r = lesen.ExecuteReader()) while (r.Read()) andere.Add(r.GetString(0));
            // gelegentlich aufräumen: was lange nicht gepulst hat, ist niemand mehr
            if (Random.Shared.Next(50) == 0)
            {
                using var weg = new NpgsqlCommand("DELETE FROM praesenz WHERE at < @alt", conn);
                weg.Parameters.AddWithValue("alt", jetzt - TimeSpan.FromHours(1));
                weg.ExecuteNonQuery();
            }
            return andere;
        }
        catch (NpgsqlException) { return []; }   // Präsenz ist Beiwerk: sie darf den Puls nie scheitern lassen
    }

    private IReadOnlyList<string> SpeicherPuls(string? actor, string ort, DateTimeOffset jetzt)
    {
        lock (_speicher)
        {
            if (!string.IsNullOrWhiteSpace(actor)) _speicher[(actor, ort)] = jetzt;
            foreach (var alt in _speicher.Where(x => x.Value < jetzt - TimeSpan.FromHours(1)).Select(x => x.Key).ToList()) _speicher.Remove(alt);
            return _speicher.Where(x => x.Key.Ort == ort && x.Value > jetzt - Gilt && x.Key.Actor != actor).Select(x => x.Key.Actor).Order().ToList();
        }
    }
}
