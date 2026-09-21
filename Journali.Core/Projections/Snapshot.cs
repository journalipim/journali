using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using Journali.Core.Journal;

namespace Journali.Core.Projections;

/// <summary>
/// Schnappschuss der Abbilder (Taloan, 21.09.2026: „Schnappschüsse der Abbilder → ja“; docs/architektur.md „Offen“): der Stand
/// aller Abbilder bei Eintrag #n als eine JSON-Datei. Beim nächsten Start werden die Abbilder daraus geladen und nur der Rest
/// ab #n aus dem Journal angewandt — bei Millionen Einträgen ist das Anwenden (~18 µs je Eintrag) sonst der Start. Der
/// Schnappschuss ist wie der Spiegel des Journals ein Cache, keine Wahrheit: er trägt den Bau-Stempel des Kerns (jede neue
/// Fassung der Abbilder verwirft alte Schnappschüsse), und der Eintrag #n wird gegen das Journal geprüft (Nummer, Strom, Typ,
/// Zeit) — passt etwas nicht, wird die Datei gelöscht und alles wie bisher aus dem Journal gebaut. Datei löschen ist immer erlaubt.
///
/// Wie: System.Text.Json über die Abbild-Klassen selbst — auch private Felder und private Setter (Resolver unten), Sammlungen
/// werden an Ort und Stelle gefüllt (Populate), Schlüssel vom Typ <see cref="Axis"/> und (System, Id) als Text. Kein eigenes
/// Format je Abbild: ein neues Feld in einem Abbild ist automatisch dabei, ein alter Schnappschuss fällt am Stempel.
/// </summary>
public static class Snapshot
{
    /// <summary>Bau-Stempel: ändert sich mit jedem Bau des Kerns — die Abbilder könnten anders rechnen.</summary>
    public static string Stamp => typeof(Snapshot).Assembly.ManifestModule.ModuleVersionId.ToString("N");

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
    public static long Save(string path, IJournal journal, IReadOnlyList<(string Name, IProjection Projection)> parts)
    {
        var number = parts.Min(p => p.Projection.LastApplied);
        if (number == 0) return 0;
        var check = journal.ReadAfter(number - 1).FirstOrDefault();
        if (check is null || check.Number != number) return 0;
        var file = new File(Stamp, new Head(check.Number, check.Stream, check.Type, check.At),
            parts.ToDictionary(p => p.Name, p => JsonSerializer.SerializeToElement(p.Projection, p.Projection.GetType(), Options)));
        var tmp = path + ".tmp";
        using (var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None, 1 << 16))
            JsonSerializer.Serialize(fs, file, Options);
        System.IO.File.Move(tmp, path, overwrite: true);
        return number;
    }

    /// <summary>
    /// Abbilder aus der Datei laden — neue Instanzen je Name (der Aufrufer tauscht sie ein). Liefert #n und die Instanzen,
    /// oder 0, wenn es keine Datei gibt, der Stempel nicht passt oder der Eintrag #n im Journal anders ist (Datei wird gelöscht).
    /// </summary>
    public static long Load(string path, IJournal journal, IReadOnlyList<(string Name, Type Type)> parts, out Dictionary<string, IProjection> loaded)
    {
        loaded = new();
        if (!System.IO.File.Exists(path)) return 0;
        try
        {
            File? file;
            using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 1 << 16))
                file = JsonSerializer.Deserialize<File>(fs, Options);
            if (file is null || file.Stamp != Stamp) { Discard(path); return 0; }
            var db = journal.ReadAfter(file.Check.Number - 1).FirstOrDefault();
            if (db is null || db.Number != file.Check.Number || db.Stream != file.Check.Stream || db.Type != file.Check.Type || db.At != file.Check.At) { Discard(path); return 0; }
            foreach (var (name, type) in parts)
            {
                if (!file.Parts.TryGetValue(name, out var el)) { Discard(path); loaded = new(); return 0; }
                var p = (IProjection?)el.Deserialize(type, Options);
                if (p is null || p.LastApplied != file.Check.Number) { Discard(path); loaded = new(); return 0; }
                loaded[name] = p;
            }
            return file.Check.Number;
        }
        catch { Discard(path); loaded = new(); return 0; }
    }

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
