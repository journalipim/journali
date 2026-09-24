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
    const csv = row(w, 'csv').find('.seal'); assert.equal(csv.text(), '❖')
    assert.match(csv.attributes('title'), /journali Core Plugin · 2026-09-24/, 'nach aussen heisst ❖ nicht „zertifiziert“')
    const json = row(w, 'json').find('.seal'); assert.equal(json.text(), '⚠'); assert.match(json.attributes('title'), /Dateien verändert/)
    assert.ok(!row(w, 'mine').find('.seal').exists())
    // Details des gewählten (csv ist das erste): Herkunft mit Datum
    assert.match(w.text(), /journali Core Plugin · 2026-09-24/)
    // Katalog offline: der Abschnitt sagt es, ohne Rat
    assert.match(w.find('.catalog').text(), /nicht erreichbar/)
  } finally { api.get = orig }
})

test('Filter ❖ zeigt nur Originale', async () => {
  welt()
  const orig = api.get; api.get = async () => ({ plugins: [] })
  try {
    const w = mount(PluginsView, opts)
    await flushPromises()
    await w.findAll('.view-chip').find(c => c.text() === '❖ Core').trigger('click')
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

test('jede Zeile hat dieselben drei Spalten rechts — mit und ohne Fassung, Siegel, Verzeichnis', async () => {
  welt()
  plugins.list.push({ key: 'weg', installed: true, enabled: false, onDisk: false, manifest: { kind: 'tool', label: { de: 'Eine sehr lange Bezeichnung, die abgeschnitten wird' } } })
  const orig = api.get; api.get = async () => ({ plugins: [] })
  try {
    const w = mount(PluginsView, opts)
    await flushPromises()
    for (const li of w.findAll('.scroll .li'))
      assert.deepEqual(li.findAll('.r > span').map(s => s.classes()[0]), ['c-ver', 'c-seal', 'c-state'], li.find('.k').text())
    assert.deepEqual(w.findAll('.li.head .r > span').map(s => s.classes()[0]), ['c-ver', 'c-seal', 'c-state'], 'der Kopf steht über denselben Spalten')
    assert.match(row(w, 'weg').find('.c-state').text(), /✗/, 'fehlendes Verzeichnis steht beim Zustand')
  } finally { api.get = orig }
})

test('ein Plugin, das der Tarif nicht enthält, wirkt nicht — auch wenn es im Journal aktiviert ist', async () => {
  welt()
  plugins.list = [{ key: 'da', version: '1.1.0', installed: true, enabled: true, onDisk: true, allowed: false, tarif: 'pro', manifest: { kind: 'quality', label: { de: 'Qualität: Datenanalyse' } } }]
  plugins.active = k => { const p = plugins.list.find(x => x.key === k); return !!p?.enabled && p.allowed !== false }
  const orig = api.get; api.get = async () => ({ plugins: [] })
  try {
    const w = mount(PluginsView, opts)
    await flushPromises()
    assert.equal(row(w, 'da').find('.c-state').text(), '◇ Pro', 'in der Liste steht der Tarif, nicht „an“')
    const schalter = w.findAll('.pane button').find(b => b.text().includes('◇'))
    assert.equal(schalter.text(), '◇ Pro', 'der Schalter sagt nicht „aktiviert“')
    assert.ok(!schalter.classes().includes('primary'), 'und leuchtet nicht')
    assert.match(schalter.attributes('title'), /ohne Wirkung/)
    assert.match(w.text(), /aktiviert, ohne Wirkung/)
  } finally { api.get = orig }
})

test('ein Siegel eines anderen Herausgebers nennt diesen, nicht journali', async () => {
  welt()
  plugins.list = [{ key: 'fremd', version: '1.0.0', installed: true, enabled: true, onDisk: true, certified: true, sealIssued: '2026-09-24', sealIssuer: 'acme', manifest: { kind: 'tool', label: { de: 'Fremd' } } }]
  const orig = api.get; api.get = async () => ({ plugins: [] })
  try {
    const w = mount(PluginsView, opts)
    await flushPromises()
    assert.match(row(w, 'fremd').find('.seal').attributes('title'), /Original von acme/)
    assert.ok(!w.text().includes('journali Core Plugin'))
  } finally { api.get = orig }
})

test('die Spaltenbreiten lassen sich ziehen und bleiben gemerkt', async () => {
  welt()
  try { localStorage.removeItem('journali.cols.plugins') } catch {}
  const orig = api.get; api.get = async () => ({ plugins: [] })
  try {
    const w = mount(PluginsView, opts)
    await flushPromises()
    const kopf = w.find('.li.head .k')
    const breite = () => w.find('.pane').attributes('style')
    assert.match(breite(), /--c-key: 70px/)
    await kopf.find('.grip').trigger('mousedown', { clientX: 100 })
    window.dispatchEvent(Object.assign(new window.Event('mousemove'), { clientX: 160 }))
    await flushPromises()
    assert.match(breite(), /--c-key: 130px/, 'die Spalte folgt der Maus nicht')
    window.dispatchEvent(new window.Event('mouseup'))
    await flushPromises()
    assert.match(localStorage.getItem('journali.cols.plugins') ?? '', /"key":130/, 'die Breite wurde nicht gemerkt')
    // Doppelklick auf den Griff setzt alle zurück
    await kopf.find('.grip').trigger('dblclick')
    await flushPromises()
    assert.match(breite(), /--c-key: 70px/)
  } finally { api.get = orig }
})

test('„mein Tarif" zeigt nur, was erlaubt ist — und nur, wenn überhaupt etwas fehlt', async () => {
  welt()
  plugins.list = [
    { key: 'csv', version: '1.0.0', installed: true, enabled: true, onDisk: true, allowed: true, manifest: { kind: 'import', label: { de: 'Import: CSV' } } },
    { key: 'da', version: '1.1.0', installed: true, enabled: true, onDisk: true, allowed: false, tarif: 'pro', manifest: { kind: 'quality', label: { de: 'Datenanalyse' } } },
    { key: 'dpp', version: '1.0.0', installed: false, enabled: false, onDisk: true, allowed: false, tarif: 'proplus', manifest: { kind: 'quality', label: { de: 'DPP' } } },
  ]
  const orig = api.get; api.get = async () => ({ plugins: [] })
  try {
    const w = mount(PluginsView, opts)
    await flushPromises()
    const chip = () => w.findAll('.view-chip').find(c => c.text() === '◆ mein Tarif')
    await chip().trigger('click'); await flushPromises()
    assert.deepEqual(w.findAll('.scroll .li').map(li => li.find('.k').text()), ['csv'])
    // mit einem anderen Filter zusammen: beide gelten
    await w.findAll('.view-chip').find(c => c.text() === '⇩ nicht installiert').trigger('click'); await flushPromises()
    assert.deepEqual(w.findAll('.scroll .li').map(li => li.find('.k').text()), [], 'die Filter gelten nicht zusammen')
    await chip().trigger('click'); await flushPromises()
    assert.deepEqual(w.findAll('.scroll .li').map(li => li.find('.k').text()), ['dpp'])
    w.unmount()

    // erlaubt der Tarif alles, gibt es den Schalter nicht
    plugins.list = plugins.list.map(p => ({ ...p, allowed: true }))
    const w2 = mount(PluginsView, opts); await flushPromises()
    assert.ok(!w2.findAll('.view-chip').some(c => c.text() === '◆ mein Tarif'))
    w2.unmount()
  } finally { api.get = orig }
})
