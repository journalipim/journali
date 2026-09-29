using System.Text.Json;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Der dritte Anbieter „lokal“ (29.09.2026): ein Modell auf dem eigenen Server über die Ollama-Schnittstelle. Adresse aus
/// der Umgebung, kein Schlüssel, für jedes Team da; die bezahlten Anbieter gehen vor, das lokale ist der Rückfall — es sei
/// denn, das Team wählt es.
/// </summary>
public class AiLokalTests
{
    private static readonly JsonSerializerOptions Opt = new() { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };

    [Fact]
    public void Bezahlte_zuerst_dann_lokal()
    {
        Assert.Equal(["anthropic", "openai", "lokal"], AiApi.Anbieter(["openai", "anthropic"], lokal: true));
        Assert.Equal(["anthropic", "openai"], AiApi.Anbieter(["openai", "anthropic"], lokal: false));
        Assert.Equal(["lokal"], AiApi.Anbieter([], lokal: true));
        Assert.Empty(AiApi.Anbieter([], lokal: false));
    }

    [Fact]
    public void Die_Wahl_des_Teams_geht_vor_dem_ersten_und_der_Wunsch_vor_der_Wahl()
    {
        var a = new[] { "anthropic", "lokal" };
        Assert.Equal("anthropic", AiApi.Gewaehlt(null, null, a));
        Assert.Equal("lokal", AiApi.Gewaehlt(null, "lokal", a));
        Assert.Equal("anthropic", AiApi.Gewaehlt("anthropic", "lokal", a));
        Assert.Equal("lokal", AiApi.Gewaehlt("openai", "lokal", a));   // ein Anbieter, den es nicht gibt, zählt nicht
        Assert.Null(AiApi.Gewaehlt(null, null, []));
    }

    [Fact]
    public void Die_Anfrage_ans_lokale_Modell_ist_ein_Chat_ohne_Strom()
    {
        var json = JsonSerializer.Serialize(AiApi.LokalBody("m", "Du liest.", "Text", 500), Opt);
        Assert.Contains("\"model\":\"m\"", json);
        Assert.Contains("\"messages\":[{\"role\":\"system\",\"content\":\"Du liest.\"},{\"role\":\"user\",\"content\":\"Text\"}]", json);
        Assert.Contains("\"stream\":false", json);
        Assert.Contains("\"num_predict\":500", json);
        Assert.Contains("\"num_ctx\":2048", json);
        Assert.DoesNotContain("system\":\"", JsonSerializer.Serialize(AiApi.LokalBody("m", " ", "Text", 1), Opt));
    }

    [Fact]
    public void Das_Kontextfenster_folgt_der_Eingabe()
    {
        Assert.Equal(2048, AiApi.LokalKontext(100, 100));           // klein bleibt klein
        Assert.Equal(4096, AiApi.LokalKontext(6000, 400));          // 6 000 Zeichen + Antwort: eine Stufe hoeher
        Assert.Equal(16384, AiApi.LokalKontext(40000, 2000));       // ein Datenblatt: die Obergrenze
        Assert.Equal(16384, AiApi.LokalKontext(500000, 4000));      // darueber wird abgeschnitten, nicht der Speicher gesprengt
    }

    [Fact]
    public void Eingang_und_Ausgang_aus_der_Antwort()
    {
        using var doc = JsonDocument.Parse("{\"message\":{\"content\":\"ok\"},\"prompt_eval_count\":120,\"eval_count\":45}");
        Assert.Equal((120, 45), AiApi.LokalUsage(doc.RootElement));
        using var leer = JsonDocument.Parse("{}");
        Assert.Equal((0, 0), AiApi.LokalUsage(leer.RootElement));
    }

    [Fact]
    public void Die_Adresse_ohne_Schraegstrich_am_Ende()
    {
        Assert.Equal("http://localhost:11434", AiApi.Normalisiere(" http://localhost:11434/ "));
        Assert.Null(AiApi.Normalisiere("  "));
        Assert.Null(AiApi.Normalisiere(null));
    }

    [Fact]
    public void Die_Adresse_des_Teams_geht_vor_der_Umgebung()
    {
        // Traegt das Team eine eigene Adresse (Schluessel „lokal“ im Tresor), gilt sie — ohne Schraegstrich am Ende
        Assert.Equal("http://box:11434", AiApi.LokalUrlFuer(new Dictionary<string, string> { ["lokal"] = "http://box:11434/" }));
        // Ohne eigene Adresse gilt die der Umgebung (LokalUrl) — was immer dort steht
        Assert.Equal(AiApi.LokalUrl, AiApi.LokalUrlFuer(new Dictionary<string, string>()));
        // Eine leere Adresse ist keine — dann faellt es auf die Umgebung zurueck
        Assert.Equal(AiApi.LokalUrl, AiApi.LokalUrlFuer(new Dictionary<string, string> { ["lokal"] = "  " }));
    }
}
