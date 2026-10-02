// Der Ablauf eines Solr-Imports.
// Er steht seit heute in plugins/solr/lauf.mjs und wird von beiden Wegen benutzt: von der Ansicht im Browser und vom
// Job auf dem Server. Genau deshalb lässt er sich hier prüfen, ohne Browser und ohne Solr: die Umgebung ist ein
// Fake-Client und eine Fake-API, und geprüft wird, was an Befehlen herauskommt.
import test from 'node:test'
import assert from 'node:assert/strict'

const { plane, schreibe, skipListe, rechteVon } = await import('../../plugins/solr/lauf.mjs')

/// Eine kleine Quelle: eine Gruppe mit einem Produkt und zwei Varianten
const DOCS = [
  { id: 'g1', master_id: 'G1', type: 'group', name: 'Notebooks', lang: 'de', main_parent_id: '' },
  { id: 'p1', master_id: 'P1', type: 'product', name: 'ProBook', lang: 'de', main_parent_id: 'g1', property__sku__string: 'SKU-1' },
  { id: 'v1', master_id: 'V1', type: 'productVariant', name: 'ProBook 16', lang: 'de', main_parent_id: 'p1', property__sku__string: 'SKU-1-16' },
  { id: 'v2', master_id: 'V2', type: 'productVariant', name: 'ProBook 14', lang: 'de', main_parent_id: 'p1', property__sku__string: 'SKU-1-14' },
]

const client = {
  subtree: async (wurzel, onPage) => { onPage?.(DOCS.length, DOCS.length); return DOCS },
  byIds: async () => [],
  propertyDefs: async () => ({}),
}

const MODELL = {
  attributes: [{ key: 'name', type: 'text', group: 'stamm' }, { key: 'sku', type: 'text', group: 'stamm' }],
  groups: [{ key: 'stamm', label: { de: 'Stammdaten' } }],
}

function umgebungMit({ baum = [], stapel = [] } = {}) {
  return {
    sag: () => {},
    modell: MODELL,
    baum,
    frisch: async () => {},
    api: {
      get: async () => ({ values: [], out: [] }),
      post: async () => ({ ok: true }),
      batchChunked: async cmds => {
        stapel.push(cmds)
        // der Server gibt je Befehl mit ref einen Knoten zurück
        const results = cmds.map((c, i) => ({ index: i, ref: c.ref, node: c.ref ? 'n-' + c.ref : undefined }))
        return { batch: 'b-test', results, error: null, errors: [], refs: new Map() }
      },
    },
  }
}

test('der Plan kennt Gruppe, Produkt und Varianten — und was dem Modell fehlt', async () => {
  const plan = await plane({ client, umgebung: umgebungMit(), wurzeln: ['g1'], skip: skipListe('') })
  assert.equal(plan.items.length, 4)
  assert.deepEqual(plan.items.map(i => i.role), ['group', 'product', 'variant', 'variant'])
  assert.equal(plan.items[0].top, true, 'die Wurzel ist als solche erkannt')
  assert.ok(plan.items.every(i => i.existing === null), 'nichts davon gibt es schon')
})

test('was schon da ist, wird nicht noch einmal angelegt', async () => {
  const baum = [{ id: 'k-alt', role: 'group', external: { solr: 'G1' }, groups: 'stamm' }]
  const plan = await plane({ client, umgebung: umgebungMit({ baum }), wurzeln: ['g1'], skip: skipListe('') })
  assert.equal(plan.items[0].existing?.id, 'k-alt', 'die Gruppe wurde über ihre Kennung wiedererkannt')
})

test('geschrieben wird in Stapeln: erst die Gruppen, dann je Produkt einer', async () => {
  const stapel = []
  const u = umgebungMit({ stapel })
  const plan = await plane({ client, umgebung: u, wurzeln: ['g1'], skip: skipListe('') })
  const { geschrieben, stapel: anzahl } = await schreibe({ plan, umgebung: u, ziel: 'k-ziel', skip: skipListe('') })

  assert.equal(anzahl, 2, 'ein Stapel für die Gruppen, einer für das Produkt mit seinen Varianten')
  assert.ok(geschrieben > 0)
  const ersterOps = stapel[0].map(c => c.op)
  assert.ok(ersterOps.includes('group.create'), 'die Gruppe wird angelegt')
  assert.ok(ersterOps.includes('external.link'), 'und bekommt ihre Kennung')
  assert.ok(ersterOps.includes('label.set'), 'die Wurzel bekommt das ★ auf name')
  const zweiterOps = stapel[1].map(c => c.op)
  assert.ok(zweiterOps.includes('product.create'))
  assert.equal(zweiterOps.filter(o => o === 'variant.create').length, 2, 'beide Varianten im selben Stapel wie ihr Produkt')
})

test('der Zielknoten trägt die Wurzel, wenn die Quelle keinen Vater hat', async () => {
  const stapel = []
  const u = umgebungMit({ stapel })
  const plan = await plane({ client, umgebung: u, wurzeln: ['g1'], skip: skipListe('') })
  await schreibe({ plan, umgebung: u, ziel: 'k-ziel', skip: skipListe('') })
  const create = stapel[0].find(c => c.op === 'group.create')
  assert.equal(create.args.parent, 'k-ziel')
})

// ---- Rechte: die Rolle des Laufs wird geprüft, bevor 17000 Knoten eingelesen sind

/// Eine Quelle in Seiten; zählt, wie viele Seiten abgeholt wurden. Die zweite Seite hat ein Attribut, das dem Modell fehlt.
function seitenClient(mitNeuem) {
  const seiten = [DOCS, mitNeuem ? [{ id: 'p2', master_id: 'P2', type: 'product', name: 'Zwei', lang: 'de', main_parent_id: 'g1', property__neu_attr__string: 'x' }] : []]
  const stand = { geholt: 0 }
  return {
    stand,
    subtree: async (wurzel, onPage) => {
      const alle = []
      for (const seite of seiten) { stand.geholt++; alle.push(...seite); onPage?.(alle.length, 17782, seite) }
      return alle
    },
    byIds: async () => [], propertyDefs: async () => ({}),
  }
}
const rechte = (rolle, ...rights) => ({ rolle, rights: new Set(rights) })

test('ohne das Recht write bricht der Import ab, bevor etwas eingelesen wird', async () => {
  const c = seitenClient(false)
  const u = { ...umgebungMit(), rechte: rechte('leser', 'read') }
  await assert.rejects(plane({ client: c, umgebung: u, wurzeln: ['g1'], skip: skipListe('') }), /Rolle leser darf nicht pflegen/)
  assert.equal(c.stand.geholt, 0, 'keine einzige Seite geholt')
})

test('ohne das Recht model und mit neuem Attribut bricht der Import nach der ersten Seite ab, die es braucht', async () => {
  const c = seitenClient(true)
  const u = { ...umgebungMit(), rechte: rechte('editor', 'read', 'write') }
  // die erste Seite braucht nichts Neues, die zweite ein Attribut: abgebrochen mit der Meldung, die Rolle und Attribut nennt
  await assert.rejects(plane({ client: c, umgebung: u, wurzeln: ['g1'], skip: skipListe('') }), /Rolle editor darf das Modell nicht ändern.*neu_attr/)
})

test('mit dem Recht model läuft derselbe Import durch', async () => {
  const c = seitenClient(true)
  const u = { ...umgebungMit(), rechte: rechte('admin', 'read', 'write', 'model') }
  const plan = await plane({ client: c, umgebung: u, wurzeln: ['g1'], skip: skipListe('') })
  assert.ok(plan.needs.newAttrs.has('neu_attr'))
})

test('ohne das Recht model, aber ohne Neues im Modell, läuft der Import durch', async () => {
  const c = seitenClient(false)
  const u = { ...umgebungMit(), rechte: rechte('editor', 'read', 'write') }
  const plan = await plane({ client: c, umgebung: u, wurzeln: ['g1'], skip: skipListe('') })
  assert.equal(plan.items.length, 4)
})

test('rechteVon: die Rechte der Rolle, und ohne Antwort (Server ohne Anwender) nichts zu prüfen', async () => {
  const r = await rechteVon({ get: async p => { assert.equal(p, '/api/auth/me'); return { role: 'editor', rights: ['read', 'write'] } } })
  assert.equal(r.rolle, 'editor'); assert.ok(r.rights.has('write') && !r.rights.has('model'))
  assert.equal(await rechteVon({ get: async () => { throw new Error('401') } }), null)
})
