// Der Kopf eines Skripts (docs/pflegestruktur.md 37): `export const meta = { label, params, role }`. Er ist das
// Formular — gelesen wird er beim Speichern aus dem Quelltext, damit Programm und Maske nicht auseinanderlaufen.
// Gelesen wird nur der Ausdruck hinter „= “, nicht das Programm; den Quelltext sieht ohnehin nur, wer ihn schreiben
// darf, und das ist ein Administratorrecht. Beim Lauf liest der Runner denselben Kopf noch einmal (runner.mjs).

/// Der Ausdruck hinter `export const meta =` als Objekt — null, wenn es keinen Kopf gibt oder er nicht lesbar ist.
export function kopfLesen(quelle) {
  const m = /export\s+(?:const|let|var)\s+meta\s*=\s*\{/.exec(quelle ?? '')
  if (!m) return null
  const start = m.index + m[0].length - 1
  const ende = zuKlammer(quelle, start)
  if (ende < 0) return null
  try {
    const wert = new Function('return (' + quelle.slice(start, ende + 1) + ')')()
    return wert && typeof wert === 'object' && !Array.isArray(wert) ? wert : null
  } catch { return null }
}

/// Die schliessende Klammer zur öffnenden an dieser Stelle — Zeichenketten und Kommentare zählen nicht mit,
/// sonst beendete ein „}“ in einer Bezeichnung den Kopf. -1, wenn sie fehlt.
function zuKlammer(s, start) {
  let tiefe = 0
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (c === '"' || c === "'" || c === '`') { i = zuEnde(s, i, c); if (i < 0) return -1; continue }
    if (c === '/' && s[i + 1] === '/') { i = s.indexOf('\n', i); if (i < 0) return -1; continue }
    if (c === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i + 2); if (i < 0) return -1; i++; continue }
    if (c === '{') tiefe++
    else if (c === '}' && --tiefe === 0) return i
  }
  return -1
}
/// Das Ende einer Zeichenkette, die bei `start` beginnt (mit \ entwertete Zeichen zählen nicht).
function zuEnde(s, start, zeichen) {
  for (let i = start + 1; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue }
    if (s[i] === zeichen) return i
  }
  return -1
}

/// Die Parameter aus dem Kopf, so wie der Server sie speichert: Schlüssel, Bezeichnung, Typ, Vorgabe.
export function paramsAus(kopf) {
  return (kopf?.params ?? []).filter(p => p && p.key).map(p => ({
    key: String(p.key), label: p.label == null ? null : String(p.label),
    type: p.type == null ? null : String(p.type), default: p.default == null ? null : String(p.default),
  }))
}
