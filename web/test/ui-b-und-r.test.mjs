// Einstellungen → B&R. Sichern von Hand und zurück; der Fall, der schiefging: Einspielen brach mit
// „mit is not defined“ ab, weil die Auswahl, was mitgeht, fehlte.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises, button } from './ui.mjs'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'

const RestoreSettings = (await import('../src/components/RestoreSettings.vue')).default

function server({ leer = true } = {}) {
  const gesendet = []
  globalThis.fetch = async (url, opt = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    const method = opt.method ?? 'GET'
    if (method !== 'GET') gesendet.push({ path, body: JSON.parse(opt.body) })
    let body
    if (path === '/api/backup/status') body = { hier: { entries: leer ? 0 : 5, media: 0, storage: 'postgres' }, dort: { at: '2026-09-24T10:00:00Z', entries: 42, media: 3, bytes: 1000, config: 3, plugins: 20 } }
    else if (path === '/api/backup') body = { at: '2026-09-24T10:00:00Z', entries: 42, media: 3, bytes: 1000, storage: 'postgres', actor: 'admin', config: 3, plugins: 20 }
    else if (path === '/api/backup/restore') body = { entries: 42, media: 3, config: 3, plugins: 20, hinweis: 'neu starten' }
    else body = {}
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
  return gesendet
}

test('Sichern von Hand: Verzeichnis und was mitgeht', async () => {
  const gesendet = server(); store.poll = async () => {}
  const w = mount(RestoreSettings); await flushPromises()
  assert.ok(button(w, 'Sichern').attributes('disabled') !== undefined, 'ohne Verzeichnis lässt sich sichern')
  await w.find('input[type=text]').setValue('/data/sicherung')
  await w.findAll('.mit input[type=checkbox]')[2].setValue(false)          // ohne Plugins
  await button(w, 'Sichern').trigger('click'); await flushPromises()
  const post = gesendet.find(g => g.path === '/api/backup')
  assert.deepEqual({ ...post.body }, { dir: '/data/sicherung', media: true, config: true, plugins: false })
  assert.match(w.text(), /✓ 42 Einträge, 3 Assets, 3 Dateien, 20 Plugins/)
  w.unmount()
})

test('Einspielen schickt mit, was mitgeht — und bricht nicht ab', async () => {
  const gesendet = server(); store.poll = async () => {}
  dialog.confirm = async () => true
  const w = mount(RestoreSettings); await flushPromises()
  // den Stand liest die Ansicht beim Wählen des Verzeichnisses; hier reicht das Feld plus Enter
  await w.find('input[type=text]').setValue('/data/sicherung')
  await w.find('input[type=text]').trigger('keydown.enter'); await flushPromises()
  await button(w, 'Einspielen').trigger('click'); await flushPromises()
  const post = gesendet.find(g => g.path === '/api/backup/restore')
  assert.ok(post, 'Einspielen ging nicht hinaus')
  assert.deepEqual({ ...post.body }, { dir: '/data/sicherung', media: true, config: true, plugins: true })
  assert.doesNotMatch(w.text(), /✗/)
  w.unmount()
})
