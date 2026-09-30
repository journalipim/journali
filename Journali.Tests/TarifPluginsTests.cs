using Journali.Core.Entries;
using Journali.Core.Projections;

namespace Journali.Tests;

/// <summary>
/// Welches Plugin zu welchem Tarif gehört — am Saatgut festgehalten, damit ein neues Plugin nicht unbemerkt in den
/// Einstieg rutscht. Im Betrieb gilt das signierte Tarifblatt; das Saatgut ist seine erste Fassung.
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

    /// <summary>Kein Systemjob: ein Skript rechnet nichts, was jede Anlage braucht — es ist kein Betrieb, sondern ein Merkmal.</summary>
    [Fact]
    public void Ein_Skript_ist_kein_Systemjob()
    {
        Assert.DoesNotContain(ScriptumApiPlugin, Tarife.Systemjobs);
        Assert.Equal(["derive", "embed", "probe"], Tarife.Systemjobs.Order().ToArray());
    }

    /// <summary>Der Einstieg bleibt, was er ist: die Tabelle und der Tasker, der ihre Jobs startet.</summary>
    [Fact]
    public void Kostenlos_enthaelt_die_Tabelle_und_den_Tasker()
    {
        foreach (var p in new[] { "table", "csv", "excel", "json", "tasker", "driver" }) Assert.True(Tarife.Free.Erlaubt(p), p);
        foreach (var p in new[] { "datasheet", "xliff", "etim", "gpc", "backup" }) Assert.False(Tarife.Free.Erlaubt(p), p);
        // Pro bringt die dazu — und bleibt ohne Skripte
        foreach (var p in new[] { "datasheet", "xliff", "etim", "gpc", "backup" }) Assert.True(Tarife.Pro.Erlaubt(p), p);
    }

    private const string ScriptumApiPlugin = "scriptum";
}
