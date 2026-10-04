// Das ETIM-Band wirklich zeichnen: ein Minimal-DOM und eine
// gefälschte /api — der Test liest den Text, der im Band steht, statt zu vermuten. Ohne Browser, ohne Server.
import test from 'node:test'
import assert from 'node:assert/strict'

function mkEl(tag = 'div') {
  const e = {
    tag, nodeType: 1, kids: [], style: { cssText: '' }, attrs: {}, className: '', _text: '',
    append(...k) { for (const x of k.flat()) if (x != null) e.kids.push(x?.nodeType ? x : String(x)) },
    addEventListener(type, fn) { if (type === 'click') e.onclick = fn }, removeEventListener() {}, setAttribute(k, v) { e.attrs[k] = v }, remove() {}, focus() {}, scrollIntoView() {},
    querySelector() { return null }, querySelectorAll() { return [] }, classList: { contains: () => false, add() {}, remove() {} },
    get textContent() { return e._text }, set textContent(v) { e._text = String(v); e.kids = [] },
    get innerHTML() { return '' }, set innerHTML(v) { e.kids = []; e._text = '' },
  }
  return e
}
globalThis.document = { createElement: mkEl, createTextNode: t => ({ nodeType: 3, _text: String(t), kids: [] }), body: mkEl('body'), addEventListener() {}, removeEventListener() {}, querySelector: () => null }
globalThis.window = { open: () => null, addEventListener() {}, removeEventListener() {}, location: { search: '', pathname: '/' }, history: { replaceState() {} }, screen: { availWidth: 1600, availHeight: 900 } }
globalThis.screen = globalThis.window.screen
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
const textOf = e => typeof e === 'string' ? e : [e._text ?? '', ...(e.kids ?? []).map(textOf)].filter(Boolean).join(' ')

// ---- die Welt: eine Klasse mit vier ETIM-Attributen, ein Produkt mit drei Varianten
const CLASS = {
  code: 'EC004718', name: { de: 'Laptop' }, group: { code: 'G1', name: { de: 'Mobile Geräte' } }, synonyms: {},
  features: [
    { code: 'EF008851', type: 'Logical', name: { de: 'Wi-Fi' }, values: [] },
    { code: 'EF000008', type: 'Numeric', name: { de: 'Breite' }, unit: { code: 'MM', abbr: { de: 'mm' } }, values: [] },
    { code: 'EF000007', type: 'Alphanumeric', name: { de: 'Farbe' }, values: [{ code: 'EV1', name: { de: 'rot' } }] },
    { code: 'EF003105', type: 'Logical', name: { de: 'With numeric keyboard' }, values: [] },   // auf tastatur_name zugeordnet, gilt nur an Varianten
  ],
}

// zweite Klasse unter derselben Gruppe: Wi-Fi und Farbe teilen sich beide, „Klebekraft“ hat nur sie
const CLASS2 = {
  code: 'EC000529', name: { de: 'Adhesive' }, group: { code: 'G2', name: { de: 'Klebstoffe' } }, synonyms: {},
  features: [
    { code: 'EF008851', type: 'Logical', name: { de: 'Wi-Fi' }, values: [] },
    { code: 'EF000007', type: 'Alphanumeric', name: { de: 'Farbe' }, values: [{ code: 'EV1', name: { de: 'rot' } }] },
  ],
}
const TREE = [
  { id: 'g-1', role: 'group', label: 'Mobile Geräte', parent: null },
  { id: 'p-1', role: 'product', label: 'HP Notebook 255 G10', parent: 'g-1' },
  { id: 'v-1', role: 'variant', label: 'a', parent: 'p-1' }, { id: 'v-2', role: 'variant', label: 'b', parent: 'p-1' }, { id: 'v-3', role: 'variant', label: 'c', parent: 'p-1' },
  { id: 'p-2', role: 'product', label: 'Klebstoff', parent: 'g-1' },   // eigene Klasse — unter der Gruppe gelten damit zwei
]
const VALUES = {   // eigene Werte je Knoten
  'p-1': { etim_class: 'EC004718', ef008851: 'true' },
  'p-2': { etim_class: 'EC000529' },
  'v-1': { ef008851: 'true', ef000008: '350', ef000007: 'rot', tastatur_name: 'ja' },     // vollständig
  'v-2': { ef008851: 'true', ef000007: 'Lila' },                                            // einer passt nicht
  'v-3': {},                                                                                // leer
}
const INACTIVE = { 'p-1': ['tastatur_name'] }
const NODE_GROUPS = [{ key: 'etim', active: true }, { key: 'etim_ec004718', active: true }]   // was am Knoten gilt   // am Produkt gilt das zugeordnete Attribut nicht
const own = (id, key) => VALUES[id]?.[key]
const resolved = (id, key) => own(id, key) ?? (key === 'etim_class' ? (TREE.find(r => r.id === id)?.parent ? resolved(TREE.find(r => r.id === id).parent, key) : undefined) : undefined)
const rowOf = id => { const r = TREE.find(x => x.id === id); const values = {}; for (const k of ['etim_class', 'ef008851', 'ef000008', 'ef000007', 'tastatur_name']) { const v = resolved(id, k); if (v != null) values[k] = { value: v, own: own(id, k) != null } } return { row: { id, label: r.label, role: r.role, parent: r.parent }, values, inactive: INACTIVE[id] ?? [] } }
const kidsOf = id => TREE.filter(r => r.parent === id)
const deep = id => kidsOf(id).flatMap(k => [k, ...deep(k.id)])

const PLUGIN_DATA = {
  settings: { classAttr: 'etim_class', unknownAs: 'UN', group: 'etim' },
  map: { EF003105: 'tastatur_name' },
  mapping: {},
  release: { version: '9', number: 9, name: 'ETIM 9.0', classes: 2 },
  'class:9:EC004718': CLASS,
  'class:9:EC000529': CLASS2,
}
globalThis.fetch = async url => {
  const u = String(url)
  const json = d => ({ ok: true, json: async () => d })
  if (u === '/api/plugins/etim/data') return json(Object.keys(PLUGIN_DATA))
  if (u.startsWith('/api/plugins/etim/data?values=true&prefix=')) { const pre = decodeURIComponent(u.split('prefix=')[1]); return json(Object.fromEntries(Object.entries(PLUGIN_DATA).filter(([k]) => k.startsWith(pre)))) }
  if (u.startsWith('/api/plugins/etim/data/')) { const n = decodeURIComponent(u.slice('/api/plugins/etim/data/'.length)); return n in PLUGIN_DATA ? json(PLUGIN_DATA[n]) : { ok: false, json: async () => null } }
  if (u === '/api/tree') return json(TREE)
  if (/^\/api\/nodes\/[^/?]+$/.test(u)) return json(apiNode(decodeURIComponent(u.slice('/api/nodes/'.length))))
  if (u.startsWith('/api/nodes/')) return json(apiTable(u))
  return { ok: false, json: async () => null }
}
// GET /api/nodes/<id> (Knoten mit eigenen Werten und Vorfahren) — daraus liest das Plugin die wirksame Klasse
function apiNode(id) {
  const r = TREE.find(x => x.id === id)
  const vals = o => Object.entries(VALUES[o] ?? {}).map(([attribute, value]) => ({ attribute, value, locale: null, channel: null, row: null }))
  const anc = []; for (let p = r?.parent; p; p = TREE.find(x => x.id === p)?.parent) anc.push({ id: p, label: TREE.find(x => x.id === p).label, values: vals(p) })
  return { id, role: r?.role, name: null, values: vals(id), ancestors: anc, groups: NODE_GROUPS, rows: {}, computed: [] }
}
function apiTable(u) {
  const id = decodeURIComponent(u.slice('/api/nodes/'.length).split('/')[0])
  const q = new URLSearchParams(u.split('?')[1] ?? '')
  const keys = (q.get('attributes') ?? '').split(',').filter(Boolean)
  const ids = q.get('self') === 'true' ? [id] : deep(id).map(r => r.id)
  return { node: { id }, columns: keys.map(k => ({ key: k, type: k === 'etim_class' ? 'enum' : 'text' })), rows: ids.map(rowOf) }
}
const MODEL = { masterLocale: 'de', locales: [{ code: 'de' }], groups: [{ key: 'etim', label: { de: 'ETIM' }, attributes: ['etim_class'] }, { key: 'etim_ec004718', label: { de: 'EC004718 Laptop' }, attributes: ['ef008851', 'ef000008', 'ef000007', 'tastatur_name'] }, { key: 'tech', label: { de: 'Technik' }, attributes: ['tastatur_name'] }],
  attributes: [{ key: 'etim_class', type: 'enum', group: 'etim', label: { de: 'ETIM-Klasse' } }, { key: 'ef008851', type: 'boolean', group: 'etim', label: { de: 'Wi-Fi' } }, { key: 'ef000008', type: 'decimal', group: 'etim', label: { de: 'Breite' } }, { key: 'ef000007', type: 'enum', group: 'etim', list: 'ef000007', label: { de: 'Farbe' } }, { key: 'tastatur_name', type: 'text', group: 'tech', label: { de: 'Tastatur' } }], lists: [] }
const ctx = {
  api: { get: async p => /^\/api\/nodes\/[^/?]+$/.test(p) ? apiNode(decodeURIComponent(p.slice('/api/nodes/'.length))) : apiTable(p), post: async (p, b) => /\/table$/.test(p) ? apiTable(`${p}?attributes=${(b?.attributes ?? []).join(',')}${b?.self ? '&self=true' : ''}`) : ({}), del: async () => ({}) },   // die Tabelle kommt als POST (Spalten im Rumpf)
  store: { model: MODEL, toast() {}, poll: async () => {}, actor: 'test' },
  tree: { loaded: true, rows: TREE, byId: new Map(TREE.map(r => [r.id, r])), kids: kidsOf, below: id => { const out = []; const walk = x => { for (const k of kidsOf(x)) { out.push(k); walk(k.id) } }; walk(id); return out }, ancestors: id => { const out = []; for (let p = TREE.find(r => r.id === id)?.parent; p; p = TREE.find(r => r.id === p)?.parent) out.unshift(TREE.find(r => r.id === p)); return out }, load: async () => {} },
  go() {}, data: { get: async n => PLUGIN_DATA[n] ?? null, set: async () => {}, list: async () => Object.keys(PLUGIN_DATA) }, dialog: {}, mapper: {}, ai: { available: () => false },
}

test('Band am Produkt: Kopfzeile, Klassentabelle und je Unterknoten eine Zeile', async () => {
  const mod = await import('../../plugins/etim/entry.js')
  const band = mod.default.nodeBands[0]
  const head = mkEl('h2'), body = mkEl('div')
  await band.mount({ head, body }, 'p-1', ctx)
  await new Promise(r => setTimeout(r, 30))
  const h = textOf(head), b = textOf(body)
  assert.match(h, /EC004718 Laptop/), assert.match(h, /zugeordnet 4\/4/)
  assert.match(b, /EC004718/)                                    // Klassentabelle
  assert.match(b, /4 Knoten|4\b/)
  for (const label of ['HP Notebook 255 G10', 'a', 'b', 'c']) assert.ok(b.includes(label), `Zeile für ${label} fehlt in:\n${b}`)
  assert.match(b, /EF003105/)                                    // „nicht verfügbar“ am Produkt
  assert.match(b, /nicht verfügbar/)
  assert.match(b, /„Lila“ passt nicht \(Liste: rot\)/)           // b
  assert.match(b, /✓ ◆ a 4 von 4 gefüllt 100 %/)                 // vollständiger Knoten steht mit ✓ in der Liste
  assert.match(b, /◆ c 0 von 4 gefüllt 0 %/)                     // leerer Knoten ebenfalls
  assert.match(b, /6 von 15/)                                     // Zahl der Klassentabelle = Summe der Knotenzeilen (1+4+1+0)
  console.log('\n--- Kopf ---\n' + h + '\n--- Körper ---\n' + b + '\n')
})

test('Gruppe entfernt (Sackgasse): eine Zeile statt 35, Warnung und der Weg zurück im Band', async () => {
  const mod = await import('../../plugins/etim/entry.js')
  const band = mod.default.nodeBands[0]
  // die Gruppe etim hängt nirgends mehr: kein ETIM-Attribut gilt an den Knoten
  const before = JSON.stringify(INACTIVE)
  for (const id of ['p-1', 'v-1', 'v-2', 'v-3']) INACTIVE[id] = ['ef008851', 'ef000008', 'ef000007', 'tastatur_name']
  NODE_GROUPS.length = 0
  const head = mkEl('h2'), body = mkEl('div')
  await band.mount({ head, body }, 'p-1', ctx)
  await new Promise(r => setTimeout(r, 30))
  const b = textOf(body), l = textOf(body).length
  assert.match(b, /4 von 4 ETIM-Attributen sind hier nicht verfügbar/)
  assert.ok((b.match(/nicht verfügbar/g) ?? []).length <= 4, 'je Knoten eine Zeile, nicht je Attribut')
  assert.match(textOf(head) + b, /Gruppe etim, etim_ec004718 gilt hier nicht/)
  assert.match(b, /Gruppe etim, etim_ec004718 anhängen/)
  assert.match(b, /✕ Klasse/)                                   // Klasse lässt sich entfernen
  Object.assign(INACTIVE, JSON.parse(before)); NODE_GROUPS.push({ key: 'etim', active: true }, { key: 'etim_ec004718', active: true })
})

test('Gruppe ganz gelöscht: der Knopf legt sie neu an', async () => {
  const mod = await import('../../plugins/etim/entry.js')
  const band = mod.default.nodeBands[0]
  const groups = MODEL.groups; MODEL.groups = groups.filter(g => g.key !== 'etim')   // Gruppe aus dem Modell entfernt
  NODE_GROUPS.length = 0
  const head = mkEl('h2'), body = mkEl('div')
  await band.mount({ head, body }, 'p-1', ctx)
  await new Promise(r => setTimeout(r, 30))
  const b = textOf(body)
  assert.match(b, /Gruppe etim fehlt im Modell/)
  assert.match(b, /Gruppe etim, etim_ec004718 anlegen und anhängen/)
  MODEL.groups = groups; NODE_GROUPS.push({ key: 'etim', active: true }, { key: 'etim_ec004718', active: true })
})

test('keine Sammelgruppe mit Abschnitten: die Gruppe einer Klasse ist ein eigener Reiter, im Journal steht keine Sicht', async () => {
  const mod = await import('../../plugins/etim/entry.js')
  const put = []
  const ctx2 = { ...ctx, api: { ...ctx.api, post: async (p, b, m) => { put.push([p, b, m]); return {} } } }
  const head = mkEl('h2'), body = mkEl('div')
  await mod.default.nodeBands[0].mount({ head, body }, 'p-1', ctx2)
  await new Promise(r => setTimeout(r, 30))
  assert.deepEqual(put.filter(([p]) => p.startsWith('/api/model/views/')), [], 'keine Sicht im Journal')
  assert.equal(mod.default.nodeViews, undefined, 'die Gliederung nach Klassenmengen entfällt: jede Klasse hat ihre Gruppe')
  assert.doesNotMatch(textOf(body), /◫ Sicht/)
})

test('jeder Knopf im Band lässt sich drücken, ohne dass etwas fehlt', async () => {
  const mod = await import('../../plugins/etim/entry.js')
  const calls = []; const errors = []
  const ctx2 = { ...ctx, api: { ...ctx.api, post: async (p, b, m) => { calls.push([p, m ?? 'POST']); return {} } }, store: { ...ctx.store, toast: (t, k) => { if (k !== 'ok') errors.push(t) }, poll: async () => {}, save() {}, viewKey: {} }, dialog: { confirm: async () => true } }
  NODE_GROUPS.length = 0   // Gruppe hängt nicht → „anhängen“ ist da
  const head = mkEl('h2'), body = mkEl('div')
  await mod.default.nodeBands[0].mount({ head, body }, 'p-1', ctx2)
  await new Promise(r => setTimeout(r, 30))
  const buttons = []; const walk = e => { if (typeof e === 'string') return; if (e.tag === 'button' && e.onclick) buttons.push(e); for (const k of e.kids ?? []) walk(k) }
  walk(body)
  assert.ok(buttons.length >= 4, `${buttons.length} Knöpfe`)
  for (const b of buttons) { try { await b.onclick({ preventDefault() {}, stopPropagation() {} }) } catch (e) { errors.push(`${(b.kids ?? []).join('')}: ${e.message}`) } }
  assert.deepEqual(errors, [], 'kein Knopf darf scheitern')
  assert.ok(calls.some(([p, m]) => /\/groups$/.test(p) && m === 'PUT'), 'Gruppe anhängen schreibt')
  NODE_GROUPS.push({ key: 'etim', active: true }, { key: 'etim_ec004718', active: true })
})

// ---- Eine Klasse, eine Attributgruppe: das Band hängt die Gruppen an und nimmt die Klasse samt ihrer Gruppe wieder weg
async function bandKnoepfe(ctx2, nodeId = 'p-1') {
  const mod = await import('../../plugins/etim/entry.js')
  const head = mkEl('h2'), body = mkEl('div')
  await mod.default.nodeBands[0].mount({ head, body }, nodeId, ctx2)
  await new Promise(r => setTimeout(r, 30))
  const buttons = []; const walk = e => { if (typeof e === 'string') return; if (e.tag === 'button' && e.onclick) buttons.push(e); for (const k of e.kids ?? []) walk(k) }
  walk(body)
  return buttons.map(b => ({ text: textOf(b).trim(), click: () => b.onclick({ preventDefault() {}, stopPropagation() {} }) }))
}

test('die Klasse entfernen ruft den Server, der auch ihre Gruppe abnimmt', async () => {
  const calls = []
  const ctx2 = { ...ctx, api: { ...ctx.api, post: async (p, b, m) => { calls.push([p, b, m ?? 'POST']); return {} } }, dialog: { confirm: async () => true } }
  const knoepfe = await bandKnoepfe(ctx2)
  await knoepfe.find(k => k.text === '✕ Klasse').click()
  const c = calls.find(([p]) => p === '/api/classification/clear')
  assert.equal(c[1].node, 'p-1'); assert.equal(c[1].system.group, 'etim'); assert.equal(c[1].system.classAttr, 'etim_class')
})

test('gelten die Gruppen hier nicht, hängt der Knopf beide an: die des Systems und die der Klasse', async () => {
  const calls = []
  const ctx2 = { ...ctx, api: { ...ctx.api, post: async (p, b, m) => { calls.push([p, b, m ?? 'POST']); return {} } } }
  NODE_GROUPS.length = 0
  const knoepfe = await bandKnoepfe(ctx2)
  await knoepfe.find(k => /Gruppe etim, etim_ec004718 anhängen/.test(k.text)).click()
  const puts = calls.filter(([p, , m]) => p === '/api/nodes/p-1/groups' && m === 'PUT').map(([, b]) => b.groups)
  assert.deepEqual(puts, [['etim'], ['etim', 'etim_ec004718']])
  NODE_GROUPS.push({ key: 'etim', active: true }, { key: 'etim_ec004718', active: true })
})

test('gilt nur die Gruppe der Klasse nicht, nennt das Band nur sie', async () => {
  NODE_GROUPS.length = 0; NODE_GROUPS.push({ key: 'etim', active: true })
  const knoepfe = await bandKnoepfe({ ...ctx })
  assert.ok(knoepfe.some(k => k.text === '⌗ Gruppe etim_ec004718 anhängen'), knoepfe.map(k => k.text).join(' | '))
  NODE_GROUPS.length = 0; NODE_GROUPS.push({ key: 'etim', active: true }, { key: 'etim_ec004718', active: true })
})

test('Bestand der früheren Bauart: das Band bietet die Umstellung an und ruft den Server', async () => {
  const attrs = MODEL.attributes
  MODEL.attributes = attrs.map(a => a.key === 'ef008851' ? { ...a, when: { attribute: 'etim_class', values: ['EC004718'] } } : a)
  const calls = []
  const ctx2 = { ...ctx, api: { ...ctx.api, post: async (p, b, m) => { calls.push([p, b, m ?? 'POST']); return { groups: 1, attributes: 1, nodes: 1 } } } }
  const knoepfe = await bandKnoepfe(ctx2)
  await knoepfe.find(k => k.text === '⌗ auf Klassengruppen umstellen').click()
  const c = calls.find(([p]) => p === '/api/classification/migrate')
  assert.equal(c[1].dryRun, false); assert.equal(c[1].system.group, 'etim')
  MODEL.attributes = attrs
  assert.ok(!(await bandKnoepfe({ ...ctx })).some(k => /umstellen/.test(k.text)), 'ohne Bestand der früheren Bauart keine Umstellung')
})

test('install beim Einschalten: Gruppe class_etim anlegen und an die Wurzel hängen (die veraltete Einstellung „etim“ gilt nicht mehr)', async () => {
  const mod = await import('../../plugins/etim/entry.js')
  const calls = []
  const groups = MODEL.groups; MODEL.groups = groups.filter(g => g.key !== 'etim')   // Gruppe fehlt im Modell
  const rootRow = { id: 'g-root', role: 'group', label: 'Mastertree', parent: null, groups: '' }
  TREE.push(rootRow); const g1 = TREE.find(r => r.id === 'g-1'); g1.parent = 'g-root'
  const ctx2 = { ...ctx, api: { ...ctx.api, post: async (p, b, m) => { calls.push([p, b, m ?? 'POST']); return p === '/api/classification/ensure' ? { group: b.system.group, classAttr: b.system.classAttr } : {} } },
    tree: { ...ctx.tree, rows: TREE, byId: new Map(TREE.map(r => [r.id, r])), load: async () => {} }, store: { ...ctx.store, poll: async () => {} } }
  await mod.default.install(ctx2)
  // das Anlegen im Modell macht der Server; beim Einschalten entstehen die Systemobjekte: die Gruppe und das Klassenattribut
  const ensure = calls.find(([p]) => p === '/api/classification/ensure')
  assert.ok(ensure, 'Gruppe angefordert: ' + JSON.stringify(calls.map(c => c[0])))
  assert.equal(ensure[1].groupOnly, false, 'die Systemobjekte entstehen ganz: Gruppe und Klassenattribut'); assert.equal(ensure[1].system.group, 'class_etim'); assert.equal(ensure[1].system.classAttr, 'etim_class', 'das vorhandene Klassenattribut der Einstellung bleibt'); assert.equal(ensure[1].system.plugin, 'etim')
  const attach = calls.find(([p, , m]) => p === '/api/nodes/g-root/groups' && m === 'PUT')
  assert.ok(attach, 'an die Wurzel gehängt'); assert.deepEqual(attach[1].groups, ['class_etim'])
  MODEL.groups = groups; g1.parent = null; TREE.splice(TREE.indexOf(rootRow), 1)
})

test('Namenskollision: nennt der Server eine andere Gruppe, gilt sie ab jetzt — sie wird an die Wurzel gehängt und gemerkt', async () => {
  const mod = await import('../../plugins/etim/entry.js')
  const calls = [], gemerkt = []
  // der Server hat die Kollision erkannt (seine Regel: ClassificationTests.cs) und weicht auf class_etim_std aus
  const ctx2 = { ...ctx, api: { ...ctx.api, post: async (p, b, m) => { calls.push([p, b, m ?? 'POST']); return p === '/api/classification/ensure' ? { group: 'class_etim_std', classAttr: 'etim_class', groupRenamed: { from: 'class_etim', to: 'class_etim_std' } } : {} } },
    data: { ...ctx.data, set: async (k, v) => { gemerkt.push([k, v.group]) } }, store: { ...ctx.store, poll: async () => {}, toast: () => {} } }
  await mod.default.install(ctx2)
  assert.equal(calls.find(([p]) => p === '/api/classification/ensure')[1].system.group, 'class_etim', 'angefragt wird der gewünschte Schlüssel')
  assert.deepEqual(gemerkt, [['settings', 'class_etim_std']])
  const attach = calls.find(([p, , m]) => /\/groups$/.test(p) && m === 'PUT' && p.startsWith('/api/nodes/'))
  assert.ok(attach[1].groups.includes('class_etim_std'))
})
