using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Lizenzschlüssel (Taloan, 23.09.2026): einmal einlösbar, an die Instanz gebunden, kein Team eingeprägt. Zwei Arten,
// kombinierbar — Reset (zählt ab dem Einlösen neu) und Limit (höheres Kontingent für eine Dauer ab dem Einlösen).
// Ein laufendes Limit wird nach Restvolumen umgerechnet, ein Limit überschreibt keinen Reset.
// Und: eingelöst wird nur, was diese Instanz selbst signiert angefordert hat („PGP quasi“).
public class SchluesselTests
{
    private static readonly DateOnly Heute = DateOnly.FromDateTime(DateTime.Now);

    private static Catalog Welt()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) =>
        {
            write("t", Teams.Stream + "de", Types.TeamDefined, new TeamDefined("Deutschland", EntriesWeek: 20_000, EntriesMonth: 100_000), null);
            write("t", Teams.Stream + "it", Types.TeamDefined, new TeamDefined("Italien", KeysFrom: "de"), null);
            return 0;
        });
        return c;
    }

    /// <summary>Was der Aussteller zurückgibt: dieselbe Id, der Fingerabdruck der Anforderung, ihre Werte.</summary>
    private static LicenceKey Ausgestellt(SignedRequest s)
    {
        var r = s.Inhalt!;
        return new LicenceKey(r.Id, r.Kind, r.Instance, r.EntriesWeek, r.EntriesMonth, r.Days, Heute, s.Hash);
    }

    private static string? Einloesen(Catalog c, Instanz i, KeyRequests a, LicenceKey k, string team) => c.With((_, _, write) =>
    {
        if (LicenceKeys.Fehler(k, team, i.Id, c.Teams, a.Get(k.Id), i.PublicKey) is { } f) return f;
        write("t", Teams.Stream + team, Types.KeyRedeemed, LicenceKeys.Einloesung(k, team, Heute, c.Teams), null);
        return (string?)null;
    });

    [Fact]
    public void Ohne_laufendes_Limit_gilt_die_eigene_Dauer()
    {
        var (bis, dazu) = Schluessel.Bis(Heute, 30, 30_000, 100_000, null);
        Assert.Equal(Heute.AddDays(29), bis);
        Assert.Equal(0, dazu);
    }

    [Fact]
    public void Ein_laufendes_Limit_wird_nach_Restvolumen_angehaengt()
    {
        // 30 000/Woche laufen noch 20 Tage (heute eingeschlossen) — neu 50 000/Woche für 30 Tage: 20 × 30/50 = 12
        var laufend = new LimitWindow("alt", Heute.AddDays(-10), Heute.AddDays(19), 30_000, 0, 1);
        var (bis, dazu) = Schluessel.Bis(Heute, 30, 50_000, 0, laufend);
        Assert.Equal(12, dazu);
        Assert.Equal(Heute.AddDays(41), bis);
    }

    [Fact]
    public void Ein_angeforderter_Schluessel_hebt_das_Kontingent_an_und_gilt_nur_einmal()
    {
        var c = Welt(); var i = new Instanz(null); var a = new KeyRequests(null, i);
        var s = a.Neu(Schluessel.Limit, 30_000, 150_000, 30, "it-admin");
        Assert.True(s.Pruefe().Ok);
        var k = Ausgestellt(s);

        Assert.Null(Einloesen(c, i, a, k, "de"));
        Assert.Equal((30_000, 150_000), c.With((_, _, _) => c.Teams.LimitAt("de", Heute)));
        Assert.Equal((20_000, 100_000), c.With((_, _, _) => c.Teams.LimitAt("de", Heute.AddDays(30))));   // nach der Dauer: wie vorher
        Assert.Contains("schon eingelöst", Einloesen(c, i, a, k, "de"));
    }

    [Fact]
    public void Ein_Paket_traegt_seine_Zahlen_in_die_Anforderung()
    {
        var i = new Instanz(null); var a = new KeyRequests(null, i);
        Assert.Equal(["pro", "ultimate", "enterprise"], Schluessel.Pakete.Select(p => p.Key));
        var p = Schluessel.PaketVon("ultimate")!;
        var s = a.Neu(Schluessel.Limit, p.Week, p.Month, p.Days, "it-admin", p.Key);
        Assert.Equal(("ultimate", p.Week, p.Month, p.Days), (s.Inhalt!.Plan, s.Inhalt.EntriesWeek, s.Inhalt.EntriesMonth, s.Inhalt.Days));
        Assert.True(s.Pruefe().Ok);
        Assert.Null(Schluessel.PaketVon("frei"));
    }

    [Fact]
    public void Ohne_eigene_Anforderung_kein_Einloesen()
    {
        var c = Welt(); var i = new Instanz(null); var a = new KeyRequests(null, i);
        var k = new LicenceKey("k-erfunden", Schluessel.Reset, i.Id, Issued: Heute, Request: "00");
        Assert.Contains("keine Anforderung", Einloesen(c, i, a, k, "de"));
    }

    [Fact]
    public void Der_Schluessel_muss_zur_Anforderung_passen()
    {
        var c = Welt(); var i = new Instanz(null); var a = new KeyRequests(null, i);
        var s = a.Neu(Schluessel.Reset, 0, 0, 0, "it-admin");
        Assert.Contains("nicht zu dieser Anforderung", Einloesen(c, i, a, Ausgestellt(s) with { Request = new string('0', 64) }, "de"));
        Assert.Contains("Angefordert: reset", Einloesen(c, i, a, Ausgestellt(s) with { Kind = Schluessel.Limit, Days = 30, EntriesWeek = 1 }, "de"));
    }

    [Fact]
    public void Eine_Anforderung_einer_anderen_Instanz_zaehlt_nicht()
    {
        // die Tabelle einer anderen Instanz herübergeholt: Kennung und Schlüsselpaar passen nicht
        var c = Welt(); var hier = new Instanz(null); var dort = new Instanz(null); var a = new KeyRequests(null, dort);
        var s = a.Neu(Schluessel.Reset, 0, 0, 0, "it-admin");
        Assert.Contains("andere Instanz", Einloesen(c, hier, a, Ausgestellt(s), "de"));
        Assert.Contains("anderen Instanz", Einloesen(c, hier, a, Ausgestellt(s) with { Instance = hier.Id }, "de"));
    }

    [Fact]
    public void Die_kopierte_Anforderung_kommt_unversehrt_an()
    {
        // was die Oberfläche zum Kopieren zeigt, muss beim Aussteller genau so prüfbar sein
        var i = new Instanz(null); var a = new KeyRequests(null, i);
        var s = a.Neu(Schluessel.Limit, 30_000, 0, 30, "it-admin");
        var angekommen = System.Text.Json.JsonSerializer.Deserialize<SignedRequest>(s.Text, new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase })!;
        Assert.True(angekommen.Pruefe().Ok);
        Assert.Equal(s.Hash, angekommen.Hash);
        Assert.Equal(i.Id, angekommen.Inhalt!.Instance);
    }

    [Fact]
    public void Eine_veraenderte_Anforderung_faellt_auf()
    {
        var i = new Instanz(null); var a = new KeyRequests(null, i);
        var s = a.Neu(Schluessel.Limit, 30_000, 0, 30, "it-admin");
        var gefaelscht = s with { Anforderung = s.Anforderung.Replace("30000", "90000") };
        Assert.False(gefaelscht.Pruefe().Ok);
    }

    [Fact]
    public void Wer_ueber_ein_anderes_Team_abrechnet_loest_dort_ein()
    {
        var c = Welt(); var i = new Instanz(null); var a = new KeyRequests(null, i);
        var s = a.Neu(Schluessel.Reset, 0, 0, 0, "it-admin");
        Assert.Contains("rechnet über", Einloesen(c, i, a, Ausgestellt(s), "it"));
        Assert.Null(Einloesen(c, i, a, Ausgestellt(s), "de"));
    }

    [Fact]
    public void Reset_und_Limit_ergaenzen_sich()
    {
        var c = Welt(); var i = new Instanz(null); var a = new KeyRequests(null, i);
        var reset = a.Neu(Schluessel.Reset, 0, 0, 0, "it-admin");
        var limit = a.Neu(Schluessel.Limit, 50_000, 0, 30, "it-admin");
        Assert.Null(Einloesen(c, i, a, Ausgestellt(reset), "de"));
        Assert.Null(Einloesen(c, i, a, Ausgestellt(limit), "de"));
        Assert.Equal(Heute, c.With((_, _, _) => c.Teams.CountFrom("de", Heute.AddDays(-100))));   // der Reset bleibt
        Assert.Equal((50_000, 100_000), c.With((_, _, _) => c.Teams.LimitAt("de", Heute)));      // hebt an, senkt nie
    }

    [Fact]
    public void Das_zweite_Limit_uebernimmt_den_Rest_des_ersten()
    {
        var c = Welt(); var i = new Instanz(null); var a = new KeyRequests(null, i);
        var erstes = a.Neu(Schluessel.Limit, 30_000, 0, 20, "it-admin");
        var zweites = a.Neu(Schluessel.Limit, 50_000, 0, 30, "it-admin");
        Assert.Null(Einloesen(c, i, a, Ausgestellt(erstes), "de"));
        Assert.Null(Einloesen(c, i, a, Ausgestellt(zweites), "de"));
        var w = c.With((_, _, _) => c.Teams.WindowAt("de", Heute))!;
        Assert.Equal(50_000, w.Week);
        Assert.Equal(Heute.AddDays(29 + 12), w.Until);   // 20 Tage × 30/50 = 12 dazu
    }
}
