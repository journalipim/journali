// Die Einheit neben einem Wert (30.09.2026): ein Leerzeichen am Anfang eines Elements entfällt beim Übersetzen der
// Vorlage — „Menge“ und „mg“ klebten als „Mengemg“ und „60mg“ zusammen. Der Abstand steht darum als Mass (margin-left)
// am Element, nicht als Leerzeichen davor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const wurzel = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
function* dateien(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) yield* dateien(p)
    else if (n.endsWith('.vue')) yield p
  }
}

test('kein Element mit einer Einheit beginnt mit einem Leerzeichen, das beim Übersetzen verloren geht', () => {
  const fehler = []
  for (const f of dateien(wurzel)) {
    const zeilen = readFileSync(f, 'utf8').split(/\r?\n/)
    zeilen.forEach((z, i) => {
      for (const m of z.matchAll(/<span[^>]*>\s*\{\{\s*[^}]*unit[^}]*\}\}\s*<\/span>/gi)) {
        if (/>\s+\{\{/.test(m[0]) && !/margin-left|&nbsp;/.test(m[0])) fehler.push(`${f.slice(wurzel.length)}:${i + 1}  ${m[0].slice(0, 90)}`)
      }
    })
  }
  assert.deepEqual(fehler, [], 'Abstand als margin-left statt als führendes Leerzeichen')
})
