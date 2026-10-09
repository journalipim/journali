// Stellen eines Produkts, die eine Frage beantworten (09.10.2026): Werte und Sätze aus seinen Texten, in denen ein Wort der Frage steht —
// gleiche Form, ein gemeinsamer Anfang ab sechs Zeichen („wasserdicht“ ↔ „Wassersäule“) oder das ganze Wort in einem längeren („dicht“ in
// „wasserdicht“). Der Server vergleicht für das Produkt im Blick nur die Bezeichnungen kurzer Werte (AdvisorApi.PassendeWerte); in vielen
// Daten steht die Antwort aber im Wert („Material: … 3000 mm Wassersäule“) oder in der Beschreibung. Ohne KI zitiert der Berater, was in den
// Angaben steht, und fügt nichts hinzu.
import { gleichesWort } from './woerter.mjs'

const WORT = /\p{L}[\p{L}\p{N}-]*/gu
const anfang = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i }

/// Steht das Wort einer Frage in einem Text? Wörter unter vier Zeichen zählen nicht
export function trifft(w, text) {
  if (w.length < 4) return false
  const ws = String(text ?? '').toLowerCase().match(WORT) ?? []
  return ws.some(x => gleichesWort(w, x) || anfang(w, x) >= Math.min(6, w.length) || (w.length >= 5 && x.includes(w)))
}

/// Die Sätze eines Texts, ohne Auszeichnung
export function saetze(text) {
  return String(text ?? '').replace(/<[^>]+>/g, ' ').split(/(?<=[.!?])\s+|\n+/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 1)
}

const kuerze = (s, n = 240) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n) > 0 ? s.lastIndexOf(' ', n) : n) + ' …'

/**
 * Die Stellen eines Produkts (wie GET /api/advisor/{key}/product/{id}) zu den Wörtern einer Frage und den Attributen, die sie nennt.
 * @returns {{ key: string, label: string, value: string }[]} höchstens `max`, erst die Werte, dann die Sätze
 */
export function stellen(p, { woerter = [], attribute = [], max = 3 } = {}) {
  const aus = [], schon = new Set()
  const dazu = (key, label, value) => {
    const v = kuerze(String(value ?? '')), k = v.toLowerCase()
    if (v && !schon.has(k)) { schon.add(k); aus.push({ key, label, value: v }) }
  }
  for (const v of p?.values ?? []) {
    if (v.key === 'name') continue
    if (attribute.includes(v.key) || woerter.some(w => trifft(w, v.label) || trifft(w, v.value))) dazu(v.key, v.label, v.value)
  }
  for (const t of p?.texts ?? []) for (const s of saetze(t.value)) if (woerter.some(w => trifft(w, s))) dazu(t.key, t.label, s)
  return aus.slice(0, max)
}
