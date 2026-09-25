using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Core.Licensing;
using Journali.Server;

namespace Journali.Tests;

// Tarife: Kostenlos, Pro, Pro+, Enterprise, Unlimited. Grenzen hängen am Team, Plugins und
// Publikationsbäume gelten für die Instanz nach ihrem höchsten Tarif. Jede neue Instanz hat drei Monate Enterprise,
// gezählt ab dem ersten Eintrag im Journal. Reset-Schlüssel gibt es getrennt für Pro und Enterprise.
public class TarifTests
{
    private static readonly DateOnly Heute = DateOnly.FromDateTime(DateTime.Now);

    private static string Frisch() { var d = Path.Combine(Path.GetTempPath(), "journali-tarif-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(d); return d; }

    [Fact]
    public void Die_Tabelle()
    {
        Assert.Equal((10_000, 50_000, 1), (Tarife.Free.Week, Tarife.Free.Month, Tarife.Free.PubTrees));
        Assert.Equal((50_000, 250_000, 5), (Tarife.Pro.Week, Tarife.Pro.Month, Tarife.Pro.PubTrees));
        Assert.Equal((50_000, 250_000, 5), (Tarife.ProPlus.Week, Tarife.ProPlus.Month, Tarife.ProPlus.PubTrees));
        Assert.Equal((200_000, 1_000_000, Tarife.Ohne), (Tarife.Enterprise.Week, Tarife.Enterprise.Month, Tarife.Enterprise.PubTrees));
        Assert.True(Tarife.Unlimited.Unbegrenzt);
        foreach (var k in new[] { "csv", "excel", "json", "exceladdin", "ooaddin", "derive", "tasker" }) Assert.True(Tarife.Free.Erlaubt(k), k);
        Assert.False(Tarife.Free.Erlaubt("backup"));                             // kostenlos sichert man von Hand (B&R)
        foreach (var k in new[] { "datasheet", "xliff", "xport", "etim", "tasker" }) Assert.True(Tarife.Pro.Erlaubt(k), k);
        Assert.False(Tarife.Pro.Erlaubt("dpp"));
        Assert.True(Tarife.ProPlus.Erlaubt("dpp"));                              // Pro+ = Pro mit allen Plugins
    }

    [Fact]
    public void Was_ein_Tarif_erlaubt_bringt_mit_was_es_braucht()
    {
        // ETIM braucht Datenanalyse und Export nach Vorlage — ein Tarif, der ETIM hat, muss beides haben, sonst läuft es nicht
        var dir = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "plugins");
        foreach (var t in Tarife.Saat.Alle.Where(t => t.Plugins is not null))
            foreach (var key in t.Plugins!)
            {
                var manifest = Path.Combine(dir, key, "plugin.json");
                Assert.True(File.Exists(manifest), $"{t.Label}: Plugin {key} gibt es nicht");
                using var doc = JsonDocument.Parse(File.ReadAllText(manifest));
                foreach (var r in PluginApi.Requires(doc.RootElement)) Assert.True(t.Erlaubt(r), $"{t.Label}: {key} braucht {r}");
            }
    }

    [Fact]
    public void Eine_neue_Instanz_hat_drei_Monate_Enterprise_ab_dem_ersten_Eintrag()
    {
        var dir = Frisch();
        var l = new Licences(dir) { ErsterTag = () => Heute.AddDays(-10) };
        Assert.Equal("enterprise", l.Lic.Plan);
        Assert.True(l.Roh.Trial);
        Assert.Equal(Heute.AddDays(-10).AddMonths(3).AddDays(-1), l.Lic.ValidUntil);
        Assert.Equal((200_000, 1_000_000), (l.Lic.TarifIn(Tarife.Saat).Week, l.Lic.TarifIn(Tarife.Saat).Month));
        // festgehalten: beim nächsten Start liest sie sich so, wie sie angelegt wurde — auch mit anderem ersten Tag
        var wieder = new Licences(dir) { ErsterTag = () => Heute };
        Assert.Equal(l.Lic.ValidUntil, wieder.Lic.ValidUntil);
        Directory.Delete(dir, true);
    }

    /// <summary>Die Testlizenz ist nicht signiert — ein umgeschriebenes Datum verlängert nichts: sie gilt höchstens bis
    /// erster Tag + Testmonate, und der Tarif ist der Test-Tarif, gleich was in ihr steht.</summary>
    [Fact]
    public void Eine_umgeschriebene_Testlizenz_verlaengert_nichts()
    {
        var dir = Frisch();
        var l = new Licences(dir) { ErsterTag = () => Heute.AddDays(-10) };
        l.Neu(new Licence("unlimited", null, Heute.AddYears(50), Trial: true));
        Assert.Equal(Heute.AddDays(-10).AddMonths(3).AddDays(-1), l.Lic.ValidUntil);
        Assert.Equal(Tarife.Enterprise, l.Lic.TarifIn(Tarife.Saat));
        // der Test aus dem Tarifblatt: ein Monat Pro
        var liste = Tarifliste.Aus(PruefAussteller.Blatt(2, testMonate: 1).Inhalt! with { TestTarif = "pro" });
        var mitBlatt = new Licences(dir) { ErsterTag = () => Heute.AddDays(-10), Tarife = () => liste };
        Assert.Equal(Heute.AddDays(-10).AddMonths(1).AddDays(-1), mitBlatt.Lic.ValidUntil);
        Assert.Equal("pro", mitBlatt.Lic.TarifIn(liste).Key);   // aus dem Blatt — eine andere Instanz als das Saatgut
        Directory.Delete(dir, true);
    }

    [Fact]
    public void Nach_dem_Test_gilt_Kostenlos()
    {
        // eine wiederhergestellte Instanz bringt ihren ersten Tag aus dem Journal mit — der Test fängt nicht von vorn an
        var dir = Frisch();
        var l = new Licences(dir) { ErsterTag = () => Heute.AddMonths(-4) };
        Assert.True(l.Roh.Trial);
        Assert.Equal(Licence.Frei, l.Lic);
        Assert.Equal(Tarife.Free, l.Lic.TarifIn(Tarife.Saat));
        Assert.Contains("abgelaufen", l.Grund);
        Directory.Delete(dir, true);
    }

    [Fact]
    public void Lizenzen_von_vor_den_Tarifen_gelten_als_Kostenlos()
    {
        Assert.Equal(Tarife.Free, new Licence("30k Monat").TarifIn(Tarife.Saat));
        Assert.Equal(Tarife.Enterprise, new Licence("enterprise").TarifIn(Tarife.Saat));
    }

    private static Catalog Welt()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) =>
        {
            write("t", Teams.Stream + "de", Types.TeamDefined, new TeamDefined("Deutschland", EntriesWeek: 10_000, EntriesMonth: 50_000), null);
            write("t", Teams.Stream + "es", Types.TeamDefined, new TeamDefined("Spanien"), null);
            return 0;
        });
        return c;
    }

    private static void Paket(Catalog c, string team, string plan) => c.With((_, _, write) =>
    {
        var p = c.Tarife.PaketVon(plan)!;
        write("t", Teams.Stream + team, Types.KeyRedeemed, new KeyRedeemed("k-" + Guid.NewGuid().ToString("N")[..8], Schluessel.Limit, Heute, Heute.AddDays(29), p.Week, p.Month, 30, 0, plan), null);
        return 0;
    });

    [Fact]
    public void Der_hoechste_Tarif_gilt_fuer_die_ganze_Instanz()
    {
        var c = Welt();
        Assert.Equal(Tarife.Free, c.InstanzTarif);                               // ohne Lizenz: Kostenlos
        Paket(c, "de", "pro");
        Paket(c, "es", "enterprise");
        Assert.Equal(Tarife.Enterprise, c.InstanzTarif);                         // Team 1 Pro, Team 2 Enterprise → Enterprise
        Assert.Equal(Tarife.Pro, c.With((_, _, _) => c.TeamTarif("de")));      // die Grenzen bleiben beim Team
    }

    [Fact]
    public void Publikationsbaeume_nach_Tarif()
    {
        var c = Welt();
        var vorher = c.Read(t => t.PubTrees.Count());
        void Baum() => c.With((_, _, write) => write("t", Ids.New(Roles.Rubric), Types.RubricCreated, new RubricCreated(null, new()), null));
        for (var i = vorher; i < Tarife.Free.PubTrees; i++) Baum();
        var e = Assert.Throws<TarifException>(Baum);                             // Kostenlos: einer
        Assert.Contains("Kostenlos", e.Message);
        Paket(c, "de", "pro");
        for (var i = Tarife.Free.PubTrees; i < Tarife.Pro.PubTrees; i++) Baum();
        Assert.Throws<TarifException>(Baum);                                     // Pro: fünf
        Paket(c, "es", "enterprise");
        Baum(); Baum();                                                          // Enterprise: ohne Grenze
        Assert.Equal(Tarife.Pro.PubTrees + 2, c.Read(t => t.PubTrees.Count()));
    }

    private static LicenceKey Ausgestellt(SignedRequest s)
    {
        var r = s.Inhalt!;
        return new LicenceKey(r.Id, r.Kind, r.Instance, r.EntriesWeek, r.EntriesMonth, r.Days, Heute, s.Hash, r.Plan);
    }

    [Fact]
    public void Reset_getrennt_fuer_Pro_und_Enterprise()
    {
        var c = Welt(); var i = new Instanz(null); var a = new KeyRequests(null, i);
        string? Fehler(string plan, string team)
        {
            var s = a.Neu(Schluessel.Reset, 0, 0, 0, "it", plan);
            return c.With((_, _, _) => LicenceKeys.Fehler(Ausgestellt(s), team, i.Id, c.Teams, a.Get(s.Inhalt!.Id), i.PublicKey, c.TeamTarif(team)));
        }

        Assert.Contains("Kostenlos", Fehler("pro", "de"));                        // kostenlos gibt es keinen Reset
        Paket(c, "de", "pro");
        Assert.Null(Fehler("pro", "de"));
        Assert.Contains("gilt nicht für Tarif Pro", Fehler("enterprise", "de"));  // der teurere ist nicht der richtige
        Paket(c, "es", "enterprise");
        Assert.Contains("gilt nicht für Tarif Enterprise", Fehler("pro", "es")); // ein Pro-Reset reicht Enterprise nicht
        Assert.Null(Fehler("enterprise", "es"));
    }

    [Fact]
    public void Plugins_ausserhalb_des_Tarifs_sind_zu()
    {
        var c = Welt();
        Assert.NotNull(PluginApi.NichtImTarif(c, "etim"));
        Assert.Null(PluginApi.NichtImTarif(c, "csv"));
        Assert.Null(PluginApi.NichtImTarif(c, "derive"));                         // Vorschaubilder schon kostenlos
        Paket(c, "de", "pro");
        Assert.Null(PluginApi.NichtImTarif(c, "etim"));
        Assert.NotNull(PluginApi.NichtImTarif(c, "dpp"));
    }

    /// <summary>Die Grenzen sagt der Tarif, nicht die Lizenz: was „Kostenlos“ heisst, soll überall dasselbe bedeuten.
    /// Eine Lizenz mit eigenen Zahlen im Rumpf (bis 25.09.2026 möglich) ändert daran nichts.</summary>
    [Fact]
    public void Die_Grenzen_kommen_aus_dem_Tarif_nicht_aus_der_Lizenz()
    {
        var s = Tarife.Saat;
        var frech = new Licence(Tarife.Free.Key, "Kunde", null, 30_000, 100_000);
        Assert.Equal((Tarife.Free.Week, Tarife.Free.Month), (frech.TarifIn(s).Week, frech.TarifIn(s).Month));
        Assert.Equal((30_000, 100_000), (frech.EntriesWeek, frech.EntriesMonth));   // im Rumpf stehen sie noch — die Signatur bleibt gültig

        // jeder Tarif nennt seine eigenen Zahlen; ein unbekannter gilt als Kostenlos
        foreach (var t in s.Alle) Assert.Equal((t.Week, t.Month), (new Licence(t.Key).TarifIn(s).Week, new Licence(t.Key).TarifIn(s).Month));
        Assert.Equal(Tarife.Free.Week, new Licence("gibtsnicht", null, null, 999_999).TarifIn(s).Week);
        Assert.Equal((Tarife.Free.Week, Tarife.Free.Month), (Licence.Frei.TarifIn(s).Week, Licence.Frei.TarifIn(s).Month));
    }

    /// <summary>
    /// Die Tarife kommen aus dem Tarifblatt im Journal (25.09.2026): eine neuere, echte Fassung gilt — für Grenzen,
    /// Plugins, Publikationsbäume und das Init Team. Ein Eintrag mit fremder Signatur ändert nichts, auch nicht beim
    /// Neuaufbau aus dem Journal: das Abbild prüft selbst.
    /// </summary>
    [Fact]
    public void Ein_Tarifblatt_gilt_nur_mit_passender_Signatur()
    {
        var j = new MemoryJournal();
        var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        Assert.Equal(0, c.Tarife.Fassung);                                      // ohne Blatt: das Saatgut
        Assert.NotNull(PluginApi.NichtImTarif(c, "etim"));

        Assert.True(c.NimmTarifblatt(PruefAussteller.Blatt(2, z => z.Key == "free" ? z with { Week = 7_000, PubTrees = 2, Plugins = [.. z.Plugins!, "etim"] } : z), "t"));
        Assert.Equal(7_000, c.Tarife.Free.Week);
        Assert.Equal(7_000, c.With((_, _, _) => c.Teams.Get(Model.InitTeam)!.EntriesWeek));   // das Init Team trägt die Lizenz (Kostenlos) nach der neuen Liste
        Assert.Null(PluginApi.NichtImTarif(c, "etim"));
        Assert.False(c.NimmTarifblatt(PruefAussteller.Blatt(2, z => z with { Week = 1 }), "t"));   // dieselbe Fassung: nichts

        // ein Eintrag mit fremder Signatur — geschrieben an allem vorbei — bleibt wirkungslos
        using var fremd = System.Security.Cryptography.ECDsa.Create(System.Security.Cryptography.ECCurve.NamedCurves.nistP256);
        var falsch = PruefAussteller.Blatt(9, z => z with { Week = Tarife.Ohne }, mit: fremd);
        c.AppendRaw("t", Catalog.TarifStrom, Types.TarifeReceived, Types.Serialize(new TarifeReceived(falsch.Blatt, falsch.Sig)));
        Assert.Equal(2, c.Tarife.Fassung);
        var neu = new Catalog(j); neu.Rebuild();
        Assert.Equal(2, neu.Tarife.Fassung);
        Assert.Equal(7_000, neu.Tarife.Free.Week);
    }

    /// <summary>Zeitpläne gibt es ab Pro; von Hand läuft ein Job in jedem Tarif.</summary>
    [Fact]
    public void Ein_Zeitplan_gehoert_ab_Pro_dazu()
    {
        Assert.False(Tarife.Free.Zeitplan);
        foreach (var t in Tarife.Saat.Alle.Where(x => x.Rang > 0)) Assert.True(t.Zeitplan, t.Key);
    }
}
