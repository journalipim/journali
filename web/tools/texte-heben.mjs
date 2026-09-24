// Hebt feste deutsche Texte aus den Vorlagen (.vue) in $t('…') — Stufe 1 der Oberflächensprache (Taloan, 24.09.2026:
// der deutsche Text ist der Schlüssel). Mechanisch, über den Syntaxbaum der Vorlage, nicht über reguläre Ausdrücke:
//   title="Text"        → :title="$t('Text')"        (auch placeholder, alt, aria-label)
//   >Text {{ x }} mehr< → >{{ $t('Text {0} mehr', [x]) }}<   (ein Schlüssel je zusammenhängendem Stück, Ausdrücke als Platzhalter)
// Nicht angefasst, sondern gemeldet: Zeichenketten in Ausdrücken (:title="cond ? 'a' : 'b'", v-for über Beschriftungen)
// und alles im <script> — das ist Handarbeit oder ein zweiter Durchgang.
//
//   node tools/texte-heben.mjs            alle Vorlagen unter src/ umschreiben
//   node tools/texte-heben.mjs --dry      nur zeigen, was sich ändern würde
//   node tools/texte-heben.mjs <datei…>   nur diese
import fs from 'node:fs'
import path from 'node:path'
import { parse } from '@vue/compiler-sfc'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const argv = process.argv.slice(2)
const dry = argv.includes('--dry')
const files = argv.filter(a => !a.startsWith('--'))

const WORT = /[A-Za-zÄÖÜäöüß]{2,}/           // ohne Buchstaben ist es kein Text (Symbole, Zahlen, ·, #)
const ATTRS = new Set(['title', 'placeholder', 'alt', 'aria-label'])
const NIE = new Set(['pre', 'code', 'script', 'style', 'textarea'])   // Inhalt bleibt, wie er ist

const walk = d => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : e.name.endsWith('.vue') ? [path.join(d, e.name)] : [])

/// Zeichenkette für eine Vorlage: in {{ }} als JSON; in einem Attribut einfach angeführt, " als &quot;
const jsStr = s => JSON.stringify(s)
const attrStr = s => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;') + "'"
const key = s => s.replace(/\s+/g, ' ').trim()

export function heben(source, filename) {
  const { descriptor, errors } = parse(source, { filename })
  if (errors.length) throw new Error(`${filename}: ${errors[0].message}`)
  const ast = descriptor.template?.ast
  if (!ast) return { source, edits: 0, keys: [], manual: [] }
  const edits = []   // { start, end, text }
  const keys = []
  const manual = []
  const line = off => source.slice(0, off).split('\n').length

  const visit = (node, inNie) => {
    if (node.type === 1 || node.type === 0) {   // ELEMENT (0 = die Wurzel der Vorlage, ohne Eigenschaften)
      const nie = inNie || NIE.has(node.tag)
      for (const p of node.props ?? []) {
        if (p.type === 6 && ATTRS.has(p.name) && p.value && WORT.test(p.value.content)) {   // ATTRIBUTE
          const k = key(p.value.content); keys.push(k)
          edits.push({ start: p.loc.start.offset, end: p.loc.end.offset, text: `:${p.name}="$t(${attrStr(k)})"` })
        } else if (p.type === 7 && p.exp && /['"`][^'"`]*[A-Za-zÄÖÜäöüß]{3,}[^'"`]*['"`]/.test(p.exp.content) && !/^(class|style|key|is)$/.test(p.arg?.content ?? '')) {   // DIRECTIVE mit Zeichenkette
          if (p.name === 'bind' && ATTRS.has(p.arg?.content ?? '') || p.name === 'for' || p.name === 'text' || (p.name === 'bind' && /label|hint|text|ok|cancel|warn|message/i.test(p.arg?.content ?? '')))
            manual.push(`${line(p.loc.start.offset)}: ${p.loc.source.slice(0, 110)}`)
        }
      }
      if (!nie) groups(node.children)
      for (const c of node.children) visit(c, nie)
    } else if (node.type === 9 || node.type === 10 || node.type === 11) {   // IF / IF_BRANCH / FOR
      for (const b of node.branches ?? []) visit(b, inNie)
      for (const c of node.children ?? []) visit(c, inNie)
    }
  }

  /// zusammenhängende Text- und {{ }}-Kinder eines Elements → ein Schlüssel mit Platzhaltern
  const groups = children => {
    let run = []
    const flush = () => {
      if (!run.length) return
      const parts = []; const exprs = []
      for (const n of run) {
        if (n.type === 2) parts.push(n.content)
        else if (n.type === 5) {
          const e = n.content.content.trim()
          if (/['"`][^'"`]*[A-Za-zÄÖÜäöüß]{3,}/.test(e)) manual.push(`${line(n.loc.start.offset)}: ${n.loc.source.slice(0, 110)}`)
          parts.push(`{${exprs.length}}`); exprs.push(e)
        }
      }
      const raw = parts.join('')
      const text = raw.replace(/\{\d+\}/g, '')
      if (WORT.test(text)) {
        const k = key(raw); keys.push(k)
        // Leerraum am Rand gehört in den Ausdruck: als eigener Textknoten würde Vue ihn am Elementrand wegkürzen
        // (vorher hing er am Text und blieb als ein Leerzeichen — genau das bleibt so)
        const lead = /^\s/.test(raw) ? "' ' + " : ''
        const trail = /\s$/.test(raw) ? " + ' '" : ''
        const call = exprs.length ? `$t(${jsStr(k)}, [${exprs.join(', ')}])` : `$t(${jsStr(k)})`
        edits.push({ start: run[0].loc.start.offset, end: run[run.length - 1].loc.end.offset, text: `{{ ${lead}${call}${trail} }}` })
      }
      run = []
    }
    for (const c of children) {
      if (c.type === 2 || c.type === 5) run.push(c)
      else flush()
    }
    flush()
  }

  visit(ast, false)
  edits.sort((a, b) => b.start - a.start)
  let out = source
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  return { source: out, edits: edits.length, keys, manual }
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith('texte-heben.mjs')) {
  const list = files.length ? files.map(f => path.resolve(f)) : walk(path.join(ROOT, 'src'))
  let total = 0; const alle = new Set(); const hand = []
  for (const f of list) {
    const raw = fs.readFileSync(f)
    const bom = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf
    const crlf = raw.includes('\r\n')
    const src = raw.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
    const r = heben(src, f)
    r.keys.forEach(k => alle.add(k)); total += r.edits
    hand.push(...r.manual.map(m => `${path.relative(ROOT, f)}:${m}`))
    if (r.edits && !dry) fs.writeFileSync(f, (bom ? '\uFEFF' : '') + (crlf ? r.source.replace(/\n/g, '\r\n') : r.source))
    if (r.edits) console.log(`${dry ? '~' : '✎'} ${path.relative(ROOT, f)}: ${r.edits} Stellen`)
  }
  console.log(`\n${total} Stellen, ${alle.size} Schlüssel${dry ? ' (nur gezeigt)' : ''}`)
  if (hand.length) { console.log(`\nHandarbeit (${hand.length} Stellen mit Text in Ausdrücken):`); for (const m of hand) console.log('  ' + m) }
}
