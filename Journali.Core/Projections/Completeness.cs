using Journali.Core.Entries;

namespace Journali.Core.Projections;

/// <summary>Stand eines Knotens für einen Kanal und eine Sprache: was Pflicht ist, was da ist, was fehlt.</summary>
public sealed record Completeness(string Channel, string? Locale, int Required, int Filled, string[] Missing)
{
    public bool Complete => Missing.Length == 0;
}

/// <summary>
/// Vollständigkeit aus der Pflicht der Attribute (Eineindeutigkeit: gleiche Regel
/// überall) über die Gruppen, die am Knoten gelten und dort aktiv sind. Vererbte
/// Werte zählen, wenn das Attribut vererbbar ist; vermehrbare Attribute brauchen
/// mindestens eine Zeile. Freigabe setzt sie voraus.
/// </summary>
public static class CompletenessRules
{
    /// <summary>Die Attribute, die an diesem Knoten gelten und erfassbar sind: aus den aktiven Gruppen des Pfads, plus <c>levels</c>-Ausnahmen.</summary>
    public static IEnumerable<AttributeDefinition> ActiveAttributes(Tree tree, ModelCatalog model, Node node)
    {
        foreach (var (group, _) in tree.EffectiveGroups(node))
        {
            if (!model.GroupActiveAt(group, node.Role)) continue;
            foreach (var a in model.AttributesOf(group))
                if (a.AllowedAt(node.Role)) yield return a;
        }
    }

    /// <summary>Alle Kanal × Sprache-Paare, für die hier irgendetwas Pflicht ist.</summary>
    public static List<Completeness> Of(Tree tree, ModelCatalog model, Node node)
    {
        var result = new List<Completeness>();
        var active = ActiveAttributes(tree, model, node).ToList();
        if (active.Count == 0) return result;
        foreach (var channel in model.Channels.Keys.Order())
            foreach (var locale in model.Locales.Keys.Order())
            {
                var (required, missing) = Check(tree, model, node, active, channel, locale);
                if (required > 0) result.Add(new Completeness(channel, locale, required, required - missing.Length, missing));
            }
        return result;
    }

    /// <summary>Was für Kanal und Sprache fehlt. <paramref name="locale"/> null = alle Sprachen zusammen.</summary>
    public static (int Required, string[] Missing) Check(Tree tree, ModelCatalog model, Node node, IEnumerable<AttributeDefinition> active, string channel, string? locale)
    {
        var locales = locale is null ? model.Locales.Keys.Order().ToList() : [locale];
        var required = 0;
        var missing = new List<string>();
        foreach (var def in active)
        {
            if (def.Required is null || !def.Required.TryGetValue(channel, out var langs)) continue;
            foreach (var l in locales)
            {
                if (!langs.Contains("*") && !langs.Contains(l)) continue;
                required++;
                var ok = def.Type == AttributeTypes.Rows
                    ? node.Rows.TryGetValue(def.Key, out var rows) && rows.Count > 0
                    : tree.Resolve(node, def.Key, def.PerLocale ? l : null, def.PerChannel ? channel : null, def.Inheritable).Value is not null;
                if (!ok) missing.Add(def.PerLocale ? $"{def.Key}/{l}" : def.Key);
            }
        }
        return (required, missing.Distinct().ToArray());
    }
}
