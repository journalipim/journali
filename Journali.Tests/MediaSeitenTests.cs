using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Medienbibliothek in Seiten (04.10.2026): /api/media mit skip, die Gesamtzahl in den Facetten; Stichwort-Facetten höchstens
/// <see cref="MediaApi.StichwortFacetten"/> und die gewählten, der Rest als Zahl.
/// </summary>
public class MediaSeitenTests
{
    [Fact]
    public void Eine_Seite_ab_skip_hoechstens_limit()
    {
        var alle = Enumerable.Range(0, 65).ToList();
        Assert.Equal([0, 1], MediaApi.Seite(alle, 0, 2));
        Assert.Equal([63, 64], MediaApi.Seite(alle, 63, 2));
        Assert.Equal([64], MediaApi.Seite(alle, 64, 5));
        Assert.Empty(MediaApi.Seite(alle, 65, 5));
        Assert.Equal([0], MediaApi.Seite(alle, -3, 0));   // skip unter 0 zählt als 0, limit mindestens 1
        Assert.Equal(65, MediaApi.Seite(alle, 0, 100_000).Count());
    }

    [Fact]
    public void Die_haeufigsten_Stichwoerter_und_die_gewaehlten()
    {
        var zaehlung = Enumerable.Range(0, 100).ToDictionary(i => $"k{i:000}", i => 1000 - i);   // k000 am häufigsten
        var oben = MediaApi.HaeufigsteStichworte(zaehlung, null).Select(kv => kv.Key).ToList();
        Assert.Equal(MediaApi.StichwortFacetten, oben.Count);
        Assert.Equal("k000", oben[0]);
        var mitWahl = MediaApi.HaeufigsteStichworte(zaehlung, "k099,k001").Select(kv => kv.Key).ToList();
        Assert.Equal(MediaApi.StichwortFacetten + 1, mitWahl.Count);
        Assert.Equal("k099", mitWahl[^1]);
    }
}
