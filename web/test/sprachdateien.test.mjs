// Sprachdateien der Oberfläche (24.09.2026): eine Datei je Sprache unter public/lang/, der Schlüssel ist der deutsche
// Text aus den Quellen. Geprüft wird, was schiefgehen kann: ein Eintrag ohne Schlüssel im Quelltext (Text geändert,
// Übersetzung hängt in der Luft), ein leerer Wert, kaputtes JSON — und ob t() mit Platzhaltern und Rückfall arbeitet.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import './ui.mjs'
import { stand, quellSchluessel } from '../tools/texte-pruefen.mjs'
import { entfalten, schluessel } from './texte.mjs'

const langDir = new URL('../public/lang', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const codes = fs.readdirSync(langDir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5))

test('jede Sprachdatei ist JSON mit Zeichenketten, ohne verwaiste und ohne leere Einträge', () => {
  for (const code of codes) {
    const s = stand(code)
    assert.deepEqual(s.verwaist.slice(0, 5), [], `${code}: Einträge ohne Schlüssel im Quelltext`)
    assert.deepEqual(s.leer.slice(0, 5), [], `${code}: leere Übersetzungen`)
  }
})

test('die Quellen haben Schlüssel — das Heben hat stattgefunden', () => {
  assert.ok(quellSchluessel().size > 500, 'weniger als 500 Schlüssel in src/ — wurde etwas zurückgesetzt?')
})

test('t(): Schlüssel ist die Nachricht, Platzhalter aus Liste und Objekt, fehlende Übersetzung fällt auf Deutsch zurück', async () => {
  const { i18n, t, setLang } = await import('../src/i18n.js')
  assert.equal(t('Knoten wählen — oder oben anlegen.'), 'Knoten wählen — oder oben anlegen.')
  assert.equal(t('{0} von {1}', [3, 7]), '3 von 7')
  assert.equal(t('Hallo {name}', { name: 'Taloan' }), 'Hallo Taloan')
  assert.equal(t('Preis: {0} € · a | b'), 'Preis: {0} € · a | b', 'Sonderzeichen bleiben, ein Platzhalter ohne Wert auch')
  i18n.global.setLocaleMessage('en', { 'Knoten wählen — oder oben anlegen.': 'Pick a node — or create one above.', '{0} von {1}': '{0} of {1}' })
  i18n.global.locale.value = 'en'
  assert.equal(t('Knoten wählen — oder oben anlegen.'), 'Pick a node — or create one above.')
  assert.equal(t('{0} von {1}', [3, 7]), '3 of 7')
  assert.equal(t('nicht übersetzt {0}', [1]), 'nicht übersetzt 1', 'Rückfall: der deutsche Schlüssel, Platzhalter gefüllt')
  i18n.global.locale.value = 'de'
  assert.equal(await setLang('xx'), 'de', 'unbekannter Code → Vorgabe')
})

test('entfalten() gibt den Prüfständen den Text zurück, den der Anwender liest', () => {
  assert.equal(entfalten(`<td :title="$t('Ein Satz mit \\'Anführung\\' und &quot;Zoll&quot;.')">x</td>`), `<td title="Ein Satz mit 'Anführung' und "Zoll".">x</td>`)
  assert.equal(entfalten(`<span>{{ ' ' + $t("· Test") }}</span><b>{{ $t("{0} von {1}", [a, b]) + ' ' }}</b>`), `<span>· Test</span><b>{0} von {1}</b>`)
  assert.deepEqual(schluessel(`$t('a') $t("b") t('c') $t(name) $t('d \\'e\\'')`), ['a', 'b', 'c', "d 'e'"])
})
