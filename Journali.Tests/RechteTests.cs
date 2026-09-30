using Journali.Core.Entries;
using Journali.Server;
using Microsoft.AspNetCore.Http;

namespace Journali.Tests;

/// <summary>
/// Das Recht „download“ (27.09.2026): sehen ist nicht haben. Die Datei selbst, ein Preset und die Blobs braucht es;
/// Kacheln, Angaben und Listen sieht, wer liest. Und die Regel im Kern: wer pflegt, lädt — sonst lüde nach dem Update
/// niemand mehr eine Datei, bis jede Rolle nachgepflegt ist.
/// </summary>
public class RechteTests
{
    private static string? Braucht(string pfad, string method = "GET")
    {
        var ctx = new DefaultHttpContext(); ctx.Request.Path = pfad; ctx.Request.Method = method;
        return Auth.Needed(ctx.Request);
    }

    [Theory]
    [InlineData("/api/media/m-1/file", Rights.Download)]
    [InlineData("/api/media/m-1/web", Rights.Download)]          // ein Preset
    [InlineData("/api/media/blob/abc.thumb", Rights.Download)]
    [InlineData("/api/media/m-1/thumb", Rights.Read)]            // die Kachel sieht, wer liest
    [InlineData("/api/media/m-1/usage", Rights.Read)]
    [InlineData("/api/media/m-1", Rights.Read)]
    [InlineData("/api/media", Rights.Read)]
    [InlineData("/api/media/folders", Rights.Read)]
    [InlineData("/api/media/facets", Rights.Read)]
    [InlineData("/api/media/m-1/workflow", Rights.Read)]         // den Zustand sieht, wer liest
    public void Die_Datei_braucht_download_die_Kachel_nur_lesen(string pfad, string recht) => Assert.Equal(recht, Braucht(pfad));

    [Fact]
    public void Klassifikation_anlegen_und_zuweisen_ist_Pflege_die_Bereitschaft_nur_lesen()
    {
        Assert.Equal(Rights.Write, Braucht("/api/classification/ensure", "POST"));
        Assert.Equal(Rights.Write, Braucht("/api/classification/assign", "POST"));
        Assert.Equal(Rights.Read, Braucht("/api/classification/readiness", "POST"));
    }

    [Fact]
    public void Wer_pflegt_laedt()
    {
        Assert.Contains(Rights.Download, Rights.Effective([Rights.Write]));
        Assert.DoesNotContain(Rights.Download, Rights.Effective([Rights.Read]));
        Assert.Contains(Rights.Team, Rights.Effective([Rights.Users]));   // die Regel von früher steht jetzt hier
        Assert.Contains(Rights.Download, Rights.All);
    }

    /// <summary>Der Leser aus dem Saatgut lädt nicht; jede Rolle mit Pflegen lädt, ohne dass sie das Recht nennt.</summary>
    [Fact]
    public void Die_vorbelegten_Rollen()
    {
        var seeds = Rights.Seeds().ToDictionary(s => s.Key, s => Rights.Effective(s.Role.Rights));
        Assert.DoesNotContain(Rights.Download, seeds["reader"]);
        Assert.Contains(Rights.Download, seeds["editor"]);
        Assert.Contains(Rights.Download, seeds["manager"]);
        Assert.Contains(Rights.Download, seeds["admin"]);
    }
}
