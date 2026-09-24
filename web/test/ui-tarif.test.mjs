// Tarife in der Oberfläche: ein Plugin ausserhalb des Tarifs der Instanz steht mit dem Tarif da,
// der es hat, lädt nicht und lässt sich nicht einschalten; Unlimited heisst ∞ und ein Balken, der nicht rot wird.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { plugins } from '../src/plugins.js'

const PluginsView = (await import('../src/views/PluginsView.vue')).default
const UsageMini = (await import('../src/components/UsageMini.vue')).default
const stubs = { global: { stubs: { RouterLink: true, 'router-link': true, Splitter: true } } }

function welt() {
  plugins.list = [
    { key: 'csv', version: '1.0.0', installed: true, enabled: true, onDisk: true, allowed: true, tarif: 'free', manifest: { kind: 'import', label: { de: 'Import: CSV / TSV' } } },
    { key: 'dpp', version: '1.0.0', installed: true, enabled: false, onDisk: true, allowed: false, tarif: 'proplus', manifest: { kind: 'quality', label: { de: 'Qualität: DPP' } } },
  ]
  plugins.load = async () => {}
  plugins.views = []
  plugins.requires = () => []
  plugins.dependents = () => []
}

test('ein Plugin ausserhalb des Tarifs nennt den Tarif und bleibt aus', async () => {
  welt()
  const w = mount(PluginsView, stubs); await flushPromises()
  const zeile = w.findAll('.scroll .li').find(li => li.find('.k').text() === 'dpp')
  assert.match(zeile.text(), /◇ Pro\+/, 'der Tarif, der es hat, steht nicht da')
  await zeile.trigger('click'); await flushPromises()
  const schalter = w.findAll('button').find(b => /deaktiviert/.test(b.text()))
  assert.ok(schalter, 'der Schalter fehlt')
  assert.ok(schalter.attributes('disabled') !== undefined, 'es lässt sich einschalten')
  assert.match(schalter.attributes('title'), /Tarif Pro\+/)
  w.unmount()
})

test('was der Tarif nicht erlaubt, lädt nicht — auch wenn es an ist', () => {
  plugins.list = [{ key: 'dpp', enabled: true, allowed: false, manifest: {} }, { key: 'csv', enabled: true, allowed: true, manifest: {} }]
  assert.equal(plugins.active('dpp'), false)
  assert.equal(plugins.active('csv'), true)
})

test('Unlimited: ∞ im Tooltip, Balken leer und grün', () => {
  const OHNE = 2147483647
  const w = mount(UsageMini, { props: { usage: { week: { used: 50000, max: OHNE, resetAt: '2026-09-28' }, month: { used: 90000, max: OHNE, resetAt: '2026-10-01' } } } })
  const u = w.findAll('.u')[0]
  assert.match(u.attributes('title'), /von ∞ genutzt · noch ∞ verfügbar/)
  assert.match(u.find('.fill').attributes('style') ?? '', /width:\s*0%/)
  assert.ok(u.find('.fill').classes('pos'))
})
