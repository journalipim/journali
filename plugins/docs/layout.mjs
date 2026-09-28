// Typografie-Leser (28.09.2026). Ein PDF trägt sein Layout: Schriftgrösse, Schriftschnitt und Lage jedes Textstücks.
// Der Leser nimmt, was der Setzer festgelegt hat, statt am Text zu raten — eine Überschrift ist grösser oder in einem
// anderen Schnitt als der Fliesstext, eine Spalte ist ein Block mit eigener x-Lage, eine Tabelle sind Zeilen mit
// gleichen Spaltenkanten, die Lesereihenfolge ergibt sich aus den Lücken (XY-Schnitt).
//
// Stufen, alles reine Funktionen über die Textstücke (pdfjs läuft nur in pdf.mjs):
//   lines   — Stücke mit gleicher Grundlinie; darin Läufe, getrennt an Sprüngen nach rechts (Zellen)
//   tables  — Zeilen mit mehreren Läufen und gleichen Spaltenkanten; mehrzeilige Zellen; der Kopf darüber, je Spalte zusammengesetzt
//   blocks  — Läufe, die untereinander stehen (gleiche linke Kante oder Überlappung, gleiche Grösse, gleicher Schnitt)
//   order   — XY-Schnitt: die grösste Lücke teilt, oben vor unten, links vor rechts
//   roles   — Fliesstext ist die häufigste Grösse; grösser oder anderer Schnitt und kurz ist Überschrift; kleiner ist Kleingedrucktes
//   layoutDocument — daraus Abschnitte (Überschrift, Seite, Text) und Schlüssel/Wert-Tabellen für den Index
//
// Ein Stück: { str, x, y, w, h, font } — x/y linke Grundlinie, w Breite, h Schriftgrösse, font der Schriftname.

const num = v => Number(v) || 0
const norm = s => String(s ?? '').trim().toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ')
const ueberlappt = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
/// Zwei Läufe stehen in derselben Spalte, wenn die linke Kante gleich ist oder sich die x-Bereiche überlappen
const gleicheSpalte = (a, b, size) => Math.abs(a.x0 - b.x0) <= 1.0 * size || ueberlappt(a, b) >= 0.3 * Math.min(a.x1 - a.x0, b.x1 - b.x0)

/// Zeilen: Stücke mit gleicher Grundlinie (Toleranz halbe Schriftgrösse), von oben nach unten. In der Zeile Läufe:
/// ein Sprung nach rechts, der grösser ist als ein Wortabstand, trennt zwei Läufe — das sind die Zellen einer Tabelle
export function lines(items) {
  const st = (items ?? []).filter(i => String(i.str ?? '').trim()).map(i => ({
    text: String(i.str).replace(/\s+/g, ' '), x0: num(i.x), x1: num(i.x) + num(i.w), y: num(i.y), size: num(i.h) || 1, font: String(i.font ?? '') }))
  st.sort((a, b) => b.y - a.y || a.x0 - b.x0)
  const out = []
  for (const s of st) {
    const l = out.at(-1)
    if (l && Math.abs(l.y - s.y) <= 0.5 * Math.max(l.size, s.size)) { l.items.push(s); l.size = Math.max(l.size, s.size); continue }
    out.push({ y: s.y, size: s.size, items: [s] })
  }
  for (const l of out) {
    l.items.sort((a, b) => a.x0 - b.x0)
    l.runs = []
    for (const i of l.items) {
      const r = l.runs.at(-1)
      if (r && i.x0 - r.x1 <= Math.max(1.1 * Math.min(r.size, i.size), 5)) {
        r.text += (i.x0 - r.x1 > 0.15 * i.size && !/\s$/.test(r.text) && !/^\s/.test(i.text) ? ' ' : '') + i.text
        r.x1 = Math.max(r.x1, i.x1); r.size = Math.max(r.size, i.size); r.fonts.set(i.font, (r.fonts.get(i.font) ?? 0) + i.text.length); continue
      }
      l.runs.push({ x0: i.x0, x1: i.x1, y: l.y, text: i.text, size: i.size, fonts: new Map([[i.font, i.text.length]]) })
    }
    for (const r of l.runs) { r.text = r.text.trim(); r.font = [...r.fonts.entries()].sort((a, b) => b[1] - a[1])[0][0]; delete r.fonts }
    l.runs = l.runs.filter(r => r.text)
    l.x0 = l.runs[0]?.x0 ?? 0; l.x1 = l.runs.at(-1)?.x1 ?? 0
    delete l.items
  }
  return out.filter(l => l.runs.length)
}

/// Die Spalten einer Tabelle: die linken Kanten aller Läufe, gebündelt; eine Spalte endet vor der nächsten
function spaltenVon(laeufe) {
  const sp = []
  for (const k of [...laeufe].sort((a, b) => a.x0 - b.x0)) {
    const s = sp.at(-1)
    if (s && k.x0 - s.x0 <= 1.0 * Math.max(k.size, s.size)) { s.x1 = Math.max(s.x1, k.x1); continue }
    sp.push({ x0: k.x0, x1: k.x1, size: k.size })
  }
  for (let i = 0; i + 1 < sp.length; i++) sp[i].x1 = Math.min(sp[i].x1, sp[i + 1].x0 - 0.01)
  return sp
}
/// Absätze schützen: ein Block mit mindestens drei Zeilen, dessen Zeilen fast gleich breit sind (Flattersatz füllt die
/// Spalte), ist Fliesstext. Seine Läufe sind für die Tabellenerkennung gesperrt — sonst sähen zwei Textspalten
/// nebeneinander wie eine Tabelle mit zwei Spalten aus (28.09.2026)
export function paragraphs(ls) {
  const gesperrt = new Set()
  for (const b of blocks(ls)) {
    const breite = b.x1 - b.x0
    if (b.lines.length < 3 || breite < 8 * b.size) continue
    const voll = b.lines.filter(r => r.x1 - r.x0 >= 0.8 * breite).length
    if (voll >= b.lines.length * 0.6) for (const r of b.lines) gesperrt.add(r)
  }
  return gesperrt
}

/// Die Spalte eines Laufs: die mit der grössten Überlappung, sonst die mit der gleichen linken Kante — genau eine
function spalteVon(r, sp) {
  let best = -1, bo = 0
  sp.forEach((s, i) => { const o = ueberlappt(r, s); if (o > bo) { bo = o; best = i } })
  if (best >= 0) return best
  sp.forEach((s, i) => { if (best < 0 && Math.abs(r.x0 - s.x0) <= 1.0 * r.size) best = i })
  return best
}

/// Tabellen: eine Zeile mit mindestens zwei Läufen beginnt eine Reihe; die nächste Zeile gehört als Reihe dazu, wenn
/// zwei ihrer Läufe auf denselben Spaltenkanten stehen. Eine Zeile mit einem Lauf in einer Spalte ausser der ersten
/// setzt die Zelle fort (mehrzeiliger Wert) — auch vor der Reihe, wenn der Schlüssel mittig daneben steht. Jede Reihe
/// braucht eine kurze Zelle: zwei Textspalten mit Absätzen auf gleicher Höhe sind keine Tabelle. Zwei Reihen sind eine.
/// Die Daten sind die Reihen im häufigsten Schnitt; der Kopf sind führende Reihen und Zeilen darüber in einem anderen
/// Schnitt, deren Läufe in den Spalten stehen — umbrochene Kopfzellen („Ausgangs-“, „spannung“, „(V)“) werden je
/// Spalte zusammengesetzt. Markiert die verbrauchten Zeilen (tabelle) und liefert Tabellenblöcke { table, header, rows, lines }
export function tables(ls, gesperrt = paragraphs(ls)) {
  const kurz = r => r.text.length <= 40
  const frei = l => l.runs.some(r => !gesperrt.has(r))
  const text = zs => zs.map(z => z.text).join(' ').replace(/(\p{Ll})- (\p{Ll})/gu, '$1$2').trim()
  const out = []
  let i = 0
  while (i < ls.length) {
    const l = ls[i]
    if (l.runs.length < 2 || !l.runs.some(kurz) || !frei(l)) { i++; continue }
    let sp = spaltenVon(l.runs)
    const reihen = [{ zellen: l.runs.map(r => ({ ...r })), zeilen: [l] }]
    // Fortsetzungen über der ersten Reihe: Zeilen mit einem Lauf in einer Spalte ausser der ersten, dicht darüber
    for (let k = i - 1; k >= 0; k--) {
      const h = ls[k]; const u = reihen[0].zeilen[0]
      if (h.tabelle || !frei(h) || h.runs.length !== 1 || u.y - h.y <= 0 || h.y - u.y > 1.8 * Math.max(h.size, u.size)) break
      const c = spalteVon(h.runs[0], sp); if (c <= 0) break
      if (reihen[0].zellen.some(z => spalteVon(z, sp) === c && z.font !== h.runs[0].font)) break
      reihen[0].zeilen.unshift(h); reihen[0].zellen.push({ ...h.runs[0] })
    }
    let j = i + 1
    while (j < ls.length) {
      const n = ls[j], vor = reihen.at(-1), letzte = vor.zeilen.at(-1)
      const dy = letzte.y - n.y, size = Math.max(letzte.size, n.size)
      if (!frei(n)) break
      if (n.runs.length === 1 && dy <= 1.8 * size && spalteVon(n.runs[0], sp) > 0) { vor.zeilen.push(n); vor.zellen.push({ ...n.runs[0] }); j++; continue }
      if (n.runs.length < 2 || dy > 3.5 * size || !n.runs.some(kurz)) break
      const passend = n.runs.filter(r => sp.some(s => Math.abs(s.x0 - r.x0) <= 0.8 * size) || spalteVon(r, sp) >= 0).length
      if (passend < 2) break
      reihen.push({ zellen: n.runs.map(r => ({ ...r })), zeilen: [n] }); j++
      sp = spaltenVon(reihen.flatMap(r => r.zellen))
    }
    if (reihen.length < 2) { i++; continue }
    // die Daten: der Schnitt der meisten Reihen; führende Reihen in einem anderen Schnitt sind Kopf
    const zahl = new Map(); for (const r of reihen) for (const f of new Set(r.zellen.map(z => z.font))) zahl.set(f, (zahl.get(f) ?? 0) + 1)
    const datenFont = [...zahl.entries()].sort((a, b) => b[1] - a[1])[0][0]
    let k = 0; while (k < reihen.length - 2 && reihen[k].zellen.every(z => z.font !== datenFont)) k++
    const daten = reihen.slice(k)
    if (daten.length < 2) { i++; continue }
    sp = spaltenVon(daten.flatMap(r => r.zellen))
    const kopfZeilen = reihen.slice(0, k).flatMap(r => r.zeilen)
    // Zeilen über der Tabelle, deren Läufe in den Spalten stehen, in einem anderen Schnitt als die Daten — bis zu sechs
    const oberste = () => (kopfZeilen[0] ?? daten[0].zeilen[0])
    for (let m = ls.indexOf(oberste()) - 1, n = 0; m >= 0 && n < 6; m--, n++) {
      const h = ls[m]; const u = oberste()
      if (h.tabelle || !frei(h) || u.y - h.y >= 0 || h.y - u.y > 2.2 * Math.max(h.size, u.size) || h.size > daten[0].zeilen[0].size * 1.15) break
      if (!h.runs.every(r => r.font !== datenFont && spalteVon(r, sp) >= 0)) break
      kopfZeilen.unshift(h)
    }
    const header = kopfZeilen.length ? sp.map((s, ci) => text(kopfZeilen.flatMap(h => h.runs.filter(r => spalteVon(r, sp) === ci)).sort((x, y) => y.y - x.y))) : null
    const rows = daten.map(r => sp.map((s, ci) => text(r.zellen.filter(z => spalteVon(z, sp) === ci).sort((x, y) => y.y - x.y))))
    const alle = [...kopfZeilen, ...daten.flatMap(r => r.zeilen)]
    for (const z of alle) z.tabelle = true
    out.push({ x0: Math.min(...alle.map(z => z.x0)), x1: Math.max(...alle.map(z => z.x1)), y1: Math.max(...alle.map(z => z.y + z.size)), y0: Math.min(...alle.map(z => z.y)),
      size: daten[0].zeilen[0].size, font: datenFont, chars: rows.flat().join('').length, table: true, header, rows, lines: alle })
    i = j
  }
  return out
}

/// Blöcke: Läufe, die untereinander stehen — gleiche Spalte, Zeilenabstand höchstens das 1,8-Fache der Grösse, gleiche
/// Grösse, gleicher Schnitt. So werden zwei Spalten zwei Blöcke, und eine Überschrift bleibt für sich. Tabellenzeilen
/// sind schon vergeben
export function blocks(ls) {
  const out = []
  for (const l of ls) {
    if (l.tabelle) continue
    for (const r of l.runs) {
      let best = null, bs = 0
      for (const b of out) {
        const dy = b.y0 - l.y
        if (dy <= 0 || dy > 1.8 * Math.max(b.size, r.size)) continue
        if (Math.abs(b.size - r.size) > 0.6 || b.font !== r.font) continue
        if (!gleicheSpalte(b, r, r.size)) continue
        const sc = (Math.abs(b.x0 - r.x0) <= 1.0 * r.size ? 1 : 0) + ueberlappt(b, r) / Math.max(1, Math.min(b.x1 - b.x0, r.x1 - r.x0))
        if (sc > bs) { bs = sc; best = b }
      }
      if (best) { best.lines.push(r); best.y0 = l.y; best.x0 = Math.min(best.x0, r.x0); best.x1 = Math.max(best.x1, r.x1); best.chars += r.text.length }
      else out.push({ x0: r.x0, x1: r.x1, y1: l.y + r.size, y0: l.y, size: r.size, font: r.font, lines: [r], chars: r.text.length })
    }
  }
  return out
}

/// Lesereihenfolge per XY-Schnitt: die grösste Lücke, die alle Blöcke trennt, teilt die Menge — oben vor unten, links
/// vor rechts; dann weiter in beiden Hälften. Ohne Lücke: von oben nach unten, von links nach rechts
export function order(bs, { gapY = 6, gapX = 12 } = {}) {
  if (bs.length <= 1) return [...bs]
  const luecke = get => {
    const iv = bs.map(get).sort((a, b) => a[0] - b[0])
    let ende = iv[0][1], best = null
    for (let i = 1; i < iv.length; i++) { const g = iv[i][0] - ende; if (g > (best?.g ?? 0)) best = { g, at: ende + g / 2 }; ende = Math.max(ende, iv[i][1]) }
    return best
  }
  const y = luecke(b => [-b.y1, -b.y0]), x = luecke(b => [b.x0, b.x1])   // y negiert: oben zuerst
  const ny = y && y.g >= gapY ? y.g : 0, nx = x && x.g >= gapX ? x.g : 0
  if (ny || nx) {
    if (ny >= nx) { const oben = bs.filter(b => -b.y1 < y.at); return [...order(oben, { gapY, gapX }), ...order(bs.filter(b => !oben.includes(b)), { gapY, gapX })] }
    const links = bs.filter(b => b.x0 < x.at); return [...order(links, { gapY, gapX }), ...order(bs.filter(b => !links.includes(b)), { gapY, gapX })]
  }
  return [...bs].sort((a, b) => b.y1 - a.y1 || a.x0 - b.x0)
}

/// Der Text eines Blocks: Zeilen untereinander, Silbentrennung am Zeilenende zusammengezogen; eine Tabelle zeilenweise
/// mit | zwischen den Zellen
export function blockText(b) {
  if (b.table) return b.rows.map(r => r.join(' | ')).join('\n')
  return b.lines.map(r => r.text).join('\n').replace(/(\p{Ll})-\n(\p{Ll})/gu, '$1$2')
}

/// Rollen: der Fliesstext ist die Grösse mit den meisten Zeichen; grösser und kurz ist eine Überschrift, in einem
/// anderen Schnitt und kurz auch (Zwischenüberschrift), deutlich kleiner ist Kleingedrucktes. Die Stufe folgt der
/// Grösse. Eine Überschrift hat ein Wort — „2“ und „•“ sind Schrittnummern und Zeichen
export function roles(bs, { bodySize = null, bodyFont = null } = {}) {
  if (bodySize == null) {
    const z = new Map(); for (const b of bs) { const k = Math.round(b.size * 2) / 2; z.set(k, (z.get(k) ?? 0) + b.chars) }
    bodySize = [...z.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10
  }
  if (bodyFont == null) {
    const z = new Map(); for (const b of bs) if (Math.abs(b.size - bodySize) <= 0.6) z.set(b.font, (z.get(b.font) ?? 0) + b.chars)
    bodyFont = [...z.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  }
  const groessen = new Set()
  for (const b of bs) {
    if (b.table) { b.role = 'table'; continue }
    const t = blockText(b)
    const kurz = b.lines.length <= 3 && b.chars <= 200 && !/[.!?;:,]$/.test(t)
    const wort = /\p{L}[\p{L}\p{M}'’-]*\p{L}/u.test(t)
    if (wort && b.size >= bodySize * 1.15 && b.lines.length <= 4 && b.chars <= 240) { b.role = 'heading'; groessen.add(Math.round(b.size * 2) / 2) }
    else if (wort && b.font !== bodyFont && Math.abs(b.size - bodySize) <= 1.5 && kurz && b.lines.length <= 2 && b.chars <= 120) b.role = 'subheading'
    else if (b.size <= bodySize * 0.8) b.role = 'small'
    else b.role = 'text'
  }
  const stufen = [...groessen].sort((a, b) => b - a)
  for (const b of bs) b.level = b.role === 'heading' ? stufen.indexOf(Math.round(b.size * 2) / 2) + 1 : b.role === 'subheading' ? stufen.length + 1 : null
  return { bodySize, bodyFont }
}

/// Eine Seite: Zeilen, Tabellen, Blöcke, Reihenfolge, Rollen. `body` (Grösse und Schnitt des Fliesstexts) kommt aus dem
/// ganzen Dokument, damit eine Seite voller Tabellen nicht ihre eigene Norm bekommt
export function analysePage(items, body = {}) {
  const ls = lines(items)
  const tb = tables(ls)
  const bs = order([...tb, ...blocks(ls)])
  const stats = roles(bs, body)
  return { blocks: bs, ...stats }
}

/// Grösse und Schnitt des Fliesstexts über alle Seiten: die Zeichen zählen, nicht die Seiten
export function bodyOf(pages) {
  return roles(pages.flatMap(p => { const ls = lines(p.items); return [...tables(ls), ...blocks(ls)] }))
}

/// Eine Zeile Schlüssel/Wert: links ein Name, rechts ein Wert
const KEY = /^[A-Za-zÄÖÜäöüß][^\n]{1,60}$/
const istSchluesselWert = r => r.length >= 2 && KEY.test(r[0].replace(/:$/, '')) && !/[.;]$/.test(r[0]) && r[0].split(/\s+/).length <= 8 && r.slice(1).join(' ').trim().length > 0 && r.slice(1).join(' ').length <= 120

/// Das Dokument: je Seite die Blöcke in Lesereihenfolge; Kopf- und Fusszeilen (auf den meisten Seiten dieselbe Zeile)
/// fallen weg; Überschriften bleiben am folgenden Text; Tabellen mit Schlüssel und Wert gehen daneben in `tables`.
/// pages: [{ page, items }]. Liefert { chunks, tables, zeichen }
export function layoutDocument(pages, { max = 900, minRows = 3 } = {}) {
  const body = bodyOf(pages)
  const seiten = pages.map(p => ({ page: p.page, ...analysePage(p.items, body) }))
  // Kopf- und Fusszeilen: ein kurzer Block, der auf mindestens 60 % der Seiten (ab drei) gleich steht
  const zahl = new Map()
  for (const s of seiten) for (const k of new Set(s.blocks.filter(b => !b.table && b.lines.length <= 2 && b.chars <= 80).map(b => norm(blockText(b))))) if (k) zahl.set(k, (zahl.get(k) ?? 0) + 1)
  const laufend = new Set(seiten.length >= 3 ? [...zahl].filter(([, n]) => n >= Math.ceil(seiten.length * 0.6)).map(([k]) => k) : [])
  const chunks = [], tabellen = []
  let zeichen = 0
  for (const s of seiten) {
    let heading = null, offen = null   // offen: eine Überschrift, auf die noch kein Text folgte
    const push = body => { for (const teil of teile(body, max)) chunks.push({ page: s.page, heading, body: teil }) }
    for (const b of s.blocks) {
      const t = blockText(b).trim(); if (!t) continue
      zeichen += t.replace(/\s/g, '').length
      if (!b.table && laufend.has(norm(t))) continue
      if (b.role === 'heading' || b.role === 'subheading') {
        // zwei Überschriften hintereinander: die erste wird selbst ein Abschnitt (Titel und Untertitel), die zweite gilt
        if (offen) chunks.push({ page: s.page, heading: null, body: offen })
        heading = t.replace(/\n/g, ' '); offen = heading; continue
      }
      if (b.table) {
        if (b.rows.length >= minRows && b.rows.every(istSchluesselWert)) tabellen.push({ page: s.page, heading, rows: b.rows.map(r => [r[0].replace(/:$/, ''), ...r.slice(1)]) })
        push((b.header && b.header.some(Boolean) ? b.header.join(' | ') + '\n' : '') + t); offen = null; continue
      }
      push(t); offen = null
    }
    if (offen) chunks.push({ page: s.page, heading: null, body: offen })
  }
  return { chunks: pack(chunks, { max }), tables: tabellen, zeichen }
}

/// Zwerge zusammenlegen: zwei Abschnitte derselben Seite mit derselben Überschrift werden einer, solange sie klein
/// sind — ein Katalog hat je Seite dreissig Schnipsel, und ein Treffer auf „50 W“ allein sagt nichts
export function pack(chunks, { min = 220, max = 900 } = {}) {
  const out = []
  for (const c of chunks) {
    const prev = out.at(-1)
    if (prev && prev.page === c.page && prev.heading === c.heading && prev.body.length + c.body.length + 1 <= max && (prev.body.length < min || c.body.length < min)) { prev.body += '\n' + c.body; continue }
    out.push({ ...c })
  }
  return out
}

/// Ein langer Block wird an Satzenden geteilt, damit kein Abschnitt unlesbar gross wird
function teile(body, max) {
  if (body.length <= max) return [body]
  const out = []; let rest = body
  while (rest.length > max) {
    let cut = rest.lastIndexOf('. ', max); if (cut < max / 4) cut = rest.lastIndexOf('\n', max); if (cut < max / 4) cut = rest.lastIndexOf(' ', max); if (cut < max / 4) cut = max
    out.push(rest.slice(0, cut + 1).trim()); rest = rest.slice(cut + 1).trim()
  }
  if (rest) out.push(rest)
  return out
}
