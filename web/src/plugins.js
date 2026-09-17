// Plugins in der Oberfläche (docs/pflegestruktur.md, 19): Liste vom Server (/api/plugins), eingeschaltete
// Browser-Plugins werden als ES-Modul von /plugins/<key>/<entry> geladen und tragen Ansichten und
// Knoten-Aktionen bei. Eingebaute (builtin: ixp, solr) sind Teil der Oberfläche; ihr Schalter im Journal
// entscheidet nur, ob sie zu sehen sind.
//
// Vertrag eines Browser-Plugins (default export):
//   { views: [{ path: 'meine-ansicht', label: 'Meine Ansicht', icon: '★', mount(el, ctx) }],
//     nodeActions: [{ label: 'Datenblatt', icon: '📄', run(nodeId, ctx) }] }
// ctx = { api, store, tree, plugin: { key, version, base: '/plugins/<key>/' } }
import { reactive } from 'vue'
import { api } from './api.js'
import { store } from './store.js'

export const plugins = reactive({
  list: [],
  loaded: false,
  modules: new Map(),     // key → default export
  views: [],              // { key, path, label, icon, mount }
  nodeActions: [],        // { key, label, icon, run }

  async load() {
    try { this.list = await api.get('/api/plugins') } catch (e) { this.list = []; this.loaded = true; return }
    this.loaded = true
    for (const p of this.list) {
      const m = p.manifest ?? {}
      if (!p.enabled || m.builtin || m.runs !== 'browser' || !m.entry || this.modules.has(p.key)) continue
      try {
        const mod = (await import(/* @vite-ignore */ `/plugins/${p.key}/${m.entry}`)).default ?? {}
        this.modules.set(p.key, mod)
        for (const v of mod.views ?? []) this.views.push({ key: p.key, ...v })
        for (const a of mod.nodeActions ?? []) this.nodeActions.push({ key: p.key, ...a })
      } catch (e) { store.toast(`Plugin ${p.key}: ${e.message}`) }
    }
  },
  enabled(key) { return this.list.some(p => p.key === key && p.enabled) },
  ctx(key) { const p = this.list.find(x => x.key === key); return { api, store, plugin: { key, version: p?.version, base: `/plugins/${key}/` } } },
})
