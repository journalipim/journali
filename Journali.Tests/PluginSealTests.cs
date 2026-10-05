using System.Security.Cryptography;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Das Siegel eines Plugins: signiertes certificate.json über Schlüssel, Version und den Hash der Dateien.
/// Gültig, solange nichts verändert ist; gebrochen bei jeder Änderung an Dateien, Version oder Zertifikat.
/// </summary>
public class PluginSealTests
{
    private static (string Dir, ECDsa Priv, string Pub) Welt()
    {
        var dir = Path.Combine(Path.GetTempPath(), "journali-seal-" + Guid.NewGuid().ToString("N"), "demo");
        Directory.CreateDirectory(Path.Combine(dir, "src"));
        Directory.CreateDirectory(Path.Combine(dir, "node_modules", "x"));
        File.WriteAllText(Path.Combine(dir, "plugin.json"), """{"key":"demo","version":"1.2.0"}""");
        File.WriteAllText(Path.Combine(dir, "entry.js"), "export default {}");
        File.WriteAllText(Path.Combine(dir, "src", "a.js"), "// a");
        File.WriteAllText(Path.Combine(dir, "node_modules", "x", "index.js"), "// paket");
        var priv = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var pub = Convert.ToBase64String(priv.ExportSubjectPublicKeyInfo());
        return (dir, priv, pub);
    }

    /// <summary>05.10.2026: Original ist nur, was der Schlüssel von journali bestätigt. Ein weiterer Schlüssel siegelt eigene Plugins des Betreibers,
    /// macht sie aber nicht zum Original und darf nicht „journali“ als Herausgeber nennen.</summary>
    [Fact]
    public void Original_nur_mit_dem_Schluessel_von_journali_ein_weiterer_kann_sich_nicht_als_journali_ausgeben()
    {
        var (dir, priv, pub) = Welt();
        PluginSeal.Sign(dir, "demo", "1.2.0", priv);
        var s = PluginSeal.Check(dir, "demo", "1.2.0", pub);
        Assert.True(s.Certified); Assert.True(s.Original);

        var fremd = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var fremdPub = Convert.ToBase64String(fremd.ExportSubjectPublicKeyInfo());
        PluginSeal.Sign(dir, "demo", "1.2.0", fremd, issuer: "acme");
        var f = PluginSeal.Check(dir, "demo", "1.2.0", pub, fremdPub);
        Assert.True(f.Certified); Assert.False(f.Original); Assert.Equal("acme", f.Issuer);

        PluginSeal.Sign(dir, "demo", "1.2.0", fremd);   // Herausgeber „journali“ mit fremdem Schlüssel
        var falsch = PluginSeal.Check(dir, "demo", "1.2.0", pub, fremdPub);
        Assert.False(falsch.Certified); Assert.False(falsch.Original);
        Assert.Equal("Herausgeber journali ohne den Schlüssel von journali", falsch.Grund);
    }

    [Fact]
    public void Ohne_Zertifikat_kein_Siegel_und_kein_Grund()
    {
        var (dir, _, pub) = Welt();
        var s = PluginSeal.Check(dir, "demo", "1.2.0", pub);
        Assert.False(s.Certified);
        Assert.Null(s.Grund);
    }

    [Fact]
    public void Signiert_und_unveraendert_ist_zertifiziert()
    {
        var (dir, priv, pub) = Welt();
        var c = PluginSeal.Sign(dir, "demo", "1.2.0", priv);
        var s = PluginSeal.Check(dir, "demo", "1.2.0", pub);
        Assert.True(s.Certified, s.Grund);
        Assert.Equal(c.Issued, s.Issued);
        Assert.Equal("journali", s.Issuer);
    }

    [Fact]
    public void Eine_geaenderte_Datei_bricht_das_Siegel()
    {
        var (dir, priv, pub) = Welt();
        PluginSeal.Sign(dir, "demo", "1.2.0", priv);
        File.WriteAllText(Path.Combine(dir, "src", "a.js"), "// b");
        var s = PluginSeal.Check(dir, "demo", "1.2.0", pub);
        Assert.False(s.Certified);
        Assert.Equal("Dateien verändert", s.Grund);
    }

    [Fact]
    public void Eine_neue_Datei_bricht_das_Siegel_node_modules_nicht()
    {
        var (dir, priv, pub) = Welt();
        PluginSeal.Sign(dir, "demo", "1.2.0", priv);
        File.WriteAllText(Path.Combine(dir, "node_modules", "y.js"), "// neu");
        Assert.True(PluginSeal.Check(dir, "demo", "1.2.0", pub).Certified);
        File.WriteAllText(Path.Combine(dir, "extra.js"), "// neu");
        Assert.False(PluginSeal.Check(dir, "demo", "1.2.0", pub).Certified);
    }

    [Fact]
    public void Ignorierte_Pfade_duerfen_sich_aendern()
    {
        var (dir, priv, pub) = Welt();
        Directory.CreateDirectory(Path.Combine(dir, "export"));
        PluginSeal.Sign(dir, "demo", "1.2.0", priv, new[] { "export" });
        File.WriteAllText(Path.Combine(dir, "export", "out.xml"), "<x/>");
        Assert.True(PluginSeal.Check(dir, "demo", "1.2.0", pub).Certified);
    }

    [Fact]
    public void Andere_Version_oder_anderer_Schluessel_bricht_das_Siegel()
    {
        var (dir, priv, pub) = Welt();
        PluginSeal.Sign(dir, "demo", "1.2.0", priv);
        Assert.Contains("Version", PluginSeal.Check(dir, "demo", "1.3.0", pub).Grund);
        Assert.Equal("Signatur passt nicht", PluginSeal.Check(dir, "demo", "1.2.0", Convert.ToBase64String(ECDsa.Create(ECCurve.NamedCurves.nistP256).ExportSubjectPublicKeyInfo())).Grund);
    }

    /// <summary>Die Core-Plugins (die mit journali ausgelieferten) tragen ein Zertifikat aus tools/plugin-cert.mjs — der Server muss es mit dem eingebauten
    /// Schlüssel bestätigen. Bricht das, wurde ein Plugin geändert und nicht neu signiert (node tools/plugin-cert.mjs sign key).</summary>
    [Fact]
    public void Core_Plugins_mit_Zertifikat_sind_gueltig()
    {
        var plugins = PluginVerzeichnis();
        var broken = new List<string>();
        foreach (var dir in Directory.GetDirectories(plugins))
        {
            if (!File.Exists(Path.Combine(dir, PluginSeal.FileName))) continue;
            var m = PluginApi.Scan(plugins)[Path.GetFileName(dir)];
            if (!m.Seal.Certified) broken.Add($"{m.Key}: {m.Seal.Grund}");
        }
        Assert.Empty(broken);
    }

    /// <summary>
    /// Jedes ausgelieferte Plugin hat ein Siegel (27.09.2026): ein <b>fehlendes</b> fiel bis dahin niemandem auf — der
    /// Prüfstand oben sah nur die, die schon eines hatten, und ein neues Plugin rutschte ungesiegelt durch.
    /// Signiert wird mit <c>node tools/plugin-cert.mjs sign &lt;key&gt;</c>, nach dem Bau.
    /// </summary>
    [Fact]
    public void Jedes_Core_Plugin_hat_ein_Zertifikat()
    {
        var plugins = PluginVerzeichnis();
        var ohne = Directory.GetDirectories(plugins)
            .Where(d => File.Exists(Path.Combine(d, "plugin.json")) && !File.Exists(Path.Combine(d, PluginSeal.FileName)))
            .Select(Path.GetFileName)
            .Order()
            .ToList();
        Assert.Empty(ohne);
    }

    /// <summary>Das Verzeichnis <c>plugins/</c> im Repo — gesucht vom Bau aufwärts.</summary>
    private static string PluginVerzeichnis()
    {
        for (var d = new DirectoryInfo(AppContext.BaseDirectory); d is not null; d = d.Parent)
        {
            var p = Path.Combine(d.FullName, "plugins");
            if (File.Exists(Path.Combine(p, "table", "plugin.json"))) return p;
        }
        Assert.Fail("plugins/ nicht gefunden");
        return "";
    }

    [Fact]
    public void Der_Hash_ist_unabhaengig_von_der_Reihenfolge_der_Platte()
    {
        var (dir, _, _) = Welt();
        var h1 = PluginSeal.Hash(dir);
        Assert.Equal(new[] { "entry.js", "plugin.json", "src/a.js" }, PluginSeal.Files(dir, Array.Empty<string>()));
        Assert.Equal(h1, PluginSeal.Hash(dir));
        Assert.Equal(64, h1.Length);
    }
}
