// Einstellungen → ⧉ Server (pflegestruktur 41): welche Server auf die Datenbank zugreifen, wer Hauptserver ist, wer gesperrt ist.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { dialog } from '../src/dialog.js'

const ServerSettings = (await import('../src/components/ServerSettings.vue')).default

function server(routen) {
  const calls = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '')
    const body = opts.body ? JSON.parse(opts.body) : null
    calls.push({ path, method: opts.method ?? 'GET', body })
    const r = routen[path]; const a = typeof r === 'function' ? r(body) : r ?? {}
    const status = a.__status ?? 200
    return { ok: status < 400, status, statusText: 'x', text: async () => JSON.stringify(a) }
  }
  return calls
}

const jetzt = new Date().toISOString()
const zeile = (o) => ({ version: '0.9.0', built: jetzt, started: jetzt, puls: jetzt, head: 100, import: false, jobs: null, erreichbar: true, haupt: false, gesperrt: false, selbst: false, ...o })

test('Liste: Rolle, dieser Server, Import, laufende Jobs, andere Version', async () => {
  server({ '/api/server': { self: 'a', main: 'b', version: '0.9.0', server: [
    zeile({ id: 'a', host: 'pc', selbst: true }),
    zeile({ id: 'b', host: 'unraid', haupt: true, import: true, jobs: [{ key: 'embed', run: 'r1', reason: 'Import' }], version: '0.8.0' }),
  ] } })
  const w = mount(ServerSettings); await flushPromises()
  assert.match(w.find('h2').text(), /⧉ Server\s*· 2/)
  const [a, b] = w.findAll('tbody tr')
  assert.match(a.text(), /pc\s*· dieser/); assert.match(a.text(), /◇ Arbeitsserver/)
  assert.match(b.text(), /◆ Hauptserver/); assert.match(b.text(), /⇵/)
  assert.ok(b.find('.warn[title="Andere Version als dieser Server."]').exists(), 'abweichende Version ist markiert')
  assert.equal(b.findAll('td')[6].attributes('title'), 'embed (Import)')
  assert.ok(!w.find('.haupt-weg').exists())
  // am Hauptserver kein ◆ und kein ⊘; am eigenen kein ⊘
  assert.deepEqual(b.findAll('.aktionen button').map(x => x.text()), [])
  assert.deepEqual(a.findAll('.aktionen button').map(x => x.text()), ['◆'])
  w.unmount()
})

test('Hauptserver nicht erreichbar: die Zeile darüber sagt es; entfernen geht nur bei einem, der nicht erreichbar und nicht Hauptserver ist', async () => {
  const calls = server({ '/api/server': { self: 'a', main: 'b', version: '0.9.0', server: [
    zeile({ id: 'a', host: 'pc', selbst: true }),
    zeile({ id: 'b', host: 'unraid', haupt: true, erreichbar: false }),
    zeile({ id: 'c', host: 'alt', erreichbar: false }),
  ] }, '/api/server/c': { id: 'c' } })
  const w = mount(ServerSettings); await flushPromises()
  assert.match(w.find('.haupt-weg').text(), /Der Hauptserver unraid ist nicht erreichbar/)
  const rows = w.findAll('tbody tr')
  assert.ok(!rows[1].find('button.x').exists())
  await rows[2].find('button.x').trigger('click'); await flushPromises()
  assert.ok(calls.some(c => c.path === '/api/server/c' && c.method === 'DELETE'))
  w.unmount()
})

test('Zum Hauptserver machen und sperren fragen nach; freigeben nicht; Fehler des Servers bleibt stehen', async () => {
  const calls = server({
    '/api/server': { self: 'a', main: 'a', version: '0.9.0', server: [
      zeile({ id: 'a', host: 'pc', selbst: true, haupt: true }),
      zeile({ id: 'b', host: 'asien' }),
      zeile({ id: 'c', host: 'europa', gesperrt: true }),
    ] },
    '/api/server/b/haupt': { main: 'b' },
    '/api/server/b/sperre': b => b.gesperrt ? { __status: 400, template: 'Server {0} ist nicht erreichbar.', args: ['asien'] } : {},
    '/api/server/c/sperre': { gesperrt: false },
  })
  const gefragt = []; const orig = dialog.confirm
  dialog.confirm = async o => { gefragt.push(o.title); return true }
  try {
    const w = mount(ServerSettings); await flushPromises()
    const knopf = (zeile, z) => w.findAll('tbody tr')[zeile].findAll('.aktionen button').find(b => b.text() === z)
    await knopf(1, '◆').trigger('click'); await flushPromises()
    assert.match(w.text(), /✓ asien ist Hauptserver/)
    await knopf(1, '⊘').trigger('click'); await flushPromises()
    assert.match(w.text(), /✗ Server asien ist nicht erreichbar/)
    await knopf(2, '○').trigger('click'); await flushPromises()
    assert.match(w.text(), /✓ europa freigegeben/)
    assert.deepEqual(gefragt, ['asien zum Hauptserver machen', 'asien sperren'])
    const puts = calls.filter(c => c.method === 'PUT').map(c => [c.path, c.body])
    assert.deepEqual(puts, [['/api/server/b/haupt', {}], ['/api/server/b/sperre', { gesperrt: true }], ['/api/server/c/sperre', { gesperrt: false }]])
    w.unmount()
  } finally { dialog.confirm = orig }
})
