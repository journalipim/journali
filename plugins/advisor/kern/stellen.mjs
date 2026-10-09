// Stellen eines Produkts, die eine Frage beantworten (09.10.2026): Werte und Sätze aus seinen Texten, in denen ein Wort der Frage steht —
// gleiche Form, ein gemeinsamer Anfang ab sechs Zeichen („wasserdicht“ ↔ „Wassersäule“) oder das ganze Wort in einem längeren („dicht“ in
// „wasserdicht“). Der Server vergleicht für das Produkt im Blick nur die Bezeichnungen kurzer Werte (AdvisorApi.PassendeWerte); in vielen
// Daten steht die Antwort aber im Wert („Material: … 3000 mm Wassersäule“) oder in der Beschreibung. Ohne KI zitiert der Berater, was in den
// Angaben steht, und fügt nichts hinzu.
import { gleichesWort } from './woerter.mjs'

const WORT = /\p{L}[\p{L}\p{N}-]*/gu
const anfang = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i }

/// Steht das Wort einer Frage in einem Text? 'genau' — das Wort selbst oder gebeugt („wasserdichte“); 'hinweis' — nur verwandt (gemeinsamer
/// Anfang „Wassersäule“, Teil eines längeren „regendicht“); null — nicht. Wörter unter vier Zeichen zählen nicht (09.10.2026)
export function treffer(w, text) {
  if (w.length < 4) return null
  const ws = String(text ?? '').toLowerCase().match(WORT) ?? []
  if (ws.some(x => gleichesWort(w, x) || x.startsWith(w))) return 'genau'
  return ws.some(x => anfang(w, x) >= Math.min(6, w.length) || (w.length >= 5 && x.includes(w))) ? 'hinweis' : null
}
export const trifft = (w, text) => treffer(w, text) !== null

/// Die Sätze eines Texts, ohne Auszeichnung
export function saetze(text) {
  return String(text ?? '').replace(/<[^>]+>/g, ' ').split(/(?<=[.!?])\s+|\n+/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 1)
}

const kuerze = (s, n = 240) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n) > 0 ? s.lastIndexOf(' ', n) : n) + ' …'

// die beste Art, in der eines der Wörter trifft
const bester = (woerter, ...texte) => {
  let aus = null
  for (const w of woerter) for (const t of texte) { const r = treffer(w, t); if (r === 'genau') return r; aus = aus ?? r }
  return aus
}

/**
 * Die Stellen eines Produkts (wie GET /api/advisor/{key}/product/{id}) zu den Wörtern einer Frage und den Attributen, die sie nennt.
 * `genau`: die Stelle nennt das Gefragte (ein genanntes Attribut, das Wort selbst); sonst gibt sie nur einen Hinweis („Wassersäule“ auf
 * „wasserdicht“). Höchstens `max`, die genauen zuerst, sonst erst die Werte, dann die Sätze.
 * @returns {{ key: string, label: string, value: string, genau: boolean }[]}
 */
export function stellen(p, { woerter = [], attribute = [], verwandt = [], max = 3 } = {}) {
  // verwandte Wörter (Assoziationen: „winter“ → „frost“) geben höchstens einen Hinweis
  const art = (...texte) => bester(woerter, ...texte) ?? (bester(verwandt, ...texte) ? 'hinweis' : null)
  const aus = [], schon = new Set()
  const dazu = (key, label, value, genau) => {
    const v = kuerze(String(value ?? '')), k = v.toLowerCase()
    if (v && !schon.has(k)) { schon.add(k); aus.push({ key, label, value: v, genau }) }
  }
  for (const v of p?.values ?? []) {
    if (v.key === 'name') continue
    if (attribute.includes(v.key)) { dazu(v.key, v.label, v.value, true); continue }
    const r = art(v.label, v.value)
    if (r) dazu(v.key, v.label, v.value, r === 'genau')
  }
  for (const t of p?.texts ?? []) for (const s of saetze(t.value)) { const r = art(s); if (r) dazu(t.key, t.label, s, r === 'genau') }
  return [...aus.filter(x => x.genau), ...aus.filter(x => !x.genau)].slice(0, max)
}

/// Nennt eine der Stellen das Gefragte, oder geben alle nur Hinweise?
export const genau = liste => liste.some(x => x.genau)
