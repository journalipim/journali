using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>
/// Schnappschuss der Abbilder: der Stand
/// aller Abbilder bei Eintrag #n als eine JSON-Datei. Beim nächsten Start werden die Abbilder daraus geladen und nur der Rest
/// ab #n aus dem Journal angewandt — bei Millionen Einträgen ist das Anwenden (~18 µs je Eintrag) sonst der Start. Der
/// Schnappschuss ist wie der Spiegel des Journals ein Cache, keine Wahrheit: er trägt den Bau-Stempel des Kerns (jede neue
/// Version der Abbilder verwirft alte Schnappschüsse), und der Eintrag #n wird gegen das Journal geprüft (Nummer, Strom, Typ,
/// Zeit) — passt etwas nicht, wird die Datei gelöscht und alles wie bisher aus dem Journal gebaut. Datei löschen ist immer erlaubt.
///
/// Wie: System.Text.Json über die Abbild-Klassen selbst — auch private Felder und private Setter (Resolver unten), Sammlungen
/// werden an Ort und Stelle gefüllt (Populate), Schlüssel vom Typ <see cref="Axis"/> und (System, Id) als Text. Kein eigenes
/// Format je Abbild: ein neues Feld in einem Abbild ist automatisch dabei, ein alter Schnappschuss fällt am Stempel.
/// </summary>
public static class Snapshot
{
    /// <summary>
    /// Stempel: der Fingerabdruck der Kern-Logik (<see cref="Fingerabdruck"/>) — ändert sich, wenn die Abbilder anders
    /// rechnen könnten, nicht bei jedem Commit. Einmal je Prozess gerechnet.
    /// </summary>
    public static string Stamp => _stamp ??= Fingerabdruck.Von(typeof(Snapshot).Assembly);
    private static string? _stamp;

    public static readonly JsonSerializerOptions Options = new()
    {
        IncludeFields = true,
        PreferredObjectCreationHandling = JsonObjectCreationHandling.Populate,
        TypeInfoResolver = new DefaultJsonTypeInfoResolver { Modifiers = { PrivateMembers } },
        Converters = { new AxisConverter(), new PairConverter() },
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private sealed record Head(long Number, string Stream, string Type, DateTimeOffset At);
    private sealed record File(string Stamp, Head Check, Dictionary<string, JsonElement> Parts);

    /// <summary>Alle Abbilder bei ihrem gemeinsamen Stand schreiben (erst in eine Nebendatei, dann umbenennen). Liefert #n.</summary>
    public static long Save(string path, IJournal journal, IReadOnlyList<(string Name, IProjection Projection)> parts) =>
        Prepare(journal, parts) is { } prepared ? Write(path, prepared) : 0;

    /// <summary>Der Stand, bereit zum Schreiben: die Abbilder als UTF-8-Bytes, noch ohne Datei.</summary>
    public sealed record Prepared(long Number, string Stream, string Type, DateTimeOffset At, Dictionary<string, byte[]> Parts);

    /// <summary>
    /// Der erste Teil von <see cref="Save"/>: die Abbilder in Bytes verwandeln. Nur das braucht einen ganzen, ruhigen Stand — der
    /// Aufrufer hält dafür die Lesesperre; das Schreiben der Datei (<see cref="Write"/>) geschieht danach ohne sie. Bei 340 MB dauerte
    /// beides zusammen fast 9 Sekunden, und solange hielt jeder wartende Schreiber alle weiteren Leser auf (01.10.2026).
    /// </summary>
    public static Prepared? Prepare(IJournal journal, IReadOnlyList<(string Name, IProjection Projection)> parts)
    {
        var number = parts.Min(p => p.Projection.LastApplied);
        if (number == 0) return null;
        var check = journal.ReadAfter(number - 1).FirstOrDefault();
        if (check is null || check.Number != number) return null;
        return new Prepared(check.Number, check.Stream, check.Type, check.At,
            parts.ToDictionary(p => p.Name, p => JsonSerializer.SerializeToUtf8Bytes(p.Projection, p.Projection.GetType(), Options)));
    }

    /// <summary>Der zweite Teil: die Datei schreiben (erst in eine Nebendatei, dann umbenennen). Liefert #n.</summary>
    public static long Write(string path, Prepared p)
    {
        var parts = new Dictionary<string, JsonElement>();
        foreach (var (name, bytes) in p.Parts) { using var doc = JsonDocument.Parse(bytes); parts[name] = doc.RootElement.Clone(); }
        var file = new File(Stamp, new Head(p.Number, p.Stream, p.Type, p.At), parts);
        var tmp = path + ".tmp";
        using (var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None, 1 << 16))
            JsonSerializer.Serialize(fs, file, Options);
        System.IO.File.Move(tmp, path, overwrite: true);
        return p.Number;
    }

    /// <summary>
    /// Abbilder aus der Datei laden — neue Instanzen je Name (der Aufrufer tauscht sie ein). Liefert #n und die Instanzen,
    /// oder 0, wenn es keine Datei gibt, der Stempel nicht passt oder der Eintrag #n im Journal anders ist (Datei wird gelöscht).
    /// <para>In einem Durchgang (14.10.2026): erst der Kopf (Stempel und Eintrag #n stehen am Anfang der Datei) — passt er nicht, ist die Datei
    /// verworfen, bevor die Abbilder gelesen sind —, dann die Abbilder direkt aus der Datei in ihre Typen. Vorher las der Start die ganze Datei in
    /// ein JsonDocument und jedes Abbild daraus ein zweites Mal: bei 849 MB 7 s und 1,6 GB, jetzt 5 s und 1,3 GB.</para>
    /// </summary>
    public static long Load(string path, IJournal journal, IReadOnlyList<(string Name, Type Type)> parts, out Dictionary<string, IProjection> loaded)
    {
        loaded = new();
        if (!System.IO.File.Exists(path)) return 0;
        try
        {
            var (stamp, check) = Kopf(path);
            if (stamp != Stamp || check is null) { Discard(path); return 0; }
            var db = journal.ReadAfter(check.Number - 1).FirstOrDefault();
            if (db is null || db.Number != check.Number || db.Stream != check.Stream || db.Type != check.Type || db.At != check.At) { Discard(path); return 0; }
            Laden? file;
            using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 1 << 16))
                file = JsonSerializer.Deserialize<Laden>(fs, MitTeilen(parts));
            foreach (var (name, _) in parts)
            {
                if (file?.Parts.Werte.GetValueOrDefault(name) is not IProjection p || p.LastApplied != check.Number) { Discard(path); loaded = new(); return 0; }
                loaded[name] = p;
            }
            return check.Number;
        }
        catch { Discard(path); loaded = new(); return 0; }
    }

    /// <summary>Stempel und Eintrag #n vom Anfang der Datei — ohne den Rest zu lesen (sie stehen vor den Abbildern, siehe <see cref="Write"/>).</summary>
    private static (string? Stamp, Head? Check) Kopf(string path)
    {
        var puffer = new byte[1 << 16];
        int n;
        using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 1 << 12)) n = fs.Read(puffer, 0, puffer.Length);
        var r = new Utf8JsonReader(puffer.AsSpan(0, n), isFinalBlock: false, default);
        if (!r.Read() || r.TokenType != JsonTokenType.StartObject) return (null, null);
        string? stamp = null; Head? check = null;
        while (r.Read() && r.TokenType == JsonTokenType.PropertyName)
        {
            var name = r.GetString();
            if (name == nameof(File.Parts)) break;
            if (!r.Read()) break;
            if (name == nameof(File.Stamp)) stamp = r.GetString();
            else if (name == nameof(File.Check)) check = JsonSerializer.Deserialize<Head>(ref r, Options);
            else r.Skip();
        }
        return (stamp, check);
    }

    /// <summary>Die Datei beim Laden: nur die Abbilder (Stempel und Kopf sind schon gelesen).</summary>
    private sealed class Laden { public Teile Parts { get; set; } = new(); }
    /// <summary>Die Abbilder als Objekt, dessen Eigenschaften erst beim Laden feststehen: je Name eine Eigenschaft ihres Typs (<see cref="MitTeilen"/>).</summary>
    private sealed class Teile { [JsonIgnore] public Dictionary<string, object?> Werte { get; } = new(); }

    /// <summary>Optionen wie <see cref="Options"/>, dazu der Vertrag für <see cref="Teile"/>: je Abbild eine Eigenschaft seines Typs. So liest
    /// der Serializer jedes Abbild direkt aus dem Strom, ohne die ganze Datei als Dokument zu halten.</summary>
    private static JsonSerializerOptions MitTeilen(IReadOnlyList<(string Name, Type Type)> parts) => new(Options)
    {
        TypeInfoResolver = new DefaultJsonTypeInfoResolver
        {
            Modifiers =
            {
                PrivateMembers,
                ti =>
                {
                    if (ti.Type != typeof(Teile)) return;
                    ti.Properties.Clear();
                    foreach (var (name, type) in parts)
                    {
                        var p = ti.CreateJsonPropertyInfo(type, name);
                        p.Set = (obj, value) => ((Teile)obj).Werte[name] = value;
                        ti.Properties.Add(p);
                    }
                },
            },
        },
    };

    private static void Discard(string path) { try { System.IO.File.Delete(path); } catch { } }

    // ---- Resolver: private Felder und private Setter der Abbild-Klassen mitnehmen
    private static void PrivateMembers(JsonTypeInfo ti)
    {
        if (ti.Kind != JsonTypeInfoKind.Object || ti.Type.Namespace is not ("Journali.Core.Projections" or "Journali.Core.Entries")) return;
        // private Setter (LastApplied, MasterLocale …) setzbar machen
        foreach (var prop in ti.Properties)
        {
            if (prop.Set is not null || prop.AttributeProvider is not PropertyInfo pi) continue;
            var setter = pi.GetSetMethod(nonPublic: true);
            if (setter is not null && !setter.IsPublic) prop.Set = (obj, value) => pi.SetValue(obj, value);
        }
        // private Instanzfelder (ohne Compiler-Rückfelder): lesbar; schreibbar, wenn nicht readonly, sonst an Ort und Stelle füllen
        for (var t = ti.Type; t is not null && t != typeof(object); t = t.BaseType)
        {
            foreach (var f in t.GetFields(BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.DeclaredOnly))
            {
                if (f.Name.Contains('<') || f.IsStatic) continue;
                if (ti.Properties.Any(p => p.Name == f.Name)) continue;
                var jp = ti.CreateJsonPropertyInfo(f.FieldType, f.Name);
                jp.Get = obj => f.GetValue(obj);
                if (!f.IsInitOnly) jp.Set = (obj, value) => f.SetValue(obj, value);
                else if (!f.FieldType.IsValueType && f.FieldType != typeof(string)) jp.ObjectCreationHandling = JsonObjectCreationHandling.Populate;
                else continue;   // readonly Wert oder Text: nicht wiederherstellbar — es gibt keins in den Abbildern
                ti.Properties.Add(jp);
            }
        }
    }

    /// <summary>Axis als Text „attribut|sprache|kanal|zeile“ — auch als Schlüssel eines Dictionary.</summary>
    private sealed class AxisConverter : JsonConverter<Axis>
    {
        private static string Enc(Axis a) => string.Join('|', new[] { a.Attribute, a.Locale ?? "", a.Channel ?? "", a.Row ?? "" });
        private static Axis Dec(string s) { var p = s.Split('|'); return new Axis(p[0], p.Length > 1 && p[1].Length > 0 ? p[1] : null, p.Length > 2 && p[2].Length > 0 ? p[2] : null, p.Length > 3 && p[3].Length > 0 ? p[3] : null); }
        public override Axis Read(ref Utf8JsonReader r, Type t, JsonSerializerOptions o) => Dec(r.GetString() ?? "");
        public override void Write(Utf8JsonWriter w, Axis v, JsonSerializerOptions o) => w.WriteStringValue(Enc(v));
        public override Axis ReadAsPropertyName(ref Utf8JsonReader r, Type t, JsonSerializerOptions o) => Dec(r.GetString() ?? "");
        public override void WriteAsPropertyName(Utf8JsonWriter w, Axis v, JsonSerializerOptions o) => w.WritePropertyName(Enc(v));
    }

    /// <summary>(System, Id) als Text „system|id“ — Schlüssel der Kennungs-Indizes.</summary>
    private sealed class PairConverter : JsonConverter<(string System, string Id)>
    {
        public override (string System, string Id) Read(ref Utf8JsonReader r, Type t, JsonSerializerOptions o) { var p = (r.GetString() ?? "|").Split('|', 2); return (p[0], p.Length > 1 ? p[1] : ""); }
        public override void Write(Utf8JsonWriter w, (string System, string Id) v, JsonSerializerOptions o) => w.WriteStringValue(v.System + "|" + v.Id);
        public override (string System, string Id) ReadAsPropertyName(ref Utf8JsonReader r, Type t, JsonSerializerOptions o) => Read(ref r, t, o);
        public override void WriteAsPropertyName(Utf8JsonWriter w, (string System, string Id) v, JsonSerializerOptions o) => w.WritePropertyName(v.System + "|" + v.Id);
    }
}
