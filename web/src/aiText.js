// KI im Editor (Taloan, 19.09.2026: „im Editor hätte ich auch den KI-Button erwartet“): ein Text der Zelle wird mit den
// echten Produktdaten des Knotens an Claude gegeben — verbessern, kürzen, ausführlicher, neu aus den Daten, eigene
// Anweisung. Ergebnis landet im Entwurf; gespeichert wird erst mit Speichern. Schlüssel des Nutzers (ai.js), nur auf Klick.
import { api } from './api.js'
import { store } from './store.js'
import { tree } from './tree.js'
import { ai } from './ai.js'

export const PRESETS = [
  ['improve', 'Verbessern', 'Verbessere Stil, Klarheit und Rechtschreibung. Inhalt und Fakten bleiben, Länge etwa gleich.'],
  ['shorter', 'Kürzen', 'Kürze auf etwa die Hälfte; die wichtigsten Fakten bleiben.'],
  ['longer', 'Ausführlicher', 'Schreibe ausführlicher und ergänze nur, was die Produktdaten hergeben.'],
  ['fromdata', 'Aus Produktdaten', 'Schreibe den Text neu allein aus den Produktdaten; nichts erfinden, keine Superlative.'],
]

/// Fakten des Knotens in einer Sprache: Name, Pfad, SKU, Attribute mit Label und Wert (eigen oder geerbt)
export async function facts(nodeId, locale) {
  const model = store.model; if (!nodeId || !model) return null
  const n = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}`)
  const key = v => `${v.attribute}|${v.locale ?? ''}|${v.channel ?? ''}`
  const own = new Map(n.values.map(v => [key(v), v.values ? v.values.join(', ') : v.value]))
  const anc = n.ancestors.map(a => new Map(a.values.map(v => [key(v), v.values ? v.values.join(', ') : v.value])))
  const look = (m, k, loc) => m.get(`${k}|${loc}|`) ?? (loc ? m.get(`${k}||`) : null) ?? null
  const rows = []
  for (const d of model.attributes) {
    if (['rows', 'template', 'html'].includes(d.type)) continue
    const loc = d.perLocale ? locale : ''
    let v = d.type === 'formula' ? n.computed.find(c => c.attribute === d.key)?.value ?? null : look(own, d.key, loc)
    if (v == null && d.inheritable) for (const m of anc) { v = look(m, d.key, loc); if (v != null) break }
    if (v == null || v === '') continue
    if (d.type === 'enum') { const list = model.lists.find(x => x.key === d.list); v = String(v).split(',').map(x => list?.values.find(y => y.value === x.trim())?.label?.[locale] ?? x.trim()).join(', ') }
    rows.push(`- ${d.label?.[locale] || d.label?.de || d.key}: ${v}${d.unit ? ' ' + d.unit : ''}`)
  }
  const row = tree.byId.get(nodeId)
  return { name: row?.label ?? n.name ?? nodeId, path: tree.ancestors(nodeId).map(a => a.label).reverse().join(' › '), sku: row?.sku ?? '', rows }
}

/// Text umschreiben. instruction: Schlüssel aus PRESETS oder freier Text. html: Ergebnis als HTML (p, ul/li, b, i), sonst reiner Text.
export async function rewrite({ instruction, current, html, label, locale, node }) {
  if (!ai.available()) throw new Error('Kein KI-Schlüssel — Einstellungen → KI (Claude)')
  const preset = PRESETS.find(p => p[0] === instruction)
  const task = preset ? preset[2] : instruction
  const f = await facts(node, locale).catch(() => null)
  const system = `Du bist Redakteur für Produktdaten. Sprache: ${locale || store.model?.masterLocale || 'de'}. Nur Fakten aus den Produktdaten, keine Erfindungen, keine Superlative. `
    + (html ? 'Antworte nur mit HTML (erlaubt: p, ul, ol, li, b, i, h3, br), ohne Erklärung, ohne Code-Zäune.' : 'Antworte nur mit dem reinen Text, ohne Erklärung, ohne Anführungszeichen.')
  const user = `Feld: ${label || 'Text'}\n` + (f ? `Produkt: ${f.name}\nPfad: ${f.path}\nSKU: ${f.sku}\nProduktdaten:\n${f.rows.join('\n')}\n\n` : '')
    + (current ? `Bisheriger Text:\n${current}\n\n` : '') + `Aufgabe: ${task}`
  const out = await ai.ask({ system, user, maxTokens: 1500, temperature: 0.2 })
  return String(out).replace(/^```[a-z]*\n?|```$/g, '').trim()
}
