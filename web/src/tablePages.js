// Die Tabelle eines Teilbaums seitenweise lesen (04.10.2026): GET /api/nodes/{id}/table liefert mit take/skip eine Seite und nennt
// total und next. Ein Zweig mit 17 782 Zeilen × 783 Spalten waren in einem Stück 1 GB JSON — der Browser stürzte ab, und ohne Seiten
// lehnt der Server so etwas jetzt ab. Wer alles braucht, liest Seite für Seite und verarbeitet sie, statt sie zu sammeln.

/// Die Adresse mit take und skip für eine Seite (url darf schon Parameter haben)
export const pageUrl = (url, take, skip) => `${url}${url.includes('?') ? '&' : '?'}take=${take}&skip=${skip}`

/// Liest alle Seiten nacheinander. onPage(seite, { skip, total }) bekommt jede Seite; ohne onPage kommen alle Zeilen zusammen zurück.
/// Liefert { node, columns, rows, total }. take ist der Wunsch — der Server klemmt ihn auf höchstens 1 Mio. Zellen je Seite.
export async function tablePages(api, url, { take = 500, onPage = null } = {}) {
  let skip = 0, columns = [], node = null, total = 0
  const rows = []
  for (;;) {
    const t = await api.get(pageUrl(url, take, skip))
    columns = t.columns ?? columns; node = t.node ?? node; total = t.total ?? (t.rows ?? []).length
    if (onPage) await onPage(t, { skip, total })
    else rows.push(...(t.rows ?? []))
    if (t.next == null || t.next <= skip) break
    skip = t.next
  }
  return { node, columns, rows, total }
}
