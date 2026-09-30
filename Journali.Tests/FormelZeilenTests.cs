using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Berechnete Spalten in einem vermehrbaren Attribut (30.09.2026): das Skript steht als Wert der Spalte am Knoten und rechnet
/// für jede Zeile mit deren Werten; jedes andere <c>$schlüssel</c> meint den Wert am Knoten.
/// </summary>
public class FormelZeilenTests
{
    private sealed class World
    {
        public MemoryJournal J = new(); public ModelCatalog Cat = new(); public Tree Tree = new(); public Relations Rel = new(); public Media Media = new();
        public World() { foreach (var s in Model.Seeds()) J.Append("system", s.Stream, s.Type, s.Payload); Catch(); }
        public void Catch() => Projector.CatchUpAll(J, Cat, Tree, Rel, Media);
        public Ctx Ctx => new() { Model = Cat, Tree = Tree, Relations = Rel, Media = Media, Write = (stream, type, payload) => { var e = J.Append("t", stream, type, Types.Serialize(payload)); Catch(); return e; } };
        public void Attribut(AttributeDefinition d) { J.Append("t", Model.AttributeStream + d.Key, Types.AttributeDefined, Types.Serialize(d)); Catch(); }
    }

    /// <summary>Ein Produkt mit der Tabelle "kennlinie": Spalten u_ein (Zahl) und u_aus (Formel); am Knoten der Teiler "teiler".</summary>
    private static (World w, string produkt, string zeile1, string zeile2) Aufbau(string? skript)
    {
        var w = new World();
        w.Attribut(new("teiler", Labels.Of("Teiler", "Divider"), AttributeTypes.Decimal, Group: "technik"));
        w.Attribut(new("u_ein", Labels.Of("Eingangsspannung", "Input"), AttributeTypes.Decimal));
        w.Attribut(new("u_aus", Labels.Of("Ausgangsspannung", "Output"), AttributeTypes.Formula));
        w.Attribut(new("kennlinie", Labels.Of("Kennlinie", "Curve"), AttributeTypes.Rows, Group: "technik", Columns: ["u_ein", "u_aus"]));
        var g = Commands.CreateGroup(w.Ctx, null, Labels.Of("Netzteile", "PSU")); Assert.Null(g.Error);
        var p = Commands.CreateProduct(w.Ctx, g.Entry!.Stream, null); Assert.Null(p.Error);
        var produkt = p.Entry!.Stream;
        Assert.Null(Commands.AttachGroups(w.Ctx, produkt, ["technik"]).Error);
        Assert.Null(Commands.SetAttribute(w.Ctx, produkt, "teiler", null, null, "2", null, null).Error);
        var r1 = Commands.AddRow(w.Ctx, produkt, "kennlinie"); Assert.Null(r1.Error);
        var r2 = Commands.AddRow(w.Ctx, produkt, "kennlinie"); Assert.Null(r2.Error);
        var z1 = w.Tree.Nodes[produkt].Rows["kennlinie"][0]; var z2 = w.Tree.Nodes[produkt].Rows["kennlinie"][1];
        Assert.Null(Commands.SetAttribute(w.Ctx, produkt, "u_ein", null, null, "12", null, z1).Error);
        Assert.Null(Commands.SetAttribute(w.Ctx, produkt, "u_ein", null, null, "24", null, z2).Error);
        if (skript is not null) Assert.Null(Commands.SetAttribute(w.Ctx, produkt, "u_aus", null, null, skript, null, null).Error);
        return (w, produkt, z1, z2);
    }

    private static string? Ergebnis(World w, string produkt, string zeile) =>
        w.Tree.ComputeRows(w.Cat, w.Tree.Nodes[produkt], w.Cat.Locales.Keys).Single(r => r.Column == "u_aus" && r.Row == zeile).Value;

    [Fact]
    public void Die_Formel_rechnet_je_Zeile_mit_deren_Wert_und_dem_Wert_am_Knoten()
    {
        var (w, p, z1, z2) = Aufbau("return $u_ein / $teiler");
        Assert.Equal("6", Ergebnis(w, p, z1));      // 12 / 2
        Assert.Equal("12", Ergebnis(w, p, z2));     // 24 / 2
    }

    [Fact]
    public void Ohne_Skript_ist_das_Ergebnis_leer()
    {
        var (w, p, z1, _) = Aufbau(null);
        Assert.Null(Ergebnis(w, p, z1));
    }

    [Fact]
    public void Eine_Zeile_ohne_Eingabe_gibt_kein_Ergebnis_statt_eines_falschen()
    {
        var (w, p, _, _) = Aufbau("return $u_ein / $teiler");
        Assert.Null(Commands.AddRow(w.Ctx, p, "kennlinie").Error);
        var neu = w.Tree.Nodes[p].Rows["kennlinie"][2];
        Assert.Null(Ergebnis(w, p, neu));           // null rechnet sich durch
    }

    [Fact]
    public void Das_Skript_einer_Spalte_ist_am_Knoten_setzbar_ohne_dass_die_Spalte_in_einer_Gruppe_steht()
    {
        var (w, p, _, _) = Aufbau(null);
        Assert.Null(Commands.SetAttribute(w.Ctx, p, "u_aus", null, null, "return 1", null, null).Error);
    }

    [Fact]
    public void Eine_gewoehnliche_Spalte_bleibt_am_Knoten_ohne_Gruppe_nicht_setzbar()
    {
        var (w, p, _, _) = Aufbau(null);
        Assert.NotNull(Commands.SetAttribute(w.Ctx, p, "u_ein", null, null, "5", null, null).Error);
    }

    [Fact]
    public void Eine_berechnete_Spalte_darf_eine_andere_der_Zeile_lesen()
    {
        var (w, p, z1, _) = Aufbau("return $u_ein / $teiler");
        w.Attribut(new("u_dreifach", Labels.Of("Dreifach", "Triple"), AttributeTypes.Formula));
        w.Attribut(new("kennlinie", Labels.Of("Kennlinie", "Curve"), AttributeTypes.Rows, Group: "technik", Columns: ["u_ein", "u_aus", "u_dreifach"]));
        Assert.Null(Commands.SetAttribute(w.Ctx, p, "u_dreifach", null, null, "return $u_aus * 3", null, null).Error);
        var r = w.Tree.ComputeRows(w.Cat, w.Tree.Nodes[p], w.Cat.Locales.Keys).Single(x => x.Column == "u_dreifach" && x.Row == z1);
        Assert.Equal("18", r.Value);
    }
}
