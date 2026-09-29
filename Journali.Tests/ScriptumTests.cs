using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Microsoft.AspNetCore.Http;

namespace Journali.Tests;

/// <summary>
/// Skripte, die der Anwender schreibt und anstösst (docs/pflegestruktur.md 37, 29.09.2026): der Quelltext steht im
/// Journal, gelaufen wird als Job, und zwei Rechte trennen Schreiben von Anstossen.
/// </summary>
public class ScriptumTests
{
    private static Catalog Leer()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        return c;
    }

    private static void Schreib(Catalog c, ScriptumApi.Skript s) =>
        c.With((_, _, write) => write("t", Plugins.Stream + ScriptumApi.Plugin, Types.PluginDataSet,
            new PluginDataSet(ScriptumApi.Praefix + s.Key, JsonSerializer.Serialize(s, new JsonSerializerOptions(JsonSerializerDefaults.Web))), null));

    /// <summary>Zwei Rechte im Vokabular — und eine Einschluss-Regel, damit nicht am nächsten Morgen niemand mehr eines anlegen darf.</summary>
    [Fact]
    public void Die_beiden_Rechte_stehen_im_Vokabular_und_schliessen_das_Richtige_ein()
    {
        Assert.Contains(Rights.ScriptumWrite, Rights.All);
        Assert.Contains(Rights.ScriptumRun, Rights.All);
        Assert.True(Rights.Label.ContainsKey(Rights.ScriptumWrite));
        Assert.True(Rights.Label.ContainsKey(Rights.ScriptumRun));
        // wer Rollen verwaltet, könnte sich jedes Recht geben — er hat es also ohnehin
        Assert.Contains(Rights.ScriptumWrite, Rights.Effective([Rights.Users]));
        // wer schreibt, darf anstossen; wer Jobs baut, kann jedes Skript als Job laufen lassen
        Assert.Contains(Rights.ScriptumRun, Rights.Effective([Rights.ScriptumWrite]));
        Assert.Contains(Rights.ScriptumRun, Rights.Effective([Rights.Jobs]));
        // umgekehrt nicht: anstossen ist kein Schreiben
        Assert.DoesNotContain(Rights.ScriptumWrite, Rights.Effective([Rights.ScriptumRun]));
        Assert.DoesNotContain(Rights.ScriptumWrite, Rights.Effective([Rights.Write]));
    }

    /// <summary>Ein Skript liegt als Plugin-Datensatz im Journal und wird von dort gelesen — mit Kopf, Rolle und Freigabe.</summary>
    [Fact]
    public void Ein_Skript_steht_im_Journal_und_wird_von_dort_gelesen()
    {
        var c = Leer();
        Schreib(c, new ScriptumApi.Skript("preise", "Preise prüfen", "editor", Rights.Read,
            "export const meta = { label: 'Preise prüfen' }\nexport default () => 1",
            [new ScriptumApi.Param("root", "Teilbaum", "text", "g1")], "täglich", 90));

        var s = ScriptumApi.Lies(c, "preise");
        Assert.NotNull(s);
        Assert.Equal("Preise prüfen", s!.Label);
        Assert.Equal("editor", s.Role);
        Assert.True(s.Freigegeben);
        Assert.Equal(90, s.Grenze);
        Assert.Equal("root", s.Params!.Single().Key);
        Assert.Contains("export default", s.Source);
        Assert.Equal(["preise"], ScriptumApi.Alle(c).Select(x => x.Key));

        // Ohne Freigabe: das Skript bleibt, nur anstossen darf es dann niemand ausser dem, der schreibt
        Schreib(c, s with { Run = null });
        Assert.False(ScriptumApi.Lies(c, "preise")!.Freigegeben);
        // Zeitgrenze ohne Angabe: eine Minute
        Assert.Equal(60, new ScriptumApi.Skript("x", "X", null, null, "").Grenze);

        // Entfernt heisst weg — der Lauf im Journal bleibt, das Skript nicht
        c.With((_, _, write) => write("t", Plugins.Stream + ScriptumApi.Plugin, Types.PluginDataSet, new PluginDataSet(ScriptumApi.Praefix + "preise", null), null));
        Assert.Null(ScriptumApi.Lies(c, "preise"));
        Assert.Empty(ScriptumApi.Alle(c));
    }

    /// <summary>Was ohne Quelltext hinausgeht: die Liste zeigt das Formular, nie das Programm.</summary>
    [Fact]
    public void Die_Liste_zeigt_kein_Programm()
    {
        var s = new ScriptumApi.Skript("preise", "Preise", null, Rights.Read, "export default () => 'geheim'");
        var json = JsonSerializer.Serialize(s.Offen(), new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.DoesNotContain("geheim", json);
        Assert.DoesNotContain("source", json);
        Assert.Contains("\"released\":true", json);
    }

    /// <summary>Das Ergebnis eines Laufs ist die letzte Zeile mit der Marke — das Log trägt davor seine Uhrzeit.</summary>
    [Fact]
    public void Das_Ergebnis_kommt_aus_der_letzten_Zeile_mit_der_Marke()
    {
        var log = string.Join("\n",
            "10:00:01 Preise prüfen: 1 Parameter",
            "10:00:01 " + ScriptumApi.Marke + "{\"text\":\"alt\"}",
            "10:00:02 Zwischenstand",
            "10:00:02 " + ScriptumApi.Marke + "{\"table\":{\"columns\":[\"id\"],\"rows\":[[\"p1\"]]}}",
            "10:00:02 fertig in 0.4 s");
        var e = ScriptumApi.Ergebnis(log);
        Assert.NotNull(e);
        Assert.Equal("p1", e!.Value.GetProperty("table").GetProperty("rows")[0][0].GetString());
        // das Protokoll ist alles ausser den Ergebniszeilen
        var p = ScriptumApi.Protokoll(log);
        Assert.Contains("Zwischenstand", p);
        Assert.Contains("fertig in 0.4 s", p);
        Assert.DoesNotContain(ScriptumApi.Marke, p);
        // kein Ergebnis, kaputtes Ergebnis: kein Absturz
        Assert.Null(ScriptumApi.Ergebnis("nichts gemeldet"));
        Assert.Null(ScriptumApi.Ergebnis(ScriptumApi.Marke + "{kaputt"));
    }

    /// <summary>Der Job eines Skripts heisst nach ihm — so stehen Läufe, Log und Fächer dort, wo sie hingehören.</summary>
    [Fact]
    public void Jeder_Lauf_ist_ein_Job()
    {
        Assert.Equal("scriptum_preise", ScriptumApi.JobKey("preise"));
        Assert.True(ModelApi.ValidKey(ScriptumApi.JobKey("preise")));
    }

    /// <summary>Ein Skript schreiben und lesen ist ein eigenes Recht — auch da, wo der Quelltext als Plugin-Datensatz liegt.</summary>
    [Theory]
    [InlineData("GET", "/api/scriptum/scripts", Rights.ScriptumRun)]
    [InlineData("POST", "/api/scriptum/scripts/preise/run", Rights.ScriptumRun)]
    [InlineData("GET", "/api/scriptum/runs/scriptum_preise/r1", Rights.ScriptumRun)]
    [InlineData("GET", "/api/scriptum/runs/scriptum_preise/r1/file", Rights.ScriptumRun)]
    [InlineData("GET", "/api/scriptum/scripts/preise", Rights.ScriptumWrite)]
    [InlineData("PUT", "/api/scriptum/scripts/preise", Rights.ScriptumWrite)]
    [InlineData("DELETE", "/api/scriptum/scripts/preise", Rights.ScriptumWrite)]
    [InlineData("GET", "/api/scriptum/scripts/preise/source", Rights.ScriptumWrite)]
    [InlineData("GET", "/api/plugins/scriptum/data", Rights.ScriptumWrite)]
    [InlineData("GET", "/api/plugins/scriptum/data/script:preise", Rights.ScriptumWrite)]
    [InlineData("PUT", "/api/plugins/scriptum/data/script:preise", Rights.ScriptumWrite)]
    public void Jeder_Endpunkt_braucht_sein_Recht(string method, string path, string recht)
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Method = method; ctx.Request.Path = path;
        Assert.Equal(recht, Auth.Needed(ctx.Request));
    }

    /// <summary>
    /// Den Quelltext holt der Lauf selbst: ein Dienst-Token gehört einem Prozess auf diesem Server, nie einem Browser.
    /// Alles andere unter /api/scriptum bleibt ihm verschlossen.
    /// </summary>
    [Fact]
    public void Der_Lauf_darf_seinen_Quelltext_holen_der_Browser_nicht()
    {
        var c = Leer();
        c.With((_, _, write) => write("t", Users.RoleStream + "leser", Types.RoleDefined, new RoleDefined("Leser", [Rights.Read, Rights.ScriptumRun]), null));

        var browser = new DefaultHttpContext();
        browser.Request.Method = "GET"; browser.Request.Path = "/api/scriptum/scripts/preise/source";
        Assert.False(Auth.Allowed(c, "leser", browser.Request));

        var lauf = new DefaultHttpContext();
        lauf.Request.Method = "GET"; lauf.Request.Path = "/api/scriptum/scripts/preise/source";
        lauf.Items["dienst"] = true;
        Assert.True(Auth.IstDienst(lauf.Request));
        Assert.True(Auth.Allowed(c, "leser", lauf.Request));

        // der Lauf bekommt damit nicht das Recht, Skripte zu ändern
        var schreiben = new DefaultHttpContext();
        schreiben.Request.Method = "PUT"; schreiben.Request.Path = "/api/scriptum/scripts/preise";
        schreiben.Items["dienst"] = true;
        Assert.False(Auth.Allowed(c, "leser", schreiben.Request));
    }
}
