using Journali.Core.Entries;

namespace Journali.Core.Projections;

/// <summary>Stand eines Knotens für einen Kanal und eine Sprache: was Pflicht ist, was da ist, was fehlt.</summary>
public sealed record Completeness(string Channel, string? Locale, int Required, int Filled, string[] Missing)
{
    public bool Complete => Missing.Length == 0;
}

/// <summary>
/// Vollständigkeit aus den Pflichtfeldern der Familie (docs/pflegestruktur.md, 3):
/// je Kanal × Sprache die Liste der fehlenden Attribute. Geerbte Werte zählen;
/// vermehrbare Attribute brauchen mindestens eine Zeile. Freigabe setzt sie voraus.
/// </summary>
public static class CompletenessRules
{
    /// <summary>Die Familie eines Knotens: am Produkt, bei der Variante vom Produkt darüber.</summary>
    public static FamilyDefinition? FamilyOf(Tree tree, ModelCatalog model, Node node)
    {
        var key = node.Family ?? tree.Ancestors(node).FirstOrDefault(a => a.Role == Roles.Product)?.Family;
        return key is not null && model.Families.TryGetValue(key, out var f) ? f : null;
    }

    /// <summary>Alle Kanal × Sprache-Paare, für die die Familie irgendetwas verlangt.</summary>
    public static List<Completeness> Of(Tree tree, ModelCatalog model, Node node)
    {
        var result = new List<Completeness>();
        if (FamilyOf(tree, model, node) is not { } family) return result;

        foreach (var channel in model.Channels.Keys.Order())
        {
            foreach (var locale in model.Locales.Keys.Order())
            {
                var (required, missing) = Check(tree, model, node, family, channel, locale);
                if (required > 0) result.Add(new Completeness(channel, locale, required, required - missing.Length, missing));
            }
        }
        return result;
    }

    /// <summary>Was für Kanal und Sprache fehlt. <paramref name="locale"/> null = alle Sprachen zusammen.</summary>
    public static (int Required, string[] Missing) Check(Tree tree, ModelCatalog model, Node node, FamilyDefinition family, string channel, string? locale)
    {
        var locales = locale is null ? model.Locales.Keys.Order().ToList() : [locale];
        var required = 0;
        var missing = new List<string>();
        foreach (var fa in family.Attributes)
        {
            if (!model.Attributes.TryGetValue(fa.Key, out var def)) continue;
            if (fa.Required is null || !fa.Required.TryGetValue(channel, out var langs)) continue;
            foreach (var l in locales)
            {
                if (!langs.Contains("*") && !langs.Contains(l)) continue;
                required++;
                var ok = def.Type == AttributeTypes.Rows
                    ? node.Rows.TryGetValue(def.Key, out var rows) && rows.Count > 0
                    : tree.Resolve(node, def.Key, def.PerLocale ? l : null, def.PerChannel ? channel : null).Value is not null;
                if (!ok) missing.Add(def.PerLocale ? $"{def.Key}/{l}" : def.Key);
            }
        }
        return (required, missing.Distinct().ToArray());
    }
}
