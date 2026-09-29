using System.Net;
using System.Text;
using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Die Fuge der Zugänge (28.09.2026): Pfade eines fernen Zugangs, WebDAV hinter einem gefälschten HTTP-Weg, die Zeilen
/// einer FTP-Liste, die Weiterleitung einer Anmeldung, und die Fächer eines Jobs an einem Zugang — holen und ablegen.
/// Kein Netz: WebDAV und Weiterleitung laufen gegen einen Handler, die Fächer gegen einen Treiber im Speicher.
/// </summary>
public class TreiberTests
{
    // ---- Pfade ----------------------------------------------------------------------------

    [Fact]
    public void Ein_ferner_Pfad_hat_eine_feste_Form_und_kommt_nie_ueber_die_Wurzel()
    {
        Assert.Equal("/", Treiber.Normal(null));
        Assert.Equal("/a/b", Treiber.Normal("a//b/"));
        Assert.Equal("/a/b", Treiber.Normal("\\a\\.\\b"));
        Assert.Throws<ArgumentException>(() => Treiber.Normal("/a/../b"));
        Assert.Null(Treiber.Vater("/"));
        Assert.Equal("/", Treiber.Vater("/a"));
        Assert.Equal("/a", Treiber.Vater("/a/b"));
        Assert.Equal("/a/b c", Treiber.Kind("/a", "b c"));
        Assert.True(Treiber.Passt("Daten.JSON", ["*.json", "*.csv"]));
        Assert.False(Treiber.Passt("daten.xml", ["*.json"]));
        Assert.True(Treiber.Passt("x", ["*"]));
    }

    // ---- WebDAV ---------------------------------------------------------------------------

    /// <summary>Ein HTTP-Weg, der antwortet wie ein WebDAV-Server und sich merkt, was gefragt wurde.</summary>
    private sealed class DavServer : HttpMessageHandler
    {
        public readonly List<(string Methode, string Pfad, Dictionary<string, string> Kopf, string? Inhalt)> Rufe = new();
        public readonly Dictionary<string, byte[]> Dateien = new();
        public HttpStatusCode MkcolAntwort = HttpStatusCode.Created;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
        {
            var kopf = req.Headers.ToDictionary(h => h.Key, h => string.Join(",", h.Value));
            var inhalt = req.Content is null ? null : await req.Content.ReadAsStringAsync(ct);
            Rufe.Add((req.Method.Method, req.RequestUri!.AbsolutePath, kopf, inhalt));
            return req.Method.Method switch
            {
                "PROPFIND" => new HttpResponseMessage((HttpStatusCode)207) { Content = new StringContent("""
                    <?xml version="1.0"?><d:multistatus xmlns:d="DAV:">
                      <d:response><d:href>/dav/ablage/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
                      <d:response><d:href>/dav/ablage/Unter%20Ordner/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
                      <d:response><d:href>/dav/ablage/preise.csv</d:href><d:propstat><d:prop><d:resourcetype/><d:getcontentlength>42</d:getcontentlength><d:getlastmodified>Sun, 27 Sep 2026 10:00:00 GMT</d:getlastmodified></d:prop></d:propstat></d:response>
                      <d:response><d:href>/dav/ablage/.versteckt</d:href><d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat></d:response>
                    </d:multistatus>
                    """, Encoding.UTF8, "application/xml") },
                "MKCOL" => new HttpResponseMessage(MkcolAntwort),
                "GET" => Dateien.TryGetValue(req.RequestUri.AbsolutePath, out var b) ? new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(b) } : new HttpResponseMessage(HttpStatusCode.NotFound),
                "PUT" => Put(req.RequestUri.AbsolutePath, inhalt),
                _ => new HttpResponseMessage(HttpStatusCode.Created),
            };
        }
        private HttpResponseMessage Put(string pfad, string? inhalt) { Dateien[pfad] = Encoding.UTF8.GetBytes(inhalt ?? ""); return new HttpResponseMessage(HttpStatusCode.Created); }
    }

    [Fact]
    public async Task WebDAV_listet_ueber_PROPFIND_und_antwortet_in_der_Form_des_Browsers()
    {
        var dav = new DavServer();
        var t = new WebDavTreiber("https://dav.example.invalid/dav/", "anna", "geheim", dav);
        var liste = await t.ListeAsync("/ablage");
        Assert.Equal("PROPFIND", dav.Rufe[0].Methode);
        Assert.Equal("/dav/ablage/", dav.Rufe[0].Pfad);
        Assert.Equal("1", dav.Rufe[0].Kopf["Depth"]);
        Assert.StartsWith("Basic ", dav.Rufe[0].Kopf["Authorization"]);
        Assert.Equal(3, liste.Count);   // das Verzeichnis selbst fällt weg
        var ordner = Assert.Single(liste, e => e.Verzeichnis);
        Assert.Equal(("Unter Ordner", "/ablage/Unter Ordner"), (ordner.Name, ordner.Pfad));
        var datei = liste.Single(e => e.Name == "preise.csv");
        Assert.Equal(42, datei.Bytes);
        Assert.Equal(new DateTimeOffset(2026, 9, 27, 10, 0, 0, TimeSpan.Zero), datei.Zeit);

        // dieselbe Form wie /api/files: versteckte Einträge weg, Wurzel des Zugangs, Vater
        var antwort = JsonSerializer.SerializeToElement(Treiber.Antwort("Ablage", "/ablage", liste));
        Assert.Equal("/", antwort.GetProperty("parent").GetString());
        Assert.Equal("/", antwort.GetProperty("roots")[0].GetProperty("path").GetString());
        Assert.Equal(1, antwort.GetProperty("dirs").GetArrayLength());
        Assert.Equal(1, antwort.GetProperty("files").GetArrayLength());
    }

    [Fact]
    public async Task WebDAV_legt_an_benennt_um_schreibt_und_liest()
    {
        var dav = new DavServer();
        var t = new WebDavTreiber("https://dav.example.invalid/dav", null, null, dav);
        await t.NeuesVerzeichnisAsync("/neu");
        dav.MkcolAntwort = HttpStatusCode.MethodNotAllowed;   // gibt es schon — kein Fehler
        await t.NeuesVerzeichnisAsync("/neu");
        await t.UmbenennenAsync("/a.csv", "/abgeholt/a b.csv");
        var move = dav.Rufe.Single(r => r.Methode == "MOVE");
        Assert.Equal("https://dav.example.invalid/dav/abgeholt/a%20b.csv", move.Kopf["Destination"]);
        Assert.Equal("F", move.Kopf["Overwrite"]);
        await t.SchreibenAsync("/out/x.txt", new MemoryStream(Encoding.UTF8.GetBytes("hallo")));
        await using var s = await t.LesenAsync("/out/x.txt");
        Assert.Equal("hallo", await new StreamReader(s).ReadToEndAsync());
        Assert.False(dav.Rufe.Any(r => r.Kopf.ContainsKey("Authorization")), "ohne Anwendername keine Anmeldung");
        Assert.Throws<ArgumentException>(() => new WebDavTreiber("ftp://x", null, null));
    }

    // ---- FTP ------------------------------------------------------------------------------

    [Fact]
    public void FTP_liest_Unix_und_DOS_Zeilen_und_uebergeht_den_Rest()
    {
        var jetzt = new DateTimeOffset(2026, 9, 28, 12, 0, 0, TimeSpan.Zero);
        var d = FtpTreiber.Zeile("drwxr-xr-x    2 ftp  ftp      4096 Sep 27 10:00 eingang", jetzt)!;
        Assert.True(d.Verzeichnis); Assert.Equal("eingang", d.Name); Assert.Equal(new DateTimeOffset(2026, 9, 27, 10, 0, 0, TimeSpan.Zero), d.Zeit);
        var f = FtpTreiber.Zeile("-rw-r--r--    1 ftp  ftp     12345 Jan  5  2025 preise 2025.csv", jetzt)!;
        Assert.False(f.Verzeichnis); Assert.Equal("preise 2025.csv", f.Name); Assert.Equal(12345, f.Bytes); Assert.Equal(2025, f.Zeit!.Value.Year);
        var zukunft = FtpTreiber.Zeile("-rw-r--r-- 1 u g 1 Dec 30 08:00 alt.txt", jetzt)!;
        Assert.Equal(2025, zukunft.Zeit!.Value.Year);   // Dezember liegt noch vor uns: das war letztes Jahr
        var link = FtpTreiber.Zeile("lrwxrwxrwx 1 u g 7 Sep 27 10:00 aktuell -> v2", jetzt)!;
        Assert.Equal("aktuell", link.Name);
        var dos = FtpTreiber.Zeile("09-27-26  03:15PM       <DIR>          Ablage", jetzt)!;
        Assert.True(dos.Verzeichnis); Assert.Equal(15, dos.Zeit!.Value.Hour);
        var dosDatei = FtpTreiber.Zeile("09-27-2026  12:05AM               512 a.json", jetzt)!;
        Assert.Equal((512L, 0), (dosDatei.Bytes, dosDatei.Zeit!.Value.Hour));
        Assert.Null(FtpTreiber.Zeile("total 12", jetzt));
        Assert.Throws<ArgumentException>(() => new FtpTreiber("ftp://x/y", 21, null, null, null, false));
        Assert.Equal("/start/a", new FtpTreiber("ftp.example.invalid", 21, null, null, "start", false).Voll("a"));
    }

    // ---- Weiterleitung einer Anmeldung ----------------------------------------------------

    [Fact]
    public void Die_Weiterleitung_bleibt_unter_der_Adresse_des_Zugangs()
    {
        var z = new DriverApi.Zugang("quelle", "ixp", "Quelle", new() { ["url"] = "https://api.example.invalid/ixp/" });
        Assert.Equal("https://api.example.invalid/ixp/roots?lang=de", DriverApi.WeiterUrl(z, "/roots?lang=de").AbsoluteUri);
        Assert.Equal("https://api.example.invalid/ixp/roots", DriverApi.WeiterUrl(z, "roots").AbsoluteUri);
        Assert.Throws<ArgumentException>(() => DriverApi.WeiterUrl(z, "//andere.example.invalid/x"));
        Assert.Throws<ArgumentException>(() => DriverApi.WeiterUrl(z, "/../admin"));
        Assert.Throws<ArgumentException>(() => DriverApi.WeiterUrl(z, "/x?u=https://andere.example.invalid"));
        Assert.Throws<ArgumentException>(() => DriverApi.WeiterUrl(z with { Felder = new() }, "/"));
    }

    [Fact]
    public void Die_Anmeldung_haengt_je_Art_am_Kopf()
    {
        var ixp = new DriverApi.Zugang("q", "ixp", "Q", new());
        Assert.Equal(("Bearer", "t0k"), (DriverApi.Anmeldung(ixp, new Dictionary<string, string> { ["token"] = "t0k" })!.Scheme, DriverApi.Anmeldung(ixp, new Dictionary<string, string> { ["token"] = "t0k" })!.Parameter));
        Assert.Null(DriverApi.Anmeldung(ixp, new Dictionary<string, string>()));
        var solr = new DriverApi.Zugang("s", "solr", "S", new() { ["user"] = "leser" });
        var basic = DriverApi.Anmeldung(solr, new Dictionary<string, string> { ["password"] = "pw" })!;
        Assert.Equal("Basic", basic.Scheme);
        Assert.Equal("leser:pw", Encoding.UTF8.GetString(Convert.FromBase64String(basic.Parameter!)));
        Assert.Null(DriverApi.Anmeldung(solr with { Felder = new() }, new Dictionary<string, string>()));
        Assert.Contains("webdav", DriverApi.Arten.Select(a => a.Key));
        Assert.All(DriverApi.Arten.Where(a => DriverApi.Anmeldungen.Contains(a.Key)), a => Assert.False(a.Dateien));
    }

    [Fact]
    public void Die_Art_http_traegt_ihre_Anmeldung_je_Wahl()
    {
        var basis = new Dictionary<string, string> { ["url"] = "https://api.example.invalid" };
        // Bearer: das Geheimnis „secret“ als Token, kein zusaetzlicher Kopf
        var bearer = new DriverApi.Zugang("h", "http", "H", new(basis) { ["auth"] = "bearer" });
        var b = DriverApi.Anmeldung(bearer, new Dictionary<string, string> { ["secret"] = "t0k" })!;
        Assert.Equal(("Bearer", "t0k"), (b.Scheme, b.Parameter));
        Assert.Null(DriverApi.Kopf(bearer, new Dictionary<string, string> { ["secret"] = "t0k" }));
        // Basic: Anwender und Geheimnis
        var basic = new DriverApi.Zugang("h", "http", "H", new(basis) { ["auth"] = "basic", ["user"] = "u" });
        var ba = DriverApi.Anmeldung(basic, new Dictionary<string, string> { ["secret"] = "pw" })!;
        Assert.Equal("Basic", ba.Scheme);
        Assert.Equal("u:pw", Encoding.UTF8.GetString(Convert.FromBase64String(ba.Parameter!)));
        // Eigener Kopf: kein Authorization, sondern ein benannter Kopf (X-API-Key)
        var kopf = new DriverApi.Zugang("h", "http", "H", new(basis) { ["auth"] = "header", ["header"] = "X-API-Key" });
        Assert.Null(DriverApi.Anmeldung(kopf, new Dictionary<string, string> { ["secret"] = "k" }));
        Assert.Equal(("X-API-Key", "k"), DriverApi.Kopf(kopf, new Dictionary<string, string> { ["secret"] = "k" })!.Value);
        // ohne Wahl: keine Anmeldung; http wird ueber die Weiterleitung gelesen und beschickt, liefert keine Dateien
        Assert.Null(DriverApi.Anmeldung(new DriverApi.Zugang("h", "http", "H", new(basis)), new Dictionary<string, string> { ["secret"] = "x" }));
        Assert.Contains("http", DriverApi.Anmeldungen);
        Assert.False(DriverApi.ArtVon("http")!.Dateien);
    }

    // ---- Fächer an einem Zugang und Parameter vom Typ driver ------------------------------

    /// <summary>Ein Zugang im Speicher — derselbe Vertrag wie WebDAV und FTP, ohne Netz.</summary>
    private sealed class Speicher : IDateiTreiber
    {
        public readonly Dictionary<string, byte[]> Dateien = new();
        public readonly HashSet<string> Ordner = new() { "/" };
        public Task<List<DateiEintrag>> ListeAsync(string pfad, CancellationToken ct = default)
        {
            var p = Treiber.Normal(pfad);
            var kinder = Dateien.Keys.Where(k => Treiber.Vater(k) == p).Select(k => new DateiEintrag(k.Split('/').Last(), k, false, Dateien[k].Length, DateTimeOffset.UtcNow.AddHours(-1)))
                .Concat(Ordner.Where(o => o != "/" && Treiber.Vater(o) == p).Select(o => new DateiEintrag(o.Split('/').Last(), o, true, 0, null)));
            return Task.FromResult(kinder.ToList());
        }
        public Task NeuesVerzeichnisAsync(string pfad, CancellationToken ct = default) { Ordner.Add(Treiber.Normal(pfad)); return Task.CompletedTask; }
        public Task UmbenennenAsync(string von, string nach, CancellationToken ct = default) { Dateien[Treiber.Normal(nach)] = Dateien[von]; Dateien.Remove(von); return Task.CompletedTask; }
        public Task<Stream> LesenAsync(string pfad, CancellationToken ct = default) => Task.FromResult<Stream>(new MemoryStream(Dateien[pfad]));
        public async Task SchreibenAsync(string pfad, Stream daten, CancellationToken ct = default)
        {
            if (!Ordner.Contains(Treiber.Vater(pfad)!)) throw new IOException("Ordner fehlt: " + Treiber.Vater(pfad));
            var m = new MemoryStream(); await daten.CopyToAsync(m, ct); Dateien[Treiber.Normal(pfad)] = m.ToArray();
        }
        public Task LoeschenAsync(string pfad, CancellationToken ct = default) { Dateien.Remove(pfad); return Task.CompletedTask; }
    }

    private static JsonElement Proc(string json) => JsonDocument.Parse(json).RootElement;

    [Fact]
    public async Task Der_Eingang_holt_was_passt_nach_in_und_schiebt_es_dort_nach_abgeholt()
    {
        var dir = Path.Combine(Path.GetTempPath(), "journali-treiber-" + Guid.NewGuid().ToString("N")[..8]);
        try
        {
            var fach = new JobFach(dir);
            var job = new JobState { Key = "preise", Plugin = "csv" };
            var quelle = new Speicher();
            quelle.Ordner.Add("/eingang");
            quelle.Dateien["/eingang/a.csv"] = Encoding.UTF8.GetBytes("x;y");
            quelle.Dateien["/eingang/b.csv"] = Encoding.UTF8.GetBytes("1;2");
            quelle.Dateien["/eingang/liesmich.txt"] = Encoding.UTF8.GetBytes("nicht für uns");
            var spec = JobFach.In(Proc("""{ "files": { "in": { "pattern": "*.csv", "mode": "one" } } }"""))!;
            var log = new List<string>();
            var geholt = await fach.Holen(job, quelle, "/eingang", spec, log.Add);
            Assert.Equal(["a.csv", "b.csv"], geholt);
            Assert.Empty(log);
            Assert.True(File.Exists(Path.Combine(dir, "preise", "in", "a.csv")));
            Assert.Contains("/eingang/liesmich.txt", quelle.Dateien.Keys);   // passt nicht aufs Muster: bleibt
            Assert.DoesNotContain("/eingang/a.csv", quelle.Dateien.Keys);
            Assert.Equal(2, quelle.Dateien.Keys.Count(k => k.StartsWith("/eingang/abgeholt/")));
            // die geholte Datei ist sofort dran — nicht „wird gerade geschrieben“
            var values = new Dictionary<string, string>();
            var plan = fach.Prepare(job, Proc("""{ "files": { "in": { "pattern": "*.csv", "mode": "one", "param": "source" } } }"""), "r1", values, (_, _) => { }, out var skip)!;
            Assert.Null(skip);
            Assert.Equal("a.csv", Assert.Single(plan.In).Name);
            Assert.EndsWith("a.csv", values["source"]);
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }

    [Fact]
    public async Task Die_Ausgabe_legt_ab_mit_Unterordnern_wie_im_Lauf()
    {
        var ziel = new Speicher(); ziel.Ordner.Add("/export");
        var datei = Path.GetTempFileName();
        try
        {
            await File.WriteAllTextAsync(datei, "inhalt");
            await JobFach.Ablegen(ziel, "/export", datei, "preise-20260928.csv");
            await JobFach.Ablegen(ziel, "/export", datei, Path.Combine("lauf-1", "bilder", "a.jpg"));
            Assert.Equal("inhalt", Encoding.UTF8.GetString(ziel.Dateien["/export/preise-20260928.csv"]));
            Assert.Contains("/export/lauf-1/bilder/a.jpg", ziel.Dateien.Keys);
            Assert.Contains("/export/lauf-1", ziel.Ordner);
        }
        finally { File.Delete(datei); }
    }

    [Fact]
    public void Ein_Parameter_vom_Typ_driver_bringt_Felder_und_Geheimnisse_unter_eigenem_Namen()
    {
        var dir = Path.Combine(Path.GetTempPath(), "journali-zugang-" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(dir);
        try
        {
            var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
            var zugang = new DriverApi.Zugang("quelle", "ixp", "Quelle", new() { ["url"] = "https://api.example.invalid/ixp" });
            c.With((_, _, write) => write("t", Plugins.Stream + "driver", Types.PluginDataSet, new PluginDataSet("zugang:quelle", JsonSerializer.Serialize(zugang, new JsonSerializerOptions(JsonSerializerDefaults.Web))), null));
            Secrets.Set(dir, Secrets.ProfileKey("driver", "quelle"), new() { ["token"] = "t0k" });
            var proc = Proc("""{ "params": [ { "key": "zugang", "type": "driver", "art": "ixp" } ] }""");

            var values = new Dictionary<string, string> { ["zugang"] = "quelle", ["token"] = "dienst" };
            Assert.True(JobRunner.Zugaenge(c, dir, proc, values, out var fehler), fehler);
            Assert.Equal("https://api.example.invalid/ixp", values["zugang_url"]);
            Assert.Equal("t0k", values["zugang_token"]);
            Assert.Equal("dienst", values["token"]);   // das Dienst-Token des Laufs bleibt, wie es ist

            var leer = new Dictionary<string, string>();
            Assert.True(JobRunner.Zugaenge(c, dir, proc, leer, out _));   // ohne Zugang: nichts zu tun
            Assert.Empty(leer);
            Assert.False(JobRunner.Zugaenge(c, dir, proc, new() { ["zugang"] = "gibtsnicht" }, out fehler));
            Assert.Contains("gibtsnicht", fehler);
            Assert.False(JobRunner.Zugaenge(c, dir, Proc("""{ "params": [ { "key": "zugang", "type": "driver", "art": "solr" } ] }"""), new() { ["zugang"] = "quelle" }, out fehler));
            Assert.Contains("nicht solr", fehler);
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }

    /// <summary>
    /// ixp und solr nehmen ihre Quelle aus einem Zugang (28.09.2026). Das Argument {token} gab es bei ixp als Token der
    /// Quelle — der JobRunner setzt dort aber den Dienst-Token des Laufs, die Quelle bekam also nie ihren Token.
    /// </summary>
    [Theory]
    [InlineData("ixp")]
    [InlineData("solr")]
    public void Ixp_und_Solr_nehmen_die_Quelle_aus_einem_Zugang(string key)
    {
        string? plugins = null;
        for (var d = new DirectoryInfo(AppContext.BaseDirectory); d is not null && plugins is null; d = d.Parent)
            if (File.Exists(Path.Combine(d.FullName, "plugins", key, "plugin.json"))) plugins = Path.Combine(d.FullName, "plugins");
        Assert.NotNull(plugins);
        var m = PluginApi.Scan(plugins!)[key];
        var proc = PluginApi.ProcessOf(m.Raw, "") ?? throw new Xunit.Sdk.XunitException("kein Prozess");
        var zugang = proc.GetProperty("params").EnumerateArray().Single(p => p.GetProperty("key").GetString() == "zugang");
        Assert.Equal("driver", zugang.GetProperty("type").GetString());
        Assert.Equal(key, zugang.GetProperty("art").GetString());
        Assert.DoesNotContain(proc.GetProperty("args").EnumerateArray(), a => a.GetString() == "{token}");
        Assert.DoesNotContain(proc.GetProperty("params").EnumerateArray(), p => p.GetProperty("key").GetString() == "token");
    }
}
