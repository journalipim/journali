// Assets und Wiederherstellen (Taloan, 23.09.2026). Drei Dinge werden geprüft:
// „Ausserdem sprechen wir von Assets und nicht Medien“ — das Wort steht überall, wo der Anwender liest.
// „Warum widersprechen sich die beiden Zahlen“ — 936 sind die ableitbaren, 937 alle; die Ansicht sagt jetzt, welche.
// „Warum ist Sichern hier immer noch drin … ich wollte lediglich das Restore haben“ — das Sichern ist ein Job.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'

const StorageSettings = (await import('../src/components/StorageSettings.vue')).default
const RestoreSettings = (await import('../src/components/RestoreSettings.vue')).default

const STATS = {
  total: 937, bytes: 5_600_000_000, renderable: 936, images: 930, unfiled: 4, unused: 12, shared: 3,
  derived: { count: 936, bytes: 120_000_000 },
  kinds: [{ art: 'Bild', count: 930, bytes: 5_500_000_000 }, { art: 'PDF', count: 6, bytes: 90_000_000 }, { art: 'Datei', count: 1, bytes: 10_000_000 }],
  largest: [{ id: 'm1', name: 'plakat.tif', bytes: 400_000_000 }],
}
const PRESETS = [{ key: 'thumb', label: { de: 'Kachel' }, width: 256, height: 256, format: 'webp', quality: 80, auto: true, images: 936, have: 936, pending: 0 }]

function server({ missing = { total: 937, missing: [] }, stats = STATS } = {}) {
  const calls = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    calls.push({ path, method: opts.method ?? 'GET' })
    const body = path === '/api/media/stats' ? stats
      : path === '/api/media/missing' ? missing
      : path === '/api/media/presets' ? PRESETS
      : path.startsWith('/api/media/presets/') ? { preset: PRESETS[0], job: 'derive' }
      : path === '/api/media/store' ? { kind: 's3', total: 937, config: { driver: 's3' }, error: null }
      : path === '/api/backup/status' ? { hier: { entries: 74930, media: 937, storage: 's3://journali' }, dort: null }
      : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
  return calls
}
const ruhe = async () => { for (let i = 0; i < 5; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }

test('der Bestand nennt Zahl, Grösse und Arten — nicht nur, wie viele da liegen', async () => {
  server(); store.auth = { known: true, enabled: true, user: 'taloan', role: 'admin', rights: ['read', 'model', 'storage'] }
  const w = mount(StorageSettings, { props: { teil: 'assets' } }); await ruhe()
  const t = w.text().replace(/\s+/g, ' ')
  assert.match(t, /937 Assets/, 'die Zahl steht in der Überschrift')
  assert.match(t, /Bild 930/, 'nach Art aufgeschlüsselt')
  assert.match(t, /PDF 6/)
  assert.match(t, /Ableitungen/, 'die gerechneten Vorschauen')
  assert.match(t, /ohne Verwendung/, 'was an keinem Knoten hängt')
  assert.match(t, /12/, 'und wie viele das sind')
  await ruhe(); w.unmount()
})

test('die beiden Zahlen widersprechen sich nicht — die eine zählt alle, die andere die ableitbaren', async () => {
  server(); store.auth = { known: true, enabled: true, user: 'taloan', role: 'admin', rights: ['read', 'model', 'storage'] }
  const w = mount(StorageSettings, { props: { teil: 'assets' } }); await ruhe()
  const t = w.text().replace(/\s+/g, ' ')
  assert.match(t, /ableitbar\s*936 von 937/, 'die Ansicht sagt, welche Zahl wozu gehört')
  const stand = w.findAll('td').find(td => td.text().trim() === '936 / 936')
  assert.ok(stand, 'der Stand der Ableitungen misst sich an den ableitbaren')
  assert.match(stand.attributes('title'), /ableitbaren Assets/)
  await ruhe(); w.unmount()
})

test('der Fehlbestand spricht von Assets', async () => {
  server(); store.auth = { known: true, enabled: true, user: 'taloan', role: 'admin', rights: ['read', 'model', 'storage'] }
  const w = mount(StorageSettings, { props: { teil: 'assets' } }); await ruhe()
  await w.findAll('button').find(b => b.text() === 'Fehlbestand zählen').trigger('click'); await ruhe()
  assert.match(w.text().replace(/\s+/g, ' '), /alle 937 Assets vorhanden/)
  await ruhe(); w.unmount()
})

test('in den Einstellungen steht nur der Weg zurück — gesichert wird als Job', async () => {
  const calls = server(); store.auth = { known: true, enabled: true, user: 'taloan', role: 'admin', rights: ['read', 'users', 'storage'] }
  const w = mount(RestoreSettings); await ruhe()
  const t = w.text().replace(/\s+/g, ' ')
  assert.ok(!w.findAll('button').some(b => /Sichern/.test(b.text())), 'kein Knopf, der sichert')
  assert.equal(w.findAll('input[type=checkbox]').length, 0, 'und keine Schalter, was mitgesichert wird')
  assert.match(t, /Wiederherstellen/, 'das Einspielen bleibt')
  assert.match(t, /Teilbaum einspielen/, 'und die einzelne Datei')
  assert.match(t, /937 Assets/, 'der Stand spricht von Assets')
  assert.ok(!calls.some(c => c.path === '/api/backup' && c.method === 'POST'), 'nichts wurde gesichert')
  await ruhe(); w.unmount()
})

// Ableitungen rechnet der Job, nicht der Mensch (Taloan, 23.09.2026: „ob jedes Mal ein Manager an diese Stelle gehen und
// auf den Knopf jetzt rechnen drücken muss“). Beim Speichern eines Presets stösst der Server ihn selbst an.
test('ein geändertes Preset stösst den Job an — der Knopf ist nur der Nachzieher', async () => {
  const calls = server(); store.auth = { known: true, enabled: true, user: 'taloan', role: 'admin', rights: ['read', 'model', 'storage'] }
  const w = mount(StorageSettings, { props: { teil: 'assets' } }); await ruhe()
  const feld = w.findAll('input[type=number]')[0]
  await feld.setValue(512); await feld.trigger('change'); await ruhe()
  const put = calls.find(c => c.path.startsWith('/api/media/presets/') && c.method === 'PUT')
  assert.ok(put, 'das Preset ging nicht hinaus')
  assert.ok(store.toasts.some(t => /rechnet nach/.test(t.text)), 'und die Meldung sagt, dass gerechnet wird')
  await ruhe(); w.unmount()
})
