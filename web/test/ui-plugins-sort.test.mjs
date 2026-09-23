// Plugin-Liste sortieren (Taloan, 23.09.2026: „Spaltenköpfe, damit ich die Plugins sortieren kann“). Vier Spalten,
// Klick dreht die Richtung. Key ist die Vorgabe und zugleich der zweite Schlüssel — gleiche Fassung oder gleicher
// Zustand bleiben dadurch vorhersehbar statt zufällig.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { plugins } from '../src/plugins.js'

const PluginsView = (await import('../src/views/PluginsView.vue')).default

/// Fünf Plugins mit verschiedenen Fassungen und Zuständen
function welt() {
  plugins.list = [
    { key: 'csv', version: '1.0.0', installed: true, enabled: true, onDisk: true, manifest: { kind: 'import', label: { de: 'Import: CSV / TSV' } } },
    { key: 'etim', version: '2.0.0', installed: true, enabled: true, onDisk: true, manifest: { kind: 'class', label: { de: 'Klassifikation: ETIM' } } },
    { key: 'excel', version: '0.1.0', installed: true, enabled: false, onDisk: true, manifest: { kind: 'tool', label: { de: 'Pflege: Excel-Add-in' } } },
    { key: 'xliff', version: '1.10.0', installed: true, enabled: true, onDisk: true, manifest: { kind: 'tool', label: { de: 'Werkzeug: Übersetzung (XLIFF)' } } },
    { key: 'rag', version: '1.0.0', installed: false, enabled: false, onDisk: true, manifest: { kind: 'export', label: { de: 'Export: KI-Wissensbasis' } } },
  ]
  plugins.load = async () => {}
  plugins.active = k => plugins.list.find(p => p.key === k)?.enabled ?? false
  plugins.views = []
  plugins.requires = () => []
  plugins.dependents = () => []
}

const keys = w => w.findAll('.scroll .li').map(li => li.find('.k').text())
/// Der Kopf einer Spalte — ueber den Tooltip, denn die aeussere .r-Spanne enthaelt den Text ihrer Kinder mit
const kopf = (w, text) => w.findAll('.li.head span').find(s => (s.attributes('title') ?? '').startsWith('nach ' + text))

test('Vorgabe ist der Key, aufsteigend', async () => {
  welt()
  const w = mount(PluginsView, { global: { stubs: { RouterLink: true, 'router-link': true, Splitter: true } } })
  await flushPromises()
  assert.deepEqual(keys(w), ['csv', 'etim', 'excel', 'rag', 'xliff'])
  assert.match(kopf(w, 'Key').text(), /▴/)
})

test('Klick auf denselben Kopf dreht die Richtung', async () => {
  welt()
  const w = mount(PluginsView, { global: { stubs: { RouterLink: true, 'router-link': true, Splitter: true } } })
  await flushPromises()
  await kopf(w, 'Key').trigger('click')
  await flushPromises()
  assert.deepEqual(keys(w), ['xliff', 'rag', 'excel', 'etim', 'csv'])
  assert.match(kopf(w, 'Key').text(), /▾/)
})

test('Fassung sortiert nach Zahlen, nicht nach Zeichen', async () => {
  welt()
  const w = mount(PluginsView, { global: { stubs: { RouterLink: true, 'router-link': true, Splitter: true } } })
  await flushPromises()
  await kopf(w, 'Fassung').trigger('click')
  await flushPromises()
  // 1.10.0 steht über 1.0.0 — als Zeichenkette wäre es umgekehrt
  assert.deepEqual(keys(w), ['excel', 'csv', 'rag', 'xliff', 'etim'])
})

test('Bezeichnung und Zustand sortieren nach dem, was man sieht', async () => {
  welt()
  const w = mount(PluginsView, { global: { stubs: { RouterLink: true, 'router-link': true, Splitter: true } } })
  await flushPromises()
  await kopf(w, 'Bezeichnung').trigger('click')
  await flushPromises()
  assert.deepEqual(keys(w), ['rag', 'csv', 'etim', 'excel', 'xliff'])

  await kopf(w, 'Zustand').trigger('click')
  await flushPromises()
  // an (csv, etim, xliff nach Key), dann aus (excel), dann nicht installiert (rag)
  assert.deepEqual(keys(w), ['csv', 'etim', 'xliff', 'excel', 'rag'])
})
