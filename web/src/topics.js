// Themen statt Plugins in der Leiste: die linken Symbole gruppieren nach Funktion — Import, Export,
// Datenblatt, Datenanalyse, Jobs, Werkzeuge. Ein Klick öffnet die Übersicht des Themas (HubView), dort wählt man das Plugin;
// hat ein Thema genau einen Eintrag, führt das Symbol direkt hin. Kein Plugin bekommt ein eigenes Symbol. Basis-Plugins
// (Manifest base: [Gruppen]) besitzen ihre Gruppe: sie ist in der Leiste, solange die Basis an ist. Das Thema einer Ansicht nennt das Plugin (view.topic) oder ergibt sich
// aus der Art des Plugins (manifest.kind); das Kontextmenü des Baums ordnet die Knoten-Aktionen genauso.
import { computed } from 'vue'
import { plugins } from './plugins.js'
import { t as t_ } from './i18n.js'
import { L } from './i18n.js'

export const TOPICS = [
  { key: 'import', to: '/import', icon: '⇩', label: t_('Import'), hotkey: '4' },
  { key: 'export', to: '/export', icon: '⇪', label: t_('Export') },
  { key: 'datasheet', to: '/datasheet', icon: '▤', label: t_('Datenblatt') },
  { key: 'analysis', to: '/analysis', icon: '✓', label: t_('Datenanalyse') },
  { key: 'translate', to: '/translate', icon: '⇄', label: t_('Übersetzung') },   // Übersetzungsmanagement
  { key: 'classification', to: '/classification', icon: '⌗', label: t_('Klassifikation') },   // ETIM heute, ECLASS/UNSPSC morgen — Klasse → ETIM-Attribute → Werte
  { key: 'tools', to: '/tools', icon: '⌁', label: t_('Werkzeuge') },
  { key: 'jobs', to: '/jobs', icon: '⏱', label: t_('Jobs') },
]
// Gruppen, die ein eingeschaltetes Basis-Plugin besitzt (table: import, export; da: analysis; tasker: jobs) — immer in der Leiste
export const baseTopics = computed(() => new Set(plugins.list.filter(p => p.enabled && Array.isArray(p.manifest?.base)).flatMap(p => p.manifest.base)))
// io bringt beides mit; ohne eigenes Thema an der Ansicht zaehlt Import - die Export-Kacheln nennen ihr Thema selbst
export const KIND_TOPIC = { io: 'import', import: 'import', export: 'export', output: 'datasheet', quality: 'analysis', edit: 'tools', tool: 'tools', classification: 'classification' }

export function topicOf(key, explicit = null) {
  if (explicit) return explicit
  const kind = plugins.list.find(p => p.key === key)?.manifest?.kind
  return KIND_TOPIC[kind] ?? 'tools'
}
const label = key => { const m = plugins.list.find(p => p.key === key)?.manifest; return L(m?.label) || m?.label?.en || key }

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
