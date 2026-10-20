using Microsoft.AspNetCore.Http;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Die Sperre der Schnittstelle (01.10.2026): mit Benutzern in der Instanz ist ohne Sitzung fast nichts zu haben — nur /api/health (Version und Bau),
/// /api/auth/… zum Anmelden und die Dateien der Office-Add-ins. Das Routing ignoriert Gross- und Kleinschreibung; die Sperre darf es nicht anders halten:
/// „/API/tree“ lieferte den ganzen Baum ohne Anmeldung, „/plugins/…“ lag ausserhalb der Sperre.
/// </summary>
public class SperreTests
{
    private static (Catalog C, string Dir) NeueInstanz(bool mitBenutzer)
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        if (mitBenutzer) c.With((_, _, w) => w("system", Users.Stream + "u1", Types.UserDefined, new UserDefined("U1", null, "admin", true), null));
        var dir = Path.Combine(Path.GetTempPath(), "journali-sperre-" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(dir);
        return (c, dir);
    }

    /// <summary>Eine Anfrage ohne Sitzung durch die Sperre: (kam sie bis zum Endpunkt, Status).</summary>
    private static async Task<(bool Durch, int Status)> OhneSitzung(Catalog c, string dir, string pfad, string method = "GET")
    {
        var ctx = new DefaultHttpContext(); ctx.Request.Path = pfad; ctx.Request.Method = method;
        ctx.Response.Body = new MemoryStream();
        var durch = false;
        await Auth.Middleware(c, dir)(ctx, () => { durch = true; return Task.CompletedTask; });
        return (durch, ctx.Response.StatusCode);
    }

    [Theory]
    [InlineData("/api/tree")]
    [InlineData("/API/tree")]
    [InlineData("/Api/Tree")]
    [InlineData("/API/MODEL")]
    [InlineData("/API/journal")]
    [InlineData("/api/nodes/x")]
    [InlineData("/API/NODES/x/attributes")]
    [InlineData("/plugins/da/entry.js")]
    [InlineData("/Plugins/da/entry.js")]
    [InlineData("/PLUGINS/etim/plugin.json")]
    public void Ohne_Sitzung_ist_der_Zugriff_gesperrt_in_jeder_Schreibweise(string pfad)
    {
        var (c, dir) = NeueInstanz(mitBenutzer: true);
        var (durch, status) = OhneSitzung(c, dir, pfad).GetAwaiter().GetResult();
        Assert.False(durch, pfad + " kam ohne Sitzung zum Endpunkt");
        Assert.Equal(401, status);
    }

    [Theory]
    [InlineData("/api/health")]
    [InlineData("/API/health")]
    [InlineData("/api/auth/state")]
    [InlineData("/api/auth/login")]
    [InlineData("/plugins/exceladdin/taskpane.html")]
    [InlineData("/plugins/ooaddin/index.html")]
    [InlineData("/Plugins/OOAddin/package.plugin")]
    [InlineData("/")]
    [InlineData("/assets/index.js")]
    [InlineData("/login")]
    public void Offen_bleiben_nur_Gesundheit_Anmeldung_die_Office_Add_ins_und_die_Seite_selbst(string pfad)
    {
        var (c, dir) = NeueInstanz(mitBenutzer: true);
        var (durch, _) = OhneSitzung(c, dir, pfad).GetAwaiter().GetResult();
        Assert.True(durch, pfad + " muss ohne Sitzung zu haben sein");
    }

    [Fact]
    public void Ohne_Benutzer_in_der_Anlage_bleibt_alles_offen_wie_bisher()
    {
        var (c, dir) = NeueInstanz(mitBenutzer: false);
        Assert.True(OhneSitzung(c, dir, "/api/tree").GetAwaiter().GetResult().Durch);
        Assert.True(OhneSitzung(c, dir, "/plugins/da/entry.js").GetAwaiter().GetResult().Durch);
    }

    [Theory]
    [InlineData("/API/MODEL/attributes/x", "PUT", Rights.Model)]
    [InlineData("/Api/Model/lists/l/values", "PUT", Rights.Write)]
    [InlineData("/API/AUTH/USERS", "GET", Rights.Users)]
    [InlineData("/API/Media/m-1/file", "GET", Rights.Download)]
    [InlineData("/API/BACKUP", "GET", Rights.Users)]
    [InlineData("/plugins/da/entry.js", "GET", Rights.Read)]
    public void Die_Rechte_gelten_in_jeder_Schreibweise_gleich(string pfad, string method, string recht)
    {
        var ctx = new DefaultHttpContext(); ctx.Request.Path = pfad; ctx.Request.Method = method;
        Assert.Equal(recht, Auth.Needed(ctx.Request));
    }

    [Fact]
    public void Ein_gesperrter_Knoten_bleibt_auch_bei_grosser_Schreibweise_gesperrt()
    {
        var (c, _) = NeueInstanz(mitBenutzer: true);
        var id = Ids.New(Roles.Group);
        c.With((_, _, w) =>
        {
            w("t", id, Types.GroupCreated, new GroupCreated(null, Labels.Of("Geheim", "Secret")), null);
            w("t", id, Types.NodeRestricted, new NodeRestricted(["admin"]), null);
            return 0;
        });
        Assert.False(Auth.Sichtbar(c, "editor", "/api/nodes/" + id), "klein: gesperrt");
        Assert.False(Auth.Sichtbar(c, "editor", "/API/NODES/" + id), "gross: ebenso");
        Assert.False(Auth.Sichtbar(c, "editor", "/Api/Nodes/" + id + "/attributes"), "gemischt: ebenso");
        Assert.True(Auth.Sichtbar(c, "admin", "/API/NODES/" + id), "wer die Rolle hat, sieht ihn");
    }

    [Fact]
    public void Die_Office_Add_ins_sind_genau_zwei()
    {
        Assert.Equal(["exceladdin", "ooaddin"], Auth.OffenePlugins);
        Assert.False(Auth.OeffentlichesPlugin("/plugins/da/entry.js"));
        Assert.False(Auth.OeffentlichesPlugin("/plugins/exceladdinX/a"), "ein anderer Name mit gleichem Anfang ist keiner");
    }
}
