// Einrichtung: der Server hat keine Datenbank (keine eingerichtet, nicht erreichbar, Passwort falsch) — der Dialog
// zeigt, wie es steht, ist vorbefüllt, prüft und speichert mit dem Einrichtungscode und geht zur Anmeldung, sobald der
// eigentliche Server antwortet. Die Anmeldeseite legt mit dem Code den ersten Administrator an oder das Passwort eines
// Administrators fest, wenn keiner eines hat.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey } from 'vue-router'
import { store } from '../src/store.js'

const DbSetupView = (await import('../src/views/DbSetupView.vue')).default
const LoginView = (await import('../src/views/LoginView.vue')).default

/// Server als Tabelle: Pfad → Antwort (Objekt oder Funktion); jeder Aufruf wird mitgeschrieben
function server(routen) {
  const calls = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '')
    const body = opts.body ? JSON.parse(opts.body) : null
    calls.push({ path, method: opts.method ?? 'GET', body })
    const r = routen[path.split('?')[0]]
    const antwort = typeof r === 'function' ? r(body) : r ?? {}
    const status = antwort?.__status ?? 200
    return { ok: status < 400, status, statusText: 'x', text: async () => JSON.stringify(antwort) }
  }
  return calls
}
/// Router-Ersatz: merkt sich, wohin die Ansicht will (useRouter holt ihn über routerKey)
async function aufbauen(view, pfad) {
  const router = { path: pfad, replace(p) { this.path = p }, push(p) { this.path = p } }
  const w = mount(view, { global: { provide: { [routerKey]: router } } })
  await flushPromises()
  return { w, router }
}
const unerreichbar = { lage: 'unerreichbar', grund: 'timeout', detail: 'Timeout during connecting', versuch: 3, auto: true, quelle: 'umgebung',
  ziel: { host: 'db.intern', port: 7432, database: 'journali', user: 'postgres', password: true } }

test('nicht erreichbar: Lage mit Versuch, Formular vorbefüllt, Passwort unverändert', async () => {
  server({ '/api/auth/state': { dbSetup: true }, '/api/setup/state': unerreichbar })
  const { w } = await aufbauen(DbSetupView, '/setup')
  assert.match(w.find('.lage').text(), /Nicht erreichbar · Zeitüberschreitung · Versuch 3/)
  assert.match(w.find('.lage').text(), /↻/, 'die Automatik läuft und ist zu sehen')
  const inputs = w.findAll('input')
  const wert = i => inputs[i].element.value
  assert.deepEqual([wert(1), wert(2), wert(3), wert(4)], ['db.intern', '7432', 'journali', 'postgres'])
  assert.equal(inputs[5].attributes('placeholder'), 'unverändert')
  assert.match(w.find('.quelle').text(), /Aus der Umgebung des Servers/)
  assert.ok(!w.find('.quelle button').exists(), 'aus der Umgebung gibt es nichts zu verwerfen')
  w.unmount()
})

test('korrigieren geht sofort: Prüfen schickt die geänderte Adresse mit Code und zeigt den Grund', async () => {
  const calls = server({ '/api/auth/state': { dbSetup: true }, '/api/setup/state': unerreichbar,
    '/api/setup/db/test': { ok: false, lage: 'abgewiesen', grund: 'auth', detail: '28P01: password authentication failed' } })
  const { w } = await aufbauen(DbSetupView, '/setup')
  const inputs = w.findAll('input')
  await inputs[0].setValue('ABCD-EFGH')
  await inputs[2].setValue('5432')
  await w.findAll('button').find(b => b.text() === 'Prüfen').trigger('click')
  await flushPromises()
  const test = calls.find(c => c.path === '/api/setup/db/test')
  assert.equal(test.body.code, 'ABCD-EFGH')
  assert.equal(test.body.port, 5432)
  assert.equal(test.body.host, 'db.intern')
  assert.match(w.find('.msg').text(), /✗ Anmeldung an der Datenbank abgewiesen/)
  assert.match(w.find('.msg').attributes('title'), /28P01/)
  w.unmount()
})

test('speichern: der Server startet, die Seite wartet und geht zur Anmeldung, sobald er antwortet', async () => {
  let fertig = false
  server({
    '/api/auth/state': () => fertig ? { enabled: true, setup: false, user: null } : { dbSetup: true },
    '/api/setup/state': { lage: 'keine', grund: 'none', versuch: 0, auto: false, quelle: null, ziel: null },
    '/api/setup/db': { ok: true, lage: 'ok' },
  })
  const { w, router } = await aufbauen(DbSetupView, '/setup')
  assert.match(w.find('.lage').text(), /Keine Datenbank eingerichtet/)
  const inputs = w.findAll('input')
  await inputs[0].setValue('ABCD-EFGH'); await inputs[1].setValue('localhost'); await inputs[5].setValue('geheim12')
  await w.find('form').trigger('submit')
  await flushPromises()
  assert.match(w.find('.msg').text(), /Server startet mit dieser Datenbank/)
  assert.ok(w.find('fieldset').attributes('disabled') !== undefined, 'während des Starts ist nichts mehr zu ändern')
  fertig = true
  await new Promise(r => setTimeout(r, 2200)); await flushPromises()
  assert.equal(router.path, '/login')
  assert.equal(store.auth.dbSetup, undefined)
  w.unmount()
})

test('gespeicherte Verbindung verwerfen: nur, wenn sie aus der Datei kommt, mit Code', async () => {
  const calls = server({ '/api/auth/state': { dbSetup: true }, '/api/setup/state': { ...unerreichbar, lage: 'abgewiesen', grund: 'auth', auto: false, quelle: 'datei' },
    '/api/setup/db/reset': { ...unerreichbar, quelle: 'umgebung' } })
  const { w } = await aufbauen(DbSetupView, '/setup')
  assert.match(w.find('.quelle').text(), /Gespeichert im Datenverzeichnis/)
  await w.findAll('input')[0].setValue('ABCD-EFGH')
  await w.find('.quelle button').trigger('click')
  await flushPromises()
  assert.deepEqual(calls.find(c => c.path === '/api/setup/db/reset').body, { code: 'ABCD-EFGH' })
  w.unmount()
})

test('Anmeldeseite: kein Administrator hat ein Passwort — Auswahl aus den Administratoren, Code, Festlegen', async () => {
  const calls = server({ '/api/auth/state': { enabled: true, setup: false, claim: ['admin', 'it'], code: true, user: null }, '/api/auth/claim': { user: 'it', role: 'admin' } })
  const { w } = await aufbauen(LoginView, '/login')
  assert.match(w.find('h2').text(), /Administrator-Passwort festlegen/)
  const auswahl = w.find('select')
  assert.deepEqual(auswahl.findAll('option').map(o => o.text()), ['admin', 'it'])
  await auswahl.setValue('it')
  const [pw, code] = w.findAll('input')
  await pw.setValue('neu-und-lang'); await code.setValue('abcd-efgh')
  await w.find('form').trigger('submit')
  await flushPromises()
  assert.deepEqual(calls.find(c => c.path === '/api/auth/claim').body, { user: 'it', password: 'neu-und-lang', code: 'abcd-efgh' })
  assert.match(w.find('button[type=submit]').text(), /Festlegen und anmelden/)
  w.unmount()
})

test('Anmeldeseite: ersten Administrator anlegen schickt den Code mit; normale Anmeldung fragt nicht danach', async () => {
  let calls = server({ '/api/auth/state': { enabled: false, setup: true, code: true, user: null }, '/api/auth/setup': { user: 'chef', role: 'admin' } })
  let { w } = await aufbauen(LoginView, '/login')
  const [name, anzeige, pw, code] = w.findAll('input')
  await name.setValue('chef'); await anzeige.setValue('Chef'); await pw.setValue('lang-genug'); await code.setValue('ABCD-EFGH')
  await w.find('form').trigger('submit')
  await flushPromises()
  assert.equal(calls.find(c => c.path === '/api/auth/setup').body.code, 'ABCD-EFGH')
  w.unmount()

  server({ '/api/auth/state': { enabled: true, setup: false, claim: null, code: false, user: null } })
  ;({ w } = await aufbauen(LoginView, '/login'))
  assert.equal(w.findAll('input').length, 2, 'Anmeldename und Passwort, kein Code')
  assert.ok(!w.find('select').exists())
  w.unmount()
})

// 02.10.2026: die Verschlüsselung der Verbindung zur Datenbank ist im Dialog einstellbar (Npgsql SSL Mode); die Vorgabe ist „wenn möglich“.
test('Verschlüsselung: Vorgabe „wenn möglich“, aus der gespeicherten Verbindung vorbefüllt, geht mit Prüfen und Speichern hinaus', async () => {
  const calls = server({ '/api/auth/state': { dbSetup: true }, '/api/setup/state': { ...unerreichbar, ziel: { ...unerreichbar.ziel, ssl: 'Require' } },
    '/api/setup/db/test': { ok: true, lage: 'ok', grund: '', detail: '' }, '/api/setup/db': { ok: true, lage: 'ok', grund: '', detail: '' } })
  const { w } = await aufbauen(DbSetupView, '/setup')
  const wahl = w.find('select')
  assert.deepEqual(wahl.findAll('option').map(o => o.attributes('value')), ['Prefer', 'Require', 'VerifyCA', 'VerifyFull', 'Disable'])
  assert.equal(wahl.element.value, 'Require', 'aus der gespeicherten Verbindung')
  await wahl.setValue('VerifyFull')
  await w.findAll('input')[0].setValue('ABCD-EFGH')
  await w.findAll('button').find(b => b.text() === 'Prüfen').trigger('click'); await flushPromises()
  assert.equal(calls.find(c => c.path === '/api/setup/db/test').body.ssl, 'VerifyFull')
  w.unmount()
})

test('Verschlüsselung: ohne gespeicherte Angabe steht „wenn möglich“ da', async () => {
  server({ '/api/auth/state': { dbSetup: true }, '/api/setup/state': unerreichbar })
  const { w } = await aufbauen(DbSetupView, '/setup')
  assert.equal(w.find('select').element.value, 'Prefer')
  assert.match(w.find('label select').element.closest('label').getAttribute('title'), /entscheidet der Betreiber der Datenbank/)
  w.unmount()
})

