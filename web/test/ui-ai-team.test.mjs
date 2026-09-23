// Was in der Leiste als ✦ steht (Taloan, 23.09.2026: „die vom eigenen Team hoffentlich“). Der Zähler im Browser kennt nur
// diesen einen Rechner; die Zahl, an der die Grenzen hängen, ist der Monatsverbrauch des eigenen Teams. Geprüft wird,
// woher sie kommt, dass sie nach einem Aufruf mitwächst — und dass ein eigener Schlüssel weiter für sich zählt.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { ai } from '../src/ai.js'

function server({ state = null, antwort = null } = {}) {
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '')
    const body = path === '/api/ai/state' ? state : path === '/api/ai/ask' ? antwort : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
}
const STATE = { team: 'zentral', label: 'Zentrale', payer: 'zentral', payerLabel: 'Zentrale', providers: ['anthropic'], ready: true,
  limits: { included: 200000, monthly: 0, daily: 50000 }, used: { today: 1200, month: 80000 } }

test('die Leiste nimmt den Monatsverbrauch des eigenen Teams', async () => {
  server({ state: STATE })
  await ai.loadState()
  const t = ai.teamUsed()
  assert.equal(t.label, 'Zentrale')
  assert.equal(t.month, 80000)
  assert.equal(t.today, 1200)
  assert.equal(t.limit, 200000, 'gemessen wird am Grundkontingent')
  assert.equal(t.hard, true, 'das ist eine harte Grenze, keine Warnschwelle')
})

test('ohne Grundkontingent gilt die Monatsschwelle — und ohne beide gibt es keinen Anteil', async () => {
  server({ state: { ...STATE, limits: { included: 0, monthly: 100000, daily: 0 } } })
  await ai.loadState()
  assert.equal(ai.teamUsed().limit, 100000)
  assert.equal(ai.teamUsed().hard, false, 'die Monatsschwelle warnt nur')
  server({ state: { ...STATE, limits: { included: 0, monthly: 0, daily: 0 } } })
  await ai.loadState()
  assert.equal(ai.teamUsed().limit, 0)
})

test('nach einem Aufruf über den Server wächst der Stand des Teams mit', async () => {
  server({ state: STATE, antwort: { text: 'ok', sources: [], usage: { in: 300, out: 200 } } })
  await ai.loadState()
  ai.accounts.anthropic.key = ''        // kein eigener Schlüssel: der Server fragt
  const vorher = ai.teamUsed().month
  await ai.ask({ user: 'hallo' })
  assert.equal(ai.teamUsed().month, vorher + 500, 'sonst stünde bis zum nächsten Laden eine alte Zahl da')
  assert.equal(ai.teamUsed().today, 1700)
})

test('ohne Team bleibt es beim Zähler dieses Browsers', async () => {
  server({ state: { team: null, ready: false } })
  await ai.loadState()
  assert.equal(ai.teamUsed(), null, 'dann zeigt die Leiste den eigenen Zähler')
})
