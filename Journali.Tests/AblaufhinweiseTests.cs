using Journali.Core.Entries;
using Journali.Core.Projections;
using Journali.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Journali.Tests;

/// <summary>
/// Erinnerung vor dem Ablauf (07.10.2026): 14 Tage vorher, für Test, Lizenz, Schlüssel und Abos, die sich nicht selbst verlängern — ein Monatsabo,
/// das gleich nach dem Kauf gekündigt wird, erinnert vor dem Ende des bezahlten Monats; ein laufendes Abo nicht.
/// </summary>
public class AblaufhinweiseTests
{
    private static readonly DateOnly Heute = new(2026, 10, 7);

    private static TeamState Team(string key, string? status = null, int? bezahltIn = null, int? schluesselIn = null)
    {
        var t = new TeamState { Key = key, Label = key.ToUpperInvariant() };
        if (status is not null)
            t.Abo = new EntitlementReceived("i", key, "pro", 0, 0, status, Heute.AddDays(bezahltIn!.Value), DateTimeOffset.Now, DateTimeOffset.Now.AddDays(7), "r", Geprueft: true);
        if (schluesselIn is { } s) t.Windows.Add(new LimitWindow("k-" + key, Heute.AddDays(-10), Heute.AddDays(s), 100, 1000, 1, "pro"));
        return t;
    }

    [Fact]
    public void Erinnert_14_Tage_vorher_nur_an_was_nicht_von_selbst_weiterlaeuft()
    {
        var teams = new[]
        {
            Team("laufend", "active", 3),        // verlängert sich selbst — kein Hinweis
            Team("gekuendigt", "cancelled", 9),  // gleich nach dem Kauf gekündigt: endet mit dem bezahlten Monat
            Team("spaet", "cancelled", 30),      // noch nicht in den 14 Tagen
            Team("offen", "past_due", 2),        // Zahlung offen
            Team("schluessel", schluesselIn: 5),
        };
        var test = new Licence("enterprise", ValidUntil: Heute.AddDays(12), Trial: true);
        var bald = Ablaufhinweise.Bald(test, true, teams, Tarife.Saat, Heute);
        Assert.Equal(["offen", "schluessel", "gekuendigt", null], bald.Select(a => a.Team));   // das Nächste zuerst
        Assert.Equal(["abo", "schluessel", "abo", "test"], bald.Select(a => a.Was));
        Assert.Equal(9, bald.Single(a => a.Team == "gekuendigt").Tage);
        Assert.Empty(Ablaufhinweise.Bald(test, false, [], Tarife.Saat, Heute));   // eine ungeprüfte Lizenz erinnert an nichts
        Assert.Empty(Ablaufhinweise.Bald(new Licence("pro", ValidUntil: Heute.AddDays(20)), true, [], Tarife.Saat, Heute));
    }
}

/// <summary>Der Endpunkt in beiden Zuständen der Startphase (der Schalter ist statisch — darum allein).</summary>
[Collection("Startphase")]
public class AblaufEndpunktTests
{
    [Fact]
    public async Task In_der_Startphase_nichts_sonst_die_Liste()
    {
        var dir = Path.Combine(Path.GetTempPath(), "journali-ablauf-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(dir);
        var c = new Catalog(new Journali.Core.Journal.MemoryJournal()); c.Rebuild(); c.SeedMissing();
        var b = WebApplication.CreateBuilder(); b.WebHost.UseUrls("http://127.0.0.1:0"); b.Services.AddSingleton(c);
        await using var app = b.Build();
        LicenceApi.Map(app.MapGroup("/api"), new Licences(dir), new Abos(new Instanz(null), dir, new HttpClient(), () => null));
        await app.StartAsync();
        using var http = new HttpClient();
        var url = app.Urls.First() + "/api/licence/ablauf";
        try
        {
            Journali.Core.Licensing.Startphase.An = true;
            Assert.Equal("[]", await http.GetStringAsync(url));
            Journali.Core.Licensing.Startphase.An = false;
            var r = await http.GetAsync(url);
            Assert.True(r.IsSuccessStatusCode);
            Assert.StartsWith("[", await r.Content.ReadAsStringAsync());
        }
        finally { Journali.Core.Licensing.Startphase.An = false; }
    }
}
