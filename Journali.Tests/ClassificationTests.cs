using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using static Journali.Server.ClassificationApi;

namespace Journali.Tests;

/// <summary>
/// Klassifikation im Server (30.09.2026): die Plugins der Systeme schicken eine neutrale Beschreibung — der Server legt Gruppe,
/// Klassenattribut und Merkmale an, weist eine Klasse zu und sagt, ob sie danach pflegbar ist. Er kennt kein System.
/// </summary>
public class ClassificationTests
{
    private static Catalog Welt() { var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing(); return c; }

    private static T Mit<T>(Catalog c, Func<Ctx, T> f, Action? eintrag = null) =>
        c.With((model, tree, write) => f(new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Write = (stream, type, payload) => { eintrag?.Invoke(); return write("t", stream, type, payload, null); } }));

    private static Dictionary<string, string> N(string de, string en) => new() { ["de"] = de, ["en"] = en };

    private static readonly SystemSpec Sys = new("klass", N("Klass", "Klass"), "klass_class", N("Klasse", "Class"), ["klass_klasse"], @"^kf\d+$");

    private static FeatureSpec[] Merkmale(params string[] klassen) => MerkmaleMit("xq", klassen);
    private static FeatureSpec[] MerkmaleMit(string einheit, params string[] klassen) =>
    [
        new("kf1", N("Breite", "Width"), "decimal", new UnitSpec("U1", N(einheit, einheit), N("Länge", "Length")), null, null, null, klassen),
        new("kf2", N("Wasserdicht", "Waterproof"), "boolean", null, null, null, null, klassen),
        new("kf3", N("Farbe", "Colour"), "enum", null, null, null, [new("V1", N("Rot", "Red")), new("V2", N("Blau", "Blue"))], klassen),
        new("kf4", N("Spanne", "Range"), "text", null, @"^\d+(-\d+)?$", "von - bis", null, klassen),
    ];
    private static readonly ClassSpec[] Klassen = [new("K1", N("Lampe", "Lamp"), "Licht"), new("K2", N("Kabel", "Cable"), "Leitung")];

    [Fact]
    public void Ensure_legt_Gruppe_Klassenattribut_und_Merkmale_an()
    {
        var c = Welt();
        var a = Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K1")), true));
        Assert.Null(a.Error);
        var r = Assert.IsType<Ensured>(a.Ok);
        Assert.Equal(("klass", "klass_class", 4), (r.Group, r.ClassAttr, r.Attributes));
        c.ReadModel(m =>
        {
            Assert.True(m.Groups.ContainsKey("klass"));
            var cl = m.Attributes["klass_class"];
            Assert.Equal((AttributeTypes.Enum, "klass_class", "klass", true), (cl.Type, cl.List, cl.Group, cl.Inheritable));
            Assert.True(m.Lists["klass_class"].Closed);
            Assert.Equal(["K1", "K2"], m.Lists["klass_class"].Values.Keys.Order());
            Assert.Equal("Licht", m.Lists["klass_class"].Values["K1"].Extra!["group"]);
            var breite = m.Attributes["kf1"];
            Assert.Equal((AttributeTypes.Decimal, "u_xq", "klass", true), (breite.Type, breite.Unit, breite.Group, breite.Inheritable));
            Assert.Equal(["group", "product", "variant"], breite.Levels);
            Assert.Equal("klass_class", breite.When!.Attribute);
            Assert.Equal(["K1"], breite.When.Values);
            Assert.True(m.Units.ContainsKey("u_xq"));
            Assert.Equal(AttributeTypes.Boolean, m.Attributes["kf2"].Type);
            var farbe = m.Attributes["kf3"];
            Assert.Equal(("kf3", true), (farbe.List, m.Lists["kf3"].Closed));
            Assert.Equal(["V1", "V2"], m.Lists["kf3"].Ordered.Select(v => v.Value));
            Assert.Equal(@"^\d+(-\d+)?$", m.Attributes["kf4"].Pattern);
            Assert.Equal("von - bis", m.Attributes["kf4"].PatternHint);
            return 0;
        });
    }

    [Fact]
    public void Nur_die_Gruppe_legt_weder_Klassenattribut_noch_Merkmale_an()
    {
        var c = Welt();
        var r = (Ensured)Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K1"), GroupOnly: true), true)).Ok!;
        Assert.Equal(("klass", "klass_class", 0), (r.Group, r.ClassAttr, r.Attributes));
        c.ReadModel(m => { Assert.True(m.Groups.ContainsKey("klass")); Assert.False(m.Attributes.ContainsKey("klass_class")); Assert.False(m.Attributes.ContainsKey("kf1")); return 0; });
    }

    [Fact]
    public void Ein_zweiter_Durchlauf_schreibt_nichts()
    {
        var c = Welt();
        Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K1")), true));
        var n = 0;
        var a = Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K1")), false), () => n++);   // ohne Modell-Recht: es ist auch nichts zu ändern
        Assert.Null(a.Error);
        Assert.Equal(0, n);
        Assert.Equal(0, ((Ensured)a.Ok!).Attributes);
    }

    [Fact]
    public void Ohne_Modell_Recht_wird_nichts_geschrieben_wenn_das_Modell_sich_ändern_müsste()
    {
        var c = Welt();
        var n = 0;
        var a = Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K1")), false), () => n++);
        Assert.NotNull(a.Error);
        Assert.Equal(0, n);
        Assert.False(c.ReadModel(m => m.Groups.ContainsKey("klass")));
    }

    [Fact]
    public void Die_Bedingung_vereinigt_die_Klassen_über_Durchläufe()
    {
        var c = Welt();
        Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K1")), true));
        Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K2")), true));
        Assert.Equal(["K1", "K2"], c.ReadModel(m => m.Attributes["kf1"].When!.Values));
    }

    [Fact]
    public void Ein_Merkmal_von_früher_ohne_Ebene_Gruppe_wird_gehoben()
    {
        var c = Welt();
        Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K1")), true));
        Mit(c, x => { x.Write(Model.AttributeStream + "kf2", Types.AttributeDefined, x.Model.Attributes["kf2"] with { Levels = ["product", "variant"], Inheritable = false }); return 0; });
        Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K1")), true));
        c.ReadModel(m => { Assert.Equal(["group", "product", "variant"], m.Attributes["kf2"].Levels); Assert.True(m.Attributes["kf2"].Inheritable); return 0; });
    }

    [Fact]
    public void Eine_vorhandene_Einheit_wird_wiederverwendet()
    {
        var c = Welt();   // mm steht im Saatgut
        Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, MerkmaleMit("mm", "K1")), true));
        c.ReadModel(m => { Assert.Equal("mm", m.Attributes["kf1"].Unit); Assert.False(m.Units.ContainsKey("u_mm")); return 0; });
    }

    [Fact]
    public void Gehört_die_Gruppe_anderen_Attributen_weicht_das_System_aus_und_sagt_es()
    {
        var c = Welt();
        Mit(c, x =>
        {
            x.Write(Model.GroupStream + "klass", Types.AttributeGroupDefined, new AttributeGroupDefinition("klass", N("Fremd", "Foreign").ToLabels()));
            x.Write(Model.AttributeStream + "fremd", Types.AttributeDefined, new AttributeDefinition("fremd", N("Fremd", "Foreign").ToLabels(), AttributeTypes.Text, Group: "klass"));
            return 0;
        });
        var r = (Ensured)Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K1")), true)).Ok!;
        Assert.Equal("klass_std", r.Group);
        Assert.Equal(new Renamed("klass", "klass_std"), r.GroupRenamed);
        c.ReadModel(m => { Assert.Equal("klass_std", m.Attributes["kf1"].Group); Assert.Equal("klass", m.Attributes["fremd"].Group); return 0; });
    }

    [Fact]
    public void Gehört_das_Klassenattribut_einem_anderen_weicht_es_auf_die_Alternative_aus()
    {
        var c = Welt();
        Mit(c, x => { x.Write(Model.AttributeStream + "klass_class", Types.AttributeDefined, new AttributeDefinition("klass_class", N("Fremd", "Foreign").ToLabels(), AttributeTypes.Text, Group: "master")); return 0; });
        var r = (Ensured)Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K1")), true)).Ok!;
        Assert.Equal("klass_klasse", r.ClassAttr);
        Assert.Equal(new Renamed("klass_class", "klass_klasse"), r.ClassAttrRenamed);
        Assert.Equal("klass_klasse", c.ReadModel(m => m.Attributes["kf1"].When!.Attribute));
    }

    private static (Catalog c, string gruppe, string produkt) Baum()
    {
        var c = Welt();
        var ids = Mit(c, x =>
        {
            var g = Commands.CreateGroup(x, null, Labels.Of("Leuchten", "Lights")).Entry!.Stream;
            var p = Commands.CreateProduct(x, g, null).Entry!.Stream;
            return (g, p);
        });
        return (c, ids.g, ids.p);
    }

    [Fact]
    public void Assign_hängt_die_Gruppe_an_die_Wurzel_setzt_die_Klasse_und_meldet_bereit()
    {
        var (c, g, p) = Baum();
        var a = Mit(c, x => ClassificationApi.Assign(x, new AssignBody(g, "K1", Sys, Klassen, Merkmale("K1")), true));
        Assert.Null(a.Error);
        var r = Assert.IsType<Assigned>(a.Ok);
        Assert.True(r.GroupAttached);
        Assert.True(r.Readiness.Ready);
        Assert.Equal(("klass", "klass_class"), (r.Group, r.ClassAttr));
        c.Read(t => { Assert.Contains("klass", t.Nodes[g].Groups); return 0; });
        Assert.Equal("K1", c.Read(t => t.Nodes[g].Values.Single(v => v.Key.Attribute == "klass_class").Value));
        // ein Produkt darunter erbt die Gruppe; eine zweite Zuweisung dort hängt sie nicht noch einmal an
        var b = (Assigned)Mit(c, x => ClassificationApi.Assign(x, new AssignBody(p, "K2", Sys, null, Merkmale("K2")), true)).Ok!;
        Assert.False(b.GroupAttached);
        Assert.True(b.Readiness.Ready);
        Assert.Equal(["K1", "K2"], c.ReadModel(m => m.Attributes["kf2"].When!.Values));
    }

    [Fact]
    public void Assign_eines_unbekannten_Knotens_ist_ein_Fehler_und_schreibt_nichts()
    {
        var c = Welt(); var n = 0;
        var a = Mit(c, x => ClassificationApi.Assign(x, new AssignBody("gibtsnicht", "K1", Sys, Klassen, Merkmale("K1")), true), () => n++);
        Assert.NotNull(a.Error);
        Assert.Equal(0, n);
    }

    [Fact]
    public void Die_Bereitschaft_nennt_was_fehlt()
    {
        var (c, g, _) = Baum();
        Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K1")), true));
        // die Gruppe gilt hier noch nicht
        var r = Mit(c, x => ReadinessOf(x.Model, x.Tree, x.Tree.Nodes[g], "klass", ["kf1", "kf2", "gibtsnicht"]));
        Assert.False(r.Ready); Assert.True(r.GroupExists); Assert.False(r.GroupOn);
        Assert.Equal(["gibtsnicht"], r.Missing);
        var bereit = Mit(c, x => { Commands.AttachGroups(x, g, ["klass"]); return ReadinessOf(x.Model, x.Tree, x.Tree.Nodes[g], "klass", ["kf1"]); });
        Assert.True(bereit.Ready);
    }
}

internal static class ClassificationTestExt
{
    public static Labels ToLabels(this Dictionary<string, string> d) => new(d);
}
