using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using static Journali.Server.ClassificationApi;

namespace Journali.Tests;

/// <summary>
/// Klassifikation im Server (30.09.2026): eine Klasse, eine Attributgruppe. Die Plugins der Systeme schicken eine neutrale Beschreibung —
/// der Server legt die Gruppe der Klasse an (sie heisst wie die Klasse), die Attribute dazu (oder ordnet vorhandene nur der Gruppe zu), hängt
/// die Gruppe an den Knoten und sagt, ob die Klasse danach pflegbar ist. Er kennt kein System.
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
    private static readonly ClassSpec K1 = new("K1", N("Lampe", "Lamp"), "Licht"), K2 = new("K2", N("Kabel", "Cable"), "Leitung");
    private static readonly ClassSpec[] Klassen = [K1, K2];

    private static Ensured Sicher(Catalog c, FeatureSpec[] f, params ClassSpec[] gruppen) =>
        (Ensured)Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, f, ClassGroups: gruppen), true)).Ok!;

    [Fact]
    public void Ensure_legt_Gruppe_und_Klassenattribut_an_und_ohne_Klassen_keine_Merkmale()
    {
        var c = Welt();
        var a = Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K1")), true));
        Assert.Null(a.Error);
        var r = Assert.IsType<Ensured>(a.Ok);
        Assert.Equal(("klass", "klass_class", 0), (r.Group, r.ClassAttr, r.Attributes));
        c.ReadModel(m =>
        {
            Assert.True(m.Groups.ContainsKey("klass"));
            var cl = m.Attributes["klass_class"];
            Assert.Equal((AttributeTypes.Enum, "klass_class", "klass", true), (cl.Type, cl.List, cl.Group, cl.Inheritable));
            Assert.True(m.Lists["klass_class"].Closed);
            Assert.Equal(["K1", "K2"], m.Lists["klass_class"].Values.Keys.Order());
            Assert.Equal("Licht", m.Lists["klass_class"].Values["K1"].Extra!["group"]);
            Assert.False(m.Attributes.ContainsKey("kf1"), "Merkmale entstehen erst mit einer Klasse");
            return 0;
        });
    }

    [Fact]
    public void Die_Klasse_bekommt_eine_Gruppe_die_so_heisst_wie_sie_und_ihre_Attribute_ohne_Bedingung()
    {
        var c = Welt();
        var r = Sicher(c, Merkmale("K1"), K1);
        Assert.Equal(4, r.Attributes);
        c.ReadModel(m =>
        {
            Assert.Equal("K1 Lampe", m.Groups["klass_k1"].Label["de"]);
            Assert.Equal("K1 Lamp", m.Groups["klass_k1"].Label["en"]);
            var breite = m.Attributes["kf1"];
            Assert.Equal((AttributeTypes.Decimal, "u_xq", "klass_k1", true), (breite.Type, breite.Unit, breite.Group, breite.Inheritable));
            Assert.Null(breite.When);
            Assert.Equal(["group", "product", "variant"], breite.Levels);
            Assert.True(m.Units.ContainsKey("u_xq"));
            Assert.Equal(AttributeTypes.Boolean, m.Attributes["kf2"].Type);
            var farbe = m.Attributes["kf3"];
            Assert.Equal(("kf3", true), (farbe.List, m.Lists["kf3"].Closed));
            Assert.Equal(["V1", "V2"], m.Lists["kf3"].Ordered.Select(v => v.Value));
            Assert.Equal(@"^\d+(-\d+)?$", m.Attributes["kf4"].Pattern);
            Assert.Equal("von - bis", m.Attributes["kf4"].PatternHint);
            Assert.Equal(["kf1", "kf2", "kf3", "kf4"], m.AttributesOf("klass_k1").Select(a => a.Key));
            Assert.Equal(["klass_class"], m.AttributesOf("klass").Select(a => a.Key));
            return 0;
        });
    }

    [Fact]
    public void Ein_Attribut_zweier_Klassen_gibt_es_einmal_und_gilt_in_beiden_Gruppen()
    {
        var c = Welt();
        Sicher(c, Merkmale("K1", "K2"), K1);
        var n = 0;
        var r = (Ensured)Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K1", "K2"), ClassGroups: [K2]), true), () => n++).Ok!;
        Assert.Equal(0, r.Attributes);
        c.ReadModel(m =>
        {
            Assert.Equal(["klass_k1", "klass_k2"], m.GroupsOf("kf1"));
            Assert.Equal("klass_k1", m.Attributes["kf1"].Group);   // die Heimat bleibt
            Assert.Equal(["kf1", "kf2", "kf3", "kf4"], m.AttributesOf("klass_k2").Select(a => a.Key));
            Assert.Equal(4, m.Attributes.Keys.Count(k => k.StartsWith("kf")));
            return 0;
        });
        Assert.True(n > 0);
    }

    [Fact]
    public void Ein_zweiter_Durchlauf_schreibt_nichts()
    {
        var c = Welt();
        Sicher(c, Merkmale("K1", "K2"), K1, K2);
        var n = 0;
        var a = Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K1", "K2"), ClassGroups: [K1, K2]), false), () => n++);   // ohne Modell-Recht: es ist auch nichts zu ändern
        Assert.Null(a.Error);
        Assert.Equal(0, n);
        Assert.Equal(0, ((Ensured)a.Ok!).Attributes);
    }

    [Fact]
    public void Ohne_Modell_Recht_wird_nichts_geschrieben_wenn_das_Modell_sich_ändern_müsste()
    {
        var c = Welt();
        var n = 0;
        var a = Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K1"), ClassGroups: [K1]), false), () => n++);
        Assert.NotNull(a.Error);
        Assert.Equal(0, n);
        Assert.False(c.ReadModel(m => m.Groups.ContainsKey("klass")));
    }

    [Fact]
    public void Nur_die_Gruppe_legt_weder_Klassenattribut_noch_Merkmale_an()
    {
        var c = Welt();
        var r = (Ensured)Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, Merkmale("K1"), GroupOnly: true, ClassGroups: [K1]), true)).Ok!;
        Assert.Equal(("klass", "klass_class", 0), (r.Group, r.ClassAttr, r.Attributes));
        c.ReadModel(m => { Assert.True(m.Groups.ContainsKey("klass")); Assert.False(m.Attributes.ContainsKey("klass_class")); Assert.False(m.Groups.ContainsKey("klass_k1")); return 0; });
    }

    [Fact]
    public void Eine_weitere_Klasse_ergänzt_die_Werte_einer_vorhandenen_Liste()
    {
        var c = Welt();
        FeatureSpec Farbe(string klasse, params string[] codes) => new("kf3", N("Farbe", "Colour"), "enum", null, null, null, [.. codes.Select(v => new ValueSpec(v, N(v, v)))], [klasse]);
        Sicher(c, [Farbe("K1", "V1", "V2")], K1);
        Sicher(c, [Farbe("K2", "V2", "V3")], K2);
        c.ReadModel(m => { Assert.Equal(["V1", "V2", "V3"], m.Lists["kf3"].Ordered.Select(v => v.Value)); Assert.Equal(["klass_k1", "klass_k2"], m.GroupsOf("kf3")); return 0; });
        var n = 0;
        Mit(c, x => Ensure(x, new EnsureBody(Sys, Klassen, [Farbe("K2", "V2", "V3")], ClassGroups: [K2]), true), () => n++);
        Assert.Equal(0, n);
    }

    [Fact]
    public void Ein_zugeordnetes_Merkmal_kommt_als_vorhandenes_Attribut_in_die_Gruppe_ohne_ein_eigenes_anzulegen()
    {
        var c = Welt();
        Mit(c, x => { x.Write(Model.AttributeStream + "breite", Types.AttributeDefined, new AttributeDefinition("breite", N("Breite", "Width").ToLabels(), AttributeTypes.Decimal, Group: "master")); return 0; });
        var f = Merkmale("K1").Select(m => m.Key == "kf1" ? m with { Target = "breite" } : m).ToArray();
        var r = Sicher(c, f, K1);
        Assert.Equal(3, r.Attributes);
        c.ReadModel(m =>
        {
            Assert.False(m.Attributes.ContainsKey("kf1"), "das eigene Attribut entsteht nicht");
            Assert.Equal("master", m.Attributes["breite"].Group);
            Assert.Equal(["klass_k1", "master"], m.GroupsOf("breite"));
            return 0;
        });
    }

    [Fact]
    public void Eine_vorhandene_Einheit_wird_wiederverwendet()
    {
        var c = Welt();   // mm steht im Saatgut
        Sicher(c, MerkmaleMit("mm", "K1"), K1);
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
        var r = Sicher(c, Merkmale("K1"), K1);
        Assert.Equal("klass_std", r.Group);
        Assert.Equal(new Renamed("klass", "klass_std"), r.GroupRenamed);
        c.ReadModel(m => { Assert.True(m.Groups.ContainsKey("klass_std_k1")); Assert.Equal("klass", m.Attributes["fremd"].Group); return 0; });
    }

    [Fact]
    public void Gehört_das_Klassenattribut_einem_anderen_weicht_es_auf_die_Alternative_aus()
    {
        var c = Welt();
        Mit(c, x => { x.Write(Model.AttributeStream + "klass_class", Types.AttributeDefined, new AttributeDefinition("klass_class", N("Fremd", "Foreign").ToLabels(), AttributeTypes.Text, Group: "master")); return 0; });
        var r = Sicher(c, Merkmale("K1"), K1);
        Assert.Equal("klass_klasse", r.ClassAttr);
        Assert.Equal(new Renamed("klass_class", "klass_klasse"), r.ClassAttrRenamed);
    }

    private static (Catalog c, string gruppe, string produkt, string zweites) Baum()
    {
        var c = Welt();
        var ids = Mit(c, x =>
        {
            var g = Commands.CreateGroup(x, null, Labels.Of("Leuchten", "Lights")).Entry!.Stream;
            var p = Commands.CreateProduct(x, g, null).Entry!.Stream;
            var q = Commands.CreateProduct(x, g, null).Entry!.Stream;
            return (g, p, q);
        });
        return (c, ids.g, ids.p, ids.q);
    }

    [Fact]
    public void Assign_legt_die_Klassengruppe_an_hängt_sie_an_den_Knoten_und_setzt_die_Klasse()
    {
        var (c, g, p, _) = Baum();
        var a = Mit(c, x => ClassificationApi.Assign(x, new AssignBody(g, "K1", Sys, Klassen, Merkmale("K1")), true));
        Assert.Null(a.Error);
        var r = Assert.IsType<Assigned>(a.Ok);
        Assert.True(r.GroupAttached);
        Assert.True(r.Readiness.Ready);
        Assert.Equal(("klass", "klass_class", "klass_k1", 4), (r.Group, r.ClassAttr, r.ClassGroup, r.Attributes));
        c.Read(t => { Assert.Equal(["klass", "klass_k1"], t.Nodes[g].Groups.Order()); return 0; });
        Assert.Equal("K1", c.Read(t => t.Nodes[g].Values.Single(v => v.Key.Attribute == "klass_class").Value));
        // das Produkt darunter erbt die Gruppe: nichts wird noch einmal angehängt
        c.Read(t => { Assert.Contains(t.EffectiveGroups(t.Nodes[p]), x => x.Group == "klass_k1"); return 0; });
        var b = (Assigned)Mit(c, x => ClassificationApi.Assign(x, new AssignBody(p, "K1", Sys, null, Merkmale("K1")), true)).Ok!;
        Assert.False(b.GroupAttached);
        Assert.True(b.Readiness.Ready);
    }

    [Fact]
    public void Eine_andere_Klasse_am_selben_Knoten_tauscht_die_Gruppe()
    {
        var (c, g, _, _) = Baum();
        Mit(c, x => ClassificationApi.Assign(x, new AssignBody(g, "K1", Sys, Klassen, Merkmale("K1")), true));
        var r = (Assigned)Mit(c, x => ClassificationApi.Assign(x, new AssignBody(g, "K2", Sys, Klassen, Merkmale("K2")), true)).Ok!;
        Assert.Equal("klass_k2", r.ClassGroup);
        c.Read(t => { Assert.Equal(["klass", "klass_k2"], t.Nodes[g].Groups.Order()); return 0; });
        // die Gruppe der ersten Klasse bleibt im Modell — andere Knoten können sie tragen
        Assert.True(c.ReadModel(m => m.Groups.ContainsKey("klass_k1")));
    }

    [Fact]
    public void Eine_eigene_Klasse_unter_einer_geerbten_ergibt_beide_Gruppen_an_ihrem_Knoten()
    {
        var (c, g, p, _) = Baum();
        Mit(c, x => ClassificationApi.Assign(x, new AssignBody(g, "K1", Sys, Klassen, Merkmale("K1")), true));
        Mit(c, x => ClassificationApi.Assign(x, new AssignBody(p, "K2", Sys, Klassen, Merkmale("K2")), true));
        c.Read(t => { Assert.Equal(["klass_k2"], t.Nodes[p].Groups); Assert.Equal(["klass", "klass_k1", "klass_k2"], t.EffectiveGroups(t.Nodes[p]).Select(x => x.Group).Order()); return 0; });
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
    public void Clear_nimmt_die_eigene_Klasse_und_ihre_Gruppe_vom_Knoten()
    {
        var (c, g, _, _) = Baum();
        Mit(c, x => ClassificationApi.Assign(x, new AssignBody(g, "K1", Sys, Klassen, Merkmale("K1")), true));
        var r = (Cleared)Mit(c, x => ClassificationApi.Clear(x, new ClearBody(g, Sys), true)).Ok!;
        Assert.Equal(("K1", "klass_k1"), (r.Class, r.ClassGroup));
        c.Read(t => { Assert.Equal(["klass"], t.Nodes[g].Groups); Assert.DoesNotContain(t.Nodes[g].Values.Keys, k => k.Attribute == "klass_class"); return 0; });
        var n = 0;
        var nochmal = (Cleared)Mit(c, x => ClassificationApi.Clear(x, new ClearBody(g, Sys), true), () => n++).Ok!;
        Assert.Null(nochmal.Class); Assert.Equal(0, n);
    }

    [Fact]
    public void Die_Bereitschaft_nennt_was_fehlt()
    {
        var (c, g, _, _) = Baum();
        Sicher(c, Merkmale("K1"), K1);
        // die Gruppe der Klasse gilt hier noch nicht
        var r = Mit(c, x => ReadinessOf(x.Model, x.Tree, x.Tree.Nodes[g], "klass_k1", ["kf1", "kf2", "gibtsnicht"]));
        Assert.False(r.Ready); Assert.True(r.GroupExists); Assert.False(r.GroupOn);
        Assert.Equal(["gibtsnicht"], r.Missing);
        var bereit = Mit(c, x => { Commands.AttachGroups(x, g, ["klass_k1"]); return ReadinessOf(x.Model, x.Tree, x.Tree.Nodes[g], "klass_k1", ["kf1"]); });
        Assert.True(bereit.Ready);
        // ein Attribut, das es gibt, aber nicht in dieser Gruppe, zählt als fehlend
        Assert.Equal(["klass_class"], Mit(c, x => ReadinessOf(x.Model, x.Tree, x.Tree.Nodes[g], "klass_k1", ["kf1", "klass_class"])).Missing);
    }

    // ---- Bestand der früheren Bauart: eine Sammelgruppe, Attribute mit Bedingung
    private static (Catalog c, string g, string p) Alt()
    {
        var (c, g, p, _) = Baum();
        Mit(c, x =>
        {
            Ensure(x, new EnsureBody(Sys, Klassen), true);
            x.Write(Model.AttributeStream + "kf1", Types.AttributeDefined, new AttributeDefinition("kf1", N("Breite", "Width").ToLabels(), AttributeTypes.Decimal, Group: "klass", Inheritable: true, Levels: ["group", "product", "variant"], When: new AttributeCondition("klass_class", ["K1", "K2"])));
            x.Write(Model.AttributeStream + "kf2", Types.AttributeDefined, new AttributeDefinition("kf2", N("Dicht", "Tight").ToLabels(), AttributeTypes.Boolean, Group: "klass", Inheritable: true, Levels: ["group", "product", "variant"], When: new AttributeCondition("klass_class", ["K1"])));
            Commands.AttachGroups(x, g, ["klass"]);
            Commands.SetAttribute(x, g, "klass_class", null, null, "K1", null);
            Commands.SetAttribute(x, p, "klass_class", null, null, "K2", null);
            return 0;
        });
        return (c, g, p);
    }

    [Fact]
    public void Migrate_stellt_den_Bestand_auf_Klassengruppen_um()
    {
        var (c, g, p) = Alt();
        var zaehlt = (Migrated)Mit(c, x => Migrate(x, new MigrateBody(Sys, DryRun: true), true)).Ok!;
        Assert.Equal((2, 2, 2), (zaehlt.Groups, zaehlt.Attributes, zaehlt.Nodes));
        Assert.False(c.ReadModel(m => m.Groups.ContainsKey("klass_k1")), "Zählen schreibt nichts");

        var r = (Migrated)Mit(c, x => Migrate(x, new MigrateBody(Sys), true)).Ok!;
        Assert.Equal((2, 2, 2), (r.Groups, r.Attributes, r.Nodes));
        c.ReadModel(m =>
        {
            Assert.Null(m.Attributes["kf1"].When); Assert.Null(m.Attributes["kf2"].When);
            Assert.Equal("klass_k1", m.Attributes["kf1"].Group);
            Assert.Equal(["klass_k2"], m.AttributeGroups["kf1"].Order());
            Assert.Equal(["klass_k1"], m.GroupsOf("kf2"));
            Assert.Equal(["klass_class"], m.AttributesOf("klass").Select(a => a.Key));
            return 0;
        });
        c.Read(t => { Assert.Contains("klass_k1", t.Nodes[g].Groups); Assert.Contains("klass_k2", t.Nodes[p].Groups); return 0; });
        // ein zweites Mal ist nichts mehr zu tun
        var n = 0;
        var again = (Migrated)Mit(c, x => Migrate(x, new MigrateBody(Sys), true), () => n++).Ok!;
        Assert.Equal((0, 0, 0), (again.Groups, again.Attributes, again.Nodes)); Assert.Equal(0, n);
    }
}

internal static class ClassificationTestExt
{
    public static Labels ToLabels(this Dictionary<string, string> d) => new(d);
}
