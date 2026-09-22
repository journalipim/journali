using Journali.Core.Entries;
using Journali.Core.Journal;
using Journali.Core.Projections;
using Journali.Server;

namespace Journali.Tests;

// Schnappschuss der Abbilder (Taloan, 21.09.2026): Stand bei #n als Datei, beim Start nur der Rest — und das Ergebnis muss dem
// vollen Aufbau aus dem Journal gleichen: Baum, Werte (auch geerbt), Relationen mit Werten, Medien, Ordner, Publikation, Jobs, Benutzer.
public class SnapshotTests
{
    private static string TempFile() => Path.Combine(Path.GetTempPath(), "journali-snap-" + Guid.NewGuid().ToString("N") + ".json");

    /// <summary>Ein Journal mit allem, was die Abbilder kennen — geschrieben über den Katalog (echter Schreibpfad).</summary>
    private static MemoryJournal World()
    {
        var j = new MemoryJournal();
        var c = new Catalog(j); c.Rebuild(); c.SeedMissing();
        string root = "", product = "", v1 = "", medium = "", folder = "";
        c.With((_, _, write) =>
        {
            root = write("t", Ids.New(Roles.Group), Types.GroupCreated, new GroupCreated(null, Labels.Of("Notebooks", "Notebooks")), null).Stream;
            product = write("t", Ids.New(Roles.Product), Types.ProductCreated, new ProductCreated(root), null).Stream;
            v1 = write("t", Ids.New(Roles.Variant), Types.VariantCreated, new VariantCreated(product, new() { ["color"] = "rot" }), null).Stream;
            write("t", root, Types.AttributeSet, new AttributeSet("name", "de", null, "Notebooks", null), null);
            write("t", product, Types.AttributeSet, new AttributeSet("name", "de", null, "X1", null), null);
            write("t", v1, Types.AttributeSet, new AttributeSet("sku", null, null, "X1-R", null), null);
            write("t", v1, Types.StatusSet, new StatusSet("active"), null);
            write("t", v1, Types.ReleaseGranted, new ReleaseGranted("web", null), null);
            var rel = write("t", Ids.Relation(), Types.RelationCreated, new RelationCreated("accessory", product, v1), null).Stream;
            write("t", rel, Types.AttributeSet, new AttributeSet("quantity", null, null, "3", null), null);
            medium = write("t", Ids.Media(), Types.MediaCreated, new MediaCreated("abc123", 10, "image/png", "logo.png"), null).Stream;
            write("t", medium, Types.AttributeSet, new AttributeSet("alt_text", "de", null, "Logo", null), null);
            folder = write("t", Ids.MediaFolder(), Types.MediaFolderCreated, new MediaFolderCreated("Bilder", null), null).Stream;
            write("t", medium, Types.MediaFiled, new MediaFiled(folder), null);
            var mrel = write("t", Ids.Relation(), Types.RelationCreated, new RelationCreated("image", product, medium), null).Stream;
            write("t", mrel, Types.AttributeSet, new AttributeSet("inherit", null, null, "true", null), null);
            write("t", Ids.New(Roles.Rubric), Types.RubricCreated, new RubricCreated(null, new(), "Web", "web", null), null);
            write("t", Jobs.Stream + "nightly", Types.JobDefined, new JobDefined("Nightly", "backup", new() { ["dir"] = "x" }, "0 2 * * *", true, 30, null), null);
            write("t", Users.Stream + "taloan", Types.UserDefined, new UserDefined("Taloan", null, "admin", true), null);
            write("t", "plugin:backup", Types.PluginDataSet, new PluginDataSet("profile:a", "{\"root\":\"" + root + "\"}"), null);
            write("t", v1, Types.VersionCreated, new VersionCreated(1, 5, "web", "de", "erste"), null);
            write("t", v1, Types.VersionDocumentAdded, new VersionDocumentAdded(1, "datasheet", medium, "abc123", "application/pdf", "blatt.pdf", 10, null), null);
            return 0;
        });
        return j;
    }

    private static string Fingerprint(Catalog c) => c.With((model, tree, _) =>
    {
        var nodes = tree.Nodes.Values.OrderBy(n => n.Id).Select(n => $"{n.Id}:{n.Role}:{n.Parent}:{n.Status}:{tree.Resolve(model, n, "name", "de", null).Value}:{string.Join(",", n.Groups)}:{n.Releases.Count}:{string.Join(",", n.AxisValues.Select(kv => kv.Key + "=" + kv.Value))}");
        var rels = c.Relations.All.Values.OrderBy(r => r.Id).Select(r => $"{r.Id}:{r.Type}:{r.From}>{r.To}:{string.Join(",", r.Values.OrderBy(kv => kv.Key.Attribute).Select(kv => kv.Key.Attribute + "=" + kv.Value))}");
        var media = c.Media.All.Values.OrderBy(m => m.Id).Select(m => $"{m.Id}:{m.Name}:{m.Sha256}:{m.Folder}:{string.Join(",", m.Values.Select(kv => kv.Key.Attribute + "/" + kv.Key.Locale + "=" + kv.Value))}");
        var folders = c.Media.Folders.Values.OrderBy(f => f.Id).Select(f => $"{f.Id}:{f.Name}:{f.Parent}");
        var jobs = c.Jobs.All.Values.Select(x => $"{x.Key}:{x.Plugin}:{x.Schedule}:{x.Params.Count}");
        var users = c.Users.All.Values.Select(u => $"{u.Key}:{u.Role}:{u.Enabled}") .Concat(c.Users.Roles.Values.Select(r => $"{r.Key}:{string.Join("+", r.Rights.Order())}"));
        var plugins = c.Plugins.All.Values.Select(p => $"{p.Key}:{p.Enabled}:{string.Join(",", p.Data.Keys.Order())}");
        var versions = tree.Nodes.Keys.Concat(tree.Retired.Keys).SelectMany(id => c.Versions.Of(id)).Select(v => $"v:{v.Node}:{v.Nr}:{v.Channel}/{v.Locale}:{v.Withdrawn}:{string.Join(",", v.Documents.Select(d => d.Kind + "=" + d.Name))}");
        return string.Join("\n", nodes.Concat(rels).Concat(media).Concat(folders).Concat(jobs).Concat(users).Concat(plugins).Concat(versions)
            .Append($"model:{model.Attributes.Count}/{model.Groups.Count}/{model.Lists.Count}/{model.RelationTypes.Count}/{model.Locales.Count}/{model.Views.Count}/{model.MasterLocale}")
            .Append($"pub:{string.Join(",", tree.PubTrees.Select(p => p.Id + "/" + p.Channel))}")
            .Append($"placed:{string.Join(",", tree.Nodes.Values.SelectMany(n => n.Placed).Order())}"));
    });

    [Fact]
    public void Schnappschuss_laden_ergibt_denselben_Stand_wie_der_volle_Aufbau_und_der_Rest_wird_angewandt()
    {
        var path = TempFile();
        try
        {
            var j = World();
            var full = new Catalog(j); full.Rebuild();
            var before = Fingerprint(full);
            Assert.Contains("quantity=3", before); Assert.Contains("logo.png", before); Assert.Contains("nightly:backup", before); Assert.Contains("datasheet=blatt.pdf", before);
            var n = full.SaveSnapshot(path);
            Assert.Equal(j.Head, n);
            Assert.True(File.Exists(path));

            // zweiter Start: laden, nichts Neues — gleicher Stand
            var again = new Catalog(j);
            Assert.Equal(n, again.LoadSnapshot(path));
            var applied = again.Rebuild();
            Assert.Equal(0, applied);
            Assert.Equal(before, Fingerprint(again));

            // dritter Start: Journal ist weitergelaufen — nur der Rest wird angewandt, Ergebnis wie voller Aufbau
            var v1 = j.ReadAfter(0).First(e => e.Type == Types.VariantCreated).Stream;
            j.Append("t", v1, Types.AttributeSet, Types.Serialize(new AttributeSet("sku", null, null, "X1-R2", null)));
            j.Append("t", v1, Types.NodeRetired, Types.Serialize(new NodeRetired()));
            var third = new Catalog(j);
            Assert.Equal(n, third.LoadSnapshot(path));
            Assert.Equal(2, third.Rebuild());
            var reference = new Catalog(j); reference.Rebuild();
            Assert.Equal(Fingerprint(reference), Fingerprint(third));
            Assert.True(third.With((_, tree, _) => tree.Retired.ContainsKey(v1)));
            // und der Katalog schreibt danach ganz normal weiter
            third.With((_, _, write) => write("t", v1, Types.NodeRestored, new NodeRestored(), null).Number);
            Assert.True(third.With((_, tree, _) => tree.Nodes.ContainsKey(v1)));
        }
        finally { if (File.Exists(path)) File.Delete(path); }
    }

    [Fact]
    public void Schnappschuss_wird_verworfen_wenn_das_Journal_nicht_passt()
    {
        var path = TempFile();
        try
        {
            var j = World();
            var c = new Catalog(j); c.Rebuild(); c.SaveSnapshot(path);
            // anderes Journal mit gleicher Länge, anderem Inhalt am Ende
            var other = new MemoryJournal();
            foreach (var e in j.ReadAfter(0).Take((int)j.Head - 1)) other.Append(e.Actor, e.Stream, e.Type, e.Payload);
            other.Append("x", "g-zzzz", Types.GroupCreated, Types.Serialize(new GroupCreated(null, Labels.Of("Fremd", "Alien"))));
            var c2 = new Catalog(other);
            Assert.Equal(0, c2.LoadSnapshot(path));
            Assert.False(File.Exists(path));
            // Journal kürzer als der Schnappschuss: auch weg
            c.SaveSnapshot(path);
            var shorter = new MemoryJournal();
            foreach (var e in j.ReadAfter(0).Take(3)) shorter.Append(e.Actor, e.Stream, e.Type, e.Payload);
            Assert.Equal(0, new Catalog(shorter).LoadSnapshot(path));
            Assert.False(File.Exists(path));
        }
        finally { if (File.Exists(path)) File.Delete(path); }
    }
}
