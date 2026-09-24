using System.Security.Cryptography;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Das Siegel eines Plugins: signiertes certificate.json über Schlüssel, Fassung und den Hash der Dateien.
/// Gültig, solange nichts verändert ist; gebrochen bei jeder Änderung an Dateien, Fassung oder Zertifikat.
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
    public void Andere_Fassung_oder_anderer_Schluessel_bricht_das_Siegel()
    {
        var (dir, priv, pub) = Welt();
        PluginSeal.Sign(dir, "demo", "1.2.0", priv);
        Assert.Contains("Fassung", PluginSeal.Check(dir, "demo", "1.3.0", pub).Grund);
        Assert.Equal("Signatur passt nicht", PluginSeal.Check(dir, "demo", "1.2.0", Convert.ToBase64String(ECDsa.Create(ECCurve.NamedCurves.nistP256).ExportSubjectPublicKeyInfo())).Grund);
    }

    /// <summary>Die Plugins im Repo tragen ein Zertifikat aus tools/plugin-cert.mjs — der Server muss es mit dem eingebauten
    /// Schlüssel bestätigen. Bricht das, wurde ein Plugin geändert und nicht neu signiert (node tools/plugin-cert.mjs sign key).</summary>
    [Fact]
    public void Eingebaute_Plugins_mit_Zertifikat_sind_gueltig()
    {
        var root = AppContext.BaseDirectory;
        string? plugins = null;
        for (var d = new DirectoryInfo(root); d is not null; d = d.Parent) { var p = Path.Combine(d.FullName, "plugins"); if (File.Exists(Path.Combine(p, "table", "plugin.json"))) { plugins = p; break; } }
        Assert.NotNull(plugins);
        var broken = new List<string>();
        foreach (var dir in Directory.GetDirectories(plugins!))
        {
            if (!File.Exists(Path.Combine(dir, PluginSeal.FileName))) continue;
            var m = PluginApi.Scan(plugins!)[Path.GetFileName(dir)];
            if (!m.Seal.Certified) broken.Add($"{m.Key}: {m.Seal.Grund}");
        }
        Assert.Empty(broken);
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
