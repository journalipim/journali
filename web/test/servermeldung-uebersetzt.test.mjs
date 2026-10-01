// Servermeldungen in der Sprache der Oberfläche (Stufe 4): der Server schickt { error, template, args } — die Vorlage ist
// der deutsche Text und damit der Schlüssel, die Werte füllen {0}, {1} …; api.js übersetzt, bevor die Meldung jemand sieht.
// Ein Server ohne Vorlage (ältere Version, Ausnahme) liefert weiter seinen Text.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { api, serverText } from '../src/api.js'
import { i18n } from '../src/i18n.js'
import { store } from '../src/store.js'

const antwort = (status, body) => async () => ({ status, ok: status < 400, statusText: 'x', text: async () => JSON.stringify(body) })

test('Vorlage und Werte werden in der Sprache der Oberfläche zusammengesetzt', async () => {
  i18n.global.setLocaleMessage('en', { 'Plugin {0} ist nicht installiert oder aus.': 'Plugin {0} is not installed or off.' })
  const d = { error: 'Plugin csv ist nicht installiert oder aus.', template: 'Plugin {0} ist nicht installiert oder aus.', args: ['csv'] }
  i18n.global.locale.value = 'de'
  assert.equal(serverText(d), 'Plugin csv ist nicht installiert oder aus.')
  i18n.global.locale.value = 'en'
  assert.equal(serverText(d), 'Plugin csv is not installed or off.')
  i18n.global.locale.value = 'de'
  assert.equal(serverText({ error: 'nur Text' }), 'nur Text', 'ohne Vorlage der Text des Servers')
  assert.equal(serverText({ message: 'Stapel' }), 'Stapel', 'Stapelfehler tragen message')
})

test('api wirft die übersetzte Meldung; ein Stapel-Fehler bekommt sie als message', async () => {
  const origFetch = globalThis.fetch, origServer = store.server
  store.server = ''
  i18n.global.setLocaleMessage('en', { 'Knoten gibt es nicht.': 'Node does not exist.', 'Unbekannter Befehl: {0}': 'Unknown command: {0}' })
  i18n.global.locale.value = 'en'
  try {
    globalThis.fetch = antwort(400, { error: 'Knoten gibt es nicht.', template: 'Knoten gibt es nicht.', args: [] })
    await assert.rejects(api.get('/api/x'), { message: 'Node does not exist.' })
    globalThis.fetch = antwort(200, { batch: 'b1', results: [], error: { index: 0, op: 'foo', message: 'Unbekannter Befehl: foo', template: 'Unbekannter Befehl: {0}', args: ['foo'] } })
    const res = await api.batchChunked([{ op: 'foo', args: {} }])
    assert.equal(res.error.message, 'Unknown command: foo')
  } finally { globalThis.fetch = origFetch; store.server = origServer; i18n.global.locale.value = 'de' }
})
