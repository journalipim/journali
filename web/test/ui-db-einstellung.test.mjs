// ⇅ B&R → Datenbank: womit der Server verbunden ist, und das Passwort erst nach dem eigenen — für wer die Datenbank
// selbst sichert. Nach einer Minute ist es wieder verdeckt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { dialog } from '../src/dialog.js'
import { store } from '../src/store.js'

const DbSettings = (await import('../src/components/DbSettings.vue')).default

function server(routen) {
  const calls = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '')
    const body = opts.body ? JSON.parse(opts.body) : null
    calls.push({ path, method: opts.method ?? 'GET', body })
    const r = routen[path]; const a = typeof r === 'function' ? r(body) : r ?? {}
    const status = a.__status ?? 200
    return { ok: status < 400, status, statusText: 'x', text: async () => JSON.stringify(a) }
  }
  return calls
}
const verbindung = { host: 'db', port: 5432, database: 'journali', user: 'postgres', quelle: 'umgebung', password: true }

test('Verbindung sichtbar, Passwort verdeckt; anzeigen fragt in einem eigenen Fenster nach dem Anmeldepasswort', async () => {
  const calls = server({ '/api/backup/db': verbindung, '/api/backup/db/password': b => b.password === 'meins-123' ? { password: 'Zufall-aus-dem-Paket' } : { __status: 400, error: 'Passwort falsch.' } })
  store.auth = { known: true, enabled: true, user: 'u1', role: 'admin', rights: ['users'] }
  const w = mount(DbSettings)
  await flushPromises()
  assert.match(w.find('h2').text(), /db:5432\/journali/)
  assert.match(w.text(), /Umgebung des Servers/)
  assert.ok(!w.text().includes('Zufall-aus-dem-Paket'))

  // die Rückfrage steht nicht in der Zeile des Datenbankpassworts — dort sähe sie aus wie „überschreiben"
  const gefragt = []
  const orig = dialog.prompt
  dialog.prompt = async o => { gefragt.push(o); return gefragt.length === 1 ? 'falsch' : 'meins-123' }
  try {
    const knopf = () => w.findAll('button').find(b => b.text().includes('anzeigen'))
    await knopf().trigger('click'); await flushPromises()
    assert.ok(!w.find('input').exists(), 'die Abfrage steht in der Tabelle')
    assert.match(gefragt[0].title, /Datenbankpasswort anzeigen/)
    assert.match(gefragt[0].text, /Anmeldepasswort von u1/)
    assert.equal(gefragt[0].secret, true, 'das Feld zeigt die Eingabe lesbar')
    assert.match(w.text(), /✗ Passwort falsch/)
    assert.ok(!w.text().includes('Zufall-aus-dem-Paket'))

    await knopf().trigger('click'); await flushPromises()
    assert.equal(w.find('.klar').text(), 'Zufall-aus-dem-Paket')
    assert.deepEqual(calls.filter(c => c.path === '/api/backup/db/password').map(c => c.body.password), ['falsch', 'meins-123'])
    await w.findAll('button').find(b => b.text() === '◌').trigger('click')
    assert.ok(!w.find('.klar').exists(), 'wieder verdeckt')
  } finally { dialog.prompt = orig }
  w.unmount()
})

test('wer die Rückfrage abbricht, fragt den Server nicht', async () => {
  const calls = server({ '/api/backup/db': verbindung })
  const orig = dialog.prompt
  dialog.prompt = async () => null
  try {
    const w = mount(DbSettings); await flushPromises()
    await w.findAll('button').find(b => b.text().includes('anzeigen')).trigger('click'); await flushPromises()
    assert.ok(!calls.some(c => c.path === '/api/backup/db/password'))
    w.unmount()
  } finally { dialog.prompt = orig }
})

test('ohne Passwort in der Verbindung gibt es nichts anzuzeigen', async () => {
  server({ '/api/backup/db': { ...verbindung, password: false, quelle: 'datei' } })
  const w = mount(DbSettings)
  await flushPromises()
  assert.match(w.text(), /Einrichtungsdialog/)
  assert.ok(!w.findAll('button').some(b => b.text().includes('anzeigen')))
  w.unmount()
})

// 02.10.2026: die Zeile Verschlüsselung sagt, was die Verbindung wirklich ist (Postgres: pg_stat_ssl), daneben, was eingestellt ist
test('Verschlüsselung: verschlüsselt mit Version, im Klartext rot, unbekannt als Strich — dazu der eingestellte Modus', async () => {
  const zeile = w => w.find('tr.ssl')
  server({ '/api/backup/db': { ...verbindung, ssl: { modus: 'Prefer', verschluesselt: true, version: 'TLSv1.3' } } })
  let w = mount(DbSettings); await flushPromises()
  assert.match(zeile(w).text(), /Verschlüsselung\s*✓ verschlüsselt\s*TLSv1\.3\s*· Prefer/)
  assert.ok(zeile(w).find('.pos').exists()); w.unmount()

  server({ '/api/backup/db': { ...verbindung, ssl: { modus: 'Prefer', verschluesselt: false, version: null } } })
  w = mount(DbSettings); await flushPromises()
  assert.match(zeile(w).text(), /✗ im Klartext/); assert.ok(zeile(w).find('.neg').exists(), 'unverschlüsselt ist rot')
  assert.match(zeile(w).text(), /· Prefer/); w.unmount()

  server({ '/api/backup/db': { ...verbindung, ssl: { modus: 'Require', verschluesselt: null, version: null } } })
  w = mount(DbSettings); await flushPromises()
  assert.match(zeile(w).text(), /—/); assert.match(zeile(w).text(), /· Require/); w.unmount()
})

// 02.10.2026: der Modus ist in den Einstellungen änderbar; der Server probiert, bevor er speichert — gilt nach dem nächsten Start
test('Verschlüsselung ändern: Auswahl, Übernehmen schickt PUT, Hinweis auf den Neustart; Fehler bleibt stehen', async () => {
  let ssl = { modus: 'Prefer', verschluesselt: true, version: 'TLSv1.3', aenderbar: true, vorgemerkt: null }
  const calls = server({
    '/api/backup/db': () => ({ ...verbindung, quelle: 'datei', ssl }),
    '/api/backup/db/ssl': b => {
      if (b.modus === 'VerifyFull') return { __status: 400, template: 'Mit {0} lässt sich keine Verbindung herstellen: {1}', args: ['VerifyFull', 'kein Zertifikat'] }
      ssl = { ...ssl, vorgemerkt: b.modus }; return { modus: b.modus, neustart: true }
    },
  })
  store.auth = { known: true, enabled: true, user: 'u1', role: 'admin', rights: ['users'] }
  const w = mount(DbSettings); await flushPromises()
  const wahl = () => w.find('tr.sslwahl select')
  const uebernehmen = () => w.find('tr.sslwahl button')
  assert.equal(wahl().element.value, 'Prefer')
  assert.ok(!uebernehmen().exists(), 'ohne Änderung kein Knopf')

  await wahl().setValue('VerifyFull'); assert.ok(uebernehmen().exists())
  await uebernehmen().trigger('click'); await flushPromises()
  assert.match(w.text(), /✗ Mit VerifyFull lässt sich keine Verbindung herstellen: kein Zertifikat/)
  assert.ok(!w.find('tr.ssl').text().includes('→'), 'nichts vorgemerkt')

  await wahl().setValue('Require')
  await uebernehmen().trigger('click'); await flushPromises()
  const put = calls.filter(c => c.path === '/api/backup/db/ssl' && c.method === 'PUT')
  assert.deepEqual(put.map(c => c.body), [{ modus: 'VerifyFull' }, { modus: 'Require' }])
  assert.match(w.text(), /✓ Require gespeichert — gilt nach dem nächsten Start/)
  assert.match(w.find('tr.ssl').text(), /· Prefer\s*→ Require/, 'laufender Modus und vorgemerkter stehen nebeneinander')
  assert.equal(wahl().element.value, 'Require')
  assert.ok(!uebernehmen().exists(), 'das Vorgemerkte ist die Auswahl: kein Knopf')
  w.unmount()
})

test('Verschlüsselung ändern: aus der Umgebung des Servers ist die Auswahl gesperrt', async () => {
  server({ '/api/backup/db': { ...verbindung, ssl: { modus: 'Prefer', verschluesselt: true, version: 'TLSv1.3', aenderbar: false, vorgemerkt: null } } })
  const w = mount(DbSettings); await flushPromises()
  assert.ok(w.find('tr.sslwahl select').attributes('disabled') !== undefined)
  assert.ok(!w.find('tr.sslwahl button').exists())
  w.unmount()
})
