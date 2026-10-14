// Einstellungen: ein Reiter je Sache. Wer mit seinen Rechten hierher kommt, sieht, was er
// sehen oder ändern darf — alles andere nicht.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'

const SettingsView = (await import('../src/views/SettingsView.vue')).default

function server() {
  const listen = ['/roles', '/users', '/people', '/rights', '/workflows', '/tokens', '/presets', '/jobs', '/teams', '/members']
  globalThis.fetch = async url => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    const body = listen.some(l => path.endsWith(l)) ? []
      : { user: 'u1', role: 'admin', rights: [], tokens: [], prefs: {}, config: {}, ready: false, locales: [], channels: [], attributes: [], groups: [], statuses: [], lists: [], history: [], days: [] }
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
}
const ruhe = async () => { for (let i = 0; i < 4; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }
const reiter = w => w.findAll('.tab').map(t => t.text())
async function sicht(rights, enabled = true) {
  server()
  store.auth = { known: true, enabled, setup: false, user: 'u1', role: 'r', name: 'D', rights }
  const w = mount(SettingsView); await ruhe()
  return w
}

test('ein Leser sieht sich und sein Team — sonst nichts', async () => {
  const w = await sicht(['read'])
  assert.deepEqual(reiter(w), ['◐ Mein Account', '◍ Team'])
  // die Darstellung „System“ folgt dem Betriebssystem, gleich welchem (14.10.2026: vorher hiess es „der Windows-Einstellung“)
  assert.match(w.text(), /System folgt der Einstellung des Betriebssystems/)
  await ruhe(); w.unmount()
})

test('der Administrator sieht die Bestandteile einzeln, nicht als Sammelseite', async () => {
  store.erlaubteServer = 1
  let w = await sicht(['read', 'users', 'storage', 'model', 'team'])
  assert.deepEqual(reiter(w), ['◐ Mein Account', '◍ Team', '◈ IAM', '⚑ Workflows', '▨ Storage', '▩ Assets', '✉ Mail', '⇅ B&R'], 'ein Server: kein Reiter ⧉ Server')
  await ruhe(); w.unmount()
  store.erlaubteServer = 3   // Unlimited oder der Zusatz Multi-Server
  w = await sicht(['read', 'users', 'storage', 'model', 'team'])
  assert.deepEqual(reiter(w), ['◐ Mein Account', '◍ Team', '◈ IAM', '⚑ Workflows', '▨ Storage', '▩ Assets', '✉ Mail', '⇅ B&R', '⧉ Server'])
  store.erlaubteServer = 1
  assert.ok(!reiter(w).some(r => /Anlage/.test(r)), 'die Sammelseite gibt es nicht mehr')
  await ruhe(); w.unmount()
})

test('Assets ohne Storage: die Ableitungsgrössen ja, der Speicher nicht', async () => {
  const w = await sicht(['read', 'model'])
  assert.deepEqual(reiter(w), ['◐ Mein Account', '◍ Team', '⚑ Workflows', '▩ Assets'])
  await w.findAll('.tab').find(t => t.text() === '▩ Assets').trigger('click'); await ruhe()
  const t = w.text()
  assert.match(t, /Vorschau-Presets/, 'die Grössen stehen hier')
  assert.ok(!t.includes('Assetspeicher'), 'der Speicher selbst nicht')
  await ruhe(); w.unmount()
})

test('meine Zugangsdaten stehen bei mir, Rollen und Teams im IAM', async () => {
  const w = await sicht(['read', 'users'])
  const ich = w.text()
  assert.match(ich, /Zugangsdaten/); assert.match(ich, /API-Token/)
  assert.ok(!ich.includes('Rollen ·'), 'die Rollentabelle hat hier nichts zu suchen')
  await w.findAll('.tab').find(t => t.text() === '◈ IAM').trigger('click'); await ruhe()
  const verwaltung = w.text()
  assert.match(verwaltung, /Rollen/)
  assert.match(verwaltung, /Teams/, 'Teams anlegen gehört zu den Personen, nicht auf die Teamseite')
  assert.ok(!verwaltung.includes('aktuelles Passwort'), 'mein Passwort steht nicht in der Verwaltung')
  await ruhe(); w.unmount()
})

test('ohne Anmeldung gibt es kein Team — und der Urheber steht bei mir', async () => {
  const w = await sicht(null, false)
  assert.ok(!reiter(w).includes('◍ Team'), 'ohne Benutzer gibt es keine Gruppe')
  const t = w.text()
  assert.ok(!t.includes('aktuelles Passwort'), 'und kein Konto')
  assert.match(t, /Name/, 'dafür den Urheber')
  await ruhe(); w.unmount()
})

// Ein Klick auf die Zahlen in der Leiste führt dorthin, wo sie ausführlich stehen — auch wenn die
// Einstellungen schon offen sind: der Reiter folgt der Sprungmarke.
test('die Sprungmarke trifft ihren Reiter, auch bei offener Seite', async () => {
  const w = await sicht(['read', 'users', 'model', 'team'])
  assert.equal(w.findAll('.tab.on')[0].text(), '◐ Mein Account', 'ohne Marke beginnt es bei mir')
  location.hash = '#teams'
  window.dispatchEvent(new window.HashChangeEvent('hashchange'))
  await ruhe()
  assert.equal(w.findAll('.tab.on')[0].text(), '◍ Team')
  location.hash = ''
  await ruhe(); w.unmount()
})
