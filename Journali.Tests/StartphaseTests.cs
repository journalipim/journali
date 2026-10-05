using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Licensing;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>Der Schalter <see cref="Startphase"/> ist statisch: diese Tests laufen allein, nicht neben den anderen.</summary>
[CollectionDefinition("Startphase", DisableParallelization = true)]
public class StartphaseSammlung { }

/// <summary>
/// Die Startphase (05.10.2026): jedes Team hat Unlimited, nichts wird wegen eines Kontingents abgewiesen, auf einer Datenbank läuft ein Server,
/// und kein Weg fragt den Lizenzserver. Ohne den Schalter gilt alles wie bisher (die übrigen Tests).
/// </summary>
[Collection("Startphase")]
public class StartphaseTests : IDisposable
{
    public StartphaseTests() => Startphase.An = true;
    public void Dispose() => Startphase.An = false;

    private static Catalog Welt()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) =>
        {
            write("t", Users.Stream + "frei", Types.UserDefined, new UserDefined("Frei", null, "editor"), null);   // in keinem Team: sonst ohne Kontingent
            return 0;
        });
        return c;
    }

    [Fact]
    public void Alle_haben_Unlimited_und_ein_Server_laeuft()
    {
        var c = Welt();
        Assert.Equal(Tarife.Unlimited.Key, c.InstanzTarif.Key);
        Assert.Equal(Tarife.Unlimited.Key, c.Lesen((_, _) => c.TeamTarif(Model.InitTeam)).Key);
        Assert.Equal(1, c.ErlaubteServer);   // Unlimited erlaubt sonst beliebig viele — in der Startphase nicht
        Assert.Equal(0, c.Lesen((_, _) => c.LimitsAusLizenz()));
    }

    [Fact]
    public void Nichts_wird_wegen_eines_Kontingents_abgewiesen()
    {
        var c = Welt();
        c.With((_, _, write) => write("frei", "n-test", Types.AttributeSet, new AttributeSet("name", "de", null, "x"), null));   // ohne Startphase: KeinKontingentException
    }

    [Fact]
    public async Task Ohne_Adresse_fragt_kein_Weg_den_Lizenzserver()
    {
        var c = Welt();
        var gefragt = 0;
        var http = new HttpClient(new Zaehler(() => gefragt++));
        var abos = new Abos(new Instanz(null), Path.GetTempPath(), http, () => "");
        Assert.False(abos.Eingestellt);
        Assert.Equal(0, await abos.AuffrischenAsync(c, sofort: true));
        Assert.Equal("Kein Lizenzserver eingebaut.", await abos.TarifblattAsync(c));
        Assert.Equal(0, gefragt);
    }

    private sealed class Zaehler(Action gefragt) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) { gefragt(); return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK)); }
    }
}

/// <summary>Ohne Startphase gilt die Kontingentsperre — derselbe Fall wie oben, als Gegenprobe in derselben Sammlung.</summary>
[Collection("Startphase")]
public class OhneStartphaseTests
{
    [Fact]
    public void Ohne_Startphase_weist_der_Schreibpfad_ohne_Team_ab()
    {
        Startphase.An = false;
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) => write("t", Users.Stream + "frei", Types.UserDefined, new UserDefined("Frei", null, "editor"), null));
        Assert.Throws<KeinKontingentException>(() => c.With((_, _, write) => write("frei", "n-test", Types.AttributeSet, new AttributeSet("name", "de", null, "x"), null)));
        Assert.NotEqual(Tarife.Unlimited.Key, c.InstanzTarif.Key);   // eine neue Anlage hat den Test-Tarif, nicht Unlimited
    }
}
