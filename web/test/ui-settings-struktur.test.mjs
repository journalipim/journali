// Einstellungen: ein Reiter je Sache (Taloan, 23.09.2026: „die Seite Anlage heisst völlig bescheuert und wirft alles Kraut
// und Rüben durcheinander — im Grunde ist das der Tab für den Administrator, den wir jetzt in seine Bestandteile zerlegen:
// Workflows, Storage, Assets, Backup & Recovery, Rollen & Rechte“). Wer mit seinen Rechten hierher kommt, sieht, was er
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
      : { user: 'taloan', role: 'admin', rights: [], tokens: [], prefs: {}, config: {}, ready: false, locales: [], channels: [], attributes: [], groups: [], statuses: [], lists: [], history: [], days: [] }
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

test('ein Leser sieht sich und sein Team — sonst nichts', async () => {
  const w = await sicht(['read'])
  assert.deepEqual(reiter(w), ['◐ Ich', '👥 Team'])
  await ruhe(); w.unmount()
})

test('der Administrator sieht die Bestandteile einzeln, nicht als Sammelseite', async () => {
  const w = await sicht(['read', 'users', 'storage', 'model', 'team'])
  assert.deepEqual(reiter(w), ['◐ Ich', '👥 Team', '◈ Rollen & Rechte', '▨ Storage', '🖼 Assets', '✉ Mail', '▣ Backup & Recovery', '⚑ Workflows'])
  assert.ok(!reiter(w).some(r => /Anlage/.test(r)), 'die Sammelseite gibt es nicht mehr')
  await ruhe(); w.unmount()
})

test('Assets ohne Storage: die Ableitungsgrössen ja, der Speicher nicht', async () => {
  const w = await sicht(['read', 'model'])
  assert.deepEqual(reiter(w), ['◐ Ich', '👥 Team', '🖼 Assets', '⚑ Workflows'])
  await w.findAll('.tab').find(t => t.text() === '🖼 Assets').trigger('click'); await ruhe()
  const t = w.text()
  assert.match(t, /Vorschau-Presets/, 'die Grössen stehen hier')
  assert.ok(!t.includes('Medienspeicher'), 'der Speicher selbst nicht')
  await ruhe(); w.unmount()
})

test('mein Konto steht bei mir, Rollen und Teams in der Verwaltung', async () => {
  const w = await sicht(['read', 'users'])
  const ich = w.text()
  assert.match(ich, /Konto/); assert.match(ich, /API-Token/)
  assert.ok(!ich.includes('Rollen ·'), 'die Rollentabelle hat hier nichts zu suchen')
  await w.findAll('.tab').find(t => t.text() === '◈ Rollen & Rechte').trigger('click'); await ruhe()
  const verwaltung = w.text()
  assert.match(verwaltung, /Rollen/)
  assert.match(verwaltung, /Teams/, 'Teams anlegen gehört zu den Personen, nicht auf die Teamseite')
  assert.ok(!verwaltung.includes('aktuelles Passwort'), 'mein Passwort steht nicht in der Verwaltung')
  await ruhe(); w.unmount()
})

test('ohne Anmeldung gibt es kein Team — und der Urheber steht bei mir', async () => {
  const w = await sicht(null, false)
  assert.ok(!reiter(w).includes('👥 Team'), 'ohne Benutzer gibt es keine Gruppe')
  const t = w.text()
  assert.ok(!t.includes('aktuelles Passwort'), 'und kein Konto')
  assert.match(t, /Name/, 'dafür den Urheber')
  await ruhe(); w.unmount()
})
