using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Eindeutig als Merkmal und das Kennungsattribut im Journal (Taloan, 21.09.2026: „SKU ist ein Attribut wie jedes andere — bei anderen
// heisst es MATNR“): die Kennung ist immer eindeutig, jedes andere Attribut nach Merkmal; einschalten mit Doppelten wird verweigert.
public class UniqueTests
{
    private sealed class World
    {
        public MemoryJournal J = new(); public Catalog C; public string Product, V1, V2;
        public World()
        {
            C = new Catalog(J); C.Rebuild(); C.SeedMissing();
            string g = "", p = "", v1 = "", v2 = "";
            C.With((_, _, write) =>
            {
                write("t", Model.AttributeStream + "ean", Types.AttributeDefined, new AttributeDefinition("ean", Labels.Of("EAN", "EAN"), AttributeTypes.Text, Group: "logistics"), null);
                write("t", Model.AttributeStream + "matnr", Types.AttributeDefined, new AttributeDefinition("matnr", Labels.Of("MATNR", "MATNR"), AttributeTypes.Text, Group: "logistics"), null);
                g = write("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("G", "G")), null).Stream;
                p = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(g), null).Stream;
                v1 = write("t", Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(p, new()), null).Stream;
                v2 = write("t", Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(p, new()), null).Stream;
                return 0;
            });
            Product = p; V1 = v1; V2 = v2;
            var att = Run(c => Commands.AttachGroups(c, g, ["logistics"])); if (att.Error is not null) throw new Exception(att.Error);   // sku, ean, matnr gelten ab der Gruppe
        }
        public Outcome Run(Func<Ctx, Outcome> cmd) => C.With((model, tree, write) => cmd(new Ctx { Model = model, Tree = tree, Relations = C.Relations, Media = C.Media, Workflows = C.Workflows, Write = (s, t, p) => write("t", s, t, p, null) }));
        public Outcome Set(string node, string attr, string value) => Run(c => Commands.SetAttribute(c, node, attr, null, null, value, null, null));
    }

    [Fact]
    public void Kennung_ist_immer_eindeutig_andere_Attribute_nach_Merkmal()
    {
        var w = new World();
        Assert.Equal("sku", w.C.With((m, _, _) => m.SkuAttribute));   // Saatgut
        var first = w.Set(w.V1, "sku", "A-1"); Assert.True(first.Error is null, first.Error);
        var dup = w.Set(w.V2, "sku", "A-1");
        Assert.NotNull(dup.Error); Assert.Contains("gibt es schon", dup.Error);
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
    public void Kennungsattribut_wechselt_im_Journal_und_ist_dann_eindeutig()
    {
        var w = new World();
        Assert.Null(w.Set(w.V1, "matnr", "100").Error); Assert.Null(w.Set(w.V2, "matnr", "100").Error);   // noch nichts Besonderes
        w.C.With((_, _, write) => write("t", Model.SkuAttributeStream, Types.SkuAttributeDefined, new SkuAttributeDefined("matnr"), null));
        Assert.Equal("matnr", w.C.With((m, _, _) => m.SkuAttribute));
        // die Kennung steht in der Zeile (sku) und ist der Name der Variante ohne ★
        var row = w.C.With((m, t, _) => NodeRow.Of(t, m, t.Nodes[w.V1]));
        Assert.Equal("100", row.Sku); Assert.Equal("100", row.Label);
        Assert.Null(w.Set(w.V2, "matnr", "200").Error);        // 200 frei: geht
        Assert.NotNull(w.Set(w.V2, "matnr", "100").Error);   // 100 hat V1
        Assert.Null(w.Set(w.V1, "sku", "100").Error);          // sku ist nur noch ein Attribut — eindeutig bleibt es durch sein Merkmal (Saatgut)
        Assert.NotNull(w.Set(w.V2, "sku", "100").Error);
        Assert.Null(w.Set(w.V1, "ean", "100").Error);          // ean: kein Merkmal
        // eindeutige Werte (Kennung, sku) kommen beim Kopieren nicht mit, gewöhnliche (ean) schon
        string? copyId = null; w.C.With((model, tree, write) => { var r = Commands.Duplicate(new Ctx { Model = model, Tree = tree, Relations = w.C.Relations, Media = w.C.Media, Workflows = w.C.Workflows, Write = (s, t, p) => write("t", s, t, p, null) }, w.V1, false); copyId = r.Id; return 0; });
        Assert.NotNull(copyId);
        Assert.Null(w.C.With((_, t, _) => t.Nodes[copyId!].Own("matnr", null, null)));
        Assert.Null(w.C.With((_, t, _) => t.Nodes[copyId!].Own("sku", null, null)));
        Assert.Equal("100", w.C.With((_, t, _) => t.Nodes[copyId!].Own("ean", null, null)));
    }
}
