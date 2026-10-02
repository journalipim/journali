// ⚙ Konfigurator, die Ansicht des Plugins: Konfiguratoren anlegen und entfernen, Regeln als Formular pflegen und speichern,
// Beispiele prüfen (derselbe Endpunkt wie für einen Shop) und Testfälle halten. Bedient wie vom Anwender: Klicks, Eingaben, Auswahl.
// Der Server ist ein Stellvertreter: geprüft wird, was die Ansicht ihm schickt und wie sie seine Antwort zeigt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises, win } from './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'
import { tree } from '../src/tree.js'

const View = (await import('../../plugins/configurator/src/View.vue')).default

tree.byId = new Map([['k1', { id: 'k1', label: 'CPU-Kühler 1' }], ['gk2', { id: 'gk2', label: 'Grafikkarten-Kühler 2' }]])
store.model = { attributes: [{ key: 'leistung', label: { de: 'Leistung' } }, { key: 'farbe', label: { de: 'Farbe' } }] }

const REGEL = { id: 'k1-gk2', text: 'passt nicht', if: { kind: 'has', selector: { node: 'k1' }, value: 1 }, then: { kind: 'forbids', selector: { node: 'gk2' } } }
const OK = { valid: true, complete: true, selection: [], violations: [], missing: [], balance: {}, selectable: [] }
const warte = (ms = 260) => new Promise(r => setTimeout(r, ms)).then(flushPromises)

/// Ein Server, der sich merkt, was in die Plugin-Daten geschrieben wird
function welt({ defs = { server: { label: 'Server', rules: [REGEL] } }, errors = [], cases = {}, check = () => OK } = {}) {
  const gesendet = [], toasts = []
  const orig = { get: api.get, post: api.post, del: api.del, toast: store.toast, confirm: dialog.confirm }
  const liste = () => Object.entries(defs).map(([key, d]) => ({ key, label: d.label, root: d.root, rules: (d.rules ?? []).length, errors: 0 }))
  api.get = async p => {
    if (p === '/api/configurator') return liste()
    const m = /^\/api\/configurator\/([^/?]+)$/.exec(p)
    if (m) return { key: m[1], definition: defs[m[1]], errors }
    if (p.startsWith('/api/plugins/configurator/data?prefix=')) {
      const pre = decodeURIComponent(p.split('prefix=')[1].split('&')[0])
      const treffer = Object.entries(cases).filter(([k]) => k.startsWith(pre))
      return p.includes('values=true') ? Object.fromEntries(treffer) : treffer.map(([k]) => k)
    }
    throw new Error('GET ' + p)
  }
  api.post = async (p, body, method = 'POST') => {
    const pfad = decodeURIComponent(p)
    gesendet.push({ p: pfad, body, method })
    const name = /\/data\/(.+)$/.exec(pfad)?.[1]
    if (method === 'PUT' && name?.startsWith('def:')) defs[name.slice(4)] = body
    if (method === 'PUT' && name?.startsWith('case:')) cases[name] = body
    return /\/check$/.test(pfad) ? check(body, pfad) : {}
  }
  api.del = async p => {
    const pfad = decodeURIComponent(p)
    gesendet.push({ p: pfad, method: 'DELETE' })
    const name = /\/data\/(.+)$/.exec(pfad)?.[1]
    if (name?.startsWith('def:')) delete defs[name.slice(4)]
    if (name?.startsWith('case:')) delete cases[name]
    return {}
  }
  store.toast = (...a) => toasts.push(a)
  return { gesendet, toasts, defs, cases, ende: () => { Object.assign(api, { get: orig.get, post: orig.post, del: orig.del }); store.toast = orig.toast; dialog.confirm = orig.confirm } }
}

async function oeffnen(w, key = 'server') {
  const zeile = w.findAll('tbody tr').find(r => r.text().includes(key))
  await zeile.trigger('click'); await flushPromises()
}
const speichern = w => w.find('.primary')
const ids = w => w.findAll('.kennung').map(i => i.element.value)
/// Der Satz einer einfachen Regel, wie er auf dem Schirm steht: Wörter, gewählte Teile und Mengen
const satzText = el => [...el.element.children].map(c => c.classList.contains('sel') ? (c.querySelector('.knoten')?.textContent ?? '') : c.tagName === 'INPUT' ? c.value : c.textContent).join(' ').replace(/\s+/g, ' ').trim()

test('die Liste nennt die Konfiguratoren mit der Zahl der Regeln, ein Klick öffnet die Regeln als Formular und als Satz', async () => {
  const s = welt()
  const w = mount(View); await flushPromises()
  try {
    assert.match(w.find('tbody tr').text(), /Server\s*server\s*1/)
    assert.match(w.text(), /Einen Konfigurator wählen oder anlegen/)
    await oeffnen(w)
    assert.deepEqual(ids(w), ['k1-gk2'])
    assert.equal(w.find('.text').element.value, 'passt nicht')
    assert.match(w.text().replace(/\s+/g, ' '), /Wenn CPU-Kühler 1 gewählt, dann Grafikkarten-Kühler 2 verboten/)
    assert.ok(speichern(w).attributes('disabled') !== undefined, 'nichts geändert: nichts zu speichern')
  } finally { w.unmount(); s.ende() }
})

test('eine neue Regel anlegen und speichern schreibt die Definition als Plugin-Daten (PUT def:<key>)', async () => {
  const s = welt()
  const w = mount(View); await flushPromises()
  try {
    await oeffnen(w)
    await w.find('.neue-regel').trigger('click')
    assert.deepEqual(ids(w), ['k1-gk2', 'r1'])
    assert.equal(speichern(w).attributes('disabled'), undefined, 'jetzt ist etwas zu speichern')
    await speichern(w).trigger('click'); await flushPromises()
    const put = s.gesendet.find(g => g.method === 'PUT')
    assert.equal(put.p, '/api/plugins/configurator/data/def:server')
    assert.equal(put.body.label, 'Server')
    assert.deepEqual(put.body.rules[1], { id: 'r1', text: 'Immer: jedes Teil verboten', then: { kind: 'forbids', selector: {} } }, 'ohne eigene Meldung ist der Satz die Meldung')
    assert.deepEqual(put.body.rules[0].if, { kind: 'has', selector: { node: 'k1' }, value: 1 })
    assert.ok(speichern(w).attributes('disabled') !== undefined, 'nach dem Speichern ist der Stand wieder gleich')
    assert.ok(s.toasts.some(t => t[0] === 'Gespeichert'))
  } finally { w.unmount(); s.ende() }
})

test('die Art der Bedingung wechseln zeigt ihre Felder; ein Attributfilter bekommt „=“ und einen Wert', async () => {
  const s = welt()
  const w = mount(View); await flushPromises()
  try {
    await oeffnen(w)
    await w.find('.umschalten').trigger('click')
    const kind = w.find('select.kind')
    await kind.setValue('count')
    assert.ok(w.find('.cond select.cmp').exists(), 'count hat einen Vergleich')
    await kind.setValue('balance')
    assert.ok(w.find('.cond input.res').exists(), 'balance nennt eine Ressource')
    await w.find('.cond input.res').setValue('pci_slot')
    // die Folge: ein Attributfilter am Selektor
    const attr = w.findAll('select.attr').at(-1)
    assert.equal(w.findAll('.sel input.wert').length, 0)
    await attr.setValue('leistung')
    const wert = w.findAll('.sel input.wert').at(-1)
    await wert.setValue('850')
    await speichern(w).trigger('click'); await flushPromises()
    const put = s.gesendet.find(g => g.method === 'PUT').body.rules[0]
    assert.deepEqual(put.if, { kind: 'balance', resource: 'pci_slot', comparison: '<=', value: 0 })
    assert.deepEqual(put.then.selector, { node: 'gk2', attribute: 'leistung', comparison: '=', value: '850' })
  } finally { w.unmount(); s.ende() }
})

test('verknüpfte Bedingungen tragen Teilbedingungen, die sich hinzufügen und entfernen lassen', async () => {
  const s = welt()
  const w = mount(View); await flushPromises()
  try {
    await oeffnen(w)
    await w.find('.umschalten').trigger('click')
    await w.find('select.kind').setValue('and')
    assert.equal(w.findAll('.cond .teil').length, 1)
    await w.find('.cond .plus').trigger('click')
    assert.equal(w.findAll('.cond .teil').length, 2)
    await w.findAll('.cond .teil .x')[0].trigger('click')
    assert.equal(w.findAll('.cond .teil').length, 1)
    assert.equal(w.findAll('.cond .teil .x').length, 0, 'die letzte Teilbedingung bleibt')
  } finally { w.unmount(); s.ende() }
})

test('eine Regel ohne Bedingung: „wenn“ ausschalten macht sie zur Regel, die immer gilt; Folge und Reihenfolge ändern sich', async () => {
  const defs = { server: { label: 'Server', rules: [REGEL, { id: 'zwei', then: { kind: 'forbids', selector: { node: 'k1' } } }] } }
  const s = welt({ defs })
  const w = mount(View); await flushPromises()
  try {
    await oeffnen(w)
    await w.find('.umschalten').trigger('click')
    await w.findAll('input[type=checkbox]')[0].setValue(false)
    assert.match(w.findAll('.satz')[0].text(), /^Immer: Grafikkarten-Kühler 2 verboten/)
    // Folge: begrenzt auf höchstens 3
    await w.findAll('select.folge')[0].setValue('limits')
    await w.findAll('.zeile input.zahl')[0].setValue(3)
    assert.match(w.findAll('.satz')[0].text(), /^Immer: höchstens 3 von Grafikkarten-Kühler 2/, 'der Knoten bleibt beim Wechsel der Folge')
    // nach unten
    await w.findAll('.kopf .x')[1].trigger('click')    // „nach unten“ der ersten Regel
    assert.deepEqual(ids(w), ['zwei', 'k1-gk2'])
    // entfernen
    await w.findAll('.kopf .x')[2].trigger('click')    // „Regel entfernen“ der ersten (zwei)
    assert.deepEqual(ids(w), ['k1-gk2'])
  } finally { w.unmount(); s.ende() }
})

test('einen Konfigurator anlegen: der Schlüssel muss gültig und frei sein; die Definition beginnt leer', async () => {
  const s = welt()
  const w = mount(View); await flushPromises()
  try {
    const knopf = () => w.find('form.neu button')
    const feld = w.find('form.neu input')
    for (const schlecht of ['', 'Server', '1pc', 'server']) { await feld.setValue(schlecht); assert.ok(knopf().attributes('disabled') !== undefined, `„${schlecht}“ ist kein freier Schlüssel`) }
    await feld.setValue('pc-1')
    assert.equal(knopf().attributes('disabled'), undefined)
    await w.find('form.neu').trigger('submit'); await flushPromises()
    const put = s.gesendet.find(g => g.method === 'PUT')
    assert.equal(put.p, '/api/plugins/configurator/data/def:pc-1')
    assert.deepEqual(put.body, { label: 'pc-1', rules: [] })
    assert.ok(w.findAll('tbody tr').some(r => r.text().includes('pc-1')), 'steht in der Liste')
    assert.equal(w.find('.bez').element.value, 'pc-1', 'und ist geöffnet')
  } finally { w.unmount(); s.ende() }
})

test('einen Konfigurator entfernen nimmt seine Definition und seine Testfälle aus den Plugin-Daten', async () => {
  const s = welt({ cases: { 'case:server:a': { label: 'A', selection: [], expect: {} }, 'case:server:b': { label: 'B', selection: [], expect: {} }, 'case:anderer:c': {} } })
  const w = mount(View); await flushPromises()
  try {
    await oeffnen(w)
    dialog.confirm = async () => false
    await w.find('.kopf button:last-of-type').trigger('click'); await flushPromises()
    assert.deepEqual(s.gesendet.filter(g => g.method === 'DELETE'), [], 'abgelehnt: nichts gelöscht')
    dialog.confirm = async o => { assert.match(o.text, /Server/); return true }
    await w.find('.kopf button:last-of-type').trigger('click'); await flushPromises()
    assert.deepEqual(s.gesendet.filter(g => g.method === 'DELETE').map(g => g.p).sort(), ['/api/plugins/configurator/data/case:server:a', '/api/plugins/configurator/data/case:server:b', '/api/plugins/configurator/data/def:server'])
    assert.equal(Object.keys(s.cases).includes('case:anderer:c'), true, 'Testfälle eines anderen Konfigurators bleiben')
    assert.match(w.text(), /Einen Konfigurator wählen oder anlegen/)
  } finally { w.unmount(); s.ende() }
})

test('was der Server an der Definition bemängelt, steht über den Regeln', async () => {
  const s = welt({ errors: ['Regel k1-gk2: Folge ohne Selektor.'] })
  const w = mount(View); await flushPromises()
  try {
    await oeffnen(w)
    assert.match(w.find('ul.fehler').text(), /Regel k1-gk2: Folge ohne Selektor\./)
  } finally { w.unmount(); s.ende() }
})

// ---- Beispiele prüfen

const KANDIDATEN = [
  { id: 'p1', name: 'CPU-Kühler 1', keys: { artikelnr: 'SKU-k1' }, ok: true, reasons: [] },
  { id: 'p2', name: 'Grafikkarten-Kühler 2', keys: { artikelnr: 'SKU-gk2' }, ok: false, reasons: [{ kind: 'rule', text: 'CPU-Kühler 1 passt nicht zum Grafikkarten-Kühler 2', affects: ['SKU-k1'], rule: 'k1-gk2' }] },
]
/// Ein Server, der gewählte SKU kennt und die Regel anwendet: K1 und GK2 zusammen sind unzulässig
const pruefen = body => {
  const ids = body.selection.map(s => s.id)
  const schlecht = ids.includes('SKU-k1') && ids.includes('SKU-gk2')
  return {
    valid: !schlecht, complete: true,
    selection: body.selection.map(s => ({ ref: s.id, id: 'p-' + s.id, name: 'Teil ' + s.id, amount: s.amount })),
    violations: schlecht ? [{ kind: 'rule', text: 'CPU-Kühler 1 passt nicht zum Grafikkarten-Kühler 2', affects: ['SKU-k1', 'SKU-gk2'], rule: 'k1-gk2' }] : [],
    missing: [], balance: { pci_slot: { provided: 3, consumed: ids.length, free: 3 - ids.length } }, selectable: KANDIDATEN,
  }
}

async function pruefTab(w) { await w.findAll('.tabs button').find(b => b.text().includes('Prüfen')).trigger('click'); await warte() }

test('Prüfen: die Auswahl geht an den Endpunkt, das Ergebnis zeigt zulässig, Verstösse, Bilanz und die wählbaren Teile mit Grund', async () => {
  const s = welt({ check: pruefen })
  const w = mount(View); await flushPromises()
  try {
    await oeffnen(w); await pruefTab(w)
    let post = s.gesendet.filter(g => g.p.endsWith('/check')).at(-1)
    assert.equal(post.p, '/api/configurator/server/check')
    assert.deepEqual(post.body, { selection: [], selectable: true })
    assert.match(w.text(), /Noch nichts gewählt/)

    // zwei Teile über ihre SKU wählen, wie ein Shop sie schickt
    await w.find('form.eingabe input').setValue('SKU-k1'); await w.find('form.eingabe').trigger('submit')
    await w.find('form.eingabe input').setValue('SKU-gk2'); await w.find('form.eingabe').trigger('submit'); await warte()
    post = s.gesendet.filter(g => g.p.endsWith('/check')).at(-1)
    assert.deepEqual(post.body.selection, [{ id: 'SKU-k1', amount: 1 }, { id: 'SKU-gk2', amount: 1 }])
    const text = w.text().replace(/\s+/g, ' ')
    assert.match(text, /✗ unzulässig/); assert.match(text, /✓ vollständig/)
    assert.match(w.find('ul.meldungen').text(), /CPU-Kühler 1 passt nicht zum Grafikkarten-Kühler 2/)
    assert.match(w.find('ul.meldungen').text(), /Teil SKU-k1, Teil SKU-gk2/, 'die betroffenen Teile mit ihren Namen')
    assert.deepEqual(w.findAll('table.bilanz tbody td').map(td => td.text()), ['pci_slot', '3', '2', '1'])

    // wählbar: das zweite Teil ist gesperrt, der Grund steht dran
    const zeilen = w.findAll('.waehlbar tbody tr')
    assert.equal(zeilen.length, 2)
    assert.ok(zeilen[1].classes().includes('gesperrt'))
    assert.match(zeilen[1].attributes('title'), /passt nicht/)
    assert.ok(!zeilen[0].classes().includes('gesperrt'))
  } finally { w.unmount(); s.ende() }
})

test('Prüfen: ein wählbares Teil anklicken fügt es der Auswahl hinzu, ein gesperrtes nicht; eine Menge ändert die Anfrage', async () => {
  const s = welt({ check: pruefen })
  const w = mount(View); await flushPromises()
  try {
    await oeffnen(w); await pruefTab(w)
    await w.findAll('.waehlbar tbody tr')[1].trigger('click'); await warte()
    assert.equal(w.findAll('.auswahl tbody tr').length, 0, 'ein gesperrtes Teil kommt nicht dazu')
    await w.findAll('.waehlbar tbody tr')[0].trigger('click'); await warte()
    assert.equal(s.gesendet.filter(g => g.p.endsWith('/check')).at(-1).body.selection[0].id, 'p1')
    await w.find('.auswahl input.zahl').setValue(3); await warte()
    assert.deepEqual(s.gesendet.filter(g => g.p.endsWith('/check')).at(-1).body.selection, [{ id: 'p1', amount: 3 }])
    await w.find('.auswahl .x').trigger('click'); await warte()
    assert.deepEqual(s.gesendet.filter(g => g.p.endsWith('/check')).at(-1).body.selection, [])
  } finally { w.unmount(); s.ende() }
})

test('Prüfen: ein Fehler des Servers steht da, ungespeicherte Änderungen werden gemeldet', async () => {
  const s = welt({ check: () => { throw new Error('Konfigurator server hat Fehler: Regel x: Folge fehlt.') } })
  const w = mount(View); await flushPromises()
  try {
    await oeffnen(w)
    await w.find('.neue-regel').trigger('click')                                     // etwas ändern
    await pruefTab(w)
    assert.match(w.find('.fehler').text(), /Folge fehlt/)
    assert.match(w.text(), /Ungespeicherte Änderungen — geprüft wird der gespeicherte Stand/)
  } finally { w.unmount(); s.ende() }
})

// ---- Testfälle

test('Testfälle: die Auswahl mit dem jetzigen Ergebnis merken, laden, und alle gegen die Regeln prüfen', async () => {
  const s = welt({ check: pruefen })
  const w = mount(View); await flushPromises()
  try {
    await oeffnen(w); await pruefTab(w)
    await w.find('form.eingabe input').setValue('SKU-k1'); await w.find('form.eingabe').trigger('submit')
    await w.find('form.eingabe input').setValue('SKU-gk2'); await w.find('form.eingabe').trigger('submit'); await warte()

    const name = w.find('.faelle .kopf input')
    assert.ok(w.find('.faelle .kopf button').attributes('disabled') !== undefined, 'ohne Namen kein Testfall')
    await name.setValue('K1 mit GK2'); await w.find('.faelle .kopf button').trigger('click'); await flushPromises()
    const put = s.gesendet.find(g => g.method === 'PUT' && g.p.includes('case:'))
    assert.equal(put.p, '/api/plugins/configurator/data/case:server:k1-mit-gk2')
    assert.deepEqual(put.body, { label: 'K1 mit GK2', selection: [{ id: 'SKU-k1', amount: 1 }, { id: 'SKU-gk2', amount: 1 }], expect: { valid: false, complete: true, violations: ['rule:k1-gk2'], missing: [] } })
    assert.equal(w.findAll('.faelle table tbody tr').length, 1, 'steht in der Liste')

    // alle prüfen: stimmt
    await w.findAll('.faelle .kopf button')[1].trigger('click'); await flushPromises()
    assert.match(w.find('.faelle .kopf').text(), /1\/1/)
    assert.equal(w.find('.faelle table td').text(), '✓')
  } finally { w.unmount(); s.ende() }
})

test('Testfälle: weicht das Ergebnis von der Erwartung ab, zeigt der Fall ✗ und was abweicht; ⤓ lädt seine Auswahl in die Prüfung', async () => {
  const s2 = welt({ check: pruefen, cases: { 'case:server:alt': { label: 'Alt', selection: [{ id: 'SKU-k1', amount: 1 }, { id: 'SKU-gk2', amount: 1 }], expect: { valid: true, complete: true, violations: [], missing: [] } } } })
  const w2 = mount(View); await flushPromises()
  try {
    await oeffnen(w2); await pruefTab(w2)
    await w2.findAll('.faelle .kopf button')[1].trigger('click'); await flushPromises()
    assert.equal(w2.find('.faelle table td').text(), '✗')
    const diff = w2.find('.faelle .diff').text()
    assert.match(diff, /zulässig: erwartet ja, ist nein/)
    assert.match(diff, /Verstoss rule:k1-gk2 ist neu/)
    assert.match(w2.find('.faelle .kopf').text(), /0\/1/)
    // laden: die Auswahl kommt in die Prüfung zurück
    await w2.find('.faelle table .x').trigger('click'); await warte()
    assert.equal(w2.findAll('.auswahl tbody tr').length, 2)
  } finally { w2.unmount(); s2.ende() }
})

// ---- einfache Regeln als Satz, Vorlagen, Erklärung

test('eine einfache Regel steht als Satz mit Auswahlfeldern; „technisch“ zeigt dieselbe Regel mit allen Feldern und „einfach“ geht zurück', async () => {
  const s = welt()
  const w = mount(View); await flushPromises()
  try {
    await oeffnen(w)
    const satz = () => satzText(w.find('.satz-regel'))
    assert.equal(satz(), 'Wenn CPU-Kühler 1 gewählt ist, darf Grafikkarten-Kühler 2 nicht gewählt sein.')
    assert.ok(!w.find('select.kind').exists(), 'kein technischer Editor')
    assert.equal(w.find('.umschalten').text(), 'technisch')
    await w.find('.umschalten').trigger('click')
    assert.ok(w.find('select.kind').exists() && !w.find('.satz-regel').exists())
    assert.equal(w.find('.umschalten').text(), 'einfach')
    await w.find('.umschalten').trigger('click')
    assert.ok(w.find('.satz-regel').exists())
  } finally { w.unmount(); s.ende() }
})

test('Vorlagen: „passt nicht zusammen“, „braucht“, „höchstens“ und „mindestens“ legen eine Regel mit leeren Teilen an, die als Satz zu füllen ist', async () => {
  const s = welt({ defs: { server: { label: 'Server', rules: [] } } })
  const w = mount(View); await flushPromises()
  try {
    await oeffnen(w)
    for (const k of ['excludes', 'needs', 'max', 'min']) await w.find('.vorlage.v-' + k).trigger('click')
    assert.deepEqual(ids(w), ['r1', 'r2', 'r3', 'r4'])
    const saetze = w.findAll('.satz-regel').map(satzText)
    assert.deepEqual(saetze, [
      'Wenn Teil wählen … gewählt ist, darf Teil wählen … nicht gewählt sein.',
      'Wenn Teil wählen … gewählt ist, müssen mindestens 1 von Teil wählen … gewählt sein.',
      'Von Teil wählen … dürfen höchstens 1 gewählt sein.',
      'Von Teil wählen … müssen mindestens 1 gewählt sein.',
    ])
    await speichern(w).trigger('click'); await flushPromises()
    const regeln = s.gesendet.find(g => g.method === 'PUT').body.rules
    assert.deepEqual(regeln[0].if, { kind: 'has', selector: {}, value: 1 }); assert.deepEqual(regeln[0].then, { kind: 'forbids', selector: {} })
    assert.deepEqual(regeln[1].then, { kind: 'requires', selector: {}, min: 1 })
    assert.deepEqual(regeln[2].then, { kind: 'limits', selector: {}, max: 1 }); assert.equal(regeln[2].if, undefined)
    assert.deepEqual(regeln[3].then, { kind: 'requires', selector: {}, min: 1 })
    assert.ok(regeln.every(r => r.text), 'jede Regel hat eine Meldung')
  } finally { w.unmount(); s.ende() }
})

test('im Satz lassen sich Mengen ändern; „braucht“ trägt seine Menge in die Folge', async () => {
  const s = welt({ defs: { server: { label: 'Server', rules: [] } } })
  const w = mount(View); await flushPromises()
  try {
    await oeffnen(w)
    await w.find('.vorlage.v-needs').trigger('click'); await w.find('.vorlage.v-max').trigger('click')
    await w.findAll('.satz-regel')[0].find('input.zahl').setValue(2)
    await w.findAll('.satz-regel')[1].find('input.zahl').setValue(4)
    await speichern(w).trigger('click'); await flushPromises()
    const regeln = s.gesendet.find(g => g.method === 'PUT').body.rules
    assert.equal(regeln[0].then.min, 2); assert.equal(regeln[1].then.max, 4)
  } finally { w.unmount(); s.ende() }
})

test('eine Regel mit Summe, Bilanz oder Verknüpfung hat keine einfache Form: sie zeigt gleich den technischen Editor, ohne Umschalter', async () => {
  const regel = { id: 's', then: { kind: 'forbids', selector: { node: 'gk2' } }, if: { kind: 'sum', selector: { node: 'k1' }, attribute: 'leistung', comparison: '>', value: 500 } }
  const s = welt({ defs: { server: { label: 'Server', rules: [regel] } } })
  const w = mount(View); await flushPromises()
  try {
    await oeffnen(w)
    assert.ok(w.find('select.kind').exists()); assert.ok(!w.find('.satz-regel').exists()); assert.ok(!w.find('.umschalten').exists())
    // die Regel mit „hat“ und Menge 3 ist auch keine einfache: „mindestens 3 × A“ gibt der Satz nicht her
    const drei = { id: 'd', then: { kind: 'forbids', selector: { node: 'gk2' } }, if: { kind: 'has', selector: { node: 'k1' }, value: 3 } }
    s.defs.server = { label: 'Server', rules: [drei] }
    await oeffnen(w)
    assert.ok(!w.find('.satz-regel').exists())
  } finally { w.unmount(); s.ende() }
})

test('Ungespeichert ist, was vom gespeicherten Stand abweicht: wer eine Änderung zurücknimmt, hat nichts mehr zu speichern', async () => {
  const s = welt()
  const w = mount(View); await flushPromises()
  try {
    await oeffnen(w)
    assert.ok(speichern(w).attributes('disabled') !== undefined)
    await w.find('.bez').setValue('Server 2'); assert.equal(speichern(w).attributes('disabled'), undefined)
    await w.find('.bez').setValue('Server'); assert.ok(speichern(w).attributes('disabled') !== undefined, 'wieder wie gespeichert')
    await w.find('.umschalten').trigger('click')
    assert.ok(speichern(w).attributes('disabled') !== undefined, 'die Ansicht (einfach oder technisch) ist keine Änderung')
  } finally { w.unmount(); s.ende() }
})

test('die Erklärung ist offen, solange es keine Regel gibt, und danach zu', async () => {
  const leer = welt({ defs: { server: { label: 'Server', rules: [] } } })
  const w1 = mount(View); await flushPromises()
  try { await oeffnen(w1); assert.ok(w1.find('details.hilfe').element.open); assert.match(w1.find('details.hilfe').text(), /Steckplätze, Mengen und Werte brauchen keine Regel/) } finally { w1.unmount(); leer.ende() }
  const s = welt()
  const w2 = mount(View); await flushPromises()
  try { await oeffnen(w2); assert.ok(!w2.find('details.hilfe').element.open) } finally { w2.unmount(); s.ende() }
})

// ---- der Auswahlbaum schwebt über der Seite

const STUB = { global: { stubs: { TreePicker: { template: '<div class="tp-stub">Baum</div>' } } }, attachTo: document.body }
const popovers = () => [...document.querySelectorAll('.popover')]
const maus = (el) => el.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true, cancelable: true }))

test('der Auswahlbaum hängt am Ende des Dokuments und liegt fest an der Schaltfläche: eine Bildlaufleiste schneidet ihn nicht ab', async () => {
  const s = welt({ defs: { server: { label: 'Server', rules: [] } } })
  const w = mount(View, STUB); await flushPromises()
  try {
    await oeffnen(w); await w.find('.vorlage.v-excludes').trigger('click')
    const knopf = w.find('.satz-regel .knoten')
    knopf.element.getBoundingClientRect = () => ({ left: 120, right: 200, top: 100, bottom: 124, width: 80, height: 24 })
    await knopf.trigger('click'); await flushPromises()
    assert.equal(popovers().length, 1)
    assert.equal(popovers()[0].parentElement, document.body, 'nicht im Bereich der Regeln, sondern am Dokument')
    assert.equal(w.find('.popover').exists(), false, 'und damit ausserhalb des Bereichs, der scrollt')
    const st = popovers()[0].style
    assert.equal(st.left, '120px'); assert.equal(st.top, '128px', 'unter der Schaltfläche')
    assert.ok(popovers()[0].querySelector('.tp-stub'))
  } finally { w.unmount(); s.ende() }
  assert.equal(popovers().length, 0, 'mit der Ansicht ist er weg')
})

test('Der Auswahlbaum klappt nach oben, wo unten kein Platz ist', async () => {
  const s = welt({ defs: { server: { label: 'Server', rules: [] } } })
  const w = mount(View, STUB); await flushPromises()
  try {
    await oeffnen(w); await w.find('.vorlage.v-max').trigger('click')
    const knopf = w.find('.satz-regel .knoten')
    const h = window.innerHeight
    knopf.element.getBoundingClientRect = () => ({ left: 40, right: 120, top: h - 60, bottom: h - 36, width: 80, height: 24 })
    await knopf.trigger('click'); await flushPromises()
    const st = popovers()[0].style
    assert.equal(st.bottom, (60 + 4) + 'px'); assert.equal(st.top, '', 'oben statt unten')
  } finally { w.unmount(); s.ende() }
})

test('Ein Klick daneben und Esc schliessen den Auswahlbaum, ein Klick darin nicht; die Schaltfläche schaltet um', async () => {
  const s = welt({ defs: { server: { label: 'Server', rules: [] } } })
  const w = mount(View, STUB); await flushPromises()
  try {
    await oeffnen(w); await w.find('.vorlage.v-min').trigger('click')
    const knopf = w.find('.satz-regel .knoten')
    await knopf.trigger('click'); await flushPromises(); assert.equal(popovers().length, 1)
    maus(popovers()[0].querySelector('.tp-stub')); await flushPromises(); assert.equal(popovers().length, 1, 'ein Klick im Baum lässt ihn offen')
    maus(document.body); await flushPromises(); assert.equal(popovers().length, 0, 'daneben: zu')
    await knopf.trigger('click'); await flushPromises(); assert.equal(popovers().length, 1)
    document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await flushPromises(); assert.equal(popovers().length, 0, 'Esc: zu')
    await knopf.trigger('click'); await flushPromises(); assert.equal(popovers().length, 1)
    await knopf.trigger('click'); await flushPromises(); assert.equal(popovers().length, 0, 'noch ein Klick auf die Schaltfläche: zu')
  } finally { w.unmount(); s.ende() }
})
