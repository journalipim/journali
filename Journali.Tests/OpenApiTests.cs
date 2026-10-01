using System.Reflection;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Journali.Core.Entries;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Die Beschreibung der Schnittstelle (OpenAPI 3.0): aus den Endpunkten erzeugt, die der Server kennt — Pfad, Methode, Parameter, Körper und das
/// Recht, das ein Aufruf braucht. Die Anwendung ist headless: die Beschreibung ist die Dokumentation.
/// </summary>
public class OpenApiTests
{
    public sealed record DemoKoerper(string Name, int Menge, string[]? Tags, Dictionary<string, string>? Werte);
    private static void Demo(string id, int limit, bool deep = false, string? q = null, string anlage = "x") { }

    private static RouteEndpoint Endpunkt(string muster, string methode, MethodInfo? m = null, Type? koerper = null)
    {
        var b = new RouteEndpointBuilder(_ => Task.CompletedTask, RoutePatternFactory.Parse(muster), 0);
        b.Metadata.Add(new HttpMethodMetadata([methode]));
        if (m is not null) b.Metadata.Add(m);
        if (koerper is not null) b.Metadata.Add(new AcceptsMetadata(["application/json"], koerper));
        return (RouteEndpoint)b.Build();
    }

    private static JsonElement Dok(params Endpoint[] e) => JsonSerializer.SerializeToElement(OpenApiDoc.Build(e, "9.9.9"));

    [Fact]
    public void Pfad_Methode_und_Recht_stehen_in_der_Beschreibung()
    {
        var d = Dok(Endpunkt("/api/model/attributes/{key}", "PUT"), Endpunkt("/api/tree", "GET"));
        Assert.Equal("3.0.3", d.GetProperty("openapi").GetString()); Assert.Equal("9.9.9", d.GetProperty("info").GetProperty("version").GetString());
        var put = d.GetProperty("paths").GetProperty("/api/model/attributes/{key}").GetProperty("put");
        Assert.Equal(Rights.Model, put.GetProperty("x-recht").GetString());
        Assert.Equal(Rights.Read, d.GetProperty("paths").GetProperty("/api/tree").GetProperty("get").GetProperty("x-recht").GetString());
        Assert.Equal("model", put.GetProperty("tags")[0].GetString());
    }

    [Fact]
    public void Nur_Pfade_unter_api_kommen_hinein()
    {
        var d = Dok(Endpunkt("/plugins/{key}/{**path}", "GET"), Endpunkt("/api/tree", "GET"));
        var pfade = d.GetProperty("paths").EnumerateObject().Select(p => p.Name).ToList();
        Assert.Equal(["/api/tree"], pfade);
    }

    [Fact]
    public void Pfadteile_werden_zu_OpenAPI_Parametern_und_die_Einschraenkung_faellt_weg()
    {
        var d = Dok(Endpunkt("/api/journal/{number:long}", "GET"), Endpunkt("/api/files/{**pfad}", "GET"));
        Assert.True(d.GetProperty("paths").TryGetProperty("/api/journal/{number}", out var j));
        Assert.Equal("number", j.GetProperty("get").GetProperty("parameters")[0].GetProperty("name").GetString());
        Assert.True(d.GetProperty("paths").TryGetProperty("/api/files/{pfad}", out _));
    }

    [Fact]
    public void Parameter_des_Endpunkts_Pfad_Abfrage_Pflicht_und_Vorgabe()
    {
        var m = typeof(OpenApiTests).GetMethod(nameof(Demo), BindingFlags.NonPublic | BindingFlags.Static)!;
        var d = Dok(Endpunkt("/api/demo/{id}", "GET", m));
        var ps = d.GetProperty("paths").GetProperty("/api/demo/{id}").GetProperty("get").GetProperty("parameters").EnumerateArray().ToDictionary(p => p.GetProperty("name").GetString()!, p => p);
        Assert.Equal("path", ps["id"].GetProperty("in").GetString()); Assert.True(ps["id"].GetProperty("required").GetBoolean());
        Assert.Equal("query", ps["limit"].GetProperty("in").GetString()); Assert.True(ps["limit"].GetProperty("required").GetBoolean(), "ohne Vorgabewert Pflicht");
        Assert.False(ps["deep"].GetProperty("required").GetBoolean(), "mit Vorgabe keine Pflicht"); Assert.Equal("boolean", ps["deep"].GetProperty("schema").GetProperty("type").GetString());
        Assert.False(ps["q"].GetProperty("required").GetBoolean(), "string? ist keine Pflicht");
        Assert.False(ps["anlage"].GetProperty("required").GetBoolean());
    }

    [Fact]
    public void Der_Koerper_wird_aus_dem_Typ_beschrieben()
    {
        var d = Dok(Endpunkt("/api/demo", "POST", null, typeof(DemoKoerper)));
        var rb = d.GetProperty("paths").GetProperty("/api/demo").GetProperty("post").GetProperty("requestBody");
        var schema = rb.GetProperty("content").GetProperty("application/json").GetProperty("schema");
        Assert.Equal("object", schema.GetProperty("type").GetString());
        var eig = schema.GetProperty("properties");
        Assert.Equal("string", eig.GetProperty("name").GetProperty("type").GetString());
        Assert.Equal("integer", eig.GetProperty("menge").GetProperty("type").GetString());
        Assert.Equal("array", eig.GetProperty("tags").GetProperty("type").GetString());
        Assert.Equal("string", eig.GetProperty("werte").GetProperty("additionalProperties").GetProperty("type").GetString());
    }

    [Fact]
    public void Jede_Operation_hat_eine_eindeutige_Kennung_und_die_Antworten_401_und_403()
    {
        var d = Dok(Endpunkt("/api/tree", "GET"), Endpunkt("/api/tree/{id}", "GET"), Endpunkt("/api/tree/{id}", "DELETE"));
        var ids = d.GetProperty("paths").EnumerateObject().SelectMany(p => p.Value.EnumerateObject()).Select(o => o.Value.GetProperty("operationId").GetString()).ToList();
        Assert.Equal(ids.Count, ids.Distinct().Count());
        var antworten = d.GetProperty("paths").GetProperty("/api/tree").GetProperty("get").GetProperty("responses");
        Assert.True(antworten.TryGetProperty("401", out _)); Assert.True(antworten.TryGetProperty("403", out _));
    }

    [Theory]
    [InlineData("/api/auth/login", "POST")]
    [InlineData("/api/health", "GET")]
    [InlineData("/api/auth/state", "GET")]
    public void Aufrufe_ohne_Sitzung_tragen_kein_Recht_und_brauchen_kein_Token(string pfad, string methode)
    {
        var d = Dok(Endpunkt(pfad, methode));
        var op = d.GetProperty("paths").GetProperty(pfad).GetProperty(methode.ToLowerInvariant());
        Assert.Equal("offen", op.GetProperty("x-recht").GetString());
        Assert.Equal(0, op.GetProperty("security").GetArrayLength());   // leer: in OpenAPI kein Token nötig
        Assert.False(op.GetProperty("responses").TryGetProperty("401", out _), "ein offener Aufruf antwortet nicht mit 401");
    }

    [Fact]
    public void Die_Sperre_und_die_Beschreibung_lesen_dieselbe_Liste()
    {
        foreach (var offen in new[] { "/api/health", "/API/Health", "/api/auth/login", "/api/auth/state", "/api/auth/setup", "/api/auth/claim" }) Assert.True(Auth.ApiOhneSitzung(offen), offen);
        foreach (var zu in new[] { "/api/tree", "/api/auth/me", "/api/auth/users", "/api/openapi.json" }) Assert.False(Auth.ApiOhneSitzung(zu), zu);
    }

    [Fact]
    public void Das_Schema_kennt_die_einfachen_Typen_Listen_und_Aufzaehlungen()
    {
        string T(Type t) => JsonSerializer.SerializeToElement(OpenApiDoc.Schema(t, 0)).GetProperty("type").GetString()!;
        Assert.Equal("integer", T(typeof(long?))); Assert.Equal("number", T(typeof(decimal))); Assert.Equal("boolean", T(typeof(bool)));
        Assert.Equal("array", T(typeof(List<string>))); Assert.Equal("string", T(typeof(DateTimeOffset)));
        var e = JsonSerializer.SerializeToElement(OpenApiDoc.Schema(typeof(DayOfWeek), 0));
        Assert.Contains("Monday", e.GetProperty("enum").EnumerateArray().Select(x => x.GetString()));
    }
}
