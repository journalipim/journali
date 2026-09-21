// Umwandlung je Spalte im Datenmapper (Taloan, 21.09.2026, Blick in den OpenDXP-Importer: „für jedes Feld eine Zuordnung — aber
// ich kann Werte umwandeln und manipulieren … zwischendurch in die Daten eingreifen“): zwischen Quelle und Ziel eine Kette
// kleiner Schritte, in der Zuordnung gespeichert (m.steps) und damit im Profil. Rein, ohne Zustand, im Browser und im Test.
// Jeder Schritt: { op, …felder }. Reihenfolge = Kette. Leere Eingabe bleibt leer, ausser static/default/combine sagen etwas.

export const OPS = [
  ['trim', 'Leerzeichen kürzen', 'vorne und hinten, mehrere innen zu einem'],
  ['upper', 'GROSS', ''], ['lower', 'klein', ''],
  ['replace', 'Ersetzen', 'find → with; regex: als regulärer Ausdruck (Flags gi)'],
  ['prefix', 'Voranstellen', 'text'], ['suffix', 'Anhängen', 'text'],
  ['static', 'Fester Wert', 'text — die Quelle wird ignoriert'],
  ['default', 'Wenn leer', 'text, der bei leerer Quelle gilt'],
  ['combine', 'Spalten verbinden', 'columns (mit Komma), sep — die Quelle selbst zählt mit, wenn sie in columns steht'],
  ['split', 'Aufteilen', 'sep, index (0 = erster Teil, -1 = letzter, leer = alle mit Komma)'],
  ['number', 'Zahl', 'decimal , oder . — Einheit und Tausenderzeichen fallen weg („22 mm“ → 22, „1.234,5“ → 1234.5)'],
  ['boolean', 'Wahrheitswert', 'Wörter, die „ja“ bedeuten (mit Komma; Vorgabe ja, yes, true, 1, x, wahr, y) → true, alles andere → false; leer bleibt leer'],
  ['date', 'Datum', 'format dd.MM.yyyy | MM/dd/yyyy | yyyyMMdd → ISO yyyy-MM-dd'],
  ['htmldecode', 'HTML-Entities auflösen', '&amp; → &'],
  ['striphtml', 'HTML entfernen', 'Tags weg, Text bleibt'],
  ['map', 'Werte übersetzen', 'pairs: a=b; c=d — nicht Genanntes bleibt (oder other)'],
  ['when', 'Bedingung', 'test: empty | equals | contains | matches (regex) mit value; then/else: Text ({} = Quelle)'],
]

const S = v => v == null ? '' : String(v)
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
          const yes = S(st.yes || st.true || 'ja,yes,true,1,x,wahr,y').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
          v = yes.includes(v.trim().toLowerCase()) ? 'true' : 'false'; break
        }
        case 'date': {
          const t = v.trim(); if (!t) break
          const f = st.format || 'dd.MM.yyyy'; let m
          if (f === 'dd.MM.yyyy' && (m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/))) v = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
          else if (f === 'MM/dd/yyyy' && (m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) v = `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
          else if (f === 'yyyyMMdd' && (m = t.match(/^(\d{4})(\d{2})(\d{2})$/))) v = `${m[1]}-${m[2]}-${m[3]}`
          else if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) v = `${m[1]}-${m[2]}-${m[3]}`
          break
        }
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
      case 'map': return 'übersetze Werte'
      default: return OPS.find(o => o[0] === s.op)?.[1] ?? s.op
    }
  }).join(' → ')
}
