using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

/// <summary>
/// Attribute von DPP, PPWR, GEO, ETIM und GPC sind vererbbar (07.10.2026): ihre Werte pflegt man am Produkt oder an der Gruppe, sie gelten nach
/// unten. Eine Instanz von vorher zieht beim Start nach — nur, was in der angemeldeten Gruppe des Plugins zu Hause ist.
/// </summary>
public class PluginVererbbarTests
{
    [Fact]
    public void Die_Attribute_der_Plugins_werden_vererbbar_eigene_bleiben()
    {
        var c = new Catalog(new MemoryJournal()); c.Rebuild(); c.SeedMissing();
        c.With((_, _, write) =>
        {
            write("t", Model.GroupStream + "regulation_dpp", Types.AttributeGroupDefined, new AttributeGroupDefinition("regulation_dpp", Labels.Of("DPP", "DPP")), null);
            write("t", Model.AttributeStream + "dpp_material", Types.AttributeDefined, new AttributeDefinition("dpp_material", Labels.Of("Material", "Material"), AttributeTypes.Text, Group: "regulation_dpp"), null);
            write("t", Model.AttributeStream + "dpp_gtin", Types.AttributeDefined, new AttributeDefinition("dpp_gtin", Labels.Of("GTIN", "GTIN"), AttributeTypes.Text, Group: "regulation_dpp"), null);
            write("t", Model.AttributeStream + "mein_gewicht", Types.AttributeDefined, new AttributeDefinition("mein_gewicht", Labels.Of("Gewicht", "Weight"), AttributeTypes.Decimal, Group: "physical"), null);
            write("t", Model.AttributeStream + "fremd", Types.AttributeDefined, new AttributeDefinition("fremd", Labels.Of("Fremd", "Other"), AttributeTypes.Text, Group: "regulation_x"), null);
            foreach (var (plugin, gruppe, attrs) in new[] { ("dpp", "regulation_dpp", "\"dpp_material\",\"dpp_gtin\",\"mein_gewicht\""), ("andere", "regulation_x", "\"fremd\"") })
            {
                write("t", Plugins.Stream + plugin, Types.PluginInstalled, new PluginInstalled("1.0.0", "{}"), null);
                write("t", Plugins.Stream + plugin, Types.PluginDataSet, new PluginDataSet("system", $"{{\"groups\":[\"{gruppe}\"],\"attributes\":[{attrs}]}}"), null);
            }
            return 0;
        });

        Assert.Equal(1, ClassificationApi.PluginAttributeVererbbar(c));
        Assert.True(c.Lesen((m, _) => m.Attributes["dpp_material"].Inheritable));
        Assert.False(c.Lesen((m, _) => m.Attributes["mein_gewicht"].Inheritable));   // zugeordnet, aber nicht in der Gruppe des Plugins
        Assert.False(c.Lesen((m, _) => m.Attributes["fremd"].Inheritable));          // ein anderes Plugin
        Assert.False(c.Lesen((m, _) => m.Attributes["dpp_gtin"].Inheritable));       // eine Kennung erbt nicht
        Assert.Equal(0, ClassificationApi.PluginAttributeVererbbar(c));               // der nächste Start schreibt nichts
    }
}
