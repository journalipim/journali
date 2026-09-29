// Eine Fundstelle im PDF finden (29.09.2026). Reine Logik, ohne pdf.js: aus den Textstücken einer Seite (jedes mit
// seinem Text) und einem gesuchten Text (das Zitat oder der Wert) die Spanne der Stücke bestimmen, die ihn abdecken.
// pdf.js liefert im Browser die echten Glyph-Lagen je Stück; diese Funktion sagt nur, WELCHE Stücke der Kasten umfasst.
//
// Whitespace-unempfindlich: pdf.js zerlegt ein Wort mal mit, mal ohne Leerzeichen zwischen zwei Stücken („Nenn“ +
// „leistung“). Darum werden auf beiden Seiten alle Leerzeichen entfernt und nur die Zeichen verglichen. Findet das
// ganze Zitat nicht, greift der Rückfall auf seine erste Hälfte — ein Katalog bricht ein Zitat oft anders um als der Index.

const strip = s => String(s ?? '').replace(/\s+/g, '').toLowerCase()

/// items: [{ str }] in Lesereihenfolge. Rückgabe: { von, bis } (Stück-Indizes, einschliesslich) oder null.
export function findeSpanne(items, quote) {
  const ziel = strip(quote)
  if (ziel.length < 2 || !Array.isArray(items) || !items.length) return null
  // Ein Heuhaufen ohne Leerzeichen mit einer Abbildung: für jedes Zeichen das Stück, aus dem es kommt
  let hay = ''
  const stueck = []
  for (let i = 0; i < items.length; i++) {
    for (const ch of strip(items[i]?.str)) { hay += ch; stueck.push(i) }
  }
  let at = hay.indexOf(ziel), len = ziel.length
  if (at < 0) {
    const kurz = ziel.slice(0, Math.max(6, Math.floor(ziel.length / 2)))
    if (kurz.length < 6) return null
    at = hay.indexOf(kurz)
    if (at < 0) return null
    len = kurz.length
  }
  const a = stueck[at], b = stueck[Math.min(at + len - 1, stueck.length - 1)]
  if (a == null || b == null) return null
  return { von: Math.min(a, b), bis: Math.max(a, b) }
}

/// Der umschliessende Kasten über eine Spanne von Stücken mit Lage (left/top/width/height, schon in Anzeige-Pixeln).
/// Reine Geometrie — die Lagen rechnet die Ansicht aus den pdf.js-Positionen. Rückgabe null, wenn nichts passt.
export function kastenAus(items, spanne, rand = 2) {
  if (!spanne) return null
  const teil = (items ?? []).slice(spanne.von, spanne.bis + 1).filter(i => i && Number.isFinite(i.left) && Number.isFinite(i.top))
  if (!teil.length) return null
  const left = Math.min(...teil.map(i => i.left)), top = Math.min(...teil.map(i => i.top))
  const right = Math.max(...teil.map(i => i.left + (i.width || 0))), bottom = Math.max(...teil.map(i => i.top + (i.height || 0)))
  return { left: left - rand, top: top - rand, width: right - left + 2 * rand, height: bottom - top + 2 * rand }
}
