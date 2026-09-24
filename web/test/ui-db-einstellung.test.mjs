// ⇅ B&R → Datenbank: womit der Server verbunden ist, und das Passwort erst nach dem eigenen — für wer die Datenbank
// selbst sichert. Nach einer Minute ist es wieder verdeckt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'

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

test('Verbindung sichtbar, Passwort verdeckt; anzeigen verlangt das eigene', async () => {
  const calls = server({ '/api/backup/db': verbindung, '/api/backup/db/password': b => b.password === 'meins-123' ? { password: 'Zufall-aus-dem-Paket' } : { __status: 400, error: 'Passwort falsch.' } })
  const w = mount(DbSettings)
  await flushPromises()
  assert.match(w.find('h2').text(), /db:5432\/journali/)
  assert.match(w.text(), /Umgebung des Servers/)
  assert.ok(!w.text().includes('Zufall-aus-dem-Paket'))
  await w.findAll('button').find(b => b.text().includes('anzeigen')).trigger('click')
  const feld = w.find('input[type=password]')
  await feld.setValue('falsch'); await w.find('form').trigger('submit'); await flushPromises()
  assert.match(w.text(), /✗ Passwort falsch/)
  assert.ok(!w.text().includes('Zufall-aus-dem-Paket'))
  await w.find('input[type=password]').setValue('meins-123'); await w.find('form').trigger('submit'); await flushPromises()
  assert.equal(w.find('.klar').text(), 'Zufall-aus-dem-Paket')
  assert.deepEqual(calls.filter(c => c.path === '/api/backup/db/password').map(c => c.body.password), ['falsch', 'meins-123'])
  await w.findAll('button').find(b => b.text() === '◌').trigger('click')
  assert.ok(!w.find('.klar').exists(), 'wieder verdeckt')
  w.unmount()
})

test('ohne Passwort in der Verbindung gibt es nichts anzuzeigen', async () => {
  server({ '/api/backup/db': { ...verbindung, password: false, quelle: 'datei' } })
  const w = mount(DbSettings)
  await flushPromises()
  assert.match(w.text(), /Einrichtungsdialog/)
  assert.ok(!w.findAll('button').some(b => b.text().includes('anzeigen')))
  w.unmount()
})
