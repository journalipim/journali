// Skripte, die auf (mehrere) selektierte Knoten laufen (meta.nodes: true) — für das Kontextmenü im Baum.
// Der Cache wird beim Laden und nach jeder Änderung in der Skript-Ansicht aufgefrischt; laufAufKnoten stösst den Lauf
// mit den IDs als Parameter „nodes" an (ein Lauf für alle selektierten Knoten).
import { api, store, t } from 'journali'

export let liste = []

export async function refresh() {
  try { liste = (await api.get('/api/scriptum/scripts')).filter(s => s && s.nodes) } catch { liste = [] }
  return liste
}

export async function laufAufKnoten(s, ids, ctx) {
  const knoten = ids || []
  const r = await api.post(`/api/scriptum/scripts/${encodeURIComponent(s.key)}/run`, { params: { nodes: knoten.join(',') } })
  // den Lauf vermerken und in die Skript-Ansicht fuehren — dort steht das Ergebnis mit Download-Link
  try { localStorage.setItem('journali.scriptum.run', JSON.stringify({ key: s.key, job: r.job, run: r.run })) } catch { /* egal */ }
  store.toast(t('≡ {0}: läuft … ({1} Knoten) — Ergebnis in ⌨ Skripte', [s.label || s.key, knoten.length]))
  if (ctx && ctx.go) ctx.go('/p/scriptum/skripte')
  return r
}
