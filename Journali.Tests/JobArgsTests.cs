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
}
