// Import aus IXP und Solr über einen Zugang (28.09.2026): Adresse und Anmeldung stehen im Plugin driver, das Geheimnis
// beim Server. Die Ansicht wählt einen Zugang und liest die Quelle über /api/drivers/<zugang>/relay — kein Token im
// Browser, kein direkter Aufruf der Quelle, bei Solr kein JSONP-Skript.
import test from 'node:test'
import assert from 'node:assert/strict'
import { win } from './ui.mjs'
import { mount } from '@vue/test-utils'
import { routerKey } from 'vue-router'
import { api } from '../src/api.js'
import { solr, holenUeber } from '../../plugins/solr/solr.js'
// Das Plugin ixp liegt nicht im öffentlichen Repo (22.10.2026, eigenes Repo auf der Gitea, der Bau dort holt es ins Image). Fehlt
// plugins/ixp, werden seine Tests übersprungen.
import fs from 'node:fs'
const IXP = fs.existsSync(new URL('../../plugins/ixp/core.mjs', import.meta.url))
const ixpTest = IXP ? test : test.skip
const { ixpUeber } = IXP ? await import('../../plugins/ixp/core.mjs') : {}

const router = { push() {}, replace() {}, currentRoute: { value: { path: '/', query: {} } } }

async function welt(art, antwort) {
  const get = api.get, fetchAlt = globalThis.fetch
  const rufe = []
  api.get = async p => {
    rufe.push(p)
    if (p === `/api/drivers?art=${art}`) return [{ key: art + '_live', art, label: art.toUpperCase() + ' Live', felder: { url: 'https://quelle.example.invalid/api' }, geheim: ['x'] }]
    if (p.includes('/relay?')) return antwort(decodeURIComponent(p.split('path=')[1]))
    return []
  }
  const direkt = []
  globalThis.fetch = async u => { direkt.push(String(u)); throw new Error('kein direkter Aufruf') }
  const { default: View } = await import(`../../plugins/${art}/src/View.vue`)
  const w = mount(View, { global: { provide: { [routerKey]: router }, stubs: { RouterLink: true, 'router-link': true, TreePicker: true, ProfileBar: true } } })
  await new Promise(r => setTimeout(r, 0)); await w.vm.$nextTick()
  return { w, rufe, direkt, ende: () => { api.get = get; globalThis.fetch = fetchAlt; w.unmount() } }
}
const warte = async w => { for (let i = 0; i < 5; i++) { await new Promise(r => setTimeout(r, 0)); await w.vm.$nextTick() } }

ixpTest('IXP: der Zugang ist eine Auswahl, ein Token-Feld gibt es nicht, gelesen wird über die Weiterleitung', async () => {
  const { w, rufe, direkt, ende } = await welt('ixp', pfad => pfad.startsWith('/documents/languages') ? [{ code: 'de', languageName: 'Deutsch' }] : [])
  try {
    assert.equal(w.findAll('input[type="password"]').length, 0, 'kein Token im Browser')
    const sel = w.find('select.zugang')
    assert.deepEqual(sel.findAll('option').map(o => o.text()), ['— freie Adresse, ohne Anmeldung —', 'IXP Live'])
    assert.ok(w.find('input[type="text"]').exists(), 'ohne Zugang: freie Adresse')
    await sel.setValue('ixp_live')
    assert.ok(!w.findAll('input[type="text"]').some(i => i.attributes('placeholder')?.includes('https://')), 'mit Zugang keine Adresse')
    await w.findAll('button').find(b => b.text() === 'Verbinden').trigger('click')
    await warte(w)
    const relay = rufe.filter(p => p.startsWith('/api/drivers/ixp_live/relay?path='))
    assert.ok(relay.some(p => decodeURIComponent(p).includes('/documents/languages')), 'Sprachen über den Zugang')
    assert.ok(relay.some(p => decodeURIComponent(p).includes('/documents/root')), 'Wurzeln über den Zugang')
    assert.deepEqual(direkt, [], 'die Quelle wird nie direkt gefragt')
  } finally { ende() }
})

test('Solr: mit Zugang kein JSONP-Skript im Dokument, gelesen wird über die Weiterleitung', async () => {
  const leer = { response: { numFound: 0, docs: [] } }
  const { w, rufe, direkt, ende } = await welt('solr', () => leer)
  try {
    const sel = w.find('select.zugang')
    assert.deepEqual(sel.findAll('option').map(o => o.text()), ['— freie Adresse, ohne Anmeldung —', 'SOLR Live'])
    await sel.setValue('solr_live')
    await w.findAll('button').find(b => b.text() === 'Verbinden').trigger('click')
    await warte(w)
    const relay = rufe.filter(p => p.startsWith('/api/drivers/solr_live/relay?path='))
    assert.ok(relay.length >= 2, 'Anzahl und Wurzeln über den Zugang')
    assert.ok(relay.every(p => decodeURIComponent(p).includes('wt=json')), 'Solr antwortet als JSON')
    assert.equal(win.document.querySelectorAll('script[src*="json.wrf"]').length, 0, 'kein JSONP')
    assert.deepEqual(direkt, [])
  } finally { ende() }
})

test('die Clients über einen Zugang kennen nur den Pfad hinter der Adresse', async () => {
  const pfade = []
  const holen = async p => { pfade.push(decodeURIComponent(p.split('path=')[1])); return [] }
  if (IXP) {
    await ixpUeber('quelle', holen).roots()
    assert.equal(pfade.at(-1), '/documents/root?_limit=100')
  }
  const s = solr('', holenUeber('kern', async p => { pfade.push(decodeURIComponent(p.split('path=')[1])); return { response: { numFound: 7, docs: [] } } }))
  assert.equal(await s.count(), 7)
  assert.match(pfade.at(-1), /^\/select\?q=\*%3A\*.*&wt=json$/)
})
