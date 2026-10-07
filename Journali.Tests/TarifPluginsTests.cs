using Journali.Core.Entries;
using Journali.Core.Projections;

namespace Journali.Tests;

/// <summary>
/// Welches Plugin zu welchem Tarif gehört — am Saatgut festgehalten, damit ein neues Plugin nicht unbemerkt in den
/// Einstieg rutscht. Im Betrieb gilt das signierte Tarifblatt; das Saatgut ist seine erste Version.
/// </summary>
public class TarifPluginsTests
{
    /// <summary>
    /// Skripte gibt es erst ab Pro+ (29.09.2026, entschieden): ein Skript läuft als Prozess auf dem Server, und wer
    /// eines schreibt, kann alles, was der Serverbenutzer kann. Kostenlos und Pro bleiben ohne.
    /// </summary>
    [Fact]
    public void Skripte_gibt_es_erst_ab_Pro_Plus()
    {
        Assert.False(Tarife.Free.Erlaubt(ScriptumApiPlugin));
        Assert.False(Tarife.Pro.Erlaubt(ScriptumApiPlugin));
        Assert.True(Tarife.ProPlus.Erlaubt(ScriptumApiPlugin));
        Assert.True(Tarife.Enterprise.Erlaubt(ScriptumApiPlugin));
        Assert.True(Tarife.Unlimited.Erlaubt(ScriptumApiPlugin));
        // und in der Liste steht der niedrigste Tarif, der es enthält — das zeigt die Oberfläche bei einem gesperrten Plugin
        Assert.Equal(Tarife.ProPlus.Key, Tarife.Saat.Ab(ScriptumApiPlugin)?.Key);
    }

    /// <summary>Kein Systemjob: ein Skript rechnet nichts, was jede Instanz braucht — es ist kein Betrieb, sondern ein Merkmal.</summary>
    [Fact]
    public void Ein_Skript_ist_kein_Systemjob()
    {
        Assert.DoesNotContain(ScriptumApiPlugin, Tarife.Systemjobs);
        Assert.Equal(["derive", "probe"], Tarife.Systemjobs.Order().ToArray());   // embed nicht mehr: ein Merkmal des Tarifs (03.10.2026)
    }

    /// <summary>Der Katalog, den der Lizenzserver beim Tarifblatt zeigt, nennt genau die Plugins im Repo (03.10.2026).</summary>
    [Fact]
    public void Der_Plugin_Katalog_nennt_jedes_Plugin_im_Repo()
    {
        var dir = AppContext.BaseDirectory;
        while (dir is not null && !Directory.Exists(Path.Combine(dir, "plugins"))) dir = Path.GetDirectoryName(dir);
        Assert.NotNull(dir);
        var imRepo = Directory.GetDirectories(Path.Combine(dir!, "plugins")).Where(d => File.Exists(Path.Combine(d, "plugin.json"))).Select(Path.GetFileName).Order().ToArray();
        Assert.Equal(imRepo, Tarife.Katalog.Select(k => k.Key).Order().ToArray());
        foreach (var t in Tarife.Saat.Alle) foreach (var p in t.Plugins ?? new HashSet<string>()) Assert.Contains(p, Tarife.Katalog.Select(k => k.Key));
    }

    /// <summary>Der Einstieg bleibt, was er ist: die Tabelle und der Tasker, der ihre Jobs startet.</summary>
    [Fact]
    public void Kostenlos_enthaelt_die_Tabelle_und_den_Tasker()
    {
        foreach (var p in new[] { "table", "csv", "excel", "json", "tasker", "driver" }) Assert.True(Tarife.Free.Erlaubt(p), p);
        foreach (var p in new[] { "datasheet", "xliff", "etim", "gpc", "backup" }) Assert.False(Tarife.Free.Erlaubt(p), p);
        // Pro bringt diese dazu — wie das Tarifblatt Version 11 des Lizenzservers (03.10.2026); GPC, Vektoren und Skripte erst ab Pro+
        foreach (var p in new[] { "datasheet", "xliff", "xport", "etim", "da", "backup", "configurator" }) Assert.True(Tarife.Pro.Erlaubt(p), p);
        foreach (var p in new[] { "gpc", "embed", "scriptum" }) { Assert.False(Tarife.Pro.Erlaubt(p), p); Assert.True(Tarife.ProPlus.Erlaubt(p), p); }
    }

    private const string ScriptumApiPlugin = "scriptum";
}
