// Prüfansicht, Sonderregeln (05.10.2026): ohne Vorschlag steht einmal über den Zeilen, was Vorschläge möglich macht — positiv, nicht je Zeile
// ein Ratschlag. Die ETIM-Klasse kommt aus dem Klassenattribut, das ETIM eingestellt hat.
import test from 'node:test'
import assert from 'node:assert/strict'
import { win } from './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'
import { ai } from '../src/ai.js'
import { dialog } from '../src/dialog.js'

const warte = (ms = 0) => new Promise(r => setTimeout(r, ms))

const katalog = {
  key: 'pk', label: 'Verpackung', icon: '▧', groupKey: 'pk', prefix: 'pk_', source: 'https://example.org', sourceLabel: 'Quelle', asOf: '2026-09-18',
  scopeRules: [{ scope: 'hazmat', match: [/aerosol/i], why: 'ETIM-Klasse deutet auf Gefahrgut' }, { scope: 'food', match: [/\bfood\b/i], why: 'ETIM-Klasse mit Lebensmittelkontakt' }],
  groups: [
    { key: 'g', label: 'Gruppe', items: [{ key: 'gewicht', label: 'Gewicht', level: 'must', type: 'boolean' }] },
    { key: 'h', label: 'Gefahrgut', scope: { key: 'hazmat', label: 'Gefahrgut' }, items: [{ key: 'un', label: 'UN-Nummer', level: 'must', type: 'boolean' }] },
    { key: 'f', label: 'Lebensmittel', scope: { key: 'food', label: 'Lebensmittelkontakt' }, items: [{ key: 'fk', label: 'Konformität', level: 'must', type: 'boolean' }] },
  ],
}

async function ansicht({ klasse = null, attr = 'class_etim' } = {}) {
  tree.loaded = true
  tree.rows = [{ id: 'g1', role: 'group', label: 'Isomatten', parent: null, groups: 'pk' }, { id: 'p1', role: 'product', label: 'Matte', parent: 'g1' }]
  tree.byId = new Map(tree.rows.map(r => [r.id, r]))
  tree.kids = id => tree.rows.filter(r => r.parent === id)
  tree.ancestors = id => { const a = []; let r = tree.byId.get(id); while (r?.parent) { r = tree.byId.get(r.parent); if (r) a.unshift(r) } return a }
  tree.load = async () => {}
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], groups: [{ key: 'pk', label: { de: 'PK' } }], lists: [], units: [],
    attributes: [{ key: 'pk_gewicht', type: 'boolean', label: { de: 'Gewicht' }, group: 'pk' }, { key: 'pk_un', type: 'boolean', label: { de: 'UN' }, group: 'pk' }, { key: 'pk_fk', type: 'boolean', label: { de: 'Konformität' }, group: 'pk' }, { key: 'pk_scope', type: 'enum', multiple: true, inheritable: true, label: { de: 'Geltung' }, group: 'pk' }] }
  localStorage.setItem('journali.cmp.pk.root', 'g1')
  const get = api.get, poll = store.poll, verfuegbar = ai.available, laden = ai.loadState, frage = dialog.confirm
  dialog.confirm = async () => false   // keine Rückfrage offen lassen
  ai.available = () => false; ai.loadState = async () => {}
  const gefragt = []
  api.get = async p => {
    p = String(p); gefragt.push(p)
    if (p.includes('/table')) return { node: { id: 'g1', role: 'group', label: 'Isomatten', parent: null }, columns: [], total: 2, next: null,
      rows: [{ row: { id: 'g1', role: 'group', label: 'Isomatten', parent: null }, values: {} }, { row: { id: 'p1', role: 'product', label: 'Matte', parent: 'g1' }, values: {} }] }
    if (p === '/api/plugins/etim/data/settings') return attr === 'class_etim' ? null : { classAttr: attr }
    if (p === '/api/plugins/etim/data/release') return { version: '9' }
    if (p.startsWith('/api/plugins/etim/data/class')) return klasse ? { code: 'EC000001', name: { en: 'Aerosol can' }, synonyms: {} } : null
    if (/\/api\/nodes\/g1$/.test(p)) return { values: klasse ? [{ attribute: attr, locale: null, channel: null, row: null, value: 'EC000001' }] : [], ancestors: [] }
    return []
  }
  store.poll = async () => {}
  const root = document.createElement('div'); document.body.append(root)
  const { mount } = await import('../src/compliance.js')
  await mount(root, { data: { get: async () => null, set: async () => {} }, api, store, tree, treePicker() {}, go() {} }, katalog)
  await warte(30)
  const pruefen = [...root.querySelectorAll('button')].find(b => b.textContent.includes('prüfen'))
  pruefen.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  for (let i = 0; i < 10; i++) await warte(10)
  return { root, gefragt, zurueck() { api.get = get; store.poll = poll; ai.available = verfuegbar; ai.loadState = laden; dialog.confirm = frage; root.remove(); localStorage.removeItem('journali.cmp.pk.root') } }
}

test('ohne Klasse und ohne KI: ein Satz über den Zeilen, positiv; die Zeilen fragen nur ja oder nein', async () => {
  const a = await ansicht()
  try {
    const saetze = [...a.root.querySelectorAll('.vorschlag-quelle')]
    assert.equal(saetze.length, 1, 'einmal, nicht je Zeile')
    assert.equal(saetze[0].textContent, 'Mit gesetzter ETIM-Klasse oder KI sind Vorschläge möglich.')
    assert.match(saetze[0].getAttribute('title'), /ETIM-Klasse des Knotens/)
    assert.doesNotMatch(a.root.textContent, /kein Vorschlag möglich/)
    assert.match(a.root.textContent, /Gefahrgut\?/); assert.match(a.root.textContent, /Lebensmittelkontakt\?/)
  } finally { a.zurueck() }
})

test('die Klasse steht im Klassenattribut, das ETIM eingestellt hat: der Vorschlag kommt, der Satz fehlt', async () => {
  const a = await ansicht({ klasse: true, attr: 'etim_klasse' })
  try {
    assert.ok(a.gefragt.includes('/api/plugins/etim/data/settings'))
    assert.equal(a.root.querySelectorAll('.vorschlag-quelle').length, 0)
    assert.match(a.root.textContent, /Gefahrgut: nicht gesetzt, Vorschlag „ja“/)
    assert.match(a.root.textContent, /Lebensmittelkontakt: gilt hier nicht/)
  } finally { a.zurueck() }
})

// Rechtsstand (05.10.2026): neben der Quelle steht, bis wann der Katalog am Rechtstext geprüft ist
test('die Prüfansicht nennt den Rechtsstand mit Datum', async () => {
  const a = await ansicht()
  try {
    const r = a.root.querySelector('.rechtsstand')
    assert.ok(r, 'Rechtsstand fehlt')
    assert.equal(r.textContent, 'Rechtsstand 18.09.2026')
  } finally { a.zurueck() }
})

test('jeder Katalog mit Rechtsinhalt hat einen Rechtsstand', async () => {
  for (const key of ['dpp', 'ppwr', 'empco']) {
    const k = (await import(`../../plugins/${key}/catalog.js`)).default
    assert.match(k.asOf ?? '', /^\d{4}-\d{2}-\d{2}$/, key)
  }
})
