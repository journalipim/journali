using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Tarife (Taloan, 24.09.2026): Kostenlos, Pro, Pro+, Enterprise, Unlimited. Grenzen hängen am Team, Plugins und
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
        foreach (var k in new[] { "csv", "xlsx", "json", "excel" }) Assert.True(Tarife.Free.Erlaubt(k), k);
        Assert.False(Tarife.Free.Erlaubt("tasker"));
        foreach (var k in new[] { "datasheet", "xliff", "xport", "etim", "tasker" }) Assert.True(Tarife.Pro.Erlaubt(k), k);
        Assert.False(Tarife.Pro.Erlaubt("dpp"));
        Assert.True(Tarife.ProPlus.Erlaubt("dpp"));                              // Pro+ = Pro mit allen Plugins
    }

    [Fact]
    public void Was_ein_Tarif_erlaubt_bringt_mit_was_es_braucht()
    {
        // ETIM braucht Datenanalyse und Export nach Vorlage — ein Tarif, der ETIM hat, muss beides haben, sonst läuft es nicht
        var dir = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "plugins");
        foreach (var t in Tarife.Alle.Where(t => t.Plugins is not null))
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
        Assert.Equal((200_000, 1_000_000), (l.Lic.EntriesWeek, l.Lic.EntriesMonth));
        // festgehalten: beim nächsten Start liest sie sich so, wie sie angelegt wurde — auch mit anderem ersten Tag
        var wieder = new Licences(dir) { ErsterTag = () => Heute };
        Assert.Equal(l.Lic.ValidUntil, wieder.Lic.ValidUntil);
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
        Assert.Equal(Tarife.Free, l.Lic.Tarif);
        Assert.Contains("abgelaufen", l.Grund);
        Directory.Delete(dir, true);
    }

    [Fact]
    public void Lizenzen_von_vor_den_Tarifen_gelten_als_Kostenlos()
    {
        Assert.Equal(Tarife.Free, new Licence("30k Monat").Tarif);
        Assert.Equal(Tarife.Enterprise, new Licence("enterprise").Tarif);
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
        var p = Schluessel.PaketVon(plan)!;
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
        Assert.NotNull(PluginApi.NichtImTarif(c, "tasker"));
        Assert.Null(PluginApi.NichtImTarif(c, "csv"));
        Paket(c, "de", "pro");
        Assert.Null(PluginApi.NichtImTarif(c, "tasker"));
        Assert.NotNull(PluginApi.NichtImTarif(c, "dpp"));
    }
}
