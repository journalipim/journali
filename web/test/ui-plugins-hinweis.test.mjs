// ⬡ Plugins (05.10.2026): ein Plugin mit Hinweis (Manifest: acknowledge — DPP, PPWR, EmpCo) zeigt vor dem Einschalten die Punkte; nur mit
// „zur Kenntnis genommen“ geht ?hinweis=<Version> an den Server. Ein eingeschaltetes Plugin ohne Bestätigung wirkt nicht und bietet sie an.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mount, flushPromises } from './ui.mjs'
import { plugins } from '../src/plugins.js'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'

const PluginsView = (await import('../src/views/PluginsView.vue')).default
const opts = { global: { stubs: { RouterLink: true, 'router-link': true, Splitter: true } } }
const manifest = JSON.parse(fs.readFileSync(new URL('../../plugins/dpp/plugin.json', import.meta.url), 'utf8'))

async function ansicht(eintrag, antwort, knopf) {
  plugins.list = [{ key: 'da', version: '1', installed: true, enabled: true, onDisk: true, allowed: true, manifest: { kind: 'analysis', label: { de: 'Datenanalyse' } } },
    { key: 'dpp', version: manifest.version, installed: true, onDisk: true, allowed: true, manifest, ...eintrag }]
  plugins.load = async () => {}; plugins.pruefeZustand = async () => {}; plugins.views = []
  store.actor = 'u1'; store.poll = async () => {}
  const gefragt = [], gesendet = []
  const confirm = dialog.confirm, post = api.post, get = api.get
  dialog.confirm = async o => { gefragt.push(o); return antwort }
  api.post = async p => { gesendet.push(p); return {} }
  api.get = async () => ({ plugins: [] })
  try {
    const w = mount(PluginsView, opts); await flushPromises()
    await w.findAll('.scroll .li').find(li => li.find('.k').text() === 'dpp').trigger('click'); await flushPromises()
    const b = w.findAll('button').find(x => x.text() === knopf)
    assert.ok(b, `Knopf ${knopf}: ${w.findAll('button').map(x => x.text()).join(' | ')}`)
    await b.trigger('click'); await flushPromises()
    w.unmount()
    return { gefragt, gesendet }
  } finally { dialog.confirm = confirm; api.post = post; api.get = get }
}

test('DPP einschalten: der Hinweis nennt keine Rechtsberatung, keine Gewähr, Hilfsmittel; nein schaltet nichts ein', async () => {
  const { gefragt, gesendet } = await ansicht({ enabled: false }, false, '○ deaktiviert')
  assert.equal(gefragt.length, 1)
  assert.match(gefragt[0].warn, /keine Rechtsberatung/)
  assert.equal(gefragt[0].list.length, 3)
  assert.match(gefragt[0].list[1], /Keine Gewähr/)
  assert.deepEqual(gesendet, [])
})

test('zur Kenntnis genommen: die Version des Hinweises geht mit', async () => {
  const { gesendet } = await ansicht({ enabled: false }, true, '○ deaktiviert')
  assert.deepEqual(gesendet, [`/api/plugins/dpp/enable?hinweis=${manifest.acknowledge.version}`])
})

test('eingeschaltet, aber nicht bestätigt: es wirkt nicht, und „Hinweis bestätigen“ schickt die Bestätigung', async () => {
  plugins.list = [{ key: 'da', enabled: true, onDisk: true, manifest: {} }, { key: 'dpp', enabled: true, onDisk: true, manifest }]
  assert.equal(plugins.active('dpp'), false)
  plugins.list[1].acknowledged = manifest.acknowledge.version
  assert.equal(plugins.active('dpp'), true)
  const { gesendet } = await ansicht({ enabled: true }, true, '◐ Hinweis bestätigen')
  assert.deepEqual(gesendet, [`/api/plugins/dpp/acknowledge?hinweis=${manifest.acknowledge.version}`])
})
