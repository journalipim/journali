using Microsoft.Extensions.DependencyInjection;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
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
    [InlineData("/api/openapi.json", "GET", true)]
    [InlineData("/api/plugins/backup/run", "POST", true)]          // 07.10.2026: kein Prozess eines Plugins
    [InlineData("/api/plugins/etim/data/settings", "PUT", true)]   // Einstellungen der Plugins gelten für alle
    [InlineData("/api/plugins/etim/data/settings", "GET", false)]
    [InlineData("/api/media/m-1/thumb", "PUT", true)]              // Vorschaubilder überschreiben
    [InlineData("/api/media/m-1/thumb", "GET", false)]
    [InlineData("/api/auth/me/prefs", "PUT", true)]                // Ansicht von demo teilen sich alle
    [InlineData("/api/auth/login", "POST", false)]   // 07.10.2026: Anmeldung mit demo / demo
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
    [InlineData("/api/plugins/datasheet/data/settings", "PUT", true)]
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
        // die Systemobjekte der Plugins legt der Server an (die Oberfläche richtet in der Demo nichts ein): Gruppe, Attribute, Zuordnung, angemeldet
        foreach (var (plugin, gruppe) in new[] { ("dpp", "regulation_dpp"), ("ppwr", "regulation_ppwr"), ("geo", "enrich_geo") })
        {
            Assert.True(c.Lesen((m, _) => m.Groups.ContainsKey(gruppe)), gruppe);
            Assert.Contains(ClassificationApi.Registered(c.Plugins), r => r.Plugin == plugin && r.Groups.Contains(gruppe) && r.Attributes.Length > 0);
        }
        Assert.True(c.Lesen((_, _) => c.Plugins.All["dpp"].Data.ContainsKey("mapping")));
        Assert.True(c.Lesen((_, _) => c.Plugins.All["geo"].Data.ContainsKey("targets")));
        Assert.Contains("enrich_geo", c.Lesen((_, t) => t.Nodes[Model.RootNode].Groups));
        foreach (var attr in new[] { "power", "luminous_flux", "socket", "energy_class" })
            Assert.Contains(c.Lesen((m, _) => m.GroupsOf(attr).ToList()), g => g.Contains("ec001959"));
        Assert.False(c.Lesen((m, _) => m.Attributes.ContainsKey("ef011586")));   // zugeordnet, nicht angelegt
        // Vererbung (07.10.2026): Lichttechnik, Beschreibung und GEO-Texte stehen am Produkt und gelten für seine Varianten; der Name ist der eigene
        c.Lesen((m, t) =>
        {
            var variante = t.Nodes.Values.First(x => x.Role == Roles.Variant && x.AxisValues.ContainsKey("color"));
            var produkt = t.Nodes[variante.Parent!];
            foreach (var attr in new[] { "power", "luminous_flux", "protection", "dimmable", "energy_class" })
                Assert.Equal(produkt.Id, t.Resolve(m, variante, attr, null, null).From?.Id);
            foreach (var attr in new[] { "description", "geo_definition", "geo_description", "geo_faq", "geo_keywords", "geo_jsonld" })
            {
                var (wert, von) = t.Resolve(m, variante, attr, "de", null);
                Assert.False(string.IsNullOrEmpty(wert), attr);
                Assert.Equal(produkt.Id, von?.Id);
            }
            Assert.Contains("schema.org", t.Resolve(m, variante, "geo_jsonld", "en", null).Value);
            var (name, nameVon) = t.Resolve(m, variante, "name", "de", null);
            Assert.Equal(variante.Id, nameVon?.Id);
            Assert.StartsWith(t.Resolve(m, produkt, "name", "de", null).Value + ", ", name);
            return 0;
        });
        // GPC: die Veröffentlichung (Auszug) im Journal, Bricks an den Gruppen, Werte an der Gruppe gelten für die Produkte darunter
        Assert.True(c.Lesen((_, _) => c.Plugins.All["gpc"].Data.ContainsKey("release")));
        c.Lesen((m, t) =>
        {
            var gruppe = t.Nodes.Values.First(x => x.Role == Roles.Group && x.Label.GetValueOrDefault("de") == "LED-Lampen");
            Assert.Equal("10000552", t.Resolve(m, gruppe, "class_gpc", null, null).Value);
            Assert.Equal("EC001959", t.Resolve(m, gruppe, "class_etim", null, null).Value);
            var deckenleuchte = t.Nodes.Values.First(x => x.Role == Roles.Product && t.Nodes[x.Parent!].Label.GetValueOrDefault("de") == "Deckenleuchten");
            Assert.Null(t.Resolve(m, deckenleuchte, "class_etim", null, null).Value);   // die ETIM-Klasse gilt nur unter den LED-Lampen
            var produkt = t.Nodes.Values.First(x => x.Parent == gruppe.Id && x.Role == Roles.Product);
            Assert.Equal("30016052", t.Resolve(m, produkt, "gpc20000697", null, null).Value);   // LIGHT-EMITTING DIODE (LED), geerbt
            var decke = t.Nodes.Values.First(x => x.Role == Roles.Group && x.Label.GetValueOrDefault("de") == "Deckenleuchten");
            Assert.Equal("10008403", t.Resolve(m, decke, "class_gpc", null, null).Value);
            Assert.Equal("30009772", t.Resolve(m, decke, "gpc20001353", null, null).Value);    // CEILING MOUNTED
            return 0;
        });
        var vorher = c.Head;
        Demo.Einrichten(c, null, dir);
        Assert.Equal(vorher, c.Head);   // der nächste Start schreibt nichts
    }

    [Fact]
    public void Kontingent_je_Absender()
    {
        // 07.10.2026: höchstens 100 zählende Einträge am Tag je Besucher; was nicht zählt und was ohne Absender kommt (Start, Jobs), ist frei
        var a = "10.0.0." + Random.Shared.Next(1, 250) + "-" + Guid.NewGuid().ToString("N")[..6];
        Demo.Absender.Value = a;
        try
        {
            for (var i = 0; i < Demo.KontingentJeAbsender; i++) Assert.True(Demo.Zaehle(Types.AttributeSet));
            Assert.False(Demo.Zaehle(Types.AttributeSet));
            Assert.True(Demo.Zaehle(Types.GroupCreated));   // Struktur zählt nicht
            Demo.Absender.Value = a + "-anderer";
            Assert.True(Demo.Zaehle(Types.AttributeSet));
            Demo.Absender.Value = null;
            Assert.True(Demo.Zaehle(Types.AttributeSet));
            // alle Einträge, auch die nicht zählenden: höchstens Demo.EintraegeJeAbsender am Tag
            Demo.Absender.Value = a + "-struktur";
            for (var i = 0; i < Demo.EintraegeJeAbsender; i++) Assert.True(Demo.Zaehle(Types.RubricCreated));
            Assert.False(Demo.Zaehle(Types.RubricCreated));
        }
        finally { Demo.Absender.Value = null; }
        // im Schreibpfad: abgewiesen wie ein aufgebrauchtes Kontingent
        var c = Neu();
        c.ZusatzKontingent = _ => false;
        Assert.Throws<KeinKontingentException>(() => c.With((_, _, w) => w("demo", "p-x", Types.AttributeSet, new AttributeSet("name", "de", null, "x", null), null)));
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

    [Fact]
    public async Task Anmeldung_mit_demo_demo()
    {
        // 07.10.2026: die Demo verlangt eine Anmeldung — Anmeldename demo, Passwort demo; ohne Sitzung ist niemand angemeldet
        var dir = Path.Combine(Path.GetTempPath(), "journali-demo-login-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(dir);
        var c = Neu();
        Demo.Einrichten(c, null, null, dir);
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0");
        b.Services.AddSingleton(c);
        await using var app = b.Build();
        Auth.Map(app.MapGroup("/api"), dir);
        await app.StartAsync();
        using var http = new HttpClient();
        var url = app.Urls.First();
        var falsch = await http.PostAsJsonAsync(url + "/api/auth/login", new { user = "demo", password = "falsch" });
        Assert.False(falsch.IsSuccessStatusCode);
        var gut = await http.PostAsJsonAsync(url + "/api/auth/login", new { user = "demo", password = "demo" });
        Assert.True(gut.IsSuccessStatusCode, await gut.Content.ReadAsStringAsync());
        Assert.False(Demo.Gesperrt("/api/auth/login", "POST"));
        // ohne Administrator wäre die Lage „Passwort festlegen“ — in der Demo heisst sie Anmelden (die Seite zeigt sonst das falsche Formular)
        Assert.Equal(Auth.Anmeldung.Festlegen, Auth.Lage(c, dir));
        Assert.True(Demo.Gesperrt("/api/auth/password", "POST"));
    }

    [Fact]
    public void Ein_Publikationsbaum_von_Anfang_an_und_kein_zweiter()
    {
        // 07.10.2026: „Online-Shop“ aus den Bereichen des Beispielkatalogs; ein zweiter Baum wird abgewiesen wie eine Grenze des Tarifs
        var c = Neu();
        Demo.Einrichten(c);
        var baeume = c.Lesen((_, t) => t.PubTrees.ToList());
        var baum = Assert.Single(baeume);
        Assert.Equal(("Online-Shop", "web"), (baum.Name, baum.Channel));
        Assert.True(c.Lesen((_, t) => t.Nodes.Values.Count(x => x.Role == Roles.Rubric)) > 5, "Rubriken je Produktgruppe");
        Assert.Throws<TarifException>(() => c.With((_, _, write) => write(Demo.Anwender, Ids.New(Roles.Rubric), Types.RubricCreated, new RubricCreated(null, Labels.Of("x", "x"), "Zweiter", "web", null), null)));
        Assert.True(Demo.Gesperrt($"/api/nodes/{baum.Id}", "DELETE"));   // löschen: Knoten zurückziehen ist gesperrt
        Assert.Equal(0, Demo.Publikationsbaum(c));   // ein weiterer Start legt keinen zweiten an
    }
}

/// <summary>Die Lage der Anmeldung mit eingeschalteter Demo (07.10.2026): ohne Administrator hiesse sie „Passwort festlegen“, und die Seite zeigte das
/// falsche Formular. Der Schalter Demo.An ist statisch — darum in der Sammlung ohne Parallelität.</summary>
[Collection("Startphase")]
public class DemoAnmeldungTests
{
    [Fact]
    public void In_der_Demo_ist_die_Lage_Anmelden()
    {
        var dir = Path.Combine(Path.GetTempPath(), "journali-demo-lage-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(dir);
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        Demo.Einrichten(c, null, null, dir);
        Demo.An = true;
        try { Assert.Equal(Auth.Anmeldung.Anmelden, Auth.Lage(c, dir)); } finally { Demo.An = false; }
    }

    [Fact]
    public void Rueckgaengig_nimmt_den_Beispielkatalog_nicht_zurueck()
    {
        // 07.10.2026: was bis zum Ende des Einrichtens geschrieben ist (Demo.Saatkopf), bleibt — ausserhalb der Demo gilt das nicht
        Demo.Saatkopf = 10;
        try
        {
            Assert.False(Demo.Saat(5));
            Demo.An = true;
            Assert.True(Demo.Saat(5));
            Assert.True(Demo.Saat(10));
            Assert.False(Demo.Saat(11));
            Assert.False(Demo.Saat(0));
        }
        finally { Demo.An = false; Demo.Saatkopf = 0; }
    }

    [Fact]
    public async Task In_der_Demo_meldet_sich_kein_Administrator_an()
    {
        // 07.10.2026: auch wenn es einen Administrator mit Passwort gäbe — Anmeldung und Sitzung gelten in der Demo nur für demo
        var dir = Path.Combine(Path.GetTempPath(), "journali-demo-admin-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(dir);
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        Demo.Einrichten(c, null, null, dir);
        Auth.Recover(c, dir, "geheim-123456", "admin");
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Services.AddSingleton(c);
        await using var app = b.Build();
        Auth.Map(app.MapGroup("/api"), dir);
        await app.StartAsync();
        var url = app.Urls.First();
        using var vorher = new HttpClient();
        var sitzung = await vorher.PostAsJsonAsync(url + "/api/auth/login", new { user = "admin", password = "geheim-123456" });
        Assert.True(sitzung.IsSuccessStatusCode);   // ohne Demo: der Administrator meldet sich an
        var cookie = sitzung.Headers.GetValues("Set-Cookie").First().Split(';')[0];
        Demo.An = true;
        try
        {
            using var http = new HttpClient();
            Assert.Equal(System.Net.HttpStatusCode.Unauthorized, (await http.PostAsJsonAsync(url + "/api/auth/login", new { user = "admin", password = "geheim-123456" })).StatusCode);
            var demo = await http.PostAsJsonAsync(url + "/api/auth/login", new { user = "demo", password = "demo" });
            Assert.True(demo.IsSuccessStatusCode);
            // das Sitzungscookie gilt in der Demo einen Tag, nicht 30 (07.10.2026)
            var ablauf = DateTimeOffset.Parse(System.Text.RegularExpressions.Regex.Match(demo.Headers.GetValues("Set-Cookie").First(), "expires=([^;]+)").Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture);
            Assert.InRange(ablauf, DateTimeOffset.UtcNow.AddHours(23), DateTimeOffset.UtcNow.AddHours(25));
            var req = new HttpRequestMessage(HttpMethod.Get, url + "/api/auth/state"); req.Headers.Add("Cookie", cookie);
            Assert.Contains("\"user\":null", await (await new HttpClient().SendAsync(req)).Content.ReadAsStringAsync());   // die Sitzung des Administrators gilt nicht
        }
        finally { Demo.An = false; }
    }
}
