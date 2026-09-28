using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Journali.Server;

/// <summary>
/// Die Fuge der Zugänge (28.09.2026): was ein Zugang, der Dateien liefert, können muss — auflisten, Verzeichnis anlegen,
/// umbenennen, lesen, schreiben, löschen. Dahinter steht je Art ein Treiber: das Dateisystem des Servers, WebDAV, FTP.
/// Wer Dateien braucht (der Browser, die Fächer der Jobs), fragt nur diese Schnittstelle — nie die Art.
/// <para><b>Pfade</b> sind bei fernen Treibern immer POSIX-Pfade ab der Wurzel des Zugangs (<c>/</c> = die URL bzw. das
/// Startverzeichnis). <c>..</c> gibt es nicht: ein Pfad kommt nie über die Wurzel des Zugangs hinaus (<see cref="Normal"/>).
/// Das Dateisystem des Servers behält seine echten Pfade — dort ist der Zugang der ganze Server.</para>
/// <para>Alles hier ist Transport. Kein Treiber weiss, was in den Dateien steht; das weiss das Plugin, das sie liest.</para>
/// </summary>
public interface IDateiTreiber
{
    Task<List<DateiEintrag>> ListeAsync(string pfad, CancellationToken ct = default);
    Task NeuesVerzeichnisAsync(string pfad, CancellationToken ct = default);
    Task UmbenennenAsync(string von, string nach, CancellationToken ct = default);
    Task<Stream> LesenAsync(string pfad, CancellationToken ct = default);
    Task SchreibenAsync(string pfad, Stream daten, CancellationToken ct = default);
    Task LoeschenAsync(string pfad, CancellationToken ct = default);
}

/// <summary>Ein Eintrag einer Liste: Name, voller Pfad im Zugang, Verzeichnis ja/nein, Grösse und Zeit (wenn bekannt).</summary>
public sealed record DateiEintrag(string Name, string Pfad, bool Verzeichnis, long Bytes, DateTimeOffset? Zeit);

public static class Treiber
{
    /// <summary>
    /// Ein ferner Pfad in seiner festen Form: beginnt mit <c>/</c>, keine doppelten Trenner, kein <c>.</c>, kein <c>..</c>,
    /// Rückstriche werden Schrägstriche. <c>..</c> wird abgewiesen statt aufgelöst — ein Zugang ist eine Wurzel, und
    /// was darüber liegt, gehört nicht zu ihm.
    /// </summary>
    public static string Normal(string? pfad)
    {
        var teile = (pfad ?? "").Replace('\\', '/').Split('/', StringSplitOptions.RemoveEmptyEntries).Where(t => t != ".").ToList();
        if (teile.Any(t => t == "..")) throw new ArgumentException("Pfad ohne .. — ein Zugang ist eine Wurzel.");
        return "/" + string.Join('/', teile);
    }

    /// <summary>Der Vater eines fernen Pfads; die Wurzel hat keinen.</summary>
    public static string? Vater(string pfad)
    {
        var p = Normal(pfad);
        if (p == "/") return null;
        var i = p.LastIndexOf('/');
        return i <= 0 ? "/" : p[..i];
    }

    public static string Kind(string pfad, string name) => Normal(Normal(pfad).TrimEnd('/') + "/" + name);

    /// <summary>Der Treiber für einen Zugang, der Dateien liefert — oder null, wenn die Art keine liefert.</summary>
    public static IDateiTreiber? Fuer(DriverApi.Zugang z, IReadOnlyDictionary<string, string> geheim, HttpMessageHandler? handler = null) => z.Art switch
    {
        "file" => new LokalTreiber(),
        "webdav" => new WebDavTreiber(z.Felder.GetValueOrDefault("url") ?? "", z.Felder.GetValueOrDefault("user"), geheim.GetValueOrDefault("password"), handler),
        "ftp" => new FtpTreiber(z.Felder.GetValueOrDefault("host") ?? "", int.TryParse(z.Felder.GetValueOrDefault("port"), out var port) ? port : 21,
            z.Felder.GetValueOrDefault("user"), geheim.GetValueOrDefault("password"), z.Felder.GetValueOrDefault("pfad"),
            z.Felder.GetValueOrDefault("tls") is { } tls && Regex.IsMatch(tls.Trim(), "^(ja|yes|true|1|an)$", RegexOptions.IgnoreCase)),
        _ => null,
    };

    /// <summary>
    /// Die Antwort des Dateibrowsers für einen fernen Zugang — dieselbe Form wie <see cref="FileApi"/>: Pfad, Vater, Wurzeln,
    /// Verzeichnisse, Dateien (neueste zuerst). So bleibt der Browser derselbe, egal wo die Dateien liegen.
    /// </summary>
    public static object Antwort(string label, string pfad, IEnumerable<DateiEintrag> eintraege)
    {
        var liste = eintraege.Where(e => !e.Name.StartsWith('.')).ToList();
        return new
        {
            path = pfad, parent = Vater(pfad),
            roots = new[] { new { label = "⌂ " + label, path = "/" } },
            dirs = liste.Where(e => e.Verzeichnis).OrderBy(e => e.Name, StringComparer.OrdinalIgnoreCase).Select(e => new { name = e.Name, path = e.Pfad }).ToList(),
            files = liste.Where(e => !e.Verzeichnis).OrderByDescending(e => e.Zeit ?? DateTimeOffset.MinValue)
                .Select(e => new { name = e.Name, path = e.Pfad, size = e.Bytes, at = e.Zeit?.UtcDateTime }).ToList(),
            blobs = 0,
        };
    }

    /// <summary>Passt ein Dateiname auf eines der Muster (<c>*.json;*.csv</c>, <c>*</c> = alles)? Gross/klein egal.</summary>
    public static bool Passt(string name, IEnumerable<string> muster) =>
        muster.Any(m => Regex.IsMatch(name, "^" + Regex.Escape(m.Trim()).Replace("\\*", ".*").Replace("\\?", ".") + "$", RegexOptions.IgnoreCase));
}

/// <summary>Das Dateisystem des Servers hinter derselben Fuge — mit seinen echten Pfaden.</summary>
public sealed class LokalTreiber : IDateiTreiber
{
    public Task<List<DateiEintrag>> ListeAsync(string pfad, CancellationToken ct = default)
    {
        var info = new DirectoryInfo(pfad);
        var liste = info.EnumerateDirectories().Select(d => new DateiEintrag(d.Name, d.FullName, true, 0, d.LastWriteTimeUtc))
            .Concat(info.EnumerateFiles().Select(f => new DateiEintrag(f.Name, f.FullName, false, f.Length, f.LastWriteTimeUtc))).ToList();
        return Task.FromResult(liste);
    }
    public Task NeuesVerzeichnisAsync(string pfad, CancellationToken ct = default) { Directory.CreateDirectory(pfad); return Task.CompletedTask; }
    public Task UmbenennenAsync(string von, string nach, CancellationToken ct = default)
    {
        if (Directory.Exists(von)) Directory.Move(von, nach); else File.Move(von, nach);
        return Task.CompletedTask;
    }
    public Task<Stream> LesenAsync(string pfad, CancellationToken ct = default) => Task.FromResult<Stream>(File.OpenRead(pfad));
    public async Task SchreibenAsync(string pfad, Stream daten, CancellationToken ct = default)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(pfad)!);
        await using var f = File.Create(pfad);
        await daten.CopyToAsync(f, ct);
    }
    public Task LoeschenAsync(string pfad, CancellationToken ct = default) { File.Delete(pfad); return Task.CompletedTask; }
}

/// <summary>
/// WebDAV über HttpClient: PROPFIND (Tiefe 1) listet, MKCOL legt an, MOVE benennt um, GET/PUT/DELETE lesen, schreiben,
/// löschen. Anmeldung Basic. Kein Paket — WebDAV ist HTTP mit ein paar Verben mehr.
/// </summary>
public sealed class WebDavTreiber : IDateiTreiber
{
    private readonly Uri _basis;
    private readonly HttpClient _http;
    private static readonly XNamespace D = "DAV:";

    public WebDavTreiber(string url, string? user, string? password, HttpMessageHandler? handler = null)
    {
        if (!Uri.TryCreate(url.Trim().TrimEnd('/') + "/", UriKind.Absolute, out var basis) || basis.Scheme is not ("http" or "https"))
            throw new ArgumentException("WebDAV: url mit http:// oder https://.");
        _basis = basis;
        _http = handler is null ? new HttpClient() : new HttpClient(handler, disposeHandler: false);
        _http.Timeout = TimeSpan.FromMinutes(5);
        if (!string.IsNullOrEmpty(user))
            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{user}:{password}")));
    }

    /// <summary>Die URL eines Pfads im Zugang — jedes Stück einzeln kodiert, damit Leerzeichen und Umlaute gehen.</summary>
    public Uri Url(string pfad, bool verzeichnis = false)
    {
        var p = Treiber.Normal(pfad);
        var teile = p.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(Uri.EscapeDataString);
        var rel = string.Join('/', teile) + (verzeichnis && p != "/" ? "/" : "");
        return new Uri(_basis, rel);
    }

    private async Task<HttpResponseMessage> Senden(HttpMethod m, Uri url, HttpContent? inhalt, Action<HttpRequestMessage>? mehr, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(m, url) { Content = inhalt };
        mehr?.Invoke(req);
        var res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!res.IsSuccessStatusCode) { var code = (int)res.StatusCode; res.Dispose(); throw new IOException($"WebDAV {m.Method} {url.AbsolutePath}: {code}"); }
        return res;
    }

    public async Task<List<DateiEintrag>> ListeAsync(string pfad, CancellationToken ct = default)
    {
        var p = Treiber.Normal(pfad);
        var url = Url(p, verzeichnis: true);
        const string body = "<?xml version=\"1.0\" encoding=\"utf-8\"?><d:propfind xmlns:d=\"DAV:\"><d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/></d:prop></d:propfind>";
        using var res = await Senden(new HttpMethod("PROPFIND"), url, new StringContent(body, Encoding.UTF8, "application/xml"), r => r.Headers.Add("Depth", "1"), ct);
        return Lesen(await res.Content.ReadAsStringAsync(ct), url, p);
    }

    /// <summary>Die Antwort auf PROPFIND lesen: je <c>response</c> ein Eintrag, der erste (das Verzeichnis selbst) fällt weg.</summary>
    public List<DateiEintrag> Lesen(string xml, Uri verzeichnis, string pfad)
    {
        var doc = XDocument.Parse(xml);
        var aus = new List<DateiEintrag>();
        var selbst = verzeichnis.AbsolutePath.TrimEnd('/');
        foreach (var r in doc.Descendants(D + "response"))
        {
            var href = r.Element(D + "href")?.Value?.Trim(); if (string.IsNullOrEmpty(href)) continue;
            var absolut = Uri.TryCreate(verzeichnis, href, out var u) ? u.AbsolutePath : href;
            if (absolut.TrimEnd('/') == selbst) continue;   // das Verzeichnis selbst
            var name = Uri.UnescapeDataString(absolut.TrimEnd('/').Split('/').Last());
            if (name.Length == 0) continue;
            var prop = r.Descendants(D + "prop").FirstOrDefault();
            var ordner = prop?.Element(D + "resourcetype")?.Element(D + "collection") is not null;
            long.TryParse(prop?.Element(D + "getcontentlength")?.Value, out var bytes);
            DateTimeOffset? zeit = DateTimeOffset.TryParse(prop?.Element(D + "getlastmodified")?.Value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var z) ? z : null;
            aus.Add(new DateiEintrag(name, Treiber.Kind(pfad, name), ordner, ordner ? 0 : bytes, zeit));
        }
        return aus;
    }

    public async Task NeuesVerzeichnisAsync(string pfad, CancellationToken ct = default)
    {
        using var res = await _http.SendAsync(new HttpRequestMessage(new HttpMethod("MKCOL"), Url(pfad, true)), ct);
        // 405: gibt es schon — dann ist nichts zu tun
        if (!res.IsSuccessStatusCode && res.StatusCode != HttpStatusCode.MethodNotAllowed) throw new IOException($"WebDAV MKCOL {pfad}: {(int)res.StatusCode}");
    }

    public async Task UmbenennenAsync(string von, string nach, CancellationToken ct = default)
    {
        using var _ = await Senden(new HttpMethod("MOVE"), Url(von), null, r => { r.Headers.Add("Destination", Url(nach).AbsoluteUri); r.Headers.Add("Overwrite", "F"); }, ct);
    }

    public async Task<Stream> LesenAsync(string pfad, CancellationToken ct = default)
    {
        var res = await Senden(HttpMethod.Get, Url(pfad), null, null, ct);
        return await res.Content.ReadAsStreamAsync(ct);
    }

    public async Task SchreibenAsync(string pfad, Stream daten, CancellationToken ct = default)
    {
        using var _ = await Senden(HttpMethod.Put, Url(pfad), new StreamContent(daten), null, ct);
    }

    public async Task LoeschenAsync(string pfad, CancellationToken ct = default)
    {
        using var _ = await Senden(HttpMethod.Delete, Url(pfad), null, null, ct);
    }
}

/// <summary>
/// FTP über die Bordmittel von .NET (FtpWebRequest), mit explizitem TLS, wenn <c>tls</c> gesetzt ist. Kein Paket: die
/// Klasse ist als veraltet markiert, weil Microsoft sie nicht weiterentwickelt, sie tut aber, was ein Ablagezugang braucht.
/// Gelistet wird mit LIST, weil MLSD nicht jeder Server kann; die Zeilen liest <see cref="Zeile"/> (Unix- und DOS-Form).
/// </summary>
public sealed class FtpTreiber : IDateiTreiber
{
    private readonly string _host; private readonly int _port; private readonly string? _user, _password; private readonly string _start; private readonly bool _tls;

    public FtpTreiber(string host, int port, string? user, string? password, string? start, bool tls)
    {
        _host = host.Trim(); if (_host.Length == 0 || _host.Contains('/')) throw new ArgumentException("FTP: host ohne Schema und Pfad, z. B. ftp.example.invalid.");
        _port = port is > 0 and < 65536 ? port : 21; _user = user; _password = password; _start = Treiber.Normal(start); _tls = tls;
    }

    /// <summary>Der Pfad auf dem Server: Startverzeichnis des Zugangs plus Pfad im Zugang.</summary>
    public string Voll(string pfad) => Treiber.Normal(_start.TrimEnd('/') + Treiber.Normal(pfad));

#pragma warning disable SYSLIB0014   // FtpWebRequest: veraltet markiert, aber vorhanden und ohne Ersatz im Rahmenwerk
    private FtpWebRequest Anfrage(string pfad, string methode)
    {
        var teile = Voll(pfad).Split('/', StringSplitOptions.RemoveEmptyEntries).Select(Uri.EscapeDataString);
        var r = (FtpWebRequest)WebRequest.Create(new Uri($"ftp://{_host}:{_port}/{string.Join('/', teile)}"));
        r.Method = methode; r.EnableSsl = _tls; r.UseBinary = true; r.UsePassive = true; r.KeepAlive = false; r.Timeout = 60_000;
        r.Credentials = string.IsNullOrEmpty(_user) ? new NetworkCredential("anonymous", "journali@") : new NetworkCredential(_user, _password ?? "");
        return r;
    }
#pragma warning restore SYSLIB0014

    private static async Task<FtpWebResponse> Antwort(FtpWebRequest r, string pfad)
    {
        try { return (FtpWebResponse)await r.GetResponseAsync(); }
        catch (WebException e) when (e.Response is FtpWebResponse f) { var text = f.StatusDescription?.Trim(); f.Dispose(); throw new IOException($"FTP {r.Method} {pfad}: {text}"); }
    }

    public async Task<List<DateiEintrag>> ListeAsync(string pfad, CancellationToken ct = default)
    {
        var p = Treiber.Normal(pfad);
        using var res = await Antwort(Anfrage(p, WebRequestMethods.Ftp.ListDirectoryDetails), p);
        using var reader = new StreamReader(res.GetResponseStream());
        var aus = new List<DateiEintrag>();
        while (await reader.ReadLineAsync(ct) is { } line)
            if (Zeile(line, DateTimeOffset.UtcNow) is { } z && z.Name is not ("." or "..")) aus.Add(z with { Pfad = Treiber.Kind(p, z.Name) });
        return aus;
    }

    private static readonly Regex Unix = new(@"^([dl-])[rwxstST-]{9}\S*\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\w{3})\s+(\d{1,2})\s+(\d{1,2}:\d{2}|\d{4})\s+(.+)$");
    private static readonly Regex Dos = new(@"^(\d{2})-(\d{2})-(\d{2,4})\s+(\d{1,2}):(\d{2})(AM|PM)?\s+(<DIR>|\d+)\s+(.+)$", RegexOptions.IgnoreCase);

    /// <summary>
    /// Eine Zeile der LIST-Antwort lesen. Unix: <c>drwxr-xr-x 2 u g 4096 Sep 27 10:00 name</c> (Jahr statt Uhrzeit bei
    /// älteren Dateien); DOS: <c>09-27-26  10:00AM  &lt;DIR&gt;  name</c>. Ein Link zählt als Datei unter seinem Namen ohne Ziel.
    /// Was keine der beiden Formen hat, ist null — lieber eine Zeile weniger als ein falscher Eintrag.
    /// </summary>
    public static DateiEintrag? Zeile(string line, DateTimeOffset jetzt)
    {
        var u = Unix.Match(line);
        if (u.Success)
        {
            var name = u.Groups[6].Value; if (u.Groups[1].Value == "l" && name.IndexOf(" -> ", StringComparison.Ordinal) is var a and > 0) name = name[..a];
            var monat = DateTime.ParseExact(u.Groups[3].Value, "MMM", CultureInfo.InvariantCulture).Month;
            var tag = int.Parse(u.Groups[4].Value); var zj = u.Groups[5].Value;
            DateTimeOffset zeit;
            if (zj.Contains(':'))
            {   // ohne Jahr: dieses Jahr, ausser das Datum läge in der Zukunft — dann das Jahr davor
                var hm = zj.Split(':');
                zeit = new DateTimeOffset(jetzt.Year, monat, tag, int.Parse(hm[0]), int.Parse(hm[1]), 0, TimeSpan.Zero);
                if (zeit > jetzt.AddDays(1)) zeit = zeit.AddYears(-1);
            }
            else zeit = new DateTimeOffset(int.Parse(zj), monat, tag, 0, 0, 0, TimeSpan.Zero);
            return new DateiEintrag(name, name, u.Groups[1].Value == "d", long.Parse(u.Groups[2].Value), zeit);
        }
        var d = Dos.Match(line);
        if (d.Success)
        {
            var jahr = int.Parse(d.Groups[3].Value); if (jahr < 100) jahr += 2000;
            var stunde = int.Parse(d.Groups[4].Value);
            if (d.Groups[6].Value.Equals("PM", StringComparison.OrdinalIgnoreCase) && stunde < 12) stunde += 12;
            if (d.Groups[6].Value.Equals("AM", StringComparison.OrdinalIgnoreCase) && stunde == 12) stunde = 0;
            var zeit = new DateTimeOffset(jahr, int.Parse(d.Groups[1].Value), int.Parse(d.Groups[2].Value), stunde, int.Parse(d.Groups[5].Value), 0, TimeSpan.Zero);
            var ordner = d.Groups[7].Value.Equals("<DIR>", StringComparison.OrdinalIgnoreCase);
            return new DateiEintrag(d.Groups[8].Value, d.Groups[8].Value, ordner, ordner ? 0 : long.Parse(d.Groups[7].Value), zeit);
        }
        return null;
    }

    public async Task NeuesVerzeichnisAsync(string pfad, CancellationToken ct = default)
    {
        try { using var _ = await Antwort(Anfrage(pfad, WebRequestMethods.Ftp.MakeDirectory), pfad); }
        catch (IOException)
        {   // gibt es schon? Dann ist nichts zu tun — sonst war es ein echter Fehler
            if (!(await ListeAsync(Treiber.Vater(pfad) ?? "/", ct)).Any(e => e.Verzeichnis && e.Pfad == Treiber.Normal(pfad))) throw;
        }
    }

    public async Task UmbenennenAsync(string von, string nach, CancellationToken ct = default)
    {
        var r = Anfrage(von, WebRequestMethods.Ftp.Rename);
        r.RenameTo = Voll(nach);   // absolut ab der Wurzel des Servers — dasselbe Startverzeichnis wie von
        using var _ = await Antwort(r, von);
    }

    public async Task<Stream> LesenAsync(string pfad, CancellationToken ct = default)
    {
        using var res = await Antwort(Anfrage(pfad, WebRequestMethods.Ftp.DownloadFile), pfad);
        var puffer = new MemoryStream();
        await res.GetResponseStream().CopyToAsync(puffer, ct);
        puffer.Position = 0;
        return puffer;
    }

    public async Task SchreibenAsync(string pfad, Stream daten, CancellationToken ct = default)
    {
        var r = Anfrage(pfad, WebRequestMethods.Ftp.UploadFile);
        await using (var ziel = await r.GetRequestStreamAsync()) await daten.CopyToAsync(ziel, ct);
        using var _ = await Antwort(r, pfad);
    }

    public async Task LoeschenAsync(string pfad, CancellationToken ct = default)
    {
        using var _ = await Antwort(Anfrage(pfad, WebRequestMethods.Ftp.DeleteFile), pfad);
    }
}
