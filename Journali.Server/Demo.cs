using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using System.Text.Json;

namespace Journali.Server;

/// <summary>
/// Demo (07.10.2026): <c>JOURNALI_DEMO=1</c> macht eine Instanz zur öffentlichen Demo. Wer sie aufruft, meldet sich als Anwender
/// <see cref="Anwender"/> mit dem Passwort <see cref="Passwort"/> an (die Anmeldeseite nennt beides) und arbeitet mit der Rolle <see cref="Rolle"/>: ansehen, Werte pflegen, freigeben — das Modell, die Einstellungen und die Profile der
/// Plugins sieht man, speichert und legt aber nichts davon an (Rolle ohne Recht model, dazu <see cref="Gesperrt"/>); keine Plugins, Jobs,
/// Skripte, Speicher, Team (KI-Schlüssel), Anwender und Rollen. Das eigene Konto (Passwort, API-Token) und Einrichten sind gesperrt; Abmelden geht (<see cref="Gesperrt"/>).
/// <para>Ist das Journal leer, legt <see cref="Einrichten"/> einen erfundenen Beispielkatalog an — über denselben Schreibweg wie jede Pflege
/// (<see cref="Catalog.WithBatch{TResult}"/>, <see cref="Commands"/>), danach Rolle und Anwender. Zurückgesetzt wird von aussen: der Betrieb
/// startet die Demo täglich mit leerer Datenbank neu, und dieser Server legt alles wieder an. Ein Weg, das Journal zu leeren, gibt es nicht.</para>
/// <para>Bilder zeichnet <see cref="DemoBilder"/>; sie kommen über den Medienspeicher und <see cref="Types.MediaCreated"/> wie hochgeladene.</para>
/// </summary>
public static class Demo
{
    /// <summary>Gilt die Demo? Gesetzt beim Start aus <c>JOURNALI_DEMO</c>.</summary>
    public static bool An { get; set; }

    public const string Anwender = "demo";
    public const string Rolle = "demo";
    /// <summary>Das Passwort des Anwenders demo — öffentlich, die Anmeldeseite der Demo nennt es; ändern lässt es sich in der Demo nicht.</summary>
    public const string Passwort = "demo";
    public static readonly string[] Rechte = [Rights.Read, Rights.Write, Rights.Retire, Rights.Release, Rights.Download];

    /// <summary>Steht im Hinweis hinter „Testversion“, solange die Demo gilt.</summary>
    public static readonly Dictionary<string, string> Hinweis = new()
    {
        ["de"] = "Diese Demo wird täglich zurückgesetzt; was hier eingegeben wird, sehen alle Besucher.",
        ["en"] = "This demo is reset every day; whatever is entered here is visible to all visitors.",
    };

    /// <summary>In der Demo ausgeschaltet: Zugänge (Dateisystem des Servers, fremde Systeme) und die Importe aus fremden Systemen (brauchen
    /// einen Zugang; ixp ist eine interne Schnittstelle). ETIM bleibt an, mit einer fest zugewiesenen Klasse (<see cref="Etim"/>).</summary>
    public static readonly string[] OhnePlugins = ["driver", "ixp", "solr"];

    /// <summary>
    /// In der Demo gesperrt, mit jedem Recht: das eigene Konto (Passwort, Token anlegen und löschen), Einrichten, die Beschreibung der Schnittstelle; Hochladen und
    /// Holen von Medien; Workflows und Vorschau-Presets ändern, Vorschauen und Abmessungen von Hand anstossen; Zugänge und das Dateisystem;
    /// Daten der Plugins schreiben (Profile, Layouts — nur die eigene Einstellung <c>settings</c> eines Plugins bleibt) und ihre Geheimnisse
    /// (Schlüssel am Profil); Knoten und Medien zurückziehen, Klassifikationen zurückziehen; der JSON-Import. Übergänge am Knoten bleiben,
    /// ebenso Rückgängig und das Lesen. Stapel prüft <see cref="StapelGesperrt"/>.
    /// </summary>
    public static bool Gesperrt(string path, string method)
    {
        var p = path.ToLowerInvariant().TrimEnd('/');
        var lesen = method is "GET" or "HEAD" or "OPTIONS";
        if (p.StartsWith("/api/auth/password") || p.StartsWith("/api/auth/setup") || p.StartsWith("/api/auth/claim")) return true;
        if (p.StartsWith("/api/auth/tokens")) return !lesen;
        if (p == "/api/openapi.json") return true;   // die Beschreibung der Schnittstelle: ohne API-Token nutzt sie in der Demo niemand (07.10.2026)
        if (p is "/api/media" or "/api/media/fetch" or "/api/media/derive" || p.StartsWith("/api/media/blob/") || p.StartsWith("/api/media/probe")) return !lesen;
        if (p.StartsWith("/api/media/presets")) return !lesen;
        if (p.StartsWith("/api/workflows/") && p != "/api/workflows/applicable") return !lesen;
        if (p.StartsWith("/api/drivers/") || p.StartsWith("/api/files")) return true;
        if (p is "/api/nodes/import" or "/api/classification/retire") return !lesen;
        if (method == "DELETE" && (p.StartsWith("/api/nodes/") || p.StartsWith("/api/media/")) && p.Count(ch => ch == '/') == 3) return true;   // zurückziehen
        if (p.StartsWith("/api/plugins/") && p.Contains("/secrets")) return !lesen;
        // Daten der Plugins, auch die Einstellungen: sie gelten für alle Besucher (07.10.2026; vorher blieb settings offen)
        if (p.StartsWith("/api/plugins/") && p.Contains("/data")) return !lesen;
        if (p.StartsWith("/api/plugins/") && p.EndsWith("/run")) return true;   // keinen Prozess eines Plugins starten
        if (p.StartsWith("/api/media/") && p.EndsWith("/thumb")) return !lesen;   // keine Vorschaubilder überschreiben — am Eingabefilter vorbei
        if (p == "/api/auth/me/prefs") return !lesen;   // Ansicht und Sprache von demo teilen sich alle Besucher
        return p == "/api/drivers" && !lesen;
    }

    /// <summary>
    /// Einstieg der Demo (10.10.2026): <c>JOURNALI_DEMO_EINSTIEG</c> nennt eine Seite mit Anleitung und Bedingungen. Wer eine Seite der Demo
    /// aufruft, ohne von dort zu kommen, wird dorthin umgeleitet; ihr Link auf die Demo trägt den Parameter <see cref="EinstiegParameter"/>
    /// (<c>?einstieg</c>). Der Parameter oder ein Referrer mit dem Host der Seite setzt das Cookie <see cref="EinstiegCookie"/> für einen Tag, danach
    /// gilt die Demo ohne Umweg; eine Sitzung genügt ebenso. Kein Schutz: wer den Parameter kennt, kommt direkt herein — die Umleitung führt den
    /// gewöhnlichen Besucher über die Seite. Der Referrer allein reicht nicht, ein Browser darf ihn weglassen. Die API wird nie umgeleitet.
    /// Ohne die Variable gibt es keine Umleitung.
    /// </summary>
    public static string? Einstieg { get; set; }
    public const string EinstiegParameter = "einstieg";
    public const string EinstiegCookie = "journali.demo";

    /// <summary>Was mit einer Anfrage geschieht: null — weiter; sonst die Adresse, auf die umgeleitet wird. <paramref name="merken"/>: das Cookie setzen.</summary>
    public static string? EinstiegFuer(HttpRequest r, out bool merken)
    {
        merken = false;
        if (!An || string.IsNullOrWhiteSpace(Einstieg) || !HttpMethods.IsGet(r.Method) && !HttpMethods.IsHead(r.Method)) return null;
        var pfad = r.Path.Value ?? "/";
        // nur Seiten der Oberfläche: keine API, keine Dateien (Skripte, Bilder, Manifest — sie lädt die Seite selbst)
        if (r.Path.StartsWithSegments("/api") || Path.HasExtension(pfad)) return null;
        if (r.Query.ContainsKey(EinstiegParameter))
        {
            merken = true;
            var rest = string.Join("&", r.Query.Where(q => q.Key != EinstiegParameter).SelectMany(q => q.Value.Select(v => Uri.EscapeDataString(q.Key) + "=" + Uri.EscapeDataString(v ?? ""))));
            return pfad + (rest.Length > 0 ? "?" + rest : "");   // ohne den Parameter: die Adresse in der Leiste bleibt sauber
        }
        if (r.Cookies.ContainsKey(EinstiegCookie) || r.Cookies.ContainsKey(Auth.Cookie)) return null;
        if (Uri.TryCreate(r.Headers.Referer.ToString(), UriKind.Absolute, out var von) && Uri.TryCreate(Einstieg, UriKind.Absolute, out var seite)
            && string.Equals(von.Host, seite.Host, StringComparison.OrdinalIgnoreCase))
        {
            merken = true;
            return null;
        }
        return Einstieg;
    }

    /// <summary>Die Umleitung als Schritt der Pipeline (<see cref="EinstiegFuer"/>).</summary>
    public static async Task Einstiegsweg(HttpContext ctx, Func<Task> next)
    {
        var ziel = EinstiegFuer(ctx.Request, out var merken);
        if (merken)
            ctx.Response.Cookies.Append(EinstiegCookie, "1", new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Lax, Secure = ctx.Request.IsHttps, Path = "/", Expires = DateTimeOffset.UtcNow.AddDays(1) });
        if (ziel is null) { await next(); return; }
        ctx.Response.Headers.CacheControl = "no-store";
        ctx.Response.Redirect(ziel);
    }

    /// <summary>
    /// Kontingent der Demo (07.10.2026): so viele zählende Einträge (Datenpflege) je Woche und Monat für das Init Team, also für alle Besucher
    /// zusammen. Die Demo startet jeden Tag mit leerem Journal, damit ist es ein Tageskontingent. Gesetzt wird es zuletzt beim Einrichten — eine
    /// Änderung der Grenzen lässt die Zählung neu beginnen, der Beispielkatalog zählt nicht mit. Die Startphase hebt es in der Demo nicht auf.
    /// </summary>
    public const int Kontingent = 500;

    /// <summary>Höchstens so viele Befehle je Stapel: Pflege ja, Massenbearbeitung und Import nein. 20 (07.10.2026, vorher 50): die Tabellenpflege
    /// speichert alle geänderten Zellen in einem Stapel — weniger hielte schon die gewöhnliche Pflege auf; ein Import über die API kommt nicht weit.</summary>
    public const int MaxStapel = 20;

    /// <summary>
    /// Kontingent je Absender (07.10.2026): so viele zählende Einträge (Datenpflege, Ausleitung) am Tag je Adresse des Besuchers — ein Einzelner,
    /// etwa mit einem Skript über die API, verbraucht so nicht das Tageskontingent aller (<see cref="Kontingent"/>). Gezählt wird im Speicher; die
    /// Demo startet jeden Tag neu. Hinter einem Proxy braucht es <c>JOURNALI_PROXY=1</c>, sonst ist jeder Besucher der Proxy.
    /// </summary>
    public const int KontingentJeAbsender = 100;
    /// <summary>Alle Einträge je Absender und Tag, auch die nicht zählenden (Rubriken, Verweise, Regeln …) — die Datenbank der Demo liegt im Speicher.</summary>
    public const int EintraegeJeAbsender = 1000;
    /// <summary>Der Journalkopf nach dem Einrichten: was bis dahin geschrieben ist (der Beispielkatalog), nimmt Rückgängig in der Demo nicht zurück.</summary>
    public static long Saatkopf { get; set; }
    /// <summary>Gehört der Eintrag mit dieser Nummer zum Beispielkatalog der Demo?</summary>
    public static bool Saat(long nummer) => An && nummer > 0 && nummer <= Saatkopf;
    /// <summary>Die Adresse des Besuchers der laufenden Anfrage — gesetzt von der Anfrage (Program.cs), gelesen im Schreibpfad.</summary>
    public static readonly AsyncLocal<string?> Absender = new();
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<(DateOnly Tag, string Absender), int> Gezaehlt = new();
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<(DateOnly Tag, string Absender), int> Alle = new();

    /// <summary>Darf dieser Eintrag noch geschrieben werden? Zählt, was zählt (Kinds), je Absender und Tag; ohne Absender (Start, Jobs) immer.</summary>
    public static bool Zaehle(string type)
    {
        if (Absender.Value is not { Length: > 0 } wer) return true;
        var heute = DateOnly.FromDateTime(DateTime.Now);
        foreach (var alt in Gezaehlt.Keys.Where(k => k.Tag != heute).ToList()) Gezaehlt.TryRemove(alt, out _);
        foreach (var alt in Alle.Keys.Where(k => k.Tag != heute).ToList()) Alle.TryRemove(alt, out _);
        if (Alle.AddOrUpdate((heute, wer), 1, (_, n) => n + 1) > EintraegeJeAbsender) return false;
        return !Kinds.Billable(null, type) || Gezaehlt.AddOrUpdate((heute, wer), 1, (_, n) => n + 1) <= KontingentJeAbsender;
    }

    /// <summary>Ein Stapel des Anwenders demo, der abgewiesen wird: mehr als <see cref="MaxStapel"/> Befehle oder ein Zurückziehen darin.</summary>
    public static bool StapelGesperrt(IReadOnlyCollection<string> befehle) =>
        befehle.Count > MaxStapel || befehle.Any(b => b is "node.retire" or "media.retire");

    /// <summary>
    /// Beim Start, nach den Plugins: der Beispielkatalog (nur in ein leeres Journal) mit Bildern, wenn ein Medienspeicher da ist; die Plugins
    /// aus <see cref="OhnePlugins"/> aus; dann Rolle und Anwender. Liefert die Zahl der geschriebenen Einträge und der neuen Bilder.
    /// </summary>
    public static (int Eintraege, int Bilder) Einrichten(Catalog c, IMediaStore? store = null, string? pluginDir = null, string? dataDir = null)
    {
        var n = 0; var bilder = 0;
        if (pluginDir is not null) n += PluginsEinschalten(c, pluginDir);
        var leer = c.Lesen((_, t) => !t.Nodes.Values.Any(x => x.Role == Roles.Product));
        var geo = new List<GeoText>();
        if (leer)
        {
            var wuensche = new List<(string Knoten, string Produkt, DemoBilder.Wunsch Wunsch)>();
            n += Beispielkatalog(c, wuensche, geo);
            if (store is not null) (n, bilder) = (n + Bilder(c, store, wuensche, out var neu), neu);
        }
        n += Etim(c);
        if (pluginDir is not null) n += Systemobjekte(c, pluginDir);
        n += GeoTexte(c, geo);
        if (pluginDir is not null) n += Gpc(c, pluginDir);
        n += Publikationsbaum(c);
        c.MaxPubTrees = 1;   // ein Publikationsbaum, wie eine Grenze des Tarifs: anlegen geht nicht, löschen sperrt Gesperrt (Knoten zurückziehen)
        foreach (var key in OhnePlugins)
            if (c.Lesen((_, _) => c.Plugins.All.GetValueOrDefault(key)) is { Enabled: true })
                n += c.With((_, _, write) => { write(Anwender, Plugins.Stream + key, Types.PluginDisabled, new PluginDisabled(), null); return 1; });
        var rolle = c.Lesen((_, _) => c.Users.Roles.GetValueOrDefault(Rolle));
        if (rolle is null || !rolle.Rights.ToHashSet().SetEquals(Rechte))
            n += c.With((_, _, write) => { write(Anwender, Users.RoleStream + Rolle, Types.RoleDefined, new RoleDefined("Demo", Rechte), null); return 1; });
        var team = c.Lesen((_, _) => c.Teams.Get(Model.InitTeam)) is null ? null : Model.InitTeam;
        var anwender = c.Lesen((_, _) => c.Users.All.GetValueOrDefault(Anwender));
        if (anwender is null || anwender.Role != Rolle || !anwender.Enabled || anwender.Team != team)
            n += c.With((_, _, write) => { write(Anwender, Auth.Stream + Anwender, Types.UserDefined, new UserDefined("Demo", null, Rolle, true, team), null); return 1; });
        if (dataDir is not null) Auth.PasswortSetzen(dataDir, Anwender, Passwort);   // Anmeldung mit demo / demo (Tresor, nicht im Journal)
        // zuletzt: das Kontingent — ab hier wird gezählt
        if (c.Lesen((_, _) => c.Teams.Get(Model.InitTeam)) is { } t && (t.EntriesWeek != Kontingent || t.EntriesMonth != Kontingent))
            n += c.With((_, _, write) => { write(Anwender, Teams.Stream + t.Key, Types.TeamDefined, new TeamDefined(t.Label, t.Note, t.MonthlyTokens, t.DailyTokens, t.Enabled, t.KeysFrom, t.IncludedTokens, t.Managers, t.Models, Kontingent, Kontingent), null); return 1; });
        return (n, bilder);
    }

    /// <summary>
    /// Alle Plugins mit dem Siegel von journali installiert und an — wer die Demo ansieht, darf keine einschalten. Ausgenommen sind
    /// <see cref="OhnePlugins"/> und, was beim ersten Lauf etwas aus dem Netz holt (<c>download</c>: Modelle, Sprachdaten). Ein Hinweis im
    /// Manifest (<c>acknowledge</c>) gilt in der Demo als vom Betreiber bestätigt.
    /// </summary>
    public static int PluginsEinschalten(Catalog c, string dir, bool auchFremde = false)
    {
        var n = 0;
        foreach (var m in PluginApi.NachAbhaengigkeit(PluginApi.Scan(dir).Values))
        {
            if (OhnePlugins.Contains(m.Key) || m.Raw.TryGetProperty("download", out _) || (!auchFremde && !m.Seal.Original)) continue;
            var stand = c.Lesen((_, _) => c.Plugins.All.GetValueOrDefault(m.Key));
            var hinweis = PluginApi.Hinweis(m.Raw);
            n += c.With((_, _, write) =>
            {
                var z = 0;
                if (stand is null) { write(Anwender, Plugins.Stream + m.Key, Types.PluginInstalled, new PluginInstalled(m.Version, m.Raw.GetRawText()), null); z++; }
                if (hinweis is { } h && stand?.Acknowledged != h.Version) { write(Anwender, Plugins.Stream + m.Key, Types.PluginAcknowledged, new PluginAcknowledged(h.Version, h.Text), null); z++; }
                if (stand is not { Enabled: true }) { write(Anwender, Plugins.Stream + m.Key, Types.PluginEnabled, new PluginEnabled(), null); z++; }
                return z;
            });
        }
        return n;
    }

    /// <summary>
    /// Die Bilder zu den Wünschen: jedes einmal zeichnen und in den Medienspeicher, dann in einem Stapel das Medium (gleicher Inhalt einmal)
    /// und die Relation image am Knoten; das Produkt bekommt das Bild seiner ersten Variante.
    /// </summary>
    public static int Bilder(Catalog c, IMediaStore store, List<(string Knoten, string Produkt, DemoBilder.Wunsch Wunsch)> wuensche, out int neu)
    {
        var abgelegt = new Dictionary<string, (string Sha, long Bytes)>();
        foreach (var w in wuensche.Select(x => x.Wunsch).DistinctBy(w => w.Name))
        {
            using var daten = new MemoryStream(DemoBilder.Png(w));
            abgelegt[w.Name] = store.PutAsync(daten, CancellationToken.None).GetAwaiter().GetResult();
        }
        var neueMedien = 0;
        var n = c.WithBatch(Anwender, "demo-bilder", (model, tree, write) =>
        {
            var z = 0;
            Entry W(string stream, string type, object payload) { z++; return write(Anwender, stream, type, payload, "demo-bilder"); }
            var ctx = new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Write = W };
            var produkte = new HashSet<string>();
            foreach (var (knoten, produkt, w) in wuensche)
            {
                var (sha, bytes) = abgelegt[w.Name];
                var medium = c.Media.BySha(sha)?.Id;
                if (medium is null) { medium = W(Ids.Media(), Types.MediaCreated, new MediaCreated(sha, bytes, "image/png", w.Name)).Stream; neueMedien++; }
                foreach (var an in produkte.Add(produkt) && produkt != knoten ? new[] { knoten, produkt } : [knoten])
                    if (Commands.CreateRelation(ctx, "image", an, medium).Error is { } e) throw new InvalidOperationException("Demo: Bild — " + e);
            }
            return z;
        });
        neu = neueMedien;
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

    /// <summary>Art der Zeichnung je Gruppe des Katalogs (<see cref="DemoBilder.Wunsch.Art"/>).</summary>
    private static string Art(string gruppeDe) => gruppeDe switch
    {
        "Deckenleuchten" => "decke", "Wandleuchten" => "wand", "Tischleuchten" => "tisch", "Pendelleuchten" => "pendel",
        "Wegeleuchten" => "weg", "Strahler" => "strahler", _ => "lampe",
    };

    /// <param name="bilder">bekommt je Variante den Wunsch nach ihrem Bild (mit ihrem Produkt) — gezeichnet wird ausserhalb der Sperre</param>
    /// <param name="geo">bekommt je Produkt seine GEO-Texte — geschrieben wird nach den Systemobjekten (<see cref="GeoTexte"/>)</param>
    public static int Beispielkatalog(Catalog c, List<(string Knoten, string Produkt, DemoBilder.Wunsch Wunsch)>? bilder = null, List<GeoText>? geo = null) => c.WithBatch(Anwender, "demo", (model, tree, write) =>
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
            new("power", Labels.Of("Leistung", "Power"), AttributeTypes.Decimal, Unit: "W", Group: "lighting", Inheritable: true),
            new("luminous_flux", Labels.Of("Lichtstrom", "Luminous flux"), AttributeTypes.Integer, Unit: "lm", Group: "lighting", Inheritable: true),
            new("colour_temperature", Labels.Of("Farbtemperatur", "Colour temperature"), AttributeTypes.Integer, Unit: "K", Group: "lighting", Inheritable: true),
            new("socket", Labels.Of("Sockel", "Socket"), AttributeTypes.Enum, Group: "lighting", Inheritable: true, List: "socket"),
            new("protection", Labels.Of("Schutzart", "Protection rating"), AttributeTypes.Enum, Group: "lighting", Inheritable: true, List: "protection"),
            new("dimmable", Labels.Of("dimmbar", "Dimmable"), AttributeTypes.Boolean, Group: "lighting", Inheritable: true),
            new("energy_class", Labels.Of("Energieeffizienzklasse", "Energy efficiency class"), AttributeTypes.Enum, Group: "lighting", Inheritable: true, List: "energy_class"),
            new("lifetime", Labels.Of("Lebensdauer", "Lifetime"), AttributeTypes.Integer, Unit: "h", Group: "lighting", Inheritable: true),
        })
            if (!model.Attributes.ContainsKey(a.Key)) W(Model.AttributeStream + a.Key, Types.AttributeDefined, a);
        // Die Beschreibung steht am Produkt und gilt für seine Varianten: in der Demo vererbbar (im Grundmodell nicht). Die Lichttechnik
        // ist es von Anfang an — ein Wert am Produkt gilt für die Varianten, bis eine einen eigenen hat (Datenblatt, Subitems-Tabelle).
        if (model.Attributes.GetValueOrDefault("description") is { Inheritable: false } beschreibung)
            W(Model.AttributeStream + "description", Types.AttributeDefined, beschreibung with { Inheritable = true });
        // Der Name einer Variante ist ihr eigener: der des Produkts mit dem Wert der Achse (Farbe, Sockel)
        void Variantenname(string id, string produktDe, string produktEn, string liste, string wert)
        {
            var l = model.Lists[liste].Values[wert].Label;
            Wert(id, "name", "de", $"{produktDe}, {l.GetValueOrDefault("de") ?? wert}");
            Wert(id, "name", "en", $"{produktEn}, {l.GetValueOrDefault("en") ?? wert}");
        }

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
                    var nameDe = lampe ? $"LED-Lampe {watt} W {fDe}" : $"{einzahlDe} {fDe} {groesse} cm";
                    var nameEn = lampe ? $"LED lamp {watt} W {fEn}" : $"{einzahlEn} {fEn} {groesse} cm";
                    Wert(produkt, "name", "de", nameDe);
                    Wert(produkt, "name", "en", nameEn);
                    Wert(produkt, "description", "de", $"<p>{(lampe ? "LED-Lampe" : einzahlDe)} in {fDe}er Form mit {watt} W und {kelvin} K{(aussen ? " für den Aussenbereich" : "")}. {(lampe ? "Ersetzt eine herkömmliche Glühlampe." : "Gehäuse aus Aluminium, Abdeckung aus Kunststoff.")}</p>");
                    Wert(produkt, "description", "en", $"<p>{(lampe ? "LED lamp" : einzahlEn)} in a {fEn} shape with {watt} W and {kelvin} K{(aussen ? " for outdoor use" : "")}. {(lampe ? "Replaces a conventional incandescent lamp." : "Aluminium housing, plastic cover.")}</p>");
                    Wert(produkt, "power", null, watt.ToString(System.Globalization.CultureInfo.InvariantCulture));
                    var lumen = watt * (95 + zufall.Next(30));
                    Wert(produkt, "luminous_flux", null, lumen.ToString());
                    Wert(produkt, "colour_temperature", null, kelvin.ToString());
                    if (!lampe) Wert(produkt, "socket", null, aussen ? "led" : new[] { "e27", "gu10", "led", "g9" }[zufall.Next(4)]);
                    var schutz = aussen ? new[] { "ip44", "ip54", "ip65" }[zufall.Next(3)] : "ip20";
                    Wert(produkt, "protection", null, schutz);
                    var dimmbar = zufall.Next(3) > 0;
                    Wert(produkt, "dimmable", null, dimmbar ? "true" : "false");
                    geo?.Add(GeoTexteVon(produkt, nameDe, nameEn, lampe ? "LED-Lampe" : einzahlDe, lampe ? "LED lamp" : einzahlEn, fDe, fEn, watt, lumen, kelvin, schutz, dimmbar, aussen));
                    Wert(produkt, "energy_class", null, new[] { "c", "d", "e", "f" }[zufall.Next(4)]);
                    Wert(produkt, "lifetime", null, (15000 + 5000 * zufall.Next(5)).ToString());
                    Id(Commands.SetStatus(ctx, produkt, i == 5 ? "draft" : "active"));
                    var knoten = new List<string>();
                    if (lampe)
                        foreach (var sockel in new[] { "e27", "e14", "gu10" }.Take(2 + zufall.Next(2)))
                        {
                            knoten.Add(Id(Commands.CreateVariant(ctx, produkt, new() { ["socket"] = sockel })));
                            Variantenname(knoten[^1], nameDe, nameEn, "socket", sockel);
                            bilder?.Add((knoten[^1], produkt, new DemoBilder.Wunsch("lampe", fDe, null, kelvin, sockel)));
                        }
                    else
                        foreach (var farbe in Farben.OrderBy(_ => zufall.Next()).Take(2 + zufall.Next(2)))
                        {
                            knoten.Add(Id(Commands.CreateVariant(ctx, produkt, new() { ["color"] = farbe })));
                            Variantenname(knoten[^1], nameDe, nameEn, "color", farbe);
                            bilder?.Add((knoten[^1], produkt, new DemoBilder.Wunsch(Art(formDe), fDe, farbe, kelvin)));
                        }
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

    // ---- ETIM (07.10.2026): eine Klasse fest zugewiesen, damit die Demo die Klassifikation zeigt, ohne dass jemand eine Freigabe lädt.
    // EC001959 „LED-lamp/Multi-LED“ (ETIM 10.0, Klassenversion 10, Gruppe EG000028) an der Gruppe LED-Lampen — nur die acht Merkmale, die der
    // Beispielkatalog führt, zugeordnet auf seine Attribute. Namen nur englisch (ETIM English Master): das ETIM-Modell steht unter ODC-BY 1.0
    // (etim-international.com/classification/license-info), die deutschen Bezeichnungen gehören ETIM Deutschland. Codes und Namen aus dem
    // ETIM-Viewer (viewer.etim-international.com/class/EC001959/10), Stand 07.10.2026.

    public const string EtimFreigabe = "10-demo";
    public const string EtimKlasse = "EC001959";

    private static readonly (string Code, string Typ, string Name, string Ziel, (string Code, string Name)[] Werte)[] EtimMerkmale =
    [
        ("EF011586", "Range", "Lamp power (W)", "power", []),
        ("EF011587", "Range", "Luminous flux (lm)", "luminous_flux", []),
        ("EF009346", "Range", "Colour temperature (K)", "colour_temperature", []),
        ("EF000042", "Alphanumeric", "Socket", "socket", [("EV000098", "E27"), ("EV000097", "E14"), ("EV001442", "GU10"), ("EV006795", "G9")]),
        ("EF005474", "Alphanumeric", "Degree of protection (IP)", "protection", [("EV006405", "IP20"), ("EV006418", "IP44"), ("EV006419", "IP54"), ("EV006421", "IP65")]),
        ("EF000137", "Logical", "Dimmable", "dimmable", []),
        ("EF017139", "Alphanumeric", "Energy efficiency class according to 2019/2015/EU", "energy_class",
            [("EV000896", "A"), ("EV000074", "B"), ("EV000084", "C"), ("EV000413", "D"), ("EV000647", "E"), ("EV000334", "F"), ("EV004701", "G")]),
        ("EF008342", "Numeric", "Average nominal lifetime (h)", "lifetime", []),
    ];

    private static Dictionary<string, string> En(string text) => new() { ["en"] = text };

    /// <summary>
    /// Die ETIM-Klasse der Demo: Freigabe, Klasse und Zuordnung als Daten des Plugins etim, wie das Plugin sie selbst schreibt, dann zugewiesen
    /// über <see cref="ClassificationApi.Assign"/> — derselbe Weg wie der Dialog. Nur, wenn etim an ist und noch keine Freigabe kennt.
    /// </summary>
    public static int Etim(Catalog c)
    {
        if (c.Lesen((_, _) => c.Plugins.All.GetValueOrDefault("etim")) is not { Enabled: true } plugin || plugin.Data.ContainsKey("release")) return 0;
        var gruppe = c.Lesen((_, t) => t.Nodes.Values.FirstOrDefault(n => n.Role == Roles.Group && n.Label.GetValueOrDefault("de") == "LED-Lampen")?.Id);
        if (gruppe is null) return 0;
        var info = new
        {
            key = EtimFreigabe, version = "10", variant = "demo", name = "ETIM 10.0", number = "10", classes = 1, features = EtimMerkmale.Length,
            languages = new[] { "en" }, all = false,
            source = "ETIM International (etim-international.com), ODC-BY 1.0 — Auszug: Klasse EC001959 mit den Merkmalen des Beispielkatalogs",
        };
        var klasse = new
        {
            code = EtimKlasse, version = 10, name = En("LED-lamp/Multi-LED"), synonyms = new Dictionary<string, string[]>(),
            group = new { code = "EG000028", name = En("Lamps") }, release = new { name = "ETIM 10.0", number = "10" },
            features = EtimMerkmale.Select((f, i) => new
            {
                code = f.Code, type = f.Typ, name = En(f.Name), order = i + 1, unit = (object?)null,
                values = f.Werte.Select(v => new { code = v.Code, name = En(v.Name) }).ToArray(),
            }).ToArray(),
        };
        var n = c.With((_, _, write) =>
        {
            foreach (var (name, wert) in new (string, object)[] { ("release:" + EtimFreigabe, info), ($"class:{EtimFreigabe}:{EtimKlasse}", klasse), ("map", EtimMerkmale.ToDictionary(f => f.Code, f => f.Ziel)), ("release", info) })
                write(Anwender, Plugins.Stream + "etim", Types.PluginDataSet, new PluginDataSet(name, System.Text.Json.JsonSerializer.Serialize(wert)), null);
            return 4;
        });
        // wie das Plugin: System, Klasse, Merkmale (neutral) — zugeordnete Merkmale kommen als vorhandene Attribute in die Gruppe der Klasse
        var system = new ClassificationApi.SystemSpec("class_etim", new() { ["de"] = "ETIM", ["en"] = "ETIM" }, "class_etim", new() { ["de"] = "ETIM-Klasse", ["en"] = "ETIM class" },
            ["etim_klasse", "etim_class_std"], "^ef\\d+$", "etim");
        var merkmale = EtimMerkmale.Select(f => new ClassificationApi.FeatureSpec(f.Code.ToLowerInvariant(), En(f.Name),
            f.Typ switch { "Numeric" => "decimal", "Logical" => "boolean", "Alphanumeric" => "enum", _ => "text" },
            Pattern: f.Typ == "Range" ? @"^\s*-?[\d.,]+(\s*(-|\.\.|…)\s*-?[\d.,]+)?\s*$" : null, PatternHint: f.Typ == "Range" ? "von - bis" : null,
            Values: f.Typ == "Alphanumeric" ? f.Werte.Select(v => new ClassificationApi.ValueSpec(v.Code, En(v.Name))).ToArray() : null,
            Classes: [EtimKlasse], Target: f.Ziel)).ToArray();
        var zaehler = 0;
        var antwort = c.With((model, tree, write) => ClassificationApi.Assign(new Ctx
        {
            Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Workflows = c.Workflows, Translations = c.Translations, Plugins = c.Plugins,
            Write = (stream, type, payload) => { zaehler++; return write(Anwender, stream, type, payload, null); },
        }, new ClassificationApi.AssignBody(gruppe, EtimKlasse, system, [new ClassificationApi.ClassSpec(EtimKlasse, En("LED-lamp/Multi-LED"), "Lamps")], merkmale), true));
        if (antwort.Error is { } fehler) throw new InvalidOperationException("Demo: ETIM — " + string.Format(fehler, antwort.Args ?? []));
        return n + zaehler;
    }

    /// <summary>Der Publikationsbaum der Demo (07.10.2026): „Online-Shop“ für den Kanal web, abgeleitet aus den Bereichen des Beispielkatalogs —
    /// je Produktgruppe eine Rubrik, jedes Produkt ein Verweis. Nur, solange es keinen Publikationsbaum gibt.</summary>
    public static int Publikationsbaum(Catalog c)
    {
        if (c.Lesen((_, t) => t.PubTrees.Any())) return 0;
        var kanal = c.Lesen((m, _) => m.Channels.ContainsKey("web") ? "web" : m.Channels.Keys.Order(StringComparer.Ordinal).FirstOrDefault());
        var bereiche = c.Lesen((_, t) => t.Nodes.Values.Where(x => x.Parent == Model.RootNode && x.Role == Roles.Group).Select(x => x.Id).ToList());
        if (kanal is null || bereiche.Count == 0) return 0;
        return c.WithBatch(Anwender, "demo-publikation", (model, tree, write) =>
        {
            var z = 0;
            var ctx = Kontext(c, model, tree, write, () => z++);
            var baum = Commands.CreateRubric(ctx, null, Labels.Of("Online-Shop", "Online shop"), "Online-Shop", kanal);
            if (baum.Error is { } e) throw new InvalidOperationException("Demo: Publikationsbaum — " + e);
            foreach (var bereich in bereiche)
                if (Commands.Derive(ctx, baum.Entry!.Stream, bereich, true, out _).Error is { } f) throw new InvalidOperationException("Demo: Publikationsbaum — " + f);
            return z;
        });
    }

    /// <summary>Das Skript, das die Systemobjekte der Plugins nennt — neben dem Server (im Image unter /app).</summary>
    public static string SystemSkript => Path.Combine(AppContext.BaseDirectory, "demo-system.mjs");
    private static readonly System.Text.Json.JsonSerializerOptions Web = new(System.Text.Json.JsonSerializerDefaults.Web);

    /// <summary>
    /// Die Systemobjekte der eingeschalteten Plugins (07.10.2026): was die Oberfläche beim Einschalten anlegt — Attributgruppe, Attribute, Einheiten, die
    /// Zuordnung des Plugins, die Anmeldung als Systemobjekte und die Gruppe an den Wurzeln —, legt in der Demo der Server an. Der Anwender demo darf das
    /// Modell nicht ändern, und jeder Besucher bekäme sonst die Rückfragen; die Oberfläche richtet in der Demo darum keine Plugins ein. Die Angaben
    /// kommen aus den Plugins selbst (<see cref="SystemSkript"/>). Was es schon gibt, bleibt.
    /// </summary>
    public static int Systemobjekte(Catalog c, string pluginDir)
    {
        using var doc = System.Text.Json.JsonDocument.Parse(SystemJson(pluginDir));
        var n = 0;
        foreach (var p in doc.RootElement.EnumerateArray())
        {
            var key = p.GetProperty("plugin").GetString()!;
            if (c.Lesen((_, _) => c.Plugins.All.GetValueOrDefault(key)) is not { Enabled: true } plugin) continue;
            string gruppe; var attribute = new List<string>();
            if (p.TryGetProperty("ensure", out var ens))
            {
                // ein Klassifikationssystem (gpc): Gruppe und Klassenattribut wie /api/classification/ensure, angemeldet über das System
                var spec = ens.Deserialize<ClassificationApi.SystemSpec>(Web)!;
                var a = c.With((model, tree, write) => ClassificationApi.Ensure(Kontext(c, model, tree, write, () => n++), new ClassificationApi.EnsureBody(spec), true));
                if (a.Error is { } f) throw new InvalidOperationException($"Demo: {key} — " + string.Format(f, a.Args ?? []));
                gruppe = a.Ok is ClassificationApi.Ensured e ? e.Group : spec.Group;
            }
            else
            {
                gruppe = p.GetProperty("group").GetProperty("key").GetString()!;
                var gLabel = p.GetProperty("group").GetProperty("label").Deserialize<Labels>(Web) ?? new();
                n += c.With((model, _, write) =>
                {
                    var z = 0;
                    var einheiten = new Dictionary<string, string>();   // Symbol → Schlüssel: vorhandene nehmen, sonst anlegen (wie ensureUnit)
                    foreach (var u in p.GetProperty("units").EnumerateArray())
                    {
                        var sym = u.GetProperty("symbol").GetString()!;
                        if (einheiten.ContainsKey(sym)) continue;
                        var da = model.Units.Values.FirstOrDefault(x => x.Key == sym || x.Key == sym.ToLowerInvariant() || x.Label.Values.Contains(sym));
                        var ukey = da?.Key ?? u.GetProperty("key").GetString()!;
                        if (da is null && !model.Units.ContainsKey(ukey))
                        {
                            write(Anwender, Model.UnitStream + ukey, Types.UnitDefined, new UnitDefinition(ukey, u.GetProperty("label").Deserialize<Labels>(Web) ?? Labels.Of(sym, sym),
                                u.GetProperty("quantity").GetString()!, u.GetProperty("factor").GetDecimal(), u.GetProperty("offset").GetDecimal()), null);
                            z++;
                        }
                        einheiten[sym] = ukey;
                    }
                    if (!model.Groups.ContainsKey(gruppe)) { write(Anwender, Model.GroupStream + gruppe, Types.AttributeGroupDefined, new AttributeGroupDefinition(gruppe, gLabel), null); z++; }
                    foreach (var aj in p.GetProperty("attributes").EnumerateArray())
                    {
                        var def = aj.Deserialize<AttributeDefinition>(Web)!;
                        attribute.Add(def.Key);
                        if (model.Attributes.ContainsKey(def.Key)) continue;
                        // wie PUT /api/model/attributes: was zum Typ nicht passt, fällt weg
                        var zahl = def.Type is AttributeTypes.Integer or AttributeTypes.Decimal;
                        def = def with
                        {
                            Unit = zahl && def.Unit is { } sym ? einheiten.GetValueOrDefault(sym, sym) : null,
                            List = def.Type == AttributeTypes.Enum ? def.List : null,
                            Axes = def.Type == AttributeTypes.Formula ? def.Axes?.Where(x => x == Axes.Locale).ToArray() is { Length: > 0 } l ? l : null : def.Axes is { Length: > 0 } ax ? ax : null,
                            Required = def.Required is { Count: > 0 } r ? r : null,
                        };
                        write(Anwender, Model.AttributeStream + def.Key, Types.AttributeDefined, def, null);
                        z++;
                    }
                    return z;
                });
                // die Daten des Plugins (Zuordnung, Zielattribute), wie es sie beim Einschalten schreibt
                if (p.TryGetProperty("data", out var daten))
                    foreach (var d in daten.EnumerateObject())
                        if (!plugin.Data.ContainsKey(d.Name))
                            n += c.With((_, _, write) => { write(Anwender, Plugins.Stream + key, Types.PluginDataSet, new PluginDataSet(d.Name, d.Value.GetRawText()), null); return 1; });
                var antwort = c.With((model, tree, write) => ClassificationApi.RegisterObjects(Kontext(c, model, tree, write, () => n++), key, new ClassificationApi.SystemBody([gruppe], attribute.ToArray())));
                if (antwort.Error is { } fehler) throw new InvalidOperationException($"Demo: {key} — " + string.Format(fehler, antwort.Args ?? []));
            }
            if (p.TryGetProperty("attach", out var an) && an.ValueKind == System.Text.Json.JsonValueKind.True) n += AnDieWurzeln(c, gruppe);
        }
        // ETIM: die Gruppe des Klassifikationssystems an die Wurzeln, wie install() des Plugins
        if (c.Lesen((m, _) => m.Groups.ContainsKey("class_etim")) && c.Lesen((_, _) => c.Plugins.All.GetValueOrDefault("etim")) is { Enabled: true }) n += AnDieWurzeln(c, "class_etim");
        return n;
    }

    /// <summary>Die Gruppe an jede Wurzel des Baums (ohne Rubriken), die sie noch nicht hat.</summary>
    private static int AnDieWurzeln(Catalog c, string gruppe)
    {
        var z = 0;
        var antwort = c.With((model, tree, write) =>
        {
            var ctx = Kontext(c, model, tree, write, () => z++);
            foreach (var w in tree.Nodes.Values.Where(x => x.Parent is null && x.Role != Roles.Rubric && !x.Groups.Contains(gruppe)).Select(x => (x.Id, x.Groups)).ToList())
                if (Commands.AttachGroups(ctx, w.Id, [.. w.Groups, gruppe]).Error is { } e) return e;
            return null;
        });
        if (antwort is { } fehler) throw new InvalidOperationException("Demo: Gruppe an die Wurzeln — " + fehler);
        return z;
    }

    private static Ctx Kontext(Catalog c, ModelCatalog model, Tree tree, Catalog.Writer write, Action gezaehlt) => new()
    {
        Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Workflows = c.Workflows, Translations = c.Translations, Plugins = c.Plugins,
        Write = (stream, type, payload) => { gezaehlt(); return write(Anwender, stream, type, payload, null); },
    };

    /// <summary>Die Ausgabe von <see cref="SystemSkript"/>: node mit dem Verzeichnis der Plugins.</summary>
    private static string SystemJson(string pluginDir) => NodeJson(SystemSkript, pluginDir);

    /// <summary>Ein Skript der Demo mit node ausführen (Argument: das Verzeichnis der Plugins) — seine Ausgabe ist eine Zeile JSON.</summary>
    private static string NodeJson(string skript, string pluginDir)
    {
        var psi = new System.Diagnostics.ProcessStartInfo("node") { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };
        psi.ArgumentList.Add(skript); psi.ArgumentList.Add(pluginDir);
        using var proc = System.Diagnostics.Process.Start(psi) ?? throw new InvalidOperationException("Demo: node startet nicht.");
        var aus = proc.StandardOutput.ReadToEndAsync(); var err = proc.StandardError.ReadToEndAsync();
        if (!proc.WaitForExit(30_000)) { proc.Kill(true); throw new InvalidOperationException($"Demo: {Path.GetFileName(skript)} antwortet nicht."); }
        if (proc.ExitCode != 0) throw new InvalidOperationException($"Demo: {Path.GetFileName(skript)} — " + err.Result.Trim());
        return aus.Result;
    }

    // ---- GPC (07.10.2026): wie ETIM fest an den Gruppen des Beispielkatalogs — Auszug der Veröffentlichung, Datensätze und Merkmale aus den
    // Funktionen des Plugins (demo-gpc.mjs), zugewiesen über ClassificationApi.Assign, dazu die Werte an der Gruppe (vererbbar).

    /// <summary>Das Skript mit dem GPC-Auszug — neben dem Server (im Image unter /app).</summary>
    public static string GpcSkript => Path.Combine(AppContext.BaseDirectory, "demo-gpc.mjs");

    /// <summary>GPC an die Gruppen: nur, wenn gpc an ist und noch keine Veröffentlichung im Journal steht.</summary>
    public static int Gpc(Catalog c, string pluginDir)
    {
        if (c.Lesen((_, _) => c.Plugins.All.GetValueOrDefault("gpc")) is not { Enabled: true } plugin || plugin.Data.ContainsKey("release")) return 0;
        using var doc = System.Text.Json.JsonDocument.Parse(NodeJson(GpcSkript, pluginDir));
        var root = doc.RootElement;
        var n = c.With((_, _, write) =>
        {
            var z = 0;
            foreach (var r in root.GetProperty("records").EnumerateObject()) { write(Anwender, Plugins.Stream + "gpc", Types.PluginDataSet, new PluginDataSet(r.Name, r.Value.GetRawText()), null); z++; }
            return z;
        });
        var system = root.GetProperty("system").Deserialize<ClassificationApi.SystemSpec>(Web)!;
        foreach (var zw in root.GetProperty("zuweisungen").EnumerateArray())
        {
            var label = zw.GetProperty("gruppe").GetString();
            var gruppe = c.Lesen((_, t) => t.Nodes.Values.FirstOrDefault(x => x.Role == Roles.Group && x.Label.GetValueOrDefault("de") == label)?.Id);
            if (gruppe is null) continue;
            var body = new ClassificationApi.AssignBody(gruppe, zw.GetProperty("brick").GetString()!, system,
                zw.GetProperty("classes").Deserialize<ClassificationApi.ClassSpec[]>(Web), zw.GetProperty("features").Deserialize<ClassificationApi.FeatureSpec[]>(Web));
            var a = c.With((model, tree, write) => ClassificationApi.Assign(Kontext(c, model, tree, write, () => n++), body, true));
            if (a.Error is { } fehler) throw new InvalidOperationException($"Demo: GPC {label} — " + string.Format(fehler, a.Args ?? []));
            foreach (var w in zw.GetProperty("werte").EnumerateObject())
            {
                var o = c.With((model, tree, write) => Commands.SetAttribute(Kontext(c, model, tree, write, () => n++), gruppe, w.Name, null, null, w.Value.GetString(), null));
                if (o.Error is { } e) throw new InvalidOperationException($"Demo: GPC {label} {w.Name} — {e}");
            }
        }
        return n;
    }

    // ---- GEO-Texte (07.10.2026): in der Demo ohne KI, aus den Werten jedes Produkts gesetzt — damit Datenblatt, Prüfung und Varianten sie zeigen.
    // Die Attribute legt das Plugin geo an (Systemobjekte); in der Demo sind sie vererbbar (demo-system.mjs), die Varianten zeigen die des Produkts.

    /// <summary>Die GEO-Texte eines Produkts: Attribut → (de, en).</summary>
    public sealed record GeoText(string Produkt, Dictionary<string, (string De, string En)> Werte);

    private static GeoText GeoTexteVon(string produkt, string nameDe, string nameEn, string artDe, string artEn, string formDe, string formEn,
        int watt, int lumen, int kelvin, string schutz, bool dimmbar, bool aussen)
    {
        var ip = schutz.ToUpperInvariant();
        var einDe = artDe is "Strahler" ? "ein" : "eine";
        var lichtDe = kelvin <= 3000 ? "warmweiss" : "neutralweiss"; var lichtEn = kelvin <= 3000 ? "warm white" : "neutral white";
        var kurzDe = $"{artDe} mit {watt} W und {lumen} lm, {kelvin} K ({lichtDe}), Schutzart {ip}{(dimmbar ? ", dimmbar" : "")}.";
        var kurzEn = $"{artEn} with {watt} W and {lumen} lm, {kelvin} K ({lichtEn}), protection rating {ip}{(dimmbar ? ", dimmable" : "")}.";
        string JsonLd(string name, string kurz, string leistung, string lichtstrom, string farbtemperatur) => System.Text.Json.JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["@context"] = "https://schema.org", ["@type"] = "Product", ["name"] = name, ["description"] = kurz,
            ["additionalProperty"] = new object[]
            {
                new Dictionary<string, object> { ["@type"] = "PropertyValue", ["name"] = leistung, ["value"] = watt, ["unitText"] = "W" },
                new Dictionary<string, object> { ["@type"] = "PropertyValue", ["name"] = lichtstrom, ["value"] = lumen, ["unitText"] = "lm" },
                new Dictionary<string, object> { ["@type"] = "PropertyValue", ["name"] = farbtemperatur, ["value"] = kelvin, ["unitText"] = "K" },
            },
        }, new System.Text.Json.JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });
        return new(produkt, new()
        {
            ["geo_definition"] = ($"{nameDe} ist {einDe} {artDe} in {formDe}er Form mit {watt} W, {lumen} lm und {kelvin} K{(aussen ? " für den Aussenbereich" : "")}.",
                                  $"{nameEn} is a {artEn.ToLowerInvariant()} in a {formEn} shape with {watt} W, {lumen} lm and {kelvin} K{(aussen ? " for outdoor use" : "")}."),
            ["geo_description"] = (kurzDe, kurzEn),
            ["geo_faq"] = ($"Ist {nameDe} dimmbar? {(dimmbar ? "Ja." : "Nein.")}\nWelche Schutzart hat {nameDe}? {ip}.\nWelche Lichtfarbe? {kelvin} K, {lichtDe}.",
                           $"Is {nameEn} dimmable? {(dimmbar ? "Yes." : "No.")}\nWhat is the protection rating of {nameEn}? {ip}.\nWhich light colour? {kelvin} K, {lichtEn}."),
            ["geo_keywords"] = ($"{artDe}, {formDe}, LED, {watt} W, {kelvin} K, {lichtDe}, {ip}{(aussen ? ", Aussenbereich" : "")}{(dimmbar ? ", dimmbar" : "")}",
                                $"{artEn.ToLowerInvariant()}, {formEn}, LED, {watt} W, {kelvin} K, {lichtEn}, {ip}{(aussen ? ", outdoor" : "")}{(dimmbar ? ", dimmable" : "")}"),
            ["geo_jsonld"] = (JsonLd(nameDe, kurzDe, "Leistung", "Lichtstrom", "Farbtemperatur"), JsonLd(nameEn, kurzEn, "Power", "Luminous flux", "Colour temperature")),
        });
    }

    /// <summary>Die GEO-Texte an die Produkte — nach den Systemobjekten (erst dann gibt es die Attribute), nur Attribute, die es gibt.</summary>
    public static int GeoTexte(Catalog c, List<GeoText> texte)
    {
        if (texte.Count == 0) return 0;
        return c.WithBatch(Anwender, "demo-geo", (model, tree, write) =>
        {
            var z = 0;
            var ctx = new Ctx { Model = model, Tree = tree, Relations = c.Relations, Media = c.Media, Write = (stream, type, payload) => { z++; return write(Anwender, stream, type, payload, "demo-geo"); } };
            foreach (var t in texte)
                foreach (var (attr, (de, en)) in t.Werte)
                {
                    if (!model.Attributes.ContainsKey(attr)) continue;
                    foreach (var (loc, text) in new[] { ("de", de), ("en", en) })
                        if (Commands.SetAttribute(ctx, t.Produkt, attr, loc, null, text, null).Error is { } e) throw new InvalidOperationException($"Demo: {attr} — {e}");
                }
            return z;
        });
    }

    /// <summary>EAN-13 aus zwölf Ziffern: die Prüfziffer dazu.</summary>
    public static string Ean(string zwoelf)
    {
        var summe = 0;
        for (var i = 0; i < 12; i++) summe += (zwoelf[i] - '0') * (i % 2 == 0 ? 1 : 3);
        return zwoelf + ((10 - summe % 10) % 10);
    }
}
