// Einschalten von ETIM und GPC: der Hinweis nennt Gruppe und Klassenattribut (class_etim, class_gpc), lehnt der Anwender ab, geschieht nichts,
// ist schon alles da, erscheint kein Hinweis. Veraltete Einstellungen (eine Gruppe oder ein Attribut, das es nicht mehr gibt) gelten nicht mehr.
// Der Server ist ein Stellvertreter: geprüft wird, was das Plugin ihm schickt.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'

// ETIM lädt seine Einstellungen beim Import über fetch — ein früherer Stand nannte die Gruppe etim und das Attribut etim_class
globalThis.fetch = async url => {
  const u = String(url)
  if (u === '/api/plugins/etim/data') return { ok: true, json: async () => ['settings'] }
  if (u === '/api/plugins/etim/data/settings') return { ok: true, json: async () => ({ classAttr: 'etim_class', group: 'etim' }) }
  return { ok: false, json: async () => null }
}
const etim = (await import('../../plugins/etim/entry.js')).default
const { einschalten } = await import('../../plugins/gpc/core.mjs')
const t = (k, p = []) => k.replace(/\{(\d+)\}/g, (_, i) => p[i] ?? '')

const wurzeln = () => [{ id: 'w1', role: 'group', label: 'Sortiment A', parent: null, groups: '' }, { id: 'w2', role: 'group', label: 'Sortiment B', parent: null, groups: 'andere' },
  { id: 'k1', role: 'product', label: 'Kind', parent: 'w1', groups: '' }]
function welt({ modell = {}, annehmen = true, einstellungen = {} } = {}) {
  const gepostet = [], hinweise = [], gemerkt = []
  const model = { masterLocale: 'de', locales: [{ code: 'de' }], groups: [], attributes: [], lists: [], units: [], ...modell }
  const rows = wurzeln()
  const ctx = {
    api: {
      get: async p => String(p).includes('/gpc/data/settings') ? { ...einstellungen } : null,
      post: async (p, b, m) => { gepostet.push([p, b, m ?? 'POST']); return p === '/api/classification/ensure' ? { group: b.system.group, classAttr: b.system.classAttr } : {} },
    },
    store: { model, poll: async () => {}, toast: () => {} },
    tree: { loaded: true, rows, byId: new Map(rows.map(r => [r.id, r])), load: async () => {} },
    data: { get: async () => null, set: async (k, v) => { gemerkt.push([k, JSON.parse(JSON.stringify(v))]) } },
    system: { ankuendigen: async o => { hinweise.push(o); return annehmen } },
  }
  return { ctx, gepostet, hinweise, gemerkt }
}
const ensureVon = w => w.gepostet.find(([p]) => p === '/api/classification/ensure')
const anWurzeln = w => w.gepostet.filter(([p, , m]) => /^\/api\/nodes\/[^/]+\/groups$/.test(p) && m === 'PUT')

// ---- ETIM

test('ETIM: der Hinweis nennt class_etim für Gruppe und Attribut, nicht die veralteten Namen; die veralteten Einstellungen sind danach gelöscht', async () => {
  const w = welt()
  await etim.install(w.ctx)
  assert.equal(w.hinweise.length, 1)
  assert.match(w.hinweise[0].text, /Attributgruppe class_etim mit dem Attribut class_etim/)
  assert.doesNotMatch(w.hinweise[0].text, /etim_class|Attributgruppe etim /)
  assert.equal(w.hinweise[0].label, 'ETIM')
  const s = ensureVon(w)[1].system
  assert.equal(s.group, 'class_etim'); assert.equal(s.classAttr, 'class_etim'); assert.equal(s.plugin, 'etim')
  const einstellung = w.gemerkt.find(([k]) => k === 'settings')?.[1]
  assert.ok(einstellung, 'die bereinigten Einstellungen sind gespeichert')
  assert.equal(einstellung.group, undefined); assert.equal(einstellung.classAttr, 'class_etim')
})

test('ETIM: nach dem Hinweis hängt die Gruppe an jede Wurzel, die sie noch nicht trägt', async () => {
  const w = welt()
  await etim.install(w.ctx)
  assert.deepEqual(anWurzeln(w).map(([p, b]) => [p, b.groups]), [['/api/nodes/w1/groups', ['class_etim']], ['/api/nodes/w2/groups', ['andere', 'class_etim']]])
})

test('ETIM: lehnt der Anwender ab, legt das Plugin nichts an und hängt nichts an', async () => {
  const w = welt({ annehmen: false })
  assert.equal(await etim.install(w.ctx), false)
  assert.equal(ensureVon(w), undefined); assert.deepEqual(anWurzeln(w), [])
})

test('ETIM: gibt es Gruppe und Klassenattribut schon, erscheint kein Hinweis', async () => {
  const w = welt({ modell: { groups: [{ key: 'class_etim' }], attributes: [{ key: 'class_etim', type: 'enum' }] } })
  await etim.install(w.ctx)
  assert.deepEqual(w.hinweise, [])
})

// ---- GPC

test('GPC: der Hinweis nennt class_gpc für Gruppe und Attribut, nicht die veralteten Namen aus den Einstellungen', async () => {
  const w = welt({ einstellungen: { group: 'gpc', classAttr: 'gpc_class' } })
  await einschalten(w.ctx, t)
  assert.equal(w.hinweise.length, 1)
  assert.match(w.hinweise[0].text, /Attributgruppe class_gpc mit dem Attribut class_gpc/)
  assert.doesNotMatch(w.hinweise[0].text, /gpc_class/)
  const s = ensureVon(w)[1].system
  assert.equal(s.group, 'class_gpc'); assert.equal(s.classAttr, 'class_gpc'); assert.equal(s.plugin, 'gpc')
  const eins = w.gepostet.find(([p, , m]) => p === '/api/plugins/gpc/data/settings' && m === 'PUT')
  assert.deepEqual(eins[1], {}, 'die veralteten Einstellungen sind gelöscht')
})

test('GPC: nach dem Hinweis hängt die Gruppe an jede Wurzel, die sie noch nicht trägt', async () => {
  const w = welt()
  await einschalten(w.ctx, t)
  assert.deepEqual(anWurzeln(w).map(([p, b]) => [p, b.groups]), [['/api/nodes/w1/groups', ['class_gpc']], ['/api/nodes/w2/groups', ['andere', 'class_gpc']]])
})

test('GPC: lehnt der Anwender ab, legt das Plugin nichts an und hängt nichts an', async () => {
  const w = welt({ annehmen: false })
  assert.equal(await einschalten(w.ctx, t), false)
  assert.equal(ensureVon(w), undefined); assert.deepEqual(anWurzeln(w), [])
})

test('GPC: gibt es Gruppe und Klassenattribut schon, erscheint kein Hinweis; eine gewählte Gruppe bleibt in den Einstellungen', async () => {
  const w = welt({ modell: { groups: [{ key: 'class_gpc_2' }, { key: 'class_gpc' }], attributes: [{ key: 'class_gpc', type: 'enum' }] }, einstellungen: { group: 'class_gpc_2' } })
  await einschalten(w.ctx, t)
  assert.deepEqual(w.hinweise, [])
  assert.equal(w.gepostet.find(([p, , m]) => p === '/api/plugins/gpc/data/settings' && m === 'PUT'), undefined, 'eine vorhandene Gruppe in den Einstellungen gilt weiter')
  assert.equal(ensureVon(w)[1].system.group, 'class_gpc_2')
})
