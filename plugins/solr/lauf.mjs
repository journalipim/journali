// Der Ablauf eines Solr-Imports — einmal, für beide Wege.
// Die Ansicht im Browser und der Job auf dem Server rufen dieselben Funktionen; sie unterscheiden sich nur in der
// Umgebung, die sie mitbringen: wie man Solr fragt, wie man journali fragt, und wohin der Fortschritt geht.
//
//   umgebung = {
//     api:    { get(pfad), post(pfad, körper, methode?), batchChunked(cmds, opts) }
//     modell: { attributes: [...], groups: [...] }        — das Modell, wie /api/model es liefert
//     baum:   [ { id, role, external, groups }, ... ]     — die Knoten, wie /api/tree sie liefert
//     frisch: async () => void                            — Modell und Baum neu holen (nach Modelländerungen)
//     sag:    text => void                                — eine Zeile Fortschritt
//     halt?:  async () => void                            — wartet, solange der Lauf pausiert ist
//   }
//
// Die Abbildung selbst (welcher Solr-Wert wird welches Attribut) steht in solr.js und wird hier nur benutzt.
import { SYSTEM, roleOf, valueCommands, modelNeeds, DEFAULT_SKIP, relFields, complexIds, relationNeeds, REL_GROUP } from './solr.js'

/// Geschwister sortieren: Gruppen, dann Produkte, dann Varianten — dieselbe Reihenfolge wie in der Quelle
const RANG = { group: 0, product: 1, variant: 2 }
const byRole = liste => liste.sort((a, b) => (RANG[roleOf(a)] ?? 9) - (RANG[roleOf(b)] ?? 9))

/// Die Übersprungliste: die Vorgaben plus, was der Anwender dazuschreibt
export const skipListe = (text = '') => [...DEFAULT_SKIP, ...String(text).split(/[,\s]+/).filter(Boolean)]

/**
 * Was der Import täte: die Knoten der gewählten Teilbäume und was dem Modell dafür fehlt.
 * `wurzeln` sind Solr-Ids; `eltern` sagt je Wurzel, unter welchem Solr-Knoten sie hängt (null = ans Ziel).
 */
export async function plane({ client, umgebung, wurzeln, eltern = new Map(), skip = DEFAULT_SKIP, pdefs = {} }) {
  const { modell, baum, sag } = umgebung
  const bekannt = new Map(baum.filter(r => r.external?.[SYSTEM]).map(r => [r.external[SYSTEM], r]))
  const attrs = new Map((modell?.attributes ?? []).map(a => [a.key, a]))
  const gruppen = new Map((modell?.groups ?? []).map(g => [g.key, g]))

  const items = []   // { doc, parentId (Solr-Id des Elternknotens oder null), role, top }
  for (const wurzel of wurzeln) {
    const docs = await client.subtree(wurzel, (n, of) => sag?.(`lade … ${n}/${of}`))
    const kinder = new Map()
    for (const d of docs) { const k = d.main_parent_id || ''; if (!kinder.has(k)) kinder.set(k, []); kinder.get(k).push(d) }
    for (const l of kinder.values()) byRole(l)
    const wurzelDoc = docs.find(d => d.id === wurzel)
    if (!wurzelDoc) { sag?.(`✗ ${wurzel}: in der Quelle nicht gefunden`); continue }

    const gehe = (d, parentId, top) => {
      const role = roleOf(d)
      items.push({ doc: d, parentId, role, top })
      const darunter = kinder.get(d.id) ?? []
      const direkt = []
      for (const k of darunter) {
        if (roleOf(k) === 'variant' && role === 'group') direkt.push(k)
        else gehe(k, d.id, false)
      }
      if (direkt.length) {
        // Varianten direkt unter einer Gruppe: Sammelprodukt mit dem Namen der Gruppe, Kennung <gruppe>#variants.
        const pseudo = { id: d.id + '#variants', master_id: d.master_id + '#variants', type: 'product', name: d.name || d.master_id, lang: d.lang, main_parent_id: d.id, pseudo: true }
        items.push({ doc: pseudo, parentId: d.id, role: 'product', top: false })
        for (const k of direkt) items.push({ doc: k, parentId: pseudo.id, role: 'variant', top: false })
      }
    }
    gehe(wurzelDoc, eltern.get(wurzel) ?? null, true)
  }
  for (const it of items) it.existing = bekannt.get(it.doc.master_id) ?? null

  const needs = modelNeeds(items.map(i => i.doc), attrs, gruppen, pdefs, skip)
  sag?.(`analysiert: ${items.length} Knoten (${items.filter(i => i.existing).length} vorhanden), ${needs.newAttrs.size} neue Attribute in ${needs.newGroups.size} neuen Gruppen`)
  return { items, needs, wurzeln: wurzeln.length }
}

/**
 * Den Plan schreiben: erst das Modell, dann die Gruppen als ein Stapel, dann je Produkt einer mit seinen Varianten.
 * Fehlgeschlagene Befehle überspringt der Server und meldet sie (doppelte eindeutige Werte — SKU, EAN).
 */
export async function schreibe({ plan, umgebung, ziel = null, skip = DEFAULT_SKIP }) {
  const { api, sag } = umgebung
  const { items, needs } = plan
  let geschrieben = 0, stapel = 0

  for (const [k, g] of needs.newGroups) {
    await api.post(`/api/model/groups/${k}`, { key: k, label: { de: g.label, en: g.label }, activeFrom: g.activeFrom }, 'PUT')
    sag?.(`Attributgruppe ${k} (${g.label})${g.activeFrom ? ' ab ' + g.activeFrom : ''} angelegt`)
  }
  for (const [k, from] of needs.raise) {
    const g = new Map((umgebung.modell?.groups ?? []).map(x => [x.key, x])).get(k)
    await api.post(`/api/model/groups/${k}`, { key: k, label: g?.label ?? {}, activeFrom: from }, 'PUT')
    sag?.(`Attributgruppe ${k}: aktiv ab ${from ?? 'überall'} (Werte kommen weiter oben vor)`)
  }
  for (const [k, d] of needs.newAttrs) await api.post(`/api/model/attributes/${k}`, d, 'PUT')
  if (needs.newAttrs.size) sag?.(`${needs.newAttrs.size} Attribute angelegt`)
  await umgebung.frisch?.()
  const attrMap = new Map((umgebung.modell?.attributes ?? []).map(a => [a.key, a]))

  const refOf = new Map()   // Solr-Id → '@ref' oder journali-Id
  const eigene = async id => {
    const n = await api.get(`/api/nodes/${encodeURIComponent(id)}`)
    return new Map(n.values.filter(v => !v.row).map(v => [`${v.attribute}|${v.locale ?? ''}`, v.values ?? v.value]))
  }
  let refNr = 0
  const baue = async (it, cmds) => {
    let node
    if (it.existing) {
      node = it.existing.id
      cmds.push(...valueCommands(it.doc, node, attrMap, await eigene(node), skip))
    } else {
      const ref = 'n' + (++refNr)
      const parent = it.parentId != null && refOf.has(it.parentId) ? refOf.get(it.parentId) : (ziel || null)
      if (it.role === 'group') cmds.push({ op: 'group.create', ref, args: { parent, name: it.doc.name || it.doc.remote_id || it.doc.master_id } })
      else if (it.role === 'product') { if (!parent) throw new Error(`Produkt ${it.doc.name}: keine Zielgruppe`); cmds.push({ op: 'product.create', ref, args: { group: parent } }) }
      else { if (!parent) throw new Error(`Variante ${it.doc.name}: kein Produkt darüber`); cmds.push({ op: 'variant.create', ref, args: { product: parent, axisValues: {} } }) }
      node = '@' + ref
      cmds.push({ op: 'external.link', args: { node, system: SYSTEM, id: it.doc.master_id } })
      if (it.top) {
        // Die importierte Wurzel trägt die Gruppen, die der Teilbaum braucht, und das ★ auf name.
        cmds.push({ op: 'groups.attach', args: { node, groups: needs.used } })
        if (it.role !== 'variant') cmds.push({ op: 'label.set', args: { node, attribute: 'name' } })
      }
      cmds.push(...valueCommands(it.doc, node, attrMap, new Map(), skip))
    }
    if (it.top && it.existing) {
      const haben = (it.existing.groups ?? '').split(',').filter(Boolean)
      const zusammen = [...new Set([...haben, ...needs.used])].sort()
      if (zusammen.length !== haben.length) cmds.push({ op: 'groups.attach', args: { node, groups: zusammen } })
    }
    refOf.set(it.doc.id, node)
  }
  const sende = async (cmds, marke) => {
    if (!cmds.length) return
    await umgebung.halt?.()   // anhalten, falls jemand pausiert hat — zwischen zwei Stapeln tut es nicht weh
    const res = await api.batchChunked(cmds, { size: 2000, continueOnError: true, maxErrorPercent: 20, label: marke })
    geschrieben += res.results.length; stapel++
    for (const e of res.errors.slice(0, 20)) sag?.(`✗ übersprungen: ${e.op} ${JSON.stringify(e.command?.args ?? {}).slice(0, 80)} — ${e.message}`)
    if (res.errors.length > 20) sag?.(`… und ${res.errors.length - 20} weitere übersprungen`)
    if (res.error) throw new Error(`Stapel ${res.batch} hielt an bei #${res.error.index} ${res.error.op}: ${res.error.message}`)
    // Nach dem Stapel sind die Verweise echte Knoten — für die nächsten Stapel auflösen.
    for (const r of res.results) if (r.ref) for (const [k, v] of refOf) if (v === '@' + r.ref) refOf.set(k, r.node)
  }

  const cmds = []
  for (const it of items) if (it.role === 'group') await baue(it, cmds)
  await sende(cmds, 'Import (Solr): Gruppen')
  const produkte = items.filter(i => i.role === 'product')
  let n = 0
  for (const p of produkte) {
    sag?.(`schreibe … ${++n}/${produkte.length}`)
    const pc = []
    await baue(p, pc)
    for (const v of items) if (v.role === 'variant' && v.parentId === p.doc.id) await baue(v, pc)
    await sende(pc, `Import (Solr): ${n}/${produkte.length}`)
  }
  for (const v of items) if (v.role === 'variant' && !produkte.some(p => p.doc.id === v.parentId)) { const vc = []; await baue(v, vc); await sende(vc, 'Import (Solr): Varianten') }
  sag?.(geschrieben ? `fertig: ${geschrieben} Einträge in ${stapel} Stapeln` : 'nichts zu schreiben — alles schon so')
  return { geschrieben, stapel }
}

/// Die Kanten der gewählten Teilbäume: was es gibt, was fehlt, was sich geändert hat (18).
export async function planeRelationen({ client, umgebung, wurzeln }) {
  const { api, modell, baum, sag } = umgebung
  const docs = []
  for (const wurzel of wurzeln) docs.push(...await client.subtree(wurzel, (n, of) => sag?.(`lade … ${n}/${of}`)))
  const mitKanten = docs.filter(d => relFields(d).length)
  const byExt = new Map(baum.filter(r => r.external?.[SYSTEM]).map(r => [r.external[SYSTEM], r.id]))
  const vorhanden = new Map()
  let n = 0
  for (const d of mitKanten) {
    const from = byExt.get(d.master_id); if (!from) continue
    sag?.(`vorhandene Relationen … ${++n}/${mitKanten.length}`)
    const rs = await api.get(`/api/nodes/${encodeURIComponent(from)}/relations`)
    for (const r of rs.out) if (r.external?.[SYSTEM]) vorhanden.set(r.external[SYSTEM], { id: r.id, values: new Map(r.values.map(v => [`${v.attribute}|${v.locale ?? ''}`, v.values ?? v.value])) })
  }
  const cids = [...new Set(mitKanten.flatMap(complexIds))]
  const complexById = new Map((await client.byIds(cids, (k, of) => sag?.(`Kanten mit Werten … ${k}/${of}`))).map(c => [c.id, c]))
  const needs = relationNeeds(mitKanten, byExt, complexById, vorhanden, modell)
  const kanten = [...needs.stats.values()].reduce((a, s) => a + s.neu + s.gleich + s.geaendert + s.zielFehlt, 0)
  sag?.(`Relationen analysiert: ${mitKanten.length} Knoten mit Kanten, ${kanten} Kanten, ${needs.newTypes.size} neue Typen, ${needs.newAttrs.size} neue Attribute, ${needs.missingFrom} Quellen nicht importiert`)
  return { needs, docs: mitKanten.length, cmds: [...needs.perNode.values()].reduce((a, c) => a + c.length, 0), total: kanten }
}

/// Die Kanten schreiben: erst Gruppe, Attribute und Typen, dann je Quellknoten ein Stapel.
export async function schreibeRelationen({ plan, umgebung }) {
  const { api, sag } = umgebung
  const { needs } = plan
  let geschrieben = 0, stapel = 0
  if (needs.needGroup) await api.post(`/api/model/groups/${REL_GROUP}`, { key: REL_GROUP, label: { de: 'Bestandteil', en: 'Component' } }, 'PUT')
  for (const [k, d] of needs.newAttrs) await api.post(`/api/model/attributes/${k}`, d, 'PUT')
  for (const [k, t] of needs.newTypes) { await api.post(`/api/model/relations/${k}`, t, 'PUT'); sag?.(`Relationstyp ${k} angelegt`) }
  if (needs.newAttrs.size) sag?.(`${needs.newAttrs.size} Attribute in ${REL_GROUP} angelegt`)
  let n = 0
  for (const [, cmds] of needs.perNode) {
    await umgebung.halt?.()
    sag?.(`schreibe … ${++n}/${needs.perNode.size}`)
    const res = await api.batchChunked(cmds, { size: 2000, label: `Import (Solr): Relationen ${n}/${needs.perNode.size}` })
    geschrieben += res.results.length; stapel++
    if (res.error) throw new Error(`Stapel ${res.batch} hielt an bei #${res.error.index} ${res.error.op}: ${res.error.message}`)
  }
  sag?.(geschrieben ? `Relationen fertig: ${geschrieben} Einträge in ${stapel} Stapeln` : 'Relationen: nichts zu schreiben')
  return { geschrieben, stapel }
}
