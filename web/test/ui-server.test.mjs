// Einstellungen → ⧉ Server (pflegestruktur 41): welche Server auf die Datenbank zugreifen, wer Hauptserver ist, wer gesperrt ist.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { dialog } from '../src/dialog.js'
import { bauKurz } from '../src/bau.js'

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
const zeile = (o) => ({ name: null, version: '0.9.0', built: jetzt, started: jetzt, puls: jetzt, head: 100, import: false, jobs: null, erreichbar: true, haupt: false, gesperrt: false, selbst: false, ...o })

test('Liste: Rolle, dieser Server, Import, laufende Jobs, andere Version', async () => {
  server({ '/api/server': { self: 'a', main: 'b', version: '0.9.0', built: jetzt, server: [
    zeile({ id: 'a', host: 'pc', selbst: true }),
    zeile({ id: 'b', host: '586a874270fb', name: 'Unraid', haupt: true, import: true, jobs: [{ key: 'embed', run: 'r1', reason: 'Import' }], version: '0.8.0', built: '2026-10-01T08:00:00Z' }),
  ] } })
  const w = mount(ServerSettings); await flushPromises()
  assert.match(w.find('h2').text(), /⧉ Server\s*· 2/)
  const [a, b] = w.findAll('tbody tr')
  assert.match(a.find('td.name').text(), /✎\s*· dieser/, 'ohne Namen: der Stift zum Benennen'); assert.match(a.text(), /◇ Arbeitsserver/)
  assert.equal(b.find('td.name').text(), 'Unraid'); assert.equal(b.findAll('td')[2].text(), '586a874270fb')
  // Version wie in der Kopfleiste: „0.8.0 ·TTMM.hhmm“, lang im Tooltip
  assert.equal(b.find('td.version').text(), '0.8.0 ·' + bauKurz('2026-10-01T08:00:00Z'))
  assert.match(b.find('td.version span').attributes('title'), /gebaut \d\d\.10\.2026, \d\d:\d\d · Andere Version als dieser Server\./)
  assert.ok(b.find('td.version .warn').exists(), 'abweichende Version und abweichender Bau sind markiert')
  assert.ok(!a.find('td.version .warn').exists())
  assert.equal(a.find('td.version').text(), '0.9.0 ·' + bauKurz(jetzt))
  assert.match(b.text(), /◆ Hauptserver/); assert.match(b.text(), /⇵/)
  assert.equal(b.findAll('td')[7].attributes('title'), 'embed (Import)')
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

test('Benennen in der Zelle: Klick, Enter speichert, Esc verwirft, leer heisst wieder der Rechnername', async () => {
  let name = null
  const calls = server({
    '/api/server': () => ({ self: 'a', main: 'a', version: '0.9.0', built: jetzt, server: [zeile({ id: 'a', host: '586a874270fb', name, selbst: true, haupt: true })] }),
    '/api/server/a/name': b => { name = b.name || null; return { id: 'a', name } },
  })
  const w = mount(ServerSettings, { attachTo: document.body }); await flushPromises()
  const zelle = () => w.find('td.name')
  await zelle().find('.benennen').trigger('click')
  let feld = zelle().find('input')
  assert.equal(feld.attributes('placeholder'), '586a874270fb')
  await feld.setValue('Verworfen'); await feld.trigger('keydown', { key: 'Escape' }); await flushPromises()
  assert.ok(!calls.some(c => c.path === '/api/server/a/name'), 'Esc schreibt nichts')

  await zelle().find('.benennen').trigger('click')
  feld = zelle().find('input')
  await feld.setValue('  Unraid  '); await feld.trigger('keydown', { key: 'Enter' }); await flushPromises()
  assert.equal(zelle().find('.benennen').text(), 'Unraid')

  await zelle().find('.benennen').trigger('click')
  feld = zelle().find('input')
  await feld.setValue(''); await feld.trigger('blur'); await flushPromises()
  assert.equal(zelle().find('.benennen').text(), '✎')
  assert.deepEqual(calls.filter(c => c.path === '/api/server/a/name').map(c => c.body), [{ name: 'Unraid' }, { name: '' }])
  w.unmount()
})
