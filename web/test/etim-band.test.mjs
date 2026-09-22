// Das ETIM-Band wirklich zeichnen (Taloan, 22.09.2026: „schau dir selbst an, was du gebaut hast“): ein Minimal-DOM und eine
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
const TREE = [
  { id: 'g-1', role: 'group', label: 'Mobile Geräte', parent: null },
  { id: 'p-1', role: 'product', label: 'HP Notebook 255 G10', parent: 'g-1' },
  { id: 'v-1', role: 'variant', label: 'a', parent: 'p-1' }, { id: 'v-2', role: 'variant', label: 'b', parent: 'p-1' }, { id: 'v-3', role: 'variant', label: 'c', parent: 'p-1' },
]
const VALUES = {   // eigene Werte je Knoten
  'p-1': { etim_class: 'EC004718', ef008851: 'true' },
  'v-1': { ef008851: 'true', ef000008: '350', ef000007: 'rot', tastatur_name: 'ja' },     // vollständig
  'v-2': { ef008851: 'true', ef000007: 'Lila' },                                            // einer passt nicht
  'v-3': {},                                                                                // leer
}
const INACTIVE = { 'p-1': ['tastatur_name'] }
const NODE_GROUPS = [{ key: 'etim', active: true, attributes: ['etim_class', 'ef008851', 'ef000008', 'ef000007'] }]   // was am Knoten gilt   // am Produkt gilt das zugeordnete Attribut nicht
const own = (id, key) => VALUES[id]?.[key]
const resolved = (id, key) => own(id, key) ?? (key === 'etim_class' ? (TREE.find(r => r.id === id)?.parent ? resolved(TREE.find(r => r.id === id).parent, key) : undefined) : undefined)
const rowOf = id => { const r = TREE.find(x => x.id === id); const values = {}; for (const k of ['etim_class', 'ef008851', 'ef000008', 'ef000007', 'tastatur_name']) { const v = resolved(id, k); if (v != null) values[k] = { value: v, own: own(id, k) != null } } return { row: { id, label: r.label, role: r.role, parent: r.parent }, values, inactive: INACTIVE[id] ?? [] } }
const kidsOf = id => TREE.filter(r => r.parent === id)
const deep = id => kidsOf(id).flatMap(k => [k, ...deep(k.id)])

const PLUGIN_DATA = {
  settings: { classAttr: 'etim_class', unknownAs: 'UN', group: 'etim' },
  map: { EF003105: 'tastatur_name' },
  mapping: {},
  release: { version: '9', number: 9, name: 'ETIM 9.0', classes: 1 },
  'class:9:EC004718': CLASS,
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
const MODEL = { masterLocale: 'de', locales: [{ code: 'de' }], groups: [{ key: 'etim', label: { de: 'ETIM' }, attributes: ['etim_class', 'ef008851', 'ef000008', 'ef000007'] }, { key: 'tech', label: { de: 'Technik' }, attributes: ['tastatur_name'] }],
  attributes: [{ key: 'etim_class', type: 'enum', group: 'etim', label: { de: 'ETIM-Klasse' } }, { key: 'ef008851', type: 'boolean', group: 'etim', label: { de: 'Wi-Fi' } }, { key: 'ef000008', type: 'decimal', group: 'etim', label: { de: 'Breite' } }, { key: 'ef000007', type: 'enum', group: 'etim', list: 'ef000007', label: { de: 'Farbe' } }, { key: 'tastatur_name', type: 'text', group: 'tech', label: { de: 'Tastatur' } }], lists: [] }
const ctx = {
  api: { get: async p => /^\/api\/nodes\/[^/?]+$/.test(p) ? apiNode(decodeURIComponent(p.slice('/api/nodes/'.length))) : apiTable(p), post: async () => ({}), del: async () => ({}) },
  store: { model: MODEL, toast() {}, poll: async () => {}, actor: 'test' },
  tree: { loaded: true, rows: TREE, byId: new Map(TREE.map(r => [r.id, r])), kids: kidsOf, ancestors: id => { const out = []; for (let p = TREE.find(r => r.id === id)?.parent; p; p = TREE.find(r => r.id === p)?.parent) out.unshift(TREE.find(r => r.id === p)); return out }, load: async () => {} },
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

test('Gruppe entfernt (Sackgasse, Taloan 22.09.): eine Zeile statt 35, Warnung und der Weg zurück im Band', async () => {
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
  assert.match(textOf(head) + b, /Gruppe etim gilt hier nicht/)
  assert.match(b, /Gruppe etim anhängen/)
  assert.match(b, /✕ Klasse/)                                   // Klasse lässt sich entfernen
  Object.assign(INACTIVE, JSON.parse(before)); NODE_GROUPS.push({ key: 'etim', active: true, attributes: ['etim_class', 'ef008851', 'ef000008', 'ef000007'] })
})

test('Gruppe ganz gelöscht: der Knopf legt sie neu an (Taloan, 22.09.: „ich habe überhaupt keine Attributgruppe zur Verfügung“)', async () => {
  const mod = await import('../../plugins/etim/entry.js')
  const band = mod.default.nodeBands[0]
  const groups = MODEL.groups; MODEL.groups = groups.filter(g => g.key !== 'etim')   // Gruppe aus dem Modell entfernt
  NODE_GROUPS.length = 0
  const head = mkEl('h2'), body = mkEl('div')
  await band.mount({ head, body }, 'p-1', ctx)
  await new Promise(r => setTimeout(r, 30))
  const b = textOf(body)
  assert.match(b, /Gruppe etim fehlt im Modell/)
  assert.match(b, /Gruppe etim anlegen und anhängen/)
  MODEL.groups = groups; NODE_GROUPS.push({ key: 'etim', active: true, attributes: ['etim_class', 'ef008851', 'ef000008', 'ef000007'] })
})

test('Attributsicht je Klasse (Taloan, 22.09.): je Rolle eine Sicht mit genau den Attributen der Klasse', async () => {
  const mod = await import('../../plugins/etim/entry.js')
  const put = []
  const ctx2 = { ...ctx, api: { ...ctx.api, post: async (p, b, m) => { put.push([p, b, m]); return {} } } }
  const band = mod.default.nodeBands[0]
  const head = mkEl('h2'), body = mkEl('div')
  await band.mount({ head, body }, 'p-1', ctx2)
  await new Promise(r => setTimeout(r, 30))
  // den Knopf „◫ Sicht“ finden und auslösen
  const find = e => typeof e === 'string' ? null : (e.tag === 'button' && (e.kids ?? []).includes('◫ Sicht') ? e : (e.kids ?? []).map(find).find(Boolean))
  const btn = find(body); assert.ok(btn, 'Knopf ◫ Sicht fehlt')
  await btn.onclick?.({ preventDefault() {}, stopPropagation() {} })
  const views = put.filter(([p]) => p.startsWith('/api/model/views/'))
  assert.equal(views.length, 3, 'je Rolle eine Sicht (group, product, variant) — ETIM-Attribute gelten überall (Taloan, 22.09.)')
  const [path, body2] = views[0]
  assert.match(path, /etim_ec004718_(group|product|variant)/)
  assert.equal(body2.level, 'group')
  assert.match(body2.label.de, /⌗ EC004718 Laptop/)
  const all = body2.items.flatMap(i => i.order)
  assert.ok(all.includes('etim_class') && all.includes('ef008851') && all.includes('tastatur_name'), JSON.stringify(body2.items))
})

test('jeder Knopf im Band lässt sich drücken, ohne dass etwas fehlt (Taloan, 22.09.: „api is not defined“)', async () => {
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
  NODE_GROUPS.push({ key: 'etim', active: true, attributes: ['etim_class', 'ef008851', 'ef000008', 'ef000007'] })
})

test('install beim Einschalten: Gruppe etim anlegen und an die Wurzel hängen (Taloan, 22.09.)', async () => {
  const mod = await import('../../plugins/etim/entry.js')
  const calls = []
  const groups = MODEL.groups; MODEL.groups = groups.filter(g => g.key !== 'etim')   // Gruppe fehlt im Modell
  const rootRow = { id: 'g-root', role: 'group', label: 'Mastertree', parent: null, groups: '' }
  TREE.push(rootRow); const g1 = TREE.find(r => r.id === 'g-1'); g1.parent = 'g-root'
  const ctx2 = { ...ctx, api: { ...ctx.api, post: async (p, b, m) => { calls.push([p, b, m ?? 'POST']); return {} } },
    tree: { ...ctx.tree, rows: TREE, byId: new Map(TREE.map(r => [r.id, r])), load: async () => {} }, store: { ...ctx.store, poll: async () => {} } }
  await mod.default.install(ctx2)
  assert.ok(calls.some(([p, b, m]) => p === '/api/model/groups/etim' && m === 'PUT'), 'Gruppe angelegt: ' + JSON.stringify(calls.map(c => c[0])))
  const attach = calls.find(([p, , m]) => p === '/api/nodes/g-root/groups' && m === 'PUT')
  assert.ok(attach, 'an die Wurzel gehängt'); assert.deepEqual(attach[1].groups, ['etim'])
  MODEL.groups = groups; g1.parent = null; TREE.splice(TREE.indexOf(rootRow), 1)
})

test('Namenskollision (Taloan, 22.09.): fremde Gruppe etim wird nicht übernommen — ETIM weicht aus', async () => {
  const mod = await import('../../plugins/etim/entry.js')
  const calls = []
  const groups = MODEL.groups, attrs = MODEL.attributes
  MODEL.groups = [...groups, { key: 'etim', label: { de: 'ETIM (fremd)' }, attributes: ['kundenfeld'] }]
  MODEL.attributes = [...attrs, { key: 'kundenfeld', type: 'text', group: 'etim', label: { de: 'Kundenfeld' } }]   // fremdes Attribut in der Gruppe
  const ctx2 = { ...ctx, api: { ...ctx.api, post: async (p, b, m) => { calls.push([p, b, m ?? 'POST']); return {} } },
    data: { ...ctx.data, set: async () => {} }, store: { ...ctx.store, poll: async () => {}, toast: () => {} } }
  await mod.default.install(ctx2)
  const made = calls.filter(([p, , m]) => p.startsWith('/api/model/groups/') && m === 'PUT').map(([p]) => p)
  assert.deepEqual(made, ['/api/model/groups/etim_std'], 'nicht in die fremde Gruppe, sondern etim_std: ' + JSON.stringify(made))
  const attach = calls.find(([p, , m]) => /\/groups$/.test(p) && m === 'PUT' && p.startsWith('/api/nodes/'))
  assert.ok(attach[1].groups.includes('etim_std'))
  MODEL.groups = groups; MODEL.attributes = attrs
})
