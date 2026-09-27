using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;

namespace Journali.Tests;

/// <summary>
/// Sichtbar für Rollen (27.09.2026): ein Teilbaum oder ein Ordner nennt Rollen, die ihn sehen — ab dort abwärts, bis ein
/// Nachfahre eigene nennt. Ohne Anmeldung und als Administrator gilt nichts davon; leer heisst für alle.
/// </summary>
public class SichtbarkeitTests
{
    private static (Tree Tree, Media Media) Welt(params (string Stream, string Type, object Payload)[] eintraege)
    {
        var j = new MemoryJournal(); var cat = new ModelCatalog(); var tree = new Tree(); var media = new Media();
        foreach (var s in Model.Seeds()) j.Append("system", s.Stream, s.Type, s.Payload);
        foreach (var s in Model.TreeSeeds()) j.Append("system", s.Stream, s.Type, s.Payload);
        j.Append("t", "g-1", Types.GroupCreated, Types.Serialize(new GroupCreated(Model.RootNode, Labels.Of("Intern", "Internal"), "Intern")));
        j.Append("t", "p-1", Types.ProductCreated, Types.Serialize(new ProductCreated("g-1")));
        j.Append("t", "g-2", Types.GroupCreated, Types.Serialize(new GroupCreated("g-1", Labels.Of("Tief", "Deep"), "Tief")));
        j.Append("t", "mf-1", Types.MediaFolderCreated, Types.Serialize(new MediaFolderCreated("Geheim", null)));
        j.Append("t", "mf-2", Types.MediaFolderCreated, Types.Serialize(new MediaFolderCreated("Unten", "mf-1")));
        j.Append("t", "mf-3", Types.MediaFolderCreated, Types.Serialize(new MediaFolderCreated("Offen", null)));
        j.Append("t", "m-1", Types.MediaCreated, Types.Serialize(new MediaCreated("s1", 1, "image/png", "a.png")));
        j.Append("t", "m-1", Types.MediaFiled, Types.Serialize(new MediaFiled("mf-2")));
        j.Append("t", "m-2", Types.MediaCreated, Types.Serialize(new MediaCreated("s2", 1, "image/png", "b.png")));
        foreach (var (stream, type, payload) in eintraege) j.Append("t", stream, type, Types.Serialize(payload));
        Projector.CatchUpAll(j, cat, tree, media);
        return (tree, media);
    }

    [Fact]
    public void Ohne_Einschraenkung_sieht_jede_Rolle_alles()
    {
        var (tree, media) = Welt();
        Assert.True(tree.Visible(tree.Nodes["p-1"], "viewer"));
        Assert.Null(tree.RestrictionOf(tree.Nodes["p-1"]));
        Assert.True(media.Visible(media.All["m-1"], "viewer"));
        Assert.Null(media.FolderRestriction("mf-2"));
    }

    [Fact]
    public void Eine_Einschraenkung_gilt_ab_dort_abwaerts_bis_ein_Nachfahre_eigene_nennt()
    {
        var (tree, _) = Welt(("g-1", Types.NodeRestricted, new NodeRestricted(["editor"])), ("g-2", Types.NodeRestricted, new NodeRestricted(["viewer"])));
        Assert.True(tree.Visible(tree.Nodes["g-1"], "editor")); Assert.False(tree.Visible(tree.Nodes["g-1"], "viewer"));
        Assert.True(tree.Visible(tree.Nodes["p-1"], "editor")); Assert.False(tree.Visible(tree.Nodes["p-1"], "viewer"), "das Produkt erbt die Einschränkung der Gruppe");
        Assert.True(tree.Visible(tree.Nodes["g-2"], "viewer")); Assert.False(tree.Visible(tree.Nodes["g-2"], "editor"), "die eigene Einschränkung ersetzt die geerbte");
        Assert.True(tree.Visible(tree.Nodes[Model.RootNode], "viewer"), "die Wurzel ist nicht eingeschränkt");
        // ohne Anmeldung und als Administrator immer
        Assert.True(tree.Visible(tree.Nodes["p-1"], null)); Assert.True(tree.Visible(tree.Nodes["p-1"], "viewer", admin: true));
        // leer = aufgehoben
        var (tree2, _) = Welt(("g-1", Types.NodeRestricted, new NodeRestricted(["editor"])), ("g-1", Types.NodeRestricted, new NodeRestricted([])));
        Assert.True(tree2.Visible(tree2.Nodes["p-1"], "viewer"));
    }

    [Fact]
    public void Ein_Ordner_gilt_fuer_Unterordner_und_Medien_darin()
    {
        var (_, media) = Welt(("mf-1", Types.MediaFolderRestricted, new MediaFolderRestricted(["editor"])));
        Assert.Equal(["editor"], media.FolderRestriction("mf-2"));
        Assert.False(media.FolderVisible("mf-2", "viewer")); Assert.True(media.FolderVisible("mf-2", "editor"));
        Assert.False(media.Visible(media.All["m-1"], "viewer"), "das Medium im Unterordner");
        Assert.True(media.Visible(media.All["m-2"], "viewer"), "ein Medium ohne Ordner sieht jeder");
        Assert.True(media.FolderVisible("mf-3", "viewer"), "ein anderer Ordner ist nicht betroffen");
        Assert.True(media.Visible(media.All["m-1"], null)); Assert.True(media.Visible(media.All["m-1"], "viewer", admin: true));
    }

    [Fact]
    public void Beide_Typen_sind_Struktur_und_zaehlen_nicht()
    {
        Assert.Equal(Kinds.Structure, Kinds.Of(Types.NodeRestricted));
        Assert.Equal(Kinds.Structure, Kinds.Of(Types.MediaFolderRestricted));
    }
}
