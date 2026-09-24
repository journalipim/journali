// Einstellungen → Allgemein.
// Ohne Anmeldung ist der Name das Einzige, was in jedem Eintrag als Urheber steht — da muss das Feld bleiben.
// Mit Anmeldung kommt der Urheber aus der Sitzung; dann hätte das Feld nichts zu sagen und steht auch nicht da.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'

const SettingsView = (await import('../src/views/SettingsView.vue')).default

/// Server, der auf alles das Leere der jeweiligen Art antwortet — geprüft wird die Oberfläche, nicht das Backend.
/// Listen bekommen [], alles andere ein Objekt mit den Feldern, die die Nebenbereiche (Konto, Mail, Storage) erwarten.
function stiller_server() {
  const listen = ['/roles', '/users', '/people', '/rights', '/workflows', '/tokens', '/presets', '/jobs']
  globalThis.fetch = async url => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    const body = listen.some(l => path.endsWith(l)) ? []
      : { user: 'admin', role: 'admin', rights: [], tokens: [], prefs: {}, config: {}, ready: false, locales: [], channels: [], attributes: [], groups: [], statuses: [], lists: [] }
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
}

function feld(w) {
  return w.findAll('tr').find(r => r.text().includes('Name'))?.find('input')
}

test('ohne Anmeldung steht der Name da — er ist der einzige Urheber', async () => {
  stiller_server()
  store.auth = { known: true, enabled: false, setup: false, user: null, role: null, name: null }
  store.actor = 'u1'
  const w = mount(SettingsView); await flushPromises()
  const f = feld(w)
  assert.ok(f && f.exists(), 'das Namensfeld fehlt, obwohl es keine Anmeldung gibt')
  assert.equal(f.element.value, 'u1')
  w.unmount()
})

test('mit Anmeldung ist das Namensfeld weg', async () => {
  stiller_server()
  store.auth = { known: true, enabled: true, setup: true, user: 'admin', role: 'admin', name: 'Admin', rights: ['users', 'model', 'storage'] }
  store.actor = 'admin'
  const w = mount(SettingsView); await flushPromises()
  assert.equal(feld(w), undefined, 'das Namensfeld steht noch da, obwohl der Urheber aus der Sitzung kommt')
  w.unmount()
})

test('Speichern rührt den Urheber nicht an, solange es eine Anmeldung gibt', async () => {
  stiller_server()
  store.auth = { known: true, enabled: true, setup: true, user: 'admin', role: 'admin', name: 'Admin', rights: ['users'] }
  store.actor = 'admin'
  const w = mount(SettingsView); await flushPromises()
  const speichern = w.findAll('button').find(b => b.text().includes('Speichern und prüfen'))
  assert.ok(speichern, 'der Knopf „Speichern und prüfen“ fehlt')
  await speichern.trigger('click'); await flushPromises()
  assert.equal(store.actor, 'admin', 'der Urheber der Sitzung wurde überschrieben')
  w.unmount()
})

// Die Serveradresse ist keine Anwendersache. Die Oberfläche fragt den Server, der sie ausgeliefert hat.
test('auf der Ich-Seite steht keine Serveradresse', async () => {
  stiller_server()
  store.auth = { known: true, enabled: true, setup: false, user: 'u1', role: 'admin', rights: ['read'] }
  const w = mount(SettingsView); await flushPromises(); await flushPromises()
  assert.ok(!w.text().includes('Server, der diese Seite liefert'), 'kein Feld für eine andere Adresse')
  assert.ok(!w.findAll('tr').some(r => /🖧 Server/.test(r.text())), 'und keine Zeile dafür')
  w.unmount()
})

test('eine alte Adresse aus dem Browser wirkt nicht weiter', async () => {
  try { localStorage.setItem('journali.settings', JSON.stringify({ server: 'http://fremder:8080', actor: 'u1' })) } catch {}
  const frisch = (await import('../src/store.js?neu=' + Date.now())).store
  assert.equal(frisch.server, '', 'was früher gespeichert wurde, wird verworfen')
})
