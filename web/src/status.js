// Status setzen — hier und, wenn gewünscht, im ganzen Teilbaum (Taloan, 23.09.2026: „das Setzen eines Status in einem
// übergeordneten Knoten muss ähnlich funktionieren wie bei Windows: auch für Subitems? ja nein“).
// Der Status selbst vererbt sich nicht (pflegestruktur 33) — er wird beim Setzen weitergereicht, einmal, als Stapel.
// Ein Knoten ohne Kinder fragt nicht; gefragt wird nur, wo es etwas zu entscheiden gibt.
import { tree } from './tree.js'
import { dialog } from './dialog.js'
import { api } from './api.js'
import { store } from './store.js'

/// Alle Knoten unter diesem, beliebig tief. Rubriken bleiben draussen: ein Publikationsknoten hat keinen Status.
export function subItems(id) {
  const out = []
  const stack = [...(tree.children.get(id) ?? [])]
  while (stack.length) {
    const n = stack.pop()
    if (n.role !== 'rubric') out.push(n)
    stack.push(...(tree.children.get(n.id) ?? []))
  }
  return out
}

/// Hat dieser Knoten diesen Status schon? Eine Gruppe ohne gesetzten Status hat keinen — auch nicht „Entwurf“.
const offen = (n, status) => n.hasStatus === false || n.status !== status

/// Wen trifft es? Der Knoten selbst, dazu auf Wunsch die Subitems, die den Status noch nicht haben.
export function targets(node, status, withSubs) {
  const self = offen(node, status) ? [node] : []
  return withSubs ? [...self, ...subItems(node.id).filter(n => offen(n, status))] : self
}

/// Setzen, mit Rückfrage bei Subitems. Liefert die Zahl der geschriebenen Knoten (0 = abgebrochen oder nichts zu tun).
export async function setStatus(node, status) {
  const subs = subItems(node.id).filter(n => offen(n, status))
  let withSubs = false
  if (subs.length) {
    const ok = await dialog.confirm({
      title: `${store.statusText(status)} setzen?`,
      ok: 'Setzen',
      option: { label: `auch für die ${subs.length} Subitems`, checked: false },
    })
    if (!ok) return 0
    withSubs = !!dialog.option?.checked
  }
  const rows = targets(node, status, withSubs)
  if (!rows.length) return 0
  if (rows.length === 1) await api.post(`/api/nodes/${encodeURIComponent(rows[0].id)}/status`, { status })
  else {
    const r = await api.batchChunked(rows.map(n => ({ op: 'status.set', args: { node: n.id, status } })), { label: 'Status', continueOnError: true })
    if (r.error) { store.toast(r.error); return 0 }
  }
  await store.poll(true)
  await tree.load()
  return rows.length
}
