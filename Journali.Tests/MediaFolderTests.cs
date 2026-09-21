using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Medienordner (Taloan, 21.09.2026: „Strukturbaum, um Medien dort zu organisieren, wie ein interner Dateimanager“):
// Ordner anlegen, verschachteln, Medien ablegen, nicht in sich selbst, nur leer löschen.
public class MediaFolderTests
{
    private sealed class World
    {
        public MemoryJournal J = new(); public ModelCatalog Cat = new(); public Tree Tree = new(); public Relations Rel = new(); public Media Media = new();
        public World() { foreach (var s in Model.Seeds()) J.Append("system", s.Stream, s.Type, s.Payload); Catch(); }
        public void Catch() { Projector.CatchUpAll(J, Cat, Tree, Rel, Media); }
        public Outcome Run(Func<Ctx, Outcome> cmd)
        {
            var o = cmd(new Ctx { Model = Cat, Tree = Tree, Relations = Rel, Media = Media, Write = (stream, type, payload) => { var e = J.Append("t", stream, type, Types.Serialize(payload)); Catch(); return e; } });
            return o;
        }
        public string Medium(string name) { var e = J.Append("t", Ids.Media(), Types.MediaCreated, Types.Serialize(new MediaCreated(Guid.NewGuid().ToString("N"), 10, "image/png", name))); Catch(); return e.Stream; }
        public string Folder(string name, string? parent = null) { var o = Run(c => Commands.CreateMediaFolder(c, name, parent)); Assert.Null(o.Error); return o.Entry!.Stream; }
    }

    [Fact]
    public void Ordner_verschachteln_Medien_ablegen_und_der_Pfad_stimmt()
    {
        var w = new World();
        var bilder = w.Folder("Bilder"); var logos = w.Folder("Logos", bilder);
        var m = w.Medium("logo.png");
        Assert.Null(w.Media.All[m].Folder);
        Assert.Null(w.Run(c => Commands.FileMedium(c, m, logos)).Error);
        Assert.Equal(logos, w.Media.All[m].Folder);
        Assert.Equal(new[] { "Bilder", "Logos" }, w.Media.PathOf(logos).Select(f => f.Name).ToArray());
        Assert.Equal(new[] { bilder, logos }.OrderBy(x => x), w.Media.FolderAndBelow(bilder).OrderBy(x => x));
        Assert.Single(w.Media.InFolder(logos)); Assert.Empty(w.Media.InFolder(bilder)); Assert.Empty(w.Media.InFolder(null));
        // nochmal dorthin: kein Eintrag
        Assert.NotNull(w.Run(c => Commands.FileMedium(c, m, logos)).Error);
        // zurück auf „kein Ordner“
        Assert.Null(w.Run(c => Commands.FileMedium(c, m, null)).Error);
        Assert.Null(w.Media.All[m].Folder);
    }

    [Fact]
    public void Gleicher_Name_im_selben_Ordner_nicht_in_sich_selbst_nur_leer_loeschen()
    {
        var w = new World();
        var a = w.Folder("A"); var b = w.Folder("B", a);
        Assert.NotNull(w.Run(c => Commands.CreateMediaFolder(c, "a", null)).Error);          // Name doppelt (Gross/klein egal)
        Assert.Null(w.Run(c => Commands.CreateMediaFolder(c, "A", a)).Error);                // anderer Vater: erlaubt
        Assert.NotNull(w.Run(c => Commands.MoveMediaFolder(c, a, b)).Error);                 // in den eigenen Unterordner: nein
        Assert.NotNull(w.Run(c => Commands.MoveMediaFolder(c, a, a)).Error);
        Assert.NotNull(w.Run(c => Commands.RetireMediaFolder(c, a)).Error);                  // nicht leer
        var m = w.Medium("x.png"); w.Run(c => Commands.FileMedium(c, m, b));
        Assert.NotNull(w.Run(c => Commands.RetireMediaFolder(c, b)).Error);                  // Medium drin
        w.Run(c => Commands.FileMedium(c, m, null));
        Assert.Null(w.Run(c => Commands.RetireMediaFolder(c, b)).Error);
        Assert.False(w.Media.Folders.ContainsKey(b));
        Assert.Null(w.Run(c => Commands.RenameMediaFolder(c, a, "Alles")).Error);
        Assert.Equal("Alles", w.Media.Folders[a].Name);
        // Ordner nach oben verschieben: Vater null
        var c2 = w.Folder("C", a);
        Assert.Null(w.Run(c => Commands.MoveMediaFolder(c, c2, null)).Error);
        Assert.Null(w.Media.Folders[c2].Parent);
    }
}
