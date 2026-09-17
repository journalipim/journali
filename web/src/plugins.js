// Plugins in der Oberfläche (docs/pflegestruktur.md, 19): Liste vom Server (/api/plugins), eingeschaltete
// Browser-Plugins werden als ES-Modul von /plugins/<key>/<entry> geladen und tragen bei. Eingebaute (builtin:
// ixp, solr) sind Teil der Oberfläche; ihr Schalter im Journal entscheidet nur, ob sie zu sehen sind.
//
// Vertrag eines Browser-Plugins (default export), alles optional:
//   views:       [{ path: 'meine-ansicht', label, icon, mount(el, ctx) → unmount? }]   Ansicht in der Leiste
//   nodeActions: [{ label | label(row, below), icon, roles?: ['group','product'], run(nodeId, ctx) }]   Kontextmenü des Baums (roles: nur an diesen; below = „Subitems“)
//   importers:   [{ key, label, accept: ['.csv'], parse(file, ctx) → { columns, rows, sheets? } }]
//                Quellen für den Tabellenimport (⇩ Import → Tabelle); rows als Arrays in Spaltenreihenfolge
//   checks:      [{ key, label, run({ row, values, columns, model }) → [{ severity: 'error'|'warn'|'info', attribute?, message }] }]
//                Prüfregeln für die Datenqualität (Plugin dq zeigt sie)
// ctx = { api, store, tree, plugin: { key, version, base }, data: { list, get, set, del }, mapper, batch, checks, go }
//   data   — benannte JSON-Datensätze des Plugins im Journal (PluginDataSet, /api/plugins/<key>/data/<name>)
//   mapper — der Datenmapper (mapper.js): suggest, plan, convert, parseDelimited, fromObjects
//   batch(commands, batchId?) — POST /api/batch
import { reactive } from 'vue'
import { api } from './api.js'
import { store } from './store.js'
import { tree } from './tree.js'
import * as mapper from './mapper.js'

export const plugins = reactive({
  list: [],
  loaded: false,
  modules: new Map(),     // key → default export
  views: [],              // { key, path, label, icon, mount }
  nodeActions: [],        // { key, label, icon, run }
  importers: [],          // { key (Plugin), source (importer.key), label, accept, parse }
  checks: [],             // { key (Plugin), check, label, run }

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
        for (const i of mod.importers ?? []) this.importers.push({ key: p.key, source: i.key, ...i })
        for (const c of mod.checks ?? []) this.checks.push({ key: p.key, check: c.key, ...c })
      } catch (e) { store.toast(`Plugin ${p.key}: ${e.message}`) }
    }
    // ausgeschaltete Plugins: ihre Beiträge weg (Modul bleibt geladen — ein ES-Modul lässt sich nicht entladen)
    const on = new Set(this.list.filter(p => p.enabled).map(p => p.key))
    for (const k of ['views', 'nodeActions', 'importers', 'checks']) this[k] = this[k].filter(x => on.has(x.key))
  },
  enabled(key) { return this.list.some(p => p.key === key && p.enabled) },
  ctx(key) {
    const p = this.list.find(x => x.key === key)
    const base = `/api/plugins/${key}/data/`
    return {
      api, store, tree, mapper,
      plugin: { key, version: p?.version, base: `/plugins/${key}/` },
      data: {
        list: () => api.get(`/api/plugins/${key}/data`),
        get: name => api.get(base + encodeURIComponent(name)).catch(() => null),
        set: (name, value) => api.post(base + encodeURIComponent(name), value, 'PUT'),
        del: name => api.del(base + encodeURIComponent(name)),
      },
      batch: (commands, batch = null) => api.post('/api/batch', { commands, batch }),
      checks: this.checks,                                                      // Prüfregeln aller Plugins (für dq)
      go: async path => (await import('./router.js')).router.push(path),        // Navigation in der Oberfläche
    }
  },
  // Importer nach Dateiname: der erste, dessen accept passt
  importerFor(name) { const ext = '.' + String(name ?? '').split('.').pop().toLowerCase(); return this.importers.find(i => (i.accept ?? []).map(a => a.toLowerCase()).includes(ext)) ?? null },
})
