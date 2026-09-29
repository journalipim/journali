// Ein Plugin mit einer Ansicht (src/ + entry.js, das views beiträgt) muss runs: browser haben — sonst lädt die
// Oberfläche sein entry.js nicht (plugins.js: runs !== 'browser' → übersprungen), und die Ansicht erscheint
// nirgends in der Leiste. So verschwand scriptum: es hatte runs: process, obwohl es die Ansicht „⌨ Skripte"
// beiträgt (29.09.2026). Ein Prozess dazu (Jobs) ist erlaubt — den steuert die process-Definition, nicht runs.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const dir = new URL('../../plugins', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

test('jedes Plugin mit einer Vue-Ansicht (src/) steht auf runs: browser', () => {
  const falsch = []
  for (const key of fs.readdirSync(dir)) {
    const d = path.join(dir, key)
    const manifest = path.join(d, 'plugin.json')
    if (!fs.statSync(d).isDirectory() || !fs.existsSync(manifest)) continue
    if (!fs.existsSync(path.join(d, 'src'))) continue   // keine Ansicht → runs frei (Prozess-Plugin)
    const m = JSON.parse(fs.readFileSync(manifest, 'utf8'))
    if (m.runs !== 'browser') falsch.push(`${key}: runs=${m.runs} (hat src/, also eine Ansicht — muss browser sein)`)
  }
  assert.deepEqual(falsch, [], 'Ansicht wird nie geladen')
})
