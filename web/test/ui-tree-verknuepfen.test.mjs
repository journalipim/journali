// Einträge verknüpfen (30.09.2026): der Dialog zeigt als Spalten die Attribute aller Gruppen des Relationstyps — auch die,
// die nur Mitglied der Gruppe sind (n:m) — und schreibt ihre Werte mit der Relation in einem Stapel.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const TreeView = (await import('../src/views/TreeView.vue')).default

function welt() {
  const rows = [
    { id: 'g1', role: 'group', label: 'Mastertree', parent: null, axes: [] },
    { id: 'p1', role: 'product', label: 'Vitamin C', parent: 'g1', axes: [] },
    { id: 'p2', role: 'product', label: 'Multivitamin', parent: 'g1', axes: [] },
    { id: 'p3', role: 'product', label: 'Zucker', parent: 'g1', axes: [] },
  ]
  tree.byId = new Map(rows.map(r => [r.id, r])); tree.rows = rows
  tree.children = new Map([['', [rows[0]]], ['g1', [rows[1], rows[2], rows[3]]]])
  tree.expanded = new Set(['g1']); tree.loaded = true; tree.load = async () => {}
  store.actor = 'u1'; store.toasts = []; store.poll = async () => {}
  store.model = {
    masterLocale: 'de', locales: [{ code: 'de' }], statuses: [], groups: [{ key: 'bestandteil' }, { key: 'rezept' }],
    // der Typ kennt nur „rezept“; die Menge gehört der Herkunft nach zu „bestandteil“ und ist Mitglied von „rezept“
    relationTypes: [{ key: 'zutaten', label: { de: 'Zutaten' }, reverse: { de: 'Zutat von' }, group: 'rezept', groups: ['rezept'] }],
    units: [
      { key: 'kg', label: { de: 'Kilogramm' }, quantity: 'mass', factor: 1 }, { key: 'g', label: { de: 'Gramm' }, quantity: 'mass', factor: 0.001 },
      { key: 'mg', label: { de: 'Milligramm' }, quantity: 'mass', factor: 0.000001 },
    ],
    attributes: [
      { key: 'menge', label: { de: 'Menge' }, type: 'integer', unit: 'mg', group: 'bestandteil', groups: ['bestandteil', 'rezept'] },
      { key: 'ballast', label: { de: 'Ballast' }, type: 'integer', unit: 'kg', group: 'bestandteil', groups: ['bestandteil', 'rezept'] },
      { key: 'fremd', label: { de: 'Fremd' }, type: 'text', group: 'bestandteil', groups: ['bestandteil'] },
    ],
  }
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url); const methode = opt.method ?? 'GET'
    rufe.push({ pfad, methode, rumpf: typeof opt.body === 'string' ? JSON.parse(opt.body) : opt.body })
    let antwort = {}
    if (/\/relations$/.test(pfad)) antwort = { out: [], in: [] }
    else if (pfad.endsWith('/api/batch')) antwort = { batch: 'b', results: [{ index: 0 }, { index: 1 }], error: null }
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}

async function dialogOeffnen(quellen = ['p1']) {
  const rufe = welt()
  const router = { path: '/tree/g1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const w = mount(TreeView, { props: { id: 'g1' }, global: { provide: { [routerKey]: router }, stubs: { RouterLink: true, 'router-link': true, NodeView: true } } })
  await flushPromises()
  for (const id of quellen) await w.findAll('.node').find(n => n.attributes('title') === id).trigger('click', { ctrlKey: true })
  await w.findAll('button.primary').find(b => b.text() === '⇄').trigger('click')
  await flushPromises()
  await w.find('.overlay input[type="search"]').setValue('Multi')
  await w.find('.overlay .picker .pick').trigger('click')
  await flushPromises()
  return { w, rufe }
}

test('die Spalten sind die Attribute aller Gruppen des Typs — auch ein Mitglied, dessen Heimatgruppe eine andere ist', async () => {
  const { w } = await dialogOeffnen()
  const spalten = w.findAll('.overlay thead th').map(th => th.text()).filter(Boolean)
  assert.ok(spalten.some(s => /^Menge/.test(s)), 'Menge steht als Spalte da: ' + spalten.join(' | '))
  assert.ok(!spalten.some(s => /Fremd/.test(s)), 'ein Attribut einer anderen Gruppe steht nicht da')
})

test('der Typ nennt in der Auswahl seine Gruppen', async () => {
  const { w } = await dialogOeffnen()
  assert.match(w.find('.overlay select option').text(), /Zutaten · ▤ rezept/)
})

// Shift + Ziehen: Vitamin C wird auf Multivitamin abgelegt
async function ziehen(w, von, nach) {
  const dt = { effectAllowed: '', dropEffect: '', files: [], types: [], setData() {}, getData: () => '' }
  await w.findAll('.node').find(n => n.attributes('title') === von).trigger('dragstart', { dataTransfer: dt })
  await w.findAll('.node').find(n => n.attributes('title') === nach).trigger('drop', { dataTransfer: dt, shiftKey: true })
  await flushPromises()
}
async function baum() {
  const rufe = welt()
  const router = { path: '/tree/g1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const w = mount(TreeView, { props: { id: 'g1' }, global: { provide: { [routerKey]: router }, stubs: { RouterLink: true, 'router-link': true, NodeView: true } } })
  await flushPromises()
  return { w, rufe }
}
const ausgewaehlt = w => w.text().includes('☑')

test('Shift + Ziehen: der Dialog kennt den gezogenen Knoten, im Baum ist er ab dem Loslassen nicht ausgewählt', async () => {
  const { w } = await baum()
  assert.equal(ausgewaehlt(w), false)
  await ziehen(w, 'p1', 'p2')
  assert.ok(w.find('.overlay').exists(), 'der Dialog ist offen')
  assert.match(w.find('.overlay h1').text(), /1 Einträge verknüpfen/, 'der Dialog kennt die Quelle')
  assert.ok(w.findAll('.overlay tbody tr').some(tr => /Vitamin C/.test(tr.text())), 'Vitamin C steht in der Liste')
  assert.equal(ausgewaehlt(w), false, 'auch bei offenem Dialog gehört der Knoten nicht zur Auswahl')
  await w.findAll('.overlay button').find(b => b.text() === 'Abbrechen').trigger('click'); await flushPromises()
  assert.equal(w.find('.overlay').exists(), false)
  assert.equal(ausgewaehlt(w), false)
})

test('Shift + Ziehen: nach dem Verknüpfen ist niemand ausgewählt', async () => {
  const { w } = await baum()
  await ziehen(w, 'p1', 'p2')
  await w.find('.overlay button.primary').trigger('click'); await flushPromises()
  assert.equal(w.find('.overlay').exists(), false)
  assert.equal(ausgewaehlt(w), false)
})

test('Esc schliesst den Dialog und gibt die Auswahl ebenso zurück', async () => {
  const { w } = await baum()
  await ziehen(w, 'p1', 'p2')
  await w.find('.overlay').trigger('keydown', { key: 'Escape' }); await flushPromises()
  assert.equal(w.find('.overlay').exists(), false)
  assert.equal(ausgewaehlt(w), false)
})

test('eine Auswahl, die schon da war, bleibt und zieht mit', async () => {
  const { w } = await baum()
  await w.findAll('.node').find(n => n.attributes('title') === 'p1').trigger('click', { ctrlKey: true })
  assert.ok(ausgewaehlt(w))
  await ziehen(w, 'p1', 'p2')
  assert.match(w.find('.overlay h1').text(), /1 Einträge verknüpfen/)
  await w.findAll('.overlay button').find(b => b.text() === 'Abbrechen').trigger('click'); await flushPromises()
  assert.ok(ausgewaehlt(w), 'wer selbst ausgewählt hat, behält die Auswahl')
})

test('ein Knoten, der nicht zur Auswahl gehört, wird allein gezogen: die andere Auswahl geht nicht mit', async () => {
  const { w } = await baum()
  await w.findAll('.node').find(n => n.attributes('title') === 'g1').trigger('click', { ctrlKey: true })
  await ziehen(w, 'p1', 'p2')
  assert.match(w.find('.overlay h1').text(), /1 Einträge verknüpfen/, 'nur der gezogene Knoten, nicht die Auswahl')
  assert.ok(ausgewaehlt(w), 'die Auswahl (g1) bleibt, wie sie war')
})

const kopf = (w, name) => w.findAll('.overlay thead th').find(th => th.text().startsWith(name))

const zeileVon = (w, name) => w.findAll('.overlay tbody tr').find(tr => tr.text().includes(name))

test('jede Zelle mit Einheit hat ihre eigene Auswahl, anfangs die Einheit des Attributs', async () => {
  const { w } = await dialogOeffnen(['p1', 'p3'])
  assert.equal(kopf(w, 'Menge').find('select').exists(), false, 'die Überschrift trägt keine Auswahl mehr')
  for (const name of ['Vitamin C', 'Zucker']) {
    const sel = zeileVon(w, name).find('select.unitsel')
    assert.ok(sel.exists(), `${name}: die Auswahl steht in der Zelle`)
    assert.equal(sel.element.value, 'mg')
    assert.deepEqual(sel.findAll('option').map(o => o.text()), ['kg', 'g', 'mg'])
  }
})

test('6 mg Vitamin C und 20 g Zucker in einem Stapel: jede Zeile in ihrer Einheit, gespeichert in mg', async () => {
  const { w, rufe } = await dialogOeffnen(['p1', 'p3'])
  await zeileVon(w, 'Vitamin C').find('input[type="text"]').setValue('6')
  await zeileVon(w, 'Zucker').find('select.unitsel').setValue('g')
  await zeileVon(w, 'Zucker').find('input[type="text"]').setValue('20')
  await w.find('.overlay button.primary').trigger('click'); await flushPromises()
  const c = rufe.find(r => r.pfad.endsWith('/api/batch') && r.methode === 'POST').rumpf.commands
  assert.deepEqual(c.map(x => x.op), ['relation.create', 'relation.attribute.set', 'relation.create', 'relation.attribute.set'])
  assert.equal(c[1].args.value, '6', '6 mg bleiben 6')
  assert.equal(c[3].args.value, '20000', '20 g sind 20000 mg')
  assert.equal('unit' in c[1].args, false, 'in der Einheit des Attributs braucht es keinen Hinweis')
  assert.equal(c[3].args.unit, 'g', 'der Eintrag merkt sich, dass in g eingegeben wurde')
})

test('„für alle“ stellt die Einheit aller Zeilen um; danach lässt sich jede einzeln ändern', async () => {
  const { w } = await dialogOeffnen(['p1', 'p3'])
  const alle = w.findAll('.overlay thead tr').find(tr => tr.text().includes('für alle'))
  await alle.find('select.unitsel').setValue('g'); await flushPromises()
  assert.equal(zeileVon(w, 'Vitamin C').find('select.unitsel').element.value, 'g')
  assert.equal(zeileVon(w, 'Zucker').find('select.unitsel').element.value, 'g')
  await zeileVon(w, 'Zucker').find('select.unitsel').setValue('kg'); await flushPromises()
  assert.equal(zeileVon(w, 'Vitamin C').find('select.unitsel').element.value, 'g', 'die andere Zeile bleibt')
})

test('Umstellen rechnet den getippten Wert mit um: 5 mg werden 0.005 g und 0.000005 kg — und zurück wieder 5', async () => {
  const { w } = await dialogOeffnen()
  const zeile = zeileVon(w, 'Vitamin C')
  await zeile.find('input[type="text"]').setValue('5')
  await zeile.find('select.unitsel').setValue('g'); await flushPromises()
  assert.equal(zeileVon(w, 'Vitamin C').find('input[type="text"]').element.value, '0.005')
  await zeileVon(w, 'Vitamin C').find('select.unitsel').setValue('kg'); await flushPromises()
  assert.equal(zeileVon(w, 'Vitamin C').find('input[type="text"]').element.value, '0.000005')
  await zeileVon(w, 'Vitamin C').find('select.unitsel').setValue('mg'); await flushPromises()
  assert.equal(zeileVon(w, 'Vitamin C').find('input[type="text"]').element.value, '5')
})

test('eine leere Zelle bleibt beim Umstellen leer; eine Eingabe, die keine Zahl ist, bleibt', async () => {
  const { w } = await dialogOeffnen()
  await zeileVon(w, 'Vitamin C').find('select.unitsel').setValue('g'); await flushPromises()
  assert.equal(zeileVon(w, 'Vitamin C').find('input[type="text"]').element.value, '')
  await zeileVon(w, 'Vitamin C').find('input[type="text"]').setValue('viel')
  await zeileVon(w, 'Vitamin C').find('select.unitsel').setValue('kg'); await flushPromises()
  assert.equal(zeileVon(w, 'Vitamin C').find('input[type="text"]').element.value, 'viel')
})

test('„für alle“: Wert und Einheit der Kopfzeile gelten zusammen für jede Zeile', async () => {
  const { w, rufe } = await dialogOeffnen(['p1', 'p3'])
  const alle = () => w.findAll('.overlay thead tr').find(tr => tr.text().includes('für alle'))
  await alle().find('select.unitsel').setValue('g'); await flushPromises()
  await alle().find('input[type="text"]').setValue('5'); await alle().find('input[type="text"]').trigger('change'); await flushPromises()
  for (const n of ['Vitamin C', 'Zucker']) assert.equal(zeileVon(w, n).find('input[type="text"]').element.value, '5')
  await w.find('.overlay button.primary').trigger('click'); await flushPromises()
  const c = rufe.find(r => r.pfad.endsWith('/api/batch') && r.methode === 'POST').rumpf.commands
  assert.deepEqual([c[1].args.value, c[3].args.value], ['5000', '5000'], '5 g in jeder Zeile, gespeichert in mg')
})

test('„für alle“ umstellen rechnet die Kopfzeile und alle Zeilen mit um', async () => {
  const { w } = await dialogOeffnen(['p1', 'p3'])
  const alle = () => w.findAll('.overlay thead tr').find(tr => tr.text().includes('für alle'))
  await alle().find('input[type="text"]').setValue('5'); await alle().find('input[type="text"]').trigger('change'); await flushPromises()
  await alle().find('select.unitsel').setValue('g'); await flushPromises()
  assert.equal(alle().find('input[type="text"]').element.value, '0.005')
  for (const n of ['Vitamin C', 'Zucker']) assert.equal(zeileVon(w, n).find('input[type="text"]').element.value, '0.005')
})

test('ein ganzzahliges Attribut lehnt ein Ergebnis mit Nachkommastellen ab: nichts geht hinaus', async () => {
  const { w, rufe } = await dialogOeffnen()
  const zeile = w.findAll('.overlay tbody tr').find(tr => /Vitamin C/.test(tr.text()))
  await zeile.findAll('select.unitsel')[1].setValue('g')
  await zeile.findAll('input[type="text"]')[1].setValue('1')
  await w.find('.overlay button.primary').trigger('click'); await flushPromises()
  assert.equal(rufe.some(r => r.pfad.endsWith('/api/batch') && r.methode === 'POST'), false)
  assert.match(store.toasts.at(-1)?.text ?? '', /1 g sind 0\.001 kg/)
})

test('der Wert der Menge geht mit der Relation in einen Stapel', async () => {
  const { w, rufe } = await dialogOeffnen()
  const zeile = w.findAll('.overlay tbody tr').find(tr => /Vitamin C/.test(tr.text()))
  await zeile.find('input[type="text"]').setValue('6')
  await w.find('.overlay button.primary').trigger('click')
  await flushPromises()
  const stapel = rufe.find(r => r.pfad.endsWith('/api/batch') && r.methode === 'POST')
  assert.ok(stapel, 'ein Stapel wurde geschickt')
  assert.deepEqual(stapel.rumpf.commands.map(c => c.op), ['relation.create', 'relation.attribute.set'])
  assert.equal(stapel.rumpf.commands[1].args.attribute, 'menge')
  assert.equal(stapel.rumpf.commands[1].args.value, '6')
})
