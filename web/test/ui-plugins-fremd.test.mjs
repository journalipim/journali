// ⬡ Plugins (05.10.2026): ein Plugin, das nicht von journali stammt (kein ❖), installiert nur, wer den Warnhinweis bestätigt — er nennt das Siegel,
// wo das Plugin läuft und wer verantwortlich ist. Ohne Bestätigung keine Anfrage; mit ihr ?fremd=ja. Ein Original fragt nicht.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { plugins } from '../src/plugins.js'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'

const PluginsView = (await import('../src/views/PluginsView.vue')).default
const opts = { global: { stubs: { RouterLink: true, 'router-link': true, Splitter: true } } }

async function installieren(p, antwort) {
  plugins.list = [{ key: p.key, installed: false, enabled: false, onDisk: true, diskVersion: '1.0.0', allowed: true, ...p }]
  plugins.load = async () => {}; plugins.pruefeZustand = async () => {}
  plugins.active = () => false
  plugins.views = []; plugins.requires = () => []; plugins.dependents = () => []
  store.actor = 'u1'; store.poll = async () => {}
  const gefragt = [], gesendet = []
  const confirm = dialog.confirm, post = api.post, get = api.get
  dialog.confirm = async o => { gefragt.push(o); return antwort }
  api.post = async x => { gesendet.push(x); return {} }
  api.get = async () => ({ plugins: [] })
  try {
    const w = mount(PluginsView, opts); await flushPromises()
    await w.findAll('.scroll .li').find(li => li.find('.k').text() === p.key).trigger('click'); await flushPromises()
    await w.findAll('button').find(b => b.text().startsWith('⇩ installieren')).trigger('click'); await flushPromises()
    w.unmount()
    return { gefragt, gesendet }
  } finally { dialog.confirm = confirm; api.post = post; api.get = get }
}

const fremd = { key: 'fremd', certified: true, sealOriginal: false, sealIssuer: 'dritte', manifest: { key: 'fremd', label: 'Fremd', entry: 'entry.js', runs: 'process' } }

test('fremdes Plugin: der Hinweis nennt Siegel, Browser und Server; abgelehnt geht keine Anfrage hinaus', async () => {
  const { gefragt, gesendet } = await installieren(fremd, false)
  assert.equal(gefragt.length, 1)
  assert.match(gefragt[0].warn, /nicht von journali/)
  assert.ok(gefragt[0].list.some(z => /Siegel von dritte/.test(z)))
  assert.ok(gefragt[0].list.some(z => /im Browser/.test(z)))
  assert.ok(gefragt[0].list.some(z => /Prozess auf dem Server/.test(z)))
  assert.deepEqual(gesendet, [])
})

test('mit Bestätigung geht ?fremd=ja an den Server', async () => {
  const { gesendet } = await installieren(fremd, true)
  assert.deepEqual(gesendet, ['/api/plugins/fremd/install?fremd=ja'])
})

test('ein Original von journali fragt nicht', async () => {
  const { gefragt, gesendet } = await installieren({ key: 'eigen', certified: true, sealOriginal: true, manifest: { key: 'eigen', label: 'Eigen' } }, false)
  assert.equal(gefragt.length, 0)
  assert.deepEqual(gesendet, ['/api/plugins/eigen/install'])
})
