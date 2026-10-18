// journali advisor, „Warum ist …?“ (18.10.2026): die Gründe aus den Daten des Knotens, an dem man steht — fehlende Pflichtwerte je Kanal und
// Sprache, Freigaben, die Ausleitung je Publikationsbaum mit dem Grund des Servers, der Status. Ohne KI; die KI bekommt sie als Zustand.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises, win } from './ui.mjs'

const { fragtWarum, knotenAusPfad, gruende } = await import('../src/journaliWarum.js')
const { frage, vorratLeeren } = await import('../src/journaliAdvisor.js')
const { store } = await import('../src/store.js')
const { tree } = await import('../src/tree.js')
const { ai } = await import('../src/ai.js')
const { api } = await import('../src/api.js')

const KNOTEN = {
  'p-zelt': { id: 'p-zelt', role: 'product', name: 'Fjell 5 Zelt', status: 'active', hasStatus: true,
    completeness: [{ channel: 'web', locale: 'en', required: 3, filled: 1, missing: ['name', 'description'] }, { channel: 'web', locale: 'de', required: 3, filled: 3, missing: [] }],
    releases: [], releasedVia: [] },
  'v-rot': { id: 'v-rot', role: 'variant', name: 'Fjell 5 Zelt, Rot', status: 'active', completeness: [], releases: [{ channel: 'web', locale: null }], releasedVia: [] },
  'g-zelte': { id: 'g-zelte', role: 'group', name: 'Zelte', hasStatus: false, completeness: [], releases: [], releasedVia: [] },
}
const BAEUME = [{ id: 'r-shop', label: 'Online-Shop', channel: 'web' }, { id: 'r-print', label: 'Katalog', channel: 'print' }]
const AUSLEITUNG = {
  'r-shop': { rows: [{ product: { id: 'p-zelt' }, in: false, why: ['nicht freigegeben für web — Freigabe an der Variante, Pflegebaum ✓ Freigaben'],
    variants: [{ id: 'v-rot', in: true, why: [] }] }] },
  'r-print': { rows: [] },
}
const lesen = async p => {
  const m = /^\/api\/nodes\/([^/]+)$/.exec(p)
  if (m) return KNOTEN[decodeURIComponent(m[1])] ?? null
  if (p === '/api/pub') return BAEUME
  const e = /^\/api\/pub\/([^/]+)\/export$/.exec(p)
  if (e) return AUSLEITUNG[decodeURIComponent(e[1])]
  throw new Error('404 ' + p)
}
const MODELL = { masterLocale: 'de', locales: [{ code: 'de' }], lists: [], groups: [],
  attributes: [{ key: 'name', label: { de: 'Name' } }, { key: 'description', label: { de: 'Beschreibung' } }] }

test('fragt die Eingabe nach einem Grund? — und an welchem Knoten man steht', () => {
  for (const q of ['Warum ist das Zelt nicht im Shop?', 'wieso fehlt das Bild', 'kein Preis da', 'why is it missing']) assert.ok(fragtWarum(q), q)
  for (const q of ['Wie lege ich ein Attribut an?', 'Wo finde ich die Rollen?', 'nichtig']) assert.ok(!fragtWarum(q), q)
  assert.equal(knotenAusPfad('/tree/p-zelt'), 'p-zelt')
  assert.equal(knotenAusPfad('/table/g-zelte?x=1'), 'g-zelte')
  assert.equal(knotenAusPfad('/model'), null)
})

test('die Gründe am Produkt: fehlende Pflichtwerte mit Namen, keine Freigabe, je Baum ausgeleitet oder warum nicht', async () => {
  store.model = MODELL
  const g = await gruende('p-zelt', { holen: lesen })
  assert.equal(g.label, 'Fjell 5 Zelt')
  assert.deepEqual(g.gruende.map(x => [x.ok, x.text]), [
    [true, 'Status: active.'],
    [false, 'web/en: es fehlen Name, Beschreibung.'],
    [false, 'Keine Freigabe an diesem Knoten.'],
    [false, '„Online-Shop“: wird nicht ausgeleitet — nicht freigegeben für web — Freigabe an der Variante, Pflegebaum ✓ Freigaben'],
    [false, '„Katalog“: nicht im Baum.'],
  ])
  // die Variante: ihre Freigabe, ihre Ausleitung
  const v = await gruende('v-rot', { holen: lesen })
  assert.ok(v.gruende.some(x => x.ok && x.text === 'Freigegeben für web.'))
  assert.ok(v.gruende.some(x => x.ok && x.text === '„Online-Shop“: wird ausgeleitet.'))
  // eine Gruppe: keine Ausleitung, kein Status, kein „keine Freigabe“
  assert.deepEqual((await gruende('g-zelte', { holen: lesen })).gruende, [])
  assert.equal(await gruende('gibt-es-nicht', { holen: lesen }), null)
})

test('frage: am Knoten und mit „warum“ kommen die Gründe dazu — die KI bekommt sie als Zustand', async () => {
  store.model = MODELL; vorratLeeren()
  const verfuegbar = ai.available, ask = ai.ask
  const holen = async () => ({ ok: false })   // keine Hilfe: nur die Gründe
  try {
    ai.available = () => false
    const ohne = await frage('Warum ist das Zelt nicht im Shop?', { holen, knoten: 'p-zelt', lesen, orte: [] })
    assert.equal(ohne.warum.gruende.length, 5)
    assert.equal((await frage('Wie pflege ich ein Zelt?', { holen, knoten: 'p-zelt', lesen, orte: [] })).warum, null, 'ohne Frage nach dem Grund keine Gründe')
    assert.equal((await frage('Warum fehlt das?', { holen, lesen, orte: [] })).warum, null, 'ohne Knoten keine Gründe')
    ai.available = () => true
    let bitte = null; ai.ask = async a => { bitte = a; return 'Es fehlt die Freigabe für web.' }
    const mit = await frage('Warum ist das Zelt nicht im Shop?', { holen, knoten: 'p-zelt', lesen, orte: [] })
    assert.equal(mit.antwort, 'Es fehlt die Freigabe für web.')
    assert.match(bitte.user, /Zustand des Knotens „Fjell 5 Zelt“:\n- Status: active\.\n- \(fehlt\) web\/en: es fehlen Name, Beschreibung\./)
    assert.match(bitte.system, /antworte zuerst aus dem Zustand des Knotens/)
  } finally { ai.available = verfuegbar; ai.ask = ask; vorratLeeren() }
})

test('im Fenster: am Knoten die Gründe, grün was gilt, rot was fehlt', async () => {
  store.model = MODELL; vorratLeeren()
  globalThis.fetch = async () => ({ ok: false })
  const get = api.get, verfuegbar = ai.available
  api.get = lesen; ai.available = () => false
  win.history.pushState({}, '', '/tree/p-zelt')
  const JournaliAdvisor = (await import('../src/components/JournaliAdvisor.vue')).default
  const { openAdvisor, closeAdvisor } = await import('../src/help.js')
  const w = mount(JournaliAdvisor)
  const ruhe = async () => { for (let i = 0; i < 8; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }
  try {
    openAdvisor(); await ruhe()
    const feld = document.querySelector('.ja-feld')
    feld.value = 'Warum ist das Zelt nicht im Shop?'; feld.dispatchEvent(new win.Event('input')); await ruhe()
    document.querySelector('.ja-eingabe').dispatchEvent(new win.Event('submit', { cancelable: true })); await ruhe()
    assert.equal(document.querySelector('.ja-warum-kopf').textContent, 'Am Knoten Fjell 5 Zelt:')
    const gruende = [...document.querySelectorAll('.ja-grund')]
    assert.equal(gruende.length, 5)
    assert.ok(gruende[0].classList.contains('pos') && gruende[0].textContent.startsWith('✓'))
    assert.ok(gruende[1].classList.contains('neg') && gruende[1].textContent.startsWith('✗'))
    assert.equal(document.querySelector('.ja-leer'), null, 'mit Gründen kein „steht nichts in der Hilfe“')
  } finally { api.get = get; ai.available = verfuegbar; closeAdvisor(); await ruhe(); w.unmount(); win.history.pushState({}, '', '/') }
})
