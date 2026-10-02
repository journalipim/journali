// EmpCo: die Prüfregeln des Katalogs (catalog.js, Richtlinie (EU) 2024/825) — jede prüft Text- und HTML-Attribute je Sprache; ein Befund nennt
// Attribut, Begriff und den Anker in der Richtlinie. Dieselben Regeln laufen in ✓ Datenqualität (checks) und in der Ansicht dieses Plugins.
import catalog from '../catalog.js'

export const strip = v => String(v ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/// Der Begriff der Regel mit Wortgrenzen und Flexion: umweltfreundlich(es), nachhaltig(er). Die Grenze kennt Umlaute (\\b tut es nicht: „grün“ und „ökologisch“
/// wären nie gefunden worden); Gruppe 1 ist die Grundform, Gruppe 2 die Endung.
export const rx = rule => rule.pattern
  ? new RegExp(rule.pattern, 'i')
  : new RegExp('(?<![\\p{L}\\p{N}_])(' + rule.terms.map(esc).join('|') + ')(e|es|er|en|em|s)?(?![\\p{L}\\p{N}_])', 'iu')

/// Alle Regeln als Prüfregeln für die Datenqualität (Basis-Plugin da)
export const checks = catalog.rules.map(rule => ({
  key: rule.id, label: `${catalog.icon} ${rule.label}`, severity: rule.severity,
  run({ values, columns }) {
    const r = rx(rule); const out = []
    for (const c of columns) {
      if (c.type !== 'text' && c.type !== 'html') continue
      const text = strip(values[c.key]?.value); if (!text) continue
      const m = text.match(r); if (!m) continue
      out.push({ attribute: c.key, type: c.type, term: m[0], base: m[1] ?? m[0], message: `„${m[0]}“ — ${rule.hint} (${rule.ref})` })
    }
    return out
  },
}))

export { catalog }
