// Plugin ocr — Kern ohne Erkennung und ohne Node-Abhängigkeiten (27.09.2026, pflegestruktur 34 J).
// Aus dem Ergebnis der Texterkennung werden Seiten, Zeilen mit Zellen und daraus Abschnitte und Tabellen — mit
// denselben Werkzeugen wie beim Leser (plugins/docs/core.mjs), damit ein erkanntes Datenblatt im Index aussieht
// wie ein gelesenes. Die Erkennung selbst (tesseract.js) und das Rendern der Seiten macht job.mjs.
import { chunk, numbered, pack, joinHyphens, dropRunningLines, cellsOf, findTables, numberedTables } from '../docs/core.mjs'

/// Die Zeilen eines Erkennungsergebnisses: ältere Versionen liefern sie flach (data.lines), neuere in Blöcken →
/// Absätzen → Zeilen (data.blocks). Beides wird eine Liste von Zeilen mit Text und Wörtern.
export function linesOf(data) {
  if (Array.isArray(data?.lines) && data.lines.length) return data.lines
  const out = []
  for (const b of data?.blocks ?? []) for (const p of b.paragraphs ?? []) for (const l of p.lines ?? []) out.push(l)
  return out
}

/// Eine Zeile als Stücke mit x-Lage (Pixel): je Wort sein Kasten — daraus macht cellsOf die Zellen.
export function itemsOf(line) {
  return (line?.words ?? []).filter(w => String(w.text ?? '').trim()).map(w => ({ x: Number(w.bbox?.x0 ?? 0), w: Math.max(0, Number(w.bbox?.x1 ?? 0) - Number(w.bbox?.x0 ?? 0)), str: String(w.text) + ' ' }))
}

/// Der Abstand, der zwei Zellen trennt: das Zweieinhalbfache der mittleren Zeichenbreite dieser Seite — in Pixeln,
/// denn die Erkennung misst im Bild, nicht in Punkten. Ohne Wörter ein fester Wert.
export function gapOf(lines) {
  let breite = 0, n = 0
  for (const l of lines) for (const w of l.words ?? []) {
    const len = String(w.text ?? '').length
    if (len && w.bbox) { breite += (Number(w.bbox.x1) - Number(w.bbox.x0)) / len; n++ }
  }
  return n ? Math.max(8, (breite / n) * 2.5) : 20
}

/// Eine erkannte Seite: ihr Text, ihre Zeilen als Zellen, das Vertrauen der Erkennung (0–100).
export function pageOf(data) {
  const lines = linesOf(data)
  const gap = gapOf(lines)
  return {
    text: lines.map(l => String(l.text ?? '').replace(/\s+$/, '').trim()).filter(Boolean).join('\n'),
    rows: lines.map(l => cellsOf(itemsOf(l), { gap })).filter(c => c.length),
    confidence: Number(data?.confidence ?? 0),
  }
}

/// Aus den Seiten die Abschnitte und Tabellen — derselbe Weg wie beim Leser: Kopf- und Fusszeilen raus, Silbentrennung
/// zusammen, Abschnitte mit Seite, Tabellen mit Überschrift. Dazu das mittlere Vertrauen und die Zahl der Zeichen.
export function assemble(pages) {
  const texte = dropRunningLines(pages.map(p => p.text)).map(joinHyphens)
  const chunks = numbered(pack(texte.flatMap((t, i) => chunk(t, { page: i + 1 }))))
  const tables = numberedTables(findTables(pages.map(p => p.rows)))
  const confidence = pages.length ? Math.round(pages.reduce((s, p) => s + (p.confidence || 0), 0) / pages.length) : 0
  return { chunks, tables, confidence, zeichen: texte.join('').replace(/\s/g, '').length }
}

/// Was der Erkenner als Vermerk hinterlässt — am Dokument im Index, sichtbar in ⌕ Dokumente
export const note = (confidence, pages) => `ocr · Vertrauen ${confidence} %${pages ? ` · ${pages} Seiten` : ''}`
