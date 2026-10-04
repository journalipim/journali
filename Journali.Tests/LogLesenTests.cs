using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Logs (04.10.2026): gelesen wird nur das Ende — die letzten Zeilen rückwärts in Blöcken, sonst höchstens LogLesen.Max vom Ende.
/// </summary>
public class LogLesenTests
{
    private static string Datei(string text) { var p = Path.GetTempFileName(); File.WriteAllText(p, text); return p; }

    [Fact]
    public void Die_letzten_Zeilen_wie_bisher_auch_ueber_Blockgrenzen()
    {
        var text = string.Concat(Enumerable.Range(1, 100_000).Select(i => $"Zeile {i}\n"));
        var p = Datei(text);
        try
        {
            foreach (var n in new[] { 1, 5, 400, 20_000 })
                Assert.Equal(LogLesen.Letzte(text, n), LogLesen.Ende(p, n));
            Assert.Equal(text, LogLesen.Ende(p, 200_000));   // mehr Zeilen als die Datei hat: alles
            Assert.Equal(text, LogLesen.Ende(p));
        }
        finally { File.Delete(p); }
    }

    [Fact]
    public void Ueber_der_Grenze_beginnt_der_Text_mit_der_ersten_ganzen_Zeile()
    {
        var text = string.Concat(Enumerable.Range(1, 1000).Select(i => $"Zeile {i:0000}\n"));   // je 11 Bytes
        var p = Datei(text);
        try
        {
            var ende = LogLesen.Ende(p, 0, 115);
            Assert.StartsWith("… Zeile 0991\n", ende);
            Assert.EndsWith("Zeile 1000\n", ende);
            Assert.Equal("", LogLesen.Ende(Path.Combine(Path.GetTempPath(), "gibtsnicht.log")));
        }
        finally { File.Delete(p); }
    }
}
