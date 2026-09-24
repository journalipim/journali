// ⌁ Plugins: das Siegel und der Katalog. Ein zertifiziertes Plugin trägt ❖ mit dem Ausstellungsdatum, ein verändertes
// ⚠ mit dem Grund, eines ohne Zertifikat nichts; der Filter ❖ zeigt nur Zertifizierte. Der Katalog listet, was der
// Herausgeber hat, und „holen" ruft den Server, der das Zip lädt und das Siegel prüft.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { plugins } from '../src/plugins.js'
import { api } from '../src/api.js'
import { store } from '../src/store.js'

const PluginsView = (await import('../src/views/PluginsView.vue')).default
const opts = { global: { stubs: { RouterLink: true, 'router-link': true, Splitter: true } } }

function welt() {
  plugins.list = [
    { key: 'csv', version: '1.0.0', installed: true, enabled: true, onDisk: true, certified: true, sealIssued: '2026-09-24', sealIssuer: 'journali', manifest: { kind: 'import', label: { de: 'Import: CSV' } } },
    { key: 'json', version: '2.2.0', installed: true, enabled: true, onDisk: true, certified: false, sealReason: 'Dateien verändert', manifest: { kind: 'import', label: { de: 'Import: JSON' } } },
    { key: 'mine', version: '0.1.0', installed: false, enabled: false, onDisk: true, certified: false, manifest: { kind: 'tool', label: { de: 'Eigenes' } } },
  ]
  plugins.load = async () => {}
  plugins.active = k => plugins.list.find(p => p.key === k)?.enabled ?? false
  plugins.views = []
  plugins.requires = () => []
  plugins.dependents = () => []
}
const row = (w, key) => w.findAll('.scroll .li').find(li => li.find('.k').text() === key)

test('Siegel in der Liste: ❖ mit Datum, ⚠ mit Grund, sonst nichts', async () => {
  welt()
  const orig = api.get; api.get = async () => { throw new Error('offline') }
  try {
    const w = mount(PluginsView, opts)
    await flushPromises()
    const csv = row(w, 'csv').find('.seal'); assert.equal(csv.text(), '❖'); assert.match(csv.attributes('title'), /2026-09-24/)
    const json = row(w, 'json').find('.seal'); assert.equal(json.text(), '⚠'); assert.match(json.attributes('title'), /Dateien verändert/)
    assert.ok(!row(w, 'mine').find('.seal').exists())
    // Details des gewählten (csv ist das erste): Zertifikat-Abschnitt mit Herausgeber und Datum
    assert.match(w.text(), /❖ journali · 2026-09-24/)
    // Katalog offline: der Abschnitt sagt es, ohne Rat
    assert.match(w.find('.catalog').text(), /nicht erreichbar/)
  } finally { api.get = orig }
})

test('Filter ❖ zeigt nur Zertifizierte', async () => {
  welt()
  const orig = api.get; api.get = async () => ({ plugins: [] })
  try {
    const w = mount(PluginsView, opts)
    await flushPromises()
    await w.findAll('.view-chip').find(c => c.text() === '❖ zertifiziert').trigger('click')
    await flushPromises()
    assert.deepEqual(w.findAll('.scroll .li').map(li => li.find('.k').text()), ['csv'])
  } finally { api.get = orig }
})

test('Katalog: holen ruft den Server, eine neuere Fassung steht als ↑ da', async () => {
  welt()
  store.actor = 'u1'
  const calls = []
  const origGet = api.get, origPost = api.post
  api.get = async url => url.startsWith('/api/plugins/catalog') ? { url: 'https://example.invalid/catalog.json', plugins: [
    { entry: { key: 'csv', version: '1.1.0', label: { de: 'Import: CSV' }, file: 'csv-1.1.0.zip' }, onDisk: true, diskVersion: '1.0.0', certified: true },
    { entry: { key: 'geo', version: '1.0.0', label: { de: 'GEO' }, file: 'geo-1.0.0.zip' }, onDisk: false },
    { entry: { key: 'json', version: '2.2.0', label: { de: 'Import: JSON' }, file: 'json-2.2.0.zip' }, onDisk: true, diskVersion: '2.2.0', certified: false },
  ] } : []
  api.post = async url => { calls.push(url); return {} }
  try {
    const w = mount(PluginsView, opts)
    await flushPromises()
    const rows = w.findAll('.catalog .li').filter(li => li.find('.k').exists())
    assert.deepEqual(rows.map(r => r.find('.k').text()), ['csv', 'geo', 'json'])
    assert.equal(rows[0].find('button').text(), '↑ 1.1.0')      // neuer als auf der Platte
    assert.equal(rows[1].find('button').text(), '⇩ holen')      // fehlt
    assert.ok(!rows[2].find('button').exists())                 // liegt schon da, gleiche Fassung
    await rows[1].find('button').trigger('click')
    await flushPromises()
    assert.deepEqual(calls, ['/api/plugins/catalog/geo/fetch'])
  } finally { api.get = origGet; api.post = origPost }
})
