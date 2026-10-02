// ⚙ Konfiguratorgruppen am Produkt (nodeBands): das Band in der Knotenansicht zeigt die Zeilen des Teils als Sätze und bearbeitet sie dort. Eine Variante ohne eigene
// Zeilen nimmt die ihres Produkts; „eigene Zeilen“ legt sie als Kopie an. Bedient wie vom Anwender; der Server ist ein Stellvertreter.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'
import { tree } from '../src/tree.js'

const Band = (await import('../../plugins/configurator/src/Band.vue')).default
const entry = (await import('../../plugins/configurator/src/entry.js')).default

const ROWS = tree.rows = [
  { id: 'g', label: 'Server', role: 'group' }, { id: 'p', label: 'Mainboard XYZ', role: 'product', parent: 'g' }, { id: 'v', label: 'Variante A', role: 'variant', parent: 'p' },
  { id: 'cpu', label: 'CPU 1', role: 'product', parent: 'g' },
]
tree.byId = new Map(ROWS.map(r => [r.id, r]))
tree.ancestors = id => { const out = []; for (let p = tree.byId.get(id)?.parent; p; p = tree.byId.get(p)?.parent) out.unshift(tree.byId.get(p)); return out }
store.model = { attributes: [] }

const BOARD = [{ group: 'ram', min: 2, max: 2, values: ['8', '32'] }]
const CPU = [{ group: 'cpustecklatz', consumes: 1 }, { group: 'pci', provides: 2, when: { kind: 'has', selector: { node: 'p' }, value: 1 } }]

function welt({ docs = { 'member:p': { rows: BOARD }, 'member:cpu': { rows: CPU } }, groups = { 'group:ram': { label: 'RAM' }, 'group:pci': { label: 'PCI-Steckplätze' } } } = {}) {
  docs = JSON.parse(JSON.stringify(docs))
  const gesendet = [], toasts = []
  const orig = { get: api.get, post: api.post, del: api.del, toast: store.toast, confirm: dialog.confirm }
  api.get = async p => {
    const pfad = decodeURIComponent(p)
    if (pfad.startsWith('/api/plugins/configurator/data?prefix=member:')) return Object.keys(docs).filter(n => n.startsWith('member:')).sort()
    if (pfad.startsWith('/api/plugins/configurator/data?prefix=group:')) return groups
    const m = /\/data\/(member:.+)$/.exec(pfad)
    if (m) return JSON.parse(JSON.stringify(docs[m[1]]))
    throw new Error('GET ' + pfad)
  }
  api.post = async (p, body, method = 'POST') => {
    const pfad = decodeURIComponent(p); gesendet.push({ p: pfad, body: JSON.parse(JSON.stringify(body)), method })
    const name = /\/data\/(.+)$/.exec(pfad)?.[1]
    if (method === 'PUT' && name) docs[name] = body
    return {}
  }
  api.del = async p => { const pfad = decodeURIComponent(p); gesendet.push({ p: pfad, method: 'DELETE' }); delete docs[/\/data\/(.+)$/.exec(pfad)?.[1]]; return {} }
  dialog.confirm = async () => true
  store.toast = (...a) => toasts.push(a)
  return { gesendet, toasts, docs, ende: () => { Object.assign(api, { get: orig.get, post: orig.post, del: orig.del }); store.toast = orig.toast; dialog.confirm = orig.confirm } }
}
const zeigen = async (nodeId) => { const koepfe = []; const w = mount(Band, { props: { nodeId, onKopf: t => koepfe.push(t) } }); await flushPromises(); return { w, koepfe } }
const saetze = w => w.findAll('.satz').map(x => x.text())

test('das Band zeigt die Zeilen des Teils als Sätze und die Zahl im Kopf', async () => {
  const s = welt()
  const { w, koepfe } = await zeigen('cpu')
  try {
    assert.deepEqual(saetze(w), ['cpustecklatz: verbraucht 1', 'PCI-Steckplätze: stellt 2 bereit, wenn Mainboard XYZ gewählt'])
    assert.equal(koepfe.at(-1), '· 2 Zeilen')
    assert.equal(w.find('.geerbt').exists(), false)
  } finally { w.unmount(); s.ende() }
})

test('ein Teil mit Vorgabe: der Satz nennt Menge und Werte', async () => {
  const s = welt()
  const { w } = await zeigen('p')
  try { assert.deepEqual(saetze(w), ['RAM: genau 2 Teile, Werte 8, 32']) } finally { w.unmount(); s.ende() }
})

test('ohne Zeilen: keine, und ＋ Zeile öffnet die Bearbeitung mit einer leeren Mitglied-Zeile; speichern schreibt member:<knoten>', async () => {
  const s = welt()
  const { w, koepfe } = await zeigen('g')
  try {
    assert.equal(koepfe.at(-1), '· keine'); assert.match(w.text(), /Keine Zeilen/)
    await w.find('.bearbeiten').trigger('click')
    assert.equal(w.findAll('.teil .zeile').length, 1)
    assert.ok(w.find('.teil .speichern').attributes('disabled') !== undefined, 'ohne Gruppe nichts zu speichern')
    await w.find('.teil .grp').setValue('pci'); await w.find('.teil .bereit').setValue('3')
    await w.find('.teil .speichern').trigger('click'); await flushPromises()
    const put = s.gesendet.find(g => g.method === 'PUT')
    assert.equal(put.p, '/api/plugins/configurator/data/member:g'); assert.deepEqual(put.body, { rows: [{ group: 'pci', provides: 3 }] })
    assert.equal(w.find('.teil').exists(), false, 'danach steht wieder der Satz da')
    assert.deepEqual(saetze(w), ['PCI-Steckplätze: stellt 3 bereit']); assert.equal(koepfe.at(-1), '· 1 Zeilen')
    assert.ok(s.toasts.some(t => t[0] === 'Gespeichert'))
  } finally { w.unmount(); s.ende() }
})

test('die Gruppen, die es gibt, stehen zur Auswahl in der Zeile', async () => {
  const s = welt()
  const { w } = await zeigen('g')
  try {
    await w.find('.bearbeiten').trigger('click')
    assert.deepEqual(w.findAll('#kg-gruppen option').map(o => o.attributes('value')), ['ram', 'pci'])
  } finally { w.unmount(); s.ende() }
})

test('eine Variante ohne eigene Zeilen nimmt die ihres Produkts: der Satz steht da mit „geerbt von“, eigene Zeilen sind eine Kopie', async () => {
  const s = welt()
  const { w, koepfe } = await zeigen('v')
  try {
    assert.deepEqual(saetze(w), ['RAM: genau 2 Teile, Werte 8, 32'])
    assert.match(w.find('.geerbt').text(), /geerbt von Mainboard XYZ/)
    assert.equal(koepfe.at(-1), '· 1 Zeilen ↑ Mainboard XYZ')
    assert.match(w.find('.bearbeiten').text(), /Eigene Zeilen/)
    await w.find('.bearbeiten').trigger('click')
    assert.equal(w.find('.teil .grp').element.value, 'ram', 'die Kopie der geerbten Zeile')
    assert.equal(w.find('.teil .speichern').attributes('disabled'), undefined, 'eine Kopie ist etwas Neues: speichern geht sofort')
    await w.find('.teil .max').setValue('4')
    await w.find('.teil .speichern').trigger('click'); await flushPromises()
    const put = s.gesendet.find(g => g.method === 'PUT')
    assert.equal(put.p, '/api/plugins/configurator/data/member:v'); assert.deepEqual(put.body, { rows: [{ group: 'ram', min: 2, max: 4, values: ['8', '32'] }] })
    assert.equal(w.find('.geerbt').exists(), false, 'jetzt hat die Variante eigene Zeilen')
    assert.equal(s.docs['member:p'].rows[0].max, 2, 'die Zeilen des Produkts bleiben, wie sie waren')
  } finally { w.unmount(); s.ende() }
})

test('die Kopie der geerbten Zeilen verwerfen: es gibt nichts zu löschen', async () => {
  const s = welt()
  const { w } = await zeigen('v')
  try {
    await w.find('.bearbeiten').trigger('click')
    await w.find('.teil .entfernen').trigger('click'); await flushPromises()
    assert.equal(s.gesendet.length, 0); assert.equal(w.find('.teil').exists(), false)
    assert.ok(w.find('.geerbt').exists())
  } finally { w.unmount(); s.ende() }
})

test('alle Zeilen entfernen und speichern löscht das Dokument; ✕ fragt nach', async () => {
  const s = welt()
  const { w, koepfe } = await zeigen('p')
  try {
    await w.find('.bearbeiten').trigger('click')
    await w.findAll('button').find(b => b.attributes('title') === 'Zeile entfernen').trigger('click')
    await w.find('.teil .speichern').trigger('click'); await flushPromises()
    assert.ok(s.gesendet.some(g => g.method === 'DELETE' && g.p.endsWith('member:p')))
    assert.equal(koepfe.at(-1), '· keine')
  } finally { w.unmount(); s.ende() }
  const s2 = welt()
  const z = await zeigen('cpu')
  try {
    await z.w.find('.bearbeiten').trigger('click')
    await z.w.find('.teil .entfernen').trigger('click'); await flushPromises()
    assert.ok(s2.gesendet.some(g => g.method === 'DELETE' && g.p.endsWith('member:cpu')))
    assert.equal(z.koepfe.at(-1), '· keine')
  } finally { z.w.unmount(); s2.ende() }
})

test('ein Knotenwechsel liest die Zeilen des neuen Knotens', async () => {
  const s = welt()
  const koepfe = []
  const w = mount(Band, { props: { nodeId: 'cpu', onKopf: t => koepfe.push(t) } }); await flushPromises()
  try {
    await w.setProps({ nodeId: 'p' }); await flushPromises()
    assert.deepEqual(saetze(w), ['RAM: genau 2 Teile, Werte 8, 32'])
  } finally { w.unmount(); s.ende() }
})

test('das Plugin meldet das Band für Gruppe, Produkt und Variante an, und mount zeichnet es in den Körper', async () => {
  const s = welt()
  try {
    const band = entry.nodeBands[0]
    assert.equal(band.key, 'gruppen'); assert.deepEqual(band.roles, ['group', 'product', 'variant'])
    const head = document.createElement('span'), body = document.createElement('div')
    const ab = await band.mount({ head, body }, 'cpu')
    await flushPromises(); await flushPromises()
    assert.match(head.textContent, /2 Zeilen/); assert.match(body.textContent, /cpustecklatz: verbraucht 1/)
    ab(); assert.equal(body.textContent, '')
  } finally { s.ende() }
})
