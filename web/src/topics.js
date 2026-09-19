// Themen statt Plugins in der Leiste (Taloan, 18.09.2026): die linken Symbole gruppieren nach Funktion — Import, Export,
// Datenblatt, Datenanalyse, Werkzeuge. Ein Klick öffnet die Übersicht des Themas (HubView), dort wählt man das Plugin.
// Kein Plugin bekommt ein eigenes Symbol. Das Thema einer Ansicht nennt das Plugin (view.topic) oder ergibt sich
// aus der Art des Plugins (manifest.kind); das Kontextmenü des Baums ordnet die Knoten-Aktionen genauso.
import { computed } from 'vue'
import { plugins } from './plugins.js'

export const TOPICS = [
  { key: 'import', to: '/import', icon: '⇩', label: 'Import', hotkey: '4', always: true },
  { key: 'export', to: '/export', icon: '⇪', label: 'Export' },
  { key: 'datasheet', to: '/datasheet', icon: '▤', label: 'Datenblatt' },
  { key: 'analysis', to: '/analysis', icon: '✓', label: 'Datenanalyse', always: true },   // Grundfunktion Datenqualität (Taloan, 19.09.)
  { key: 'tools', to: '/tools', icon: '⌁', label: 'Werkzeuge' },
  { key: 'jobs', to: '/jobs', icon: '⏱', label: 'Jobs', always: true },   // fest eingebaut (Taloan, 19.09.): Jobs im Server, Zeitplan, Logs — /jobs ist die Ansicht selbst
]
// Gruppen mit fest eingebauter Basis (Tabelle, Datenqualität) — immer in der Leiste; ihre Plugins brauchen keinen Leisten-Schalter (Taloan)
export const FIXED_TOPICS = ['import', 'export', 'analysis', 'jobs']
export const KIND_TOPIC = { import: 'import', export: 'export', output: 'datasheet', quality: 'analysis', edit: 'tools', tool: 'tools' }

export function topicOf(key, explicit = null) {
  if (explicit) return explicit
  const kind = plugins.list.find(p => p.key === key)?.manifest?.kind
  return KIND_TOPIC[kind] ?? 'tools'
}
const label = key => { const m = plugins.list.find(p => p.key === key)?.manifest; return m?.label?.de || m?.label?.en || key }

// Die Einträge eines Themas: eingebaute Ansichten (IXP, Solr, Tabelle) und die Ansichten der Plugins
export const entries = computed(() => {
  const out = Object.fromEntries(TOPICS.map(t => [t.key, []]))
  out.import.push({ to: '/import/table', icon: '⊞', label: 'Tabelle', plugin: null, hint: 'CSV, Excel, JSON, Zwischenablage — mit Datenmapper' })
  out.export.push({ to: '/export/table', icon: '⊞', label: 'Tabelle', plugin: null, hint: 'Excel, CSV — die Form, die der Tabellenimport liest' })   // fest eingebaut (Taloan, 19.09.)
  out.analysis.push({ to: '/analysis/dq', icon: '✓', label: 'Datenqualität', plugin: null, hint: 'Regeln: Pflicht, Muster, Zahlen, Listen, Leerzeichen, leeres HTML, SKU, Übersetzung, Formel — plus Prüfregeln der Plugins' })   // fest eingebaut (Taloan, 19.09.)
  if (plugins.enabled('ixp')) out.import.push({ to: '/import/ixp', icon: '⇩', label: 'IXP', plugin: 'ixp', hint: label('ixp') })
  if (plugins.enabled('solr')) out.import.push({ to: '/import/solr', icon: '⇩', label: 'Solr', plugin: 'solr', hint: label('solr') })
  for (const v of plugins.views) out[topicOf(v.key, v.topic)].push({ to: `/p/${v.key}/${v.path}`, icon: v.icon || '⌁', label: v.label, plugin: v.key, hint: label(v.key) })
  return out
})

// Zu welchem Thema gehört ein Pfad (für das aktive Symbol in der Leiste)
export function topicOfPath(path) {
  if (path.startsWith('/import')) return 'import'
  if (path.startsWith('/export/')) return 'export'
  for (const t of TOPICS) if (path === t.to || path.startsWith(t.to + '/')) return t.key
  const m = path.match(/^\/p\/([^/]+)\/([^/]+)/)
  if (m) { const v = plugins.views.find(x => x.key === m[1] && x.path === m[2]); return topicOf(m[1], v?.topic) }
  return null
}
