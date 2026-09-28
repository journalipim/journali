// ⑁ Plugins, Filter „⚙ System": Systemjobs und die Plugins, ohne die journali nicht arbeitet, stehen normalerweise
// nicht in der Liste — sie lassen sich nicht abwählen. Der Chip schränkt ein wie jeder andere Filter: an = nur diese,
// aus = die übrigen. Vorher liess er sie zusätzlich durch, und die Liste wurde länger statt kürzer (28.09.2026).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { plugins } from '../src/plugins.js'

const PluginsView = (await import('../src/views/PluginsView.vue')).default

function welt() {
  plugins.list = [
    // frei wählbar
    { key: 'csv', version: '1.0.0', installed: true, enabled: true, onDisk: true, manifest: { kind: 'io', label: { de: 'CSV / TSV' } } },
    { key: 'etim', version: '2.0.0', installed: true, enabled: true, onDisk: true, manifest: { kind: 'classification', label: { de: 'ETIM' } } },
    // gehört zu journali: ein Systemjob und ein eingebautes
    { key: 'probe', version: '1.0.6', installed: true, enabled: true, onDisk: true, manifest: { system: true, kind: 'tool', label: { de: 'Bildabmessungen lesen' } } },
    { key: 'tasker', version: '1.5.4', installed: true, enabled: true, onDisk: true, manifest: { builtin: true, kind: 'tool', label: { de: 'Jobs' } } },
    // eines davon hat etwas zu tun: ein Update liegt vor — das steht immer in der Liste
    { key: 'driver', version: '1.0.1', installed: true, enabled: true, onDisk: true, update: '1.0.2', manifest: { builtin: true, kind: 'tool', label: { de: 'Zugänge' } } },
  ]
  plugins.load = async () => {}
  plugins.active = k => plugins.list.find(p => p.key === k)?.enabled ?? false
  plugins.views = []
  plugins.requires = () => []
  plugins.dependents = () => []
}

const keys = w => w.findAll('.scroll .li').map(li => li.find('.k').text())
const systemChip = w => w.findAll('.view-chip').find(c => c.text().startsWith('⚙ System'))

test('ohne den Filter stehen nur die waehlbaren da — und was zu tun hat', async () => {
  welt()
  const w = mount(PluginsView); await flushPromises()
  const k = keys(w)
  assert.ok(k.includes('csv') && k.includes('etim'))
  assert.ok(!k.includes('probe'), 'ein Systemjob steht nicht zur Wahl')
  assert.ok(!k.includes('tasker'), 'ein eingebautes auch nicht')
  assert.ok(k.includes('driver'), 'aber eines mit Update steht da, weil es etwas zu tun gibt')
})

test('der Chip zaehlt, was verborgen ist', async () => {
  welt()
  const w = mount(PluginsView); await flushPromises()
  // probe und tasker sind verborgen, driver nicht (Update)
  assert.match(systemChip(w).text(), /2$/)
})

test('mit dem Filter stehen NUR die zu journali gehoerenden da', async () => {
  welt()
  const w = mount(PluginsView); await flushPromises()
  await systemChip(w).trigger('click')
  const k = keys(w)
  assert.deepEqual([...k].sort(), ['driver', 'probe', 'tasker'])
  assert.ok(!k.includes('csv'), 'die waehlbaren sind jetzt aussen vor')
  assert.ok(!k.includes('etim'))
})

test('noch ein Klick zeigt wieder die waehlbaren', async () => {
  welt()
  const w = mount(PluginsView); await flushPromises()
  await systemChip(w).trigger('click')
  await systemChip(w).trigger('click')
  const k = keys(w)
  assert.ok(k.includes('csv') && !k.includes('probe'))
})
