// Plugin docs — Kern ohne Node-Abhängigkeiten.
// Für Text, HTML und OCR: dort gibt es keine Schriftinformation, also entscheiden Zeilenform und Wortlage. Ein PDF
// liest der Typografie-Leser (layout.mjs) — er kennt Schriftgrösse und Schnitt und rät nicht am Text (28.09.2026).
// Hier steht, wie aus Text Abschnitte werden — das Lesen der Dateiformate macht job.mjs.
// Abschnitte statt ganzer Dokumente: ein 40-seitiges Datenblatt ist als Ganzes für die Suche wertlos, und ein Treffer
// soll „Seite 4" sagen können (pflegestruktur §32).

/// Eine Zeile ist eine Überschrift, wenn sie kurz ist, nicht auf einen Satzschluss endet und nicht wie Fliesstext
/// oder eine Tabellenzeile aussieht. Letzteres ist in Datenblättern der Normalfall: „Netzspannungsbereich 220 – 240 V"
/// ist ein Wert, keine Überschrift.
const HEADING = /^[^\n]{3,80}$/
/// Ein Wort, mit dem keine Überschrift endet: der Satz geht in der nächsten Zeile weiter („… zielt HCL vorrangig auf“)
const SATZ_GEHT_WEITER = /\b(und|oder|sowie|mit|auf|für|von|vom|bei|zu|zum|zur|der|die|das|den|dem|des|ein|eine|einen|einem|einer|im|in|an|am|nach|über|unter|durch|ohne|gegen|um|bis|als|wie|aus|sich|noch|auch|nur|sehr|so|dass|ob|wenn|weil|and|or|with|for|of|to|the|a|an|in|on|at|by|from|as)$/i
/// Eine Zeile ist eine Überschrift, wenn sie kurz ist und kein Satz. `next` ist die Zeile danach: geht der Text dort
/// klein oder mit einer Klammer weiter, war die Zeile ein Umbruch im Fliesstext oder ein Spaltenkopf („Größe“ + „(mm)“)
export function isHeading(line, next = null) {
  const s = line.trim()
  if (!HEADING.test(s)) return false
  if (/[.;:,]$/.test(s)) return false
  if (/[-–]$/.test(s)) return false                       // Silbentrennung am Zeilenende: der Satz geht weiter
  if (SATZ_GEHT_WEITER.test(s)) return false
  if (/[a-zäöüß][.!?]\s+[A-ZÄÖÜ]/.test(s)) return false            // ein Satzende mitten in der Zeile: „… variieren. So steigt …“
  if (next != null && /^[a-zäöüß(]/.test(String(next).trim())) return false
  if (s.split(/\s+/).length > 10) return false
  if (/\d[\d.,]*\s*(%|°|[A-Za-zµΩ]{1,4}\b)/.test(s)) return false   // Messwert mit Einheit: 220 V, 100.000 h, 0,16 W
  if ((s.match(/\d/g) ?? []).length > 6) return false      // Zahlenkolonne
  // „1. Verarbeitung", „Technische Daten", „EIGENSCHAFTEN" — aber nicht „Der Klebstoff ist …"
  return /^[\d.]*\s*[A-ZÄÖÜ]/.test(s) && !/\b(ist|sind|wird|werden|kann|können|hat|haben)\b/i.test(s)
}

/// Silbentrennung am Zeilenende zusammenziehen: „Stoßstrom-\nverstärkung" wird ein Wort
export function joinHyphens(text) {
  return String(text ?? '').replace(/([a-zäöüß])-\n([a-zäöüß])/g, '$1$2')
}

/// Zwerge zusammenlegen: ein Abschnitt unter `min` Zeichen wandert zum vorigen, seine Überschrift bleibt im Text
/// erhalten. Ein Datenblatt besteht sonst aus hunderten Ein-Zeilen-Abschnitten, in denen niemand etwas findet.
export function pack(chunks, { min = 220, max = 900 } = {}) {
  const out = []
  for (const c of chunks) {
    const prev = out[out.length - 1]
    const passt = prev && prev.page === c.page && (prev.body.length + c.body.length + 2) <= max
    if (passt && (prev.body.length < min || c.body.length < min)) {
      prev.body += '\n' + (c.heading ? c.heading + ': ' : '') + c.body
      continue
    }
    out.push({ ...c })
  }
  return out
}

/// Text in Abschnitte schneiden: an Absätzen, höchstens `max` Zeichen, Überschriften bleiben beim folgenden Text.
/// Sehr lange Absätze werden an Satzgrenzen geteilt, damit kein Abschnitt unlesbar gross wird.
export function chunk(text, { max = 900, min = 120, page = null } = {}) {
  const clean = String(text ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) return []
  const out = []
  let heading = null, buf = []
  // Eine Überschrift, auf die kein Text folgt, ist keine — sie wird selbst zum Abschnitt. Sonst verschwände sie
  // (kurze Stichpunkte wie „Lösemittelfrei" sehen aus wie Überschriften).
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
  // Zeilenweise: eine Überschrift beginnt einen neuen Abschnitt — in PDFs steht sie mitten im Textfluss, ohne Leerzeile
  for (const para of clean.split(/\n{2,}/)) {
    const zeilen = para.split('\n')
    for (const [i, line] of zeilen.entries()) {
      if (isHeading(line, zeilen[i + 1] ?? null)) { flush(); heading = line.trim(); continue }
      buf.push(line)
      if (buf.join('\n').length >= max) flush()
    }
    if (buf.length) buf.push('')   // Absatzende: der nächste Text beginnt eine neue Zeile
  }
  flush()
  return out
}

/// Abschnitte mehrerer Seiten fortlaufend nummerieren — die Reihenfolge im Dokument bleibt erhalten
export function numbered(chunks) {
  return chunks.map((c, i) => ({ seq: i, page: c.page ?? null, heading: c.heading ?? null, body: c.body }))
}

/// Zeilen, die auf vielen Seiten gleich stehen, sind Kopf- oder Fusszeile — sie gehören nicht in jeden Abschnitt.
/// Erkannt wird an der Wiederholung, nicht an der Position: „www.tridonic.com1Änderungen vorbehalten" steht auf
/// jeder Seite des Datenblatts.
export function dropRunningLines(pages, { minPages = 3, share = 0.6 } = {}) {
  const list = pages.map(p => String(p ?? ''))
  if (list.length < minPages) return list
  const zahl = new Map()
  for (const page of list) {
    const gesehen = new Set()
    for (const line of page.split('\n')) {
      const key = norm(line)
      if (!key || key.length < 6 || gesehen.has(key)) continue
      gesehen.add(key)
      zahl.set(key, (zahl.get(key) ?? 0) + 1)
    }
  }
  const raus = new Set([...zahl].filter(([, n]) => n >= Math.ceil(list.length * share)).map(([k]) => k))
  if (!raus.size) return list
  return list.map(page => page.split('\n').filter(line => !raus.has(norm(line))).join('\n'))
}
/// Vergleichsform einer Zeile: Ziffern werden zu #, damit „Seite 3 von 10" und „Seite 4 von 10" dasselbe sind
const norm = s => String(s ?? '').trim().toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ')

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

// ---- Tabellen (27.09.2026, pflegestruktur 34 L): technische Daten stehen in Dokumenten als Schlüssel links, Wert rechts.
// Der Leser findet sie beim selben Lesen wie den Text und legt sie neben ihn; der Dialog am Knoten macht daraus Attribute.

/// Zellen einer Zeile aus den Textstücken mit ihrer x-Lage: ein Sprung nach rechts, der grösser ist als ein
/// Wortabstand, trennt zwei Zellen. Stücke ohne Lage werden eine Zelle.
export function cellsOf(items, { gap = 14 } = {}) {
  const cells = []; let cur = '', end = null
  for (const it of items) {
    const s = String(it.str ?? '').replace(/\n/g, ' ')
    const x = Number(it.x ?? 0), w = Number(it.w ?? 0)
    if (end !== null && x - end > gap && cur.trim()) { cells.push(cur.trim()); cur = '' }
    cur += s
    end = Math.max(end ?? x, x + w)
  }
  if (cur.trim()) cells.push(cur.trim())
  return cells
}

/// Eine Zeile Schlüssel/Wert: links ein Name (beginnt mit einem Buchstaben, höchstens acht Wörter, kein Satzende), rechts ein Wert.
const KEY = /^[A-Za-zÄÖÜäöüß][^\n]{1,60}$/
export function isKeyValueRow(cells) {
  if (!Array.isArray(cells) || cells.length < 2) return false
  const k = String(cells[0] ?? '').trim().replace(/:$/, ''), v = cells.slice(1).map(c => String(c ?? '').trim()).filter(Boolean).join(' ')
  return KEY.test(k) && !/[.;]$/.test(k) && k.split(/\s+/).length <= 8 && v.length > 0 && v.length <= 120
}

/// Tabellen in den Zeilen der Seiten: drei oder mehr Zeilen Schlüssel/Wert hintereinander sind eine Tabelle, die
/// Überschrift ist die letzte Überschrift davor. Eine einzelne Zeile ist keine — „Seite 3 von 10“ sähe sonst aus wie
/// ein Wert. pageRows: je Seite die Zeilen als Zellen.
export function findTables(pageRows, { minRows = 3 } = {}) {
  const out = []
  pageRows.forEach((lines, pi) => {
    let heading = null, run = []
    const flush = () => { if (run.length >= minRows) out.push({ page: pi + 1, heading, rows: run.map(c => [String(c[0]).trim().replace(/:$/, ''), ...c.slice(1).map(x => String(x ?? '').trim())]) }); run = [] }
    for (const cells of lines) {
      if (isKeyValueRow(cells)) { run.push(cells); continue }
      flush()
      const text = cells.join(' ').trim()
      if (isHeading(text)) heading = text
    }
    flush()
  })
  return out
}

/// Schlüssel/Wert aus blossem Text (Textdateien, HTML): „Gewicht: 1,2 kg“, „Breite<TAB>22 mm“, zwei Leerzeichen dazwischen.
const KV = /^([A-Za-zÄÖÜäöüß][^:\t]{1,60}?)\s*(?::|\t| {2,})\s*(\S.{0,119})$/
export function pairsFromText(text, { minRows = 3 } = {}) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map(l => { const m = l.trim().match(KV); return m ? [m[1].trim(), m[2].trim()] : [l.trim()] })
  return findTables([lines], { minRows }).map(t => ({ ...t, page: null }))
}

/// Tabellen fortlaufend nummerieren — die Reihenfolge im Dokument bleibt erhalten
export function numberedTables(tables) { return tables.map((t, i) => ({ seq: i, page: t.page ?? null, heading: t.heading ?? null, header: t.header ?? null, rows: t.rows })) }
