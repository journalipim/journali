// Jede .vue-Datei muss importieren, was sie aus Vue benutzt (Taloan, 22.09.2026: „führt zum Absturz“ — watch und onUnmounted
// waren benutzt, aber nicht importiert; der Bau merkt das nicht, erst der Browser). Kein DOM nötig, reine Textprüfung.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const API = ['ref', 'computed', 'watch', 'watchEffect', 'onMounted', 'onUnmounted', 'onBeforeUnmount', 'nextTick', 'reactive', 'provide', 'inject', 'toRef', 'toRefs', 'shallowRef', 'defineAsyncComponent', 'markRaw']
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.vue') ? [path.join(d, e.name)] : [])

test('jede .vue-Datei importiert, was sie aus Vue benutzt', () => {
  const misses = []
  for (const f of walk(new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
    const s = fs.readFileSync(f, 'utf8')
    const imported = new Set((s.match(/import \{([^}]*)\} from ['"]vue['"]/)?.[1] ?? '').split(',').map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean))
    const a = s.indexOf('<script'), b = s.indexOf('</script>')
    const script = a < 0 ? '' : s.slice(a, b < 0 ? undefined : b)
    for (const name of API) {
      if (imported.has(name)) continue
      if (new RegExp('(^|[^.\\w])' + name + '\\s*\\(', 'm').test(script)) misses.push(`${path.basename(f)}: ${name}`)
    }
  }
  assert.deepEqual(misses, [], 'benutzt, aber nicht importiert')
})

// Dasselbe für die eigenen Module (Taloan, 22.09.2026: „plugins is not defined“ — die Ansicht stürzte ab, weil ein
// Modul benutzt, aber nicht importiert war; der Bau merkt das nicht). Geprüft wird auf `name.` im Script.
const MODULES = ['store', 'api', 'tree', 'dialog', 'menu', 'plugins', 'ai', 'lists', 'transform', 'mapper']

test('jede .vue-Datei importiert die eigenen Module, die sie benutzt', () => {
  const misses = []
  for (const f of walk(new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
    const s = fs.readFileSync(f, 'utf8')
    const a = s.indexOf('<script'), b = s.indexOf('</script>')
    if (a < 0) continue
    const script = s.slice(a, b < 0 ? undefined : b)
    // Import-Zeilen und Kommentare weg — sonst trifft „lists.“ die Datei ../lists.js in ihrem eigenen Import
    const code = script.replace(/^\s*import[^\n]*$/gm, '').replace(/\/\/[^\n]*/g, '')
    for (const name of MODULES) {
      // importiert? (als Name oder umbenannt: `dialog as ask`)
      if (new RegExp('import\\s*\\{[^}]*\\b' + name + '\\b[^}]*\\}').test(script)) continue
      // eigene Deklaration im Modul selbst (store.js benutzt store nicht als Import)
      if (new RegExp('(const|let|function)\\s+' + name + '\\b').test(script)) continue
      // benutzt? `name.etwas`, aber nicht als Eigenschaft (`x.store.`) oder in einer Zeichenkette
      const used = new RegExp('(^|[^.\\w\'"`])' + name + '\\.[a-zA-Z_$]', 'm').test(code)
      if (used) misses.push(`${path.basename(f)}: ${name}`)
    }
  }
  assert.deepEqual(misses, [], 'eigenes Modul benutzt, aber nicht importiert')
})
