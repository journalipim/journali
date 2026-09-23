// Einstellungen in drei Ebenen (Taloan, 23.09.2026: „im Moment ist alles durcheinander wie es gewachsen ist“ und
// „hier habe ich alles quer gemischt — Einstellungen für mein eigenes Konto und die Verwaltung der Benutzer“).
// ◐ Ich · 👥 Team · ⚙ Anlage · ⚑ Workflows. Wer etwas nicht darf, sieht es nicht — weder Reiter noch Abschnitt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'

const SettingsView = (await import('../src/views/SettingsView.vue')).default

function server() {
  const listen = ['/roles', '/users', '/people', '/rights', '/workflows', '/tokens', '/presets', '/jobs', '/teams']
  globalThis.fetch = async url => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    const body = listen.some(l => path.endsWith(l)) ? []
      : { user: 'taloan', role: 'admin', rights: [], tokens: [], prefs: {}, config: {}, ready: false, locales: [], channels: [], attributes: [], groups: [], statuses: [], lists: [], history: [] }
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
}
const ruhe = async () => { for (let i = 0; i < 4; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }
const reiter = w => w.findAll('.tab').map(t => t.text())
async function sicht(rights, enabled = true) {
  server()
  store.auth = { known: true, enabled, setup: false, user: 'taloan', role: 'r', name: 'D', rights }
  const w = mount(SettingsView); await ruhe()
  return w
}

test('ein Leser sieht sich selbst und den Zustand der Anlage — mehr nicht', async () => {
  const w = await sicht(['read'])
  assert.deepEqual(reiter(w), ['◐ Ich', '⚙ Anlage'])
  await w.findAll('.tab').find(t => t.text() === '⚙ Anlage').trigger('click'); await ruhe()
  const t = w.text()
  assert.match(t, /Nutzung/, 'den Verbrauch der Anlage darf jeder sehen')
  assert.ok(!t.includes('Mailserver'), 'Mail gehört ihm nicht')
  assert.ok(!t.includes('Rollen'), 'die Verwaltung auch nicht')
  await ruhe(); w.unmount()
})

test('mein Konto steht bei mir, die Verwaltung in der Anlage', async () => {
  const w = await sicht(['read', 'users'])
  const ich = w.text()
  assert.match(ich, /Konto/, 'Passwort und Token gehören zu mir')
  assert.match(ich, /API-Token/)
  assert.ok(!ich.includes('Rollen'), 'die Rollentabelle hat hier nichts zu suchen')
  await w.findAll('.tab').find(t => t.text() === '⚙ Anlage').trigger('click'); await ruhe()
  const anlage = w.text()
  assert.match(anlage, /Rollen/, 'die Verwaltung steht in der Anlage')
  assert.match(anlage, /Mailserver/)
  assert.ok(!anlage.includes('aktuelles Passwort'), 'mein Passwort steht nicht in der Verwaltung')
  await ruhe(); w.unmount()
})

test('Team nur mit Team-Recht, Workflows nur mit Modell-Recht', async () => {
  const w1 = await sicht(['read', 'team'])
  assert.deepEqual(reiter(w1), ['◐ Ich', '👥 Team', '⚙ Anlage'])
  await ruhe(); w1.unmount()
  const w2 = await sicht(['read', 'model'])
  assert.deepEqual(reiter(w2), ['◐ Ich', '⚙ Anlage', '⚑ Workflows'])
  await ruhe(); w2.unmount()
  const w3 = await sicht(['read', 'users', 'storage', 'model', 'team'])
  assert.deepEqual(reiter(w3), ['◐ Ich', '👥 Team', '⚙ Anlage', '⚑ Workflows'])
  await ruhe(); w3.unmount()
})

test('ohne Anmeldung gibt es kein Team und kein Konto — aber alles andere', async () => {
  const w = await sicht(null, false)
  assert.ok(!reiter(w).includes('👥 Team'), 'ohne Benutzer gibt es keine Teams')
  const t = w.text()
  assert.ok(!t.includes('aktuelles Passwort'), 'und kein Konto')
  assert.match(t, /Name/, 'dafür den Urheber — ohne Anmeldung ist er das Einzige, was zählt')
  await ruhe(); w.unmount()
})
