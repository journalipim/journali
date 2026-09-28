// Ein Fenster, in dem gearbeitet wird, schliesst nur mit × oder Esc (28.09.2026): ein Klick daneben wirft weg, was
// jemand gerade gesetzt hat — im Dialog „Werte aus dem Dokument“ sind das hundert Zeilen mit Haken.
// Ausgenommen: die Bestätigung (Dialog.vue, Klick daneben = Nein) und die Hilfe (nur Lesen).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

const WURZEL = new URL('../src/', import.meta.url)
const AUSNAHMEN = new Set(['components/Dialog.vue', 'components/HelpPanel.vue'])

function dateien(dir = '', out = []) {
  for (const e of readdirSync(new URL(dir, WURZEL), { withFileTypes: true })) {
    if (e.isDirectory()) dateien(`${dir}${e.name}/`, out)
    else if (e.name.endsWith('.vue')) out.push(`${dir}${e.name}`)
  }
  return out
}

test('kein Fenster schliesst beim Klick daneben — ausser Bestätigung und Hilfe', () => {
  const treffer = []
  for (const f of dateien()) {
    if (AUSNAHMEN.has(f)) continue
    const quelle = readFileSync(new URL(f, WURZEL), 'utf8')
    for (const zeile of quelle.split('\n')) {
      if (/overlay/.test(zeile) && /@(mousedown|click)\.self/.test(zeile)) treffer.push(`${f}: ${zeile.trim().slice(0, 100)}`)
    }
  }
  assert.deepEqual(treffer, [], 'diese Fenster schliessen beim Klick daneben')
})

test('die Bestätigung schliesst weiter beim Klick daneben — dort ist es die Antwort „Nein“', () => {
  const quelle = readFileSync(new URL('components/Dialog.vue', WURZEL), 'utf8')
  assert.match(quelle, /class="overlay" @mousedown\.self="dialog\.done\(false\)"/)
})
