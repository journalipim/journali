namespace Journali.Server;

/// <summary>
/// Das Ende eines Logs lesen (04.10.2026): ein Lauf kann hunderte MB schreiben, und die Oberfläche fragt während des Laufs alle paar
/// Sekunden nach. Gelesen wird höchstens das Ende, nie die ganze Datei.
/// </summary>
public static class LogLesen
{
    /// <summary>So viel liest eine Anfrage höchstens vom Ende eines Logs</summary>
    public static int Max = 16 * 1024 * 1024;

    /// <summary>
    /// Das Ende der Datei: mit <paramref name="zeilen"/> &gt; 0 die letzten so vielen Zeilen (rückwärts in Blöcken gesucht), sonst alles —
    /// beides höchstens <paramref name="maxBytes"/>. Ist dabei etwas abgeschnitten, beginnt der Text mit der ersten ganzen Zeile und „… “.
    /// </summary>
    public static string Ende(string pfad, int zeilen = 0, int? maxBytes = null)
    {
        if (!File.Exists(pfad)) return "";
        try
        {
            using var fs = new FileStream(pfad, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            var laenge = fs.Length;
            var grenze = Math.Max(0, laenge - (maxBytes ?? Max));
            var start = grenze;
            if (zeilen > 0)
            {
                // rückwärts, bis zeilen + 1 Zeilenumbrüche gefunden sind — danach beginnt der Text, der die letzten Zeilen enthält
                var block = new byte[64 * 1024]; var pos = laenge; var gefunden = 0;
                while (pos > grenze && gefunden <= zeilen)
                {
                    var n = (int)Math.Min(block.Length, pos - grenze); pos -= n;
                    fs.Seek(pos, SeekOrigin.Begin); fs.ReadExactly(block, 0, n);
                    for (var i = n - 1; i >= 0; i--)
                        if (block[i] == (byte)'\n' && ++gefunden > zeilen) { start = pos + i + 1; break; }
                }
            }
            fs.Seek(start, SeekOrigin.Begin);
            using var sr = new StreamReader(fs);
            var text = sr.ReadToEnd();
            if (start == grenze && grenze > 0) { var nl = text.IndexOf('\n'); text = "… " + (nl >= 0 ? text[(nl + 1)..] : ""); }
            return zeilen > 0 ? Letzte(text, zeilen) : text;
        }
        catch (IOException) { return ""; }
    }

    /// <summary>Die letzten <paramref name="zeilen"/> Zeilen eines Texts (wie bisher: geteilt am Zeilenumbruch)</summary>
    public static string Letzte(string text, int zeilen)
    {
        var lines = text.Split('\n');
        return lines.Length > zeilen ? string.Join('\n', lines[^zeilen..]) : text;
    }
}
