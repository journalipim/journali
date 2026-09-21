using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Eindeutig als Merkmal (Taloan, 21.09.2026: „SKU ist ein Attribut wie jedes andere — Kennung raus, alles über eindeutig“): beliebig
// viele Attribute, jedes für sich eindeutig; die eindeutigen Werte sind die Schlüssel eines Knotens (keys, Name ohne ★, Kopie ohne sie).
public class UniqueTests
{
    private sealed class World
    {
        public MemoryJournal J = new(); public Catalog C; public string Group, Product, V1, V2;
        public World()
        {
            C = new Catalog(J); C.Rebuild(); C.SeedMissing();
            string g = "", p = "", v1 = "", v2 = "";
            C.With((_, _, write) =>
            {
                write("t", Model.AttributeStream + "ean", Types.AttributeDefined, new AttributeDefinition("ean", Labels.Of("EAN", "EAN"), AttributeTypes.Text, Group: "logistics"), null);
                write("t", Model.AttributeStream + "matnr", Types.AttributeDefined, new AttributeDefinition("matnr", Labels.Of("MATNR", "MATNR"), AttributeTypes.Text, Group: "logistics", Unique: true), null);
                g = write("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("G", "G")), null).Stream;
                p = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(g), null).Stream;
                v1 = write("t", Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(p, new()), null).Stream;
                v2 = write("t", Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(p, new()), null).Stream;
                return 0;
            });
            Group = g; Product = p; V1 = v1; V2 = v2;
            var att = Run(c => Commands.AttachGroups(c, g, ["logistics"])); if (att.Error is not null) throw new Exception(att.Error);   // sku, ean, matnr gelten ab der Gruppe
        }
        public Ctx Ctx(ModelCatalog model, Tree tree, Catalog.Writer write) => new() { Model = model, Tree = tree, Relations = C.Relations, Media = C.Media, Workflows = C.Workflows, Write = (s, t, p) => write("t", s, t, p, null) };
        public Outcome Run(Func<Ctx, Outcome> cmd) => C.With((model, tree, write) => cmd(Ctx(model, tree, write)));
        public Outcome Set(string node, string attr, string value) => Run(c => Commands.SetAttribute(c, node, attr, null, null, value, null, null));
    }

    [Fact]
    public void Mehrere_Attribute_jedes_fuer_sich_eindeutig_kein_Kennungsattribut()
    {
        var w = new World();
        Assert.Equal(["matnr", "sku"], w.C.With((m, _, _) => m.UniqueAttributes.Select(a => a.Key).ToArray()));   // Saatgut sku ist unique
        var first = w.Set(w.V1, "sku", "A-1"); Assert.True(first.Error is null, first.Error);
        var dup = w.Set(w.V2, "sku", "A-1");
        Assert.NotNull(dup.Error); Assert.Contains("gibt es schon", dup.Error);
        Assert.Null(w.Set(w.V2, "matnr", "100").Error); Assert.NotNull(w.Set(w.V1, "matnr", "100").Error);   // matnr für sich
        Assert.Null(w.Set(w.V1, "matnr", "A-1").Error);   // derselbe Text in einem anderen eindeutigen Attribut: kein Konflikt
        // ean ohne Merkmal: doppelt erlaubt
        Assert.Null(w.Set(w.V1, "ean", "4006381333931").Error);
        Assert.Null(w.Set(w.V2, "ean", "4006381333931").Error);
        // Merkmal einschalten mit Doppelten: der Wächter zählt sie
        var before = w.C.With((m, _, _) => m.Attributes["ean"]);
        var clash = w.C.With((m, _, _) => ModelApi.Clash(w.C, m, before, before with { Unique = true }));
        Assert.NotNull(clash); Assert.Equal(1, clash!.Value.Count); Assert.Contains("4006381333931", clash.Value.Examples[0]);
        // bereinigt und eingeschaltet: ab jetzt eindeutig; derselbe Wert am selben Knoten bleibt erlaubt
        Assert.Null(w.Set(w.V2, "ean", "").Error);
        w.C.With((_, _, write) => write("t", Model.AttributeStream + "ean", Types.AttributeDefined, before with { Unique = true }, null));
        Assert.NotNull(w.Set(w.V2, "ean", "4006381333931").Error);
        Assert.Null(w.Set(w.V1, "ean", "4006381333931").Error);
    }

    [Fact]
    public void Schluessel_in_der_Zeile_Name_ohne_Stern_und_Kopie_ohne_Schluessel()
    {
        var w = new World();
        Assert.Null(w.Set(w.V1, "matnr", "100").Error); Assert.Null(w.Set(w.V1, "sku", "S-1").Error); Assert.Null(w.Set(w.V1, "ean", "4006").Error);
        var row = w.C.With((m, t, _) => NodeRow.Of(t, m, t.Nodes[w.V1]));
        Assert.Equal(new Dictionary<string, string> { ["matnr"] = "100", ["sku"] = "S-1" }, row.Keys);   // ean ist nicht eindeutig: kein Schlüssel
        Assert.Equal("100", row.Label);   // ohne ★: der erste Schlüssel (matnr vor sku)
        Assert.Null(w.C.With((m, t, _) => NodeRow.Of(t, m, t.Nodes[w.V2])).Keys);
        // Kopie: Schlüssel bleiben beim Original, gewöhnliche Werte kommen mit
        string? copyId = null; w.C.With((model, tree, write) => { copyId = Commands.Duplicate(w.Ctx(model, tree, write), w.V1, false).Id; return 0; });
        Assert.NotNull(copyId);
        Assert.Null(w.C.With((_, t, _) => t.Nodes[copyId!].Own("matnr", null, null)));
        Assert.Null(w.C.With((_, t, _) => t.Nodes[copyId!].Own("sku", null, null)));
        Assert.Equal("4006", w.C.With((_, t, _) => t.Nodes[copyId!].Own("ean", null, null)));
    }

    [Fact]
    public void Eindeutige_Achse_SKU_als_Achse_auch_beim_Anlegen_der_Variante()
    {
        var w = new World();
        // matnr als Achse eines zweiten Produkts: der Achsenwert darf es nirgends geben — auch nicht als eigener Wert an V1
        Assert.Null(w.Set(w.V1, "matnr", "100").Error);
        string p2 = ""; w.C.With((_, _, write) => { p2 = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(w.Group), null).Stream; return 0; });
        var axes = w.Run(c => Commands.SetAxes(c, p2, ["matnr"])); Assert.True(axes.Error is null, axes.Error);
        var taken = w.Run(c => Commands.CreateVariant(c, p2, new() { ["matnr"] = "100" }));
        Assert.NotNull(taken.Error); Assert.Contains("gibt es schon", taken.Error);
        var ok = w.Run(c => Commands.CreateVariant(c, p2, new() { ["matnr"] = "200" }));
        Assert.True(ok.Error is null, ok.Error);
        // und umgekehrt: der Achsenwert 200 sperrt den eigenen Wert an V2
        Assert.NotNull(w.Set(w.V2, "matnr", "200").Error);
        // der Achsenwert ist ein Schlüssel der Variante
        var v3 = ok.Entry!.Stream;
        Assert.Equal("200", w.C.With((m, t, _) => NodeRow.Of(t, m, t.Nodes[v3])).Keys!["matnr"]);
    }
}
