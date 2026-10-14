// Übersicht eines Themas (⇪ Export, 14.10.2026): table bringt drei Kacheln mit — CSV-Export, Excel-Export, Struktur —, und alle drei zeigten
// dieselbe Beschreibung des Plugins. Jetzt sagt jede ihren eigenen Satz; ein Plugin mit einer Kachel zeigt weiter seine Beschreibung.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { createRouter, createMemoryHistory } from 'vue-router'
import { plugins } from '../src/plugins.js'

const HubView = (await import('../src/views/HubView.vue')).default

test('mehrere Kacheln eines Plugins sagen je ihren Satz, eine einzelne die Beschreibung des Plugins', async () => {
  Object.assign(plugins, {
    loaded: true,
    list: [
      { key: 'table', enabled: true, version: '1.1.1', manifest: { kind: 'io', description: { de: 'Basis-Plugin der Gruppen Import und Export.' } } },
      { key: 'json', enabled: true, version: '1.3.1', manifest: { kind: 'io', description: { de: 'Strukturierte Daten als JSON.' } } },
    ],
    views: [
      { key: 'table', path: 'export', topic: 'export', order: 10, label: 'CSV-Export', icon: '⊞', hint: 'CSV (; UTF-8)' },
      { key: 'table', path: 'export-xlsx', topic: 'export', order: 11, label: 'Excel-Export', icon: '⊞', hint: 'Arbeitsmappe (.xlsx)' },
      { key: 'json', path: 'export', topic: 'export', order: 30, label: 'JSON-Export', icon: '⇪', hint: 'kurz' },
    ],
  })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/export', component: HubView, props: { topic: 'export' } }, { path: '/p/:k/:p', component: { template: '<div />' } }] })
  router.push('/export'); await router.isReady()
  const w = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
  try {
    await flushPromises()
    const kachel = name => w.findAll('.tile').find(k => k.find('.name').text() === name)?.find('.text').text()
    assert.equal(kachel('CSV-Export'), 'CSV (; UTF-8)')
    assert.equal(kachel('Excel-Export'), 'Arbeitsmappe (.xlsx)')
    assert.equal(kachel('JSON-Export'), 'Strukturierte Daten als JSON.')
  } finally { w.unmount() }
})
