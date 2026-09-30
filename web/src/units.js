// Einheiten in der Pflege (30.09.2026, docs/pflegestruktur.md 14): ein Zahlenattribut mit Einheit hat die Einheit
// als Standard; gespeichert wird immer in ihr. In der Zelle lässt sich die Einheit umschalten: der Wert wird
// umgerechnet angezeigt, und was dort getippt wird, rechnet sich vor dem Speichern in die Einheit des Attributs zurück.
// Die Umrechnung ist Anzeige und Eingabe — am Journal ändert das Umschalten nichts.
import { reactive } from 'vue'

/// Die gewählte Anzeigeeinheit je Attribut. Wer in g arbeitet, bleibt in g; anfangs gilt die Einheit des Attributs.
export const gewaehlt = reactive({})

const ZAHL = ['integer', 'decimal']

/// Die Einheiten, zwischen denen ein Attribut umschalten kann: alle seiner Grösse, in der Reihenfolge des Modells.
/// Leer, wenn es keine Wahl gibt (keine Einheit, kein Zahlentyp, nur eine Einheit der Grösse).
export function wahl(model, def) {
  if (!def?.unit || !ZAHL.includes(def.type)) return []
  const units = model?.units ?? []
  const basis = units.find(u => u.key === def.unit)
  if (!basis) return []
  const gleiche = units.filter(u => u.quantity === basis.quantity)
  return gleiche.length > 1 ? gleiche : []
}

/// Die Einheit, in der das Attribut gerade angezeigt wird
export function angezeigt(model, def) {
  const g = gewaehlt[def?.key]
  return g && wahl(model, def).some(u => u.key === g) ? g : def?.unit
}

/// Eine Zahl als Text ohne Gleitkommareste und ohne Exponent: 0.30000000000000004 → 0.3
export function zahlText(n) {
  const s = String(Number(n.toPrecision(12)))
  return /e/i.test(s) ? Number(n.toPrecision(12)).toFixed(12).replace(/0+$/, '').replace(/\.$/, '') : s
}

const einheit = (units, key) => units.find(u => u.key === key)

/// Eine Zahl oder ein Bruch aus einer Eingabe: „0,5“, „-273.15“, „5/9“, „-160/9“. null, wenn es keins von beiden ist.
export function zahlOderBruch(eingabe) {
  const s = String(eingabe ?? '').trim().replace(/,/g, '.')
  const m = /^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/.exec(s)
  if (m) return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2])
  return /^-?\d+(?:\.\d+)?$/.test(s) ? Number(s) : null
}

/// Einen Zahlentext von einer Einheit in eine andere rechnen: über die Basis der Grösse, Basis = Wert × Faktor + Verschiebung
/// (°F → °C: × 5/9 − 160/9). Was keine Zahl ist oder keine bekannte Einheit hat, bleibt.
export function umrechnen(text, von, nach, units) {
  if (text == null || text === '' || von === nach) return text
  const n = Number(String(text).trim().replace(',', '.'))
  const a = einheit(units ?? [], von), b = einheit(units ?? [], nach)
  if (!Number.isFinite(n) || !a?.factor || !b?.factor) return text
  const basis = n * a.factor + (a.offset ?? 0)
  return zahlText((basis - (b.offset ?? 0)) / b.factor)
}

/// Der gespeicherte Wert in der Anzeigeeinheit (ohne Angabe die gewählte des Attributs)
export function zeigen(model, def, gespeichert, einheit) {
  const u = einheit ?? angezeigt(model, def)
  return u === def.unit ? gespeichert : umrechnen(gespeichert, def.unit, u, model.units)
}

const nachkommastellen = text => (String(text).split('.')[1] ?? '').length

/// Die Einheit, in der ein gespeicherter Wert am besten zu lesen ist: die grösste, in der er mindestens 1 ist und höchstens
/// drei Nachkommastellen hat — 2000 mg sind 2 g, 60 mg bleiben 60 mg. Für Zeilen, in denen Werte sehr verschieden gross sind
/// (Zutaten einer Relation). Ohne Wahl, ohne Wert und bei Einheiten mit Verschiebung (°C, °F) gilt die Einheit des Attributs.
export function beste(model, def, gespeichert) {
  const liste = wahl(model, def)
  if (!liste.length || liste.some(u => u.offset)) return def?.unit
  const n = Number(String(gespeichert ?? '').trim().replace(',', '.'))
  if (gespeichert == null || gespeichert === '' || !Number.isFinite(n) || n === 0) return def.unit
  for (const u of [...liste].sort((a, b) => b.factor - a.factor)) {
    const text = umrechnen(String(gespeichert), def.unit, u.key, model.units)
    if (Math.abs(Number(text)) >= 1 && nachkommastellen(text) <= 3) return u.key
  }
  return def.unit
}

/// Die Eingabe in der Anzeigeeinheit, zurückgerechnet in die Einheit des Attributs. Liefert { wert } oder { fehler }.
/// Ein ganzzahliges Attribut nimmt nur ein ganzzahliges Ergebnis: 1 g sind 0.001 kg, das hat kein integer.
export function speichern(model, def, eingabe, einheit) {
  const u = einheit ?? angezeigt(model, def)
  if (u === def.unit || eingabe == null || String(eingabe).trim() === '') return { wert: eingabe }
  const wert = umrechnen(eingabe, u, def.unit, model.units)
  if (wert === eingabe) return { wert }   // keine Zahl: die Prüfung beim Speichern sagt es
  if (def.type === 'integer' && !Number.isInteger(Number(wert))) return { fehler: { eingabe, von: u, wert, nach: def.unit } }
  return { wert }
}
