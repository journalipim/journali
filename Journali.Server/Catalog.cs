using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Der Schreibpfad (docs/architektur.md): ein Befehl wird zu genau einem
/// Eintrag, der zuerst ins Journal geht, und die Abbilder ziehen im selben
/// Schritt nach — unter einer Sperre, damit kein Leser einen halben Stand sieht.
/// Beim Start werden die Abbilder aus dem Journal neu gebaut; sie sind nie das Original.
/// </summary>
/// <summary>Der Urheber hat kein Kontingent — der Eintrag würde journali-Token kosten.</summary>
public sealed class KeinKontingentException() : InvalidOperationException("Kontingent aufgebraucht — nichts gespeichert.");
/// <summary>Der Tarif erlaubt es nicht — z. B. ein weiterer Publikationsbaum. Wird zu 403 wie das Kontingent.</summary>
public sealed class TarifException(string message) : InvalidOperationException(message);

public sealed class Catalog
{
    private readonly IJournal _journal;
    // nicht readonly: ein Schnappschuss tauscht die Instanzen beim Start ein (LoadSnapshot), bevor jemand sie hält
    private ModelCatalog _model = new();
    private Tree _tree = new();
    private Relations _relations = new();
    private Media _media = new();
    private Plugins _plugins = new();
    private Jobs _jobs = new();
    private Versions _versions = new();
    private Users _users = new();
    private Workflows _workflows = new();
    private Translations _translations = new();
    private Teams _teams = new();
    private Usage _usage = new();
    /// <summary>
    /// Zwei Sperren statt einer.
    /// <c>_write</c> lässt nur einen Schreiber zur Zeit prüfen, anhängen und anwenden — das bleibt eine Einheit.
    /// <c>_state</c> schützt die Abbilder: Leser kommen parallel hinein, exklusiv wird es nur für das Anwenden eines
    /// Eintrags. Der Weg zur Datenbank liegt ausserhalb von <c>_state</c>; dort wurde vorher gewartet, während alles
    /// andere stand. Rekursion ist erlaubt, weil ein Befehl unter <c>_write</c> Abbilder liest und danach schreibt.
    /// </summary>
    private readonly object _write = new();
    private readonly System.Threading.ReaderWriterLockSlim _state = new(System.Threading.LockRecursionPolicy.SupportsRecursion);

    /// <summary>Lesen: parallel zu anderen Lesern, wartet nur, solange gerade ein Eintrag angewendet wird.</summary>
    private T Lesend<T>(Func<T> f)
    {
        var uhr = System.Diagnostics.Stopwatch.StartNew();
        _state.EnterReadLock();
        Teilzeit.Notiere("Lesesperre", uhr.ElapsedMilliseconds);   // Wartezeit, solange ein Eintrag angewendet wird
        try { return f(); } finally { _state.ExitReadLock(); }
    }

    /// <summary>Die Abbilder ändern — kurz und exklusiv.</summary>
    private T Aendernd<T>(Func<T> f)
    {
        _state.EnterWriteLock();
        try { return f(); } finally { _state.ExitWriteLock(); }
    }

    public Catalog(IJournal journal) => _journal = journal;

    /// <summary>Wo die Lizenz liegt — das Saatgut holt die Limits des Init Teams von dort (null = Testbetrieb).</summary>
    public string? LicenceDir { get; set; }
    /// <summary>Woher die Lizenz kommt (Datenbank oder Datei) — gesetzt beim Start, vor dem Saatgut.</summary>
    public Licences? Licences { get; set; }
    private Licence Lizenz => Licences?.Lic ?? LicenceFile.Load(LicenceDir ?? "").Lic;

    /// <summary>
    /// Der Tarif der Instanz: der höhere von Lizenz und dem
    /// höchsten Tarif, den ein Team heute per Schlüssel hat. Nach ihm richten sich Plugins und Publikationsbäume.
    /// </summary>
    public Tarif InstanzTarif => Lesend(TarifOhneSperre);
    private Tarif TarifOhneSperre()
    {
        var heute = DateOnly.FromDateTime(DateTime.Now);
        var lizenz = Lizenz.TarifIn(_teams.Tarife);
        return _teams.HoechsterTarif(heute) is { } t ? Core.Projections.Tarife.Hoeher(lizenz, t) : lizenz;
    }

    /// <summary>Die geltenden Tarife: aus dem Tarifblatt im Journal, sonst das Saatgut.</summary>
    public Tarifliste Tarife => Lesend(() => _teams.Tarife);
    /// <summary>Der Tarif der Lizenz dieser Instanz (ohne Schlüssel und Abos) — seine Grenzen trägt das Init Team.</summary>
    public Tarif LizenzTarif => Lesend(() => Lizenz.TarifIn(_teams.Tarife));

    /// <summary>Der Tarif eines Teams: sein Schlüssel — und beim ersten Team die Lizenz, deren Limits es trägt. Nur unter der Sperre.</summary>
    public Tarif TeamTarif(string team)
    {
        var heute = DateOnly.FromDateTime(DateTime.Now);
        var liste = _teams.Tarife;
        var basis = _teams.Primary?.Key == team ? Lizenz.TarifIn(liste) : liste.Free;
        return _teams.TarifAt(team, heute) is { } t ? Core.Projections.Tarife.Hoeher(basis, t) : basis;
    }

    /// <summary>
    /// Ein Tarifblatt des Lizenzservers übernehmen: nur, wenn es echt und stimmig ist und eine neuere Version hat als das
    /// geltende. Danach bekommt das Init Team die Grenzen der Lizenz nach der neuen Liste. Liefert, ob übernommen wurde.
    /// </summary>
    public bool NimmTarifblatt(Core.Licensing.Tarifblatt? blatt, string actor)
    {
        if (blatt?.Pruefe().Inhalt is not { } neu) return false;
        lock (_write)
            return Aendernd(() =>
            {
                if (neu.Version <= _teams.Tarife.Version) return false;
                Apply(_journal.Append(actor, TarifStrom, Types.TarifeReceived, Types.Serialize(new TarifeReceived(blatt.Blatt, blatt.Sig))));
                LimitsAusLizenz();
                return true;
            });
    }
    /// <summary>Der Strom der Tarifblätter — dort steht auch, ob die Anlage registriert ist.</summary>
    public const string TarifStrom = "tarife";

    /// <summary>Die Antwort auf die Frage nach der Registrierung festhalten (26.09.2026). Gefragt wird einmal.</summary>
    public void Registrierung(bool ja, string actor)
    {
        lock (_write)
            Aendernd(() =>
            {
                Apply(_journal.Append(actor, TarifStrom, Types.RegistrationSet, Types.Serialize(new RegistrationSet(ja))));
                return true;
            });
    }

    /// <summary>Ist die Anlage registriert? null: noch nicht gefragt.</summary>
    public bool? Registriert => Lesend(() => _teams.Registriert);

    /// <summary>Der Tag des ersten Eintrags — der Test einer neuen Instanz zählt ab ihm.</summary>
    public DateOnly? ErsterTag => Lesend(() => _usage.AllPerDay.Count == 0 ? (DateOnly?)null : _usage.AllPerDay.Keys.Min());

    /// <summary>Was der Tarif verbietet, wirft: ein Publikationsbaum mehr, als er erlaubt.</summary>
    private void PruefeTarif(string type, object? payload)
    {
        if (type != Types.RubricCreated || payload is not RubricCreated { Parent: null }) return;
        var t = TarifOhneSperre();
        if (t.PubTrees != Core.Projections.Tarife.Ohne && _tree.PubTrees.Count() >= t.PubTrees)
            throw new TarifException($"Tarif {t.Label}: höchstens {t.PubTrees} Publikationsbäume.");
    }

    /// <summary>Ab wann gezählt wird (aus der Lizenz, null = seit jeher) — Program setzt es beim Start und beim Einspielen.</summary>
    public DateOnly? ZaehltAb { get; set; }

    private IReadOnlyList<(string Name, IProjection Projection)> Parts => [("Model", _model), ("Tree", _tree), ("Relations", _relations), ("Media", _media), ("Plugins", _plugins), ("Jobs", _jobs), ("Versions", _versions), ("Users", _users), ("Workflows", _workflows), ("Translations", _translations), ("Usage", _usage), ("Teams", _teams)];

    /// <summary>
    /// Schnappschuss der Abbilder: vor dem Rebuild laden — dann liest der Start nur den Rest ab #n.
    /// Liefert #n oder 0 (keine Datei, anderer Bau, Journal passt nicht — Datei ist dann weg).
    /// </summary>
    public long LoadSnapshot(string path)
    {
        lock (_write)
        return Aendernd(() =>
        {
            var n = Snapshot.Load(path, _journal, Parts.Select(p => (p.Name, p.Projection.GetType())).ToList(), out var loaded);
            if (n == 0) return 0;
            _stand.Clear();
            _model = (ModelCatalog)loaded["Model"]; _tree = (Tree)loaded["Tree"]; _relations = (Relations)loaded["Relations"]; _media = (Media)loaded["Media"];
            _plugins = (Plugins)loaded["Plugins"]; _jobs = (Jobs)loaded["Jobs"]; _versions = (Versions)loaded["Versions"]; _users = (Users)loaded["Users"]; _workflows = (Workflows)loaded["Workflows"]; _translations = (Translations)loaded["Translations"]; _usage = (Usage)loaded["Usage"]; _teams = (Teams)loaded["Teams"];
            return n;
        });
    }

    /// <summary>Schnappschuss schreiben — lesend: er braucht einen ganzen Stand, hält aber keinen Leser auf. Gehalten wird die Sperre nur, solange
    /// die Abbilder in Bytes verwandelt werden; die Datei schreibt <see cref="Snapshot.Write"/> danach ohne sie.</summary>
    public long SaveSnapshot(string path) => Lesend(() => Snapshot.Prepare(_journal, Parts)) is { } stand ? Snapshot.Write(path, stand) : 0;

    /// <summary>Abbilder aus dem Journal bauen. Liefert, wie viele Einträge es waren.</summary>
    public int Rebuild() => Rebuild(out _);
    public int Rebuild(out Projector.Timing timing) => Rebuild(out timing, null);
    public int Rebuild(out Projector.Timing timing, Action<int, long>? progress)
    {
        Projector.Timing? gemessen = null;
        // ein Durchlauf für alle Abbilder — nicht acht
        int n;
        lock (_write) n = Aendernd(() =>
        {
            _stand.Clear();
            var gebaut = Projector.CatchUpAll(_journal, out var t, progress, _model, _relations, _media, _plugins, _jobs, _versions, _users, _workflows, _translations, _usage, _teams, _tree);
            gemessen = t;
            return gebaut;
        });
        timing = gemessen!;
        return n;
    }

    /// <summary>
    /// Was seit dem letzten Mal im Journal steht, in die Abbilder holen — auch Einträge, die ein anderer Server
    /// geschrieben hat (26.09.2026: zwei Server auf einer Datenbank sahen einander nicht, bis einer neu startete).
    /// Liefert, wie viele Einträge dazukamen. Der eigene Schreibpfad wendet seine Einträge weiter selbst an; dies hier
    /// holt nur, was von aussen kam, und läuft unter derselben Sperre — niemand sieht die Abbilder halb nachgezogen.
    /// </summary>
    public int Nachziehen()
    {
        lock (_write)
            return Aendernd(() =>
            {
                var n = Projector.CatchUpAll(_journal, out _, (Action<int, long>?)null,
                    _model, _relations, _media, _plugins, _jobs, _versions, _users, _workflows, _translations, _usage, _teams, _tree);
                if (n > 0) _stand.Clear();   // Teams, Mitgliedschaften und Schlüssel können dabei gewesen sein
                return n;
            });
    }

    /// <summary>
    /// Saatgut nachsäen: jeder Modell-Strom, den es noch nicht gibt (Sprachen,
    /// Kanäle, die ersten Attribute). Was schon geändert wurde, bleibt.
    /// </summary>
    public int SeedMissing()
    {
        lock (_write)
        return Aendernd(() =>
        {
            var n = 0;
            foreach (var s in Model.Seeds())
            {
                var key = s.Stream[(s.Stream.LastIndexOf(':') + 1)..];   // settings:label:group hat zwei Doppelpunkte
                var exists = s.Type switch
                {
                    Types.LocaleDefined => _model.Locales.ContainsKey(key),
                    Types.ChannelDefined => _model.Channels.ContainsKey(key),
                    Types.StatusDefined => _model.StatusEver.Contains(key),   // zurückgezogen bleibt zurückgezogen
                    Types.AttributeDefined => _model.Attributes.ContainsKey(key),
                    Types.ListDefined => _model.Lists.ContainsKey(key),
                    Types.ListValueDefined => _model.Lists.TryGetValue(key, out var l) && l.Values.ContainsKey(Types.Deserialize<ListValueDefinition>(s.Payload).Value),   // je Wert, nicht „Liste hat schon Werte“ (sonst kam nur der erste)
                    Types.ViewDefined => _model.Views.ContainsKey(key),
                    Types.UnitDefined => _model.Units.ContainsKey(key),
                    Types.AttributeGroupDefined => _model.Groups.ContainsKey(key),
                    Types.MasterLocaleDefined => _model.MasterLocale is not null,
                    Types.MasterChannelDefined => _model.MasterChannel is not null,
                    Types.RelationTypeDefined => _model.RelationTypes.ContainsKey(key),
                    Types.MediaPresetDefined => _media.PresetEver(key),   // auch wenn es zurückgezogen wurde — nicht wieder säen
                    Types.WorkflowDefined => _workflows.Ever(key),
                    _ => true,
                };
                if (exists) continue;
                Apply(_journal.Append("system", s.Stream, s.Type, s.Payload));
                n++;
            }
            // Redaktions-Workflow aus der Saat ohne Wirkung (vor dem 21.09.2026 gesät): „freigeben“ soll für web freigeben — nur nachziehen,
            // wenn die Übergänge noch die der Saat sind (der Anwender hat nichts geändert)
            if (_workflows.All.TryGetValue("review", out var rv) && rv.Transitions.Count == 5 && rv.Transitions.All(x => x.Effects is null or { Length: 0 }))
                foreach (var s in Model.Seeds().Where(s => s.Stream == Workflows.Stream + "review")) { Apply(_journal.Append("system", s.Stream, s.Type, s.Payload)); n++; }
            // Rollen: vorbelegt, was fehlt — was der Anwender geändert oder entfernt hat, bleibt so (nur admin kommt immer wieder)
            var hadRoles = _users.Roles.Count > 0;   // vorher: nur ein leeres Journal bekommt alle Saatgut-Rollen (ein bewusst entferntes kommt nicht wieder), admin immer
            foreach (var (key, role) in Rights.Seeds())
            {
                if (_users.Roles.ContainsKey(key)) continue;
                if (key != "admin" && hadRoles) continue;
                Apply(_journal.Append("system", Users.RoleStream + key, Types.RoleDefined, Types.Serialize(role))); n++;
            }
            // Das Init Team. Wer kein eigenes Team trägt, arbeitet hier.
            if (_teams.All.Count == 0)
            {
                // Die Limits der Lizenz liegen hier; jedes weitere Team startet bei 0
                var lic = Lizenz;
                Apply(_journal.Append("system", Teams.Stream + Model.InitTeam, Types.TeamDefined, Types.Serialize(
                    new TeamDefined("Init Team", EntriesWeek: lic.EntriesWeek, EntriesMonth: lic.EntriesMonth, MonthlyTokens: lic.AiTokensMonth, DailyTokens: lic.AiTokensDay)))); n++;
            }
            // Bestandsbenutzer ins Init Team. Einmalig und
            // nur, solange überhaupt noch niemand ein Team trägt — teamlos ist sonst ein gewollter Zustand (ausgetragen).
            if (_teams.Primary is { } erstesTeam && _users.All.Count > 0 && _users.All.Values.All(u => u.Team is null))
                foreach (var u in _users.All.Values.OrderBy(u => u.Key).ToList())
                {
                    Apply(_journal.Append("system", Users.Stream + u.Key, Types.UserDefined, Types.Serialize(new UserDefined(u.Name, u.Email, u.Role, u.Enabled, erstesTeam.Key)))); n++;
                }
            // Das erste Team trägt die Limits der Lizenz — eine Anlage von vorher hat noch keine
            n += LimitsAusLizenz();
            // Ein Team ohne Führung ist unbedienbar — die
            // Anlage repariert das selbst: der erste Benutzer mit dem Recht „Benutzer und Rollen“ führt es.
            if (_teams.Primary is { Managers.Length: 0 } ohne && _users.All.Count > 0)
            {
                var admin = _users.All.Values.Where(u => u.Enabled && _users.RightsOf(u.Role).Contains(Rights.Users)).OrderBy(u => u.Key).FirstOrDefault();
                if (admin is not null)
                {
                    Apply(_journal.Append("system", Teams.Stream + ohne.Key, Types.TeamDefined, Types.Serialize(
                        new TeamDefined(ohne.Label, ohne.Note, ohne.MonthlyTokens, ohne.DailyTokens, ohne.Enabled, ohne.KeysFrom, ohne.IncludedTokens, [admin.Key], ohne.Models, ohne.EntriesWeek, ohne.EntriesMonth)))); n++;
                    // Wer führt, gehört hinein
                    if (admin.Team is null)
                    {
                        Apply(_journal.Append("system", Users.Stream + admin.Key, Types.UserDefined, Types.Serialize(new UserDefined(admin.Name, admin.Email, admin.Role, admin.Enabled, ohne.Key)))); n++;
                    }
                }
            }
            // Der Wurzelknoten „MasterTree“: nur, wenn es ihn nie gab (auch nicht zurückgezogen).
            if (!_tree.EverCreated(Model.RootNode))
                foreach (var s in Model.TreeSeeds()) { Apply(_journal.Append("system", s.Stream, s.Type, s.Payload)); n++; }
            return n;
        });
    }

    public long Head => Lesend(() => _tree.LastApplied);

    /// <summary>Anhängen und Abbilder nachziehen — der einzige Weg, etwas zu ändern.</summary>
    public Entry Execute<T>(string actor, string stream, string type, T payload)
    {
        lock (_write) { var e = _journal.Append(actor, stream, type, Types.Serialize(payload)); return Aendernd(() => Apply(e)); }
    }

    /// <summary>Roher Eintrag (Import, Werkzeuge) — Abbilder ziehen ebenfalls nach.</summary>
    public Entry AppendRaw(string actor, string stream, string type, string payload)
    {
        lock (_write) { var e = _journal.Append(actor, stream, type, payload); return Aendernd(() => Apply(e)); }
    }

    private Entry Apply(Entry entry)
    {
        // Teams und Mitgliedschaften verschieben, wer auf wessen Rechnung geht — der mitgeführte Stand gilt dann nicht mehr
        if (entry.Type is Types.TeamDefined or Types.TeamRetired or Types.UserDefined or Types.UserRetired or Types.KeyRedeemed or Types.EntitlementReceived or Types.TarifeReceived) _stand.Clear();
        _model.Apply(entry);
        _tree.Apply(entry);
        _relations.Apply(entry);
        _media.Apply(entry);
        _plugins.Apply(entry);
        _jobs.Apply(entry);
        _versions.Apply(entry);
        _users.Apply(entry);
        _workflows.Apply(entry);
        _translations.Apply(entry);
        _teams.Apply(entry);
        _usage.Apply(entry);
        return entry;
    }

    /// <summary>Das Abbild der Plugins — nur innerhalb von <see cref="With"/> anfassen.</summary>
    public Plugins Plugins => _plugins;
    /// <summary>Das Abbild der Jobs — nur innerhalb von <see cref="With"/> anfassen.</summary>
    public Jobs Jobs => _jobs;
    /// <summary>Das Abbild der Versionen — nur innerhalb von <see cref="With"/> anfassen.</summary>
    public Versions Versions => _versions;
    /// <summary>
    /// Das erste Team trägt die Limits der Lizenz.
    /// Läuft beim Start und noch einmal, wenn eine Lizenz eingespielt wird — sonst müsste man dafür neu starten.
    /// Angefasst wird nur, was der Administrator nicht selbst schon gesetzt hat: 0/0 heisst „noch nie zugeteilt“.
    /// </summary>
    public int LimitsAusLizenz()
    {
        var lic = Lizenz;
        var tarif = lic.TarifIn(_teams.Tarife);
        ZaehltAb = lic.CountFrom;
        _stand.Clear();   // der Zählbeginn kann sich verschoben haben
        var n = 0;
        // Das erste Team trägt die Limits der Anlage
        if (_teams.Primary is { } erstes && (tarif.Week > 0 || tarif.Month > 0)
            && (erstes.EntriesWeek != tarif.Week || erstes.EntriesMonth != tarif.Month))
            n += Setze(erstes, tarif.Week, tarif.Month);
        // Jedes weitere hat, was die Lizenz ihm zuschreibt — sonst nichts (es rechnet dann über ein anderes ab)
        foreach (var t in _teams.All.Values)
        {
            if (_teams.Primary?.Key == t.Key) continue;
            var soll = lic.Teams?.GetValueOrDefault(t.Key) ?? new TeamLimit();
            if (t.EntriesWeek != soll.EntriesWeek || t.EntriesMonth != soll.EntriesMonth) n += Setze(t, soll.EntriesWeek, soll.EntriesMonth);
        }
        return n;
    }

    private int Setze(TeamState t, int woche, int monat)
    {
        Apply(_journal.Append("system", Teams.Stream + t.Key, Types.TeamDefined, Types.Serialize(
            new TeamDefined(t.Label, t.Note, t.MonthlyTokens, t.DailyTokens, t.Enabled, t.KeysFrom, t.IncludedTokens, t.Managers, t.Models, woche, monat))));
        return 1;
    }

    /// <summary>Das Abbild der Benutzer — nur innerhalb von <see cref="With"/> anfassen.</summary>
    public Users Users => _users;
    /// <summary>Das Abbild der Workflows (27) — nur innerhalb von <see cref="With"/> anfassen.</summary>
    public Workflows Workflows => _workflows;
    /// <summary>Das Abbild der Übersetzung (30): Marken und Aufträge — nur innerhalb von <see cref="With"/> anfassen.</summary>
    public Translations Translations => _translations;
    /// <summary>Das Abbild der Teams: Grenzen und KI-Verbrauch — nur innerhalb von <see cref="With"/> anfassen.</summary>
    public Teams Teams => _teams;

    /// <summary>Nutzung je Tag — Fortschritt in den Einstellungen.</summary>
    public TResult ReadUsage<TResult>(Func<Usage, TResult> read) => Lesend(() => read(_usage));

    // Stand bei #n (Versionen): Modell und Baum von damals, frisch aus dem
    // Journal gebaut — ohne die Sperre, das Journal ist nur lesend. Die letzten Stände bleiben im Speicher (teuer bei grossem Journal).
    private readonly Dictionary<long, (ModelCatalog Model, Tree Tree)> _asOf = new();
    public (ModelCatalog Model, Tree Tree) AsOf(long number)
    {
        lock (_asOf) if (_asOf.TryGetValue(number, out var have)) return have;
        var model = new ModelCatalog(); var tree = new Tree();
        Projector.CatchUpUntil(_journal, model, number); Projector.CatchUpUntil(_journal, tree, number);
        lock (_asOf) { if (_asOf.Count >= 4) _asOf.Remove(_asOf.Keys.First()); _asOf[number] = (model, tree); }
        return (model, tree);
    }

    /// <summary>Das Abbild der Medien — nur innerhalb von <see cref="With"/> anfassen (dieselbe Sperre).</summary>
    public Media Media => _media;

    /// <summary>Das Abbild der Relationen — nur innerhalb von <see cref="With"/> anfassen (dieselbe Sperre).</summary>
    public Relations Relations => _relations;

    /// <summary>Liest unter der Sperre und gibt eine Kopie heraus, die der Aufrufer behalten darf.</summary>
    public TResult Read<TResult>(Func<Tree, TResult> read) => Lesend(() => read(_tree));

    public TResult ReadModel<TResult>(Func<ModelCatalog, TResult> read) => Lesend(() => read(_model));

    /// <summary>
    /// Modell und Baum zusammen — <b>nur lesend</b>. Für alles, was beides befragt und nichts schreibt: <see cref="With"/>
    /// nimmt die Schreibsperre, und wer dort lange rechnet, hält die ganze Anlage an (27.09.2026: die Fortschrittsanzeige
    /// der Einbettungen baute unter der Schreibsperre den Text jedes Knotens neu, alle fünf Sekunden).
    /// </summary>
    public TResult Lesen<TResult>(Func<ModelCatalog, Tree, TResult> read) => Lesend(() => read(_model, _tree));

    /// <summary>
    /// Prüfen und Schreiben in einem Schritt unter der Sperre — für Befehle, die
    /// Modell und Baum befragen. Ein Stapel läuft ganz darin; niemand sieht ihn halb.
    /// </summary>
    public TResult With<TResult>(Func<ModelCatalog, Tree, Writer, TResult> action)
    {
        lock (_write)
            return action(_model, _tree, (actor, stream, type, payload, batch) =>
            {
                if (KeinKontingent(actor, type)) throw new KeinKontingentException();
                PruefeTarif(type, payload);
                // Anhängen geht an die Datenbank — hier darf kein Leser warten; erst das Anwenden ist exklusiv
                var entry = _journal.Append(actor, stream, type, Types.Serialize(payload), batch);
                return Aendernd(() => Apply(entry));
            });
    }

    /// <summary>
    /// Kostet dieser Eintrag journali-Token, und hat sein Urheber keine? Gezählt wird, was <see cref="Kinds.Counts"/> nennt — Datenpflege und Ausleitung.
    /// Modellieren, Strukturieren, Kataloge, Einrichtung und Betrieb kosten nichts und gehen auch ohne Kontingent.
    /// Das Kontingent steht am Ende der Zahlerkette; wer kein Anwender ist (Jobs, Saatgut, „system“), ist nicht gemeint.
    /// </summary>
    private bool KeinKontingent(string actor, string type)
    {
        if (!Kinds.Billable(null, type)) return false;
        // Ein Joblauf schreibt als job:<key> — gezählt wird beim Anwender, dem der Job gehört,
        // und er lässt der Handarbeit eine Reserve: bis 90 %, nicht bis zum letzten Eintrag.
        var vomJob = actor.StartsWith("job:", StringComparison.Ordinal);
        // Jeder Job wird über ein Team abgerechnet (03.10.2026): das am Job, sonst das seines Besitzers, sonst das des Administrators
        string? team;
        if (vomJob) team = Abrechnung.TeamDesJobs(_jobs, _users, actor[4..], Model.InitTeam);
        else if (_users.All.GetValueOrDefault(actor) is { } u) team = u.Team;
        else return false;                                                  // kein Anwender und kein Job: Saatgut, „system“
        if (string.IsNullOrEmpty(team)) return true;                        // kein Team, kein Kontingent
        var zahlerKey = _teams.Payer(team);
        if (_teams.Get(zahlerKey) is null) return true;                    // das Team gibt es nicht mehr
        var heute = DateOnly.FromDateTime(DateTime.Now);
        var (kw, km) = _teams.LimitAt(zahlerKey, heute);                   // zugeteilt, angehoben durch einen Limit-Schlüssel
        if (kw <= 0 && km <= 0) return true;

        // Aufgebraucht ist dasselbe wie keins — Woche und Monat, jede Grenze für sich
        if (!_stand.TryGetValue(zahlerKey, out var stand) || stand.Tag != heute)
        {
            var ab = _teams.CountFrom(zahlerKey, ZaehltAb);                // ein Reset-Schlüssel verschiebt den Zählbeginn
            var cut = _teams.ResetCut(zahlerKey, ZaehltAb);               // … auf den Eintrag genau
            var leute = Abrechnung.Urheber(_teams, _users, _jobs, zahlerKey, Model.InitTeam);   // Mitglieder und Jobs der Teams dieses Zahlers
            stand = (heute, _usage.Sum(leute, Usage.Ab(Usage.WeekStart(heute), ab), heute, cut), _usage.Sum(leute, Usage.Ab(Usage.MonthStart(heute), ab), heute, cut));
        }
        var woche = vomJob ? Limits.FuerJob(kw) : kw;
        var monat = vomJob ? Limits.FuerJob(km) : km;
        if (woche > 0 && stand.Woche >= woche) { _stand[zahlerKey] = stand; return true; }
        if (monat > 0 && stand.Monat >= monat) { _stand[zahlerKey] = stand; return true; }
        _stand[zahlerKey] = (heute, stand.Woche + 1, stand.Monat + 1);      // dieser Eintrag zählt gleich mit
        return false;
    }

    /// <summary>Verbrauch je Zahler, mitgeführt statt bei jedem Eintrag neu summiert — ein Import schreibt Zehntausende.</summary>
    private readonly Dictionary<string, (DateOnly Tag, int Woche, int Monat)> _stand = new();

    /// <summary>Wohin die Zeit eines Stapels ging (Wartezeit auf die Schreibsperre, Anwenden im Speicher, Schreiben ins Journal) — die Konsole nennt es bei einer langsamen Anfrage.</summary>
    public static volatile string? LetzterStapel;

    public delegate Entry Writer(string actor, string stream, string type, object payload, string? batch);

    /// <summary>
    /// Ein Stapel als <b>eine</b> Transaktion. Einzeln kostet
    /// jeder Eintrag in Postgres eine eigene Transaktion mit Tabellensperre und <c>MAX(number)</c>; ein Import mit
    /// Zehntausenden Einträgen bezahlt das Zehntausende Male. Hier bekommen die Einträge fortlaufende Nummern am
    /// aktuellen Kopf und werden sofort angewendet — der nächste Befehl muss den vorigen sehen —, geschrieben wird
    /// am Ende in einem Zug. Dass niemand dazwischenschreibt, hält die Schreibsperre; stimmt die Nummernfolge beim
    /// Schreiben trotzdem nicht, werden die Abbilder neu gebaut.
    /// </summary>
    public TResult WithBatch<TResult>(string actor, string? batch, Func<ModelCatalog, Tree, Writer, TResult> action)
    {
        var uhr = System.Diagnostics.Stopwatch.StartNew();
        lock (_write)
        {
            var wartete = uhr.ElapsedMilliseconds; uhr.Restart();
            var offen = new List<(string Stream, string Type, string Payload)>();
            var basis = _journal.Head;
            TResult ergebnis;
            try
            {
                ergebnis = action(_model, _tree, (wer, stream, type, payload, _) =>
                {
                    if (KeinKontingent(wer, type)) throw new KeinKontingentException();
                    PruefeTarif(type, payload);
                    var roh = Types.Serialize(payload);
                    offen.Add((stream, type, roh));
                    var entry = new Entry(basis + offen.Count, DateTimeOffset.Now, actor, stream, type, roh, batch, Kinds.Of(type));
                    return Aendernd(() => Apply(entry));
                });
            }
            catch
            {
                if (offen.Count > 0) NeuAufbauen();   // angewendet, aber nichts geschrieben: der Stand muss zurück
                throw;
            }
            if (offen.Count == 0) return ergebnis;
            var anwenden = uhr.ElapsedMilliseconds; uhr.Restart();
            IReadOnlyList<Entry> echte;
            try { echte = _journal.AppendMany(actor, offen, batch); }
            catch { NeuAufbauen(); throw; }
            if (echte.Count != offen.Count || echte[0].Number != basis + 1) NeuAufbauen();
            LetzterStapel = $"{offen.Count} Einträge: Sperre {wartete} ms, anwenden {anwenden} ms, schreiben {uhr.ElapsedMilliseconds} ms";
            return ergebnis;
        }
    }

    /// <summary>Die Abbilder aus dem Journal neu bauen — die Notbremse, wenn ein Stapel nicht so geschrieben wurde, wie er angewendet wurde.</summary>
    private void NeuAufbauen()
    {
        Aendernd(() =>
        {
            _model = new(); _tree = new(); _relations = new(); _media = new(); _plugins = new(); _jobs = new();
            _versions = new(); _users = new(); _workflows = new(); _translations = new(); _usage = new(); _teams = new();
            _stand.Clear();
            return Projector.CatchUpAll(_journal, out _, (Action<int, long>?)null, _model, _relations, _media, _plugins, _jobs, _versions, _users, _workflows, _translations, _usage, _teams, _tree);
        });
    }

    /// <summary>Viele Einträge als eine Transaktion unter der Sperre, danach die Abbilder — für Stapel, die nicht prüfen müssen (Plugin-Daten).</summary>
    public IReadOnlyList<Entry> WriteMany(string actor, IReadOnlyList<(string Stream, string Type, object Payload)> items, string? batch = null)
    {
        lock (_write)
        {
            var entries = _journal.AppendMany(actor, items.Select(i => (i.Stream, i.Type, Types.Serialize(i.Payload))).ToList(), batch);
            return Aendernd(() => { foreach (var e in entries) Apply(e); return entries; });
        }
    }
}
