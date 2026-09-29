// ▦ Werte aus dem Dokument (27.09.2026, 34 L; Text gegen das Modell 28.09.2026): der Dialog am Knoten. Zwei Quellen in
// einer Liste — Tabellen (Schlüssel/Wert, der Mapper schlägt das Attribut vor: gefunden, neu oder nichts) und der Text
// gegen die Attribute, die hier gelten (KI: Wert, Seite, Stelle, Sicherheit). Geschrieben wird erst mit ✓, und dann in
// der Reihenfolge Modell (neue Attribute, Gruppe „aus Dokument“) → Gruppe an den Knoten → ein Stapel: je Wert
// attribute.set und der Beleg dazu. Ein noch nicht gelesenes Dokument: der Dialog stösst den Job an und wartet.
// Zwei Wege hinein: Strg beim Ablegen, und der Rechtsklick auf ein Asset im Band — eines oder mehrere gewählte.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'
import { ai } from '../src/ai.js'
import { menu } from '../src/menu.js'

const DocTables = (await import('../src/components/DocTables.vue')).default
const NodeView = (await import('../src/views/NodeView.vue')).default

const MODELL = {
  masterLocale: 'de', locales: [{ code: 'de' }], channels: [{ key: 'web' }], statuses: [], views: [], families: [],
  // eine Werteliste, deren Werte Sätze sind — die „Wörterbuchgruppe“ Funkentstörung
  lists: [{ key: 'emc', label: { de: 'Funkentstörung' }, closed: false, values: [{ value: 'nicht_kreuzen', label: { de: 'Netzleitung und Lampenleitung nicht kreuzen.' } }] }],
  groups: [{ key: 'physical', label: { de: 'Physisch' } }, { key: 'from_document', label: { de: 'aus Dokument' } }],
  units: [{ key: 'kg', label: { de: 'Kilogramm' } }, { key: 'mm', label: { de: 'Millimeter' } }, { key: 'W', label: { de: 'Watt' } }],
  attributes: [
    { key: 'weight', label: { de: 'Gewicht' }, type: 'decimal', unit: 'kg', group: 'physical' },
    { key: 'name', label: { de: 'Name' }, type: 'text', group: 'physical', perLocale: true },
    { key: 'power', label: { de: 'Leistung' }, type: 'integer', unit: 'W', group: 'physical' },
    { key: 'ip', label: { de: 'Schutzart' }, type: 'text', group: 'other' },   // gilt hier nicht — die Gruppe hängt nicht am Pfad
    { key: 'hints', label: { de: 'Hinweise' }, type: 'html', group: 'physical', perLocale: true },   // ein Textattribut für Bausteine
    { key: 'emc', label: { de: 'Funkentstörung' }, type: 'enum', list: 'emc', multiple: true, group: 'physical' },   // die Sätze als Auswahl
    { key: 'sku', label: { de: 'Artikelnummer' }, type: 'text', group: 'physical', unique: true },
    { key: 'ean', label: { de: 'EAN' }, type: 'text', group: 'physical' },
  ],
  relationTypes: [{ key: 'document', label: { de: 'Dokument' }, to: ['media'], group: 'relation_media' }, { key: 'image', label: { de: 'Bild' }, to: ['media'], group: 'relation_media' }],
}
const KNOTEN = { id: 'p1', role: 'product', label: {}, values: [], status: 'draft', children: 0, axes: [], groups: [{ key: 'physical', from: 'g1', fromLabel: 'Mastertree', active: true, attributes: ['weight', 'name', 'power', 'sku', 'ean'] }], attachedGroups: [], ancestors: [{ id: 'g1', role: 'group', label: 'Mastertree', values: [] }] }
const TABELLEN = { ready: true, state: 'text', tables: [{ seq: 0, page: 1, heading: 'Technische Daten', rows: [['Gewicht', '1,2 kg'], ['Durchmesser', '22 mm'], ['Farbe', 'blau'], ['Seite 1 von 3']] }] }
// Seite 1 ohne Überschrift: die erste Überschrift würde sonst in jedem Test als Name vorgeschlagen
const TEXT = { ready: true, state: 'text', chunks: [{ seq: 0, page: 1, heading: null, body: 'Gewicht 1,2 kg' }, { seq: 1, page: 2, heading: null, body: 'Nennleistung 35 W bei 230 V' },
  { seq: 2, page: 2, heading: 'Funkentstörung', body: '• Netzleitung und Lampenleitung nicht kreuzen.\n• Lampenleitungen verdrillen.' }, { seq: 3, page: 3, heading: 'Funkentstörung', body: '• Netzleitung in der Leuchte kurz halten.' },
  { seq: 4, page: 3, heading: 'Montage', body: 'Das Gerät wird mit zwei Schrauben auf einer ebenen Fläche befestigt. Die Zuleitung ist zugentlastet zu führen.' }] }
// ohne Bausteine — der Standard: ein Baustein ist angehakt (vorhandenes wie neues Attribut), jeder Wertetest zählte einen mehr
const TEXT_BASIS = { ...TEXT, chunks: TEXT.chunks.filter(c => !c.heading) }
// mit Zeilen, die ein Attribut treffen — nur für die Tests, die das prüfen; sonst zählte jeder Test einen Wert mehr
const TEXT_ZEILEN = { ...TEXT, chunks: [...TEXT.chunks,
  { seq: 5, page: 1, heading: 'Technische Daten', body: 'Leistung  35 W\nNetzspannungsbereich  220 – 240 V\nGewicht  pro Stk.' },
  { seq: 6, page: 4, heading: null, body: 'Nennmasse: 1,5 kg' },
  // der Kopf ist umgebrochen wie im echten Datenblatt: die Wertzeile kommt Zeilen später
  { seq: 7, page: 2, heading: 'Bestelldaten', body: 'Typ  Artikelnummer\nVerpackung\nKarton\nGewicht\npro Stk.\nFür Leuchten mit 1 Lampe\nPCI 20 MINI Q211  24166386  40 Stk.  0,105 kg\nEAN 4006381333931\nUmgebungstemperatur ta  tc/ta für ≥' }] }
const KI = { items: [{ key: 'power', value: '35', page: 2, quote: 'Nennleistung 35 W', confidence: 0.92 }, { key: 'ip', value: 'IP20', page: 2, quote: 'IP20', confidence: 0.8 }] }
const RELS = { out: [
  { id: 'r1', type: 'document', from: 'p1', to: 'm1', dir: 'out', other: { id: 'm1', role: 'media', label: 'datenblatt.pdf', mime: 'application/pdf' }, values: [], lastNumber: 1 },
  { id: 'r2', type: 'document', from: 'p1', to: 'm2', dir: 'out', other: { id: 'm2', role: 'media', label: 'massblatt.pdf', mime: 'application/pdf' }, values: [], lastNumber: 2 },
  { id: 'r3', type: 'image', from: 'p1', to: 'm3', dir: 'out', other: { id: 'm3', role: 'media', label: 'foto.jpg', mime: 'image/jpeg', isImage: true }, values: [], lastNumber: 3 },
], in: [], inherited: [] }

function welt({ tabellen = TABELLEN, text = TEXT_BASIS, jobs = [{ key: 'lesen', plugin: 'docs', enabled: true }], ki = null, rels = { out: [], in: [], inherited: [] }, knoten = KNOTEN, suche = { ready: true, hits: [] }, lokal = false } = {}) {
  store.actor = 'u1'; store.toasts = []; store.model = MODELL; store.pendingDocTables = null; store.poll = async () => {}
  // die Knotenansicht misst Spaltenbreiten am Canvas — happy-dom hat keines
  globalThis.HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: s => ({ width: String(s).length * 7 }) })
  tree.byId = new Map([['p1', { id: 'p1', role: 'product', label: 'Bohrer', parent: null, axes: [] }]])
  tree.rows = [tree.byId.get('p1')]; tree.children = new Map([['', tree.rows]]); tree.loaded = true; tree.load = async () => {}
  // die KI: ohne Schlüssel aus; mit — sie antwortet, was der Test vorgibt, und der Test sieht, was gefragt wurde
  const fragen = []
  ai.available = () => !!ki
  ai.bezahlt = () => !lokal   // lokal: das Modell auf dem eigenen Server — kostet nichts, nicht magenta
  ai.ask = async args => { fragen.push(args); if (ki instanceof Error) throw ki; return ki }
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url); const methode = opt.method ?? 'GET'
    rufe.push({ pfad, methode, rumpf: typeof opt.body === 'string' ? JSON.parse(opt.body) : opt.body })
    const antwort = /\/api\/docs\/[^/]+\/tables/.test(pfad) ? (typeof tabellen === 'function' ? tabellen() : tabellen)
      : /\/api\/docs\/[^/]+\/text/.test(pfad) ? text
      : /\/api\/docs\/search/.test(pfad) ? (typeof suche === 'function' ? suche(pfad) : suche)
      : /\/api\/jobs$/.test(pfad) ? jobs
      : /\/api\/batch/.test(pfad) ? { batch: 'b-1', results: opt.body ? JSON.parse(opt.body).commands.map((c, i) => ({ index: i })) : [], error: null }
      : /\/api\/media$/.test(pfad) && methode === 'POST' ? { id: 'm-' + rufe.length, existed: false }
      : /\/relations$/.test(pfad) && methode === 'POST' ? { stream: 'r-1' }
      : /\/relations/.test(pfad) ? rels
      : /\/api\/streams\//.test(pfad) || /\/workflow$/.test(pfad) ? []
      : /\/api\/model/.test(pfad) ? MODELL
      : /\/api\/plugins/.test(pfad) ? []
      : /\/nodes\/p1$/.test(pfad) ? knoten
      : /\/nodes\/g1$/.test(pfad) ? { id: 'g1', role: 'group', label: 'Mastertree', attachedGroups: ['physical'] }
      : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return { rufe, fragen }
}

/// Die KI läuft erst auf Knopfdruck: mit KI-Vorgabe drückt der Helfer ihn (kiKlick: false lässt es)
const kiKnopf = w => w.findAll('button').find(b => b.text().includes('KI fragen'))
async function dialog(opt = {}) {
  const { rufe, fragen } = welt(opt)
  const w = mount(DocTables, { props: { node: opt.knoten ?? KNOTEN, media: opt.media ?? ['m1'], names: opt.names ?? { m1: 'datenblatt.pdf' } } })
  await flushPromises()
  if (opt.ki && opt.kiKlick !== false) { await kiKnopf(w).trigger('click'); await flushPromises() }
  return { w, rufe, fragen }
}
const zeile = (w, key) => w.findAll('tbody tr').find(tr => tr.find('td:nth-child(2)').exists() && tr.find('td:nth-child(2)').text().startsWith(key))   // die Bandzeile der Bausteine hat nur eine Zelle
const stapel = rufe => rufe.find(r => /\/api\/batch/.test(r.pfad)).rumpf.commands
const werte = rufe => stapel(rufe).filter(c => c.op === 'attribute.set').map(c => [c.args.attribute, c.args.value])

// ── Tabellen ─────────────────────────────────────────────────────────────────────────────────────────────────

test('die Zeilen der Tabelle mit dem Vorschlag: gefunden, neu mit Einheit, neu als Text — eine Zeile ohne Wert fehlt', async () => {
  const { w } = await dialog()
  const rows = w.vm.werte
  assert.equal(rows.length, 3, 'drei Zeilen Schlüssel/Wert; „Seite 1 von 3“ hat keinen Wert')
  const gewicht = rows.find(r => r.key === 'Gewicht'), dm = rows.find(r => r.key === 'Durchmesser'), farbe = rows.find(r => r.key === 'Farbe')
  assert.deepEqual([gewicht.target, gewicht.attribute, gewicht.converted], ['attr', 'weight', '1.2'], 'Gewicht ist das Attribut weight, der Wert ohne Einheit')
  assert.deepEqual([dm.target, dm.newKey, dm.newType, dm.unit, dm.converted], ['new', 'durchmesser', 'integer', 'mm', '22'])
  assert.deepEqual([farbe.target, farbe.newKey, farbe.newType, farbe.converted], ['new', 'farbe', 'text', 'blau'])
  assert.ok(rows.every(r => r.take), 'alle drei sind angehakt')
  assert.ok(rows.every(r => r.quelle === 'tabelle'))
  assert.match(w.find('.dt-foot .primary').text(), /3/)
  assert.equal(w.vm.warten, false)
  // im DOM steht der Schlüssel aus dem Dokument, und das Ziel ist gewählt
  assert.equal(zeile(w, 'Gewicht').find('select').element.value, 'weight')
  assert.equal(zeile(w, 'Durchmesser').find('select').element.value, '+')
  assert.match(zeile(w, 'Gewicht').find('td.quelle').text(), /▦ S\. 1/)
})

test('✓ schreibt: erst die neuen Attribute in die Gruppe „aus Dokument“, dann die Gruppe an den Knoten, dann ein Stapel', async () => {
  const { w, rufe } = await dialog()
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  const puts = rufe.filter(r => r.methode === 'PUT' && /\/api\/model\/attributes\//.test(r.pfad))
  assert.deepEqual(puts.map(r => r.pfad.split('/').at(-1)).sort(), ['durchmesser', 'farbe'])
  const dm = puts.find(r => r.pfad.endsWith('/durchmesser')).rumpf
  assert.deepEqual({ type: dm.type, unit: dm.unit, group: dm.group, label: dm.label }, { type: 'integer', unit: 'mm', group: 'from_document', label: { de: 'Durchmesser' } })
  const gruppen = rufe.find(r => r.methode === 'PUT' && /\/nodes\/p1\/groups$/.test(r.pfad))
  assert.ok(gruppen, 'die Gruppe kommt an den Knoten — am Pfad gilt sie noch nicht')
  assert.deepEqual(gruppen.rumpf.groups, ['from_document'])
  const b = rufe.find(r => /\/api\/batch/.test(r.pfad))
  assert.ok(b); assert.match(b.pfad, /skipErrors=true/)
  assert.deepEqual(werte(rufe), [['weight', '1.2'], ['durchmesser', '22'], ['farbe', 'blau']])
  // Reihenfolge: Modell vor Gruppe vor Stapel
  const at = re => rufe.findIndex(r => re.test(r.pfad) && r.methode !== 'GET')
  assert.ok(at(/\/api\/model\/attributes\//) < at(/\/groups$/) && at(/\/groups$/) < at(/\/api\/batch/))
  assert.ok(w.emitted('done'), 'der Dialog meldet fertig')
  assert.match(store.toasts.at(-1)?.text ?? '', /3 Werte/)
})

test('jeder Wert bekommt seinen Beleg: das Dokument, die Seite, die Stelle', async () => {
  const { w, rufe } = await dialog()
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  const cmds = stapel(rufe)
  assert.deepEqual(cmds.map(c => c.op), ['attribute.set', 'value.source', 'attribute.set', 'value.source', 'attribute.set', 'value.source'], 'je Wert der Beleg direkt dahinter')
  const beleg = cmds[1].args
  assert.equal(beleg.attribute, 'weight')
  assert.equal(beleg.source, 'datenblatt.pdf', 'der Name des Dokuments, nicht seine Id')
  assert.equal(beleg.title, 'Seite 1')
  assert.equal(beleg.note, 'Technische Daten', 'die Überschrift der Tabelle ist die Stelle')
  assert.equal(beleg.method, 'import')
  assert.match(beleg.checkedAt, /^\d{4}-\d{2}-\d{2}$/)
})

test('neue Attribute in eine bestehende Gruppe, die hier schon gilt: keine Anlage, nichts hängt neu', async () => {
  const { w, rufe } = await dialog()
  assert.equal(w.vm.gruppe, 'from_document', 'Vorgabe: „aus Dokument“, weil es die Gruppe gibt')
  const wahl = w.find('.dt-foot select')
  assert.deepEqual(wahl.findAll('option').map(o => o.text()), ['▤ je Überschrift im Dokument', '▤ Physisch', '▤ aus Dokument', '+ neue Gruppe'], 'zuerst die Wahl, die je Überschrift eine Gruppe anlegt')
  await wahl.setValue('physical'); await flushPromises()
  assert.equal(w.findAll('.dt-foot select').length, 1, 'die Gruppe gilt hier — keine Ebene zu wählen')
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  const puts = rufe.filter(r => r.methode === 'PUT' && /\/api\/model\/attributes\//.test(r.pfad))
  assert.ok(puts.every(r => r.rumpf.group === 'physical'))
  assert.equal(rufe.filter(r => r.methode === 'PUT' && /\/api\/model\/groups\//.test(r.pfad)).length, 0, 'keine Gruppe angelegt')
  assert.equal(rufe.filter(r => r.methode === 'PUT' && /\/groups$/.test(r.pfad)).length, 0, 'nichts angehängt')
})

test('eine neue Gruppe, an der Ebene darüber: Gruppe anlegen, Attribute hinein, Gruppe an den Vorfahren', async () => {
  const { w, rufe } = await dialog()
  await w.find('.dt-foot select').setValue('+'); await flushPromises()
  await w.find('.dt-foot input.cell-input').setValue('Elektrik'); await flushPromises()
  const ebenen = w.findAll('.dt-foot select')[1]
  assert.deepEqual(ebenen.findAll('option').map(o => o.text()), ['▣ Mastertree', '▦ Bohrer'], 'der Pfad von der Wurzel bis hierher')
  assert.equal(ebenen.element.value, 'p1', 'Vorgabe: dieser Knoten')
  await ebenen.setValue('g1'); await flushPromises()
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  const gruppe = rufe.find(r => r.methode === 'PUT' && /\/api\/model\/groups\/elektrik$/.test(r.pfad))
  assert.ok(gruppe, 'die Gruppe wird angelegt'); assert.deepEqual(gruppe.rumpf.label, { de: 'Elektrik' })
  assert.ok(rufe.filter(r => r.methode === 'PUT' && /\/api\/model\/attributes\//.test(r.pfad)).every(r => r.rumpf.group === 'elektrik'))
  const dran = rufe.find(r => r.methode === 'PUT' && /\/nodes\/g1\/groups$/.test(r.pfad))
  assert.ok(dran, 'die Gruppe kommt an den Vorfahren'); assert.deepEqual(dran.rumpf.groups, ['physical', 'elektrik'], 'was dort schon hing, bleibt')
  assert.equal(rufe.filter(r => /\/nodes\/p1\/groups$/.test(r.pfad)).length, 0, 'nicht am Knoten selbst')
  const at = re => rufe.findIndex(r => re.test(r.pfad) && r.methode !== 'GET')
  assert.ok(at(/\/model\/groups\//) < at(/\/model\/attributes\//) && at(/\/model\/attributes\//) < at(/\/g1\/groups$/) && at(/\/g1\/groups$/) < at(/\/api\/batch/), 'Gruppe, Attribute, Anhängen, Stapel')
})

test('eine Zahl mit Einheit, die das Modell nicht kennt: Zahl mit neuer Einheit, angelegt beim ✓', async () => {
  const { w, rufe } = await dialog({ tabellen: { ready: true, state: 'text', tables: [{ seq: 0, page: 1, heading: null, rows: [['Betriebsfrequenz', '104 Hz'], ['Leistung', '20 W'], ['Farbe', 'blau']] }] } })
  const hz = w.vm.rows.find(r => r.key === 'Betriebsfrequenz'), w20 = w.vm.rows.find(r => r.key === 'Leistung')
  assert.deepEqual([hz.target, hz.newType, hz.unit, hz.unitNeu, hz.converted], ['new', 'integer', 'Hz', true, '104'], 'Hz ist neu — Zahl, nicht Text')
  assert.deepEqual([w20.target, w20.attribute, w20.converted], ['attr', 'power', '20'], 'W kennt das Modell, die Bezeichnung trifft power')
  assert.ok(zeile(w, 'Betriebsfrequenz').findAll('option').some(o => o.text() === 'Hz +'), 'die neue Einheit steht zur Wahl, gekennzeichnet')
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  const einheit = rufe.find(r => r.methode === 'PUT' && /\/api\/model\/units\/Hz$/.test(r.pfad))
  assert.ok(einheit, 'die Einheit wird angelegt'); assert.equal(einheit.rumpf.factor, 1)
  const attr = rufe.find(r => r.methode === 'PUT' && /\/api\/model\/attributes\/betriebsfrequenz$/.test(r.pfad))
  assert.deepEqual([attr.rumpf.type, attr.rumpf.unit], ['integer', 'Hz'])
  assert.ok(rufe.indexOf(einheit) < rufe.indexOf(attr), 'die Einheit vor dem Attribut')
})

test('„560 Stk.“: der Punkt gehört nicht zur Einheit — Zahl mit Einheit Stk', async () => {
  const { w } = await dialog({ tabellen: { ready: true, state: 'text', tables: [{ seq: 0, page: 1, heading: null, rows: [['Verpackung Palette', '560 Stk.'], ['a', '1'], ['b', '2']] }] } })
  const r = w.vm.rows.find(r => r.key === 'Verpackung Palette')
  assert.deepEqual([r.newType, r.unit, r.unitNeu, r.converted], ['integer', 'Stk', true, '560'])
})

test('eine Aufzählung wird eine Werteliste, mehrwertig — angelegt beim ✓ mit genau diesen Werten', async () => {
  const { w, rufe } = await dialog({ tabellen: { ready: true, state: 'text', tables: [{ seq: 0, page: 1, heading: null, rows: [['Normen', 'EN 55015, EN 61000-3-2, EN 61347-2-12, EN 61547'], ['a', '1'], ['b', '2']] }] } })
  const r = w.vm.rows.find(r => r.key === 'Normen')
  assert.deepEqual([r.target, r.newType, r.multiple, r.listValues.map(v => v.label)], ['new', 'enum', true, ['EN 55015', 'EN 61000-3-2', 'EN 61347-2-12', 'EN 61547']])
  assert.deepEqual(r.listValues.map(v => v.value), ['en_55015', 'en_61000_3_2', 'en_61347_2_12', 'en_61547'], 'je Wert ein Schlüssel aus dem Text')
  assert.match(zeile(w, 'Normen').text(), /≣ 4/)
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  const liste = rufe.find(x => x.methode === 'PUT' && /\/api\/model\/lists\/normen$/.test(x.pfad))
  assert.ok(liste, 'die Liste wird angelegt'); assert.deepEqual(liste.rumpf.label, { de: 'Normen' })
  const werte = rufe.find(x => x.methode === 'PUT' && /\/api\/model\/lists\/normen\/values$/.test(x.pfad))
  assert.deepEqual(werte.rumpf.map(v => [v.value, v.label.de]), [['en_55015', 'EN 55015'], ['en_61000_3_2', 'EN 61000-3-2'], ['en_61347_2_12', 'EN 61347-2-12'], ['en_61547', 'EN 61547']])
  const attr = rufe.find(x => x.methode === 'PUT' && /\/api\/model\/attributes\/normen$/.test(x.pfad))
  assert.deepEqual([attr.rumpf.type, attr.rumpf.list, attr.rumpf.multiple], ['enum', 'normen', true])
  assert.ok(rufe.indexOf(liste) < rufe.indexOf(werte) && rufe.indexOf(werte) < rufe.indexOf(attr), 'Liste, Werte, Attribut')
  const cmd = stapel(rufe).find(c => c.op === 'attribute.set' && c.args.attribute === 'normen')
  assert.equal(cmd.args.value, null); assert.deepEqual(cmd.args.values, ['en_55015', 'en_61000_3_2', 'en_61347_2_12', 'en_61547'], 'mehrwertig geht als values — die Schlüssel')
})

test('der Typ lässt sich von Hand auf enum stellen — und zurück', async () => {
  const { w } = await dialog()
  const z = zeile(w, 'Farbe')
  await z.findAll('select')[1].setValue('enum'); await flushPromises()
  const r = w.vm.rows.find(r => r.key === 'Farbe')
  assert.deepEqual([r.newType, r.multiple, r.listValues.map(v => [v.value, v.label])], ['enum', false, [['blau', 'blau']]], 'ein Wert — einwertige Liste')
  await z.findAll('select')[1].setValue('text'); await flushPromises()
  assert.deepEqual([r.newType, r.listValues, r.converted], ['text', null, 'blau'])
})

test('beim Öffnen wird das Modell frisch geholt — der zweite Lauf kennt die Attribute des ersten', async () => {
  const { rufe } = welt(); let geholt = 0; store.poll = async f => { if (f) geholt++ }
  mount(DocTables, { props: { node: KNOTEN, media: ['m1'] } }); await flushPromises()
  assert.equal(geholt, 1)
  assert.ok(rufe.length, 'und danach die Tabellen')
})

test('die Ebene nennt den Knoten mit seinem Anzeigenamen aus dem Baum — nicht das Label-Objekt der Ansicht', async () => {
  const { w } = await dialog()
  await w.find('.dt-foot select').setValue('+'); await flushPromises()
  assert.deepEqual(w.findAll('.dt-foot select')[1].findAll('option').map(o => o.text()), ['▣ Mastertree', '▦ Bohrer'])
})

test('was die bezahlte KI tut, ist magenta: die Quelle einer ✦-Zeile und der Lauf', async () => {
  const { w } = await dialog({ ki: KI })
  assert.ok(zeile(w, 'Leistung').find('td.quelle').classes('ai'), 'die ✦-Zeile')
  assert.ok(!zeile(w, 'Gewicht').find('td.quelle').classes('ai'), 'eine Tabellenzeile nicht')
})

test('hängt die Gruppe am Knoten selbst, bleibt die Ebene wählbar — eine Ebene darüber hängt sie dort an', async () => {
  // Der Fall vom 28.09.: „aus Dokument“ hing an der Variante; vom Dialog aus liess sie sich nie ans Produkt hängen,
  // weil sie hier ja schon galt. Von einem Vorfahren geerbt: dann entfällt die Ebene wirklich
  const knoten = { ...KNOTEN, attachedGroups: ['from_document'], groups: [...KNOTEN.groups, { key: 'from_document', from: 'p1', fromLabel: 'Bohrer', active: true, attributes: [] }] }
  const { w, rufe } = await dialog({ knoten })
  assert.equal(w.findAll('.dt-foot select').length, 2, 'die Ebene steht zur Wahl')
  await w.findAll('.dt-foot select')[1].setValue('g1'); await flushPromises()
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  const dran = rufe.find(r => r.methode === 'PUT' && /\/nodes\/g1\/groups$/.test(r.pfad))
  assert.ok(dran, 'die Gruppe kommt an den Vorfahren'); assert.deepEqual(dran.rumpf.groups, ['physical', 'from_document'])
  const geerbt = { ...KNOTEN, groups: [...KNOTEN.groups, { key: 'from_document', from: 'g1', fromLabel: 'Mastertree', active: true, attributes: [] }] }
  const { w: w2, rufe: r2 } = await dialog({ knoten: geerbt })
  assert.equal(w2.findAll('.dt-foot select').length, 1, 'von oben geerbt — keine Ebene')
  await w2.find('.dt-foot .primary').trigger('click'); await flushPromises()
  assert.equal(r2.filter(r => r.methode === 'PUT' && /\/groups$/.test(r.pfad)).length, 0, 'nichts hängt neu')
})

test('ohne neue Attribute steht keine Gruppenwahl da', async () => {
  const { w } = await dialog({ tabellen: { ready: true, state: 'text', tables: [{ seq: 0, page: 1, heading: null, rows: [['Gewicht', '1,2 kg'], ['Gewicht', '1,2 kg'], ['Gewicht', '1,2 kg']] }] } })
  assert.equal(w.find('.dt-foot select').exists(), false)
})

test('ohne Haken keine Zeile — und kein neues Attribut, das keiner nimmt', async () => {
  const { w, rufe } = await dialog()
  await zeile(w, 'Farbe').find('input[type=checkbox]').setValue(false)
  await zeile(w, 'Durchmesser').find('input[type=checkbox]').setValue(false)
  await flushPromises()
  assert.match(w.find('.dt-foot .primary').text(), /1/)
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  assert.equal(rufe.filter(r => r.methode === 'PUT' && /\/api\/model\/attributes\//.test(r.pfad)).length, 0)
  assert.equal(rufe.filter(r => r.methode === 'PUT' && /\/groups$/.test(r.pfad)).length, 0, 'ohne neues Attribut braucht der Knoten die Gruppe nicht')
  assert.deepEqual(werte(rufe).map(([a]) => a), ['weight'])
})

test('das Ziel lässt sich umstellen: Farbe auf ein vorhandenes Attribut, mit Sprache', async () => {
  const { w, rufe } = await dialog()
  await zeile(w, 'Farbe').find('select').setValue('name'); await flushPromises()
  assert.equal(w.vm.rows.find(r => r.key === 'Farbe').target, 'attr')
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  const cmd = stapel(rufe).find(c => c.op === 'attribute.set' && c.args.attribute === 'name')
  assert.equal(cmd.args.locale, 'de', 'ein Attribut je Sprache bekommt die Mastersprache')
})

test('noch nicht gelesen: der Dialog stösst den Job „Dokumente lesen“ an und wartet', async () => {
  let n = 0
  const { w, rufe } = await dialog({ tabellen: () => (++n === 1 ? { ready: true, state: null, tables: [] } : TABELLEN) })
  assert.equal(w.vm.warten, true)
  assert.match(w.text(), /wird gelesen/)
  const start = rufe.find(r => r.methode === 'POST' && /\/api\/jobs\/lesen\/run$/.test(r.pfad))
  assert.ok(start, 'der Job des Plugins docs wird gestartet')
  assert.equal(rufe.filter(r => /\/api\/jobs\/lesen\/run$/.test(r.pfad)).length, 1, 'und nur einmal')
  w.unmount()
})

test('ohne Job des Plugins docs steht das da — ohne Ratschlag', async () => {
  const { w } = await dialog({ tabellen: { ready: true, state: null, tables: [] }, jobs: [] })
  assert.match(w.vm.hinweis, /Kein Job/)
  w.unmount()
})

// ── Text gegen das Modell (KI) ────────────────────────────────────────────────────────────────────────────────

// ── Text gegen das Modell ohne KI ─────────────────────────────────────────────────────────────────────────────

test('ohne KI: eine Zeile, deren Schlüssel das Attribut trifft, ist der Wert — ▦ mit Seite, Stelle im Tooltip', async () => {
  const { w, fragen } = await dialog({ tabellen: { ready: true, state: 'text', tables: [] }, text: TEXT_ZEILEN })
  assert.equal(fragen.length, 0, 'keine KI')
  const p = w.vm.zeilenWerte.find(r => r.attribute === 'power')
  assert.ok(p, `Leistung fehlt — da sind: ${w.vm.zeilenWerte.map(r => r.attribute).join(', ')}`)
  assert.deepEqual([p.quelle, p.converted, p.page, p.quote, p.confidence, p.take, p.fest], ['zeile', '35', 1, 'Leistung: 35 W', 1, true, true])
  assert.match(zeile(w, 'Leistung').find('td.quelle').text(), /^▦ S\. 1 · 100 %/)
  assert.ok(!zeile(w, 'Leistung').find('td.quelle').classes('ai'), 'ohne KI kein Magenta')
  assert.equal(w.vm.zeilenWerte.some(r => r.value.includes('220')), false, 'Netzspannungsbereich hat hier kein Attribut')
})

test('ohne KI: ein Zahlenattribut ohne Zahl im Wert gibt keine Zeile — die Suche darf es dann noch finden', async () => {
  const { w } = await dialog({ tabellen: { ready: true, state: 'text', tables: [] }, text: TEXT_ZEILEN })
  assert.equal(w.vm.zeilenWerte.some(r => r.attribute === 'weight' && r.quelle === 'zeile'), false, '„Gewicht  pro Stk.“ hat keine Zahl — kein Vorschlag')
  const text = { ...TEXT_ZEILEN, chunks: [...TEXT_ZEILEN.chunks, { seq: 7, page: 5, heading: null, body: 'Gewicht  pro Stk.  0,105 kg' }] }
  const { w: w2 } = await dialog({ tabellen: { ready: true, state: 'text', tables: [] }, text })
  const g = w2.vm.zeilenWerte.find(r => r.attribute === 'weight')
  assert.ok(g, 'mit Zahl in der Zeile gibt es die Zeile'); assert.equal(g.converted, '0.105', 'die Zahl aus dem Wert, die Nebenzelle „pro Stk.“ stört nicht')
})

test('ohne KI: Spaltentabelle mit umgebrochenem Kopf, EAN, und der Name aus der Spalte „Typ“', async () => {
  const { w } = await dialog({ tabellen: { ready: true, state: 'text', tables: [] }, text: TEXT_ZEILEN })
  const sku = w.vm.zeilenWerte.find(r => r.attribute === 'sku')
  assert.ok(sku, `Artikelnummer fehlt — da sind: ${w.vm.zeilenWerte.map(r => r.attribute).join(', ')}`)
  assert.deepEqual([sku.converted, sku.page, sku.quote], ['24166386', 2, 'Artikelnummer: 24166386'], 'der Wert steht in der Wertzeile Zeilen später, in derselben Spalte')
  assert.equal(w.vm.zeilenWerte.some(r => r.attribute === 'power' && r.value === 'tc/ta für ≥'), false)
  const ean = w.vm.zeilenWerte.find(r => r.attribute === 'ean')
  assert.equal(ean?.converted, '4006381333931', 'dreizehn Ziffern mit gültiger Prüfziffer')
  const nm = w.vm.zeilenWerte.find(r => r.attribute === 'name')
  assert.deepEqual([nm?.converted, nm?.confidence, nm?.take, nm?.quote], ['PCI 20 MINI Q211', 0.85, true, 'Typ: PCI 20 MINI Q211'], 'die Spalte „Typ“ ist die Typenbezeichnung')
  // die Werte stehen nach Attribut sortiert
  const namen = w.vm.werte.map(r => r.target === 'attr' ? r.attribute : r.newKey)
  assert.deepEqual(namen, [...namen].sort((a, b) => ({ sku: 'Artikelnummer', ean: 'EAN', weight: 'Gewicht', power: 'Leistung', name: 'Name' }[a] ?? a).localeCompare({ sku: 'Artikelnummer', ean: 'EAN', weight: 'Gewicht', power: 'Leistung', name: 'Name' }[b] ?? b, 'de', { sensitivity: 'base' })))
})

test('die Suche schlägt einer Werteliste nichts Neues vor, und ein Wert muss einer sein', async () => {
  const text = { ...TEXT, chunks: [...TEXT.chunks, { seq: 8, page: 3, heading: null, body: 'EN 55015 (Funkentstörung): EN 61000-3-2 (Oberwellen)\nSchutzart: È' }] }
  const knoten = { ...KNOTEN, groups: [{ ...KNOTEN.groups[0], attributes: [...KNOTEN.groups[0].attributes, 'emc', 'ip'] }] }
  const suche = pfad => /q=(Funkentst|Schutzart)/.test(pfad) ? { ready: true, hits: [{ media: 'm1', seq: 8, page: 3 }] } : { ready: true, hits: [] }
  const { w } = await dialog({ tabellen: { ready: true, state: 'text', tables: [] }, text, knoten, suche })
  assert.equal(w.vm.zeilenWerte.some(r => r.attribute === 'emc' && r.quelle === 'suche'), false, 'kein Normen-Text als neuer Satz')
  assert.equal(w.vm.zeilenWerte.some(r => r.attribute === 'ip'), false, '„È“ ist kein Wert')
})

test('ohne KI: was die Zeilen nicht fanden, sucht die Sinnsuche im Dokument — ⌕ mit der Sicherheit, die die Zeile hat', async () => {
  const gefragt = []
  const suche = pfad => { gefragt.push(decodeURIComponent(pfad)); return /q=Gewicht/.test(pfad) ? { ready: true, hits: [{ media: 'm1', seq: 6, page: 4 }, { media: 'm2', seq: 1, page: 1 }] } : { ready: true, hits: [] } }
  const { w } = await dialog({ tabellen: { ready: true, state: 'text', tables: [] }, suche, text: TEXT_ZEILEN })
  assert.ok(gefragt.some(p => /q=Gewicht.*mode=hybrid.*under=p1/.test(p)), `die Suche fragt nach der Bezeichnung, im Teilbaum des Knotens: ${gefragt.join(' | ')}`)
  assert.ok(!gefragt.some(p => /q=Leistung/.test(p)), 'Leistung fand schon die Zeile — keine Suche')
  const g = w.vm.zeilenWerte.find(r => r.attribute === 'weight')
  assert.ok(g, 'Gewicht über „Nennmasse“ — Synonym masse, Ähnlichkeit')
  assert.deepEqual([g.quelle, g.converted, g.page], ['suche', '1.5', 4])
  assert.ok(g.confidence >= 0.5 && g.confidence < 1)
  assert.match(zeile(w, 'Gewicht').find('td.quelle').text(), /^⌕ S\. 4/)
})

test('Zeile und KI sagen dasselbe: beide angehakt, einmal geschrieben — sagen sie Verschiedenes, entscheidet der Anwender', async () => {
  const { w, rufe } = await dialog({ ki: KI, text: TEXT_ZEILEN })
  const zeilenP = w.vm.zeilenWerte.find(r => r.attribute === 'power'), kiP = w.vm.rows.find(r => r.quelle === 'ki' && r.attribute === 'power')
  assert.ok(zeilenP && kiP); assert.equal(zeilenP.converted, kiP.converted)
  assert.equal(zeilenP.take, true); assert.equal(kiP.take, true)
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  assert.deepEqual(werte(rufe).filter(([a]) => a === 'power'), [['power', '35']], 'einmal')
  const { w: w2 } = await dialog({ ki: { items: [{ key: 'power', value: '40', page: 2, quote: 'Nennleistung 40 W', confidence: 0.6 }] }, text: TEXT_ZEILEN })
  const z2 = w2.vm.zeilenWerte.find(r => r.attribute === 'power'), k2 = w2.vm.rows.find(r => r.quelle === 'ki' && r.attribute === 'power')
  assert.equal(z2.take, false); assert.equal(k2.take, false); assert.match(z2.why, /≠ 40/)
})

test('ohne KI-Schlüssel geht nichts an die KI — der Text wird trotzdem geholt, für die Textbausteine', async () => {
  const { w, rufe, fragen } = await dialog()
  assert.equal(w.vm.ki, 'aus')
  assert.equal(rufe.filter(r => /\/text$/.test(r.pfad)).length, 1)
  assert.equal(fragen.length, 0)
  assert.match(w.text(), /✦ aus/)
})

// ── Textbausteine ─────────────────────────────────────────────────────────────────────────────────────────────

test('Bausteine: ein Umbruch im Fliesstext und ein Spaltenkopf aus dem alten Index sind keine', async () => {
  const text = { ready: true, state: 'text', chunks: [
    { seq: 0, page: 2, heading: 'Seh- und Arbeitsbedingungen zielt HCL vorrangig auf', body: 'den circadianen Rhythmus ab, der unter anderem die innere Uhr des Menschen steuert.' },
    { seq: 1, page: 4, heading: 'Gemütszustand variieren. So steigt mit zunehmendem', body: 'Alter beispielsweise das Bedürfnis nach höheren Beleuchtungsstärken deutlich an.' },
    { seq: 2, page: 8, heading: 'Größe', body: '(mm)\nArt.-Nr.\nLCA 50W 350-1050mA DT8 lp PRE 350–1.050 20 89 123456' },
    { seq: 3, page: 9, heading: 'LED-Treiber', body: '— Ausgangsstrom einstellbar mit basicDIM Wireless oder I-Select 2\n— Kleine Bauform mit Zugentlastung' }] }
  const { w } = await dialog({ tabellen: { ready: true, state: 'text', tables: [] }, text })
  assert.deepEqual(w.vm.bausteineZeilen.map(b => b.key), ['LED-Treiber'])
})

test('Abschnitte mit Überschrift stehen als Textbausteine — eigene Gruppe, ohne KI', async () => {
  const { w } = await dialog({ text: TEXT })
  assert.deepEqual(w.vm.bausteineZeilen.map(b => b.key), ['Funkentstörung', 'Montage'], '„Technische Daten“ ist zu kurz; die zwei Abschnitte „Funkentstörung“ werden einer')
  assert.ok(w.vm.werte.every(r => !r.baustein), 'die Werte oben bleiben unter sich')
  assert.match(w.find('tbody.bausteine .step-band').text(), /▤ Textbausteine · 2/)
  // beide angehakt: Funkentstörung trifft die leere Liste emc, Montage wird ein neues html-Attribut
  assert.deepEqual(w.vm.bausteineZeilen.map(b => [b.key, b.take]), [['Funkentstörung', true], ['Montage', true]], 'auch ein neues Attribut ist angehakt — wie oben bei den Werten')
  assert.match(w.find('.dt-foot .primary').text(), /5/, 'drei Tabellenwerte und zwei Bausteine')
  // Fliesstext: html, Absätze
  const m = w.vm.bausteineZeilen[1]
  assert.deepEqual([m.page, m.target, m.newKey, m.newType, m.quelle], [3, 'new', 'montage', 'html', 'text'])
  assert.match(m.converted, /^<p>Das Gerät wird/)
  assert.deepEqual(zeile(w, 'Montage').find('select').findAll('option').map(o => o.text()), ['—', '+ neu: montage', '▤ Hinweise', '≣ Funkentstörung'], 'Textattribute und mehrwertige Listen stehen zur Wahl')
})

test('ein Satz, den der Leser für eine Überschrift hielt, ist kein Baustein — und „wird gelesen“ endet mit dem Job, nicht mit der KI', async () => {
  const text = { ready: true, state: 'text', chunks: [
    { seq: 0, page: 1, heading: 'Um Geräteausfälle durch Masseschlüsse zu vermeiden, muss die Verdrahtung', body: 'vor mechanischer Belastung mit scharfkantigen Metallteilen geschützt werden.' },
    { seq: 1, page: 1, heading: 'Montageempfehlung', body: 'Optimale Wärmeabfuhr kann die Lebensdauer verlängern, darum das Gerät flach auf Metall montieren.' }] }
  let kiLaeuft = null
  const ki = { items: [], more: [] }
  const { w } = await (async () => {
    const { rufe, fragen } = welt({ text, tabellen: { ready: true, state: 'text', tables: [] }, ki })
    ai.ask = async args => { fragen.push(args); kiLaeuft = w2.vm.warten; return ki }
    const w2 = mount(DocTables, { props: { node: KNOTEN, media: ['m1'], names: { m1: 'datenblatt.pdf' } } })
    await flushPromises()
    await kiKnopf(w2).trigger('click'); await flushPromises()
    return { w: w2, rufe, fragen }
  })()
  assert.deepEqual(w.vm.bausteineZeilen.map(b => b.key), ['Montageempfehlung'], 'der lange Satz ist keine Überschrift')
  assert.equal(kiLaeuft, false, 'während die KI las, stand nicht mehr „wird gelesen“ — der Job war durch')
  assert.equal(w.vm.warten, false)
})

test('eine Aufzählung unter einer Überschrift trifft die Werteliste gleichen Namens — je Satz Best Guess gegen ihre Werte', async () => {
  const { w } = await dialog({ text: TEXT })
  const f = w.vm.bausteineZeilen[0]
  assert.deepEqual([f.target, f.attribute, f.newType, f.multiple], ['attr', 'emc', 'enum', true], '„Funkentstörung“ ist die Liste emc')
  assert.deepEqual(f.listValues.map(v => [v.value, v.neu]), [['nicht_kreuzen', false], ['lampenleitungen_verdrillen', true], ['netzleitung_in_der_leuchte_kurz_halten', true]], 'ein Satz steht schon in der Liste, zwei sind neu')
  assert.equal(f.why, '2 neu in Liste emc')
  assert.match(zeile(w, 'Funkentstörung').text(), /≣ 3 · 2 neu/)
})

test('„bitte nicht kreuzen“ trifft „nicht kreuzen“ — Ähnlichkeit gilt für Sätze, nie für Codes', async () => {
  const { w } = await dialog()
  const liste = MODELL.lists[0]
  const [a] = w.vm.zuordnen(['Netzleitung und Lampenleitung bitte nicht kreuzen.'], liste)
  assert.deepEqual([a.value, a.neu], ['nicht_kreuzen', false]); assert.ok(a.trifft >= 72 && a.trifft < 100, `ähnlich, nicht gleich: ${a.trifft}`)
  const codes = { values: [{ value: 'en_61347_2_12', label: { de: 'EN 61347-2-12' } }] }
  const [c] = w.vm.zuordnen(['EN 61347-2-13'], codes)
  assert.equal(c.neu, true, 'ein Code ist nur gleich, wenn er gleich ist')
  const [d] = w.vm.zuordnen(['EN 61347-2-12'], codes)
  assert.deepEqual([d.value, d.neu], ['en_61347_2_12', false])
})

test('ein Baustein, dessen Attribut hier schon einen Wert hat, bleibt ohne Haken', async () => {
  const knoten = { ...KNOTEN, values: [{ attribute: 'emc', values: ['nicht_kreuzen'] }] }
  const { w } = await dialog({ knoten, text: TEXT })
  const f = w.vm.bausteineZeilen[0]
  assert.equal(f.take, false); assert.match(f.why, /hat schon/)
})

test('✓ mit der Aufzählung: die neuen Sätze kommen in die Liste, der Wert sind die Schlüssel', async () => {
  const { w, rufe } = await dialog({ text: TEXT })
  assert.equal(zeile(w, 'Funkentstörung').find('input[type=checkbox]').element.checked, true, 'schon angehakt — das Attribut ist hier leer')
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  assert.equal(rufe.filter(r => r.methode === 'PUT' && /\/api\/model\/attributes\//.test(r.pfad)).some(r => r.pfad.endsWith('/emc') || r.pfad.endsWith('/funkentstoerung')), false, 'kein neues Attribut')
  const nachtrag = rufe.find(r => r.methode === 'PUT' && /\/api\/model\/lists\/emc\/values$/.test(r.pfad))
  assert.deepEqual(nachtrag.rumpf.map(v => [v.value, v.label.de]), [['lampenleitungen_verdrillen', 'Lampenleitungen verdrillen.'], ['netzleitung_in_der_leuchte_kurz_halten', 'Netzleitung in der Leuchte kurz halten.']])
  const cmd = stapel(rufe).find(c => c.op === 'attribute.set' && c.args.attribute === 'emc')
  assert.equal(cmd.args.locale, null); assert.deepEqual(cmd.args.values, ['nicht_kreuzen', 'lampenleitungen_verdrillen', 'netzleitung_in_der_leuchte_kurz_halten'])
  assert.ok(rufe.indexOf(nachtrag) < rufe.findIndex(r => /\/api\/batch/.test(r.pfad)), 'die Liste vor dem Stapel')
})

test('ein Baustein mit Haken als neues html-Attribut: mit Sprache, der Wert ist das HTML, der Beleg nennt die Überschrift', async () => {
  const { w, rufe } = await dialog({ text: TEXT })
  const z = zeile(w, 'Montage')
  assert.equal(z.find('input[type=checkbox]').element.checked, true, 'schon angehakt — der Abschnitt gehört an das Produkt')
  assert.match(w.find('.dt-foot .primary').text(), /5/)
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  const attr = rufe.find(r => r.methode === 'PUT' && /\/api\/model\/attributes\/montage$/.test(r.pfad))
  assert.deepEqual([attr.rumpf.type, attr.rumpf.axes, attr.rumpf.group, attr.rumpf.label], ['html', ['locale'], 'from_document', { de: 'Montage' }], 'die Sprachachse heisst axes — mit perLocale kam der Wert nicht an')
  const cmd = stapel(rufe).find(c => c.op === 'attribute.set' && c.args.attribute === 'montage')
  assert.equal(cmd.args.locale, 'de'); assert.match(cmd.args.value, /^<p>Das Gerät/)
  const beleg = stapel(rufe).find(c => c.op === 'value.source' && c.args.attribute === 'montage').args
  assert.deepEqual([beleg.title, beleg.note, beleg.method], ['Seite 3', 'Montage', 'import'])
})

test('↻ neu lesen: der Index wird geleert, der Job liest neu, der Dialog wartet wie beim ersten Mal', async () => {
  const { w, rufe } = await dialog({ text: TEXT })
  const vorher = rufe.length
  await w.findAll('button').find(b => b.text().includes('neu lesen')).trigger('click'); await flushPromises()
  const danach = rufe.slice(vorher)
  assert.deepEqual(danach.filter(r => r.methode === 'DELETE').map(r => r.pfad.split('/').slice(-2).join('/')), ['docs/m1'], 'der Eintrag im Index geht weg')
  assert.ok(danach.some(r => /\/api\/docs\/m1\/tables/.test(r.pfad)), 'danach werden die Tabellen neu geholt')
  assert.ok(danach.findIndex(r => r.methode === 'DELETE') < danach.findIndex(r => /\/tables/.test(r.pfad)), 'erst löschen, dann holen')
})

test('↻ neu lesen: der Zähler des Balkens fängt von vorn an', async () => {
  const { w } = await dialog({ tabellen: { ready: true, state: 'text', tables: [] }, text: TEXT_ZEILEN })
  const { gesamt } = w.vm.schritte; assert.ok(gesamt > 1)
  await w.findAll('button').find(b => b.text().includes('neu lesen')).trigger('click'); await flushPromises()
  assert.deepEqual([w.vm.schritte.gesamt, w.vm.schritte.erledigt], [gesamt, gesamt], 'nicht das Doppelte')
})

test('Matrixtabelle: derselbe Schlüssel mehrmals ist eine Zeile — gleiche Werte einmal, verschiedene mit ·', async () => {
  const tables = [{ seq: 0, page: 1, heading: null, rows: [['HI', '1x20 W'], ['HI', '1x22 W'], ['HI', '1x20 W'], ['Lebensdauer', '40.000 h'], ['Lebensdauer', '40.000 h'], ['a', '1'], ['b', '2']] }]
  const { w } = await dialog({ tabellen: { ready: true, state: 'text', tables } })
  const hi = w.vm.rows.filter(r => r.key === 'HI'); const leb = w.vm.rows.filter(r => r.key === 'Lebensdauer')
  assert.equal(hi.length, 1); assert.equal(hi[0].value, '1x20 W · 1x22 W'); assert.notEqual(hi[0].target, 'skip')
  assert.equal(leb.length, 1); assert.equal(leb[0].value, '40.000 h')
  assert.equal(w.vm.rows.some(r => r.why === 'doppelt'), false, 'nichts mehr als doppelt gestrichen')
})

test('ein Baustein in ein bestehendes Textattribut', async () => {
  const { w, rufe } = await dialog({ text: TEXT })
  await zeile(w, 'Montage').find('select').setValue('hints'); await flushPromises()
  const b = w.vm.bausteineZeilen.find(x => x.key === 'Montage')
  assert.deepEqual([b.target, b.attribute, b.take], ['attr', 'hints', true], 'ein Ziel wählen hakt an')
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  assert.equal(rufe.filter(r => r.methode === 'PUT' && /\/api\/model\/attributes\/montage$/.test(r.pfad)).length, 0, 'nichts Neues')
  const cmd = stapel(rufe).find(c => c.op === 'attribute.set' && c.args.attribute === 'hints')
  assert.equal(cmd.args.locale, 'de'); assert.match(cmd.args.value, /<p>/)
})

test('ein neuer Baustein lässt sich zwischen html und enum umstellen', async () => {
  const { w } = await dialog({ text: TEXT })
  const z = zeile(w, 'Montage')
  await z.findAll('select')[1].setValue('enum'); await flushPromises()
  const m = w.vm.bausteineZeilen.find(x => x.key === 'Montage')
  assert.equal(m.newType, 'enum'); assert.equal(m.listValues.length, 1, 'kein Aufzählungspunkt — der Absatz ist ein Satz')
  await z.findAll('select')[1].setValue('html'); await flushPromises()
  assert.equal(m.listValues, null); assert.match(m.converted, /^<p>/)
})

test('die KI läuft erst auf Knopfdruck — was Token kostet, läuft nicht von selbst', async () => {
  const { w, fragen } = await dialog({ ki: KI, kiKlick: false })
  assert.equal(fragen.length, 0, 'nichts ging an die KI')
  assert.equal(w.vm.ki, 'bereit')
  const knopf = kiKnopf(w)
  assert.ok(knopf, 'der Knopf steht da'); assert.ok(knopf.classes('ai'), 'magenta — er kostet'); assert.equal(knopf.attributes('disabled'), undefined)
  assert.ok(w.vm.werte.length >= 3, 'Tabellen sind schon da — ohne KI')
  await knopf.trigger('click'); await flushPromises()
  assert.equal(fragen.length, 1); assert.equal(w.vm.ki, 'fertig')
  assert.ok(w.vm.rows.some(r => r.quelle === 'ki'))
})

test('mit dem lokalen Modell ist der Knopf nicht magenta — er kostet nichts; die ✦-Zeilen auch nicht', async () => {
  const { w, fragen } = await dialog({ ki: KI, kiKlick: false, lokal: true })
  const knopf = kiKnopf(w)
  assert.ok(knopf); assert.ok(!knopf.classes('ai'), 'kein Magenta beim lokalen Modell')
  await knopf.trigger('click'); await flushPromises()
  assert.equal(fragen.length, 1)
  assert.ok(!zeile(w, 'Leistung').find('td.quelle').classes('ai'), 'die Zeile trägt ✦, aber nicht die Farbe des Bezahlten')
  assert.match(zeile(w, 'Leistung').find('td.quelle').text(), /^✦/)
})

test('ohne KI-Schlüssel gibt es keinen Knopf — nur ✦ aus', async () => {
  const { w } = await dialog({ text: TEXT })
  assert.equal(kiKnopf(w), undefined); assert.match(w.text(), /✦ aus/)
})

test('mit KI: der Text geht gegen die Attribute, die hier gelten — je Wert Seite, Stelle, Sicherheit', async () => {
  const { w, fragen } = await dialog({ ki: KI })
  assert.equal(fragen.length, 1, 'einmal je Dokument')
  const { system, user } = fragen[0]
  assert.match(system, /JSON/)
  // die Attributliste steht im Systemtext — je Dokument dieselbe, der Server cacht sie; nur der Text wechselt
  assert.match(system, /- weight: Gewicht \(decimal kg\)/); assert.match(system, /- power: Leistung \(integer W\)/); assert.match(system, /- name: Name \(text\)/)
  assert.doesNotMatch(system, /- ip:/, 'Schutzart gilt hier nicht — die Gruppe hängt nicht am Pfad')
  assert.doesNotMatch(user, /- weight:/, 'im Nutzertext steht nur das Dokument')
  assert.match(user, /\[Seite 2\]\s*Nennleistung 35 W/, 'der Text trägt Seitenmarken')
  assert.match(user, /datenblatt\.pdf/)
  assert.deepEqual(w.vm.attributeHier.map(a => a.key), ['sku', 'ean', 'weight', 'power', 'name'], 'nach Bezeichnung sortiert: Artikelnummer, EAN, Gewicht, Leistung, Name')
  const power = w.vm.rows.find(r => r.quelle === 'ki' && r.attribute === 'power')
  assert.ok(power, 'der Wert der KI steht als Zeile da')
  assert.deepEqual([power.key, power.value, power.converted, power.page, power.quote, power.confidence, power.take], ['Leistung', '35', '35', 2, 'Nennleistung 35 W', 0.92, true])
  assert.equal(w.vm.rows.some(r => r.attribute === 'ip'), false, 'was hier nicht gilt, nimmt der Dialog nicht — auch wenn die KI es nennt')
  assert.equal(w.vm.ki, 'fertig')
  // im DOM: die Quelle ✦ mit Seite und Sicherheit, das Attribut fest (kein Wähler)
  const z = zeile(w, 'Leistung')
  assert.match(z.find('td.quelle').text(), /✦ S\. 2 · 92 %/)
  assert.equal(z.find('select').exists(), false)
  assert.match(z.find('td.quelle').attributes('title'), /Nennleistung 35 W/)
})

test('mit KI: weitere Daten, die zu keinem Attribut der Liste passen, gehen durch den Mapper — gefunden oder neu', async () => {
  // Ein Knoten mit drei Attributen, ein Datenblatt mit zwanzig Werten: die anderen siebzehn dürfen nicht wegfallen
  const ki = { items: [], more: [
    { label: 'Netzspannung', value: '220–240 V', page: 1, quote: 'Netzspannungsbereich 220 – 240 V', confidence: 0.9 },
    { label: 'Leistung', value: '20 W', page: 2, quote: 'Lampenleistung 20 W', confidence: 0.8 },
  ] }
  const { w, fragen } = await dialog({ ki, tabellen: { ready: true, state: 'text', tables: [] } })
  assert.match(fragen[0].system, /"more"/, 'die Frage verlangt beides')
  const netz = w.vm.rows.find(r => r.key === 'Netzspannung'), leistung = w.vm.rows.find(r => r.key === 'Leistung')
  assert.ok(netz && leistung, `da sind: ${w.vm.rows.map(r => r.key).join(' | ')}`)
  assert.deepEqual([netz.quelle, netz.target, netz.newKey, netz.take, netz.page], ['ki', 'new', 'netzspannung', true, 1], 'kein Attribut im Modell — neu')
  assert.deepEqual([leistung.target, leistung.attribute, leistung.converted], ['attr', 'power', '20'], 'die Bezeichnung trifft ein Attribut des Modells, die Einheit fällt weg')
  assert.ok(zeile(w, 'Netzspannung').find('select').exists(), 'das Ziel bleibt wählbar — wie bei einer Tabellenzeile')
  assert.equal(zeile(w, 'Netzspannung').find('select').element.value, '+')
  assert.match(zeile(w, 'Netzspannung').find('td.quelle').text(), /✦ S\. 1 · 90 %/)
})

test('mit KI: die vorhandenen Attribute stehen in der Frage, und ein genannter Schlüssel gilt — kein zweites Attribut für dieselbe Sache', async () => {
  // Beim zweiten Lauf hiess „Lampenwattage“ auf einmal „Lampenleistung“ — zwölf neue Attribute für Werte, die es schon gab
  const ki = { items: [], more: [
    { attribute: 'power', label: 'Lampenleistung', value: '20 W', page: 1, quote: 'Lampenleistung 20 W', confidence: 0.9 },
    { attribute: null, label: 'λ bei 50 Hz 230 V', value: '0,97', page: 1, quote: 'λ 0,97', confidence: 0.9 },
  ] }
  const { w, fragen } = await dialog({ ki, tabellen: { ready: true, state: 'text', tables: [] } })
  assert.match(fragen[0].system, /Vorhandene Attribute:\n[\s\S]*power: Leistung/, 'alle Attribute des Modells, mit Schlüssel')
  assert.match(fragen[0].system, /"attribute"/)
  const p = w.vm.rows.find(r => r.key === 'Lampenleistung')
  assert.deepEqual([p.target, p.attribute, p.converted, p.why], ['attr', 'power', '20', 'von der KI zugeordnet'])
  const l = w.vm.rows.find(r => r.key === 'λ bei 50 Hz 230 V')
  assert.equal(l.target, 'new', 'ohne genannten Schlüssel kein Ähnlichkeitstreffer des Mappers — die KI kannte die Liste')
})

test('ein Baustein, dessen Überschrift ein Attribut anderen Typs trifft, bekommt einen eigenen Schlüssel — die Definition bleibt', async () => {
  // „Gewicht“ ist eine Zahl mit 626 Werten; der Baustein „Gewicht“ darf sie nicht überschreiben
  const text = { ready: true, state: 'text', chunks: [{ seq: 0, page: 1, heading: 'Gewicht', body: 'Das Gewicht gilt ohne Verpackung und ohne Zubehör, gemessen bei Raumtemperatur.' }] }
  const { w, rufe } = await dialog({ text, tabellen: { ready: true, state: 'text', tables: [] } })
  const b = w.vm.bausteineZeilen[0]
  assert.deepEqual([b.target, b.newKey, b.newType], ['new', 'gewicht_text', 'html']); assert.match(b.why, /Attribut weight ist decimal/)
  await zeile(w, 'Gewicht').find('input[type=checkbox]').setValue(true); await flushPromises()
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  assert.equal(rufe.filter(x => x.methode === 'PUT' && /\/api\/model\/attributes\/gewicht$/.test(x.pfad)).length, 0, 'die Definition von gewicht bleibt unangetastet')
  assert.ok(rufe.some(x => x.methode === 'PUT' && /\/api\/model\/attributes\/gewicht_text$/.test(x.pfad)))
})

test('„2.800 Stk.“ ist zweitausendachthundert — der Punkt trennt Tausender', async () => {
  const { w } = await dialog({ tabellen: { ready: true, state: 'text', tables: [{ seq: 0, page: 1, heading: null, rows: [['Verpackung Palette', '2.800 Stk.'], ['a', '1'], ['b', '2']] }] } })
  const r = w.vm.rows.find(r => r.key === 'Verpackung Palette')
  assert.deepEqual([r.newType, r.unit, r.converted], ['integer', 'Stk', '2800'])
})

test('„1,5 mm², 2,5 mm²“: das Komma ist eine Dezimalstelle, Zahlen sind keine Werteliste — „rot, blau“ ist eine', async () => {
  const { w } = await dialog({ tabellen: { ready: true, state: 'text', tables: [{ seq: 0, page: 1, heading: null, rows: [['Installation', '1,5 mm², 1,5 mm², 2,5 mm²'], ['Ausführung', 'rot, blau'], ['b', '2']] }] } })
  const i = w.vm.rows.find(r => r.key === 'Installation'), a = w.vm.rows.find(r => r.key === 'Ausführung')
  assert.equal(i.newType, 'text'); assert.equal(i.listValues, undefined)
  assert.equal(a.newType, 'enum'); assert.deepEqual(a.listValues.map(v => v.label), ['rot', 'blau'])
})

test('ein Satz mit Komma ist keine Aufzählung', async () => {
  const { w } = await dialog({ tabellen: { ready: true, state: 'text', tables: [{ seq: 0, page: 1, heading: null, rows: [['Leitungsart', 'Zur Verdrahtung Litzen- oder Volldraht, bis 2,5 mm² verwendbar'], ['a', '1'], ['b', '2']] }] } })
  const r = w.vm.rows.find(r => r.key === 'Leitungsart')
  assert.equal(r.newType, 'text'); assert.equal(r.listValues, undefined)
})

test('mit KI: eine Einheit im Wert stört nicht — „35 W“ wird 35', async () => {
  const { w } = await dialog({ ki: { items: [{ key: 'power', value: '35 W', page: 2, quote: '35 W', confidence: 0.7 }] } })
  assert.equal(w.vm.rows.find(r => r.attribute === 'power').converted, '35')
})

test('mit KI: ein Attribut, das schon einen eigenen Wert hat, bleibt ohne Haken', async () => {
  const knoten = { ...KNOTEN, values: [{ attribute: 'power', value: '40' }] }
  const { w } = await dialog({ ki: KI, knoten })
  const power = w.vm.rows.find(r => r.attribute === 'power')
  assert.equal(power.take, false); assert.match(power.why, /hat schon/)
})

// ── Was der Knoten schon hat ──────────────────────────────────────────────────────────────────────────────────

test('Tabelle: hat der Knoten denselben Wert schon, steht er in der Zeile und der Haken ist weg', async () => {
  const knoten = { ...KNOTEN, values: [{ attribute: 'weight', value: '1.2' }] }
  const { w } = await dialog({ knoten })
  const g = w.vm.rows.find(r => r.attribute === 'weight')
  assert.deepEqual([g.take, g.gleich, g.why], [false, true, 'gleich · 1.2'])
  assert.ok(zeile(w, 'Gewicht').find('td.pos').exists(), 'gleich ist grün')
  assert.equal(zeile(w, 'Gewicht').find('input[type=checkbox]').element.checked, false)
})

test('Tabelle: „1,2“ am Knoten und „1.2“ aus dem Dokument sind derselbe Wert', async () => {
  const { w } = await dialog({ knoten: { ...KNOTEN, values: [{ attribute: 'weight', value: '1,2' }] } })
  assert.equal(w.vm.rows.find(r => r.attribute === 'weight').gleich, true)
})

test('Tabelle: ein anderer eigener Wert steht in der Zeile, ohne Haken — der Anwender entscheidet', async () => {
  const { w } = await dialog({ knoten: { ...KNOTEN, values: [{ attribute: 'weight', value: '2' }] } })
  const g = w.vm.rows.find(r => r.attribute === 'weight')
  assert.deepEqual([g.take, g.gleich, g.why], [false, false, 'hat schon · 2'])
})

test('geerbt: ein anderer Wert vom Vorfahren bleibt angehakt und steht dabei; derselbe nimmt den Haken', async () => {
  const modell = { ...MODELL, attributes: MODELL.attributes.map(a => a.key === 'weight' ? { ...a, inheritable: true } : a) }
  const knoten = wert => ({ ...KNOTEN, ancestors: [{ id: 'g1', role: 'group', label: 'Mastertree', values: [{ attribute: 'weight', value: wert }] }] })
  const mit = async (wert, m = modell) => { welt({}); store.model = m; const w = mount(DocTables, { props: { node: knoten(wert), media: ['m1'], names: { m1: 'datenblatt.pdf' } } }); await flushPromises(); return w }
  const w = await mit('2')
  const g = w.vm.rows.find(r => r.attribute === 'weight')
  assert.deepEqual([g.take, g.why, g.von], [true, 'geerbt · 2', 'Mastertree'])
  assert.match(zeile(w, 'Gewicht').findAll('td').at(-1).attributes('title'), /geerbt von Mastertree/)
  const w2 = await mit('1.2')
  const g2 = w2.vm.rows.find(r => r.attribute === 'weight')
  assert.deepEqual([g2.take, g2.gleich, g2.why], [false, true, 'gleich · 1.2'])
  const w3 = await mit('1.2', MODELL)
  assert.equal(w3.vm.rows.find(r => r.attribute === 'weight').take, true, 'nicht vererbbar: der Vorfahr zählt nicht')
})

test('Zielwechsel: das gewählte Attribut hat den Wert schon — der Haken geht weg', async () => {
  const { w } = await dialog({ knoten: { ...KNOTEN, values: [{ attribute: 'power', value: '22' }] } })
  const d = w.vm.rows.find(r => r.key === 'Durchmesser')
  w.vm.ziel(d, 'power')
  assert.deepEqual([d.target, d.attribute, d.error, d.take, d.why], ['attr', 'power', null, false, 'gleich · 22'])
})

test('mit Dateien: der Dialog lädt hoch und zeigt es — dann hängt das Dokument am Knoten und wird gelesen', async () => {
  const { rufe } = welt()
  const echt = globalThis.fetch; let frei; const tor = new Promise(r => { frei = r })
  globalThis.fetch = async (url, opt = {}) => { if (/\/api\/media$/.test(String(url)) && opt.method === 'POST') await tor; return echt(url, opt) }
  const datei = new File([new Uint8Array([1, 2, 3])], 'blatt.pdf', { type: 'application/pdf' })
  const w = mount(DocTables, { props: { node: KNOTEN, media: [], names: {}, dateien: [datei], typen: [{ key: 'document', to: ['media'] }] } })
  await flushPromises()
  assert.ok(w.vm.hochladen); assert.match(w.text(), /wird hochgeladen/); assert.ok(w.find('.lauf .unbestimmt').exists(), 'Balken ohne Mass')
  assert.equal(rufe.some(r => /\/tables/.test(r.pfad)), false, 'noch nichts gelesen')
  frei(); await flushPromises()
  assert.equal(w.vm.hochladen, false)
  const rel = rufe.find(r => /\/api\/relations$/.test(r.pfad) && r.methode === 'POST')
  assert.deepEqual([rel.rumpf.type, rel.rumpf.from], ['document', 'p1'])
  assert.deepEqual(w.vm.medien, [rel.rumpf.to], 'das neue Medium ist das Dokument des Dialogs')
  assert.ok(rufe.some(r => new RegExp(`/api/docs/${rel.rumpf.to}/tables`).test(r.pfad)), 'danach wird es gelesen')
  assert.ok(w.vm.rows.some(r => r.attribute === 'weight'), 'die Tabelle des Dokuments ist da')
})

test('der Balken läuft, solange Abfragen offen sind, und ist weg, wenn nichts mehr nachkommt', async () => {
  welt({ tabellen: { ready: true, state: 'text', tables: [] }, text: TEXT_ZEILEN })
  const echt = globalThis.fetch; let frei; const tor = new Promise(r => { frei = r })
  globalThis.fetch = async (url, opt) => { if (/\/api\/docs\/search/.test(String(url))) await tor; return echt(url, opt) }
  const w = mount(DocTables, { props: { node: KNOTEN, media: ['m1'], names: { m1: 'datenblatt.pdf' } } })
  await flushPromises()
  assert.ok(w.find('.lauf').exists(), 'Balken sichtbar — die Suche läuft')
  assert.ok(w.vm.schritte.gesamt > 1 && w.vm.schritte.erledigt < w.vm.schritte.gesamt, `${w.vm.schritte.erledigt}/${w.vm.schritte.gesamt}`)
  assert.match(w.find('.lauf').attributes('title'), /von \d+ Abfragen/)
  frei(); await flushPromises()
  assert.equal(w.find('.lauf').exists(), false, 'fertig: kein Balken')
  assert.equal(w.vm.schritte.erledigt, w.vm.schritte.gesamt)
})

test('ein Baustein, dessen html-Attribut zu einer hier nicht geltenden Gruppe gehört, bleibt aus', async () => {
  // die Prüfung lief über die Attributliste des Dialogs, die html auslässt — der Server lehnte den Wert dann ab
  const modell = { ...MODELL, attributes: [...MODELL.attributes, { key: 'montage_text', label: { de: 'Montage' }, type: 'html', group: 'other', perLocale: true }] }
  welt({ text: TEXT }); store.model = modell
  const w = mount(DocTables, { props: { node: KNOTEN, media: ['m1'], names: { m1: 'datenblatt.pdf' } } })
  await flushPromises()
  const f = w.vm.bausteineZeilen.find(b => b.key === 'Montage')
  assert.ok(f, `Montage fehlt — da sind: ${w.vm.bausteineZeilen.map(b => b.key).join(', ')}`)
  assert.equal(f.attribute, 'montage_text')
  assert.equal(f.take, false, 'kein Haken')
  assert.match(f.why, /Gruppe other gilt/)
})

test('dasselbe Attribut aus Tabelle und Zeile steht einmal da — die bessere Quelle bleibt', async () => {
  const tabellen = { ready: true, state: 'text', tables: [{ seq: 0, page: 1, heading: null, rows: [['Leistung', '35 W'], ['a', '1'], ['b', '2']] }] }
  const text = { ready: true, state: 'text', chunks: [{ seq: 0, page: 2, heading: null, body: 'Leistung  35 W' }] }
  const { w } = await dialog({ tabellen, text })
  const p = w.vm.rows.filter(r => r.attribute === 'power')
  assert.equal(p.length, 1, `einmal, nicht zweimal: ${p.map(x => x.quelle).join(', ')}`)
  assert.equal(p[0].quelle, 'tabelle', 'die Tabelle im Dokument steht vor der Zeile im Text')
})

test('eine Tabellenzeile im Text wird nicht noch einmal als Zeile gelesen', async () => {
  const text = { ready: true, state: 'text', chunks: [{ seq: 0, page: 1, heading: null, body: 'ADPE | [kg Sb-Equiv.] | 7,48E-03 | 3,88E-09 | 4,46E-09\nLeistung  35 W' }] }
  const { w } = await dialog({ tabellen: { ready: true, state: 'text', tables: [] }, text })
  assert.equal(w.vm.rows.some(r => /Sb-Equiv/.test(String(r.value))), false, 'die Zellen einer Matrix sind kein Wert')
  assert.ok(w.vm.rows.some(r => r.attribute === 'power'), 'die echte Zeile bleibt')
})

test('Textbausteine stehen in der Reihenfolge des Dokuments, das Band nennt die Seiten', async () => {
  const text = { ready: true, state: 'text', chunks: [
    { seq: 0, page: 4, heading: 'Montage', body: 'Das Gerät wird mit zwei Schrauben auf einer ebenen Fläche befestigt und zugentlastet.' },
    { seq: 1, page: 2, heading: 'Anwendung', body: 'Die Komponenten werden in Leuchten für Innenräume eingesetzt, auch in Feuchträumen.' }] }
  const { w } = await dialog({ tabellen: { ready: true, state: 'text', tables: [] }, text })
  assert.deepEqual(w.vm.bausteineZeilen.map(b => [b.key, b.page]), [['Montage', 4], ['Anwendung', 2]], 'wie im Index, nicht sortiert')
  assert.deepEqual(w.vm.bausteineSeiten, [2, 4])
  assert.match(w.find('tbody.bausteine .step-band').text(), /▤ Textbausteine · 2 · S\. 2–4/)
})

test('✓ übernehmen: der Balken zählt Attribute, dann Werte — und ist danach weg', async () => {
  const { w, rufe } = await dialog({ tabellen: { ready: true, state: 'text', tables: [{ seq: 0, page: 1, heading: null, rows: [['Zündspannung', '5 kVp'], ['Netzfrequenz', '50 Hz'], ['Farbe', 'blau']] }] } })
  const echt = globalThis.fetch; let frei; const tor = new Promise(r => { frei = r })
  globalThis.fetch = async (url, opt = {}) => { if (/\/api\/model\/attributes\//.test(String(url))) await tor; return echt(url, opt) }
  const fertig = w.vm.uebernehmen()
  await flushPromises()
  assert.ok(w.vm.arbeit, 'der Balken steht')
  assert.deepEqual([w.vm.arbeit.text, w.vm.arbeit.gesamt], ['Attribute', 3], 'drei neue Attribute')
  assert.equal(w.vm.arbeit.erledigt, 0)
  assert.match(w.find('.dt-foot .lauf').text(), /Attribute 0\/3/)
  frei(); await fertig; await flushPromises()
  assert.equal(w.vm.arbeit, null, 'danach weg')
  assert.equal(rufe.filter(r => /\/api\/model\/attributes\//.test(r.pfad) && r.methode === 'PUT').length, 3)
  assert.ok(rufe.some(r => /\/api\/batch/.test(r.pfad)), 'und die Werte im Stapel')
})

test('mit KI: der Beleg nennt den Weg ai, die Stelle und die Sicherheit', async () => {
  const { w, rufe } = await dialog({ ki: KI, tabellen: { ready: true, state: 'text', tables: [] } })
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  const beleg = stapel(rufe).find(c => c.op === 'value.source').args
  assert.deepEqual([beleg.attribute, beleg.source, beleg.title, beleg.method], ['power', 'datenblatt.pdf', 'Seite 2', 'ai'])
  assert.match(beleg.note, /„Nennleistung 35 W“ · Sicherheit 92 %/)
})

test('zwei Zeilen auf dasselbe Attribut mit demselben Wert: kein Widerspruch — beide angehakt, geschrieben einmal', async () => {
  const { w, rufe } = await dialog({ ki: { items: [{ key: 'weight', value: '1.2', page: 1, quote: 'Gewicht 1,2 kg', confidence: 0.9 }] } })
  const tab = w.vm.rows.find(r => r.quelle === 'tabelle' && r.attribute === 'weight'), kiz = w.vm.rows.find(r => r.quelle === 'ki' && r.attribute === 'weight')
  assert.equal(tab.take, true); assert.equal(kiz.take, true); assert.equal(kiz.why, '')
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  assert.deepEqual(werte(rufe).filter(([a]) => a === 'weight'), [['weight', '1.2']], 'einmal, nicht zweimal')
  assert.match(store.toasts.at(-1)?.text ?? '', /3 Werte/, 'gezählt wird, was geschrieben wurde')
})

test('zwei Zeilen auf dasselbe Attribut mit verschiedenen Werten: keine trägt den Haken — der Anwender wählt', async () => {
  const { w, rufe } = await dialog({ ki: { items: [{ key: 'weight', value: '1.3', page: 1, quote: 'Gewicht 1,3 kg', confidence: 0.6 }] } })
  const tab = w.vm.rows.find(r => r.quelle === 'tabelle' && r.attribute === 'weight'), kiz = w.vm.rows.find(r => r.quelle === 'ki' && r.attribute === 'weight')
  assert.equal(tab.take, false); assert.equal(kiz.take, false)
  assert.equal(tab.why, '≠ 1.3'); assert.equal(kiz.why, '≠ 1.2', 'jede Zeile nennt den anderen Wert')
  assert.match(w.find('.dt-foot .primary').text(), /2/, 'Durchmesser und Farbe bleiben')
  // der Anwender nimmt die KI-Zeile — dann die Tabellenzeile: der Haken wechselt
  const tr = w.findAll('tbody tr').find(x => /✦/.test(x.find('td.quelle').text()))
  await tr.find('input[type=checkbox]').setValue(true); await flushPromises()
  assert.equal(tab.take, false); assert.equal(kiz.take, true)
  await zeile(w, 'Gewicht').find('input[type=checkbox]').setValue(true); await flushPromises()
  assert.equal(tab.take, true); assert.equal(kiz.take, false)
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  assert.deepEqual(werte(rufe).filter(([a]) => a === 'weight'), [['weight', '1.2']], 'ein Wert je Attribut')
})

test('scheitert die KI, steht das da — die Tabellen bleiben', async () => {
  const { w } = await dialog({ ki: new Error('Kontingent erschöpft') })
  assert.equal(w.vm.ki, 'fehler'); assert.match(w.vm.kiHinweis, /Kontingent/)
  assert.equal(w.vm.werte.length, 3)
})

test('mehrere Dokumente: eine Liste, die Quelle nennt das Dokument', async () => {
  const { w, fragen } = await dialog({ ki: KI, media: ['m1', 'm2'], names: { m1: 'datenblatt.pdf', m2: 'massblatt.pdf' } })
  assert.equal(fragen.length, 2, 'je Dokument eine Frage')
  assert.match(w.find('h1').text(), /2 Dokumente/)
  assert.match(zeile(w, 'Leistung').find('td.quelle').attributes('title'), /datenblatt\.pdf/)
})

// ── Die Wege hinein ───────────────────────────────────────────────────────────────────────────────────────────

// (die Vorschau steht bei den Asset-Tests weiter unten)

const knotenansicht = async opt => {
  const { rufe } = welt(opt)
  const router = { path: '/tree/p1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/tree/p1', query: {}, params: { id: 'p1' }, name: 'tree', hash: '', fullPath: '/tree/p1', matched: [], meta: {} }
  const w = mount(NodeView, { props: { id: 'p1' }, global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, EntryList: true, PluginBands: true, VersionsPanel: true, DocTables: true } } })
  await flushPromises()
  return { w, rufe }
}
const band = w => w.findAll('.section').find(s => /▩ Assets/.test(s.find('h2')?.text() ?? ''))
const eintrag = re => menu.items.find(i => i.label && re.test(i.label))

test('am Knoten: Strg beim Ablegen öffnet den Dialog, ohne Strg nicht', async () => {
  const { w, rufe } = await knotenansicht()
  const b = band(w)
  assert.ok(b, 'das Medienband steht da')
  const datei = new File([new Uint8Array([1, 2, 3])], 'datenblatt.pdf', { type: 'application/pdf' })
  await b.trigger('drop', { dataTransfer: { files: [datei], types: ['Files'] } }); await flushPromises()
  assert.equal(w.findComponent({ name: 'DocTables' }).exists(), false, 'ohne Strg nur anhängen')
  await b.trigger('drop', { dataTransfer: { files: [datei], types: ['Files'] }, ctrlKey: true }); await flushPromises()
  const dt = w.findComponent({ name: 'DocTables' })
  assert.ok(dt.exists(), 'mit Strg öffnet sich der Dialog')
  assert.equal(dt.props('media').length, 1)
  assert.equal(dt.props('names')[dt.props('media')[0]], 'datenblatt.pdf', 'der Name geht mit — für den Beleg')
  assert.equal(rufe.filter(r => r.pfad.endsWith('/api/media') && r.methode === 'POST').length, 2, 'angehängt wird in beiden Fällen')
})

test('am Knoten: ein Strg-Drop aus dem Baum kommt über den Store an', async () => {
  welt()
  store.pendingDocTables = { node: 'p1', media: ['m7'], names: { m7: 'x.pdf' } }
  const router = { path: '/tree/p1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/tree/p1', query: {}, params: { id: 'p1' }, name: 'tree', hash: '', fullPath: '/tree/p1', matched: [], meta: {} }
  const w = mount(NodeView, { props: { id: 'p1' }, global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, EntryList: true, PluginBands: true, VersionsPanel: true, DocTables: true } } })
  await flushPromises()
  const dt = w.findComponent({ name: 'DocTables' })
  assert.ok(dt.exists()); assert.deepEqual(dt.props('media'), ['m7']); assert.deepEqual(dt.props('names'), { m7: 'x.pdf' })
  assert.equal(store.pendingDocTables, null, 'der Auftrag ist verbraucht')
})

test('Rechtsklick auf ein Dokument im Band: „Dokument auswerten …“ öffnet den Dialog mit diesem Dokument', async () => {
  const { w } = await knotenansicht({ rels: RELS })
  const kacheln = band(w).findAll('.tile')
  assert.equal(kacheln.length, 3)
  await kacheln[0].trigger('contextmenu', { clientX: 5, clientY: 5 })
  assert.ok(menu.visible)
  const e = eintrag(/^Dokument auswerten/)
  assert.ok(e, `der Eintrag fehlt — da sind: ${menu.items.map(i => i.label).join(' | ')}`)
  assert.ok(!e.disabled)
  e.action(); await flushPromises()
  const dt = w.findComponent({ name: 'DocTables' })
  assert.ok(dt.exists()); assert.deepEqual(dt.props('media'), ['m1']); assert.deepEqual(dt.props('names'), { m1: 'datenblatt.pdf' })
  menu.close()
})

test('Strg+Klick wählt mehrere; der Rechtsklick auf ein gewähltes nimmt die ganze Auswahl', async () => {
  const { w } = await knotenansicht({ rels: RELS })
  const kacheln = band(w).findAll('.tile')
  await kacheln[0].trigger('click', { ctrlKey: true })
  await kacheln[1].trigger('click', { ctrlKey: true })
  await flushPromises()
  assert.ok(kacheln[0].classes('picked') && kacheln[1].classes('picked'), 'beide sind gewählt')
  assert.ok(!kacheln[2].classes('picked'))
  await kacheln[1].trigger('contextmenu', { clientX: 5, clientY: 5 })
  const e = eintrag(/^2 Dokumente auswerten/)
  assert.ok(e, `da sind: ${menu.items.map(i => i.label).join(' | ')}`)
  e.action(); await flushPromises()
  assert.deepEqual(w.findComponent({ name: 'DocTables' }).props('media'), ['m1', 'm2'])
  menu.close()
  // noch einmal Strg+Klick nimmt die Wahl zurück
  await kacheln[0].trigger('click', { ctrlKey: true }); await flushPromises()
  assert.ok(!kacheln[0].classes('picked'))
})

test('ein Bild lässt sich nicht auswerten — der Eintrag ist da, aber gesperrt', async () => {
  const { w } = await knotenansicht({ rels: RELS })
  await band(w).findAll('.tile')[2].trigger('contextmenu', { clientX: 5, clientY: 5 })
  const e = eintrag(/auswerten/)
  assert.ok(e); assert.equal(e.disabled, true); assert.match(e.hint, /kein Dokument/)
  menu.close()
})

test('Rechtsklick: „Zuordnung lösen“ löst die Auswahl, nicht nur die eine Kachel', async () => {
  const { w, rufe } = await knotenansicht({ rels: RELS })
  const kacheln = band(w).findAll('.tile')
  await kacheln[0].trigger('click', { ctrlKey: true }); await kacheln[2].trigger('click', { ctrlKey: true })
  await kacheln[0].trigger('contextmenu', { clientX: 5, clientY: 5 })
  const e = eintrag(/^2 Zuordnungen lösen/)
  assert.ok(e, `da sind: ${menu.items.map(i => i.label).join(' | ')}`); assert.equal(e.danger, true)
  await e.action(); await flushPromises()
  assert.deepEqual(rufe.filter(r => r.methode === 'DELETE').map(r => r.pfad.split('/').at(-1)), ['r1', 'r3'])
  menu.close()
})

test('Klick auf ein Asset zeigt es gross — der Download-Link trägt den Namen, mit → blättert man weiter', async () => {
  const { w } = await knotenansicht({ rels: RELS })
  const kacheln = band(w).findAll('.tile')
  assert.equal(kacheln[0].find('a').exists(), false, 'die Kachel ist kein Download-Link mehr — der Klick zeigt das Medium')
  await kacheln[0].find('.bild').trigger('click'); await flushPromises()
  const v = w.findComponent({ name: 'MediaPreview' })
  assert.ok(v.exists(), 'die Vorschau steht da')
  assert.equal(v.find('h1').text().startsWith('datenblatt.pdf'), true)
  assert.equal(v.find('a.x').attributes('href'), '/api/media/m1/file?name=datenblatt.pdf', 'der Link trägt den Namen — eine andere Adresse als die gecachte ohne Dateinamen')
  assert.ok(v.find('iframe').exists(), 'ein PDF steht als Blatt da, nicht als Bild')
  // blättern: das nächste Medium des Knotens, ohne das Fenster zu schliessen
  await v.findAll('button.x').find(b => b.text() === '›').trigger('click'); await flushPromises()
  assert.match(v.find('h1').text(), /massblatt\.pdf/)
  await v.findAll('button.x').find(b => b.text() === '×').trigger('click'); await flushPromises()
  assert.equal(w.findComponent({ name: 'MediaPreview' }).exists(), false)
})

test('Strg+Klick auf ein Asset wählt weiter aus, statt die Vorschau zu öffnen', async () => {
  const { w } = await knotenansicht({ rels: RELS })
  const kachel = band(w).findAll('.tile')[0]
  await kachel.trigger('click', { ctrlKey: true }); await flushPromises()
  assert.equal(w.findComponent({ name: 'MediaPreview' }).exists(), false)
  assert.ok(kachel.classes('picked'), 'gewählt')
})

// ── ⊞ Tabellen mit Spaltenkopf ─────────────────────────────────────────────────────────────────────────────────

const MATRIX = { ready: true, state: 'text', tables: [{ seq: 0, page: 2, heading: 'Oberwellengehalt des Netzstromes',
  header: ['Typ', 'THD', '3', '5'], rows: [['PCI 2/35', '7,5', '6,0', '3,5'], ['PCI 2/70', '7,5', '4,5', '5,0']] }] }

test('eine Tabelle mit Spaltenkopf bleibt eine Tabelle: ein Tabellenattribut mit einem Attribut je Spalte', async () => {
  const { w } = await dialog({ tabellen: MATRIX })
  assert.equal(w.vm.rows.length, 0, 'keine Schlüssel/Wert-Zeilen daraus')
  const [m] = w.vm.tabellenBloecke
  assert.ok(m, 'die Tabelle steht in ihrem eigenen Band')
  assert.deepEqual([m.key, m.newKey, m.newType, m.take], ['Oberwellengehalt des Netzstromes', 'oberwellengehalt_des_netzstromes', 'rows', true])
  assert.deepEqual(m.spalten.map(s => [s.key, s.label, s.type]), [
    ['oberwellengehalt_des_netzstromes_typ', 'Typ', 'text'],
    ['oberwellengehalt_des_netzstromes_thd', 'THD', 'decimal'],
    ['oberwellengehalt_des_netzstromes_spalte_3', '3', 'decimal'],
    ['oberwellengehalt_des_netzstromes_spalte_4', '5', 'decimal']], 'Zahlenspalten werden Zahlen; „3“ allein ist kein Schlüssel — er beginnt mit einem Buchstaben')
  assert.match(w.find('tbody .step-band').text(), /⊞ Tabellen · 1/)
})

test('✓ mit einer Tabelle: Spaltenattribute, das Tabellenattribut, dann je Zeile row.add mit den Werten', async () => {
  const { w, rufe } = await dialog({ tabellen: MATRIX })
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  const attr = rufe.filter(r => r.methode === 'PUT' && /\/api\/model\/attributes\//.test(r.pfad))
  assert.deepEqual(attr.map(r => r.pfad.split('/').pop()), ['oberwellengehalt_des_netzstromes_typ', 'oberwellengehalt_des_netzstromes_thd', 'oberwellengehalt_des_netzstromes_spalte_3', 'oberwellengehalt_des_netzstromes_spalte_4', 'oberwellengehalt_des_netzstromes'])
  const tabelle = attr.at(-1).rumpf
  assert.equal(tabelle.type, 'rows')
  assert.deepEqual(tabelle.columns, ['oberwellengehalt_des_netzstromes_typ', 'oberwellengehalt_des_netzstromes_thd', 'oberwellengehalt_des_netzstromes_spalte_3', 'oberwellengehalt_des_netzstromes_spalte_4'])
  const cmds = stapel(rufe)
  const zeilen = cmds.filter(c => c.op === 'row.add')
  assert.equal(zeilen.length, 2, 'zwei Zeilen')
  assert.equal(zeilen[0].args.attribute, 'oberwellengehalt_des_netzstromes')
  const werte = cmds.filter(c => c.op === 'attribute.set' && c.args.row === '@' + zeilen[0].ref)
  assert.deepEqual(werte.map(c => [c.args.attribute.replace('oberwellengehalt_des_netzstromes_', ''), c.args.value]), [['typ', 'PCI 2/35'], ['thd', '7,5'], ['spalte_3', '6,0'], ['spalte_4', '3,5']])
})

test('Tabellen und Bausteine gehen in die Gruppe ihrer Überschrift, wenn „je Überschrift“ gewählt ist', async () => {
  const { w, rufe } = await dialog({ tabellen: MATRIX })
  w.vm.gruppe = w.vm.JE_UEBERSCHRIFT; await flushPromises()
  assert.deepEqual(w.vm.gebrauchteGruppen.map(g => g.key), ['oberwellengehalt_des_netzstromes'])
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  const gruppe = rufe.find(r => r.methode === 'PUT' && /\/api\/model\/groups\//.test(r.pfad))
  assert.equal(gruppe.pfad.split('/').pop(), 'oberwellengehalt_des_netzstromes')
  assert.deepEqual(gruppe.rumpf.label, { de: 'Oberwellengehalt des Netzstromes' })
  const attr = rufe.find(r => r.methode === 'PUT' && /_typ$/.test(r.pfad))
  assert.equal(attr.rumpf.group, 'oberwellengehalt_des_netzstromes', 'die Spalten gehören zur Gruppe der Tabelle')
})

// ── n:m: ein Attribut gehört mehreren Gruppen an (29.09.2026, pflegestruktur 36) ──────────────────────────────

test('ein Attribut gilt hier über seine Mitgliedschaft, nicht nur über die Heimatgruppe', async () => {
  // ip liegt in der Gruppe other, die hier nicht hängt — als Mitglied von physical gilt es trotzdem
  const modell = { ...MODELL, attributes: MODELL.attributes.map(a => a.key === 'ip' ? { ...a, group: 'other', groups: ['other', 'physical'] } : a) }
  const knoten = { ...KNOTEN, groups: [{ ...KNOTEN.groups[0], attributes: [...KNOTEN.groups[0].attributes, 'ip'] }] }
  welt({ tabellen: { ready: true, state: 'text', tables: [{ seq: 0, page: 1, heading: null, rows: [['Schutzart', 'IP20'], ['a', '1'], ['b', '2']] }] } })
  store.model = modell
  const w = mount(DocTables, { props: { node: knoten, media: ['m1'], names: { m1: 'datenblatt.pdf' } } })
  await flushPromises()
  const r = w.vm.rows.find(x => x.attribute === 'ip')
  assert.ok(r, `Schutzart fehlt — da sind: ${w.vm.rows.map(x => x.attribute).join(', ')}`)
  assert.equal(r.inaktiv ?? false, false, 'die Gruppe other gilt hier nicht, physical schon')
  assert.equal(r.take, true)
  assert.doesNotMatch(r.why ?? '', /gilt an diesem Knoten nicht/)
})

test('gehört keine Gruppe des Attributs hierher, nennt der Grund alle', async () => {
  const modell = { ...MODELL, attributes: MODELL.attributes.map(a => a.key === 'ip' ? { ...a, group: 'other', groups: ['other', 'weiteres'] } : a) }
  welt({ tabellen: { ready: true, state: 'text', tables: [{ seq: 0, page: 1, heading: null, rows: [['Schutzart', 'IP20'], ['a', '1'], ['b', '2']] }] } })
  store.model = modell
  const w = mount(DocTables, { props: { node: KNOTEN, media: ['m1'], names: { m1: 'datenblatt.pdf' } } })
  await flushPromises()
  const r = w.vm.rows.find(x => x.attribute === 'ip')
  assert.deepEqual([r.inaktiv, r.take], [true, false])
  assert.match(r.why, /Gruppe other, weiteres gilt an diesem Knoten nicht/)
})

// ── Ein Fehler mitten im Übernehmen (29.09.2026) ──────────────────────────────────────────────────────────────

test('scheitert ein Schritt, bleibt der Dialog stehen: was durch ist, ist abgehakt, der Rest wiederholbar', async () => {
  const tabellen = { ready: true, state: 'text', tables: [{ seq: 0, page: 1, heading: null, rows: [['Leistung', '35 W'], ['Farbe', 'blau'], ['Durchmesser', '22 mm']] }] }
  const { w, rufe } = await dialog({ tabellen })
  const echt = globalThis.fetch
  // das Anhängen der Gruppen scheitert — die Werte müssen trotzdem losgehen
  globalThis.fetch = async (url, opt = {}) => {
    if (/\/api\/nodes\/[^/]+\/groups$/.test(String(url))) return { ok: false, status: 400, text: async () => JSON.stringify({ error: 'Unbekannte Gruppe: alt' }), json: async () => ({ error: 'Unbekannte Gruppe: alt' }) }
    return echt(url, opt)
  }
  const vorher = w.vm.genommen.length
  assert.ok(vorher >= 2)
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  assert.ok(w.vm.lauf, 'der Stand des Laufs steht im Dialog')
  assert.match(w.find('.toolbar .neg').text(), /geschrieben/)
  assert.ok(stapel(rufe).some(c => c.op === 'attribute.set'), 'die Werte gingen trotzdem los')
  // was durch ist, trägt keinen Haken mehr und geht beim nächsten Klick nicht noch einmal mit
  assert.ok(w.vm.rows.some(r => r.erledigt), 'erledigte Zeilen sind abgehakt')
  assert.ok(w.find('tbody tr.fertig').exists())
  assert.equal(w.vm.genommen.length, 0, 'nichts Offenes mehr — der Fehler betraf nur das Anhängen')
  globalThis.fetch = echt
})

test('zwei Werte für dasselbe Ziel halten den ganzen Lauf nicht mehr auf', async () => {
  // Tabelle und KI sagen etwas anderes zur Leistung: diese eine Zeile bleibt offen, die anderen gehen durch
  const tabellen = { ready: true, state: 'text', tables: [{ seq: 0, page: 1, heading: null, rows: [['Leistung', '35 W'], ['Farbe', 'blau'], ['Durchmesser', '22 mm']] }] }
  const { w, rufe } = await dialog({ tabellen })
  const p = w.vm.rows.find(r => r.attribute === 'power')
  const kopie = { ...p, converted: '99', quelle: 'ki', take: true, erledigt: false }
  w.vm.rows.push(kopie)   // eine zweite Zeile mit demselben Ziel und anderem Wert
  await flushPromises()
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  const werte = stapel(rufe).filter(c => c.op === 'attribute.set').map(c => c.args.attribute)
  assert.ok(!werte.includes('power'), 'die widersprüchliche Zeile ging nicht mit')
  assert.ok(werte.length >= 1, 'die anderen Werte schon: ' + werte.join(', '))
})

// ── Das Datenblatt daneben (PdfPane ist im Test gestubbt — pdf.js lädt nie) ─────────────────────────────────────
test('die PDF-Ansicht steht daneben; ein Klick auf „Im Dokument“ zeigt Seite und Fundstelle', async () => {
  const { w } = await dialog({ ki: KI })
  const pdf = w.findComponent({ name: 'PdfPane' })
  assert.ok(pdf.exists(), 'das PDF steht neben der Analyse')
  assert.equal(pdf.props('doc'), 'm1', 'per Vorgabe das erste Dokument')
  // die KI-Zeile zur Leistung trägt Seite 2 und ein Zitat — der Klick reicht beides an die Ansicht
  const zelle = w.findAll('td.stelle').find(td => td.text().includes('Nennleistung'))
  assert.ok(zelle, 'eine Fundstelle mit Zitat ist klickbar')
  await zelle.trigger('click'); await flushPromises()
  const p2 = w.findComponent({ name: 'PdfPane' })
  assert.equal(p2.props('page'), 2, 'springt zur Seite des Fundes')
  assert.equal(p2.props('quote'), 'Nennleistung 35 W', 'mit dem Zitat als Fundstelle')
})
