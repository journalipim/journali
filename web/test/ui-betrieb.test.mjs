// Spiegel und Schnappschuss stellt der Administrator ein (Taloan, 24.09.2026: „ich möchte das nicht per
// Umgebungsvariablen, sondern in den Admin-Settings einstellen können“). Dort steht auch, was die beiden Dateien
// gerade kosten — die Frage kam mit: „habe ich dann eine 3-GB-Postgres und daneben noch mal einen 3-GB-Cache?“
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'

const StorageSettings = (await import('../src/components/StorageSettings.vue')).default

const BETRIEB = {
  journalCache: true, snapshot: true, eingestellt: false,
  spiegel: { pfad: 'journal-db.cache.jsonl', da: true, bytes: 232_000_000, at: '2026-09-24T06:00:00Z' },
  schnappschuss: { pfad: 'snapshot-db.json', da: true, bytes: 322_000_000, at: '2026-09-24T06:00:00Z' },
}

function server({ betrieb = BETRIEB } = {}) {
  const calls = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    calls.push({ path, method: opts.method ?? 'GET', body: opts.body ? JSON.parse(opts.body) : null })
    const body = path === '/api/betrieb' ? betrieb
      : path === '/api/media/store' ? { kind: 's3', total: 0, config: { driver: 's3' }, error: null }
      : path === '/api/media/stats' ? { total: 0, bytes: 0, kinds: [], derived: {}, largest: [] }
      : path === '/api/media/presets' ? []
      : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
  return calls
}
const ruhe = async () => { for (let i = 0; i < 5; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }
const admin = () => { store.auth = { known: true, enabled: true, user: 'taloan', role: 'admin', rights: ['read', 'storage', 'model'] } }

test('der Speicher-Reiter sagt, was Spiegel und Schnappschuss kosten', async () => {
  server(); admin()
  const w = mount(StorageSettings, { props: { teil: 'speicher' } }); await ruhe()
  const t = w.text().replace(/\s+/g, ' ')
  assert.match(t, /Spiegel/); assert.match(t, /Schnappschuss/)
  assert.match(t, /221,3mb/i, 'die Grösse des Spiegels steht da')
  assert.match(t, /307,1mb/i, 'und die des Schnappschusses')
  assert.match(t, /gilt ab dem nächsten Start/, 'und wann eine Änderung wirkt')
  await ruhe(); w.unmount()
})

test('der Schalter geht an den Server, nicht an eine Umgebungsvariable', async () => {
  const calls = server(); admin()
  const w = mount(StorageSettings, { props: { teil: 'speicher' } }); await ruhe()
  const zeile = w.findAll('tr').find(r => r.text().startsWith('Spiegel'))
  const kasten = zeile.find('input[type=checkbox]')
  kasten.element.checked = false
  await kasten.trigger('change')
  await ruhe()
  const put = calls.find(c => c.path === '/api/betrieb' && c.method === 'PUT')
  assert.ok(put, 'nichts ging hinaus')
  assert.equal(put.body.journalCache, false)
  await ruhe(); w.unmount()
})

test('wegwerfen fragt vorher und nennt die Grösse', async () => {
  const calls = server(); admin()
  const w = mount(StorageSettings, { props: { teil: 'speicher' } }); await ruhe()
  const knopf = w.findAll('button').filter(b => b.text() === '🗑')[0]
  knopf.trigger('click'); await ruhe()
  assert.match(dialog.title, /Spiegel wegwerfen/)
  assert.match(dialog.text, /221,3mb/i)
  dialog.done(true); await ruhe()
  assert.ok(calls.some(c => c.path === '/api/betrieb/spiegel' && c.method === 'DELETE'), 'die Datei wurde nicht weggeworfen')
  await ruhe(); w.unmount()
})

test('im Assets-Reiter steht davon nichts — das ist Ablage des Servers', async () => {
  server(); admin()
  const w = mount(StorageSettings, { props: { teil: 'assets' } }); await ruhe()
  assert.ok(!/Schnappschuss/.test(w.text()), 'gehört zum Speicher, nicht zu den Assets')
  await ruhe(); w.unmount()
})
