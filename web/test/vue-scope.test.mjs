// Schleifenvariablen dürfen nur innerhalb ihrer Schleife benutzt werden (Taloan, 22.09.2026: „Cannot read properties of
// undefined (reading 'perLocale')“ — die Zeile „je Sprache“ stand hinter dem </tr> der v-for-Zeile, also ausserhalb).
// Der Bau merkt das nicht und der Vue-Compiler warnt nicht: er übersetzt den Namen still zu _ctx.<name>, und erst im
// Browser stürzt die Ansicht ab. Genau daran erkennt der Prüfer den Fehler — kein DOM nötig.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { parse, compileTemplate } from 'vue/compiler-sfc'

const root = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.vue') ? [path.join(d, e.name)] : [])

/// Namen, die ein v-for einführt: „x in y“, „(x, i) in y“, „{ a, b } in y“
function loopNames(template) {
  const out = new Set()
  for (const m of template.matchAll(/v-for="\s*([^"]*?)\s+(?:in|of)\s/g)) {
    const head = m[1].replace(/^\(|\)$/g, '')
    for (const part of head.split(',')) {
      const name = part.trim().replace(/^[{[]|[}\]]$/g, '').split(':').pop().trim()
      if (/^[A-Za-z_$][\w$]*$/.test(name)) out.add(name)
    }
  }
  return out
}

test('keine Schleifenvariable ausserhalb ihrer Schleife', () => {
  const misses = []
  for (const f of walk(root)) {
    const src = fs.readFileSync(f, 'utf8')
    const { descriptor } = parse(src, { filename: f })
    if (!descriptor.template) continue
    const names = loopNames(descriptor.template.content)
    if (!names.size) continue
    const { code } = compileTemplate({ source: descriptor.template.content, filename: f, id: path.basename(f) })
    // _ctx.<name> heisst: der Compiler hat den Namen nicht im Schleifen-Bereich gefunden
    for (const name of names)
      if (new RegExp('_ctx\\.' + name + '\\b').test(code)) misses.push(`${path.basename(f)}: „${name}“ steht ausserhalb seiner v-for-Schleife`)
  }
  assert.deepEqual(misses, [], 'Schleifenvariable ausserhalb der Schleife benutzt')
})

// Browser-Globale im Template (Taloan, 22.09.2026: „Absturz wenn ich auf den copy knopf klicke" — im Token-Dialog stand
// @click="navigator.clipboard.writeText(…)"). Vue löst im Template jeden Namen gegen die Komponente auf; nur eine kurze
// Liste (Math, JSON, Date …) geht ans echte Global. „navigator" wird still zu _ctx.navigator — undefined, Absturz beim
// Klick. Solche Aufrufe gehören ins Setup.
const BROWSER_GLOBALS = ['navigator', 'window', 'document', 'location', 'localStorage', 'sessionStorage', 'fetch', 'alert', 'confirm', 'history', 'screen']

/// Kennt die Komponente den Namen selbst? const/let/var/function im Setup oder ein Prop in defineProps.
/// (In UsageBars ist „history" ein Prop, in NodeView ein computed — beides eigene Namen.)
function declared(script, name) {
  if (new RegExp('\\b(?:const|let|var|function|class)\\s+' + name + '\\b').test(script)) return true
  const props = script.match(/defineProps\(([\s\S]*?)\)/)
  return !!props && new RegExp('\\b' + name + '\\s*[:,}]').test(props[1])
}

test('kein Browser-Global im Template', () => {
  const misses = []
  for (const f of walk(root)) {
    const { descriptor } = parse(fs.readFileSync(f, 'utf8'), { filename: f })
    if (!descriptor.template) continue
    const script = (descriptor.scriptSetup?.content ?? '') + (descriptor.script?.content ?? '')
    const { code } = compileTemplate({ source: descriptor.template.content, filename: f, id: path.basename(f) })
    for (const name of BROWSER_GLOBALS)
      if (new RegExp('_ctx\\.' + name + '\\b').test(code) && !declared(script, name))
        misses.push(`${path.basename(f)}: „${name}“ im Template — im Setup aufrufen`)
  }
  assert.deepEqual(misses, [], 'Browser-Global im Template benutzt')
})
