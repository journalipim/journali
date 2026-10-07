using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Demo (07.10.2026): <c>JOURNALI_DEMO=1</c> macht eine Instanz zur öffentlichen Demo. Wer sie aufruft, arbeitet ohne Anmeldung als Anwender
/// <see cref="Anwender"/> mit der Rolle <see cref="Rolle"/>: pflegen, modellieren, freigeben — aber keine Plugins, Jobs, Skripte, Speicher, Team
/// (KI-Schlüssel), Anwender und Rollen. Das eigene Konto (Passwort, API-Token), Anmelden und Einrichten sind gesperrt (<see cref="Gesperrt"/>).
/// <para>Ist das Journal leer, legt <see cref="Einrichten"/> einen erfundenen Beispielkatalog an — über denselben Schreibweg wie jede Pflege
/// (<see cref="Catalog.WithBatch{TResult}"/>, <see cref="Commands"/>), danach Rolle und Anwender. Zurückgesetzt wird von aussen: der Betrieb
/// startet die Demo täglich mit leerer Datenbank neu, und dieser Server legt alles wieder an. Ein Weg, das Journal zu leeren, gibt es nicht.</para>
/// <para>Grösse der Uploads: <c>JOURNALI_UPLOAD_MB</c> im Betrieb der Demo, nicht hier.</para>
/// </summary>
public static class Demo
{
    /// <summary>Gilt die Demo? Gesetzt beim Start aus <c>JOURNALI_DEMO</c>.</summary>
    public static bool An { get; set; }

    public const string Anwender = "demo";
    public const string Rolle = "demo";
    public static readonly string[] Rechte = [Rights.Read, Rights.Write, Rights.Retire, Rights.Release, Rights.Model, Rights.Download];

    /// <summary>Steht im Hinweis hinter „Testversion“, solange die Demo gilt.</summary>
    public static readonly Dictionary<string, string> Hinweis = new()
    {
        ["de"] = "Diese Demo wird täglich zurückgesetzt; was hier eingegeben wird, sehen alle Besucher.",
        ["en"] = "This demo is reset every day; whatever is entered here is visible to all visitors.",
    };

    /// <summary>In der Demo gesperrt, mit jedem Recht: das eigene Konto (Passwort, Token anlegen und löschen), Anmelden und Einrichten.</summary>
    public static bool Gesperrt(string path, string method)
    {
        var p = path.ToLowerInvariant();
        if (p.StartsWith("/api/auth/password") || p.StartsWith("/api/auth/login") || p.StartsWith("/api/auth/setup") || p.StartsWith("/api/auth/claim")) return true;
        return p.StartsWith("/api/auth/tokens") && method is not ("GET" or "HEAD");
    }

    /// <summary>Wer ohne Sitzung und ohne Token fragt: in der Demo der Anwender <see cref="Anwender"/>, solange es ihn gibt.</summary>
    public static (string User, string Role)? Besucher(Catalog c) =>
        c.Lesen((_, _) => c.Users.All.GetValueOrDefault(Anwender)) is { Enabled: true } u ? (u.Key, u.Role) : null;

    /// <summary>Beim Start: der Beispielkatalog (nur in ein leeres Journal), dann Rolle und Anwender. Liefert die Zahl der geschriebenen Einträge.</summary>
    public static int Einrichten(Catalog c)
    {
        var n = 0;
        var leer = c.Lesen((_, t) => !t.Nodes.Values.Any(x => x.Role == Roles.Product));
        if (leer) n += Beispielkatalog(c);
        var rolle = c.Lesen((_, _) => c.Users.Roles.GetValueOrDefault(Rolle));
        if (rolle is null || !rolle.Rights.ToHashSet().SetEquals(Rechte))
            n += c.With((_, _, write) => { write(Anwender, Users.RoleStream + Rolle, Types.RoleDefined, new RoleDefined("Demo", Rechte), null); return 1; });
        var team = c.Lesen((_, _) => c.Teams.Get(Model.InitTeam)) is null ? null : Model.InitTeam;
        var anwender = c.Lesen((_, _) => c.Users.All.GetValueOrDefault(Anwender));
        if (anwender is null || anwender.Role != Rolle || !anwender.Enabled || anwender.Team != team)
            n += c.With((_, _, write) => { write(Anwender, Auth.Stream + Anwender, Types.UserDefined, new UserDefined("Demo", null, Rolle, true, team), null); return 1; });
        return n;
    }

    // ---- Beispielkatalog: Leuchten und Leuchtmittel, erfunden; die Zahlen sind plausibel, nicht gemessen

    private static readonly (string De, string En, (string De, string En)[] Formen)[] Bereiche =
    [
        ("Innenleuchten", "Indoor luminaires", [("Deckenleuchten", "Ceiling lights"), ("Wandleuchten", "Wall lights"), ("Tischleuchten", "Table lamps"), ("Pendelleuchten", "Pendant lights")]),
        ("Aussenleuchten", "Outdoor luminaires", [("Wegeleuchten", "Path lights"), ("Strahler", "Floodlights")]),
        ("Leuchtmittel", "Light sources", [("LED-Lampen", "LED lamps")]),
    ];

    private static readonly (string De, string En)[] Formen = [("rund", "round"), ("eckig", "square"), ("flach", "flat"), ("oval", "oval"), ("schmal", "slim"), ("breit", "wide")];
    private static readonly string[] Farben = ["white", "black", "anthracite", "silver", "gold", "grey"];

    public static int Beispielkatalog(Catalog c) => c.WithBatch(Anwender, "demo", (model, tree, write) =>
    {
        var n = 0;
        Entry W(string stream, string type, object payload) { n++; return write(Anwender, stream, type, payload, "demo"); }
        var ctx = new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Write = W };
        string Id(Outcome o) => o.Error is null ? o.Entry!.Stream : throw new InvalidOperationException("Demo: " + o.Error);
        void Wert(string id, string attr, string? locale, string value) { if (Commands.SetAttribute(ctx, id, attr, locale, null, value, null).Error is { } e) throw new InvalidOperationException($"Demo: {attr} — {e}"); }

        // Modell: Einheiten, Listen, eine Gruppe Lichttechnik
        foreach (var u in new UnitDefinition[]
        {
            new("W", Labels.Of("Watt", "watt"), "power", 1),
            new("lm", Labels.Of("Lumen", "lumen"), "luminous_flux", 1),
            new("K", Labels.Of("Kelvin", "kelvin"), "colour_temperature", 1),
            new("h", Labels.Of("Stunden", "hours"), "time", 1),
        })
            if (!model.Units.ContainsKey(u.Key)) W(Model.UnitStream + u.Key, Types.UnitDefined, u);
        void Liste(string key, string de, string en, (string Key, string De, string En)[] werte)
        {
            if (model.Lists.ContainsKey(key)) return;
            W(Model.ListStream + key, Types.ListDefined, new ListDefinition(key, Labels.Of(de, en)));
            var i = 0;
            foreach (var v in werte) W(Model.ListStream + key, Types.ListValueDefined, new ListValueDefinition(v.Key, Labels.Of(v.De, v.En), null, ++i));
        }
        Liste("socket", "Sockel", "Socket", [("e27", "E27", "E27"), ("e14", "E14", "E14"), ("gu10", "GU10", "GU10"), ("g9", "G9", "G9"), ("led", "LED fest verbaut", "Integrated LED")]);
        Liste("protection", "Schutzart", "Protection rating", [("ip20", "IP20", "IP20"), ("ip44", "IP44", "IP44"), ("ip54", "IP54", "IP54"), ("ip65", "IP65", "IP65")]);
        Liste("energy_class", "Energieeffizienzklasse", "Energy efficiency class", "ABCDEFG".Select(x => (x.ToString().ToLowerInvariant(), x.ToString(), x.ToString())).ToArray());
        if (!model.Groups.ContainsKey("lighting")) W(Model.GroupStream + "lighting", Types.AttributeGroupDefined, new AttributeGroupDefinition("lighting", Labels.Of("Lichttechnik", "Lighting")));
        foreach (var a in new AttributeDefinition[]
        {
            new("power", Labels.Of("Leistung", "Power"), AttributeTypes.Decimal, Unit: "W", Group: "lighting"),
            new("luminous_flux", Labels.Of("Lichtstrom", "Luminous flux"), AttributeTypes.Integer, Unit: "lm", Group: "lighting"),
            new("colour_temperature", Labels.Of("Farbtemperatur", "Colour temperature"), AttributeTypes.Integer, Unit: "K", Group: "lighting"),
            new("socket", Labels.Of("Sockel", "Socket"), AttributeTypes.Enum, Group: "lighting", List: "socket"),
            new("protection", Labels.Of("Schutzart", "Protection rating"), AttributeTypes.Enum, Group: "lighting", List: "protection"),
            new("dimmable", Labels.Of("dimmbar", "Dimmable"), AttributeTypes.Boolean, Group: "lighting"),
            new("energy_class", Labels.Of("Energieeffizienzklasse", "Energy efficiency class"), AttributeTypes.Enum, Group: "lighting", List: "energy_class"),
            new("lifetime", Labels.Of("Lebensdauer", "Lifetime"), AttributeTypes.Integer, Unit: "h", Group: "lighting"),
        })
            if (!model.Attributes.ContainsKey(a.Key)) W(Model.AttributeStream + a.Key, Types.AttributeDefined, a);

        // Baum: Bereiche → Formen der Leuchte → Produkte mit Farbvarianten
        var zufall = new Random(7);
        var nummer = 1000;
        foreach (var (bereichDe, bereichEn, formen) in Bereiche)
        {
            var bereich = Id(Commands.CreateGroup(ctx, Model.RootNode, Labels.Of(bereichDe, bereichEn)));
            Id(Commands.AttachGroups(ctx, bereich, ["lighting"]));
            foreach (var (formDe, formEn) in formen)
            {
                var gruppe = Id(Commands.CreateGroup(ctx, bereich, Labels.Of(formDe, formEn)));
                var aussen = bereichDe == "Aussenleuchten";
                var lampe = bereichDe == "Leuchtmittel";
                var einzahlDe = formDe.TrimEnd('n'); var einzahlEn = formEn.TrimEnd('s');
                for (var i = 0; i < 6; i++)
                {
                    var (fDe, fEn) = Formen[i % Formen.Length];
                    var groesse = lampe ? 0 : 20 + 10 * zufall.Next(1, 6);
                    var watt = lampe ? new[] { 4, 5, 7, 9, 11, 13 }[i] : 8 + 4 * zufall.Next(1, 8);
                    var kelvin = new[] { 2700, 3000, 4000 }[zufall.Next(3)];
                    var produkt = Id(Commands.CreateProduct(ctx, gruppe, lampe ? ["socket"] : ["color"]));   // Lampen je Sockel, Leuchten je Farbe
                    Wert(produkt, "name", "de", lampe ? $"LED-Lampe {watt} W {fDe}" : $"{einzahlDe} {fDe} {groesse} cm");
                    Wert(produkt, "name", "en", lampe ? $"LED lamp {watt} W {fEn}" : $"{einzahlEn} {fEn} {groesse} cm");
                    Wert(produkt, "description", "de", $"<p>{(lampe ? "LED-Lampe" : einzahlDe)} in {fDe}er Form mit {watt} W und {kelvin} K{(aussen ? " für den Aussenbereich" : "")}. {(lampe ? "Ersetzt eine herkömmliche Glühlampe." : "Gehäuse aus Aluminium, Abdeckung aus Kunststoff.")}</p>");
                    Wert(produkt, "description", "en", $"<p>{(lampe ? "LED lamp" : einzahlEn)} in a {fEn} shape with {watt} W and {kelvin} K{(aussen ? " for outdoor use" : "")}. {(lampe ? "Replaces a conventional incandescent lamp." : "Aluminium housing, plastic cover.")}</p>");
                    Wert(produkt, "power", null, watt.ToString(System.Globalization.CultureInfo.InvariantCulture));
                    Wert(produkt, "luminous_flux", null, (watt * (95 + zufall.Next(30))).ToString());
                    Wert(produkt, "colour_temperature", null, kelvin.ToString());
                    if (!lampe) Wert(produkt, "socket", null, aussen ? "led" : new[] { "e27", "gu10", "led", "g9" }[zufall.Next(4)]);
                    Wert(produkt, "protection", null, aussen ? new[] { "ip44", "ip54", "ip65" }[zufall.Next(3)] : "ip20");
                    Wert(produkt, "dimmable", null, zufall.Next(3) > 0 ? "true" : "false");
                    Wert(produkt, "energy_class", null, new[] { "c", "d", "e", "f" }[zufall.Next(4)]);
                    Wert(produkt, "lifetime", null, (15000 + 5000 * zufall.Next(5)).ToString());
                    Id(Commands.SetStatus(ctx, produkt, i == 5 ? "draft" : "active"));
                    var knoten = new List<string>();
                    if (lampe)
                        foreach (var sockel in new[] { "e27", "e14", "gu10" }.Take(2 + zufall.Next(2)))
                            knoten.Add(Id(Commands.CreateVariant(ctx, produkt, new() { ["socket"] = sockel })));
                    else
                        foreach (var farbe in Farben.OrderBy(_ => zufall.Next()).Take(2 + zufall.Next(2)))
                            knoten.Add(Id(Commands.CreateVariant(ctx, produkt, new() { ["color"] = farbe })));
                    foreach (var k in knoten)
                    {
                        nummer++;
                        Wert(k, Model.SkuAttribute, null, $"DL-{nummer}");
                        Wert(k, "ean", null, Ean($"4012345{nummer:D5}"));
                        Wert(k, "weight", null, (lampe ? 0.05m + 0.01m * zufall.Next(5) : 0.4m + 0.1m * zufall.Next(1, 20)).ToString(System.Globalization.CultureInfo.InvariantCulture));
                    }
                }
            }
        }
        return n;
    });

    /// <summary>EAN-13 aus zwölf Ziffern: die Prüfziffer dazu.</summary>
    public static string Ean(string zwoelf)
    {
        var summe = 0;
        for (var i = 0; i < 12; i++) summe += (zwoelf[i] - '0') * (i % 2 == 0 ? 1 : 3);
        return zwoelf + ((10 - summe % 10) % 10);
    }
}
