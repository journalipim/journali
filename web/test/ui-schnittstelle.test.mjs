// { } Schnittstelle: die Beschreibung des Servers (GET /api/openapi.json) lesbar — nach Bereichen gruppiert, mit Suche; ein Klick zeigt Parameter, Körper und
// ein Beispiel. Das Hilfemenü führt dorthin; das Kapitel „Schnittstelle“ steht zur Ansicht.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'

const ApiDokuView = (await import('../src/views/ApiDokuView.vue')).default
const { helpItems, chapterFor } = await import('../src/help.js')

const SPEC = {
  openapi: '3.0.3', info: { title: 'journali', version: '0.9.0' },
  paths: {
    '/api/model/attributes/{key}': {
      put: { tags: ['model'], operationId: 'put_api_model_attributes_key', 'x-recht': 'model', parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { key: { type: 'string' }, type: { type: 'string' }, multiple: { type: 'boolean' }, levels: { type: 'array', items: { type: 'string' } } } } } } } },
      delete: { tags: ['model'], operationId: 'delete_api_model_attributes_key', 'x-recht': 'model', parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }] },
    },
    '/api/tree': { get: { tags: ['tree'], operationId: 'get_api_tree', 'x-recht': 'read', parameters: [{ name: 'deep', in: 'query', required: false, schema: { type: 'boolean' } }] } },
    '/api/journal': { get: { tags: ['journal'], operationId: 'get_api_journal', 'x-recht': 'read', parameters: [] } },
  },
}
function ansicht() {
  store.toasts = []
  globalThis.fetch = async url => {
    const antwort = String(url).includes('/api/openapi.json') ? SPEC : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return mount(ApiDokuView)
}
const bereiche = w => w.findAll('.bereich')

test('die Aufrufe stehen nach Bereichen gruppiert, zugeklappt, mit Zahl', async () => {
  const w = ansicht(); await flushPromises()
  assert.deepEqual(bereiche(w).map(b => b.find('h2').text().replace(/\s+/g, ' ')), ['▸ journal · 1', '▸ model · 2', '▸ tree · 1'])
  assert.equal(w.findAll('.aufruf').length, 0, 'zugeklappt')
  assert.match(w.find('.toolbar').text(), /4/, 'die Zahl der Aufrufe')
  w.unmount()
})

test('ein Bereich klappt auf: Methode, Pfad und das Recht stehen in jeder Zeile', async () => {
  const w = ansicht(); await flushPromises()
  await bereiche(w)[1].find('h2').trigger('click')
  const zeilen = w.findAll('.aufruf')
  assert.equal(zeilen.length, 2)
  assert.equal(zeilen[0].find('.methode').text(), 'PUT'); assert.equal(zeilen[0].find('.mono:not(.methode)').text(), '/api/model/attributes/{key}')
  assert.equal(zeilen[0].find('.recht').text(), 'model'); assert.equal(zeilen[1].find('.methode').text(), 'DELETE')
  w.unmount()
})

test('ein Aufruf klappt auf: Parameter, Körper und ein Beispiel mit Platzhaltern', async () => {
  const w = ansicht(); await flushPromises()
  await bereiche(w)[1].find('h2').trigger('click')
  await w.findAll('.aufruf')[0].find('.kopf').trigger('click')
  const d = w.find('.einzelheiten')
  assert.match(d.find('table').text(), /key\s*Pfad\s*string/)
  assert.match(d.find('.schema').text(), /"multiple"/)
  assert.match(d.find('.beispiel').text(), /curl -X PUT .*Bearer \$TOKEN.*-d '\{"key":"","type":"","multiple":false,"levels":\[""\]\}' "https:\/\/<server>\/api\/model\/attributes\/<key>"/)
  w.unmount()
})

test('die Suche zeigt die Treffer offen und blendet den Rest aus', async () => {
  const w = ansicht(); await flushPromises()
  await w.find('input[type=search]').setValue('delete')
  assert.deepEqual(bereiche(w).map(b => b.find('h2').text().replace(/\s+/g, ' ')), ['▾ model · 1'])
  assert.equal(w.findAll('.aufruf').length, 1)
  await w.find('input[type=search]').setValue('read')
  assert.deepEqual(bereiche(w).map(b => b.find('h2').text().replace(/\s+/g, ' ')), ['▾ journal · 1', '▾ tree · 1'], 'auch nach dem Recht')
  await w.find('input[type=search]').setValue('gibtsnicht')
  assert.match(w.text(), /keine Treffer/)
  w.unmount()
})

test('das Hilfemenü führt zur Schnittstelle; das Kapitel gehört zur Ansicht', () => {
  const geoeffnet = []
  const eintrag = helpItems(url => geoeffnet.push(url), '/tree', () => {}).find(i => /Schnittstelle/.test(i.label ?? ''))
  assert.ok(eintrag, 'der Eintrag steht im Hilfemenü'); eintrag.action()
  assert.deepEqual(geoeffnet, ['/schnittstelle'])
  assert.equal(chapterFor('/schnittstelle'), 'schnittstelle')
})
