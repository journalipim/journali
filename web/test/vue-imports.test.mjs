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
