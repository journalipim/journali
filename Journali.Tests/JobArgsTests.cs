using System.Text.Json;
using Journali.Server;

namespace Journali.Tests;

// Prozess-Plugins bekommen ihre Parameter positionsweise (plugin.json args: {journali} {actor} {root} {dir} …)
public class JobArgsTests
{
    [Fact]
    public void Leere_Parameter_verschieben_die_Argumente_nicht()
    {
        // root leer, dir gesetzt: dir muss an vierter Stelle bleiben — vorher fiel das leere Argument weg, und das Skript las dir als root
        var proc = JsonDocument.Parse("""{"command":"node","args":["job.mjs","{journali}","{actor}","{root}","{dir}","{flag?--dry}","fest"]}""").RootElement;
        var psi = PluginApi.BuildProcess(Path.GetTempPath(), "x", proc, new() { ["journali"] = "http://j", ["actor"] = "a", ["root"] = "", ["dir"] = "export" });
        Assert.Equal(new[] { "job.mjs", "http://j", "a", "", "export", "fest" }, psi.ArgumentList.ToArray());
        Assert.Equal("", psi.Environment["JOURNALI_ROOT"]);
    }

    [Fact]
    public void Schalter_kommen_nur_wenn_wahr()
    {
        var proc = JsonDocument.Parse("""{"command":"node","args":["job.mjs","{dry?--dry}"]}""").RootElement;
        Assert.Equal(new[] { "job.mjs", "--dry" }, PluginApi.BuildProcess(Path.GetTempPath(), "x", proc, new() { ["dry"] = "true" }).ArgumentList.ToArray());
        Assert.Equal(new[] { "job.mjs" }, PluginApi.BuildProcess(Path.GetTempPath(), "x", proc, new() { ["dry"] = "false" }).ArgumentList.ToArray());
    }

    [Fact]
    public async Task Das_Ergebnis_auf_stdout_kommt_ganz_der_Fortschritt_auf_stderr_wird_gekuerzt()
    {
        // 14.10.2026: etim gibt die Suchliste einer Freigabe als eine JSON-Zeile aus (1,7 MB) — vorher galt für alles zusammen 200 000 Zeichen vom
        // Ende her, und die Zeile kam abgeschnitten an. Jetzt bleibt stdout bis 32 MB ganz; von stderr (Fortschritt) bleibt das Ende.
        var dir = Directory.CreateTempSubdirectory("journali-run").FullName;
        try
        {
            Directory.CreateDirectory(Path.Combine(dir, "x"));
            File.WriteAllText(Path.Combine(dir, "x", "lauf.mjs"), "process.stderr.write('f'.repeat(300000) + 'ENDE'); console.log(JSON.stringify({ liste: 'a'.repeat(1000000) }))");
            var proc = JsonDocument.Parse("""{"command":"node","args":["lauf.mjs"]}""").RootElement;
            var (exit, output) = await PluginApi.RunProcessAsync(dir, "x", proc, new(), TimeSpan.FromMinutes(1), CancellationToken.None);
            Assert.Equal(0, exit);
            var zeile = output.Split('\n')[0];
            Assert.Equal(1000000, JsonDocument.Parse(zeile).RootElement.GetProperty("liste").GetString()!.Length);
            var fortschritt = output[(output.IndexOf("--- stderr ---", StringComparison.Ordinal) + 15)..];
            Assert.True(fortschritt.Length <= 200_001 && fortschritt.EndsWith("ENDE"), $"{fortschritt.Length}");
        }
        finally { Directory.Delete(dir, true); }
    }
}
