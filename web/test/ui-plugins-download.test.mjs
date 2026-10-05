// ⬡ Plugins (05.10.2026): ein Plugin, das beim ersten Lauf eine Datei aus dem Netz holt (Manifest: download), fragt vor dem Einschalten —
// wofür, was, woher, wie gross. Ohne Zustimmung bleibt es aus, und der Server bekommt keine Anfrage; mit Zustimmung geht ?download=ja mit.
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
const manifest = JSON.parse(fs.readFileSync(new URL('../../plugins/ocr/plugin.json', import.meta.url), 'utf8'))

async function einschalten(antwort) {
  plugins.list = [{ key: 'ocr', version: manifest.version, installed: true, enabled: false, onDisk: true, allowed: true, manifest }]
  plugins.load = async () => {}; plugins.pruefeZustand = async () => {}
  plugins.active = k => plugins.list.find(p => p.key === k)?.enabled ?? false
  plugins.views = []; plugins.requires = () => []; plugins.dependents = () => []
  store.actor = 'u1'; store.poll = async () => {}
  const gefragt = [], gesendet = []
  const confirm = dialog.confirm, post = api.post, get = api.get
  dialog.confirm = async o => { gefragt.push(o); return antwort }
  api.post = async p => { gesendet.push(p); return {} }
  api.get = async () => ({ plugins: [] })
  try {
    const w = mount(PluginsView, opts); await flushPromises()
    await w.findAll('.scroll .li').find(li => li.find('.k').text() === 'ocr').trigger('click'); await flushPromises()
    await w.findAll('button').find(b => b.text() === '○ deaktiviert').trigger('click'); await flushPromises()
    w.unmount()
    return { gefragt, gesendet }
  } finally { dialog.confirm = confirm; api.post = post; api.get = get }
}

test('Texterkennung einschalten: die Frage nennt Zweck, Datei, Adresse und Grösse; nein schaltet nichts ein', async () => {
  const { gefragt, gesendet } = await einschalten(false)
  assert.equal(gefragt.length, 1)
  assert.match(gefragt[0].text, /Texterkennung/)
  assert.ok(gefragt[0].list.some(z => /Sprachdaten/.test(z)))
  assert.ok(gefragt[0].list.some(z => /cdn\.jsdelivr\.net · ≈ 4 MB/.test(z)))
  assert.deepEqual(gesendet, [], 'ohne Zustimmung keine Anfrage an den Server')
})

test('mit Zustimmung geht ?download=ja an den Server', async () => {
  const { gesendet } = await einschalten(true)
  assert.deepEqual(gesendet, ['/api/plugins/ocr/enable?download=ja'])
})
