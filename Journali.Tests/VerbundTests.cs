using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Microsoft.Extensions.Logging.Abstractions;

namespace Journali.Tests;

/// <summary>
/// Hauptserver und Arbeitsserver (pflegestruktur 41): was ohne Datenbank zu prüfen ist — die Kennung, die Entscheidungen im Journal,
/// dass nur der Hauptserver Jobs startet, dass ein Import anderswo die Läufe hier warten lässt, und die Liste der Server.
/// </summary>
public class VerbundTests
{
    private static string Dir() { var d = Path.Combine(Path.GetTempPath(), "journali-verbund-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(d); return d; }
    private static Catalog Katalog() { var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing(); return c; }

    [Fact]
    public void Die_Kennung_entsteht_einmal_und_bleibt()
    {
        var dir = Dir();
        var a = Verbund.KennungIn(dir);
        Assert.StartsWith("srv-", a);
        Assert.Equal(a, Verbund.KennungIn(dir));
        File.WriteAllText(Path.Combine(dir, "server.json"), "kaputt");
        Assert.NotEqual(a, Verbund.KennungIn(dir));                 // unlesbar: neu
    }

    [Fact]
    public void Hauptserver_und_Sperre_stehen_im_Journal_der_letzte_Eintrag_gilt()
    {
        var c = Katalog();
        Assert.Null(c.Lesen((_, _) => c.Jobs.MainServer));
        c.With((_, _, w) => w("t", Jobs.ServerStream + "srv-a", Types.ServerMainSet, new ServerMainSet("a"), null));
        c.With((_, _, w) => w("t", Jobs.ServerStream + "srv-b", Types.ServerMainSet, new ServerMainSet("b"), null));
        Assert.Equal("srv-b", c.Lesen((_, _) => c.Jobs.MainServer));
        c.With((_, _, w) => w("t", Jobs.ServerStream + "srv-a", Types.ServerBlockSet, new ServerBlockSet(true), null));
        Assert.Contains("srv-a", c.Lesen((_, _) => c.Jobs.BlockedServers.ToList()));
        c.With((_, _, w) => w("t", Jobs.ServerStream + "srv-a", Types.ServerBlockSet, new ServerBlockSet(false), null));
        Assert.Empty(c.Lesen((_, _) => c.Jobs.BlockedServers.ToList()));
        Assert.Equal(Kinds.Setup, Kinds.Of(Types.ServerMainSet));     // Einrichtung: kostet kein Kontingent
        Assert.Equal(Kinds.Setup, Kinds.Of(Types.ServerBlockSet));
    }

    [Fact]
    public void Ohne_Datenbank_ist_dieser_Server_Hauptserver_und_steht_allein_in_der_Liste()
    {
        var c = Katalog();
        var v = new Verbund(null, c, Dir(), "1.2.3", DateTime.UtcNow, host: "pc");
        Assert.True(v.IstHaupt);
        Assert.True(v.Takt());
        var z = Assert.Single(v.Zeilen);
        Assert.Equal((v.Id, "pc", "1.2.3"), (z.Id, z.Host, z.Version));
        Assert.False(v.Gesperrt);
        c.With((_, _, w) => w("t", Jobs.ServerStream + v.Id, Types.ServerBlockSet, new ServerBlockSet(true), null));
        Assert.True(v.Gesperrt);
    }

    [Fact]
    public void Die_Liste_nennt_auch_Server_die_nur_im_Journal_stehen()
    {
        var c = Katalog();
        var v = new Verbund(null, c, Dir(), "1.2.3", DateTime.UtcNow, host: "pc");
        v.Takt();
        c.With((_, _, w) => w("t", Jobs.ServerStream + "srv-alt", Types.ServerMainSet, new ServerMainSet("alt"), null));
        c.With((_, _, w) => w("t", Jobs.ServerStream + "srv-weg", Types.ServerBlockSet, new ServerBlockSet(true), null));
        var liste = JsonSerializer.SerializeToElement(ServerApi.Liste(v, DateTimeOffset.UtcNow));
        var nachId = liste.EnumerateArray().ToDictionary(x => x.GetProperty("id").GetString()!);
        Assert.Equal(3, nachId.Count);
        Assert.True(nachId[v.Id].GetProperty("selbst").GetBoolean());
        Assert.True(nachId[v.Id].GetProperty("erreichbar").GetBoolean());
        Assert.True(nachId["srv-alt"].GetProperty("haupt").GetBoolean());
        Assert.False(nachId["srv-alt"].GetProperty("erreichbar").GetBoolean());
        Assert.True(nachId["srv-weg"].GetProperty("gesperrt").GetBoolean());
    }

    [Fact]
    public void Ein_Arbeitsserver_startet_keinen_Lauf_und_ein_Import_anderswo_zaehlt_als_Import()
    {
        var c = Katalog();
        var runner = new JobRunner(c, Dir(), Dir(), NullLogger<JobRunner>.Instance) { IstHaupt = () => false };
        Assert.Null(runner.Start("irgendwas", "manual", out var fehler));
        Assert.Equal("Jobs laufen auf dem Hauptserver.", fehler);
        Assert.False(runner.ImportLaeuft);
        runner.ImportAnderswo = () => true;
        Assert.True(runner.ImportLaeuft);
        Assert.False(runner.ImportHier);                               // gemeldet wird nur, was hier läuft
        Assert.Empty(runner.Laufende());
    }

    [Fact]
    public void Auf_einem_Arbeitsserver_gehen_Start_Anhalten_Weiter_und_Abbruch_an_den_Hauptserver()
    {
        var c = Katalog();
        var auftraege = new List<string>();
        var runner = new JobRunner(c, Dir(), Dir(), NullLogger<JobRunner>.Instance)
        {
            IstHaupt = () => false,
            AnHaupt = (art, key, ausloeser) => { auftraege.Add($"{art} {key} {ausloeser}"); return art == "cancel" ? (null, "Der Job läuft nicht.") : (art == "start" ? "20261003-1200-ab12" : "ok", null); },
            AmHaupt = () => [new JobRunner.Laufend("embed", "r7", "Import")],
        };
        Assert.Equal("20261003-1200-ab12", runner.Start("export", "manual", out var fehler));
        Assert.Null(fehler);
        Assert.True(runner.Pause("embed"));
        Assert.True(runner.Resume("embed"));
        Assert.False(runner.Cancel("embed"));                          // der Fehler des Hauptservers kommt zurück
        Assert.Equal(["start export manual", "pause embed von Hand", "resume embed ", "cancel embed "], auftraege);
        // was dort läuft, steht hier in der Jobliste
        Assert.True(runner.IsRunning("embed"));
        Assert.Equal("r7", runner.RunningId("embed"));
        Assert.True(runner.IsPaused("embed"));
        Assert.Equal("Import", runner.PauseReason("embed"));
        Assert.False(runner.IsRunning("export"));
    }

    [Fact]
    public void Der_Hauptserver_fuehrt_Auftraege_aus_und_nennt_den_Fehler()
    {
        var runner = new JobRunner(Katalog(), Dir(), Dir(), NullLogger<JobRunner>.Instance);
        Assert.Equal((null, "unbekannter Job"), runner.Ausfuehren("start", "gibtsnicht", "manual"));
        Assert.Equal((null, "Der Job läuft nicht."), runner.Ausfuehren("pause", "gibtsnicht", null));
        Assert.Equal((null, "Der Job wartet nicht."), runner.Ausfuehren("resume", "gibtsnicht", null));
        Assert.Equal((null, "unbekannter Auftrag loeschen"), runner.Ausfuehren("loeschen", "x", null));
    }

    [Fact]
    public void Die_laufenden_Jobs_gehen_klein_geschrieben_in_die_Tabelle_und_kommen_so_zurueck()
    {
        var liste = new List<JobRunner.Laufend> { new("embed", "r1", null), new("derive", "r2", "Import") };
        var json = JsonSerializer.SerializeToElement(liste, Verbund.Camel);
        Assert.Equal("embed", json[0].GetProperty("key").GetString());
        Assert.Equal(liste, Verbund.LaufendAus(json));
        Assert.Empty(Verbund.LaufendAus(JsonSerializer.SerializeToElement(new { kaputt = 1 })));
    }

    [Fact]
    public void Ohne_Datenbank_gibt_es_keinen_Hauptserver_fuer_einen_Auftrag()
    {
        var v = new Verbund(null, Katalog(), Dir(), "1", DateTime.UtcNow);
        Assert.Equal((null, "Kein Hauptserver."), v.Auftrag("start", "x", "manual"));
        Assert.Null(v.ProtokollLesen("x", "r"));
    }

    [Fact]
    public void Ein_Name_steht_im_Journal_und_in_der_Liste_leer_heisst_wieder_der_Rechnername()
    {
        var c = Katalog();
        var v = new Verbund(null, c, Dir(), "1", DateTime.UtcNow, host: "586a874270fb");
        v.Takt();
        Assert.Equal("586a874270fb", v.NameVon(v.Id, v.Host));
        c.With((_, _, w) => w("t", Jobs.ServerStream + v.Id, Types.ServerNamed, new ServerNamed("Unraid"), null));
        Assert.Equal("Unraid", v.NameVon(v.Id, v.Host));
        var z = JsonSerializer.SerializeToElement(ServerApi.Liste(v, DateTimeOffset.UtcNow))[0];
        Assert.Equal(("Unraid", "586a874270fb"), (z.GetProperty("name").GetString(), z.GetProperty("host").GetString()));
        c.With((_, _, w) => w("t", Jobs.ServerStream + v.Id, Types.ServerNamed, new ServerNamed(null), null));
        Assert.Equal("586a874270fb", v.NameVon(v.Id, v.Host));
        Assert.Equal(JsonValueKind.Null, JsonSerializer.SerializeToElement(ServerApi.Liste(v, DateTimeOffset.UtcNow))[0].GetProperty("name").ValueKind);
        Assert.Equal(Kinds.Setup, Kinds.Of(Types.ServerNamed));
    }
}
