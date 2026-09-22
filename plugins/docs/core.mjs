// Plugin docs — Kern ohne Node-Abhängigkeiten (Taloan, 22.09.2026: „Firmen haben Marketingdokumente, Vorteils-
// argumentationen, Datenblätter, Kataloge irgendwo rumliegen … man kann etliche PDFs an einen Knoten droppen, die
// werden im Hintergrund nach und nach gelesen und stehen dann für Chatbots oder die interne Recherche bereit“).
// Hier steht, wie aus Text Abschnitte werden — das Lesen der Dateiformate macht job.mjs.
// Abschnitte statt ganzer Dokumente: ein 40-seitiges Datenblatt ist als Ganzes für die Suche wertlos, und ein Treffer
// soll „Seite 4" sagen können (pflegestruktur §32).

/// Eine Zeile ist eine Überschrift, wenn sie kurz ist, nicht auf einen Satzschluss endet und nicht wie Fliesstext aussieht.
const HEADING = /^[^\n]{3,80}$/
export function isHeading(line) {
  const s = line.trim()
  if (!HEADING.test(s)) return false
  if (/[.;:,]$/.test(s)) return false
  if (s.split(/\s+/).length > 10) return false
  // „1. Verarbeitung", „Technische Daten", „EIGENSCHAFTEN" — aber nicht „Der Klebstoff ist …"
  return /^[\d.]*\s*[A-ZÄÖÜ]/.test(s) && !/\b(ist|sind|wird|werden|kann|können|hat|haben)\b/i.test(s)
}

/// Text in Abschnitte schneiden: an Absätzen, höchstens `max` Zeichen, Überschriften bleiben beim folgenden Text.
/// Sehr lange Absätze werden an Satzgrenzen geteilt, damit kein Abschnitt unlesbar gross wird.
export function chunk(text, { max = 900, min = 120, page = null } = {}) {
  const clean = String(text ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) return []
  const out = []
  let heading = null, buf = []
  // Eine Überschrift, auf die kein Text folgt, ist keine — sie wird selbst zum Abschnitt. Sonst verschwände sie
  // (kurze Stichpunkte wie „Lösemittelfrei" sehen aus wie Überschriften; Taloan, 22.09.2026: Vorteilsargumentationen).
  const flush = () => {
    const body = buf.join('\n').trim()
    buf = []
    if (!body) { if (heading) { out.push({ page, heading: null, body: heading }); heading = null } return }
    if (body.length <= max) { out.push({ page, heading, body }); return }
    // zu gross: an Satzenden teilen, Überschrift bleibt an allen Teilen
    let rest = body
    while (rest.length > max) {
      let cut = rest.lastIndexOf('. ', max)
      if (cut < min) cut = rest.lastIndexOf(' ', max)
      if (cut < min) cut = max
      out.push({ page, heading, body: rest.slice(0, cut + 1).trim() })
      rest = rest.slice(cut + 1).trim()
    }
    if (rest) out.push({ page, heading, body: rest })
  }
  for (const para of clean.split(/\n{2,}/)) {
    const lines = para.split('\n')
    if (lines.length === 1 && isHeading(lines[0])) { flush(); heading = lines[0].trim(); continue }   // flush() rettet eine hängende Überschrift
    if (isHeading(lines[0]) && lines.length > 1) { flush(); heading = lines[0].trim(); buf.push(lines.slice(1).join('\n')); continue }
    buf.push(para)
    if (buf.join('\n').length >= max) flush()
  }
  flush()
  return out
}

/// Abschnitte mehrerer Seiten fortlaufend nummerieren — die Reihenfolge im Dokument bleibt erhalten
export function numbered(chunks) {
  return chunks.map((c, i) => ({ seq: i, page: c.page ?? null, heading: c.heading ?? null, body: c.body }))
}

/// Text aus HTML: Skript und Stil weg, Blockenden werden Absätze, Entities auflösen
export function fromHtml(html) {
  return String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' })[e])
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}
