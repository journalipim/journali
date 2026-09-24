using System.Reflection;
using System.Reflection.Emit;
using System.Security.Cryptography;
using System.Text;

namespace Journali.Core.Projections;

/// <summary>
/// Der Fingerabdruck der Kern-Logik — der Stempel des Schnappschusses (Taloan, 24.09.2026: „ich will verhindern, dass ein
/// Serverstart nach zwei Jahren Nutzung zu einem halben Tag Betriebsausfall führt“). Bis dahin war der Stempel die
/// ModuleVersionId des Kerns; in ihr steckt der Git-Commit (das SDK schreibt ihn in die InformationalVersion,
/// <c>1.0.0+508ad1a…</c>) — jeder Commit liess den Schnappschuss fallen, auch wenn der Kern gleich war, und jeder Start
/// danach spielte das ganze Journal ab.
/// <para>Jetzt: ein Hash über alle Typen des Kerns — Name, Basis, Felder, und je Methode Signatur, lokale Variablen und
/// Code. Verweise im Code (Felder, Methoden, Typen, Texte) gehen als Namen ein, nicht als Metadatennummern: die
/// verschieben sich, sobald irgendwo im Kern ein Typ dazukommt. Er ändert sich also, wenn sich die Logik ändert, nach
/// der die Abbilder rechnen — nicht bei Kommentaren, nicht bei Server oder Oberfläche, nicht bei einem neuen Commit.
/// Dazu die Fassung der Laufzeit: sie liest und schreibt die Datei.</para>
/// </summary>
public static class Fingerabdruck
{
    private static readonly Dictionary<short, OpCode> Codes = typeof(OpCodes).GetFields(BindingFlags.Public | BindingFlags.Static)
        .Select(f => (OpCode)f.GetValue(null)!).ToDictionary(o => o.Value);

    private const BindingFlags Alle = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly;

    public static string Von(Assembly assembly)
    {
        var sb = new StringBuilder();
        sb.Append("runtime ").Append(Environment.Version.Major).Append('.').Append(Environment.Version.Minor).Append('\n');
        foreach (var t in assembly.GetTypes().OrderBy(t => t.FullName, StringComparer.Ordinal))
        {
            sb.Append("type ").Append(t.FullName).Append(" : ").Append(t.BaseType?.FullName).Append('\n');
            foreach (var f in t.GetFields(Alle).OrderBy(f => f.Name, StringComparer.Ordinal))
                sb.Append(" field ").Append(f.IsStatic ? "static " : "").Append(Name(f.FieldType)).Append(' ').Append(f.Name)
                  .Append(f.IsLiteral ? " = " + f.GetRawConstantValue() : "").Append('\n');
            foreach (var m in t.GetMethods(Alle).Cast<MethodBase>().Concat(t.GetConstructors(Alle)).OrderBy(Signatur, StringComparer.Ordinal))
            {
                sb.Append(" method ").Append(Signatur(m)).Append('\n');
                if (m.GetMethodBody() is not { } body) continue;
                foreach (var v in body.LocalVariables) sb.Append("  local ").Append(Name(v.LocalType)).Append('\n');
                Code(sb, m, body.GetILAsByteArray() ?? []);
            }
        }
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(sb.ToString()))).ToLowerInvariant();
    }

    private static string Name(Type? t) => t is null ? "?" : t.FullName ?? t.Name;

    private static string Signatur(MethodBase m) =>
        $"{(m is MethodInfo mi ? Name(mi.ReturnType) : "void")} {m.Name}{(m.IsGenericMethodDefinition ? "`" + m.GetGenericArguments().Length : "")}({string.Join(",", m.GetParameters().Select(p => Name(p.ParameterType)))})";

    /// <summary>Den Code einer Methode Befehl für Befehl — Verweise als Namen.</summary>
    private static void Code(StringBuilder sb, MethodBase m, byte[] il)
    {
        var module = m.Module;
        var typArgs = m.DeclaringType is { IsGenericType: true } dt ? dt.GetGenericArguments() : null;
        var methArgs = m.IsGenericMethod ? m.GetGenericArguments() : null;
        var i = 0;
        while (i < il.Length)
        {
            short wert = il[i++];
            if (wert == 0xFE && i < il.Length) wert = (short)(0xFE00 | il[i++]);
            if (!Codes.TryGetValue(wert, out var op)) { sb.Append("  ?").Append(wert).Append('\n'); continue; }
            sb.Append("  ").Append(op.Name);
            switch (op.OperandType)
            {
                case OperandType.InlineNone: break;
                case OperandType.ShortInlineBrTarget: case OperandType.ShortInlineI: case OperandType.ShortInlineVar:
                    sb.Append(' ').Append(il[i]); i += 1; break;
                case OperandType.InlineVar:
                    sb.Append(' ').Append(BitConverter.ToUInt16(il, i)); i += 2; break;
                case OperandType.InlineBrTarget: case OperandType.InlineI: case OperandType.ShortInlineR:
                    sb.Append(' ').Append(BitConverter.ToInt32(il, i)); i += 4; break;
                case OperandType.InlineI8: case OperandType.InlineR:
                    sb.Append(' ').Append(BitConverter.ToInt64(il, i)); i += 8; break;
                case OperandType.InlineSwitch:
                    var n = BitConverter.ToInt32(il, i); i += 4;
                    for (var k = 0; k < n; k++, i += 4) sb.Append(' ').Append(BitConverter.ToInt32(il, i));
                    break;
                case OperandType.InlineString:
                    sb.Append(" \"").Append(Versuch(() => module.ResolveString(BitConverter.ToInt32(il, i)))).Append('"'); i += 4; break;
                case OperandType.InlineSig:
                    sb.Append(" sig"); i += 4; break;
                default:   // InlineField, InlineMethod, InlineTok, InlineType
                    var token = BitConverter.ToInt32(il, i); i += 4;
                    sb.Append(' ').Append(Versuch(() => module.ResolveMember(token, typArgs, methArgs) switch
                    {
                        MethodBase mb => Name(mb.DeclaringType) + "::" + Signatur(mb),
                        FieldInfo f => Name(f.DeclaringType) + "::" + f.Name,
                        Type t => Name(t),
                        { } x => x.ToString() ?? "?",
                        null => "?",
                    }));
                    break;
            }
            sb.Append('\n');
        }
    }

    private static string Versuch(Func<string?> f) { try { return f() ?? "?"; } catch { return "?"; } }
}
