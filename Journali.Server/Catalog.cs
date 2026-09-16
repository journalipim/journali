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
    private readonly ProductCatalog _products = new();
    private readonly object _gate = new();

    public Catalog(IJournal journal) => _journal = journal;

    /// <summary>Abbilder aus dem Journal bauen. Liefert, wie viele Einträge es waren.</summary>
    public int Rebuild()
    {
        lock (_gate)
        {
            Projector.CatchUp(_journal, _model);
            return Projector.CatchUp(_journal, _products);
        }
    }

    /// <summary>Leeres Modell: das Saatgut anhängen (Sprachen, Kanäle, die ersten Attribute).</summary>
    public int SeedIfEmpty()
    {
        lock (_gate)
        {
            if (!_model.IsEmpty) return 0;
            var n = 0;
            foreach (var s in Model.Seeds())
            {
                Apply(_journal.Append("system", s.Stream, s.Type, s.Payload));
                n++;
            }
            return n;
        }
    }

    public long Head
    {
        get { lock (_gate) return _products.LastApplied; }
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
        _products.Apply(entry);
        return entry;
    }

    /// <summary>Liest unter der Sperre und gibt eine Kopie heraus, die der Aufrufer behalten darf.</summary>
    public TResult Read<TResult>(Func<IReadOnlyDictionary<string, ProductState>, TResult> read)
    {
        lock (_gate) return read(_products.Products);
    }

    public TResult ReadModel<TResult>(Func<ModelCatalog, TResult> read)
    {
        lock (_gate) return read(_model);
    }

    /// <summary>Prüfen und Schreiben in einem Schritt unter der Sperre — für Befehle, die das Modell befragen.</summary>
    public TResult With<TResult>(Func<ModelCatalog, IReadOnlyDictionary<string, ProductState>, Func<string, string, string, object, Entry>, TResult> action)
    {
        lock (_gate)
            return action(_model, _products.Products, (actor, stream, type, payload) =>
                Apply(_journal.Append(actor, stream, type, Types.Serialize(payload))));
    }
}
