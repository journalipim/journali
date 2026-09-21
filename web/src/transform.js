// Umwandlung je Spalte im Datenmapper (Taloan, 21.09.2026, Blick in den OpenDXP-Importer: „für jedes Feld eine Zuordnung — aber
// ich kann Werte umwandeln und manipulieren … zwischendurch in die Daten eingreifen“): zwischen Quelle und Ziel eine Kette
// kleiner Schritte, in der Zuordnung gespeichert (m.steps) und damit im Profil. Rein, ohne Zustand, im Browser und im Test.
// Jeder Schritt: { op, …felder }. Reihenfolge = Kette. Leere Eingabe bleibt leer, ausser static/default/combine sagen etwas.

export const OPS = [
  ['trim', 'Leerzeichen kürzen', 'vorne und hinten weg, mehrere innen zu einem'],
  ['upper', 'GROSS', 'alles in Grossbuchstaben'], ['lower', 'klein', 'alles in Kleinbuchstaben'],
  ['replace', 'Ersetzen', 'sucht einen Text und ersetzt ihn (leer = entfernen); regex: das Suchfeld ist ein regulärer Ausdruck'],
  ['prefix', 'Voranstellen', 'Text vor den Wert setzen (nur, wenn der Wert nicht leer ist)'], ['suffix', 'Anhängen', 'Text hinter den Wert setzen (nur, wenn der Wert nicht leer ist)'],
  ['static', 'Fester Wert', 'immer dieser Text — was in der Spalte steht, ist egal'],
  ['default', 'Wenn leer', 'dieser Text, wenn die Zelle leer ist; sonst bleibt der Wert'],
  ['combine', 'Spalten verbinden', 'Spaltennamen mit Komma, {} steht für diese Spalte; dazwischen der Trenner — z. B. Spalten „brand,{}“ Trenner „ “'],
  ['split', 'Aufteilen', 'zerlegt am Trenner; Teil = eine Zahl: 0 = erster Teil, 1 = zweiter, -1 = letzter; leer = alle Teile, mit Komma verbunden'],
  ['number', 'Zahl', 'macht eine Zahl daraus: Einheit und Leerzeichen fallen weg, Tausenderzeichen auch („22 mm“ → 22, „1.234,5“ → 1234.5); Dezimalzeichen wird geraten oder gesetzt'],
  ['boolean', 'Wahrheitswert', 'true, wenn in der Zelle ja, yes, true, 1, x, wahr, y, t oder j steht — oder eines deiner weiteren Wörter; sonst false; leere Zelle bleibt leer'],
  ['date', 'Datum', 'liest das Datum im angegebenen Format (oder rät es) und schreibt JJJJ-MM-TT; auch Unix-Zeit (Sekunden/Millisekunden) und Excel-Zahlen'],
  ['htmldecode', 'HTML-Entities auflösen', '&amp; → &, &lt; → <, &#65; → A'],
  ['striphtml', 'HTML entfernen', 'Tags weg, der Text bleibt'],
  ['map', 'Werte ersetzen nach Tabelle', 'alt=neu; alt2=neu2 — z. B. „Ja=true; Nein=false“ oder „rot=RAL3000“; nicht Genanntes bleibt (oder wird zu „sonst“)'],
  ['when', 'Bedingung', 'prüft die Quelle (leer / gleich / enthält / passt auf regex) gegen den Wert; dann und sonst sind Texte, {} steht für die Quelle'],
]

const S = v => v == null ? '' : String(v)

/// Datumsformate (Taloan, 21.09.: „drei Varianten sind viel zu wenig — Unix-Zeit etc.“): Schlüssel → Bezeichnung
export const DATE_FORMATS = [
  ['auto', 'raten (ISO, deutsch, Unix, Excel …)'],
  ['dd.MM.yyyy', 'TT.MM.JJJJ (deutsch, auch TT.MM.JJ)'], ['dd/MM/yyyy', 'TT/MM/JJJJ (britisch)'], ['MM/dd/yyyy', 'MM/TT/JJJJ (US)'], ['dd-MM-yyyy', 'TT-MM-JJJJ'],
  ['yyyy-MM-dd', 'JJJJ-MM-TT (ISO, auch mit Uhrzeit)'], ['yyyy/MM/dd', 'JJJJ/MM/TT'], ['yyyyMMdd', 'JJJJMMTT'],
  ['unix', 'Unix-Zeit in Sekunden'], ['unixms', 'Unix-Zeit in Millisekunden'], ['excel', 'Excel-Zahl (Tage seit 1900)'],
]
const pad = n => String(n).padStart(2, '0')
const iso = (y, m, d) => { const yy = Number(y), mm = Number(m), dd = Number(d); if (!(mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31)) return null; const Y = yy < 100 ? (yy < 70 ? 2000 + yy : 1900 + yy) : yy; return `${Y}-${pad(mm)}-${pad(dd)}` }
const fromEpoch = ms => { const d = new Date(ms); return isNaN(d) ? null : `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` }
/// Datum lesen → JJJJ-MM-TT oder null; format aus DATE_FORMATS, 'auto' probiert der Reihe nach (eindeutige Muster zuerst)
export function parseDate(t, format = 'auto') {
  t = String(t ?? '').trim(); if (!t) return null; let m
  const f = format === 'jjjj' ? 'auto' : format
  const tryF = (fmt) => {
    switch (fmt) {
      case 'dd.MM.yyyy': return (m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\D|$)/)) ? iso(m[3], m[2], m[1]) : null
      case 'dd/MM/yyyy': return (m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\D|$)/)) ? iso(m[3], m[2], m[1]) : null
      case 'MM/dd/yyyy': return (m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\D|$)/)) ? iso(m[3], m[1], m[2]) : null
      case 'dd-MM-yyyy': return (m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\D|$)/)) ? iso(m[3], m[2], m[1]) : null
      case 'yyyy-MM-dd': return (m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:\D|$)/)) ? iso(m[1], m[2], m[3]) : null
      case 'yyyy/MM/dd': return (m = t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\D|$)/)) ? iso(m[1], m[2], m[3]) : null
      case 'yyyyMMdd': return (m = t.match(/^(\d{4})(\d{2})(\d{2})$/)) ? iso(m[1], m[2], m[3]) : null
      case 'unix': return /^-?\d{9,11}$/.test(t) ? fromEpoch(Number(t) * 1000) : null
      case 'unixms': return /^-?\d{12,14}$/.test(t) ? fromEpoch(Number(t)) : null
      case 'excel': { if (!/^\d{1,6}(\.\d+)?$/.test(t)) return null; const n = Number(t); if (n < 60 || n > 2958465) return null; return fromEpoch(Date.UTC(1899, 11, 30) + Math.floor(n) * 864e5) }   // Excel: Tag 1 = 1.1.1900, mit dem 1900-Schaltjahr-Fehler ab Tag 60
      default: return null
    }
  }
  if (f !== 'auto') return tryF(f)
  for (const fmt of ['yyyy-MM-dd', 'yyyy/MM/dd', 'yyyyMMdd', 'dd.MM.yyyy', 'dd-MM-yyyy', 'dd/MM/yyyy', 'unixms', 'unix', 'excel']) { const r = tryF(fmt); if (r) return r }
  return null
}
const fill = (t, v) => S(t).replace(/\{\}/g, v)

/// Einen Wert durch die Kette schicken. ctx.get(column) liefert Rohwerte anderer Spalten (für combine).
export function apply(steps, value, ctx = {}) {
  if (!Array.isArray(steps) || !steps.length) return value
  let v = value == null ? '' : String(value)
  for (const st of steps) {
    const op = st?.op
    try {
      switch (op) {
        case 'trim': v = v.trim().replace(/\s+/g, ' '); break
        case 'upper': v = v.toUpperCase(); break
        case 'lower': v = v.toLowerCase(); break
        case 'replace': { const f = S(st.find); if (!f) break; v = st.regex ? v.replace(new RegExp(f, 'gi'), S(st.with)) : v.split(f).join(S(st.with)); break }
        case 'prefix': if (v !== '') v = S(st.text) + v; break
        case 'suffix': if (v !== '') v = v + S(st.text); break
        case 'static': v = S(st.text); break
        case 'default': if (v.trim() === '') v = S(st.text); break
        case 'combine': {
          const cols = S(st.columns).split(',').map(s => s.trim()).filter(Boolean)
          const parts = cols.map(c => c === '{}' ? v : S(ctx.get?.(c))).filter(p => p !== '')
          v = parts.join(st.sep ?? ' '); break
        }
        case 'split': {
          const sep = S(st.sep || ','); const parts = v.split(sep).map(s => s.trim()).filter(Boolean)
          if (st.index === '' || st.index == null) v = parts.join(','); else { const i = Number(st.index); v = (i < 0 ? parts[parts.length + i] : parts[i]) ?? '' }
          break
        }
        case 'number': {
          if (v.trim() === '') break
          const dec = st.decimal === '.' ? '.' : st.decimal === ',' ? ',' : null
          let s = v.replace(/[^\d,.\-+]/g, '')   // Einheit, Leerzeichen weg
          if (dec === ',') s = s.replace(/\./g, '').replace(',', '.')
          else if (dec === '.') s = s.replace(/,/g, '')
          else { const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.'); s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '') }   // raten: das letzte Trennzeichen ist das Dezimalzeichen
          const n = Number(s); v = Number.isFinite(n) ? String(n) : v; break
        }
        case 'boolean': {
          if (v.trim() === '') break
          // Vorgabe bleibt immer gültig; eigene Wörter kommen dazu (Taloan, 21.09.: „warum ein Eingabefeld, wenn die Auswertung fest ist?“ — für Dateien, die es anders schreiben)
          const yes = ('ja,yes,true,1,x,wahr,y,t,j,' + S(st.yes || st.true)).split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
          v = yes.includes(v.trim().toLowerCase()) ? 'true' : 'false'; break
        }
        case 'date': { const t = v.trim(); if (!t) break; v = parseDate(t, st.format || 'auto') ?? v; break }
        case 'htmldecode': v = v.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' })[e]).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))); break
        case 'striphtml': v = v.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); break
        case 'map': {
          const pairs = S(st.pairs).split(';').map(p => p.split('=')).filter(p => p.length === 2).map(([a, b]) => [a.trim().toLowerCase(), b.trim()])
          const hit = pairs.find(([a]) => a === v.trim().toLowerCase())
          v = hit ? hit[1] : (st.other != null && st.other !== '' ? S(st.other) : v); break
        }
        case 'when': {
          const val = S(st.value); const t = v.trim()
          const ok = st.test === 'empty' ? t === '' : st.test === 'equals' ? t.toLowerCase() === val.toLowerCase() : st.test === 'contains' ? t.toLowerCase().includes(val.toLowerCase()) : st.test === 'matches' ? new RegExp(val, 'i').test(t) : false
          v = fill(ok ? st.then : (st.else ?? '{}'), v); break
        }
        default: break
      }
    } catch { /* ein kaputter Schritt (z. B. Regex) lässt den Wert, wie er ist */ }
  }
  return v
}

/// Kurzform einer Kette für die Anzeige: „trim → replace(mm→) → number“
export function describe(steps) {
  if (!Array.isArray(steps) || !steps.length) return ''
  return steps.map(s => {
    switch (s.op) {
      case 'replace': return `ersetze „${s.find}“→„${s.with ?? ''}“`
      case 'prefix': case 'suffix': case 'static': case 'default': return `${OPS.find(o => o[0] === s.op)?.[1]} „${s.text ?? ''}“`
      case 'combine': return `verbinde ${s.columns}`
      case 'split': return `teile „${s.sep ?? ','}“ [${s.index ?? 'alle'}]`
      case 'number': return `Zahl${s.decimal ? ' (' + s.decimal + ')' : ''}`
      case 'when': return `wenn ${s.test} „${s.value ?? ''}“`
      case 'map': return `Tabelle ${String(s.pairs ?? '').slice(0, 30)}`
      default: return OPS.find(o => o[0] === s.op)?.[1] ?? s.op
    }
  }).join(' → ')
}
