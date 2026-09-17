using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>Ein Plugin, wie das Journal es kennt: installierte Fassung, Manifest, an oder aus.</summary>
public sealed class PluginState
{
    public required string Key { get; init; }
    public string Version { get; set; } = "";
    public string Manifest { get; set; } = "{}";     // plugin.json, wie es bei der Installation war
    public bool Enabled { get; set; }
    public long LastNumber { get; set; }
    public DateTimeOffset LastAt { get; set; }
    public string LastActor { get; set; } = "";
}

/// <summary>
/// Abbild „die Plugins" (docs/pflegestruktur.md, 19): Strom <c>plugin:&lt;key&gt;</c>. Installiert, an, aus,
/// entfernt — nachvollziehbar wie alles andere. Die Dateien liegen unter plugins/&lt;key&gt;/; was dort
/// liegt, sagt der Server, was gilt, sagt dieses Abbild.
/// </summary>
public sealed class Plugins : IProjection
{
    private readonly Dictionary<string, PluginState> _all = new();

    public long LastApplied { get; private set; }

    public IReadOnlyDictionary<string, PluginState> All => _all;

    public const string Stream = "plugin:";

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        if (!entry.Stream.StartsWith(Stream, StringComparison.Ordinal)) return;
        var key = entry.Stream[Stream.Length..];
        switch (entry.Type)
        {
            case Types.PluginInstalled:
                var pi = Types.Deserialize<PluginInstalled>(entry.Payload);
                if (!_all.TryGetValue(key, out var p)) _all[key] = p = new PluginState { Key = key };
                p.Version = pi.Version; p.Manifest = pi.Manifest;
                Touch(p, entry);
                break;
            case Types.PluginEnabled:
                if (_all.TryGetValue(key, out var e)) { e.Enabled = true; Touch(e, entry); }
                break;
            case Types.PluginDisabled:
                if (_all.TryGetValue(key, out var d)) { d.Enabled = false; Touch(d, entry); }
                break;
            case Types.PluginRemoved:
                _all.Remove(key);
                break;
        }
    }

    private static void Touch(PluginState p, Entry e) { p.LastNumber = e.Number; p.LastAt = e.At; p.LastActor = e.Actor; }
}
