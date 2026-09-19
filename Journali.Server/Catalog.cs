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
    private readonly ModelCatalog _model = new();
    private readonly Tree _tree = new();
    private readonly Relations _relations = new();
    private readonly Media _media = new();
    private readonly Plugins _plugins = new();
    private readonly Jobs _jobs = new();
    private readonly Versions _versions = new();
    private readonly Users _users = new();
    private readonly object _gate = new();

    public Catalog(IJournal journal) => _journal = journal;

    /// <summary>Abbilder aus dem Journal bauen. Liefert, wie viele Einträge es waren.</summary>
    public int Rebuild()
    {
        lock (_gate)
        {
            Projector.CatchUp(_journal, _model);
            Projector.CatchUp(_journal, _relations);
            Projector.CatchUp(_journal, _media);
            Projector.CatchUp(_journal, _plugins);
            Projector.CatchUp(_journal, _jobs);
            Projector.CatchUp(_journal, _versions);
            Projector.CatchUp(_journal, _users);
            return Projector.CatchUp(_journal, _tree);
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
                    Types.ListValueDefined => _model.Lists.TryGetValue(key, out var l) && l.Values.Count > 0,
                    Types.ViewDefined => _model.Views.ContainsKey(key),
                    Types.UnitDefined => _model.Units.ContainsKey(key),
                    Types.AttributeGroupDefined => _model.Groups.ContainsKey(key),
                    Types.MasterLocaleDefined => _model.MasterLocale is not null,
                    Types.RelationTypeDefined => _model.RelationTypes.ContainsKey(key),
                    _ => true,
                };
                if (exists) continue;
                Apply(_journal.Append("system", s.Stream, s.Type, s.Payload));
                n++;
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
}
