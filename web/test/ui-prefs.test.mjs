// Eigene Einstellungen: Darstellung, Sicht und Umfang
// folgen der Person an jeden Rechner; der Fensterzustand bleibt am Gerät. Geprüft wird, was wirklich hinausgeht.
import test from 'node:test'
import assert from 'node:assert/strict'
import { flushPromises } from './ui.mjs'
import { store } from '../src/store.js'

/// Server, der jeden Aufruf mitschreibt; /api/auth/state liefert, was `state` sagt
function server(state = {}) {
  const calls = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '')
    calls.push({ path, method: opts.method ?? 'GET', body: opts.body ? JSON.parse(opts.body) : null })
    const body = path === '/api/auth/state' ? state : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
  return calls
}
const warten = async () => { await flushPromises(); await new Promise(r => setTimeout(r, 500)); await flushPromises() }

test('mit Anmeldung geht die Darstellung an den Benutzer — nur das Geänderte', async () => {
  const calls = server()
  store.auth = { known: true, enabled: true, setup: false, user: 'u1', role: 'admin', name: 'U1', rights: ['read'] }
  store._prefsSent = null
  store.theme = 'dark'
  store.save(); await warten()
  const put = calls.filter(c => c.path === '/api/auth/me/prefs' && c.method === 'PUT')
  assert.equal(put.length, 1, 'die Einstellung ging nicht hinaus')
  assert.equal(put[0].body.prefs.theme, '"dark"')
  // zweimal dasselbe speichern schickt nichts mehr
  store.save(); await warten()
  assert.equal(calls.filter(c => c.path === '/api/auth/me/prefs').length, 1, 'unverändert und trotzdem geschickt')
  // ein anderer Schalter geht allein hinaus, ohne den Rest
  store.scope = 'can'
  store.save(); await warten()
  const zweite = calls.filter(c => c.path === '/api/auth/me/prefs').at(-1)
  assert.deepEqual(Object.keys(zweite.body.prefs), ['scope'], 'es ging mehr hinaus als der geänderte Schalter')
})

test('ohne Anmeldung bleibt alles im Browser', async () => {
  const calls = server()
  store.auth = { known: true, enabled: false, setup: false, user: null, role: null, name: null, rights: null }
  store._prefsSent = null
  store.theme = 'light'
  store.save(); await warten()
  assert.equal(calls.filter(c => c.path === '/api/auth/me/prefs').length, 0, 'ohne Benutzer gibt es niemanden, dem das folgen könnte')
  assert.match(localStorage.getItem('journali.settings') ?? '', /"theme":"light"/, 'im Browser steht es trotzdem')
})

test('beim Anmelden schlagen die Einstellungen der Person die des Browsers', async () => {
  server({ enabled: true, setup: false, user: 'u1', role: 'admin', name: 'U1', rights: ['read'], prefs: { theme: '"dark"', viewLocales: '["de","fr"]', scope: '"only"' } })
  store.theme = 'light'; store.viewLocales = ['de', 'en']; store.scope = 'all'; store._prefsSent = null
  await store.loadAuth(); await flushPromises()
  assert.equal(store.theme, 'dark')
  assert.deepEqual(store.viewLocales, ['de', 'fr'])
  assert.equal(store.scope, 'only')
  assert.equal(document.documentElement.dataset.theme, 'dark', 'die Darstellung wurde auch angewandt, nicht nur gemerkt')
})

test('was am Gerät hängt, geht nicht an den Benutzer', async () => {
  const calls = server()
  store.auth = { known: true, enabled: true, setup: false, user: 'u1', role: 'admin', name: 'U1', rights: ['read'] }
  store._prefsSent = null
  store.save(); await warten()   // Ausgangsstand festhalten
  const vorher = calls.filter(c => c.path === '/api/auth/me/prefs').length
  store.server = 'http://localhost:8080'
  store.journalOpen = false
  store.collapsed = ['axes']
  store.railOff = ['etim']
  store.save(); await warten()
  assert.equal(calls.filter(c => c.path === '/api/auth/me/prefs').length, vorher, 'Fensterzustand gehört zum Gerät, nicht zur Person')
})
