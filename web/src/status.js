// Status setzen — hier und, wenn gewünscht, im ganzen Teilbaum.
// Der Status selbst vererbt sich nicht (pflegestruktur 33) — er wird beim Setzen weitergereicht, einmal, als Stapel.
// Ein Knoten ohne Kinder fragt nicht; gefragt wird nur, wo es etwas zu entscheiden gibt.
import { tree } from './tree.js'
import { dialog } from './dialog.js'
import { api } from './api.js'
import { store } from './store.js'
import { t } from './i18n.js'

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
/// <ab> ist der Tag (JJJJ-MM-TT), ab dem er gilt — leer heisst ab sofort.
export async function setStatus(node, status, ab = '') {
  // Ein Tag in der Zukunft ändert am heutigen Stand nichts — dann ist auch nichts „schon so“, und alle Subitems
  // kommen in Frage. Ohne Tag zählt wie bisher nur, wer den Status noch nicht hat
  const subs = subItems(node.id).filter(n => ab || offen(n, status))
  let withSubs = false
  if (subs.length) {
    const ok = await dialog.confirm({
      title: `${store.statusText(status)} setzen?`,
      ok: t('Setzen'),
      option: { label: t('auch für die {0} Subitems', [subs.length]), checked: false },
    })
    if (!ok) return 0
    withSubs = !!dialog.option?.checked
  }
  const rows = ab ? [node, ...(withSubs ? subs : [])] : targets(node, status, withSubs)
  if (!rows.length) return 0
  if (rows.length === 1) await api.post(`/api/nodes/${encodeURIComponent(rows[0].id)}/status`, { status, from: ab })
  else {
    const r = await api.batchChunked(rows.map(n => ({ op: 'status.set', args: { node: n.id, status, from: ab } })), { label: t('Status'), continueOnError: true })
    if (r.error) { store.toast(r.error); return 0 }
  }
  await store.poll(true)
  await tree.load()
  return rows.length
}

/// Status mit Geltungsdatum: welcher, ab wann. Ohne Datum gilt er sofort — dann ist es derselbe Weg wie im Menü.
export async function setStatusAb(node) {
  const stati = store.model?.statuses ?? []
  if (!stati.length) return 0
  const status = await dialog.prompt({
    title: t('Status ab Datum'),
    choices: stati.map(s => ({ value: s.key, label: store.statusText(s.key) })),
    value: node.statusNext || (node.hasStatus === false ? stati[0].key : node.status),
    extra: { label: t('ab'), type: 'date', value: node.statusNextAb || node.statusAb || '' },
    ok: t('Setzen'),
  })
  if (!status) return 0
  return setStatus(node, status, dialog.extra?.value ?? '')
}
