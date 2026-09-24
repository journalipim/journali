using System.Text.Json.Nodes;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Der Tresor: Anmeldedaten, Mailserver, Geheimnisse der Jobs. Ohne Datenbank als Dateien wie früher; mit Datenbank
/// werden die Dateien übernommen — was im Tresor schon steht, bleibt, was nur dieser Server kannte, kommt dazu.
/// </summary>
public class TresorTests
{
    /// <summary>Ablage im Speicher — steht für die Tabelle, ohne Postgres.</summary>
    private sealed class Speicher : ITresorAblage
    {
        public readonly Dictionary<string, string> Daten = new();
        public string? Lies(string name) => Daten.GetValueOrDefault(name);
        public void Aendere(string name, Func<string?, string?> f)
        {
            var neu = f(Daten.GetValueOrDefault(name));
            if (neu is null) Daten.Remove(name); else Daten[name] = neu;
        }
    }
    private static string Dir() { var d = Path.Combine(Path.GetTempPath(), "journali-tresor-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(d); return d; }

    [Fact]
    public void Ohne_Datenbank_liegt_jedes_Stueck_in_seiner_Datei()
    {
        var dir = Dir();
        var t = new DateiTresor(dir);
        t.Aendere(Tresor.Mail, _ => """{"host":"smtp"}""");
        Assert.True(File.Exists(Path.Combine(dir, "mail.json")));
        Assert.Equal("""{"host":"smtp"}""", t.Lies(Tresor.Mail));
        t.Aendere(Tresor.Mail, _ => null);
        Assert.False(File.Exists(Path.Combine(dir, "mail.json")));
    }

    [Fact]
    public void Uebernahme_ergaenzt_was_fehlt_und_laesst_stehen_was_da_ist()
    {
        var dir = Dir();
        File.WriteAllText(Path.Combine(dir, "auth.json"), """{"passwords":{"admin":"aus-der-datei","it":"nur-hier"},"tokens":{},"sessions":{}}""");
        File.WriteAllText(Path.Combine(dir, "mail.json"), """{"host":"datei-smtp"}""");
        File.WriteAllText(Path.Combine(dir, "secrets.json"), """{"job:a":{"token":"x"}}""");
        var db = new Speicher();
        db.Daten[Tresor.Auth] = """{"passwords":{"admin":"aus-der-db"},"tokens":{},"sessions":{}}""";
        db.Daten[Tresor.Mail] = """{"host":"db-smtp"}""";

        var genommen = Tresor.Uebernehmen(dir, db);

        var pw = JsonNode.Parse(db.Daten[Tresor.Auth])!["passwords"]!;
        Assert.Equal("aus-der-db", (string?)pw["admin"]);   // Gleiches: der Tresor gilt
        Assert.Equal("nur-hier", (string?)pw["it"]);        // nur dieser Server kannte ihn: kommt dazu
        Assert.Contains("db-smtp", db.Daten[Tresor.Mail]);   // den Mailserver gibt es nur einmal
        Assert.Contains("job:a", db.Daten[Tresor.Secrets]);  // war leer: ganz übernommen
        Assert.Equal(["auth.json", "secrets.json"], genommen.Order().ToArray());
        Assert.False(File.Exists(Path.Combine(dir, "auth.json")));
        Assert.True(File.Exists(Path.Combine(dir, "auth.json.uebernommen")));
        Assert.Empty(Tresor.Uebernehmen(dir, db));   // ein zweiter Start findet nichts mehr
    }

    [Fact]
    public void Verschluesselung_haelt_und_bemerkt_Aenderungen()
    {
        var roh = Verschluesselung.Zu("geheim", "tresor");
        Assert.Equal("geheim", Verschluesselung.Von(roh, "tresor"));
        roh[^1] ^= 1;
        Assert.ThrowsAny<System.Security.Cryptography.CryptographicException>(() => Verschluesselung.Von(roh, "tresor"));
        Assert.ThrowsAny<System.Security.Cryptography.CryptographicException>(() => Verschluesselung.Von(Verschluesselung.Zu("x", "tresor"), "db"));
    }

    [Fact]
    public void Job_Geheimnisse_und_Mail_gehen_durch_den_Tresor()
    {
        var dir = Dir();
        Secrets.Set(dir, "job:x", new() { ["token"] = "t1", ["leer"] = "" });
        Assert.Equal("t1", Secrets.Get(dir, "job:x")["token"]);
        Assert.False(Secrets.Get(dir, "job:x").ContainsKey("leer"));
        Secrets.Remove(dir, "job:x");
        Assert.Empty(Secrets.Get(dir, "job:x"));
        Assert.False(File.Exists(Path.Combine(dir, "secrets.json")));   // nichts mehr drin: das Stück ist weg
    }
}
