// Die Leiste links (Taloan, 24.09.2026: „die Plugin-Leiste wird manchmal erst vollständig wie konfiguriert angezeigt, wenn man
// unten auf Plugins klickt“). Die Plugin-Liste wurde nur beim Einhängen der Oberfläche geholt; kam der Abruf vor der
// Anmeldung, blieb sie leer — und mit ihr fehlten Import, Export und Jobs. Jetzt holt sie sich neu, sobald jemand
// angemeldet ist oder der Server einen neuen Stand meldet.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { nextTick } from 'vue'
import { store } from '../src/store.js'
import { plugins } from '../src/plugins.js'

function server() {
  const abrufe = { n: 0 }
  globalThis.fetch = async url => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    if (path === '/api/plugins') {
      abrufe.n++
      if (!store.auth.user) return { ok: false, status: 401, text: async () => JSON.stringify({ error: 'Anmeldung nötig' }) }
      return { ok: true, status: 200, text: async () => JSON.stringify([{ key: 'table', enabled: true, allowed: true, manifest: { base: ['import', 'export'] } }]) }
    }
    return { ok: true, status: 200, text: async () => '{}' }
  }
  return abrufe
}
const ruhe = async () => { await nextTick(); await new Promise(r => setTimeout(r, 0)); await nextTick() }

test('nach der Anmeldung holt sich die Leiste die Plugins neu', async () => {
  const abrufe = server()
  store.auth = { known: true, enabled: true, user: null }
  store.builtAt = '24.09.2026, 21:14'
  const stop = plugins.beobachte(store)
  await plugins.load(); await ruhe()
  assert.equal(plugins.list.length, 0, 'vor der Anmeldung: 401, leere Liste')
  store.auth = { ...store.auth, user: 'taloan' }; await ruhe()
  assert.equal(abrufe.n, 2, 'nach der Anmeldung wurde nicht neu geholt')
  assert.equal(plugins.list[0]?.key, 'table', 'die Basis für Import und Export fehlt')
  stop()
})

test('ein neuer Stand des Servers lädt die Plugins neu', async () => {
  const abrufe = server()
  store.auth = { known: true, enabled: true, user: 'taloan' }
  store.builtAt = '24.09.2026, 21:14'
  const stop = plugins.beobachte(store)
  store.builtAt = '24.09.2026, 22:05'; await ruhe()
  assert.equal(abrufe.n, 1)
  store.poll = async () => {}
  store.builtAt = '24.09.2026, 22:05'; await ruhe()                     // gleicher Stand: nichts
  assert.equal(abrufe.n, 1)
  stop()
})
