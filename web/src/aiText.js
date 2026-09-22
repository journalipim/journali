// KI im Editor (Taloan, 19.09.2026: „im Editor hätte ich auch den KI-Button erwartet“): ein Text der Zelle wird mit den
// echten Produktdaten des Knotens an die KI gegeben — verbessern, kürzen, ausführlicher, neu aus den Daten, eigene
// Anweisung. Ergebnis landet im Entwurf; gespeichert wird erst mit Speichern. Schlüssel des Nutzers (ai.js), nur auf Klick.
import { api } from './api.js'
import { store } from './store.js'
import { tree } from './tree.js'
import { ai } from './ai.js'

// Zwei Sorten (Taloan, 22.09.2026): den vorhandenen Text ÜBERARBEITEN — oder etwas Neues ERZEUGEN (mit @ gekennzeichnet).
// [key, Bezeichnung, Anweisung, Gruppe: 'edit' | 'gen']
export const PRESETS = [
  ['improve', 'Verbessern', 'Verbessere Stil, Klarheit und Rechtschreibung. Inhalt und Fakten bleiben, Länge etwa gleich.', 'edit'],
  ['shorter', 'Kürzen', 'Kürze auf etwa die Hälfte; die wichtigsten Fakten bleiben.', 'edit'],
  ['longer', 'Ausführlicher', 'Schreibe ausführlicher und ergänze nur, was die Produktdaten hergeben.', 'edit'],
  ['fromdata', '@ Liste aus Produktdaten', 'Stelle die Produktdaten als übersichtliche Liste dar: je Zeile Bezeichnung und Wert, keine Sätze, keine Wertung, nichts erfinden.', 'gen'],
  ['mk_plain', '@ Marketingtext sachlich', 'Schreibe einen sachlichen Produkttext (3 bis 5 Sätze): was das Produkt ist, für wen, welche Eigenschaften es hat. Nur Fakten aus den Produktdaten, keine Superlative, keine Werbefloskeln.', 'gen'],
  ['mk_emotion', '@ Marketingtext emotional', 'Schreibe einen werblichen Produkttext (3 bis 5 Sätze), der den Nutzen im Alltag beschreibt und Lust auf das Produkt macht. Jede Aussage muss aus den Produktdaten belegbar sein; keine erfundenen Eigenschaften, keine Superlative ohne Beleg.', 'gen'],
  ['mk_compare', '@ Marketingtext vergleichend', 'Schreibe einen Produkttext (3 bis 5 Sätze), der dieses Produkt gegen üblich ausgestattete Geräte derselben Art abgrenzt: worin es sich unterscheidet, was das dem Käufer bringt. Nur Unterschiede, die aus den Produktdaten hervorgehen; keine Namen fremder Hersteller, keine erfundenen Vergleichswerte.', 'gen'],
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
    // Listenwerte als Wort, nicht als Code (Taloan, 22.09.: „Betriebssystem EV007944 — ist das neu?“): Bezeichnung in der Sprache,
    // sonst in irgendeiner; nur wenn es gar keine gibt, bleibt der Code stehen. Ein Wert ohne Bezeichnung taugt nicht für einen Text.
    if (d.type === 'enum') {
      const list = model.lists.find(x => x.key === d.list)
      v = String(v).split(',').map(x => { const val = list?.values.find(y => y.value === x.trim()); const l = val?.label; return l?.[locale] || l?.de || l?.en || Object.values(l ?? {}).find(Boolean) || x.trim() }).join(', ')
    }
    if (d.type === 'boolean') v = String(v) === 'true' ? 'ja' : String(v) === 'false' ? 'nein' : v
    rows.push(`- ${d.label?.[locale] || d.label?.de || d.key}: ${v}${d.unit ? ' ' + d.unit : ''}`)
  }
  const row = tree.byId.get(nodeId)
  return { name: row?.label ?? n.name ?? nodeId, path: tree.ancestors(nodeId).map(a => a.label).reverse().join(' › '), keys: tree.keyText(row), rows }
}

/// Text umschreiben. instruction: Schlüssel aus PRESETS oder freier Text. html: Ergebnis als HTML (p, ul/li, b, i), sonst reiner Text.
export async function rewrite({ instruction, current, html, label, locale, node }) {
  if (!ai.available()) throw new Error('Kein KI-Schlüssel — Einstellungen → KI')
  const preset = PRESETS.find(p => p[0] === instruction)
  const task = preset ? preset[2] : instruction
  const f = await facts(node, locale).catch(() => null)
  const system = `Du bist Redakteur für Produktdaten. Sprache: ${locale || store.model?.masterLocale || 'de'}. Nur Fakten aus den Produktdaten, keine Erfindungen, keine Superlative. `
    + (html ? 'Antworte nur mit HTML (erlaubt: p, ul, ol, li, b, i, h3, br), ohne Erklärung, ohne Code-Zäune.' : 'Antworte nur mit dem reinen Text, ohne Erklärung, ohne Anführungszeichen.')
  const user = `Feld: ${label || 'Text'}\n` + (f ? `Produkt: ${f.name}\nPfad: ${f.path}\nSchlüssel: ${f.keys}\nProduktdaten:\n${f.rows.join('\n')}\n\n` : '')
    + (current ? `Bisheriger Text:\n${current}\n\n` : '') + `Aufgabe: ${task}`
  const out = await ai.ask({ system, user, maxTokens: 1500, temperature: 0.2 })
  return String(out).replace(/^```[a-z]*\n?|```$/g, '').trim()
}
