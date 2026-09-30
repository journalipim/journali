// Prüfkern (ohne Oberfläche, ohne Server — testbar mit `node --test`, web/test/compliance.test.mjs):
// rows: die Zeilen der Tabelle (row, values{key:{value,source,from}}, inactive[]) — die Wurzel selbst als erste Zeile —,
// mapping: Datenpunkt → Attribut, model: Attribute des Modells, scopeAttr: Geltungsattribut des Katalogs (null = keins),
// onPath(nodeId, group): hängt die Attributgruppe an einem Knoten des Pfads? Liefert je Knoten und Datenpunkt den Zustand:
// ok · empty · bad · unmapped · na (gilt nicht: Rolle, Geltung) · below (alle Blätter darunter haben es) · inactive (Gruppe fehlt) · pending (angefragt).
import { convert, validate } from './mapper.js'

// {key} im Wert aufloesen: der Wert des Ziel-Attributs am selben Knoten (mit Vererbung, so wie er in values steht)
// wird eingesetzt. Rekursiv, mit Zyklus-Schutz. Ist ein Ziel leer, wird nichts eingesetzt (der Rest bleibt).
// Zyklus → null (der Aufrufer behandelt das als leer). Kein Platzhalter im Text → der Text unveraendert.
export function resolvePlaceholders(text, values, seen = new Set()) {
  if (text == null || typeof text !== 'string' || !text.includes('{')) return text
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '{') {
      const end = text.indexOf('}', i + 1)
      if (end < 0) { out += text.slice(i); break }
      const key = text.slice(i + 1, end).trim()
      if (!key) { out += text.slice(i, end + 1); i = end + 1; continue }   // '{}' bleibt stehen
      if (seen.has(key)) return null
      const sub = values?.[key]?.value
      if (sub != null && sub !== '') {
        if (typeof sub === 'string' && sub.includes('{')) {
          const inner = resolvePlaceholders(sub, values, new Set([...seen, key]))
          if (inner == null) return null
          out += inner
        } else {
          out += String(sub)
        }
      }
      i = end + 1
    } else {
      out += ch
      i++
    }
  }
  return out
}

export function analyze({ catalog, mapping, model, rows, locale = 'de', scopeAttr = null, onPath = () => true, today = new Date().toISOString().slice(0, 10) }) {
  const items = catalog.groups.flatMap(g => g.items.map(it => ({ ...it, group: g })))
  const defs = new Map(model.attributes.map(a => [a.key, a]))
  const result = { nodes: [], items, byItem: new Map(), unmapped: items.filter(it => !mapping[it.key]?.to), locale }
  for (const it of items) result.byItem.set(it.key, { ok: 0, empty: 0, bad: 0, na: 0, below: 0, inactive: 0, pending: 0 })
  result.inactiveGroups = new Set()   // Gruppen, die im Teilbaum fehlen
  // Vollständigkeit zählt am Verkaufbaren:
  // ein Knoten mit Kindern gilt als belegt (↓), wenn alle Blätter darunter den Datenpunkt haben — ob er ihn selbst hat, ist egal.
  const kids = new Map(); for (const r of rows) { const p = r.row.parent ?? ''; if (!kids.has(p)) kids.set(p, []); kids.get(p).push(r) }
  const ids = new Set(rows.map(r => r.row.id))
  const leavesOf = r => { const k = (kids.get(r.row.id) ?? []); return k.length ? k.flatMap(leavesOf) : [r] }
  const isLeaf = r => !(kids.get(r.row.id) ?? []).length
  const byId = new Map(); const order = [...rows].sort((a, b) => (isLeaf(a) ? 0 : 1) - (isLeaf(b) ? 0 : 1))   // Blätter zuerst, Eltern schauen auf sie
  void ids
  for (const r of order) {
    const node = { row: r.row, raw: Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, v.value])), from: Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, v.from ?? null])), states: {}, must: 0, mustOk: 0, findings: [], leaf: isLeaf(r) }
    byId.set(r.row.id, node)
    for (const it of items) {
      if (it.roles && !it.roles.includes(r.row.role)) { node.states[it.key] = 'na'; result.byItem.get(it.key).na++; continue }
      if (it.appliesIf && !it.appliesIf(r, mapping)) { node.states[it.key] = 'na'; result.byItem.get(it.key).na++; continue }
      if (it.group?.scope && !String(r.values?.[scopeAttr]?.value ?? '').split(',').map(s => s.trim()).includes(it.group.scope.key)) { node.states[it.key] = 'na'; result.byItem.get(it.key).na++; continue }
      const to = mapping[it.key]?.to
      const raw = to ? r.values[to]?.value ?? null : null
      // Platzhalter {key} im Wert aufloesen — Vererbung greift dort, wo r.values den Wert traegt (auch geerbt).
      const v = typeof raw === 'string' && raw.includes('{') ? (resolvePlaceholders(raw, r.values) || null) : raw
      let state = !to ? 'unmapped' : v == null || v === '' ? 'empty' : 'ok'
      // angefragt (Beleg method pending, checkedAt = Wiedervorlage): kein rotes Feld, sondern ⏳ — überfällig, wenn das Datum vorbei ist
      const src = to ? r.values[to]?.source : null
      if (state === 'empty' && src?.method === 'pending') { state = 'pending'; node.pending = (node.pending ?? 0) + 1; if (src.checkedAt && src.checkedAt < today) node.overdue = (node.overdue ?? 0) + 1; node.pendingInfo ??= {}; node.pendingInfo[it.key] = src }
      if (to && state === 'empty' && (r.inactive ?? []).includes(to)) state = 'inactive'
      if (state === 'ok') {
        const def = defs.get(to)
        const bad = validate(convert(v, def, model), def, model) ?? (it.rule ? it.rule(v, r, model) : null)
        if (bad) { state = 'bad'; node.findings.push({ item: it, message: bad, value: v }) }
      }
      if ((state === 'empty' || state === 'inactive') && !node.leaf) { const below = leavesOf(r).map(l => byId.get(l.row.id)?.states[it.key]); if (below.length && below.every(s => s === 'ok' || s === 'below' || s === 'na')) state = 'below' }
      if (state === 'inactive') { const g = defs.get(to)?.group; if (g && !onPath(r.row.id, g)) result.inactiveGroups.add(g) }
      node.states[it.key] = state
      if (it.level === 'must') { node.must++; if (state === 'ok' || state === 'below') node.mustOk++ }
      if (state !== 'unmapped') result.byItem.get(it.key)[state]++
    }
    node.score = node.must ? Math.round(node.mustOk / node.must * 100) : null
  }
  for (const r of rows) result.nodes.push(byId.get(r.row.id))   // in Baumfolge
  return result
}

