using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Demo (07.10.2026): in ein leeres Journal kommt ein Beispielkatalog mit Bildern über den gewöhnlichen Schreibweg, dazu Rolle und Anwender demo.
/// Ein zweiter Start schreibt nichts; die Rolle sieht alles und ändert nur Werte; Konto, Hochladen, Profile und Einstellungen sind gesperrt.
/// </summary>
public class DemoTests
{
    private static Catalog Neu()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        return c;
    }

    [Fact]
    public void Ein_leeres_Journal_bekommt_den_Beispielkatalog_Rolle_und_Anwender()
    {
        var c = Neu();
        var (n, bilder) = Demo.Einrichten(c);
        Assert.True(n > 500, $"{n} Einträge");
        Assert.Equal(0, bilder);   // ohne Medienspeicher keine Bilder

        var (produkte, varianten, gruppen) = c.Lesen((_, t) => (t.Nodes.Values.Count(x => x.Role == Roles.Product), t.Nodes.Values.Count(x => x.Role == Roles.Variant), t.Nodes.Values.Count(x => x.Role == Roles.Group)));
        Assert.Equal(42, produkte);
        Assert.InRange(varianten, 84, 126);
        Assert.Equal(1 + 3 + 7, gruppen);
        Assert.True(c.Lesen((m, _) => m.Attributes.ContainsKey("luminous_flux") && m.Lists.ContainsKey("socket") && m.Units.ContainsKey("lm")));

        var rolle = c.Lesen((_, _) => c.Users.Roles[Demo.Rolle]);
        Assert.True(rolle.Rights.ToHashSet().SetEquals(Demo.Rechte));
        foreach (var verwaltung in new[] { Rights.Model, Rights.Users, Rights.Plugins, Rights.Jobs, Rights.Storage, Rights.Team, Rights.ScriptumWrite, Rights.ScriptumRun })
            Assert.DoesNotContain(verwaltung, Auth.RightsOf(c, Demo.Rolle));
        var anwender = c.Lesen((_, _) => c.Users.All[Demo.Anwender]);
        Assert.Equal((Demo.Rolle, true, Model.InitTeam), (anwender.Role, anwender.Enabled, anwender.Team));
        Assert.Equal((Demo.Anwender, Demo.Rolle), Demo.Besucher(c));

        Assert.Equal((0, 0), Demo.Einrichten(c));   // der nächste Start schreibt nichts
    }

    [Fact]
    public void Jede_Variante_und_jedes_Produkt_hat_ein_Bild_gleiche_Bilder_einmal()
    {
        var dir = Directory.CreateTempSubdirectory("demo-bilder").FullName;
        try
        {
            var c = Neu();
            var (_, bilder) = Demo.Einrichten(c, new FileMediaStore(dir));
            var (knoten, ohneBild, medien) = c.Lesen((_, t) =>
            {
                var k = t.Nodes.Values.Where(x => x.Role is Roles.Product or Roles.Variant).ToList();
                return (k.Count, k.Count(x => !c.Relations.From(x.Id).Any(r => r.Type == "image")), c.Media.All.Count);
            });
            Assert.Equal(0, ohneBild);
            Assert.Equal(bilder, medien);
            Assert.InRange(bilder, 40, knoten);   // gleiche Zeichnung, ein Medium
            Assert.All(c.Lesen((_, _) => c.Media.All.Values.ToList()), m => Assert.Equal("image/png", m.Mime));
        }
        finally { Directory.Delete(dir, true); }
    }

    [Fact]
    public void Ein_Bild_ist_ein_gueltiges_PNG()
    {
        var png = DemoBilder.Png(new DemoBilder.Wunsch("tisch", "rund", "gold", 2700));
        Assert.Equal(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, png[..8]);
        Assert.Equal("IHDR", System.Text.Encoding.ASCII.GetString(png, 12, 4));
        Assert.Equal((uint)DemoBilder.Groesse, (uint)(png[16] << 24 | png[17] << 16 | png[18] << 8 | png[19]));
        Assert.InRange(png.Length, 2_000, 400_000);
        foreach (var art in new[] { "decke", "wand", "pendel", "weg", "strahler" })
            Assert.NotEqual(png, DemoBilder.Png(new DemoBilder.Wunsch(art, "rund", "gold", 2700)));
        Assert.NotEqual(DemoBilder.Png(new DemoBilder.Wunsch("lampe", "rund", null, 2700, "e27")), DemoBilder.Png(new DemoBilder.Wunsch("lampe", "rund", null, 2700, "gu10")));
    }

    [Fact]
    public void Ein_Journal_mit_Produkten_bekommt_keinen_Katalog_dazu()
    {
        var c = Neu();
        Demo.Einrichten(c);
        var vorher = c.Head;
        c.With((_, _, write) => write("demo", Auth.Stream + Demo.Anwender, Types.UserDefined, new UserDefined("Demo", null, "admin", true, null), null));
        Assert.Equal((1, 0), Demo.Einrichten(c));   // nur der Anwender wird zurückgestellt, kein zweiter Katalog
        Assert.Equal(vorher + 2, c.Head);
        Assert.Equal(Demo.Rolle, c.Lesen((_, _) => c.Users.All[Demo.Anwender]).Role);
    }

    [Theory]
    [InlineData("/api/auth/password", "POST", true)]
    [InlineData("/api/auth/login", "POST", true)]
    [InlineData("/API/AUTH/SETUP", "POST", true)]
    [InlineData("/api/auth/claim", "POST", true)]
    [InlineData("/api/auth/tokens", "POST", true)]
    [InlineData("/api/auth/tokens/abc", "DELETE", true)]
    [InlineData("/api/auth/tokens", "GET", false)]
    [InlineData("/api/auth/state", "GET", false)]
    [InlineData("/api/media", "POST", true)]
    [InlineData("/api/media", "GET", false)]
    [InlineData("/api/media/fetch", "POST", true)]
    [InlineData("/api/media/blob/abc", "PUT", true)]
    [InlineData("/api/media/derive", "POST", true)]
    [InlineData("/api/media/presets/web", "PUT", true)]
    [InlineData("/api/media/presets", "GET", false)]
    [InlineData("/api/workflows/redaktion", "PUT", true)]
    [InlineData("/api/workflows/applicable", "POST", false)]
    [InlineData("/api/nodes/p-1/workflow/redaktion/review", "POST", false)]
    [InlineData("/api/drivers", "GET", false)]
    [InlineData("/api/drivers/lokal/list", "GET", true)]
    [InlineData("/api/files", "GET", true)]
    [InlineData("/api/plugins/datasheet/data/layout:standard", "PUT", true)]
    [InlineData("/api/plugins/xliff/data/profile:abc", "DELETE", true)]
    [InlineData("/api/plugins/datasheet/data/settings", "PUT", false)]
    [InlineData("/api/plugins/datasheet/data", "GET", false)]
    [InlineData("/api/plugins/xliff/secrets/abc", "PUT", true)]
    [InlineData("/api/tree", "POST", false)]
    [InlineData("/api/nodes/import", "POST", true)]
    [InlineData("/api/nodes/p-1", "DELETE", true)]
    [InlineData("/api/media/m-1", "DELETE", true)]
    [InlineData("/api/nodes/p-1/undo", "POST", false)]
    [InlineData("/api/classification/retire", "POST", true)]
    public void Gesperrt_sind_Konto_Hochladen_Einstellungen_und_Profile(string pfad, string methode, bool gesperrt) =>
        Assert.Equal(gesperrt, Demo.Gesperrt(pfad, methode));

    [Fact]
    public void Die_erlaubten_Plugins_sind_an_ohne_Netz_und_ohne_Zugaenge()
    {
        string? dir = null;
        for (var d = new DirectoryInfo(AppContext.BaseDirectory); d is not null && dir is null; d = d.Parent)
            if (File.Exists(Path.Combine(d.FullName, "plugins", "table", "plugin.json"))) dir = Path.Combine(d.FullName, "plugins");
        Assert.NotNull(dir);
        var c = Neu();
        PluginApi.AutoInstall(c, dir!);   // wie beim Start: zuerst die Saat, dann die Demo
        Demo.Einrichten(c, null, dir);
        var an = c.Lesen((_, _) => c.Plugins.All.Values.Where(p => p.Enabled).Select(p => p.Key).ToHashSet());
        foreach (var k in new[] { "table", "csv", "datasheet", "xliff", "geo", "docs", "dpp", "ppwr", "empco" }) Assert.Contains(k, an);
        foreach (var k in Demo.OhnePlugins.Concat(["embed", "ocr"])) Assert.DoesNotContain(k, an);
        Assert.NotNull(c.Lesen((_, _) => c.Plugins.All["dpp"].Acknowledged));   // der Hinweis gilt als bestätigt
        // ETIM: an, mit EC001959 an den LED-Lampen; die zugeordneten Attribute stehen in der Gruppe der Klasse, ohne Kopie
        Assert.Contains("etim", an);
        Assert.True(c.Lesen((_, _) => c.Plugins.All["etim"].Data.ContainsKey($"class:{Demo.EtimFreigabe}:{Demo.EtimKlasse}")));
        Assert.True(c.Lesen((m, _) => m.Attributes.ContainsKey("class_etim")));
        foreach (var attr in new[] { "power", "luminous_flux", "socket", "energy_class" })
            Assert.Contains(c.Lesen((m, _) => m.GroupsOf(attr).ToList()), g => g.Contains("ec001959"));
        Assert.False(c.Lesen((m, _) => m.Attributes.ContainsKey("ef011586")));   // zugeordnet, nicht angelegt
        var vorher = c.Head;
        Demo.Einrichten(c, null, dir);
        Assert.Equal(vorher, c.Head);   // der nächste Start schreibt nichts
    }

    [Fact]
    public void Stapel_ohne_Massenbearbeitung_und_ohne_Zurueckziehen()
    {
        Assert.False(Demo.StapelGesperrt(Enumerable.Repeat("attribute.set", Demo.MaxStapel).ToList()));
        Assert.True(Demo.StapelGesperrt(Enumerable.Repeat("attribute.set", Demo.MaxStapel + 1).ToList()));
        Assert.True(Demo.StapelGesperrt(["attribute.set", "node.retire"]));
        Assert.True(Demo.StapelGesperrt(["media.retire"]));
        Assert.False(Demo.StapelGesperrt(["product.create", "attribute.set", "relation.retire"]));
    }

    [Fact]
    public void Nach_dem_Einrichten_gilt_das_Kontingent_der_Beispielkatalog_zaehlt_nicht()
    {
        var c = Neu();   // ohne Startphase (Vorgabe der Tests): das Kontingent wirkt wie in der Demo
        Demo.Einrichten(c);
        var team = c.Lesen((_, _) => c.Teams.Get(Model.InitTeam))!;
        Assert.Equal((Demo.Kontingent, Demo.Kontingent), (team.EntriesWeek, team.EntriesMonth));
        var variante = c.Lesen((_, t) => t.Nodes.Values.First(x => x.Role == Roles.Variant).Id);
        Outcome Gewicht(int i) => c.With((model, tree, write) => Commands.SetAttribute(
            new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Write = (stream, type, payload) => write(Demo.Anwender, stream, type, payload, null) },
            variante, "weight", null, null, (1 + i % 2).ToString(), null));
        for (var i = 0; i < Demo.Kontingent; i++) Assert.Null(Gewicht(i).Error);
        Assert.Throws<KeinKontingentException>(() => Gewicht(Demo.Kontingent));
    }

    [Fact]
    public void Ean_hat_die_Pruefziffer() => Assert.Equal("4006381333931", Demo.Ean("400638133393"));
}
