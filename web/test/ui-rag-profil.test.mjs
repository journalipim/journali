// ⇪ Export → KI-Wissensbasis (28.09.2026): rag hat eine eigene Ansicht, und der Job-Dialog legt keine Profile mehr an.
// Die Ansicht liest die Profile, die der Profil-Editor des Taskers angelegt hatte (profile:<name>, Sprachen als Text,
// Schalter als Text), und speichert sie in der Form, aus der der JobRunner die Parameter füllt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { win } from './ui.mjs'
import { mount } from '@vue/test-utils'
import { routerKey } from 'vue-router'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const router = { push() {}, replace() {}, currentRoute: { value: { path: '/', query: {} } } }

async function welt() {
  const get = api.get, post = api.post
  const gesendet = []
  try { localStorage.removeItem('journali.profile.rag.profile') } catch {}
  api.get = async p => {
    if (p === '/api/plugins/rag/data') return ['profile:alt', 'config:fremd']
    if (p === '/api/plugins/rag/data/' + encodeURIComponent('profile:alt')) return { root: 'g1', role: 'variant', locales: 'de,en', withVersions: 'true', withDocs: 'false' }
    return []
  }
  api.post = async (p, body, m) => { gesendet.push([m, p, body]); return {} }
  store.model = { ...(store.model ?? {}), masterLocale: 'de', locales: [{ code: 'de' }, { code: 'en' }, { code: 'fr' }], attributes: store.model?.attributes ?? [] }
  tree.loaded = true
  tree.rows = [{ id: 'g1', role: 'group', label: 'Gruppe', parent: null }, { id: 'p1', role: 'product', label: 'P', parent: 'g1' }, { id: 'v1', role: 'variant', label: 'V', parent: 'p1' }, { id: 'v2', role: 'variant', label: 'W', parent: 'p1' }]
  tree.byId = new Map(tree.rows.map(r => [r.id, r]))
  const { default: View } = await import('../../plugins/rag/src/View.vue')
  const w = mount(View, { attachTo: win.document.body, global: { provide: { [routerKey]: router }, stubs: { RouterLink: true, 'router-link': true, TreePicker: true } } })
  await new Promise(r => setTimeout(r, 0)); await w.vm.$nextTick()
  return { w, gesendet, ende: () => { w.unmount(); api.get = get; api.post = post } }
}
const warte = async w => { for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 0)); await w.vm.$nextTick() } }

test('ein Profil aus dem alten Profil-Editor wird gelesen und in der Form der Parameter gespeichert', async () => {
  const { w, gesendet, ende } = await welt()
  try {
    const profilWahl = w.find('.profiles select')
    assert.deepEqual(profilWahl.findAll('option').map(o => o.text()), ['— Profil —', 'alt'], 'nur profile:<name> — config: gehört nicht dazu')
    await profilWahl.setValue('alt')
    await warte(w)
    assert.equal(w.find('select.rolle').element.value, 'variant')
    assert.deepEqual(w.findAll('.sprache.on').map(s => s.text()), ['de', 'en'], 'Sprachen als Text mit Komma')
    assert.equal(w.find('input.versionen').element.checked, true)
    assert.equal(w.find('input.dokumente').element.checked, false, 'Schalter als Text')
    assert.match(w.find('.anzahl').text(), /^2 Knoten · de, en/, 'zwei Varianten unter der Gruppe')

    await w.findAll('.sprache').find(s => s.text() === 'fr').trigger('click')
    await w.find('input.dokumente').setValue(true)
    await w.find('.profiles button.x').trigger('click')   // 💾
    await warte(w)
    const [m, p, body] = gesendet.at(-1)
    assert.equal(m, 'PUT'); assert.equal(p, '/api/plugins/rag/data/' + encodeURIComponent('profile:alt'))
    assert.deepEqual(body, { root: 'g1', role: 'variant', locales: ['de', 'en', 'fr'], withVersions: true, withDocs: true })
  } finally { ende() }
})

test('ohne Sprache gilt die Leitsprache, ohne Teilbaum alles', async () => {
  const { w, ende } = await welt()
  try {
    assert.match(w.find('.anzahl').text(), /^1 Knoten · de/, 'Vorgabe: Produkte, Leitsprache')
    await w.find('select.rolle').setValue('all')
    assert.match(w.find('.anzahl').text(), /^4 Knoten/)
  } finally { ende() }
})

test('der Job-Dialog hat keinen Profil-Editor mehr', async () => {
  const quelle = await import('node:fs').then(fs => fs.readFileSync(new URL('../../plugins/tasker/entry.js', import.meta.url), 'utf8'))
  assert.ok(!quelle.includes('profileEditor'), 'kein generischer Profil-Editor')
  assert.ok(!quelle.includes("'generic'"), 'kein Schalter profile: generic')
})
