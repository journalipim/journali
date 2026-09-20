// Themen statt Plugins in der Leiste (Taloan, 18.09.2026): die linken Symbole gruppieren nach Funktion — Import, Export,
// Datenblatt, Datenanalyse, Jobs, Werkzeuge. Ein Klick öffnet die Übersicht des Themas (HubView), dort wählt man das Plugin;
// hat ein Thema genau einen Eintrag, führt das Symbol direkt hin. Kein Plugin bekommt ein eigenes Symbol. Basis-Plugins
// (Manifest base: [Gruppen], Taloan 19.09.) besitzen ihre Gruppe: sie ist in der Leiste, solange die Basis an ist. Das Thema einer Ansicht nennt das Plugin (view.topic) oder ergibt sich
// aus der Art des Plugins (manifest.kind); das Kontextmenü des Baums ordnet die Knoten-Aktionen genauso.
import { computed } from 'vue'
import { plugins } from './plugins.js'

export const TOPICS = [
  { key: 'import', to: '/import', icon: '⇩', label: 'Import', hotkey: '4' },
  { key: 'export', to: '/export', icon: '⇪', label: 'Export' },
  { key: 'datasheet', to: '/datasheet', icon: '▤', label: 'Datenblatt' },
  { key: 'analysis', to: '/analysis', icon: '✓', label: 'Datenanalyse' },
  { key: 'tools', to: '/tools', icon: '⌁', label: 'Werkzeuge' },
  { key: 'jobs', to: '/jobs', icon: '⏱', label: 'Jobs' },
]
// Gruppen, die ein eingeschaltetes Basis-Plugin besitzt (table: import, export; da: analysis; tasker: jobs) — immer in der Leiste
export const baseTopics = computed(() => new Set(plugins.list.filter(p => p.enabled && Array.isArray(p.manifest?.base)).flatMap(p => p.manifest.base)))
export const KIND_TOPIC = { import: 'import', export: 'export', output: 'datasheet', quality: 'analysis', edit: 'tools', tool: 'tools' }

export function topicOf(key, explicit = null) {
  if (explicit) return explicit
  const kind = plugins.list.find(p => p.key === key)?.manifest?.kind
  return KIND_TOPIC[kind] ?? 'tools'
}
const label = key => { const m = plugins.list.find(p => p.key === key)?.manifest; return m?.label?.de || m?.label?.en || key }

// Die Einträge eines Themas: die Ansichten der Plugins, geordnet (plugins.sorted: Basis, order, Prüfungen vor Vorschlägen, Name)
export const entries = computed(() => {
  const out = Object.fromEntries(TOPICS.map(t => [t.key, []]))
  for (const v of plugins.views) (out[topicOf(v.key, v.topic)] ??= []).push({ key: v.key, order: v.order, to: `/p/${v.key}/${v.path}`, icon: v.icon || '⌁', label: v.label, plugin: v.key, hint: v.hint ?? label(v.key) })
  for (const k of Object.keys(out)) out[k] = plugins.sorted(out[k], k)
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
