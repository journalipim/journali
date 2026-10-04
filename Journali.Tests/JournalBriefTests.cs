using System.Text.Json;
using Journali.Server;

namespace Journali.Tests;

// /api/journal?brief=true (04.10.2026): eine grosse Nutzlast (Plugin-Daten bis 4 MB) kommt gekürzt — mit ihren kurzen Feldern, damit die Ansicht
// den Eintrag weiter beschreiben kann; eine kleine bleibt, wie sie ist.
public class JournalBriefTests
{
    [Fact]
    public void Eine_grosse_Nutzlast_behaelt_ihre_kurzen_Felder_und_sagt_wie_gross_sie_war()
    {
        var json = JsonSerializer.Serialize(new { name = "class:10:EC000001", value = new string('x', 10_000), n = 3, ok = true });
        var p = JournalBrief.Payload(json, 4096);
        Assert.True(p.GetProperty("truncated").GetBoolean());
        Assert.Equal(json.Length, p.GetProperty("bytes").GetInt32());
        Assert.Equal("class:10:EC000001", p.GetProperty("name").GetString());
        Assert.Equal(3, p.GetProperty("n").GetInt32()); Assert.True(p.GetProperty("ok").GetBoolean());
        Assert.False(p.TryGetProperty("value", out _));
    }

    [Fact]
    public void Eine_kleine_Nutzlast_und_ohne_Grenze_bleibt_alles()
    {
        var json = JsonSerializer.Serialize(new { attribute = "farbe", value = "rot" });
        Assert.Equal("rot", JournalBrief.Payload(json, 4096).GetProperty("value").GetString());
        var gross = JsonSerializer.Serialize(new { value = new string('x', 10_000) });
        Assert.Equal(10_000, JournalBrief.Payload(gross, null).GetProperty("value").GetString()!.Length);
    }
}
