// Baum-Zustand für die ganze Oberfläche: flache Zeilen vom Server, daraus
// Kinderlisten; aufgeklappt bleibt im localStorage. Zieht bei jedem neuen
// Journalstand nach.
import { reactive, watch } from 'vue'
import { api } from './api.js'
import { store } from './store.js'

const ICON = { group: '▣', product: '▦', variant: '◆' }
export const icon = role => ICON[role] ?? '?'

export const tree = reactive({
  rows: [],
  byId: new Map(),
  children: new Map(),
  expanded: new Set(JSON.parse(localStorage.getItem('journali.expanded') || '[]')),
  loaded: false,

  async load() {
    try {
      const rows = await api.get('/api/tree')
      const byId = new Map(rows.map(r => [r.id, r]))
      const children = new Map()
      for (const r of rows) {
        const k = r.parent ?? ''
        if (!children.has(k)) children.set(k, [])
        children.get(k).push(r)
      }
      const order = { group: 0, product: 1, variant: 2 }
      for (const list of children.values())
        list.sort((a, b) => (order[a.role] - order[b.role]) || a.label.localeCompare(b.label, 'de'))
      this.rows = rows; this.byId = byId; this.children = children; this.loaded = true
    } catch (e) { store.toast(e.message) }
  },

  kids(id) { return this.children.get(id ?? '') ?? [] },

  toggle(id) {
    this.expanded.has(id) ? this.expanded.delete(id) : this.expanded.add(id)
    localStorage.setItem('journali.expanded', JSON.stringify([...this.expanded]))
  },
  expand(id) { if (!this.expanded.has(id)) this.toggle(id) },

  /// Pfad von der Wurzel bis zum Knoten (ohne ihn selbst).
  ancestors(id) {
    const out = []
    for (let p = this.byId.get(id)?.parent; p; p = this.byId.get(p)?.parent) out.unshift(this.byId.get(p))
    return out
  },
})

watch(() => store.head, () => tree.load())
