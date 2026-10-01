// Lesezeichen (01.10.2026): Knoten, die eine Person wiederfinden will. Sie stehen in der Kopfleiste neben der Person (⚐), nicht an einem Plugin:
// auch wenn das Plugin der Aufgaben ausgeschaltet ist, bleiben sie erreichbar. Gesetzt werden sie im Kontextmenü des Knotens (TreeView).
import { store } from './store.js'
import { tree, icon } from './tree.js'
import { t } from './i18n.js'

/// Die Einträge des Menüs: die Lesezeichen mit Pfad (öffnen), am Ende jeder Zeile ein ✕ zum Entfernen — das Menü bleibt dabei offen und zeigt die kürzere Liste.
/// Einen Knoten, den es nicht mehr gibt, zeigt das Menü mit seiner Kennung; er lässt sich nur noch entfernen.
export async function lesezeichenMenue(router) {
  if (!tree.loaded) await tree.load().catch(() => {})
  const eintraege = store.bookmarks.map(id => {
    const r = tree.byId.get(id)
    return { id, da: !!r, label: r ? `${icon(r.role)} ${r.label}` : id, pfad: r ? tree.ancestors(id).map(a => a.label).reverse().join(' › ') : t('Den Knoten gibt es nicht mehr') }
  })
  return [
    { label: t('⚐ Lesezeichen · {0}', [eintraege.length]), disabled: true },
    { sep: true },
    ...(eintraege.length
      ? eintraege.map(z => ({ label: z.label, hint: z.pfad, disabled: !z.da, action: () => router.push(`/tree/${z.id}`),
        end: { icon: '×', title: t('Lesezeichen entfernen'), action: () => { store.toggleBookmark(z.id); return lesezeichenMenue(router) } } }))
      : [{ label: t('keine'), hint: t('Im Kontextmenü eines Knotens: Lesezeichen setzen'), disabled: true }]),
  ]
}
