// Gemeinsames von Band und Klassendialog: welche Klasse an einem Knoten gilt und welche Gruppen dort gelten.
import { systemSpec } from '../core.mjs'

/// Die Schlüssel des Systems in diesem Journal: die gemerkten (nach einer Namenskollision) vor den Vorgaben
export const schluessel = settings => { const s = systemSpec(settings ?? {}); return { group: s.group, classAttr: s.classAttr } }

/// Die Gruppe einer Klasse: die Gruppe des Systems, ein Unterstrich, der Code in Kleinschrift — so legt der Server sie an
/// (ClassificationApi.ClassGroupKey). Jede Klasse hat ihre eigene; ihre Attribute gelten nur dort, wo die Gruppe gilt.
export const klassenGruppe = (group, code) => `${group}_${String(code ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`

/// Die Klasse, die an einem Knoten gilt: die eigene, sonst die des nächsten Vorfahren, der eine hat.
export async function klasseAm(api, nodeId, classAttr) {
  const n = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}`)
  const eigen = n.values?.find(v => v.attribute === classAttr && !v.locale && !v.channel && !v.row)?.value
  if (eigen) return { node: n, code: String(eigen), geerbt: false }
  for (const a of n.ancestors ?? []) {
    const v = a.values?.find(v => v.attribute === classAttr && !v.locale && !v.channel)?.value
    if (v) return { node: n, code: String(v), geerbt: true, von: a.label, vonId: a.id }
  }
  return { node: n, code: null, geerbt: false }
}

/// Gilt die Gruppe an diesem Knoten (eigen oder von oben)? `node` ist die Antwort von /api/nodes/{id}.
export const gruppeGilt = (node, group) => (node?.groups ?? []).some(g => g.key === group && g.active !== false)

/// Die Daten des Klassendialogs (alle Bricks, Wörterbuch), solange der Stand des Plugins gleich ist (04.10.2026): der Dialog öffnet je Knoten,
/// und die Daten sind mehrere MB. stand = lastNumber aus /api/plugins/gpc/stand.
export const vorrat = { stand: null, all: null }
export async function datenLesen(api) {
  const stand = (await api.get('/api/plugins/gpc/stand').catch(() => null))?.lastNumber ?? null
  if (stand != null && vorrat.stand === stand && vorrat.all) return vorrat.all
  const all = await api.get('/api/plugins/gpc/data?values=true')
  vorrat.stand = stand; vorrat.all = stand != null ? all : null
  return all
}
