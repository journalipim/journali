// Lernen (docs/pflegestruktur.md 44): der Berater zählt, ohne Gespräch und ohne Kennung — Wörter ohne Treffer, gelesene Tippfehler, Wörter vor dem
// Öffnen, Merken oder Ablehnen eines Produkts. Daraus werden Vorschläge, die ein Mensch in journali übernimmt (ein Synonym im Wörterbuch, ein
// Attribut in der Sicht). Gespeichert in einer Datei des Dienstes (JOURNALI_ADVISOR_DATA), nie im Journal; ohne Datei nur im Arbeitsspeicher.
import fs from 'node:fs'
import path from 'node:path'

export const MAX_EINTRAEGE = 5000

/// Ein Zähler je Art: Schlüssel → { n, zuletzt, … } — der seltenste fliegt, wenn es zu viele werden
function zaehle(tabelle, schluessel, extra, jetzt) {
  const e = tabelle[schluessel] ??= { n: 0 }
  e.n++; e.zuletzt = new Date(jetzt).toISOString().slice(0, 10)
  Object.assign(e, extra)
  const keys = Object.keys(tabelle)
  if (keys.length > MAX_EINTRAEGE) delete tabelle[keys.reduce((a, b) => tabelle[a].n <= tabelle[b].n ? a : b)]
}

/**
 * @param {{ datei?: string | null, jetzt?: () => number, schreibenNach?: number }} o
 */
export function erstelleLernen(o = {}) {
  const jetzt = o.jetzt ?? Date.now
  let stand = { ohneTreffer: {}, korrektur: {}, nichts: {}, geoeffnet: {}, gemerkt: {}, abgelehnt: {} }
  if (o.datei && fs.existsSync(o.datei)) {
    try { stand = { ...stand, ...JSON.parse(fs.readFileSync(o.datei, 'utf8')) } } catch { /* eine kaputte Datei fängt von vorn an */ }
  }
  let geaendert = false, zuletztGeschrieben = jetzt()

  function schreibe(sofort = false) {
    if (!o.datei || !geaendert) return
    if (!sofort && jetzt() - zuletztGeschrieben < (o.schreibenNach ?? 60_000)) return
    fs.mkdirSync(path.dirname(o.datei), { recursive: true })
    const tmp = o.datei + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(stand, null, 1))
    fs.renameSync(tmp, o.datei)
    geaendert = false; zuletztGeschrieben = jetzt()
  }

  /// art: ohneTreffer { wort } · korrektur { from, to } · nichts { woerter } · geoeffnet | gemerkt | abgelehnt { woerter, id, name }
  function notiere(art, d) {
    const t = jetzt()
    if (art === 'ohneTreffer' && d.wort) zaehle(stand.ohneTreffer, d.wort, {}, t)
    else if (art === 'korrektur' && d.from && d.to) zaehle(stand.korrektur, `${d.from} → ${d.to}`, { from: d.from, to: d.to }, t)
    else if (art === 'nichts' && d.woerter?.length) zaehle(stand.nichts, d.woerter.join(' '), {}, t)
    else if (['geoeffnet', 'gemerkt', 'abgelehnt'].includes(art) && d.id)
      for (const w of d.woerter ?? []) zaehle(stand[art], `${w} → ${d.id}`, { wort: w, id: d.id, ...(d.name ? { name: d.name } : {}) }, t)
    else return
    geaendert = true
    schreibe()
  }

  return { notiere, schreibe: () => schreibe(true), stand: () => stand }
}

/// Vorschläge aus dem Gezählten — je Art die häufigsten ab `ab` Mal
export function vorschlaege(stand, { ab = 3, je = 20 } = {}) {
  const oft = t => Object.entries(t ?? {}).filter(([, v]) => v.n >= ab).sort((a, b) => b[1].n - a[1].n).slice(0, je)
  return {
    ohneTreffer: oft(stand.ohneTreffer).map(([w, v]) => ({ wort: w, n: v.n, vorschlag: 'Synonym im Wörterbuch oder Attribut in der Sicht' })),
    korrektur: oft(stand.korrektur).map(([, v]) => ({ von: v.from, zu: v.to, n: v.n, vorschlag: 'Schreibweise als Synonym aufnehmen' })),
    nichts: oft(stand.nichts).map(([w, v]) => ({ woerter: w, n: v.n, vorschlag: 'Sortiment oder Angaben prüfen' })),
    geoeffnet: oft(stand.geoeffnet).map(([, v]) => ({ wort: v.wort, id: v.id, name: v.name, n: v.n, vorschlag: 'Wort als Stichwort am Produkt' })),
    gemerkt: oft(stand.gemerkt).map(([, v]) => ({ wort: v.wort, id: v.id, name: v.name, n: v.n })),
    abgelehnt: oft(stand.abgelehnt).map(([, v]) => ({ wort: v.wort, id: v.id, name: v.name, n: v.n, vorschlag: 'passt nicht zu diesem Wort — Angaben prüfen' })),
  }
}
