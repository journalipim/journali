// Wortwahl in dem, was man liest (04.10.2026): eingebaute Vorgaben heissen „Vorgaben“, nicht mit einem Wort aus der
// Landwirtschaft. Geprüft wird, was in Oberfläche, Hilfe und Log landet — Kommentare im Quelltext nicht.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const wurzel = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const WORT = /Saatgut|Saatguts/i

/// Alle Dateien unter einem Verzeichnis mit einer der Endungen
function dateien(dir, endungen) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : dateien(p, endungen)
    return endungen.some(x => e.name.endsWith(x)) ? [p] : []
  })
}

/// Zeichenketten in einer Zeile C# — ohne den Kommentar dahinter
const zeichenketten = zeile => [...zeile.replace(/\/\/.*$/, '').matchAll(/\$?"((?:[^"\\]|\\.)*)"/g)].map(m => m[1])

test('Hilfe, Übersetzungen und Vorlagen der Oberfläche nennen keine Saat', () => {
  const misses = []
  for (const f of dateien(path.join(wurzel, 'help'), ['.md'])) if (WORT.test(fs.readFileSync(f, 'utf8'))) misses.push(path.relative(wurzel, f))
  for (const f of dateien(path.join(wurzel, 'web/public/lang'), ['.json'])) if (WORT.test(fs.readFileSync(f, 'utf8'))) misses.push(path.relative(wurzel, f))
  for (const f of [...dateien(path.join(wurzel, 'web/src'), ['.vue']), ...dateien(path.join(wurzel, 'plugins'), ['.vue'])]) {
    const vorlage = fs.readFileSync(f, 'utf8').match(/<template>[\s\S]*<\/template>/)?.[0] ?? ''
    if (WORT.test(vorlage)) misses.push(path.relative(wurzel, f))
  }
  assert.deepEqual(misses, [])
})

test('Log und Meldungen des Servers nennen keine Saat', () => {
  const misses = []
  for (const dir of ['Journali.Server', 'Journali.Core'])
    for (const f of dateien(path.join(wurzel, dir), ['.cs']).filter(f => !/[\\/](bin|obj)[\\/]/.test(f)))
      fs.readFileSync(f, 'utf8').split('\n').forEach((z, i) => {
        if (zeichenketten(z).some(t => WORT.test(t))) misses.push(`${path.relative(wurzel, f)}:${i + 1}`)
      })
  assert.deepEqual(misses, [])
})
