using System.Security.Cryptography;
using System.Text;
using Journali.Core.Entries;
using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Die Schnittstelle Version 2 des Beraters (docs/pflegestruktur.md 44, 09.10.2026): der Berater versteht, journali wählt aus. Der Kern im Plugin
/// (<c>plugins/advisor/kern/</c>) macht aus einer Eingabe eine genaue Anfrage und führt das Gespräch; hier steht nur, was Rechte, Sicht, Werte, Vektoren
/// und Geheimnisse braucht:
/// <list type="bullet">
/// <item><c>GET vocabulary</c> — Attribute der Sicht (Bezeichnungen, Typ, Einheit und ihre Grösse, Listenwerte), die Wörter der Produktnamen mit Anzahl,
/// die Gruppen des Sortiments (<see cref="Uebersicht"/>); ETag aus Journalstand, Definition und Sprache.</item>
/// <item><c>POST select</c> — Auswahl: die Art (Wörter im Namen) grenzt ein, Angaben filtern, weitere Wörter und der Satz ordnen; Merkmale zum
/// Eingrenzen, auf Wunsch was eine Angabe zu eng macht; zu einem Produkt im Blick die Werte, die eine Frage beantworten.</item>
/// <item><c>POST docs</c> — Abschnitte aus den Unterlagen.</item>
/// <item><c>POST ki</c> — die KI des Teams: Angaben übersetzen oder einen Text zu den Treffern schreiben.</item>
/// </list>
/// </summary>
public static partial class AdvisorApi
{
    /// <summary>Eine Anfrage an die Auswahl. <paramref name="Hinten"/>: Produkte, die nicht nach vorn sollen (abgelehnt);
    /// <paramref name="Probe"/>: eine Nachfrage des Kerns (Tippfehler, Themenwechsel) — sie zählt nicht als Frage;
    /// <paramref name="Gruppe"/>: nur Produkte dieser Gruppe des Publikationsbaums (<see cref="Gruppe.Key"/>, 09.10.2026).</param>
    public sealed record Auswahl(List<string>? Art = null, List<Filter>? Angaben = null, List<string>? Ordnen = null, string? Satz = null, string? Fokus = null,
        int? Take = null, int? Skip = null, string? Locale = null, bool? Lockern = null, List<string>? Hinten = null, bool? Probe = null, string? Gruppe = null);
    /// <param name="Problem">eine Frage nach einem Problem oder zur Pflege — in einem engen Rahmen gilt <see cref="AdvisorApi.DokProblemGrenze"/></param>
    public sealed record DocsAnfrage(string? Satz = null, List<string>? Art = null, string? Fokus = null, string? Locale = null, bool? Problem = null);
    public sealed record KiUnterlage(string? Quelle, string? Text);
    /// <param name="Auftrag"><c>angaben</c> (übersetze den Satz in Angaben), <c>antwort</c> (ein Text zu den Treffern oder zum Produkt im Blick) oder
    /// <c>fremd</c> (eine Eingabe ohne Bezug zum Sortiment: ein, zwei Sätze, die zum Sortiment führen — 17.10.2026)</param>
    public sealed record KiAuftrag(string? Auftrag = null, string? Satz = null, List<string>? Verlauf = null, List<string>? Treffer = null, List<string>? Merkmale = null,
        List<KiUnterlage>? Unterlagen = null, string? Fokus = null, string? Locale = null);

    /// <summary>So viele Produkte zeigt eine Seite der Auswahl höchstens; so weit lässt sie sich blättern.</summary>
    public const int MaxSkip = 1000;

    /// <summary>Wörter einer Anfrage: klein, 1 bis 40 Zeichen, jedes einmal, höchstens <see cref="MaxWoerter"/>.</summary>
    public static List<string> SaubereWoerter(IEnumerable<string>? w) =>
        (w ?? []).Select(x => (x ?? "").Trim().ToLowerInvariant()).Where(x => x.Length is > 0 and <= 40).Distinct().Take(MaxWoerter).ToList();

    /// <summary>Die Filter einer Anfrage, geprüft gegen die Attribute, die der Berater zeigt — ein Attribut ausserhalb der Sicht zählt nicht.</summary>
    public static List<Angabe> Pruefe(IEnumerable<Filter>? filter, IReadOnlyList<AttributeDefinition> attr)
    {
        var nachKey = attr.ToDictionary(x => x.Key);
        var f = new List<Angabe>();
        foreach (var x in filter ?? [])
        {
            var op = x.Op is "le" or "ge" or "low" or "high" ? x.Op : "eq";
            if (x.Attribute is { } ak && nachKey.TryGetValue(ak, out var fd) && IstFacette(fd) && x.Value is { Length: > 0 and <= 200 } fv && f.All(y => y.Def.Key != fd.Key || y.Op != op))
                f.Add(new Angabe(fd, op, fv));
        }
        return f;
    }

    /// <summary>
    /// Die Auswahl ohne Sinn: die Art grenzt ein (jedes Wort im Namen, je Wort die beste Stufe — <see cref="MitWoertern"/>), die übrigen Wörter ordnen;
    /// ohne Art die Produkte, zu denen mindestens ein Wort passt. „leicht“ (low/high) ordnet nach dem Wert (<see cref="Relativ"/>).
    /// </summary>
    public static List<Eintrag> Waehle(Tree tree, ModelCatalog model, Bestand b, IReadOnlyList<(AttributeDefinition Def, string Op, string Value)> f, IReadOnlyList<string> art, IReadOnlyList<string> ordnen)
    {
        var kandidaten = b.Produkte.Where(e => Passt(tree, model, e, f, b.Locale, b.Channel));
        List<Eintrag> gefunden = art.Count > 0 ? MitWoertern(kandidaten, art, b.Produkte)
            : ordnen.Count > 0 ? kandidaten.Where(e => ordnen.Any(w => Staerke(e, w) > 0)).ToList()
            : kandidaten.ToList();
        if (art.Count > 0 || ordnen.Count > 0)
            gefunden = gefunden.OrderByDescending(e => ordnen.Sum(w => Staerke(e, w))).ThenByDescending(e => Punkte(e, art)).ToList();
        return Relativ(tree, model, gefunden, f, b.Locale, b.Channel);
    }

    /// <summary>
    /// Das Sortiment in einer Ebene (09.10.2026): die oberste Ebene des Publikationsbaums mit mindestens zwei Gruppen — eine einzige Gruppe unter der
    /// Wurzel („Outdoor“) sagt nichts, darunter stehen die Bereiche. In Baumfolge, höchstens <paramref name="max"/>.
    /// </summary>
    public static List<Gruppe> Uebersicht(Bestand b, int max = 20)
    {
        foreach (var t in b.Gruppen.Select(g => g.Tiefe).Distinct().Order())
            if (b.Gruppen.Where(g => g.Tiefe == t).ToList() is { Count: >= 2 } ebene) return ebene.Take(max).ToList();
        return b.Gruppen.Where(g => g.Tiefe == 1).Take(max).ToList();
    }

    /// <summary>Der ETag des Vokabulars: Journalstand, Definition und Sprache.</summary>
    public static string VokabularEtag(Bestand b) =>
        "\"" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{b.Head}|{b.Json}|{b.Locale}")))[..16].ToLowerInvariant() + "\"";

    /// <summary>Die Wörter der Produktnamen mit der Zahl der Produkte, in deren Namen sie stehen — die Arten.</summary>
    public static List<(string Wort, int N)> NamenZaehlung(Bestand b) =>
        b.Produkte.SelectMany(e => Woerter(e.Name).Distinct()).GroupBy(w => w).Select(g => (g.Key, g.Count()))
            .OrderByDescending(x => x.Item2).ThenBy(x => x.Key, StringComparer.Ordinal).ToList();

    private static object Vokabel(ModelCatalog model, AttributeDefinition a, string loc, bool achse)
    {
        var einheit = a.Unit is { } u && model.Units.TryGetValue(u, out var ud) ? ud : null;
        var werte = a.Type == AttributeTypes.Enum && a.List is { } lk && model.Lists.TryGetValue(lk, out var list) && list.Values.Count <= 500
            ? list.Ordered.Select(v => new { value = v.Value, label = Bez(v.Label, loc, model) ?? v.Value, labels = v.Label }).ToList()
            : null;
        return new
        {
            key = a.Key, label = Bez(a.Label, loc, model) ?? a.Key, labels = a.Label, type = a.Type, unit = a.Unit,
            unitLabels = einheit?.Label.Values.Where(x => x.Length > 0).Distinct().ToList(), quantity = einheit?.Quantity,
            multiple = a.Multiple, facet = IstFacette(a), axis = achse, values = werte,
        };
    }

    private static object Echo(ModelCatalog model, (AttributeDefinition Def, string Op, string Value) x, string loc) =>
        new { attribute = x.Def.Key, op = x.Op, value = x.Value, label = Bez(x.Def.Label, loc, model) ?? x.Def.Key, valueLabel = AngabeText(model, x.Def, x.Op, x.Value, loc) };

    public static void MapV2(RouteGroupBuilder api, string jobsDir)
    {
        // Das Vokabular: was der Kern zum Verstehen braucht — klein, mit ETag; der Kern holt es neu, wenn es sich geändert hat
        api.MapGet("/advisor/{key}/vocabulary", (string key, HttpRequest req, HttpResponse res, Catalog c, string? locale = null) =>
        {
            if (Zugang(req, c, key, out var d, out var nein)) return nein!;
            var loc = Sprache(c, d!, locale);
            var b = BestandVon(c, key, d!, loc);
            var etag = VokabularEtag(b);
            res.Headers.ETag = etag;
            if (req.Headers.IfNoneMatch.ToString() == etag) return Results.StatusCode(304);
            return Results.Ok(c.Lesen((model, _) =>
            {
                var achsen = b.Produkte.SelectMany(e => e.Product.Axes).ToHashSet(StringComparer.Ordinal);
                string[] sprachen = d!.Locales is { Length: > 0 } l ? l : [model.MasterLocale ?? "de"];
                return new
                {
                    locale = loc, locales = sprachen, etag, products = b.Produkte.Count, ki = d.Ki,
                    attributes = AttributeMitAchsen(model, d.View!, b).Select(a => Vokabel(model, a, loc, achsen.Contains(a.Key))).ToList(),
                    words = NamenZaehlung(b).Select(x => new { word = x.Wort, n = x.N }).ToList(),
                    groups = Uebersicht(b).Select(g => new { key = g.Key, label = g.Label, n = g.N }).ToList(),
                };
            }));
        });

        // Die Auswahl: was gezeigt werden darf und passt — eine Seite davon als Karten, die Merkmale zum Eingrenzen, auf Wunsch was zu eng ist
        api.MapPost("/advisor/{key}/select", async (string key, Auswahl body, HttpRequest req, Catalog c, Vectors vectors, Embedder embedder, CancellationToken ct) =>
        {
            if (Zugang(req, c, key, out var d, out var nein)) return nein!;
            var satz = (body.Satz ?? "").Trim();
            if (satz.Length > MaxFrage) return Bad("Eine Frage hat höchstens {0} Zeichen.", MaxFrage);
            if ((body.Angaben?.Count ?? 0) > MaxFilter) return Bad("Höchstens {0} Filter.", MaxFilter);
            if (body.Probe != true && !Zaehle(key, 0, d!.Limits?.JeTag)) return Results.Json(ModelApi.Err("Berater {0}: Tagesgrenze der Fragen erreicht.", key), statusCode: 429);
            var loc = Sprache(c, d!, body.Locale);
            var b = BestandVon(c, key, d!, loc);
            // eine Gruppe des Sortiments grenzt ein, bevor etwas anderes zählt — eine unbekannte zählt nicht
            var gruppe = body.Gruppe is { Length: > 0 } gk ? b.Gruppen.FirstOrDefault(g => g.Key == gk) : null;
            if (gruppe is not null) b = b with { Produkte = b.Produkte.Where(e => e.Gruppen.Contains(gruppe.Key)).ToList() };
            var take = Math.Clamp(body.Take ?? 6, 1, MaxTreffer);
            var skip = Math.Clamp(body.Skip ?? 0, 0, MaxSkip);
            var art = SaubereWoerter(body.Art);
            var ordnen = SaubereWoerter(body.Ordnen).Where(w => !art.Contains(w)).ToList();
            var hinten = (body.Hinten ?? []).Where(x => x is { Length: > 0 }).ToHashSet(StringComparer.Ordinal);
            var attr = c.Lesen((model, _) => AttributeMitAchsen(model, d!.View!, b));
            var filter = Pruefe(body.Angaben, attr).Select(x => (x.Def, x.Op, x.Value)).ToList();

            // der Sinn ausserhalb der Lesesperre: der Einbetter und die Datenbank
            string? warnung = null;
            List<(string Id, double Distance)> sinn = [];
            if (satz.Length > 0 && b.Produkte.Count > 0)
            {
                if (!vectors.Ready) warnung = vectors.Reason;
                else if (!embedder.Available) warnung = embedder.Reason;
                else try
                {
                    var (m, v) = await embedder.EmbedAsync(satz, "query", ct);
                    var hits = await vectors.SearchNodesAsync(m, v, loc, SinnTreffer, null, ct, b.NachId.Keys.ToList());
                    sinn = hits.Select(h => (b.NachId[h.Node].Product.Id, h.Distance)).ToList();
                }
                catch (Exception e) { warnung = e.Message; }
            }

            // ein Produkt im Blick: die Zeilen, die eine Frage beantworten könnten, und ihre Abstände zum Satz (ausserhalb der Sperre)
            Eintrag? blick = body.Fokus is { Length: > 0 } fid && b.NachId.TryGetValue(fid, out var bl) ? bl : null;
            List<WertZeile> kurz = [];
            List<double>? abstaende = null;
            if (blick is not null)
            {
                kurz = c.Lesen((model, tree) => attr.Where(a => a.Type != AttributeTypes.Html)
                    .Select(a => (a, w: Werte(tree, model, blick, a, loc, b.Channel))).Where(x => x.w.Count > 0)
                    .Select(x => new WertZeile(x.a, Bez(x.a.Label, loc, model) ?? x.a.Key, AlsText(model, x.a, x.w, loc))).Where(z => z.Value.Length <= 80).ToList());
                if (satz.Length > 0 && vectors.Ready && embedder.Available && kurz.Count > 0)
                    try { abstaende = await ZeilenAbstaende(embedder, satz, kurz, ct); }
                    catch (Exception e) { warnung ??= e.Message; }
            }

            var antwort = c.Lesen((model, tree) =>
            {
                var reihe = Waehle(tree, model, b, filter, art, ordnen);
                var nurSinn = false;
                if (reihe.Count == 0 && art.Count == 0 && ordnen.Count > 0 && sinn.Count > 0)
                {
                    // die Wörter finden nichts: nur, was sich nach dem Sinn abhebt
                    var drin = b.Produkte.Where(e => Passt(tree, model, e, filter, loc, b.Channel)).Select(e => e.Product.Id).ToHashSet();
                    reihe = Relativ(tree, model, SinnAuswahl(sinn).Where(drin.Contains).Select(id => b.NachId[id]).ToList(), filter, loc, b.Channel);
                    nurSinn = reihe.Count > 0;
                }
                else if (!filter.Any(x => x.Op is "low" or "high") && sinn.Count > 0 && (art.Count > 0 || ordnen.Count > 0))
                {
                    // der Sinn ordnet mit (Reciprocal Rank Fusion) — „leicht“ ordnet nach dem Wert, nicht nach dem Sinn
                    var wort = reihe.Select(e => e.Product.Id).ToList();
                    var sinnIds = sinn.OrderBy(x => x.Distance).Select(x => x.Id).Distinct().Where(wort.Contains);
                    var ids = SemanticApi.Rrf(wort.Select(id => (id, 0)), sinnIds.Select(id => (id, 0))).Select(x => x.Key.Media).ToList();
                    reihe = ids.Concat(wort.Where(id => !ids.Contains(id))).Select(id => b.NachId[id]).ToList();
                }
                if (hinten.Count > 0) reihe = reihe.Where(e => !hinten.Contains(e.Product.Id)).Concat(reihe.Where(e => hinten.Contains(e.Product.Id))).ToList();

                // was eine Angabe zu eng macht: ohne sie, wie viele es wären — die grössere Zahl zuerst
                var lockern = new List<object>();
                if (body.Lockern == true && reihe.Count == 0 && filter.Count + art.Count + ordnen.Count > 0)
                {
                    var weg = new List<(object Was, int N)>();
                    foreach (var x in filter)
                        if (Waehle(tree, model, b, filter.Where(y => y != x).ToList(), art, ordnen).Count is var n and > 0) weg.Add((new { kind = "filter", attribute = x.Def.Key, op = x.Op, value = x.Value, label = Bez(x.Def.Label, loc, model) ?? x.Def.Key, valueLabel = AngabeText(model, x.Def, x.Op, x.Value, loc), n }, n));
                    foreach (var w in art)
                        if (Waehle(tree, model, b, filter, art.Where(y => y != w).ToList(), ordnen).Count is var n and > 0) weg.Add((new { kind = "word", word = w, label = w, n }, n));
                    foreach (var w in ordnen)
                        if (Waehle(tree, model, b, filter, art, ordnen.Where(y => y != w).ToList()).Count is var n and > 0) weg.Add((new { kind = "word", word = w, label = w, n }, n));
                    lockern = weg.OrderByDescending(x => x.N).Take(MaxLockern).Select(x => x.Was).ToList();
                }

                var role = d!.Role!; var admin = c.Users.RightsOf(role).Contains(Rights.Users);
                var gefiltert = filter.Select(x => x.Def.Key).ToHashSet();
                var fac = Facetten(tree, model, reihe, attr, gefiltert, loc, b.Channel);
                // welche Attribute bei den Treffern Werte haben — der Kern übernimmt Vorlieben nur, wo es sie gibt
                var vorhanden = attr.Where(a => IstFacette(a) && reihe.Take(200).Any(e => Werte(tree, model, e, a, loc, b.Channel).Count > 0)).Select(a => a.Key).ToList();
                var karten = reihe.Skip(skip).Take(take).Select(e => Karte(c, tree, model, e, attr, loc, b.Channel, role, admin, 4, filter)).ToList();
                var woerter = art.Concat(ordnen).Select(w => new { word = w, n = b.Produkte.Count(e => Staerke(e, w) > 0), ganz = b.Produkte.Count(e => Staerke(e, w) >= 1), name = b.Produkte.Count(e => Staerke(e, w) >= 2) }).ToList();
                object? fokus = blick is null ? null : new
                {
                    id = blick.Product.Id, name = blick.Name,
                    values = PassendeWerte(model, kurz, Woerter(satz), abstaende).Select(z => new { key = z.Def.Key, label = z.Label, value = z.Value }).ToList(),
                };
                return new
                {
                    locale = loc, total = reihe.Count, skip, hits = karten, facets = fac, similar = nurSinn, relax = lockern, present = vorhanden, words = woerter,
                    filter = filter.Select(x => Echo(model, x, loc)).ToList(), focus = fokus, warning = warnung,
                    group = gruppe is null ? null : new { key = gruppe.Key, label = gruppe.Label },
                };
            });
            return Results.Ok(antwort);
        });

        // Die Unterlagen: Abschnitte, die zum Satz passen — aus den Dokumenten des Produkts im Blick, sonst der Art, sonst des ganzen Bestands
        api.MapPost("/advisor/{key}/docs", async (string key, DocsAnfrage body, HttpRequest req, Catalog c, Vectors vectors, Embedder embedder, DocText docs, CancellationToken ct) =>
        {
            if (Zugang(req, c, key, out var d, out var nein)) return nein!;
            var satz = (body.Satz ?? "").Trim();
            if (satz.Length > MaxFrage) return Bad("Eine Frage hat höchstens {0} Zeichen.", MaxFrage);
            var b = BestandVon(c, key, d!, Sprache(c, d!, body.Locale));
            var art = SaubereWoerter(body.Art);
            var (doks, eng) = c.Lesen((_, tree) =>
            {
                var alle = Unterlagen(c, b, d!.Role!, c.Users.RightsOf(d.Role!).Contains(Rights.Users));
                HashSet<string>? knoten = body.Fokus is { Length: > 0 } fid && b.NachId.TryGetValue(fid, out var bl) ? KnotenVon(tree, [bl])
                    : art.Count > 0 ? KnotenVon(tree, b.Produkte.Where(e => art.All(w => Staerke(e, w) >= 2))) : null;
                return (knoten is null ? alle : alle.Where(m => b.Dokumente.TryGetValue(m, out var n) && knoten.Contains(n)).ToList(), knoten is not null);
            });
            // eine Frage nach einem Problem in einem engen Rahmen: die weitere Grenze (10.10.2026); ohne Rahmen bleibt die allgemeine
            var (auszuege, warnung) = await AbschnitteAsync(satz, doks, docs, vectors, embedder, ct, body.Problem == true && eng ? DokProblemGrenze : DokSinnGrenze);
            return Results.Ok(new { docs = AlsUnterlagen(c, b, auszuege), warning = warnung });
        });

        // Die KI des Teams: Angaben aus einem Satz (nur aus dem Vokabular, geprüft) oder ein Text zu den Treffern — ohne Werkzeuge
        api.MapPost("/advisor/{key}/ki", async (string key, KiAuftrag body, HttpRequest req, Catalog c, CancellationToken ct) =>
        {
            if (Zugang(req, c, key, out var d, out var nein)) return nein!;
            if (!d!.Ki) return Bad("Berater {0} nutzt keine KI.", key);
            var satz = (body.Satz ?? "").Trim();
            if (satz.Length > MaxFrage) return Bad("Eine Frage hat höchstens {0} Zeichen.", MaxFrage);
            if (!Zaehle(key, 1, d.Limits?.KiJeTag)) return Results.Ok(new { text = (string?)null, angaben = Array.Empty<object>(), names = Array.Empty<string>(), warning = "KI: Tagesgrenze erreicht" });
            var loc = Sprache(c, d, body.Locale);
            var b = BestandVon(c, key, d, loc);
            var verlauf = (body.Verlauf ?? []).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Select(x => x.Length > MaxFrage ? x[..MaxFrage] : x).TakeLast(MaxVerlauf).ToList();

            if (body.Auftrag == "angaben")
            {
                var (attr, vokabular) = c.Lesen((model, _) => { var a = AttributeMitAchsen(model, d.View!, b); return (a, Vokabular(model, a, loc)); });
                if (satz.Length == 0 || vokabular.Length == 0) return Results.Ok(new { text = (string?)null, angaben = Array.Empty<object>(), names = Array.Empty<string>(), warning = (string?)null });
                var (system, user) = PromptAngaben(satz, verlauf, vokabular);
                var r = await AiApi.AskAsync(req, c, jobsDir, null, null, system, user, 300, false, 1, "advisor", ct, fuerTeam: d.Team);
                if (r.Fehler is not null) return Results.Ok(new { text = (string?)null, angaben = Array.Empty<object>(), names = Array.Empty<string>(), warning = KiNichtVerfuegbar(req, r.Fehler) });
                return Results.Ok(c.Lesen((model, _) =>
                {
                    var n = AngabenAusKi(r.Text, model, attr);
                    return new
                    {
                        text = (string?)null, angaben = n.Select(e => Echo(model, (e.Def, e.Op, e.Value), loc)).ToList(),
                        // was die KI übersetzt hat, fällt aus den Suchwörtern: der Wert, sein Name und die Bezeichnung des Attributs
                        names = n.SelectMany(e => new[] { e.Value, Anzeige(model, e.Def, e.Value, loc), Bez(e.Def.Label, loc, model) ?? "" }).Where(x => x.Length > 0).Distinct().ToList(),
                        warning = (string?)null,
                    };
                }));
            }

            // eine Eingabe ohne Bezug zum Sortiment (17.10.2026): „glück“, „vitamine“ — die KI geht darauf ein und führt zu den Bereichen des
            // Sortiments; die nennt der Server, nicht der Aufrufer. Die Gruppen stehen im Fenster darunter als Chips.
            if (body.Auftrag == "fremd")
            {
                if (satz.Length == 0) return Bad("Ein Auftrag an die KI braucht einen Satz.");
                var bereiche = Uebersicht(b).Select(g => g.Label).Take(MaxBereiche).ToList();
                var (sf, uf) = PromptFremd(satz, verlauf, d.Label ?? key, bereiche, loc);
                var r = await AiApi.AskAsync(req, c, jobsDir, null, null, sf, uf, 200, false, 1, "advisor", ct, fuerTeam: d.Team);
                return Results.Ok(r.Fehler is null
                    ? new { text = (string?)r.Text.Trim(), angaben = Array.Empty<object>(), names = Array.Empty<string>(), warning = (string?)null }
                    : new { text = (string?)null, angaben = Array.Empty<object>(), names = Array.Empty<string>(), warning = (string?)KiNichtVerfuegbar(req, r.Fehler) });
            }

            var unterlagen = (body.Unterlagen ?? []).Where(u => !string.IsNullOrWhiteSpace(u.Text)).Take(MaxUnterlagen)
                .Select(u => ((u.Quelle ?? "").Length > 300 ? u.Quelle![..300] : u.Quelle ?? "", u.Text!.Length > 1500 ? u.Text[..1500] : u.Text)).ToList();
            var (frage, treffer, merkmale) = c.Lesen((model, tree) =>
            {
                var attr = AttributeMitAchsen(model, d.View!, b);
                IReadOnlyList<(string, string)> Zeilen(Eintrag e, int max) => attr.Select(a => (a, w: Werte(tree, model, e, a, loc, b.Channel))).Where(x => x.w.Count > 0)
                    .Take(max).Select(x => (Bez(x.a.Label, loc, model) ?? x.a.Key, AlsText(model, x.a, x.w, loc))).ToList();
                if (body.Fokus is { Length: > 0 } fid && b.NachId.TryGetValue(fid, out var bl))
                    return (satz, new List<(string, IReadOnlyList<(string, string)>)> { (bl.Name, Zeilen(bl, 20)) }, new List<string>());
                var t = (body.Treffer ?? []).Where(b.NachId.ContainsKey).Select(id => b.NachId[id]).DistinctBy(e => e.Product.Id).Take(5)
                    .Select(e => (e.Name, Zeilen(e, 12))).ToList();
                return (satz, t, (body.Merkmale ?? []).Where(x => x is { Length: > 0 and <= 80 }).Take(MaxFacetten).ToList());
            });
            if (frage.Length == 0 && verlauf.Count == 0) return Bad("Ein Auftrag an die KI braucht einen Satz.");
            var (sys, usr) = Prompt(frage, treffer, merkmale, verlauf, unterlagen);
            var antwort = await AiApi.AskAsync(req, c, jobsDir, null, null, sys, usr, 600, false, 1, "advisor", ct, fuerTeam: d.Team);
            return Results.Ok(antwort.Fehler is null
                ? new { text = (string?)antwort.Text, angaben = Array.Empty<object>(), names = Array.Empty<string>(), warning = (string?)null }
                : new { text = (string?)null, angaben = Array.Empty<object>(), names = Array.Empty<string>(), warning = (string?)KiNichtVerfuegbar(req, antwort.Fehler) });
        });
    }

    /// <summary>Die Abstände der Zeilen eines Produkts zum Satz — die Vektoren der Zeilen werden gemerkt (sie ändern sich selten).</summary>
    public static async Task<List<double>> ZeilenAbstaende(Embedder embedder, string satz, IReadOnlyList<WertZeile> zeilen, CancellationToken ct)
    {
        var (m, qv) = await embedder.EmbedAsync(satz, "query", ct);
        var aus = new List<double>();
        foreach (var z in zeilen)
        {
            var zeile = $"{z.Label}: {z.Value}";
            if (!_zeilenVektoren.TryGetValue(m + "|" + zeile, out var zv))
            {
                zv = (await embedder.EmbedAsync(zeile, "passage", ct)).Vector;
                if (_zeilenVektoren.Count > 5000) _zeilenVektoren.Clear();
                _zeilenVektoren[m + "|" + zeile] = zv;
            }
            aus.Add(1 - qv.Zip(zv, (x, y) => (double)x * y).Sum());
        }
        return aus;
    }

    /// <summary>Abschnitte als Unterlagen der Antwort: Nummer, Dokument, Seite, Überschrift, Text (gekürzt), der Knoten, an dem das Dokument hängt.</summary>
    public static List<Unterlage> AlsUnterlagen(Catalog c, Bestand b, IReadOnlyList<Auszug> auszuege) =>
        auszuege.Count == 0 ? [] : c.Lesen((model, tree) => auszuege.Select((a, i) =>
        {
            var knoten = b.Dokumente.GetValueOrDefault(a.Media) is { } nid && tree.Nodes.TryGetValue(nid, out var nn) ? nn : null;
            return new Unterlage(i + 1, a.Media, c.Media.All.GetValueOrDefault(a.Media)?.Name ?? a.Media, a.Page, a.Heading,
                a.Body.Length > 1200 ? a.Body[..1200] + " …" : a.Body, knoten is null ? null : new UnterlageKnoten(knoten.Id, NodeRow.LabelOf(tree, model, knoten)), a.Seq);
        }).ToList());
}
