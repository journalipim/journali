using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Licensing;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Das Abo eines Teams über den Lizenzserver (Taloan, 24.09.2026): Lizenzschlüssel aus dem Shop ins eine Feld, signierte
// Anfrage, signierter Stand ins Journal, täglich auffrischen, ohne Verbindung gilt der letzte Stand 7 Tage.
public class AboTests
{
    private static readonly DateTimeOffset Jetzt = DateTimeOffset.UtcNow;
    private static readonly DateOnly Heute = DateOnly.FromDateTime(DateTime.Now);

    /// <summary>Der Lizenzserver zum Nachstellen: prüft die Anfrage und antwortet mit einem Stand, den <see cref="Antwort"/> formt.</summary>
    private sealed class FalscherLizenzserver : HttpMessageHandler
    {
        public readonly ECDsa Aussteller = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        public Func<SignedRequest, Entitlement, Entitlement> Antwort = (_, e) => e;
        public string Plan = "enterprise";
        public string? Fehler;
        public int Anfragen;
        /// <summary>Der Schlüssel der letzten Anfrage — null, wenn sie keinen nannte (Kauf aus der Oberfläche).</summary>
        public string? LetzterKey;
        public string Pub => Signaturen.Oeffentlich(Aussteller);
        public Tarifblatt? Blatt;

        /// <summary>Wie oft das Tarifblatt allein geholt wurde (ohne Abo, ohne Schlüssel).</summary>
        public int Blattanfragen;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var anfrage = JsonSerializer.Deserialize<SignedRequest>(await request.Content!.ReadAsStringAsync(ct), KeyRequest.Json)!;
            Assert.True(anfrage.Pruefe().Ok);                                   // die Instanz signiert ihre Anfrage
            if (request.RequestUri!.AbsolutePath.EndsWith("/v1/tarife"))
            {
                Blattanfragen++;
                Assert.Equal(Tarifabruf.Art, anfrage.Inhalt!.Kind);
                Assert.Null(anfrage.Inhalt.Team);                               // sie nennt nur Instanz und Schlüssel
                Assert.Null(anfrage.Inhalt.Key);
                return new HttpResponseMessage(HttpStatusCode.OK)
                { Content = new StringContent(JsonSerializer.Serialize(Blatt ?? Tarifblaetter(Aussteller, 1, z => z), new JsonSerializerOptions(JsonSerializerDefaults.Web))) };
            }
            Anfragen++;
            Assert.EndsWith("/v1/stand", request.RequestUri.AbsolutePath);
            if (Fehler is not null) return new HttpResponseMessage(HttpStatusCode.BadRequest) { Content = new StringContent(JsonSerializer.Serialize(new { error = Fehler })) };
            var r = anfrage.Inhalt!;
            LetzterKey = r.Key;
            var t = Tarife.Saat.Von(Plan)!;
            var e = new Entitlement(r.Instance, r.Team, t.Key, t.Week, t.Month, "active", Heute.AddDays(30), Jetzt, Jetzt + Entitlement.Kulanz, anfrage.Hash, Blatt: Blatt);
            e = Antwort(anfrage, e with { Sig = Signaturen.Signiere(Aussteller, e.Rumpf) });
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(JsonSerializer.Serialize(e, new JsonSerializerOptions(JsonSerializerDefaults.Web))) };
        }
    }

    private sealed class Welt
    {
        public readonly Catalog C = new(new MemoryJournal());
        public readonly FalscherLizenzserver Server = new();
        public readonly Instanz Instanz = new(null);
        public readonly string Dir = Path.Combine(Path.GetTempPath(), "journali-abo-" + Guid.NewGuid().ToString("N"));
        public readonly FesteUhr Uhr = new(Jetzt);
        public string? Adresse = "https://lizenz.example";
        public readonly Abos Abos;
        /// <param name="vertraut">Glaubt journali diesem Lizenzserver? (Sonst ist es ein fremder Aussteller.)</param>
        public Welt(bool vertraut = true)
        {
            Directory.CreateDirectory(Dir);
            if (vertraut) Journali.Core.Licensing.Aussteller.Vertraue(Server.Pub);
            Abos = new Abos(Instanz, Dir, new HttpClient(Server), () => Adresse, Uhr);
            C.Rebuild(); C.SeedMissing();
            C.With((_, _, w) =>
            {
                w("t", Teams.Stream + "de", Types.TeamDefined, new TeamDefined("Deutschland", EntriesWeek: 10_000, EntriesMonth: 50_000), null);
                w("t", Teams.Stream + "it", Types.TeamDefined, new TeamDefined("Italien", KeysFrom: "de"), null);
                return 0;
            });
        }
    }

    private sealed class FesteUhr(DateTimeOffset jetzt) : TimeProvider
    {
        public DateTimeOffset Jetzt = jetzt;
        public override DateTimeOffset GetUtcNow() => Jetzt;
    }

    private const string Key = "495C1AF0-1CFB-4C24-824E-A46A6242841D";

    [Fact]
    public async Task Abo_verbinden_hebt_die_Grenzen_und_den_Tarif()
    {
        var w = new Welt();
        var (stand, fehler) = await w.Abos.VerbindenAsync(w.C, "de", Key, "taloan");
        Assert.Null(fehler);
        Assert.True(stand!.Geprueft);
        Assert.Equal((200_000, 1_000_000), w.C.With((_, _, _) => w.C.Teams.LimitAt("de", Heute)));
        Assert.Equal(Tarife.Enterprise, w.C.InstanzTarif);                     // der höchste Tarif gilt für alle
        Assert.Equal(Key, Secrets.Get(w.Dir, Abos.SecretKey("de"))["key"]);    // der Shop-Schlüssel liegt beim Server
        Assert.DoesNotContain(Key, w.C.With((_, _, _) => JsonSerializer.Serialize(w.C.Teams.Get("de")!.Abo)));   // nicht im Journal
    }

    [Fact]
    public async Task Ohne_Verbindung_gilt_der_letzte_Stand_sieben_Tage()
    {
        var w = new Welt();
        await w.Abos.VerbindenAsync(w.C, "de", Key, "taloan");
        Assert.NotNull(w.C.With((_, _, _) => w.C.Teams.AboAt("de", Heute.AddDays(6))));
        Assert.Null(w.C.With((_, _, _) => w.C.Teams.AboAt("de", Heute.AddDays(8))));
        Assert.Equal((10_000, 50_000), w.C.With((_, _, _) => w.C.Teams.LimitAt("de", Heute.AddDays(8))));   // danach: was das Team ohne Abo hat
    }

    [Fact]
    public async Task Eine_falsche_Signatur_wird_abgewiesen()
    {
        var w = new Welt();
        w.Server.Antwort = (_, e) => e with { Plan = "unlimited" };             // nach dem Signieren geändert
        var (stand, fehler) = await w.Abos.VerbindenAsync(w.C, "de", Key, "taloan");
        Assert.Null(stand);
        Assert.Contains("Signatur", fehler);
        Assert.Null(w.C.With((_, _, _) => w.C.Teams.Get("de")!.Abo));
    }

    /// <summary>Nur Signiertes zählt (25.09.2026): ein Lizenzserver, dessen Schlüssel journali nicht kennt, ändert nichts.</summary>
    [Fact]
    public async Task Ein_fremder_Lizenzserver_wird_abgewiesen()
    {
        var w = new Welt(vertraut: false);
        var (stand, fehler) = await w.Abos.VerbindenAsync(w.C, "de", Key, "taloan");
        Assert.Null(stand);
        Assert.Contains("Signatur", fehler);
        Assert.Null(w.C.With((_, _, _) => w.C.Teams.Get("de")!.Abo));
        Assert.Equal(Tarife.Free, w.C.InstanzTarif);
    }

    /// <summary>Ein Stand im Journal, der nicht als geprüft vermerkt ist (bis 25.09.2026 möglich), zählt nicht.</summary>
    [Fact]
    public void Ein_ungepruefter_Stand_zaehlt_nicht()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, w) =>
        {
            w("t", Teams.Stream + "de", Types.TeamDefined, new TeamDefined("DE"), null);
            w("t", Teams.Stream + "de", Types.EntitlementReceived, new EntitlementReceived("i", "de", "unlimited", Tarife.Ohne, Tarife.Ohne, "active",
                Heute.AddDays(30), Jetzt, Jetzt + Entitlement.Kulanz, "r", "sig", Geprueft: false), null);
            return 0;
        });
        Assert.Null(c.With((_, _, _) => c.Teams.AboAt("de", Heute)));
        Assert.Equal(Tarife.Free, c.InstanzTarif);
    }

    /// <summary>
    /// Das Tarifblatt kommt mit dem Stand (25.09.2026): eine neuere Fassung geht ins Journal und gilt sofort — für die
    /// Pakete, die Plugins, das Init Team. Eine ältere oder eine mit fremder Signatur ändert nichts.
    /// </summary>
    [Fact]
    public async Task Das_Tarifblatt_kommt_mit_dem_Stand()
    {
        var w = new Welt();
        w.Server.Blatt = Blatt(w.Server.Aussteller, 2, z => z.Key == "free" ? z with { Week = 12_000, Plugins = [.. z.Plugins!, "etim"] } : z);
        Assert.Null((await w.Abos.VerbindenAsync(w.C, "de", Key, "taloan")).Fehler);
        Assert.Equal(2, w.C.Tarife.Fassung);
        Assert.Equal(12_000, w.C.Tarife.Free.Week);
        Assert.True(w.C.Tarife.Free.Erlaubt("etim"));
        Assert.Equal(12_000, w.C.With((_, _, _) => w.C.Teams.Get(Model.InitTeam)!.EntriesWeek));   // das Init Team trägt die Lizenz nach der neuen Liste

        // eine ältere Fassung und eine mit fremder Signatur bleiben draussen
        w.Server.Blatt = Blatt(w.Server.Aussteller, 1, z => z with { Week = 1 });
        await w.Abos.VerbindenAsync(w.C, "de", Key, "taloan");
        using var fremd = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        w.Server.Blatt = Blatt(fremd, 9, z => z with { Week = 1 });
        await w.Abos.VerbindenAsync(w.C, "de", Key, "taloan");
        Assert.Equal(2, w.C.Tarife.Fassung);
        Assert.Equal(12_000, w.C.Tarife.Free.Week);
    }

    private static Tarifblatt Blatt(ECDsa mit, long fassung, Func<TarifZeile, TarifZeile> aendern) => Tarifblaetter(mit, fassung, aendern);

    /// <summary>Ein signiertes Blatt aus dem Saatgut — mit geänderten Zeilen und, wenn genannt, Aktionen des Shops.</summary>
    private static Tarifblatt Tarifblaetter(ECDsa mit, long fassung, Func<TarifZeile, TarifZeile> aendern, RabattZeile[]? rabatte = null)
    {
        var b = Tarife.Saat.AlsBlatt(fassung, Jetzt);
        var text = JsonSerializer.Serialize(b with { Tarife = [.. b.Tarife.Select(aendern)], Rabatte = rabatte }, TarifblattInhalt.Json);
        return new Tarifblatt(text, Signaturen.Signiere(mit, text));
    }

    /// <summary>
    /// Registriert holt die Instanz das Tarifblatt auch ohne Abo und ohne Schlüssel (26.09.2026): eine frische Anlage
    /// kennt sonst weder die Grenzen der Tarife noch die Aktionen des Shops, weil sie erst beim ersten Kauf fragen würde.
    /// </summary>
    [Fact]
    public async Task Das_Tarifblatt_kommt_auch_ohne_Abo()
    {
        var w = new Welt();
        w.C.Registrierung(true, "taloan");
        w.Server.Blatt = Tarifblaetter(w.Server.Aussteller, 4, z => z, [new RabattZeile("START50", "Einführung bis Ende Oktober", new DateOnly(2026, 10, 31))]);
        Assert.Equal(0, await w.Abos.AuffrischenAsync(w.C));                   // kein Team hat ein Abo
        Assert.Equal(0, w.Server.Anfragen);                                     // nach einem Stand fragt niemand
        Assert.Equal(1, w.Server.Blattanfragen);                                // nach dem Blatt schon
        Assert.Equal(4, w.C.Tarife.Fassung);
        Assert.Equal("START50", w.C.Tarife.RabatteAm(Heute).Single().Code);

        // und nicht bei jedem Durchlauf: erst wieder, wenn es alt ist
        await w.Abos.AuffrischenAsync(w.C);
        Assert.Equal(1, w.Server.Blattanfragen);
        w.Uhr.Jetzt = Jetzt + Abos.Auffrischen + TimeSpan.FromMinutes(1);
        await w.Abos.AuffrischenAsync(w.C);
        Assert.Equal(2, w.Server.Blattanfragen);
    }

    /// <summary>
    /// Ohne Registrierung geht nichts hinaus (26.09.2026): wer nicht zugestimmt hat, dessen Anlage fragt auch nicht nach
    /// dem Tarifblatt. Ein Team mit Abo spricht ohnehin mit dem Lizenzserver — dann kommt das Blatt mit.
    /// </summary>
    [Fact]
    public async Task Ohne_Registrierung_fragt_die_Anlage_nicht()
    {
        var w = new Welt();
        Assert.Null(w.C.Registriert);                                           // noch niemand gefragt
        Assert.Equal(0, await w.Abos.AuffrischenAsync(w.C));
        Assert.Equal(0, w.Server.Blattanfragen);

        w.C.Registrierung(false, "taloan");
        Assert.Equal(0, await w.Abos.AuffrischenAsync(w.C));
        Assert.Equal(0, w.Server.Blattanfragen);
        Assert.False(w.C.Registriert);

        // ein Abo ist Zustimmung genug: dafür spricht die Anlage ohnehin mit dem Lizenzserver
        await w.Abos.VerbindenAsync(w.C, "de", Key, "taloan");
        w.Uhr.Jetzt = Jetzt + Abos.Auffrischen + TimeSpan.FromMinutes(1);
        await w.Abos.AuffrischenAsync(w.C);
        Assert.Equal(1, w.Server.Blattanfragen);
    }

    /// <summary>Eine abgelaufene Aktion gilt nicht mehr — und eine mit fremder Signatur kommt gar nicht erst ins Journal.</summary>
    [Fact]
    public async Task Eine_abgelaufene_Aktion_gilt_nicht()
    {
        var w = new Welt();
        w.Server.Blatt = Tarifblaetter(w.Server.Aussteller, 2, z => z,
            [new RabattZeile("ALT", "abgelaufen", Heute.AddDays(-1)), new RabattZeile("JETZT", "gilt noch", Heute), new RabattZeile("IMMER", "ohne Ende")]);
        Assert.Null(await w.Abos.TarifblattAsync(w.C));
        Assert.Equal(["JETZT", "IMMER"], w.C.Tarife.RabatteAm(Heute).Select(r => r.Code));

        using var fremd = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        w.Server.Blatt = Tarifblaetter(fremd, 9, z => z, [new RabattZeile("FREMD", "nicht signiert")]);
        Assert.Null(await w.Abos.TarifblattAsync(w.C));
        Assert.Equal(2, w.C.Tarife.Fassung);
        Assert.DoesNotContain("FREMD", w.C.Tarife.Rabatte.Select(r => r.Code));
    }

    [Fact]
    public async Task Eine_Antwort_auf_eine_andere_Anfrage_wird_abgewiesen()
    {
        var w = new Welt();
        w.Server.Antwort = (_, e) => { var x = e with { Request = new string('0', 64), Sig = null }; return x with { Sig = Signaturen.Signiere(w.Server.Aussteller, x.Rumpf) }; };
        Assert.Contains("nicht zu dieser Anfrage", (await w.Abos.VerbindenAsync(w.C, "de", Key, "taloan")).Fehler);
        w.Server.Antwort = (_, e) => { var x = e with { Team = "es", Sig = null }; return x with { Sig = Signaturen.Signiere(w.Server.Aussteller, x.Rumpf) }; };
        Assert.Contains("anderes Team", (await w.Abos.VerbindenAsync(w.C, "de", Key, "taloan")).Fehler);
    }

    [Fact]
    public async Task Was_der_Lizenzserver_ablehnt_steht_da()
    {
        var w = new Welt();
        w.Server.Fehler = "Der Schlüssel gilt für eine andere Instanz oder ein anderes Team.";
        Assert.Equal(w.Server.Fehler, (await w.Abos.VerbindenAsync(w.C, "de", Key, "taloan")).Fehler);
        w.Adresse = null;
        Assert.Contains("Kein Lizenzserver", (await w.Abos.VerbindenAsync(w.C, "de", Key, "taloan")).Fehler);
        w.Adresse = "https://lizenz.example";
        Assert.Contains("anderes Team ab", (await w.Abos.VerbindenAsync(w.C, "it", Key, "taloan")).Fehler);   // Italien rechnet über Deutschland ab
    }

    [Fact]
    public async Task Taeglich_auffrischen_mit_dem_gemerkten_Schluessel()
    {
        var w = new Welt();
        await w.Abos.VerbindenAsync(w.C, "de", Key, "taloan");
        Assert.Equal(0, await w.Abos.AuffrischenAsync(w.C));                   // gerade erst geholt
        w.Uhr.Jetzt = Jetzt + Abos.Auffrischen + TimeSpan.FromMinutes(1);
        w.Server.Plan = "pro";                                                  // im Shop gewechselt
        Assert.Equal(1, await w.Abos.AuffrischenAsync(w.C));
        Assert.Equal("pro", w.C.With((_, _, _) => w.C.Teams.Get("de")!.Abo!.Plan));
        Assert.Equal(2, w.Server.Anfragen);
    }

    /// <summary>Nach einem Eingriff in der Verwaltung des Lizenzservers: sofort neu fragen, mit dem gemerkten Schlüssel.</summary>
    [Fact]
    public async Task Ein_Team_sofort_auffrischen()
    {
        var w = new Welt();
        await w.Abos.VerbindenAsync(w.C, "de", Key, "taloan");
        Assert.Equal(Key, w.Server.LetzterKey);
        w.Server.Plan = "pro";                                                  // von Hand geändert — ohne 20 Stunden zu warten
        var (stand, fehler) = await w.Abos.AuffrischenAsync(w.C, "de", "taloan");
        Assert.Null(fehler);
        Assert.Equal("pro", stand!.Plan);
        Assert.Equal("pro", w.C.With((_, _, _) => w.C.Teams.Get("de")!.Abo!.Plan));
    }

    /// <summary>
    /// Kontingent aus der Oberfläche bestellt (26.09.2026): Instanz und Team hängen am Buy-Link, der Lizenzserver behält
    /// den Schlüssel. Die Instanz fragt darum ohne Schlüssel und hinterlegt keinen — und wird weiter aufgefrischt.
    /// </summary>
    [Fact]
    public async Task Nach_einem_Kauf_fragt_die_Instanz_ohne_Schluessel()
    {
        var w = new Welt();
        Assert.Equal(0, await w.Abos.AuffrischenAsync(w.C));                   // ohne Stand und ohne Schlüssel fragt niemand
        Assert.Equal(0, w.Server.Anfragen);

        var (stand, fehler) = await w.Abos.AuffrischenAsync(w.C, "de", "taloan");
        Assert.Null(fehler);
        Assert.Equal("enterprise", stand!.Plan);
        Assert.Null(w.Server.LetzterKey);                                       // die Anfrage nennt nur Instanz und Team
        Assert.False(Secrets.Get(w.Dir, Abos.SecretKey("de")).ContainsKey("key"));

        w.Uhr.Jetzt = Jetzt + Abos.Auffrischen + TimeSpan.FromMinutes(1);
        w.Server.Plan = "pro";
        Assert.Equal(1, await w.Abos.AuffrischenAsync(w.C));                   // ein Team mit Stand wird auch ohne Schlüssel gefragt
        Assert.Equal("pro", w.C.With((_, _, _) => w.C.Teams.Get("de")!.Abo!.Plan));
    }

    [Fact]
    public void Der_juengste_Stand_gilt_auch_wenn_ein_aelterer_spaeter_kommt()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        EntitlementReceived Stand(string plan, DateTimeOffset am) => new("i", "de", plan, 1, 1, "active", Heute.AddDays(30), am, am + Entitlement.Kulanz, "r");
        c.With((_, _, w) =>
        {
            w("t", Teams.Stream + "de", Types.TeamDefined, new TeamDefined("DE"), null);
            w("t", Teams.Stream + "de", Types.EntitlementReceived, Stand("enterprise", Jetzt), null);
            w("t", Teams.Stream + "de", Types.EntitlementReceived, Stand("pro", Jetzt.AddHours(-3)), null);
            return 0;
        });
        Assert.Equal("enterprise", c.With((_, _, _) => c.Teams.Get("de")!.Abo!.Plan));
    }
}
