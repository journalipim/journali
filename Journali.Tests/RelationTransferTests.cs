using System.Text.Json;
using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Journali.Tests;

/// <summary>
/// Relationen in den Rohdaten (30.09.2026): der Export nimmt die Relationen eines Teilbaums mit Werten, Einheit und den dazu nötigen
/// Modellteilen (Relationstyp, Attribute, Mitgliedschaften) mit; der Import legt sie nach den Knoten an und gleicht sie bei einem zweiten
/// Mal nur ab.
/// </summary>
public class RelationTransferTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private static Catalog Welt() { var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing(); return c; }

    private static T Mit<T>(Catalog c, Func<Ctx, T> f) =>
        c.With((model, tree, write) => f(new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Write = (stream, type, payload) => write("t", stream, type, payload, null) }));

    /// <summary>Gruppe mit zwei Produkten, Tablette → Vitamin C als Bestandteil mit 20 kg eingegebenen 20000 g; Attribut "gehalt" gehört
    /// der Herkunft nach zu "naehr" und ist nur Mitglied der Gruppe des Relationstyps.</summary>
    private static (Catalog c, string gruppe, string tablette, string vitamin) Quelle()
    {
        var c = Welt();
        var ids = Mit(c, x =>
        {
            x.Write(Model.AttributeStream + "gehalt", Types.AttributeDefined, new AttributeDefinition("gehalt", Labels.Of("Gehalt", "Content"), AttributeTypes.Decimal, Unit: "g", Group: "naehr"));
            x.Write(Model.AttributeStream + "gehalt", Types.AttributeGroupsSet, new AttributeGroupsSet("gehalt", ["naehr", "relation_component"]));
            var g = Commands.CreateGroup(x, null, Labels.Of("Mittel", "Agents")).Entry!.Stream;
            var t = Commands.CreateProduct(x, g, null).Entry!.Stream;
            var v = Commands.CreateProduct(x, g, null).Entry!.Stream;
            var r = Commands.CreateRelation(x, "component", t, v); Assert.Null(r.Error);
            Assert.Null(Commands.SetRelationAttribute(x, r.Entry!.Stream, "gehalt", null, null, "20000", null, "kg").Error);
            return (g, t, v);
        });
        return (c, ids.g, ids.t, ids.v);
    }

    private static string Datei(Catalog c, string id, bool deep = true) =>
        c.Lesen((model, tree) => JsonSerializer.Serialize(new TransferApi.RawExport(TransferApi.UsedModel(model, tree, tree.Nodes[id], deep, c.Relations), TransferApi.Raw(tree, tree.Nodes[id], deep, c.Relations)), Web));

    private static JsonElement Einspielen(Catalog c, string datei, string? parent = null)
    {
        var raw = JsonSerializer.Deserialize<TransferApi.RawExport>(datei, Web)!;
        var ergebnis = TransferApi.Einspielen(c, "t", new TransferApi.ImportBody(raw.Node, parent, raw.Model));
        var http = new DefaultHttpContext { RequestServices = new ServiceCollection().AddLogging().BuildServiceProvider() };
        http.Response.Body = new MemoryStream();
        ergebnis.ExecuteAsync(http).GetAwaiter().GetResult();
        http.Response.Body.Position = 0;
        return JsonDocument.Parse(http.Response.Body).RootElement.Clone();
    }

    [Fact]
    public void Der_Export_nimmt_die_Relation_mit_Wert_Einheit_und_Modellteil()
    {
        var (c, g, t, v) = Quelle();
        var doc = JsonDocument.Parse(Datei(c, g)).RootElement;
        var tablette = doc.GetProperty("node").GetProperty("children").EnumerateArray().Single(k => k.GetProperty("id").GetString() == t);
        var rel = tablette.GetProperty("relations").EnumerateArray().Single();
        Assert.Equal("component", rel.GetProperty("type").GetString());
        Assert.Equal(v, rel.GetProperty("to").GetString());
        var wert = rel.GetProperty("values").EnumerateArray().Single();
        Assert.Equal(("gehalt", "20000", "kg"), (wert.GetProperty("attribute").GetString(), wert.GetProperty("value").GetString(), wert.GetProperty("unit").GetString()));
        var modell = doc.GetProperty("model");
        Assert.Contains(modell.GetProperty("attributes").EnumerateArray(), a => a.GetProperty("key").GetString() == "gehalt");
        Assert.Contains(modell.GetProperty("relationTypes").EnumerateArray(), x => x.GetProperty("key").GetString() == "component");
        Assert.Contains("relation_component", modell.GetProperty("memberships").GetProperty("gehalt").EnumerateArray().Select(e => e.GetString()));
    }

    [Fact]
    public void Der_Import_in_ein_anderes_System_legt_die_Relation_mit_Wert_und_Einheit_an()
    {
        var (c, g, _, _) = Quelle();
        var ziel = Welt();
        var r = Einspielen(ziel, Datei(c, g));
        Assert.Equal(1, r.GetProperty("relations").GetInt32());
        Assert.Equal(0, r.GetProperty("errors").GetArrayLength());

        var rel = ziel.Relations.All.Values.Single();
        Assert.Equal("component", rel.Type);
        var axis = new Axis("gehalt", null, null);
        Assert.Equal("20000", rel.Values[axis]);
        Assert.Equal("kg", rel.Units[axis]);
        Assert.NotEqual(rel.From, rel.To);
        Assert.True(ziel.Read(t => t.Nodes.ContainsKey(rel.From) && t.Nodes.ContainsKey(rel.To)), "beide Enden sind die neu angelegten Knoten dieses Systems");
        Assert.Contains("relation_component", ziel.ReadModel(m => m.GroupsOf("gehalt")));
    }

    [Fact]
    public void Ein_zweiter_Import_derselben_Datei_legt_keine_zweite_Relation_an()
    {
        var (c, g, _, _) = Quelle();
        var r = Einspielen(c, Datei(c, g));
        Assert.Equal(0, r.GetProperty("relations").GetInt32());
        Assert.Single(c.Relations.All);
    }

    [Fact]
    public void Ein_abweichender_Wert_wird_bei_einer_vorhandenen_Relation_abgeglichen()
    {
        var (c, g, _, _) = Quelle();
        var datei = Datei(c, g).Replace("\"value\":\"20000\"", "\"value\":\"5000\"");
        var r = Einspielen(c, datei);
        Assert.Equal(0, r.GetProperty("relations").GetInt32());
        Assert.Equal("5000", c.Relations.All.Values.Single().Values[new Axis("gehalt", null, null)]);
    }

    [Fact]
    public void Ein_Ziel_ausserhalb_das_es_hier_nicht_gibt_ist_ein_Fehler_dieser_Relation_nicht_des_Imports()
    {
        var (c, _, t, _) = Quelle();
        var ziel = Welt();
        var vater = Mit(ziel, x => Commands.CreateGroup(x, null, Labels.Of("Ziel", "Target")).Entry!.Stream);
        var datei = Datei(c, t, deep: false);                 // nur die Tablette: ihr Vitamin C steht ausserhalb
        var r = Einspielen(ziel, datei, vater);
        Assert.Equal(0, r.GetProperty("relations").GetInt32());
        Assert.Contains("das Ziel gibt es hier nicht", r.GetProperty("errors")[0].GetString());
        Assert.Empty(ziel.Relations.All);
    }

    [Fact]
    public void Ausgewertet_steht_die_Relation_an_beiden_Enden_mit_der_Bezeichnung_der_jeweiligen_Richtung()
    {
        var (c, g, t, v) = Quelle();
        var baum = JsonDocument.Parse(JsonSerializer.Serialize(RelationApi.Baum(c, g, true), Web)).RootElement;
        var aus = baum.GetProperty(t).EnumerateArray().Single();
        Assert.Equal(("out", "component", "Bestandteil", v), (aus.GetProperty("direction").GetString(), aus.GetProperty("type").GetString(), aus.GetProperty("label").GetString(), aus.GetProperty("other").GetProperty("id").GetString()));
        var ein = baum.GetProperty(v).EnumerateArray().Single();
        Assert.Equal(("in", "verbaut in", t), (ein.GetProperty("direction").GetString(), ein.GetProperty("label").GetString(), ein.GetProperty("other").GetProperty("id").GetString()));
        Assert.Equal(c.Relations.All.Keys.Single(), aus.GetProperty("id").GetString());   // die Id der Relation: der Excel-Import erkennt daran die vorhandene
        Assert.Equal(aus.GetProperty("id").GetString(), ein.GetProperty("id").GetString());
        var gehalt = aus.GetProperty("values").GetProperty("gehalt");
        Assert.Equal(("20000", "g"), (gehalt.GetProperty("value").GetString(), gehalt.GetProperty("unit").GetString()));
    }

    [Fact]
    public void Ausgewertet_ein_Knoten_der_nicht_existiert_gibt_null()
    {
        var (c, _, _, _) = Quelle();
        Assert.Null(RelationApi.Baum(c, "gibtsnicht", true));
    }

    [Fact]
    public void Ein_Knoten_ohne_Relationen_hat_keine_Liste()
    {
        var c = Welt();
        var g = Mit(c, x => Commands.CreateGroup(x, null, Labels.Of("Leer", "Empty")).Entry!.Stream);
        var doc = JsonDocument.Parse(Datei(c, g)).RootElement;
        Assert.Equal(JsonValueKind.Null, doc.GetProperty("node").GetProperty("relations").ValueKind);
        Assert.Equal(JsonValueKind.Null, doc.GetProperty("model").GetProperty("relationTypes").ValueKind);
    }
}
