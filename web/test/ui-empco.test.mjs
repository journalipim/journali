// ♻ EmpCo, die Ansicht des Plugins: Befunde prüfen und beheben, ohne „draussen“ zu sein. Liste und Arbeitsfläche nebeneinander; Strg+Enter speichert und geht zum
// nächsten; ein Begriff in vielen Feldern ersetzen (ein Stapel); Fehlalarme als Ausnahme festhalten; der Stand bleibt, auch wenn die Ansicht verlassen wird.
// Bedient wie vom Anwender: Klicks, Eingaben, Tasten. Der Server ist ein Stellvertreter: geprüft wird, was die Ansicht ihm schickt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises, win } from './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'
import { tree } from '../src/tree.js'

const View = (await import('../../plugins/empco/src/View.vue')).default
const { memory, forget } = await import('../../plugins/empco/src/memory.js')

tree.loaded = true
tree.rows = [{ id: 'g1', role: 'group', label: 'Klebstoffe', parent: null }, { id: 'p1', role: 'product', label: 'Kleber', parent: 'g1' }]
tree.byId = new Map(tree.rows.map(r => [r.id, r]))
tree.load = async () => {}
store.model = { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [{ key: 'beschreibung', type: 'text', label: { de: 'Beschreibung' } }], groups: [] }
localStorage.setItem('journali.empco.root', 'g1')

const warte = (ms = 0) => new Promise(r => setTimeout(r, ms)).then(flushPromises)
const zeile = (id, label, role, value, from = null) => ({ row: { id, label, role }, values: { beschreibung: { value, own: !from, from } }, inactive: [] })

/// Ein Server mit Werten, die sich schreiben lassen
function welt(werte, { ausnahmen = {} } = {}) {
  const orig = { get: api.get, post: api.post, del: api.del, batch: api.batchChunked, poll: store.poll, toast: store.toast, confirm: dialog.confirm }
  const geschrieben = [], toasts = [], geloescht = [], stapel = []; let tabellen = 0
  const ignoriert = { ...ausnahmen }
  api.get = async p => {
    const s = String(p)
    if (s.includes('/table')) { tabellen++; return { columns: [{ key: 'beschreibung', type: 'text' }], rows: werte.map(w => zeile(w.id, w.label, w.role ?? 'product', w.wert, w.from ?? null)) } }
    if (s.startsWith('/api/plugins/empco/data')) return ignoriert
    return []
  }
  api.post = async (p, body, method = 'POST') => {
    geschrieben.push({ p: decodeURIComponent(p), body, method })
    const m = /\/nodes\/([^/]+)\/attributes$/.exec(p); if (m) werte.find(w => w.id === m[1]).wert = body.value
    const d = /\/data\/(.+)$/.exec(decodeURIComponent(p)); if (d && method === 'PUT') ignoriert[d[1]] = body
    return {}
  }
  api.del = async p => { geloescht.push(decodeURIComponent(p)); delete ignoriert[/\/data\/(.+)$/.exec(decodeURIComponent(p))[1]]; return {} }
  api.batchChunked = async cmds => { stapel.push(cmds); for (const c of cmds) werte.find(w => w.id === c.args.node).wert = c.args.value; return { results: cmds.map((c, i) => ({ index: i })), error: null, errors: [] } }
  store.poll = async () => {}; store.toast = (...a) => toasts.push(a)
  return { geschrieben, toasts, geloescht, stapel, tabellen: () => tabellen, ende: () => { Object.assign(api, { get: orig.get, post: orig.post, del: orig.del, batchChunked: orig.batch }); store.poll = orig.poll; store.toast = orig.toast; dialog.confirm = orig.confirm } }
}
function zuruecksetzen() { forget(); memory.root = null; memory.mode = 'list'; memory.ignoredMap = {} }
const knopf = (w, text) => w.findAll('button').find(b => b.text().includes(text))
const zeilen = w => w.findAll('.liste tbody tr')
const taste = (el, key, extra = {}) => el.dispatchEvent(new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }))

async function ansicht(werte, opt) {
  zuruecksetzen()
  const s = welt(werte, opt)
  const w = mount(View, { attachTo: document.body }); await flushPromises()
  return { w, s, ende: () => { w.unmount(); s.ende() } }
}
const pruefen = async a => { await knopf(a.w, '▶ prüfen').trigger('click'); await warte() }

const EIN = () => [{ id: 'p1', label: 'Kleber', wert: 'Ein umweltfreundliches Produkt' }]

test('prüfen: die Liste zeigt den Befund mit Ausschnitt, die Arbeitsfläche den Wert mit markiertem Begriff und das Textfeld', async () => {
  const a = await ansicht(EIN())
  try {
    assert.match(a.w.text(), /Teilbaum wählen und prüfen/)
    assert.ok(!a.w.find('details.katalog').element.open, 'der Katalog ist eingeklappt')
    await pruefen(a)
    assert.match(a.w.text().replace(/\s+/g, ' '), /1 Befunde in 1 Knoten/)
    assert.equal(zeilen(a.w).length, 1)
    assert.equal(zeilen(a.w)[0].find('mark').text(), 'umweltfreundliches')
    assert.ok(zeilen(a.w)[0].classes().includes('cur'), 'der erste Befund ist gewählt')
    assert.equal(a.w.find('.bench textarea').element.value, 'Ein umweltfreundliches Produkt')
    assert.equal(a.w.find('.bench .wert mark').text(), 'umweltfreundliches')
    assert.match(a.w.find('.bench .regel').text(), /Allgemeine Umweltaussage ohne Beleg/)
    const link = a.w.find('.bench a')
    assert.equal(link.attributes('href'), '/tree/p1'); assert.equal(link.attributes('target'), '_blank', 'der Knoten öffnet in einem neuen Tab: die Prüfung bleibt')
  } finally { a.ende() }
})

test('Speichern schreibt den Wert, der Befund entfällt', async () => {
  const a = await ansicht(EIN())
  try {
    await pruefen(a)
    await a.w.find('.bench textarea').setValue('Ein Produkt mit 30 % Rezyklat')
    await knopf(a.w, 'Speichern').trigger('click'); await warte()
    assert.equal(a.s.geschrieben.length, 1)
    assert.match(a.s.geschrieben[0].p, /\/nodes\/p1\/attributes$/)
    assert.deepEqual({ ...a.s.geschrieben[0].body }, { attribute: 'beschreibung', locale: null, channel: null, value: 'Ein Produkt mit 30 % Rezyklat', row: null })
    assert.match(a.w.text(), /✓ keine Befunde in 1 Knoten/)
  } finally { a.ende() }
})

test('trifft der neue Wert weiter, bleibt der Befund mit dem neuen Begriff stehen', async () => {
  const a = await ansicht(EIN())
  try {
    await pruefen(a)
    await a.w.find('.bench textarea').setValue('Ein nachhaltiges Produkt')
    await knopf(a.w, 'Speichern').trigger('click'); await warte()
    assert.equal(zeilen(a.w).length, 1)
    assert.equal(zeilen(a.w)[0].find('mark').text(), 'nachhaltiges')
  } finally { a.ende() }
})

test('Pfeiltasten wechseln den Befund; Strg+Enter im Textfeld speichert und geht zum nächsten', async () => {
  const a = await ansicht([
    { id: 'p1', label: 'Alpha', wert: 'umweltfreundlich' }, { id: 'p2', label: 'Beta', wert: 'klimaneutral' }, { id: 'p3', label: 'Gamma', wert: 'ökologisch' },
  ])
  try {
    await pruefen(a)
    const cur = () => zeilen(a.w).findIndex(r => r.classes().includes('cur'))
    assert.equal(cur(), 0)
    taste(document.body, 'ArrowDown'); await warte(); assert.equal(cur(), 1)
    taste(document.body, 'j'); await warte(); assert.equal(cur(), 2)
    taste(document.body, 'ArrowDown'); await warte(); assert.equal(cur(), 2, 'am Ende bleibt es stehen')
    taste(document.body, 'ArrowUp'); await warte(); assert.equal(cur(), 1)
    // im Textfeld wechseln die Pfeiltasten nichts; Strg+Enter speichert und springt zum nächsten
    const ta = a.w.find('.bench textarea')
    await ta.setValue('Ein Produkt mit Nachweis')
    taste(ta.element, 'ArrowDown'); await warte(); assert.equal(cur(), 1)
    taste(ta.element, 'Enter', { ctrlKey: true }); await warte()
    assert.equal(a.s.geschrieben.length, 1); assert.match(a.s.geschrieben[0].p, /p2/)
    assert.equal(zeilen(a.w).length, 2, 'Beta ist erledigt')
    assert.equal(zeilen(a.w)[cur()].text().includes('Gamma'), true, 'weiter beim nächsten')
  } finally { a.ende() }
})

test('der Stand bleibt: wer die Ansicht verlässt und zurückkommt, steht wieder an derselben Stelle und prüft nicht neu', async () => {
  const a = await ansicht([{ id: 'p1', label: 'Alpha', wert: 'umweltfreundlich' }, { id: 'p2', label: 'Beta', wert: 'klimaneutral' }])
  try {
    await pruefen(a)
    taste(document.body, 'ArrowDown'); await warte()
    await a.w.find('.suche').setValue('Beta')
    a.w.unmount()
    const nach = mount(View, { attachTo: document.body }); await flushPromises()
    assert.equal(a.s.tabellen(), 1, 'nicht noch einmal geprüft')
    assert.equal(nach.find('.suche').element.value, 'Beta')
    assert.equal(nach.findAll('.liste tbody tr').length, 1)
    assert.ok(nach.find('.liste tbody tr').classes().includes('cur'))
    assert.match(nach.find('.bench').text(), /Beta/)
    nach.unmount()
  } finally { a.s.ende() }
})

test('ein anderer Teilbaum vergisst den Stand: das Ergebnis gehörte zum alten', async () => {
  zuruecksetzen(); memory.root = 'p1'; memory.result = { findings: [], nodes: 5 }
  const s = welt(EIN())
  const w = mount(View); await flushPromises()
  try { assert.equal(memory.result, null); assert.match(w.text(), /Teilbaum wählen und prüfen/) } finally { w.unmount(); s.ende() }
})

test('Geerbtes steht einmal: ein Befund am Produkt, die Varianten als „+n“, der Wert wird am Produkt geändert', async () => {
  const wert = 'Ein umweltfreundliches Produkt'
  const a = await ansicht([{ id: 'p1', label: 'Produkt', wert }, { id: 'v1', label: 'Variante 1', role: 'variant', wert, from: 'p1' }, { id: 'v2', label: 'Variante 2', role: 'variant', wert, from: 'p1' }])
  try {
    await pruefen(a)
    assert.equal(zeilen(a.w).length, 1)
    assert.match(zeilen(a.w)[0].text(), /Produkt\s*\+2/)
    assert.match(a.w.find('.bench .erben').text(), /2 Knoten erben den Wert: Variante 1, Variante 2/)
    await a.w.find('.bench textarea').setValue('Ein Produkt')
    await knopf(a.w, 'Speichern').trigger('click'); await warte()
    assert.match(a.s.geschrieben[0].p, /\/nodes\/p1\/attributes$/)
    assert.match(a.w.text(), /✓ keine Befunde/)
  } finally { a.ende() }
})

test('Filter: eine Regel, die Schwere und ein Text grenzen die Liste ein; die Zahlen an den Regeln zeigen, was ein Klick ergäbe', async () => {
  const a = await ansicht([
    { id: 'p1', label: 'Alpha', wert: 'umweltfreundlich' }, { id: 'p2', label: 'Beta', wert: 'Ein langlebiges Teil' }, { id: 'p3', label: 'Gamma', wert: 'klimaneutral' },
  ])
  try {
    await pruefen(a)
    assert.equal(zeilen(a.w).length, 3)
    const chip = id => a.w.findAll('.leiste .chip').find(c => c.attributes('title')?.includes(id))
    const generic = a.w.findAll('.leiste .chip').find(c => c.text().includes('Allgemeine Umweltaussage'))
    assert.match(generic.text(), /· 1$/)
    await generic.trigger('click'); await warte()
    assert.deepEqual(zeilen(a.w).map(r => r.text().includes('Alpha')), [true])
    await generic.trigger('click'); await warte()
    await a.w.findAll('.chip.sev')[1].trigger('click'); await warte()                   // ⚠
    assert.equal(zeilen(a.w).length, 1); assert.match(zeilen(a.w)[0].text(), /Beta/)
    await a.w.findAll('.chip.sev')[1].trigger('click')
    await a.w.find('.suche').setValue('gamma'); await warte()
    assert.equal(zeilen(a.w).length, 1); assert.match(zeilen(a.w)[0].text(), /Gamma/)
    await a.w.find('.suche').setValue('zzz'); await warte()
    assert.match(a.w.text(), /Kein Befund passt zum Filter/)
    assert.ok(chip)
  } finally { a.ende() }
})

test('Ausnahme: ein Fehlalarm wird als Plugin-Daten gemerkt und fällt aus der Liste; „Ausnahmen“ zeigt ihn, „aufheben“ holt ihn zurück', async () => {
  const a = await ansicht([{ id: 'p1', label: 'Alpha', wert: 'umweltfreundlich' }, { id: 'p2', label: 'Beta', wert: 'klimaneutral' }])
  try {
    await pruefen(a)
    await a.w.find('.ausnahme input').setValue('Fachbegriff')
    await knopf(a.w, 'Ausnahme').trigger('click'); await warte()
    const put = a.s.geschrieben.find(g => g.method === 'PUT')
    assert.match(put.p, /^\/api\/plugins\/empco\/data\/ignore:p1:beschreibung:de:generic:[a-z0-9]+$/)
    assert.deepEqual({ ...put.body, hash: 'x' }, { term: 'umweltfreundlich', reason: 'Fachbegriff', hash: 'x' })
    assert.equal(zeilen(a.w).length, 1, 'Alpha ist aus der Liste')
    assert.match(zeilen(a.w)[0].text(), /Beta/)
    // anzeigen: die Ausnahme steht grau in der Liste
    const haken = a.w.find('.leiste input[type=checkbox]')
    assert.match(a.w.find('.leiste label').text(), /Ausnahmen \(1\)/)
    await haken.setValue(true); await warte()
    assert.equal(zeilen(a.w).length, 2)
    assert.ok(zeilen(a.w)[0].classes().includes('aus'))
    await zeilen(a.w)[0].trigger('click'); await warte()
    assert.match(a.w.find('.ausnahme').text(), /Ausnahme · Fachbegriff/)
    await knopf(a.w, 'aufheben').trigger('click'); await warte()
    assert.equal(a.s.geloescht.length, 1); assert.match(a.s.geloescht[0], /ignore:p1:beschreibung:de:generic:/)
    assert.ok(!zeilen(a.w)[0].classes().includes('aus'))
  } finally { a.ende() }
})

test('Ausnahme: ändert sich der Text, gilt der Befund wieder', async () => {
  const text = 'Ein umweltfreundliches Produkt'
  const name = (await import('../../plugins/empco/src/befunde.js')).ignoreName({ node: { id: 'p1' }, attribute: 'beschreibung', locale: 'de', rule: 'generic', term: 'umweltfreundliches' })
  const a = await ansicht([{ id: 'p1', label: 'Alpha', wert: text + ' aus Holz' }], { ausnahmen: { [name]: { term: 'umweltfreundliches', reason: '', hash: (await import('../../plugins/empco/src/befunde.js')).textHash(text) } } })
  try {
    await pruefen(a)
    assert.equal(zeilen(a.w).length, 1, 'der Text ist ein anderer als der der Ausnahme')
  } finally { a.ende() }
})

test('Begriffe: derselbe Begriff in vielen Feldern wird mit Vorschau ersetzt — ein Stapel, nach Bestätigung', async () => {
  const a = await ansicht([
    { id: 'p1', label: 'Alpha', wert: 'Ein umweltfreundliches Produkt' }, { id: 'p2', label: 'Beta', wert: 'Sehr umweltfreundlich im Alltag' },
    { id: 'p3', label: 'Gamma', wert: 'Auch umweltfreundlich' }, { id: 'p4', label: 'Delta', wert: 'klimaneutral' },
  ])
  try {
    await pruefen(a)
    await knopf(a.w, 'Begriffe').trigger('click'); await warte()
    assert.equal(zeilen(a.w).length, 2, 'zwei Begriffe')
    assert.match(zeilen(a.w)[0].text().replace(/\s+/g, ' '), /umweltfreundlich.*3/i, 'der häufigste zuerst')
    assert.match(a.w.find('.term h3').text(), /3 Felder/)
    // Vorschau
    const ersatz = a.w.find('.ersatz input')
    const los = () => a.w.find('.ersatz button')
    assert.ok(los().attributes('disabled') !== undefined, 'ohne Ersatztext nichts zu tun')
    await ersatz.setValue('ressourcenschonend'); await warte()
    const nachher = a.w.findAll('.vorschau tbody tr').map(r => r.findAll('td')[3].text())
    assert.ok(nachher.every(t => t.includes('ressourcenschonend')), nachher.join(' | '))
    assert.match(los().text(), /In 3 Feldern ersetzen/)
    // eines abhaken
    await a.w.findAll('.vorschau tbody tr input[type=checkbox]')[1].setValue(false); await warte()
    assert.match(los().text(), /In 2 Feldern ersetzen/)
    // abgelehnt: nichts geschrieben
    dialog.confirm = async () => false
    await los().trigger('click'); await warte()
    assert.equal(a.s.stapel.length, 0)
    dialog.confirm = async o => { assert.match(o.title, /„umweltfreundlich\w*“ in 2 Feldern ersetzen\?/i); return true }
    await los().trigger('click'); await warte()
    assert.equal(a.s.stapel.length, 1, 'ein Stapel')
    assert.deepEqual(a.s.stapel[0].map(c => [c.op, c.args.node, c.args.value]).sort(), [
      ['attribute.set', 'p1', 'Ein ressourcenschonendes Produkt'],
      ['attribute.set', 'p3', 'Auch ressourcenschonend'],
    ].sort())
    assert.equal(a.s.geschrieben.length, 0, 'nicht einzeln geschrieben')
    assert.match(a.w.text().replace(/\s+/g, ' '), /1 Felder|umweltfreundlich/i, 'der abgehakte Befund blieb')
  } finally { a.ende() }
})
