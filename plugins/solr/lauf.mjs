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
//     rechte?: { rolle, rights: Set }                     — was die Rolle des Laufs darf (rechteVon); fehlt es, wird nicht geprüft
//   }
//
// Die Abbildung selbst (welcher Solr-Wert wird welches Attribut) steht in solr.js und wird hier nur benutzt.
import { SYSTEM, roleOf, valueCommands, inheritedValues, modelNeeds, docTree, DEFAULT_SKIP, relFields, complexIds, relationNeeds, REL_GROUP } from './solr.js'
import { placeByPosition, humanize, lexicon } from '../table/anlage.mjs'

/// Die Rechte dessen, der den Lauf ausführt (Anwender im Browser, Rolle des Jobs im Prozess). Ein Server ohne Anwender
/// antwortet nicht — dann gibt es nichts zu prüfen (null).
export async function rechteVon(api) {
  try {
    const me = await api.get('/api/auth/me')
    return me?.rights ? { rolle: me.role, rights: new Set(me.rights) } : null
  } catch { return null }
}

/// Ein Import schreibt Knoten und Werte: ohne das Recht write ist jeder Befehl abgewiesen — das steht vor dem Einlesen fest.
export function pruefeSchreiben(rechte) {
  if (rechte && !rechte.rights.has('write')) throw new Error(`Rolle ${rechte.rolle} darf nicht pflegen — der Import schreibt Knoten und Werte.`)
}

/// Geschwister sortieren: Gruppen, dann Produkte, dann Varianten — dieselbe Reihenfolge wie in der Quelle
const RANG = { group: 0, product: 1, variant: 2 }
const byRole = liste => liste.sort((a, b) => (RANG[roleOf(a)] ?? 9) - (RANG[roleOf(b)] ?? 9))

/// Die Übersprungliste: die Vorgaben plus, was der Anwender dazuschreibt
export const skipListe = (text = '') => [...DEFAULT_SKIP, ...String(text).split(/[,\s]+/).filter(Boolean)]

/**
 * Was der Import täte: die Knoten der gewählten Teilbäume und was dem Modell dafür fehlt.
 * `wurzeln` sind Solr-Ids; `eltern` sagt je Wurzel, unter welchem Solr-Knoten sie hängt (null = ans Ziel).
 */
export async function plane({ client, umgebung, wurzeln, eltern = new Map(), skip = DEFAULT_SKIP, pdefs = {}, gruppen: gruppierung = {} }) {
  const { modell, baum, sag, rechte } = umgebung
  pruefeSchreiben(rechte)
  const bekannt = new Map(baum.filter(r => r.external?.[SYSTEM]).map(r => [r.external[SYSTEM], r]))
  const attrs = new Map((modell?.attributes ?? []).map(a => [a.key, a]))
  const gruppen = new Map((modell?.groups ?? []).map(g => [g.key, g]))

  // Darf die Rolle das Modell nicht ändern, scheitert der Import am ersten neuen Attribut oder an der ersten neuen Gruppe: das zeigt
  // sich schon an der ersten Seite — dann ist das Einlesen der übrigen überflüssig.
  const ohneModell = rechte && !rechte.rights.has('model')
  const seiteGeprueft = (n, of, seite) => {
    sag?.(`lade … ${n}/${of}`)
    if (!ohneModell || !seite) return
    const braucht = modelNeeds(seite, attrs, gruppen, pdefs, skip, gruppierung)
    if (braucht.newAttrs.size || braucht.newGroups.size || braucht.raise.size) {
      const beispiel = [...braucht.newAttrs.keys()][0] ?? [...braucht.newGroups.keys()][0] ?? [...braucht.raise.keys()][0]
      throw new Error(`Rolle ${rechte.rolle} darf das Modell nicht ändern — der Import braucht neue Attribute oder Gruppen (zuerst ${beispiel}), nach ${n} von ${of} Knoten abgebrochen.`)
    }
  }

  const items = []   // { doc, parentId (Solr-Id des Elternknotens oder null), role, top }
  for (const wurzel of wurzeln) {
    const docs = await client.subtree(wurzel, seiteGeprueft)
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

  const needs = modelNeeds(items.map(i => i.doc), attrs, gruppen, pdefs, skip, gruppierung)
  // Die neuen Gruppen mit der Zahl ihrer Attribute — im Probelauf steht hier, was der Lauf anlegen würde
  for (const [k, g] of needs.newGroups) sag?.(`neue Gruppe ${k} (${g.label})${g.ort ? ' an ' + g.ort : ''}${g.activeFrom ? ' ab ' + g.activeFrom : ''}: ${[...needs.newAttrs.values()].filter(a => a.group === k).length} Attribute`)
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
    await api.post(`/api/model/groups/${k}`, { key: k, label: { de: g.label, en: g.en ?? g.label }, activeFrom: g.activeFrom }, 'PUT')
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
  const itemOf = new Map(items.map(i => [i.doc.id, i]))
  // Der Knoten darüber (Solr-Dokument) trägt vererbbare Werte: sie stehen unten nicht noch einmal
  const geerbt = it => { const parent = it.parentId != null ? itemOf.get(it.parentId) : null; return parent ? inheritedValues(parent.doc, attrMap) : new Map() }
  const eigene = async id => {
    const n = await api.get(`/api/nodes/${encodeURIComponent(id)}`)
    return new Map(n.values.filter(v => !v.row).map(v => [`${v.attribute}|${v.locale ?? ''}`, v.values ?? v.value]))
  }
  let refNr = 0
  const baue = async (it, cmds) => {
    let node
    if (it.existing) {
      node = it.existing.id
      cmds.push(...valueCommands(it.doc, node, attrMap, await eigene(node), skip, geerbt(it)))
    } else {
      const ref = 'n' + (++refNr)
      const parent = it.parentId != null && refOf.has(it.parentId) ? refOf.get(it.parentId) : (ziel || null)
      if (it.role === 'group') cmds.push({ op: 'group.create', ref, args: { parent, name: it.doc.name || it.doc.remote_id || it.doc.master_id } })
      else if (it.role === 'product') { if (!parent) throw new Error(`Produkt ${it.doc.name}: keine Zielgruppe`); cmds.push({ op: 'product.create', ref, args: { group: parent } }) }
      else { if (!parent) throw new Error(`Variante ${it.doc.name}: kein Produkt darüber`); cmds.push({ op: 'variant.create', ref, args: { product: parent, axisValues: {} } }) }
      node = '@' + ref
      cmds.push({ op: 'external.link', args: { node, system: SYSTEM, id: it.doc.master_id } })
      // Die importierte Wurzel trägt die Gruppen, die der Teilbaum braucht, und das ★ auf name; ein Gruppenknoten die Gruppen, die an seiner Position hängen sollen.
      const hier = [...(it.top ? needs.used : []), ...(needs.attach?.get(it.doc.id) ?? [])]
      if (hier.length) cmds.push({ op: 'groups.attach', args: { node, groups: [...new Set(hier)].sort() } })
      if (it.top && it.role !== 'variant') cmds.push({ op: 'label.set', args: { node, attribute: 'name' } })
      cmds.push(...valueCommands(it.doc, node, attrMap, new Map(), skip, geerbt(it)))
    }
    if (it.existing && (it.top || needs.attach?.has(it.doc.id))) {
      const haben = (it.existing.groups ?? '').split(',').filter(Boolean)
      const zusammen = [...new Set([...haben, ...(it.top ? needs.used : []), ...(needs.attach?.get(it.doc.id) ?? [])])].sort()
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

/// Die Attribute der Gruppe „solr“ — dorthin kamen früher alle, deren Quelle keine Gruppe nannte — neu ordnen: jedes an die Position, unter der alle seine Werte in der Quelle stehen
/// (`plan` kommt aus plane; seine `usage` und `levels` sagen es), eine Gruppe je Knoten und Ebene, benannt nach dem Knoten. Jede Gruppe ist auf ihrer Ebene „aktiv ab“, Attribute oberhalb
/// der Varianten werden vererbbar, die Bezeichnungen lesbar. Die neuen Gruppen hängen an den Knoten ihrer Position; „solr“ geht von den Knoten. Werte bleiben, wo sie sind. Attribute
/// ohne Wert in der Quelle bleiben in „solr“. Ohne `trocken` wird geschrieben; im Probelauf steht nur, was geschähe.
export async function ordneNeu({ umgebung, plan, trocken = false }) {
  const { api, sag } = umgebung
  await umgebung.frisch?.()
  const levels = plan?.needs?.levels ?? new Map(), usage = plan?.needs?.usage ?? new Map()
  const alle = (umgebung.modell?.attributes ?? []).filter(a => (a.group ?? '') === 'solr')
  if (!alle.length) { sag?.('Gruppe solr: keine Attribute'); return { bewegt: 0, gruppen: 0 } }
  const alt = alle.filter(a => levels.has(a.key))
  if (alle.length > alt.length) sag?.(`${alle.length - alt.length} Attribute ohne Wert in der Quelle bleiben in solr`)
  if (!alt.length) return { bewegt: 0, gruppen: 0 }
  const docs = (plan?.items ?? []).map(i => i.doc)
  const baum = docTree(docs)
  const lex = lexicon(docs.map(d => d.name))
  const platz = placeByPosition(alt.map(a => ({ key: a.key, level: levels.get(a.key), positions: usage.get(a.key) ?? new Set() })), baum, { lex })
  const nach = new Map()   // Gruppe → { label, activeFrom, position, attribute }
  for (const a of alt) { const g = platz.byKey.get(a.key); if (!nach.has(g.group)) nach.set(g.group, { label: g.label, activeFrom: g.activeFrom, position: g.position, attribute: [] }); nach.get(g.group).attribute.push(a) }
  const vorhanden = new Set((umgebung.modell?.groups ?? []).map(g => g.key))
  const knotenZu = id => (plan?.items ?? []).find(i => i.doc.id === id)?.existing ?? null   // der Knoten in journali zu einem Gruppenknoten der Quelle
  sag?.(`${alt.length} Attribute der Gruppe solr → ${nach.size} Gruppen`)
  for (const [k, g] of [...nach].sort((x, y) => y[1].attribute.length - x[1].attribute.length)) sag?.(`  ${k} (${g.label.de}) an ${baum.name(g.position)}${g.activeFrom ? ' ab ' + g.activeFrom : ''}: ${g.attribute.length}${vorhanden.has(k) ? ' — gibt es schon' : ''}${knotenZu(g.position) ? '' : ' — Knoten fehlt'}`)
  const knoten = (umgebung.baum ?? []).filter(r => (r.groups ?? '').split(',').includes('solr'))
  sag?.(`${knoten.length} Knoten tragen die Gruppe solr`)
  if (trocken) { sag?.('Probelauf — nichts geschrieben'); return { bewegt: 0, gruppen: nach.size } }

  for (const [k, g] of nach) if (!vorhanden.has(k)) await api.post(`/api/model/groups/${k}`, { key: k, label: g.label, activeFrom: g.activeFrom }, 'PUT')
  let bewegt = 0
  for (const [k, g] of nach) for (const a of g.attribute) {
    const lesbar = (a.label?.de ?? '') === a.key || /_/.test(a.label?.de ?? '') ? humanize(a.label?.de || a.key, lex) : null
    await api.post(`/api/model/attributes/${encodeURIComponent(a.key)}`, { ...a, group: k, inheritable: levels.get(a.key) < 2, ...(lesbar ? { label: { de: lesbar, en: lesbar } } : {}) }, 'PUT')
    bewegt++
  }
  // Die Gruppen kommen an die Knoten ihrer Position; „solr“ geht von den Knoten, wenn nichts mehr darin ist
  const rest = alle.length > alt.length
  const anPosition = new Map()   // journali-Knoten → neue Gruppen
  for (const [k, g] of nach) { const n = knotenZu(g.position); if (n) anPosition.set(n.id, [...(anPosition.get(n.id) ?? []), k]) }
  const ids = new Set([...anPosition.keys(), ...knoten.map(r => r.id)])
  const zeilen = new Map((umgebung.baum ?? []).map(r => [r.id, r]))
  for (const id of ids) {
    const haben = (zeilen.get(id)?.groups ?? '').split(',').filter(x => x && (rest || x !== 'solr'))
    await api.post(`/api/nodes/${encodeURIComponent(id)}/groups`, { groups: [...new Set([...haben, ...(anPosition.get(id) ?? [])])] }, 'PUT')
  }
  sag?.(`✓ ${bewegt} Attribute in ${nach.size} Gruppen, ${ids.size} Knoten angepasst`)
  return { bewegt, gruppen: nach.size }
}
