using Journali.Core.Entries;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>
/// Ein Medium (docs/pflegestruktur.md, 20): die Datei liegt ausserhalb, adressiert über ihren
/// SHA-256; im Journal stehen nur Hash, Grösse, Typ, Name — und wie bei Knoten und Relationen
/// eigene Werte (Alt-Text, Rechte, Quelle). Strom <c>m-…</c>. Unveränderlich: ein neues Bild ist
/// ein neues Medium. Die Zuordnung zum Knoten ist eine Relation (18) mit dem Medium als Ziel.
/// </summary>
public sealed class Medium
{
    public required string Id { get; init; }
    public required string Sha256 { get; init; }
    public required long Bytes { get; init; }
    public required string Mime { get; init; }
    public required string Name { get; init; }
    public Dictionary<Axis, string> Values { get; } = new();
    public Dictionary<Axis, string[]> Lists { get; } = new();
    public Dictionary<Axis, long> SetAt { get; } = new();
    public Dictionary<string, string> External { get; } = new();
    public long LastNumber { get; set; }
    public DateTimeOffset LastAt { get; set; }
    public string LastActor { get; set; } = "";
    public int Entries { get; set; }
    public bool IsImage => Mime.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
    /// <summary>Woraus sich ein Vorschaubild rechnen lässt. Bilder schon immer;
    /// ein PDF bekommt seine erste Seite als Kachel. Bleibt trotzdem ein Dokument — <see cref="IsImage"/> sagt weiterhin,
    /// was ein Bild ist (Gruppierung in der Bibliothek, Anzeige des Originals).</summary>
    public bool IsRenderable => IsImage || Mime.Equals("application/pdf", StringComparison.OrdinalIgnoreCase);
    /// <summary>Ordner der Bibliothek (MediaFiled); null = kein Ordner.</summary>
    public string? Folder { get; set; }
    /// <summary>Ableitungen nach Preset (MediaDerived): Preset → Mass, Grösse, Fingerabdruck des Presets zur Zeit des Rechnens.</summary>
    public Dictionary<string, Derived> Derived { get; } = new();
    /// <summary>Was im Kopf der Datei steht (MediaProbed); null = noch nicht gelesen oder Format unbekannt.</summary>
    public MediaProbed? Probe { get; set; }
    /// <summary>Woher das Medium kam (MediaSourced); null = von Hand hochgeladen.</summary>
    public MediaSourced? Source { get; set; }
    /// <summary>Wann es angelegt wurde — das Importdatum. Steht im ersten Eintrag, nicht im Rumpf.</summary>
    public DateTimeOffset CreatedAt { get; set; }
    /// <summary>Wer es anlegte. Bei einem Job <c>job:&lt;key&gt;</c>.</summary>
    public string CreatedBy { get; set; } = "";
    /// <summary>Pixel des Originals — zum Sortieren und Filtern („mindestens 2000 px“). 0 ohne gelesenen Kopf.</summary>
    public long Pixels => Probe is { } p ? (long)p.Width * p.Height : 0;
}

public sealed record Derived(int Width, int Height, long Bytes, string Fingerprint, long Number);

/// <summary>Ein Vorschau-Preset. Strom <c>media-preset:&lt;key&gt;</c>.</summary>
public sealed class MediaPreset
{
    public required string Key { get; init; }
    public Labels Label { get; set; } = new();
    public int Width { get; set; }
    public int Height { get; set; }
    public string Format { get; set; } = "webp";
    public int Quality { get; set; } = 82;
    public bool Auto { get; set; } = true;
    public long LastNumber { get; set; }
    /// <summary>Was die Ableitung bestimmt — steht am MediaDerived; anders = neu rechnen.</summary>
    public string Fingerprint => $"{Width}x{Height}/{Format}/{Quality}";
    public string Mime => Format switch { "jpeg" or "jpg" => "image/jpeg", "png" => "image/png", "avif" => "image/avif", _ => "image/webp" };
}

/// <summary>Ein Medienordner: Name, Vater (null = oberste Ebene). Strom <c>mf-…</c>.</summary>
public sealed class MediaFolder
{
    public required string Id { get; init; }
    public required string Name { get; set; }
    public string? Parent { get; set; }
    public long LastNumber { get; set; }
}

/// <summary>Abbild „die Medien": alle Medien, Index nach Hash (gleiche Datei zweimal = ein Medium) und externer Kennung.</summary>
public sealed class Media : IProjection
{
    private readonly Dictionary<string, Medium> _all = new();
    private readonly Dictionary<string, string> _bySha = new();
    private readonly Dictionary<(string System, string Id), string> _external = new();
    private readonly Dictionary<string, MediaFolder> _folders = new();
    private readonly Dictionary<string, MediaPreset> _presets = new();
    private readonly HashSet<string> _presetsEver = new();   // je definiert, auch zurückgezogene — fürs Saatgut
    public const string PresetStream = "media-preset:";
    /// <summary>Das Preset der Kacheln — die Bibliothek braucht es, darum lässt es sich nicht löschen (DeriveApi).</summary>
    public const string ThumbPreset = "thumb";
    public bool PresetEver(string key) => _presetsEver.Contains(key);

    public long LastApplied { get; private set; }
    public IReadOnlyDictionary<string, MediaPreset> Presets => _presets;

    /// <summary>Medien, denen eine aktuelle Ableitung nach diesem Preset fehlt (nie gerechnet oder Preset seither geändert).</summary>
    public IEnumerable<Medium> Pending(MediaPreset preset) => _all.Values.Where(m => m.IsRenderable && (!m.Derived.TryGetValue(preset.Key, out var d) || d.Fingerprint != preset.Fingerprint));
    /// <summary>Medien, deren Kopf noch nicht gelesen wurde — die offene Postenliste des Jobs <c>probe</c>.</summary>
    public IEnumerable<Medium> Unprobed() => _all.Values.Where(m => m.Probe is null);
    /// <summary>Medien, deren Kopf gelesen wurde, ohne ein bekanntes Format zu ergeben (Mass 0 × 0).
    /// Eine neue Fassung des Servers kennt vielleicht mehr — <c>again=true</c> liest sie erneut.</summary>
    public IEnumerable<Medium> Unknown() => _all.Values.Where(m => m.Probe is { Width: 0 });
    /// <summary>Liegt die Ableitung aktuell vor?</summary>
    public bool HasDerived(Medium m, MediaPreset preset) => m.Derived.TryGetValue(preset.Key, out var d) && d.Fingerprint == preset.Fingerprint;

    public IReadOnlyDictionary<string, Medium> All => _all;
    public IReadOnlyDictionary<string, MediaFolder> Folders => _folders;

    /// <summary>Ordner unter diesem (null = oberste Ebene), nach Name.</summary>
    public IEnumerable<MediaFolder> SubFolders(string? parent) => _folders.Values.Where(f => f.Parent == parent).OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase);
    /// <summary>Medien in diesem Ordner (null = ohne Ordner).</summary>
    public IEnumerable<Medium> InFolder(string? folder) => _all.Values.Where(m => m.Folder == folder);
    /// <summary>Der Ordner und alles darunter (für „mit Unterordnern“).</summary>
    public IEnumerable<string> FolderAndBelow(string id)
    {
        if (!_folders.ContainsKey(id)) yield break;
        var stack = new Stack<string>(); stack.Push(id);
        while (stack.Count > 0) { var f = stack.Pop(); yield return f; foreach (var k in _folders.Values.Where(x => x.Parent == f)) stack.Push(k.Id); }
    }
    /// <summary>Pfad vom obersten Ordner bis zu diesem.</summary>
    public IEnumerable<MediaFolder> PathOf(string? id)
    {
        var chain = new List<MediaFolder>();
        for (var f = id is null ? null : _folders.GetValueOrDefault(id); f is not null; f = f.Parent is null ? null : _folders.GetValueOrDefault(f.Parent)) { if (chain.Contains(f)) break; chain.Add(f); }
        chain.Reverse(); return chain;
    }

    public Medium? BySha(string sha256) => _bySha.TryGetValue(sha256, out var id) && _all.TryGetValue(id, out var m) ? m : null;

    public Medium? ByExternal(string system, string id) =>
        _external.TryGetValue((system, id), out var mid) && _all.TryGetValue(mid, out var m) ? m : null;

    public void Apply(Entry entry)
    {
        LastApplied = entry.Number;
        Medium m;
        // Vorschau-Presets: Strom media-preset:<key>
        if (entry.Stream.StartsWith(PresetStream, StringComparison.Ordinal))
        {
            var key = entry.Stream[PresetStream.Length..];
            switch (entry.Type)
            {
                case Types.MediaPresetDefined:
                    var pd = Types.Deserialize<MediaPresetDefined>(entry.Payload);
                    _presetsEver.Add(key);
                    if (!_presets.TryGetValue(key, out var p)) _presets[key] = p = new MediaPreset { Key = key };
                    p.Label = pd.Label; p.Width = pd.Width; p.Height = pd.Height; p.Format = pd.Format; p.Quality = pd.Quality; p.Auto = pd.Auto; p.LastNumber = entry.Number;
                    break;
                case Types.MediaPresetRetired:
                    _presets.Remove(key);
                    break;
            }
            return;
        }
        // Medienordner: eigener Strom mf-…
        switch (entry.Type)
        {
            case Types.MediaFolderCreated:
                var fc = Types.Deserialize<MediaFolderCreated>(entry.Payload);
                _folders[entry.Stream] = new MediaFolder { Id = entry.Stream, Name = fc.Name, Parent = fc.Parent, LastNumber = entry.Number };
                return;
            case Types.MediaFolderRenamed:
                if (_folders.TryGetValue(entry.Stream, out var fr)) { fr.Name = Types.Deserialize<MediaFolderRenamed>(entry.Payload).Name; fr.LastNumber = entry.Number; }
                return;
            case Types.MediaFolderMoved:
                if (_folders.TryGetValue(entry.Stream, out var fm)) { fm.Parent = Types.Deserialize<MediaFolderMoved>(entry.Payload).Parent; fm.LastNumber = entry.Number; }
                return;
            case Types.MediaFolderRetired:
                if (_folders.Remove(entry.Stream))
                {   // was noch drin ist (sollte nichts sein — der Befehl prüft), rutscht eine Ebene hoch
                    foreach (var k in _folders.Values.Where(x => x.Parent == entry.Stream)) k.Parent = null;
                    foreach (var x in _all.Values.Where(x => x.Folder == entry.Stream)) x.Folder = null;
                }
                return;
        }
        if (entry.Type == Types.MediaCreated)
        {
            var mc = Types.Deserialize<MediaCreated>(entry.Payload);
            m = new Medium { Id = entry.Stream, Sha256 = mc.Sha256, Bytes = mc.Bytes, Mime = mc.Mime, Name = mc.Name, CreatedAt = entry.At, CreatedBy = entry.Actor };
            _all[entry.Stream] = m;
            _bySha[mc.Sha256] = m.Id;
        }
        else
        {
            if (!_all.TryGetValue(entry.Stream, out m!)) return;   // kein Medium: übergehen
            switch (entry.Type)
            {
                case Types.MediaFiled:
                    var mf = Types.Deserialize<MediaFiled>(entry.Payload);
                    m.Folder = mf.Folder is { } f && _folders.ContainsKey(f) ? f : null;
                    break;
                case Types.MediaDerived:
                    var md = Types.Deserialize<MediaDerived>(entry.Payload);
                    m.Derived[md.Preset] = new Derived(md.Width, md.Height, md.Bytes, md.Fingerprint, entry.Number);
                    break;
                case Types.MediaProbed:
                    m.Probe = Types.Deserialize<MediaProbed>(entry.Payload);
                    break;
                case Types.MediaSourced:
                    // Nur gesetzte Felder übernehmen: ein zweiter Eintrag ergänzt die Herkunft, er löscht sie nicht
                    var ms = Types.Deserialize<MediaSourced>(entry.Payload);
                    m.Source = m.Source is { } vor
                        ? new MediaSourced(ms.Plugin ?? vor.Plugin, ms.Profile ?? vor.Profile, ms.Job ?? vor.Job, ms.Ref ?? vor.Ref, ms.From ?? vor.From)
                        : ms;
                    break;
                case Types.MediaRetired:
                    _all.Remove(m.Id);
                    if (_bySha.GetValueOrDefault(m.Sha256) == m.Id) _bySha.Remove(m.Sha256);
                    foreach (var (sys, ext) in m.External) _external.Remove((sys, ext));
                    return;
                case Types.AttributeSet:
                    var a = Types.Deserialize<AttributeSet>(entry.Payload);
                    var axis = new Axis(a.Attribute, a.Locale, a.Channel, a.Row);
                    if (a.Values is { } list) { if (list.Length == 0) m.Lists.Remove(axis); else m.Lists[axis] = list; }
                    else if (string.IsNullOrEmpty(a.Value)) m.Values.Remove(axis);
                    else m.Values[axis] = a.Value;
                    if (m.Values.ContainsKey(axis) || m.Lists.ContainsKey(axis)) m.SetAt[axis] = entry.Number; else m.SetAt.Remove(axis);
                    break;
                case Types.ExternalLinked:
                    var el = Types.Deserialize<ExternalLinked>(entry.Payload);
                    if (m.External.TryGetValue(el.System, out var old)) _external.Remove((el.System, old));
                    m.External[el.System] = el.Id;
                    _external[(el.System, el.Id)] = m.Id;
                    break;
                case Types.ExternalUnlinked:
                    var eu = Types.Deserialize<ExternalUnlinked>(entry.Payload);
                    if (m.External.Remove(eu.System, out var gone)) _external.Remove((eu.System, gone));
                    break;
            }
        }
        m.LastNumber = entry.Number;
        m.LastAt = entry.At;
        m.LastActor = entry.Actor;
        m.Entries++;
    }
}
