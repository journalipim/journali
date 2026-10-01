// Ohne Sitzung antwortet /api/health nur mit Version und Bau (kein Journalstand): store.poll hält den Punkt unten links grün, fragt das Modell nicht (401)
// und lässt nichts von einer früheren Anmeldung stehen. Mit Sitzung bleibt alles wie vorher.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { store } from '../src/store.js'

function server(health) {
  const rufe = []
  globalThis.fetch = async url => {
    const pfad = String(url).replace(/^https?:\/\/[^/]+/, '')
    rufe.push(pfad)
    if (pfad.startsWith('/api/model')) return { ok: false, status: 401, text: async () => JSON.stringify({ error: 'Anmeldung nötig.' }), json: async () => ({ error: 'Anmeldung nötig.' }) }
    const antwort = pfad.startsWith('/api/health') ? health : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}

test('abgemeldet: der Punkt bleibt grün, das Modell wird nicht geholt, die alten Zahlen sind weg', async () => {
  store.head = 143124; store.nodes = 1439; store.usage = { week: {} }; store.model = { attributes: [] }; store.tarif = { key: 'x' }
  const rufe = server({ ok: true, abgemeldet: true, version: '0.9.0', built: '2026-10-01T19:34:00Z' })
  await store.poll()
  assert.equal(store.online, true, 'Server und Datenbank antworten')
  assert.equal(store.error, '')
  assert.equal(rufe.some(p => p.startsWith('/api/model')), false, 'ohne Sitzung gibt es kein Modell zu holen')
  assert.equal(store.head, null); assert.equal(store.nodes, null); assert.equal(store.usage, null); assert.equal(store.tarif, null); assert.equal(store.model, null)
  assert.equal(store.version, '0.9.0'); assert.match(store.build, /^\d{4}\.\d{4}$/)
})

test('angemeldet: Journalstand, Zahlen und Modell kommen wie vorher', async () => {
  store.model = null
  const rufe = server({ head: 7, nodes: 12, usage: { week: { used: 1 } }, version: '0.9.0', built: '2026-10-01T19:34:00Z', tarif: { key: 'pro' } })
  await store.poll()
  assert.equal(store.head, 7); assert.equal(store.nodes, 12); assert.equal(store.tarif.key, 'pro')
  // das Modell wird gefragt (hier 401 vom Stellvertreter) — der Aufruf geht hinaus
  assert.equal(rufe.some(p => p.startsWith('/api/model')), true)
})

test('Datenbank nicht erreichbar: der Server antwortet 503, der Punkt wird rot', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 503, text: async () => JSON.stringify({ error: 'Datenbank nicht erreichbar.', db: false }), json: async () => ({ error: 'Datenbank nicht erreichbar.', db: false }) })
  await store.poll()
  assert.equal(store.online, false); assert.equal(store.dbDown, true)
})
