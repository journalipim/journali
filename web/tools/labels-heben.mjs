// Bezeichnungen des Modells folgen der Oberflächensprache (Taloan, 24.09.2026): statt `a.label?.de || a.key` steht
// `$L(a.label) || a.key` in Vorlagen bzw. `L(a.label) || a.key` im Skript — L nimmt die Sprache der Oberfläche, dann de,
// dann die erste vorhandene. Zuweisungen (a.label.de = v) und v-model bleiben: das sind die Felder, in denen je Sprache
// gepflegt wird. Ausdruck vor `.label` wird rückwärts gelesen (Bezeichner, ., ?., Klammern).
//   node tools/labels-heben.mjs [--dry] [--plugins] [<datei…>]
import fs from 'node:fs'
import path from 'node:path'
import { parse } from '@vue/compiler-sfc'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const argv = process.argv.slice(2)
const dry = argv.includes('--dry')
const files = argv.filter(a => !a.startsWith('--'))
const walk = d => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : /\.(vue|js)$/.test(e.name) ? [path.join(d, e.name)] : [])
const pluginDateien = () => {
  const dir = path.join(ROOT, '..', 'plugins')
  return fs.readdirSync(dir).flatMap(k => {
    const d = path.join(dir, k); const out = []
    if (fs.existsSync(path.join(d, 'src'))) out.push(...walk(path.join(d, 'src')))
    else if (fs.existsSync(path.join(d, 'entry.js'))) out.push(path.join(d, 'entry.js'))
    if (fs.existsSync(path.join(d, 'browser.js'))) out.push(path.join(d, 'browser.js'))
    return out
  })
}

const RE = /\.(label|reverse|description)(\?)?\.de\b/g

/// Anfang des Ausdrucks vor Position `end` (exklusiv): rückwärts über Bezeichner, ., ?., ) und ] mit ihren Paaren
function exprStart(src, end) {
  let i = end - 1
  while (i >= 0) {
    const c = src[i]
    if (c === ')' || c === ']') {
      const open = c === ')' ? '(' : '['; let d = 0
      for (; i >= 0; i--) { if (src[i] === c) d++; else if (src[i] === open) { d--; if (d === 0) break } }
      i--; continue
    }
    if (/[A-Za-z0-9_$.?]/.test(c)) { i--; continue }
    break
  }
  return i + 1
}

export function heben(src, filename) {
  const isVue = filename.endsWith('.vue')
  const inPlugins = filename.replace(/\\/g, '/').includes('/plugins/')
  const gebaut = inPlugins && /\/plugins\/[^/]+\/src\//.test(filename.replace(/\\/g, '/'))
  let tplStart = -1, tplEnd = -1, scriptStart = -1, scriptEnd = -1
  if (isVue) {
    const { descriptor } = parse(src, { filename })
    if (descriptor.template) { tplStart = descriptor.template.loc.start.offset; tplEnd = descriptor.template.loc.end.offset }
    const blk = descriptor.scriptSetup ?? descriptor.script
    if (blk) { scriptStart = blk.loc.start.offset; scriptEnd = blk.loc.end.offset }
  }
  const edits = []; const skipped = []
  for (const m of src.matchAll(RE)) {
    const at = m.index, end = at + m[0].length
    const nach = src.slice(end, end + 6), davor = src.slice(Math.max(0, at - 60), at)
    // bleibt deutsch: Zuweisung, v-model, das Feld „Name de“ (:value="x.label?.de" + label_de), Vorbelegung eines Prompts
    const start = exprStart(src, at)
    const vorAusdruck = src.slice(Math.max(0, start - 14), start)
    if (start === at || /^\s*=[^=]/.test(nach) || /v-model="[^"]*$/.test(davor) || /(:value="|label_de: |value: )$/.test(vorAusdruck)) { skipped.push(src.slice(Math.max(0, at - 30), end + 10).replace(/\s+/g, ' ')); continue }
    const inTpl = isVue && at >= tplStart && at < tplEnd
    const call = inTpl ? '$L' : 'L'
    const expr = src.slice(start, at) + '.' + m[1]
    edits.push({ start, end, text: `${call}(${expr})`, inTpl })
  }
  if (!edits.length) return { src, edits: 0, skipped }
  edits.sort((a, b) => b.start - a.start)
  let out = src
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  // Import für L im Skript
  if (edits.some(e => !e.inTpl)) {
    const line = !inPlugins ? `import { L } from '${(() => { const r = path.relative(path.dirname(filename), path.join(ROOT, 'src', 'i18n.js')).replace(/\\/g, '/'); return r.startsWith('.') ? r : './' + r })()}'`
      : gebaut ? `import { L } from 'journali'`
      : `const L = l => globalThis.journali?.L ? globalThis.journali.L(l) : (l?.de ?? Object.values(l ?? {})[0] ?? '')   // Bezeichnung in der Oberflächensprache`
    if (!out.includes(line)) {
      const s0 = isVue ? out.indexOf('\n', out.indexOf('<script')) + 1 : 0
      const head = out.slice(s0); const lines = head.split('\n')
      let last = -1
      for (let k = 0; k < lines.length; k++) { if (/^import\s/.test(lines[k])) last = k; else if (last >= 0 && !/^\s*(\/\/|$)/.test(lines[k]) && !/^import/.test(lines[k])) break }
      if (last >= 0) lines.splice(last + 1, 0, line)
      else { let k = 0; while (k < lines.length && /^\s*(\/\/|$)/.test(lines[k])) k++; lines.splice(k, 0, line) }
      out = out.slice(0, s0) + lines.join('\n')
    }
  }
  return { src: out, edits: edits.length, skipped }
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith('labels-heben.mjs')) {
  const list = (files.length ? files.map(f => path.resolve(f)) : argv.includes('--plugins') ? pluginDateien() : walk(path.join(ROOT, 'src'))).filter(f => !f.endsWith('i18n.js'))
  let total = 0; const skip = []
  for (const f of list) {
    const raw = fs.readFileSync(f)
    const bom = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf
    const crlf = raw.includes('\r\n')
    const src = raw.toString('utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n')
    const r = heben(src, f)
    skip.push(...r.skipped.map(s => `${path.relative(ROOT, f)}: ${s}`))
    if (!r.edits) continue
    total += r.edits
    if (!dry) fs.writeFileSync(f, (bom ? '﻿' : '') + (crlf ? r.src.replace(/\n/g, '\r\n') : r.src))
    console.log(`${dry ? '~' : '✎'} ${path.relative(ROOT, f)}: ${r.edits}`)
  }
  console.log(`\n${total} Stellen${dry ? ' (nur gezeigt)' : ''}`)
  if (skip.length) { console.log(`\nGelassen (Pflege je Sprache):`); for (const s of skip) console.log('  ' + s) }
}
