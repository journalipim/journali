using Journali.Core.Konfigurator;
using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Der Konfigurator als Schnittstelle (docs/pflegestruktur.md 39, 02.10.2026). Ein Shop schickt, was ausgewählt ist, und bekommt zurück, was geht —
/// die Regeln kennt er nicht. Die Definitionen liegen als Plugin-Daten von <c>konfigurator</c> im Journal (Name <c>def:&lt;key&gt;</c>, ein JSON-Dokument,
/// <see cref="Definition"/>); gepflegt werden sie in der Ansicht des Plugins. Geprüft wird hier, mit derselben Funktion wie in den Tests
/// (<see cref="Pruefer"/>): es gibt keine zweite Umsetzung der Logik im Browser.
/// <para><b>Recht.</b> Prüfen ändert nichts und braucht darum nur das Recht zu lesen, auch wenn es ein POST ist (<see cref="Auth.Needed"/>).
/// Ein Teil, das die Rolle des Aufrufers nicht sieht, gibt es für ihn nicht.</para>
/// </summary>
public static class ConfiguratorApi
{
    public const string Plugin = "konfigurator";
    public const string Praefix = "def:";
    public const int MaxZeilen = 500;
    public const int MaxMenge = 9999;
    public const int MaxWaehlbar = 2000;

    /// <summary>Ein Teil der Auswahl: <c>Id</c> ist eine Knoten-Id oder der eindeutige Wert eines Attributs (SKU, EAN …).</summary>
    public sealed record Zeile(string? Id, int? Menge = null);
    public sealed record Pruefung(List<Zeile>? Auswahl, bool? Waehlbar = null);

    public static void Map(RouteGroupBuilder api)
    {
        // Die Konfiguratoren dieser Instanz
        api.MapGet("/konfigurator", (Catalog c) =>
        {
            if (Bereit(c) is { } nein) return nein;
            return Results.Ok(c.Lesen((_, _) => Alle(c).Select(kv =>
            {
                var (d, fehler) = Definition.Lesen(kv.Value);
                return new { key = kv.Key, bezeichnung = d?.Bezeichnung, wurzel = d?.Wurzel, regeln = d?.Alle.Count ?? 0, fehler = fehler is not null ? 1 : d!.Fehler().Count };
            }).ToList()));
        });

        // Eine Definition mit dem, was an ihr nicht stimmt
        api.MapGet("/konfigurator/{key}", (string key, Catalog c) =>
        {
            if (Bereit(c) is { } nein) return nein;
            var def = c.Lesen((_, _) => Alle(c).FirstOrDefault(kv => kv.Key == key).Value);
            if (def is null) return Unbekannt(key);
            var (d, lesefehler) = Definition.Lesen(def);
            return Results.Ok(new { key, definition = d, fehler = lesefehler is not null ? new List<string> { lesefehler } : d!.Fehler() });
        });

        // Die Auswahl prüfen
        api.MapPost("/konfigurator/{key}/pruefen", (string key, Pruefung body, HttpRequest req, Catalog c) =>
        {
            if (Bereit(c) is { } nein) return nein;
            var def = c.Lesen((_, _) => Alle(c).FirstOrDefault(kv => kv.Key == key).Value);
            if (def is null) return Unbekannt(key);
            var (d, lesefehler) = Definition.Lesen(def);
            if (d is null) return Bad("Konfigurator {0}: {1}", key, lesefehler ?? "");
            if (d.Fehler() is { Count: > 0 } mangel) return Bad("Konfigurator {0} hat Fehler: {1}", key, mangel[0]);
            var zeilen = body.Auswahl ?? [];
            if (zeilen.Count > MaxZeilen) return Bad("Höchstens {0} Zeilen in der Auswahl.", MaxZeilen);
            var sicht = Auth.Sicht(req);

            return c.Lesen((model, tree) =>
            {
                // Aus der Kennung des Aufrufers wird ein Knoten: Id, sonst der eindeutige Wert eines Attributs
                Dictionary<string, List<Node>>? ueberWert = null;
                var gewaehlt = new List<(string Kennung, Node Knoten, int Menge)>();
                foreach (var z in zeilen)
                {
                    var kennung = z.Id?.Trim();
                    if (string.IsNullOrEmpty(kennung)) return Bad("Eine Zeile der Auswahl hat keine Id.");
                    var menge = z.Menge ?? 1;
                    if (menge < 1 || menge > MaxMenge) return Bad("Menge {0} gilt nicht (1 bis {1}).", menge, MaxMenge);
                    Node? n = null;
                    if (tree.Nodes.TryGetValue(kennung, out var direkt)) n = direkt;
                    else
                    {
                        ueberWert ??= WerteIndex(tree, model);
                        if (ueberWert.TryGetValue(kennung, out var treffer))
                        {
                            if (treffer.Count > 1) return Bad("{0} ist nicht eindeutig.", kennung);
                            n = treffer[0];
                        }
                    }
                    if (n is null || !tree.Visible(n, sicht.Role, sicht.Admin)) return Bad("Teil {0} gibt es nicht.", kennung);
                    gewaehlt.Add((kennung, n, menge));
                }

                var ress = d.RessourcenAttribut;
                var teile = gewaehlt.Select(g => new Journali.Core.Konfigurator.Zeile(Teile.Aus(tree, model, g.Knoten, ress), g.Menge)).ToList();
                IReadOnlyList<Teil>? kandidaten = null;
                if (body.Waehlbar == true)
                {
                    kandidaten = Teile.Waehlbare(tree, model, d.Wurzel, ress).Where(t => tree.Nodes.TryGetValue(t.Id, out var k) && tree.Visible(k, sicht.Role, sicht.Admin)).ToList();
                    if (kandidaten.Count > MaxWaehlbar) return Bad("Mehr als {0} wählbare Teile — die Wurzel des Konfigurators begrenzt sie.", MaxWaehlbar);
                }

                var e = Pruefer.Pruefe(d, teile, kandidaten);
                // Der Aufrufer kennt seine Kennungen, nicht unsere Ids: zurück in seiner Sprache
                var zurueck = gewaehlt.GroupBy(g => g.Knoten.Id).ToDictionary(g => g.Key, g => g.First().Kennung);
                string Kennung(string id) => zurueck.GetValueOrDefault(id, id);
                object Satz(Verstoss v) => new { v.Art, v.Text, betrifft = v.Betrifft.Select(Kennung).ToList(), v.Regel, v.Ressource };

                return Results.Ok(new
                {
                    zulaessig = e.Zulaessig,
                    vollstaendig = e.Vollstaendig,
                    auswahl = gewaehlt.Select(g => new { kennung = g.Kennung, id = g.Knoten.Id, name = NodeRow.LabelOf(tree, model, g.Knoten), menge = g.Menge }).ToList(),
                    verstoesse = e.Verstoesse.Select(Satz).ToList(),
                    fehlt = e.Fehlt.Select(Satz).ToList(),
                    bilanz = e.Bilanz.OrderBy(kv => kv.Key, StringComparer.Ordinal).ToDictionary(kv => kv.Key, kv => kv.Value),
                    waehlbar = e.Waehlbar?.Select(w =>
                    {
                        var k = tree.Nodes[w.Id];
                        return new { id = w.Id, name = NodeRow.LabelOf(tree, model, k), keys = tree.KeysOf(model, k), ok = w.Ok, gruende = w.Gruende.Select(Satz).ToList() };
                    }).ToList(),
                });
            });
        });
    }

    /// <summary>Die Definitionen im Journal: Name ohne Präfix und das JSON-Dokument.</summary>
    private static List<KeyValuePair<string, string>> Alle(Catalog c) =>
        c.Plugins.All.TryGetValue(Plugin, out var p)
            ? p.Data.Where(kv => kv.Key.StartsWith(Praefix, StringComparison.Ordinal)).Select(kv => new KeyValuePair<string, string>(kv.Key[Praefix.Length..], kv.Value)).OrderBy(kv => kv.Key, StringComparer.Ordinal).ToList()
            : [];

    /// <summary>Das Plugin muss da, an und im Tarif sein — sonst gibt es keinen Konfigurator.</summary>
    private static IResult? Bereit(Catalog c)
    {
        if (!c.Lesen((_, _) => c.Plugins.All.TryGetValue(Plugin, out var p) && p.Enabled)) return Bad("Plugin {0} ist nicht installiert oder aus.", Plugin);
        return PluginApi.NichtImTarif(c, Plugin);
    }

    /// <summary>Wert → Knoten, für jedes eindeutige Attribut (SKU, EAN …) einmal je Anfrage gebaut.</summary>
    private static Dictionary<string, List<Node>> WerteIndex(Tree tree, ModelCatalog model)
    {
        var index = new Dictionary<string, List<Node>>(StringComparer.Ordinal);
        foreach (var n in tree.Nodes.Values)
            if (tree.KeysOf(model, n) is { } keys)
                foreach (var v in keys.Values)
                {
                    if (!index.TryGetValue(v, out var l)) index[v] = l = [];
                    if (!l.Contains(n)) l.Add(n);
                }
        return index;
    }

    private static IResult Unbekannt(string key) => Results.Json(ModelApi.Err("Konfigurator {0} gibt es nicht.", key), statusCode: 404);
    private static IResult Bad(string vorlage, params object[] werte) => ModelApi.Bad(vorlage, werte);
}
