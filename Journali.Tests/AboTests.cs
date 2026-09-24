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
        public string Pub => Signaturen.Oeffentlich(Aussteller);

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Anfragen++;
            Assert.EndsWith("/v1/stand", request.RequestUri!.AbsolutePath);
            var anfrage = JsonSerializer.Deserialize<SignedRequest>(await request.Content!.ReadAsStringAsync(ct), KeyRequest.Json)!;
            Assert.True(anfrage.Pruefe().Ok);                                   // die Instanz signiert ihre Anfrage
            if (Fehler is not null) return new HttpResponseMessage(HttpStatusCode.BadRequest) { Content = new StringContent(JsonSerializer.Serialize(new { error = Fehler })) };
            var r = anfrage.Inhalt!;
            var t = Tarife.Von(Plan)!;
            var e = new Entitlement(r.Instance, r.Team, t.Key, t.Week, t.Month, "active", Heute.AddDays(30), Jetzt, Jetzt + Entitlement.Kulanz, anfrage.Hash);
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
        public string? Pub;
        public readonly Abos Abos;
        public Welt(bool mitPub = true)
        {
            Directory.CreateDirectory(Dir);
            Pub = mitPub ? Server.Pub : null;
            Abos = new Abos(Instanz, Dir, new HttpClient(Server), () => Adresse, () => Pub, Uhr);
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

    [Fact]
    public async Task Ohne_oeffentlichen_Schluessel_wird_angenommen_aber_als_ungeprueft_vermerkt()
    {
        var w = new Welt(mitPub: false);
        var (stand, _) = await w.Abos.VerbindenAsync(w.C, "de", Key, "taloan");
        Assert.False(stand!.Geprueft);
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
