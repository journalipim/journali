using System.Globalization;

namespace Journali.Core.Konfigurator;

/// <summary>
/// Ein wählbares Teil, wie die Prüfung es sieht — unabhängig davon, woher es kommt (<see cref="Teile"/> baut es aus dem Baum).
/// <c>Pfad</c>: die Knoten, zu denen es gehört (es selbst, sein Produkt, die Gruppen darüber) — damit passt ein Selektor auf einen Teilbaum.
/// <c>Wert</c>: der wirksame Wert eines Attributs oder null. <c>Ressourcen</c>: je Ressource die Menge, positiv = stellt bereit, negativ = verbraucht.
/// </summary>
public sealed record Teil(string Id, IReadOnlySet<string> Pfad, Func<string, string?> Wert, IReadOnlyDictionary<string, decimal> Ressourcen);

/// <summary>Ein Teil der Auswahl mit seiner Menge.</summary>
public sealed record Zeile(Teil Teil, int Menge = 1);

/// <summary><c>Art</c>: <c>regel</c> (Verbot oder Grenze) oder <c>bilanz</c> (eine Ressource ist im Minus). <c>Betrifft</c>: die Teile der Auswahl, um die es geht.</summary>
public sealed record Verstoss(string Art, string Text, IReadOnlyList<string> Betrifft, string? Regel = null, string? Ressource = null);

/// <summary>Was eine Ressource in der Auswahl macht: bereit, verbraucht (als positive Zahl), frei = bereit − verbraucht.</summary>
public sealed record Bilanzzeile(decimal Bereit, decimal Verbraucht, decimal Frei);

/// <summary>Ginge dieses Teil zusätzlich in die Auswahl? Bei Nein: die Verstösse, die es neu verursachen würde.</summary>
public sealed record Waehlbar(string Id, bool Ok, IReadOnlyList<Verstoss> Gruende);

/// <summary>
/// Das Ergebnis. <c>Zulaessig</c>: kein Verbot, keine Grenze und keine Ressource im Minus verletzt. <c>Vollstaendig</c>: nichts verlangt, das fehlt.
/// Eine unvollständige Auswahl kann zulässig sein (es fehlt nur noch etwas), eine unzulässige nicht ohne Änderung.
/// </summary>
public sealed record Ergebnis(bool Zulaessig, bool Vollstaendig, IReadOnlyList<Verstoss> Verstoesse, IReadOnlyList<Verstoss> Fehlt,
    IReadOnlyDictionary<string, Bilanzzeile> Bilanz, IReadOnlyList<Waehlbar>? Waehlbar = null);

public static class Pruefer
{
    /// <summary>
    /// Die Auswahl gegen die Regeln prüfen. Mit <paramref name="kandidaten"/> sagt das Ergebnis zusätzlich zu jedem, ob es noch dazugehen könnte:
    /// es geht nicht, wenn die Auswahl damit einen Verstoss bekäme, den sie vorher nicht hatte. Was verlangt ist und fehlt, sperrt kein Teil.
    /// </summary>
    public static Ergebnis Pruefe(Definition def, IEnumerable<Zeile> auswahl, IEnumerable<Teil>? kandidaten = null)
    {
        var zeilen = Zusammen(auswahl);
        var ergebnis = Eine(def, zeilen);
        if (kandidaten is null) return ergebnis;

        var vorher = ergebnis.Verstoesse.Select(Schluessel).ToHashSet();
        var liste = new List<Waehlbar>();
        foreach (var k in kandidaten)
        {
            var mit = Zusammen(zeilen.Append(new Zeile(k, 1)));
            var neu = Eine(def, mit).Verstoesse.Where(v => !vorher.Contains(Schluessel(v))).ToList();
            liste.Add(new Waehlbar(k.Id, neu.Count == 0, neu));
        }
        return ergebnis with { Waehlbar = liste };
    }

    static string Schluessel(Verstoss v) => v.Art + "|" + (v.Regel ?? v.Ressource);

    /// <summary>Dasselbe Teil mehrfach gewählt ist ein Teil mit der Summe der Mengen.</summary>
    static List<Zeile> Zusammen(IEnumerable<Zeile> auswahl) =>
        auswahl.Where(z => z.Menge > 0).GroupBy(z => z.Teil.Id).Select(g => new Zeile(g.First().Teil, g.Sum(z => z.Menge))).ToList();

    static Ergebnis Eine(Definition def, List<Zeile> zeilen)
    {
        var verstoesse = new List<Verstoss>();
        var fehlt = new List<Verstoss>();

        var bilanz = Bilanz(zeilen);
        foreach (var (res, b) in bilanz.OrderBy(kv => kv.Key, StringComparer.Ordinal))
            if (b.Frei < 0)
                verstoesse.Add(new Verstoss("bilanz", $"{res}: {Anzeige(b.Verbraucht)} verbraucht, nur {Anzeige(b.Bereit)} bereit.",
                    zeilen.Where(z => z.Teil.Ressourcen.TryGetValue(res, out var m) && m < 0).Select(z => z.Teil.Id).Distinct().ToList(), Ressource: res));

        foreach (var r in def.Alle)
        {
            if (r.Dann is not { } folge) continue;
            var beleg = new HashSet<string>();
            if (r.Wenn is { } wenn && !Gilt(wenn, zeilen, bilanz, beleg)) continue;

            var passend = zeilen.Where(z => Passt(folge.Selektor, z.Teil)).ToList();
            var menge = passend.Sum(z => z.Menge);
            var betrifft = passend.Select(z => z.Teil.Id).Concat(beleg).Distinct().ToList();
            var text = string.IsNullOrWhiteSpace(r.Text) ? $"Regel {r.Id}" : r.Text!;
            switch (folge.Art)
            {
                case "verbietet" when menge > 0: verstoesse.Add(new Verstoss("regel", text, betrifft, r.Id)); break;
                case "begrenzt" when folge.Hoechstens is { } h && menge > h: verstoesse.Add(new Verstoss("regel", text, betrifft, r.Id)); break;
                case "verlangt" when menge < (folge.Mindestens ?? 1): fehlt.Add(new Verstoss("regel", text, beleg.ToList(), r.Id)); break;
            }
        }
        return new Ergebnis(verstoesse.Count == 0, fehlt.Count == 0, verstoesse, fehlt, bilanz);
    }

    /// <summary>Je Ressource, die in der Auswahl vorkommt: bereit (Summe der positiven Mengen), verbraucht (der negativen, als positive Zahl), frei.</summary>
    static Dictionary<string, Bilanzzeile> Bilanz(List<Zeile> zeilen)
    {
        var bereit = new Dictionary<string, decimal>(); var verbraucht = new Dictionary<string, decimal>();
        foreach (var z in zeilen)
            foreach (var (res, m) in z.Teil.Ressourcen)
            {
                bereit.TryAdd(res, 0); verbraucht.TryAdd(res, 0);
                if (m > 0) bereit[res] += m * z.Menge; else verbraucht[res] += -m * z.Menge;
            }
        return bereit.Keys.ToDictionary(k => k, k => new Bilanzzeile(bereit[k], verbraucht[k], bereit[k] - verbraucht[k]));
    }

    /// <summary>Trifft die Bedingung zu? <paramref name="beleg"/> sammelt die Teile, die sie wahr machen (für die Meldung).</summary>
    static bool Gilt(Bedingung b, List<Zeile> zeilen, Dictionary<string, Bilanzzeile> bilanz, HashSet<string> beleg)
    {
        switch (b.Art)
        {
            case "hat":
            {
                var passend = zeilen.Where(z => Passt(b.Selektor, z.Teil)).ToList();
                var ok = passend.Sum(z => z.Menge) >= (b.Wert is { } w ? w : 1);
                if (ok) foreach (var z in passend) beleg.Add(z.Teil.Id);
                return ok;
            }
            case "anzahl":
            {
                var passend = zeilen.Where(z => Passt(b.Selektor, z.Teil)).ToList();
                var ok = Vergleich(passend.Sum(z => z.Menge), b.Vergleich, b.Wert);
                if (ok) foreach (var z in passend) beleg.Add(z.Teil.Id);
                return ok;
            }
            case "summe":
            {
                var passend = zeilen.Where(z => Passt(b.Selektor, z.Teil)).ToList();
                decimal summe = 0;
                foreach (var z in passend) if (Zahl(z.Teil.Wert(b.Attribut ?? "")) is { } v) summe += v * z.Menge;
                var ok = Vergleich(summe, b.Vergleich, b.Wert);
                if (ok) foreach (var z in passend) beleg.Add(z.Teil.Id);
                return ok;
            }
            case "bilanz":
            {
                // Eine Ressource, die in der Auswahl nicht vorkommt, hat die Bilanz 0
                var frei = bilanz.TryGetValue(b.Ressource ?? "", out var z) ? z.Frei : 0;
                return Vergleich(frei, b.Vergleich, b.Wert);
            }
            case "nicht":
                return b.Teile is { Count: 1 } && !Gilt(b.Teile[0], zeilen, bilanz, new HashSet<string>());
            case "und":
            {
                var gesammelt = new HashSet<string>();
                foreach (var t in b.Teile ?? []) if (!Gilt(t, zeilen, bilanz, gesammelt)) return false;
                beleg.UnionWith(gesammelt);
                return b.Teile is { Count: > 0 };
            }
            case "oder":
                foreach (var t in b.Teile ?? [])
                {
                    var gesammelt = new HashSet<string>();
                    if (Gilt(t, zeilen, bilanz, gesammelt)) { beleg.UnionWith(gesammelt); return true; }
                }
                return false;
            default:
                return false;
        }
    }

    /// <summary>Passt das Teil auf den Selektor? Knoten: er steht im Pfad des Teils. Attribut: der Wert des Teils vergleicht sich wie verlangt
    /// (beide Zahlen: als Zahlen, sonst gleich oder ungleich ohne Beachtung der Gross- und Kleinschreibung; andere Vergleiche nur für Zahlen).</summary>
    public static bool Passt(Selektor? s, Teil t)
    {
        if (s is null) return true;
        if (!string.IsNullOrEmpty(s.Knoten) && !t.Pfad.Contains(s.Knoten)) return false;
        if (string.IsNullOrEmpty(s.Attribut)) return true;
        var ist = t.Wert(s.Attribut);
        if (ist is null) return false;
        var soll = s.Wert ?? "";
        if (Zahl(ist) is { } a && Zahl(soll) is { } b) return Vergleich(a, s.Vergleich, b);
        var gleich = string.Equals(ist, soll, StringComparison.OrdinalIgnoreCase);
        return s.Vergleich switch { "=" => gleich, "!=" => !gleich, _ => false };
    }

    static bool Vergleich(decimal links, string? op, decimal? rechts) => rechts is { } r && op switch
    {
        "=" => links == r, "!=" => links != r, ">" => links > r, ">=" => links >= r, "<" => links < r, "<=" => links <= r, _ => false,
    };

    static decimal? Zahl(string? text) =>
        decimal.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? d : null;

    static string Anzeige(decimal d) => d.ToString("0.##", CultureInfo.InvariantCulture);
}
