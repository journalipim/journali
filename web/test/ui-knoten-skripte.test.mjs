// Knoten-Skripte im Kontextmenü (29.09.2026): scriptum registriert eine multi-fähige nodeAction. Sie listet die Skripte
// mit meta.nodes:true und lässt einen Lauf auf allen selektierten Knoten laufen (ihre IDs als Parameter „nodes").
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { refresh } from '../../plugins/scriptum/src/nodescripts.js'

const mod = (await import('../../plugins/scriptum/src/entry.js')).default

test('scriptum: multi-fähige nodeAction listet Knoten-Skripte und läuft auf der Auswahl', async () => {
  const rufe = []
  const get = api.get, post = api.post, toast = store.toast
  api.get = async p => (/\/scriptum\/scripts$/.test(String(p))
    ? [{ key: 'liste', label: 'Auf Auswahl: Knoten auflisten', nodes: true, released: true }, { key: 'ohne', label: 'Kein Knoten-Skript', nodes: false }]
    : [])
  api.post = async (p, b) => { rufe.push({ p: String(p), b }); return { job: 'scriptum_liste', run: 'r1' } }
  store.toast = () => {}
  try {
    await refresh()
    const a = mod.nodeActions.find(x => x.multi && typeof x.items === 'function')
    assert.ok(a, 'eine multi-fähige nodeAction mit items')
    // Mehrfachauswahl: zwei Knoten
    const items = a.items({ id: 'p1', role: 'product' }, 1, [{ id: 'p1' }, { id: 'p2' }])
    assert.deepEqual(items.map(i => i.label), ['Auf Auswahl: Knoten auflisten'], 'nur Skripte mit nodes:true stehen da')
    await items[0].run({})
    const lauf = rufe.find(r => /\/scriptum\/scripts\/liste\/run$/.test(r.p))
    assert.ok(lauf, 'der Lauf geht an das gewählte Skript')
    assert.equal(lauf.b.params.nodes, 'p1,p2', 'die selektierten Knoten als Parameter „nodes"')
  } finally { api.get = get; api.post = post; store.toast = toast }
})

test('ohne Knoten-Skripte ist die Auswahl leer', async () => {
  const get = api.get
  api.get = async () => [{ key: 'x', label: 'X', nodes: false }]
  try {
    await refresh()
    const a = mod.nodeActions.find(x => x.multi)
    assert.deepEqual(a.items({ id: 'p1', role: 'product' }, 1, null), [], 'nichts mit nodes:true → kein Eintrag')
  } finally { api.get = get }
})
