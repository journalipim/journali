using System.Text.Json;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Prompt-Cache (28.09.2026): der Systemtext geht als Block mit cache_control an die Anthropic-API — wiederholt sich der
/// Anfang einer Anfrage, liest der Dienst ihn aus dem Cache. Gezählt wird, was über die Leitung ging: die Cache-Felder
/// der Antwort gehören zum Eingang.
/// </summary>
public class AiCacheTests
{
    private static readonly JsonSerializerOptions Opt = new() { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };

    [Fact]
    public void Der_Systemtext_geht_als_Block_mit_cache_control()
    {
        var json = JsonSerializer.Serialize(AiApi.AnthropicBody("claude-sonnet-5", 100, "Du liest ein Dokument.", "Text", false, 0), Opt);
        Assert.Contains("\"system\":[{\"type\":\"text\",\"text\":\"Du liest ein Dokument.\",\"cache_control\":{\"type\":\"ephemeral\"}}]", json);
        Assert.Contains("\"messages\":[{\"role\":\"user\",\"content\":\"Text\"}]", json);
        Assert.DoesNotContain("temperature", json);
        Assert.DoesNotContain("tools", json);
    }

    [Theory]
    [InlineData(16, 4096)]
    [InlineData(200, 4096)]
    [InlineData(16000, 16000)]
    public void Max_tokens_hat_eine_Untergrenze_weil_das_Denken_mitzaehlt(int angefragt, int gesendet)
    {
        // 18.10.2026: mit 200 endete die Antwort von Claude Sonnet 5.5 vor dem ersten Textblock — das Denken vor der Antwort zählt gegen max_tokens
        var json = JsonSerializer.Serialize(AiApi.AnthropicBody("claude-sonnet-5-5", angefragt, "S", "T", false, 0), Opt);
        Assert.Contains($"\"max_tokens\":{gesendet},", json);
    }

    [Fact]
    public void Ohne_Systemtext_kein_system_Feld()
    {
        var json = JsonSerializer.Serialize(AiApi.AnthropicBody("claude-sonnet-5", 100, "  ", "Text", false, 0), Opt);
        Assert.DoesNotContain("\"system\"", json);
    }

    [Fact]
    public void Mit_Recherche_kommt_das_Suchwerkzeug_dazu()
    {
        var json = JsonSerializer.Serialize(AiApi.AnthropicBody("claude-opus-5", 100, "S", "T", true, 6), Opt);
        Assert.Contains("\"tools\":[{\"type\":\"web_search_20250305\",\"name\":\"web_search\",\"max_uses\":6}]", json);
        Assert.Contains("cache_control", json);
    }

    [Fact]
    public void Gelesener_und_geschriebener_Cache_zaehlen_zum_Eingang()
    {
        using var doc = JsonDocument.Parse("{\"input_tokens\":120,\"cache_creation_input_tokens\":2000,\"cache_read_input_tokens\":3000,\"output_tokens\":45}");
        var (tin, tout) = AiApi.AnthropicUsage(doc.RootElement);
        Assert.Equal(5120, tin);
        Assert.Equal(45, tout);
    }

    [Fact]
    public void Ohne_Cache_Felder_wie_bisher()
    {
        using var doc = JsonDocument.Parse("{\"input_tokens\":120,\"output_tokens\":45}");
        Assert.Equal((120, 45), AiApi.AnthropicUsage(doc.RootElement));
    }
}
