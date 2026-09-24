// Zweiter und dritter Durchgang des Hebens (24.09.2026): Zeichenketten in Ausdrücken der Vorlagen (:title="a ? 'x' : 'y'",
// {{ ok ? 'Ja' : 'Nein' }}, `Gruppe an ${n} Attributen`) und im Skript (toast, dialog, Beschriftungen) nach $t('…') bzw.
// t('…'). Ein kleiner Zeichenleser geht durch den Ausdruck und findet Literale; was wie Text aussieht (Umlaut, zwei
// Wörter, oder ein grossgeschriebenes Wort), wird eingepackt — Schlüssel, Pfade, Klassen bleiben. Vorlagen-Literale mit
// ${…} werden zu Schlüsseln mit {0} {1} und einer Liste der Ausdrücke. Nach jeder Datei prüft esbuild bzw. der
// Vue-Übersetzer die Syntax; scheitert das, bleibt die Datei, wie sie war, und wird gemeldet.
//
//   node tools/texte-heben-ausdruecke.mjs [--dry] [--nur-vorlagen | --nur-skript] [<datei…>]
import fs from 'node:fs'
import path from 'node:path'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import esbuild from 'esbuild'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const argv = process.argv.slice(2)
const dry = argv.includes('--dry')
const nurVorlagen = argv.includes('--nur-vorlagen'), nurSkript = argv.includes('--nur-skript')
const files = argv.filter(a => !a.startsWith('--'))

/// Sieht die Zeichenkette wie Text für den Anwender aus? Nicht: Pfade, Schlüssel, Klassen, Mime-Typen, Kürzel.
export const istText = s => {
  if (/^[\/#.]|:\/\/|^[a-z0-9_:\-\/.\[\]*@,;%+=|]+$|^\s*$/.test(s)) return false
  if (/^[A-Za-z]+-[A-Za-z]+$/.test(s)) return false                      // Content-Type, data-v
  if (/^(Escape|Enter|Backspace|Delete|Tab|ArrowDown|ArrowUp|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown|Space|Shift|Control|Alt|Meta|Insert|Arrow|Subtract|Files|Bearer)$/.test(s.trim())) return false   // Tastennamen (e.key === 'Escape'), Technisches
  if (/;\s*[a-z-]+\s*:/.test(s) || /^[a-z-]+:\s*[^ ]/.test(s)) return false     // CSS (width:…;padding:…)
  if (/^[a-z]+\.[a-z]|\[[a-z-]+[=\]]|^\d+px /.test(s)) return false                 // Selektoren (table.tab tr[data-id=…]), Schriften
  if (/[ÄÖÜäöüß]/.test(s)) return true
  if (/[A-Za-z]{2,}\s+[A-Za-z]/.test(s)) return true                     // zwei Wörter
  if (/^[^a-z]*[A-Z][a-z]{3,}[^a-z]*$/.test(s)) return true               // ein grossgeschriebenes Wort (Speichern, Name)
  return false
}
/// Ausdrücke, deren Literale nie Text sind
const KEIN_TEXT_ARG = /^(class|style|key|is|ref|to|href|src|id|name|type|value|model|for|route|path|target|rel|autocomplete|accept|download|method)$/

const escSingle = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

/**
 * Literale in einem JS-Ausdruck einpacken. `call` ist '$t' (Vorlage) oder der Name im Skript.
 * `attr` = im HTML-Attribut (dann " → &quot;). Gibt den neuen Ausdruck und die gehobenen Schlüssel zurück.
 */
export function einpacken(src, { call = '$t', attr = false } = {}) {
  const keys = []
  const out = []
  let i = 0
  const vor = () => out.join('')
  const schonEingepackt = () => /(^|[^A-Za-z0-9_$.])(\$?t|t_)\(\s*$/.test(vor())
  /// Objektschlüssel ({ 'a b': 1 } oder , 'a b': 1) — kein Text
  const istObjektSchluessel = j => /[{,]\s*$/.test(vor()) && /^\s*:/.test(src.slice(j + 1))
  /// Klassen, Stile, Schriften, Selektoren — am Kontext erkannt, nicht am Inhalt
  const technischerKontext = () => /(class|className|style|font|cssText|querySelector\w*|getElementById|closest|matches)\s*[:=(]?\s*\+?\s*$/.test(vor())
  const key = s => (attr ? s.replace(/"/g, '&quot;') : s)
  // Leerraum am Rand bleibt ausserhalb des Aufrufs ('Stapel ' + x → t('Stapel') + ' ' + x): der Schlüssel ist sauber,
  // die Verkettung behält ihr Leerzeichen
  const emit = (text, exprs) => {
    const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0]
    const k = text.trim().replace(/\s+/g, ' ')
    keys.push(k)
    const c = `${call}('${escSingle(key(k))}'${exprs.length ? `, [${exprs.join(', ')}]` : ''})`
    return `${lead ? `'${lead}' + ` : ''}${c}${trail ? ` + '${trail}'` : ''}`
  }
  while (i < src.length) {
    const ch = src[i]
    // Kommentare (nur im Skript relevant, in Vorlagen harmlos)
    if (ch === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); const s = e < 0 ? src.slice(i) : src.slice(i, e); out.push(s); i += s.length; continue }
    if (ch === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const s = e < 0 ? src.slice(i) : src.slice(i, e + 2); out.push(s); i += s.length; continue }
    // Regulärer Ausdruck: ein / nach Operator oder Klammer
    if (ch === '/' && /(^|[(,=:\[!&|?{};+\-*%<>~^]|\breturn|\btypeof)\s*$/.test(vor())) {
      let j = i + 1, klasse = false
      for (; j < src.length; j++) { const c = src[j]; if (c === '\\') { j++; continue } if (klasse) { if (c === ']') klasse = false; continue } if (c === '[') klasse = true; else if (c === '/') break; else if (c === '\n') break }
      const s = src.slice(i, j + 1); out.push(s); i += s.length; continue
    }
    if (ch === "'" || ch === '"') {
      let j = i + 1, raw = ''
      for (; j < src.length && src[j] !== ch; j++) { if (src[j] === '\\') { raw += src[j] + src[j + 1]; j++ } else raw += src[j] }
      const text = raw.replace(/\\(['"])/g, '$1')
      const mehrzeilig = /\\[^'"]/.test(raw)   // Umbrüche, Pfade mit \ — Prompts und Meldungen mit Umbruch bleiben (Handarbeit)
      if (istText(text) && !mehrzeilig && !schonEingepackt() && !istObjektSchluessel(j) && !technischerKontext()) out.push(emit(text, []))
      else out.push(src.slice(i, j + 1))
      i = j + 1; continue
    }
    if (ch === '`') {
      // Vorlagenliteral: statische Teile und ${…}
      let j = i + 1; const parts = []; const exprs = []; let stat = ''
      for (; j < src.length && src[j] !== '`'; j++) {
        if (src[j] === '\\') { stat += src[j] + src[j + 1]; j++; continue }   // Escape roh behalten
        if (src[j] === '$' && src[j + 1] === '{') {
          let d = 1, k = j + 2, q = null
          for (; k < src.length; k++) {
            const c = src[k]
            if (q) { if (c === '\\') { k++; continue } if (c === q) q = null; continue }
            if (c === "'" || c === '"' || c === '`') { q = c; continue }
            if (c === '{') d++; else if (c === '}') { d--; if (d === 0) break }
          }
          const inner = src.slice(j + 2, k)
          const packed = einpacken(inner, { call, attr })
          keys.push(...packed.keys)
          parts.push(stat); stat = ''; exprs.push(packed.src)
          j = k; continue
        }
        stat += src[j]
      }
      parts.push(stat)
      const text = parts.map((p, n) => n < exprs.length ? p + `{${n}}` : p).join('')
      const mehrzeilig = /\\[^'"`]|\n/.test(parts.join(''))
      if (istText(parts.join('')) && !mehrzeilig && !schonEingepackt() && !technischerKontext()) out.push(emit(text, exprs))
      else out.push(src.slice(i, j + 1))
      i = j + 1; continue
    }
    out.push(ch); i++
  }
  return { src: out.join(''), keys }
}

// ---------------------------------------------------------------- Vorlagen: Ausdrücke im AST

function vorlagen(source, filename) {
  const { descriptor } = parse(source, { filename })
  const ast = descriptor.template?.ast
  if (!ast) return { source, edits: 0, keys: [] }
  const edits = []; const keys = []
  const visit = node => {
    if (node.type === 1 || node.type === 0) {
      for (const p of node.props ?? []) {
        if (p.type !== 7 || !p.exp || !p.exp.loc) continue
        if (p.name === 'bind' && KEIN_TEXT_ARG.test(p.arg?.content ?? '')) continue
        if (p.name === 'model' || p.name === 'slot' || p.name === 'if' || p.name === 'else-if' || p.name === 'show') continue
        const { start, end } = p.exp.loc
        const raw = source.slice(start.offset, end.offset)
        const r = einpacken(raw, { call: '$t', attr: true })
        if (r.keys.length) { edits.push({ start: start.offset, end: end.offset, text: r.src }); keys.push(...r.keys) }
      }
      for (const c of node.children ?? []) visit(c)
    } else if (node.type === 5) {
      const { start, end } = node.content.loc
      const raw = source.slice(start.offset, end.offset)
      const r = einpacken(raw, { call: '$t', attr: false })
      if (r.keys.length) { edits.push({ start: start.offset, end: end.offset, text: r.src }); keys.push(...r.keys) }
    }
  }
  visit(ast)
  edits.sort((a, b) => b.start - a.start)
  let out = source
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  return { source: out, edits: edits.length, keys }
}

// ---------------------------------------------------------------- Skript: <script setup> und .js

const KONFLIKT = /\b(const|let|var|function)\s+t\b|\(\s*t\s*[,)]|\bt\s*=>|,\s*t\s*[,)]/

function skript(source, filename) {
  const isVue = filename.endsWith('.vue')
  let start = 0, end = source.length
  if (isVue) {
    const { descriptor } = parse(source, { filename })
    const blk = descriptor.scriptSetup ?? descriptor.script
    if (!blk) return { source, edits: 0, keys: [] }
    start = blk.loc.start.offset; end = blk.loc.end.offset
  }
  const code = source.slice(start, end)
  const name = KONFLIKT.test(code) ? 't_' : 't'
  const r = einpacken(code, { call: name, attr: false })
  if (!r.keys.length) return { source, edits: 0, keys: [] }
  let neu = r.src
  // Import dazu, wenn er fehlt
  const rel = path.relative(path.dirname(filename), path.join(ROOT, 'src', 'i18n.js')).replace(/\\/g, '/')
  const imp = `import { ${name === 't' ? 't' : 't as t_'} } from '${rel.startsWith('.') ? rel : './' + rel}'`
  if (!new RegExp(`import\\s*\\{[^}]*\\b${name === 't' ? 't\\b(?!\\s+as)' : 't as t_'}[^}]*\\}\\s*from\\s*['"][^'"]*i18n\\.js['"]`).test(neu)) {
    const lines = neu.split('\n')
    let last = -1
    for (let k = 0; k < lines.length; k++) if (/^import\s/.test(lines[k])) last = k
    if (last >= 0) lines.splice(last + 1, 0, imp)
    else { let k = 0; while (k < lines.length && /^\s*(\/\/|$)/.test(lines[k])) k++; lines.splice(k, 0, imp) }
    neu = lines.join('\n')
  }
  return { source: source.slice(0, start) + neu + source.slice(end), edits: r.keys.length, keys: r.keys }
}

// ---------------------------------------------------------------- Prüfung und Lauf

function syntaxOk(source, filename) {
  try {
    if (filename.endsWith('.vue')) {
      const { descriptor, errors } = parse(source, { filename })
      if (errors.length) return errors[0].message
      if (descriptor.scriptSetup || descriptor.script) compileScript(descriptor, { id: 'x' })
      if (descriptor.template) { const t = compileTemplate({ source: descriptor.template.content, filename, id: 'x' }); if (t.errors.length) return String(t.errors[0].message ?? t.errors[0]) }
    } else esbuild.transformSync(source, { loader: 'js' })
    return null
  } catch (e) { return e.message }
}

const walk = d => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : /\.(vue|js)$/.test(e.name) ? [path.join(d, e.name)] : [])

if (process.argv[1] && path.resolve(process.argv[1]).endsWith('texte-heben-ausdruecke.mjs')) {
  const list = (files.length ? files.map(f => path.resolve(f)) : walk(path.join(ROOT, 'src'))).filter(f => !f.endsWith('i18n.js'))
  let total = 0; const alle = new Set(); const kaputt = []
  for (const f of list) {
    const raw = fs.readFileSync(f)
    const bom = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf
    const crlf = raw.includes('\r\n')
    let src = raw.toString('utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n')
    let edits = 0; const keys = []
    if (!nurSkript && f.endsWith('.vue')) { const r = vorlagen(src, f); src = r.source; edits += r.edits; keys.push(...r.keys) }
    if (!nurVorlagen) { const r = skript(src, f); src = r.source; edits += r.edits; keys.push(...r.keys) }
    if (!edits) continue
    const err = syntaxOk(src, f)
    if (err) { kaputt.push(`${path.relative(ROOT, f)}: ${err.split('\n')[0].slice(0, 120)}`); continue }
    keys.forEach(k => alle.add(k)); total += edits
    if (!dry) fs.writeFileSync(f, (bom ? '﻿' : '') + (crlf ? src.replace(/\n/g, '\r\n') : src))
    console.log(`${dry ? '~' : '✎'} ${path.relative(ROOT, f)}: ${edits} Stellen`)
  }
  console.log(`\n${total} Stellen, ${alle.size} Schlüssel${dry ? ' (nur gezeigt)' : ''}`)
  if (kaputt.length) { console.log(`\nNicht angefasst — Syntax nach dem Umbau kaputt (${kaputt.length}):`); for (const k of kaputt) console.log('  ' + k) }
}
