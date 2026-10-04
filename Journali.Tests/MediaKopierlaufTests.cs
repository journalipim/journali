using System.Security.Cryptography;
using System.Text;
using Journali.Server;

namespace Journali.Tests;

/// <summary>Der Kopierlauf zwischen zwei Medienspeichern ist hash-geprüft (04.10.2026): ein Blob, dessen Bytes nicht zu seinem Namen passen, wird nicht übernommen.</summary>
public class MediaKopierlaufTests
{
    private static string Hex(byte[] b) => Convert.ToHexString(SHA256.HashData(b)).ToLowerInvariant();

    [Fact]
    public async Task Kopiert_was_fehlt_und_laesst_beschaedigte_Blobs_aus()
    {
        var wurzel = Path.Combine(Path.GetTempPath(), "journali-kopierlauf-" + Guid.NewGuid().ToString("N"));
        try
        {
            var quelle = new FileMediaStore(Path.Combine(wurzel, "a"));
            var ziel = new FileMediaStore(Path.Combine(wurzel, "b"));
            var (gut, _) = await quelle.PutAsync(new MemoryStream(Encoding.UTF8.GetBytes("ein Bild")), CancellationToken.None);
            await quelle.PutAsync(gut + ".thumb", new MemoryStream(Encoding.UTF8.GetBytes("Vorschau")), CancellationToken.None);   // abgeleitet: eigene Bytes
            var kaputt = Hex(Encoding.UTF8.GetBytes("das Original"));
            await quelle.PutAsync(kaputt, new MemoryStream(Encoding.UTF8.GetBytes("beschädigt")), CancellationToken.None);       // Name passt nicht zu den Bytes
            var vorhanden = Hex(Encoding.UTF8.GetBytes("schon da"));
            await quelle.PutAsync(new MemoryStream(Encoding.UTF8.GetBytes("schon da")), CancellationToken.None);
            await ziel.PutAsync(new MemoryStream(Encoding.UTF8.GetBytes("schon da")), CancellationToken.None);

            var meldungen = new List<string>();
            var (kopiert, uebersprungen, fehlgeschlagen) = await MediaStores.CopyAsync(quelle, ziel, CancellationToken.None, meldungen.Add);

            Assert.Equal((2, 1, 1), (kopiert, uebersprungen, fehlgeschlagen));
            Assert.True(await ziel.ExistsAsync(gut, CancellationToken.None));
            Assert.True(await ziel.ExistsAsync(gut + ".thumb", CancellationToken.None));
            Assert.False(await ziel.ExistsAsync(kaputt, CancellationToken.None));
            Assert.True(await ziel.ExistsAsync(vorhanden, CancellationToken.None));
            Assert.Contains(meldungen, m => m.StartsWith("✗ " + kaputt));
        }
        finally { try { Directory.Delete(wurzel, true); } catch (IOException) { } }
    }
}
