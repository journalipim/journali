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
    private readonly object _gate = new();

    public Catalog(IJournal journal) => _journal = journal;

    private IReadOnlyList<(string Name, IProjection Projection)> Parts => [("Model", _model), ("Tree", _tree), ("Relations", _relations), ("Media", _media), ("Plugins", _plugins), ("Jobs", _jobs), ("Versions", _versions), ("Users", _users)];

    /// <summary>
    /// Schnappschuss der Abbilder (Taloan, 21.09.2026): vor dem Rebuild laden — dann liest der Start nur den Rest ab #n.
    /// Liefert #n oder 0 (keine Datei, anderer Bau, Journal passt nicht — Datei ist dann weg).
    /// </summary>
    public long LoadSnapshot(string path)
    {
        lock (_gate)
        {
            var n = Snapshot.Load(path, _journal, Parts.Select(p => (p.Name, p.Projection.GetType())).ToList(), out var loaded);
            if (n == 0) return 0;
            _model = (ModelCatalog)loaded["Model"]; _tree = (Tree)loaded["Tree"]; _relations = (Relations)loaded["Relations"]; _media = (Media)loaded["Media"];
            _plugins = (Plugins)loaded["Plugins"]; _jobs = (Jobs)loaded["Jobs"]; _versions = (Versions)loaded["Versions"]; _users = (Users)loaded["Users"];
            return n;
        }
    }

    /// <summary>Schnappschuss schreiben — unter der Sperre (kein halber Stand). Liefert #n oder 0.</summary>
    public long SaveSnapshot(string path) { lock (_gate) return Snapshot.Save(path, _journal, Parts); }

    /// <summary>Abbilder aus dem Journal bauen. Liefert, wie viele Einträge es waren.</summary>
    public int Rebuild() => Rebuild(out _);
    public int Rebuild(out Projector.Timing timing) => Rebuild(out timing, null);
    public int Rebuild(out Projector.Timing timing, Action<int, long>? progress)
    {
        lock (_gate)
        {
            // ein Durchlauf für alle Abbilder — nicht acht (Taloan, 20.09.: Start hing mit 55 000 Einträgen, davon 17 000 ETIM-Klassen)
            return Projector.CatchUpAll(_journal, out timing, progress, _model, _relations, _media, _plugins, _jobs, _versions, _users, _tree);
        }
    }

    /// <summary>
    /// Saatgut nachsäen: jeder Modell-Strom, den es noch nicht gibt (Sprachen,
    /// Kanäle, die ersten Attribute). Was Taloan schon geändert hat, bleibt.
    /// </summary>
    public int SeedMissing()
    {
        lock (_gate)
        {
            var n = 0;
            foreach (var s in Model.Seeds())
            {
                var key = s.Stream[(s.Stream.LastIndexOf(':') + 1)..];   // settings:label:group hat zwei Doppelpunkte
                var exists = s.Type switch
                {
                    Types.LocaleDefined => _model.Locales.ContainsKey(key),
                    Types.ChannelDefined => _model.Channels.ContainsKey(key),
                    Types.AttributeDefined => _model.Attributes.ContainsKey(key),
                    Types.ListDefined => _model.Lists.ContainsKey(key),
                    Types.ListValueDefined => _model.Lists.TryGetValue(key, out var l) && l.Values.ContainsKey(Types.Deserialize<ListValueDefinition>(s.Payload).Value),   // je Wert, nicht „Liste hat schon Werte“ (sonst kam nur der erste)
                    Types.ViewDefined => _model.Views.ContainsKey(key),
                    Types.UnitDefined => _model.Units.ContainsKey(key),
                    Types.AttributeGroupDefined => _model.Groups.ContainsKey(key),
                    Types.MasterLocaleDefined => _model.MasterLocale is not null,
                    Types.MasterChannelDefined => _model.MasterChannel is not null,
                    Types.RelationTypeDefined => _model.RelationTypes.ContainsKey(key),
                    Types.MediaPresetDefined => _media.PresetEver(key),   // auch wenn Taloan es zurückgezogen hat — nicht wieder säen
                    _ => true,
                };
                if (exists) continue;
                Apply(_journal.Append("system", s.Stream, s.Type, s.Payload));
                n++;
            }
            // Rollen (Taloan, 20.09.): vorbelegt, was fehlt — was der Anwender geändert oder entfernt hat, bleibt so (nur admin kommt immer wieder)
            var hadRoles = _users.Roles.Count > 0;   // vorher: nur ein leeres Journal bekommt alle Saatgut-Rollen (ein bewusst entferntes kommt nicht wieder), admin immer
            foreach (var (key, role) in Rights.Seeds())
            {
                if (_users.Roles.ContainsKey(key)) continue;
                if (key != "admin" && hadRoles) continue;
                Apply(_journal.Append("system", Users.RoleStream + key, Types.RoleDefined, Types.Serialize(role))); n++;
            }
            // Der Wurzelknoten „MasterTree“: nur, wenn es ihn nie gab (auch nicht zurückgezogen).
            if (!_tree.EverCreated(Model.RootNode))
                foreach (var s in Model.TreeSeeds()) { Apply(_journal.Append("system", s.Stream, s.Type, s.Payload)); n++; }
            return n;
        }
    }

    public long Head
    {
        get { lock (_gate) return _tree.LastApplied; }
    }

    /// <summary>Anhängen und Abbilder nachziehen — der einzige Weg, etwas zu ändern.</summary>
    public Entry Execute<T>(string actor, string stream, string type, T payload)
    {
        lock (_gate) return Apply(_journal.Append(actor, stream, type, Types.Serialize(payload)));
    }

    /// <summary>Roher Eintrag (Import, Werkzeuge) — Abbilder ziehen ebenfalls nach.</summary>
    public Entry AppendRaw(string actor, string stream, string type, string payload)
    {
        lock (_gate) return Apply(_journal.Append(actor, stream, type, payload));
    }

    private Entry Apply(Entry entry)
    {
        _model.Apply(entry);
        _tree.Apply(entry);
        _relations.Apply(entry);
        _media.Apply(entry);
        _plugins.Apply(entry);
        _jobs.Apply(entry);
        _versions.Apply(entry);
        _users.Apply(entry);
        return entry;
    }

    /// <summary>Das Abbild der Plugins — nur innerhalb von <see cref="With"/> anfassen.</summary>
    public Plugins Plugins => _plugins;
    /// <summary>Das Abbild der Jobs — nur innerhalb von <see cref="With"/> anfassen.</summary>
    public Jobs Jobs => _jobs;
    /// <summary>Das Abbild der Versionen — nur innerhalb von <see cref="With"/> anfassen.</summary>
    public Versions Versions => _versions;
    /// <summary>Das Abbild der Benutzer — nur innerhalb von <see cref="With"/> anfassen.</summary>
    public Users Users => _users;

    // Stand bei #n (Versionen, Taloan: „eine Version ist ein Zeiger ins Journal“): Modell und Baum von damals, frisch aus dem
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
    public TResult Read<TResult>(Func<Tree, TResult> read)
    {
        lock (_gate) return read(_tree);
    }

    public TResult ReadModel<TResult>(Func<ModelCatalog, TResult> read)
    {
        lock (_gate) return read(_model);
    }

    /// <summary>
    /// Prüfen und Schreiben in einem Schritt unter der Sperre — für Befehle, die
    /// Modell und Baum befragen. Ein Stapel läuft ganz darin; niemand sieht ihn halb.
    /// </summary>
    public TResult With<TResult>(Func<ModelCatalog, Tree, Writer, TResult> action)
    {
        lock (_gate)
            return action(_model, _tree, (actor, stream, type, payload, batch) =>
                Apply(_journal.Append(actor, stream, type, Types.Serialize(payload), batch)));
    }

    public delegate Entry Writer(string actor, string stream, string type, object payload, string? batch);

    /// <summary>Viele Einträge als eine Transaktion unter der Sperre, danach die Abbilder — für Stapel, die nicht prüfen müssen (Plugin-Daten).</summary>
    public IReadOnlyList<Entry> WriteMany(string actor, IReadOnlyList<(string Stream, string Type, object Payload)> items, string? batch = null)
    {
        lock (_gate)
        {
            var entries = _journal.AppendMany(actor, items.Select(i => (i.Stream, i.Type, Types.Serialize(i.Payload))).ToList(), batch);
            foreach (var e in entries) Apply(e);
            return entries;
        }
    }
}
