// Verwaiste Werte vorher sehen (Taloan, 18.09.: „der Import hat mich nicht gewarnt“ — „vereinheitlichen, bei D&D auch prüfen“):
// Ein Teilbaum kommt an einen neuen Ort (Umhängen im Baum, JSON-Import). Seine eigenen Werte brauchen Attributgruppen;
// gelten die am neuen Ort nicht (weder am Ziel und dessen Pfad noch am Wurzelknoten des Teilbaums selbst), wären die
// Werte dort verwaist. Diese Prüfung sagt, welche Gruppen fehlen und wie viele Attribute daran hängen; der Dialog
// bietet an, die Gruppen am Wurzelknoten des Teilbaums anzuhängen — dann gelten sie ab dort nach unten.
import { api } from './api.js'
import { dialog } from './dialog.js'

// Gruppen, die am Ziel gelten (Knoten + Pfad); ohne Ziel (Wurzel) keine
export async function groupsAt(targetId) {
  if (!targetId) return new Set()
  try { const n = await api.get(`/api/nodes/${encodeURIComponent(targetId)}`); return new Set((n.groups ?? []).map(g => g.key)) } catch { return new Set() }
}

// Für einen Knoten im eigenen Baum: eigene Werte des Knotens und aller Nachfahren → benötigte Gruppen (nach Modell)
export async function neededByNode(nodeId, model) {
  const groupOf = new Map(model.attributes.map(a => [a.key, a.group]))
  const used = new Set()
  const n = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}`)
  for (const v of n.values ?? []) used.add(v.attribute)
  for (const k of Object.keys(n.rows ?? {})) used.add(k)
  try {
    const t = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}/table?deep=true`)
    for (const r of t.rows) for (const [k, v] of Object.entries(r.values)) if (v.own) used.add(k)
  } catch {}
  const need = new Map()
  for (const a of used) { const g = groupOf.get(a); if (!g) continue; if (!need.has(g)) need.set(g, []); need.get(g).push(a) }
  return { need, own: new Set(n.attachedGroups ?? []) }
}

// Was fehlt: [{ group, attrs }] — need: Map Gruppe → Attribute; have: Set der Gruppen am Ziel; own: Gruppen, die der Teilbaum selbst mitbringt
export function missingGroups(need, have, own = new Set()) {
  return [...need].filter(([g]) => !have.has(g) && !own.has(g)).map(([g, attrs]) => ({ group: g, attrs }))
}

// Text fürs Dialogfeld: eine Zeile je Gruppe mit Zahl der Attribute
export const missingLines = missing => missing.map(m => `${m.group} (${m.attrs.length})`)
export const missingCount = missing => missing.reduce((k, m) => k + m.attrs.length, 0)

// Der gemeinsame Dialog (Umhängen und Import): Titel, das Wesentliche rot, die Gruppen als Liste, Schalter „anhängen“.
// Liefert null (abgebrochen) oder { attach: true|false }.
export async function confirmMove({ title, warn, text = '', missing, rootLabel, ok }) {
  const n = missingCount(missing)
  const res = await dialog.confirm({
    title, ok, text,
    warn: missing.length ? `${warn ? warn + ' · ' : ''}${missing.length} Attributgruppen gelten am Ziel nicht — ${n} Attribute mit Werten wären verwaist` : warn,
    list: missing.length ? missingLines(missing) : [],
    option: missing.length ? { label: `fehlende Gruppen an ${rootLabel} anhängen — gelten dann ab dort nach unten`, checked: true } : null,
  })
  return res ? { attach: !!(missing.length && dialog.option?.checked) } : null
}
