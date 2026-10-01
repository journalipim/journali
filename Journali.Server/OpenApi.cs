using System.Collections;
using System.Reflection;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;

namespace Journali.Server;

/// <summary>
/// Die Beschreibung der Schnittstelle (OpenAPI 3.0, 01.10.2026): <c>GET /api/openapi.json</c>. Sie wird aus den Endpunkten erzeugt, die der Server wirklich
/// kennt — Pfad, Methode, Parameter, Körper und das Recht, das der Aufruf braucht (<c>x-recht</c>, aus <see cref="Auth.Needed"/>) — und kann darum nicht
/// veralten. Ohne neues Paket: nur Pfade, Parameter und Körper; die Antworten sind nicht beschrieben (die Endpunkte geben anonyme Objekte zurück).
/// </summary>
public static class OpenApiDoc
{
    private static readonly JsonNamingPolicy Camel = JsonNamingPolicy.CamelCase;

    public static object Build(IEnumerable<Endpoint> endpoints, string? version)
    {
        var paths = new SortedDictionary<string, SortedDictionary<string, object>>(StringComparer.Ordinal);
        foreach (var e in endpoints.OfType<RouteEndpoint>())
        {
            var roh = e.RoutePattern.RawText ?? "";
            if (!roh.StartsWith("/api", StringComparison.OrdinalIgnoreCase)) continue;
            var pfad = Pfad(e.RoutePattern);
            var methoden = e.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods ?? [];
            foreach (var m in methoden)
            {
                if (!paths.TryGetValue(pfad, out var ops)) paths[pfad] = ops = new(StringComparer.Ordinal);
                ops[m.ToLowerInvariant()] = Operation(e, pfad, m);
            }
        }
        return new Dictionary<string, object?>
        {
            ["openapi"] = "3.0.3",
            ["info"] = new { title = "journali", version = version ?? "", description = "Die Schnittstelle dieses Servers, aus seinen Endpunkten erzeugt. x-recht nennt das Recht, das ein Aufruf braucht; Antworten sind nicht beschrieben." },
            ["servers"] = new[] { new { url = "/" } },
            ["security"] = new[] { new Dictionary<string, string[]> { ["bearer"] = [] } },
            ["components"] = new { securitySchemes = new Dictionary<string, object> { ["bearer"] = new { type = "http", scheme = "bearer", description = "Token aus Einstellungen → Mein Account; im Browser gilt die Sitzung." } } },
            ["paths"] = paths,
        };
    }

    /// <summary>Der Pfad in der Schreibweise von OpenAPI: <c>{id:long}</c> und <c>{**path}</c> werden zu <c>{id}</c> und <c>{path}</c>.</summary>
    private static string Pfad(RoutePattern muster) => "/" + string.Join('/', muster.PathSegments.Select(s => string.Concat(s.Parts.Select(t => t switch
    {
        RoutePatternLiteralPart l => l.Content,
        RoutePatternParameterPart p => "{" + p.Name + "}",
        _ => "",
    }))));

    private static object Operation(RouteEndpoint e, string pfad, string methode)
    {
        var teile = pfad.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var routeNamen = e.RoutePattern.Parameters.Select(p => p.Name).ToHashSet(StringComparer.Ordinal);
        var parameter = new Dictionary<string, object>(StringComparer.Ordinal);
        var methodInfo = e.Metadata.GetMetadata<MethodInfo>();
        var nullbar = new NullabilityInfoContext();
        foreach (var p in methodInfo?.GetParameters() ?? [])
        {
            if (p.Name is not { } name) continue;
            var typ = Nullable.GetUnderlyingType(p.ParameterType) ?? p.ParameterType;
            if (routeNamen.Contains(name)) parameter[name] = new { name, @in = "path", required = true, schema = Schema(typ, 0) };
            else if (Einfach(typ))
            {
                // Pflicht ist, was weder einen Vorgabewert noch einen Nullwert zulässt
                var pflicht = !p.HasDefaultValue && Nullable.GetUnderlyingType(p.ParameterType) is null && nullbar.Create(p).WriteState != NullabilityState.Nullable;
                parameter[name] = new { name, @in = "query", required = pflicht, schema = Schema(typ, 0) };
            }
        }
        foreach (var n in routeNamen) parameter.TryAdd(n, new { name = n, @in = "path", required = true, schema = new { type = "string" } });   // ein Pfadteil, den der Endpunkt nicht als Parameter nimmt
        var koerper = e.Metadata.GetMetadata<IAcceptsMetadata>();
        var ctx = new DefaultHttpContext(); ctx.Request.Method = methode; ctx.Request.Path = "/" + string.Join('/', pfad.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(s => s.StartsWith('{') ? "x" : s));
        var recht = Auth.Needed(ctx.Request);
        var op = new Dictionary<string, object?>
        {
            ["tags"] = new[] { teile.Length > 1 ? teile[1] : "api" },
            ["operationId"] = (methode.ToLowerInvariant() + "_" + string.Join('_', teile.Select(s => s.Trim('{', '}')))).Replace('-', '_'),
            ["parameters"] = parameter.Values.ToList(),
            ["x-recht"] = recht ?? "eigenes Konto",
            ["responses"] = new Dictionary<string, object> { ["200"] = new { description = "Erfolg; die Antwort ist nicht beschrieben." }, ["401"] = new { description = "Anmeldung nötig." }, ["403"] = new { description = "Die Rolle darf das nicht." } },
        };
        if (koerper?.RequestType is { } t && t != typeof(void))
            op["requestBody"] = new { required = !koerper.IsOptional, content = new Dictionary<string, object> { ["application/json"] = new { schema = Schema(t, 0) } } };
        return op;
    }


    private static bool Einfach(Type t) => t.IsPrimitive || t.IsEnum || t == typeof(string) || t == typeof(decimal) || t == typeof(DateTime) || t == typeof(DateTimeOffset) || t == typeof(Guid) || t == typeof(DateOnly);

    /// <summary>Das Schema eines Typs: einfache Typen, Listen, Wörterbücher und Verbunde aus öffentlichen Eigenschaften; ab vier Ebenen nur noch „Objekt“.</summary>
    public static object Schema(Type typ, int tiefe)
    {
        typ = Nullable.GetUnderlyingType(typ) ?? typ;
        if (typ == typeof(string) || typ == typeof(Guid)) return new { type = "string" };
        if (typ == typeof(bool)) return new { type = "boolean" };
        if (typ == typeof(long) || typ == typeof(ulong)) return new { type = "integer", format = "int64" };
        if (typ == typeof(int) || typ == typeof(short) || typ == typeof(byte) || typ == typeof(uint) || typ == typeof(ushort)) return new { type = "integer" };
        if (typ == typeof(decimal) || typ == typeof(double) || typ == typeof(float)) return new { type = "number" };
        if (typ == typeof(DateTime) || typ == typeof(DateTimeOffset)) return new { type = "string", format = "date-time" };
        if (typ == typeof(DateOnly)) return new { type = "string", format = "date" };
        if (typ.IsEnum) return new { type = "string", @enum = Enum.GetNames(typ) };
        if (typ == typeof(JsonElement) || typ == typeof(object) || typ == typeof(JsonDocument)) return new { };
        if (tiefe > 4) return new { type = "object" };
        if (typ.IsArray) return new { type = "array", items = Schema(typ.GetElementType()!, tiefe + 1) };
        var woerterbuch = typ.GetInterfaces().Append(typ).FirstOrDefault(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IDictionary<,>));
        if (woerterbuch is not null) return new { type = "object", additionalProperties = Schema(woerterbuch.GetGenericArguments()[1], tiefe + 1) };
        if (typeof(IEnumerable).IsAssignableFrom(typ) && typ.IsGenericType) return new { type = "array", items = Schema(typ.GetGenericArguments()[0], tiefe + 1) };
        var eigenschaften = typ.GetProperties(BindingFlags.Public | BindingFlags.Instance).Where(p => p.GetIndexParameters().Length == 0 && p.CanRead)
            .ToDictionary(p => Camel.ConvertName(p.Name), p => Schema(p.PropertyType, tiefe + 1));
        return new { type = "object", properties = eigenschaften };
    }
}
