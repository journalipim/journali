using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;

namespace Journali.Server;

/// <summary>
/// Der Schreibpfad (docs/architektur.md): ein Befehl wird zu genau einem
/// Eintrag, der zuerst ins Journal geht, und das Abbild zieht im selben
/// Schritt nach — unter einer Sperre, damit kein Leser einen halben Stand sieht.
/// Beim Start wird das Abbild aus dem Journal neu gebaut; es ist nie das Original.
/// </summary>
public sealed class Catalog
{
    private readonly IJournal _journal;
    private readonly ProductCatalog _state = new();
    private readonly object _gate = new();

    public Catalog(IJournal journal) => _journal = journal;

    /// <summary>Abbild aus dem Journal bauen. Liefert, wie viele Einträge es waren.</summary>
    public int Rebuild()
    {
        lock (_gate) return Projector.CatchUp(_journal, _state);
    }

    public long Head
    {
        get { lock (_gate) return _state.LastApplied; }
    }

    /// <summary>Anhängen und Abbild nachziehen — der einzige Weg, etwas zu ändern.</summary>
    public Entry Execute<T>(string actor, string sku, string type, T payload)
    {
        lock (_gate)
        {
            var entry = _journal.Append(actor, sku, type, Types.Serialize(payload));
            _state.Apply(entry);
            return entry;
        }
    }

    /// <summary>Roher Eintrag (Import, Werkzeuge) — Abbild zieht ebenfalls nach.</summary>
    public Entry AppendRaw(string actor, string stream, string type, string payload)
    {
        lock (_gate)
        {
            var entry = _journal.Append(actor, stream, type, payload);
            _state.Apply(entry);
            return entry;
        }
    }

    /// <summary>Liest unter der Sperre und gibt eine Kopie heraus, die der Aufrufer behalten darf.</summary>
    public TResult Read<TResult>(Func<IReadOnlyDictionary<string, ProductState>, TResult> read)
    {
        lock (_gate) return read(_state.Products);
    }
}
