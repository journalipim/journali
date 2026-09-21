// Plugins in der Oberfläche (docs/pflegestruktur.md, 19): Liste vom Server (/api/plugins), eingeschaltete
// Browser-Plugins werden als ES-Modul von /plugins/<key>/<entry> geladen und tragen bei. Basis-Plugins (Manifest
// base: [Gruppen]) bringen die Grundfunktion einer Gruppe der Leiste mit (table: Import/Export, da: Datenanalyse,
// tasker: Jobs) und sind der Container für Plugins, die sie brauchen (requires). Gebaute Plugins (src/ + entry.js aus
// web/build-plugins.mjs) liefern Vue-Ansichten; sie teilen Vue, Router, Store, Baum mit der Oberfläche (host.js).
//
// Vertrag eines Browser-Plugins (default export), alles optional:
//   views:       [{ path: 'meine-ansicht', label, icon, hint?, topic?, mount(el, ctx) → unmount? | component }]   Ansicht — in der Übersicht ihres Themas
//                (topic: import | export | datasheet | analysis | jobs | tools; sonst aus kind des Manifests); component = Vue-Komponente (gebaut)
//   nodeActions: [{ label | label(row, below), icon, roles?: ['group','product'], topic?: 'import'|'export'|'datasheet'|'analysis'|'tools', run(nodeId, ctx) }]
//                Kontextmenü des Baums, ein Untermenü je Thema (roles: nur an diesen; topic sonst aus kind des Manifests; below = „Subitems“)
//   importers:   [{ key, label, accept: ['.csv'], parse(file, ctx) → { columns, rows, sheets? } }]
//                Quellen für den Tabellenimport (⇩ Import → Tabelle); rows als Arrays in Spaltenreihenfolge
//   checks:      [{ key, label, run({ row, values, columns, model }) → [{ severity: 'error'|'warn'|'info', attribute?, message }] }]
//   Manifest process {…} oder processes: [{ key, label, command, args, params, description }] — mehrere Dienste je Plugin (Taloan); ein Job nennt plugin + service
//                Prüfregeln für die Datenqualität (Basis-Plugin da zeigt sie)
// ctx = { api, store, tree, dialog, plugin: { key, version, base }, data: { list, get, set, del }, mapper, batch, checks, go, use(key) }
//   use(key) — das Modul eines anderen Plugins (z. B. ctx.use('table').tableExport)
//   data   — benannte JSON-Datensätze des Plugins im Journal (PluginDataSet, /api/plugins/<key>/data/<name>)
//   compliance — Prüfkataloge (compliance.js): mount(root, ctx, catalog), check, guessMapping … (Plugins dpp, ppwr)
//   ai     — die KI, wenn in den Einstellungen ein Anbieter-Schlüssel steht (ai.js): available(), active(), label(), ask({ system, user, json, web })
//   mapper — der Datenmapper (mapper.js): suggest, plan, convert, parseDelimited, fromObjects
//   batch(commands, batchId?) — POST /api/batch
import { reactive } from 'vue'
import { api } from './api.js'
import { store } from './store.js'
import { tree } from './tree.js'
import * as mapper from './mapper.js'
import { dialog } from './dialog.js'
import { filePicker } from './filePicker.js'
import { treePicker } from './treePicker.js'
import * as orphans from './orphans.js'
import * as compliance from './compliance.js'
import { ai } from './ai.js'

export const plugins = reactive({
  list: [],
  loaded: false,
  modules: new Map(),     // key → default export
  views: [],              // { key, path, label, icon, mount }
  nodeActions: [],        // { key, label, icon, run }
  importers: [],          // { key (Plugin), source (importer.key), label, accept, parse }
  checks: [],             // { key (Plugin), check, label, run }

  loading: null,          // laufender load() — wer gleichzeitig ruft, wartet darauf (sonst doppelte Einträge in der Leiste)
  load() { return this.loading ??= this._load().finally(() => { this.loading = null }) },
  async _load() {
    try { this.list = await api.get('/api/plugins') } catch (e) { this.list = []; this.loaded = true; return }
    // Basis-Plugins zuerst (ihre Einträge stehen dann vorn in der Gruppe), dann der Rest in Reihenfolge
    const order = [...this.list].sort((a, b) => (Array.isArray(b.manifest?.base) ? 1 : 0) - (Array.isArray(a.manifest?.base) ? 1 : 0))
    for (const p of order) {
      const m = p.manifest ?? {}
      if (!this.active(p.key) || m.runs !== 'browser' || !m.entry || this.modules.has(p.key)) continue
      try {
        const mod = (await import(/* @vite-ignore */ `/plugins/${p.key}/${m.entry}`)).default ?? {}
        this.modules.set(p.key, mod)
        for (const v of mod.views ?? []) this.views.push({ key: p.key, ...v })
        for (const a of mod.nodeActions ?? []) this.nodeActions.push({ key: p.key, ...a })
        for (const i of mod.importers ?? []) this.importers.push({ key: p.key, source: i.key, ...i })
        for (const c of mod.checks ?? []) this.checks.push({ key: p.key, check: c.key, ...c })
      } catch (e) { store.toast(`Plugin ${p.key}: ${e.message}`) }
    }
    // ausgeschaltete Plugins (auch: Basis aus): ihre Beiträge weg (Modul bleibt geladen — ein ES-Modul lässt sich nicht entladen)
    const on = new Set(this.list.filter(p => this.active(p.key)).map(p => p.key))
    for (const k of ['views', 'nodeActions', 'importers', 'checks']) this[k] = this[k].filter(x => on.has(x.key))
    this.loaded = true   // erst jetzt: vorher sähe die Übersicht eines Themas nur den ersten Eintrag und leitete dorthin
  },
  enabled(key) { return this.active(key) },
  // Reihenfolge innerhalb eines Themas (Taloan, 20.09.: „alphabetisch nach Plugin-Id, aber thematisch durcheinander“ — automatisch, nicht
  // vom Anwender): 1. die Basis des Themas, 2. explizites order (Ansicht/Aktion, sonst Manifest), 3. Art: Prüfungen („… prüfen“) vor
  // Vorschlägen („… vorschlagen“, „Anreichern“) vor dem Rest, 4. Bezeichnung. Damit stehen die Kataloge (DPP, EmpCo, ETIM, PPWR) beisammen.
  sorted(items, topic, labelOf = x => x.label) {
    const rank = x => { const l = String(typeof labelOf(x) === 'function' ? '' : labelOf(x) ?? '').toLowerCase(); return /prüfen$/.test(l) ? 1 : /vorschlagen$|anreichern$/.test(l) ? 2 : 3 }
    const base = x => (this.list.find(p => p.key === x.key)?.manifest?.base ?? []).includes(topic) ? 0 : 1
    const order = x => x.order ?? this.list.find(p => p.key === x.key)?.manifest?.order ?? 50
    return [...items].sort((a, b) => base(a) - base(b) || order(a) - order(b) || rank(a) - rank(b) || String(labelOf(a) ?? '').localeCompare(String(labelOf(b) ?? ''), 'de'))
  },
  // wirksam: an, und alles, was es braucht (requires), ist wirksam — eine ausgeschaltete Basis nimmt ihre Ergänzungen mit
  active(key, seen = new Set()) { const p = this.list.find(x => x.key === key); if (!p?.enabled || seen.has(key)) return false; seen.add(key); return (p.manifest?.requires ?? []).every(r => this.active(r, seen)) },
  requires(key) { return this.list.find(x => x.key === key)?.manifest?.requires ?? [] },
  dependents(key) { return this.list.filter(p => (p.manifest?.requires ?? []).includes(key)).map(p => p.key) },
  ctx(key) {
    const p = this.list.find(x => x.key === key)
    const base = `/api/plugins/${key}/data/`
    return {
      api, store, tree, mapper, dialog, orphans, compliance, ai, plugins: this, treePicker, filePicker,
      use: k => this.modules.get(k) ?? null,                                    // Modul eines anderen Plugins (Basis-Plugin)
      plugin: { key, version: p?.version, base: `/plugins/${key}/` },
      data: {
        list: () => api.get(`/api/plugins/${key}/data`),
        get: name => api.get(base + encodeURIComponent(name)).catch(() => null),
        set: (name, value) => api.post(base + encodeURIComponent(name), value, 'PUT'),
        del: name => api.del(base + encodeURIComponent(name)),
      },
      batch: (commands, batch = null) => api.post('/api/batch', { commands, batch }),
      checks: this.checks,                                                      // Prüfregeln aller Plugins (für da)
      go: async path => (await import('./router.js')).router.push(path),        // Navigation in der Oberfläche
      // JSON-Datei zum Import übergeben und den JSON-Import öffnen (Baum-Drop, Menü, Tabellenimport)
      importJson: async (file, parent = null) => { store.pendingImport = { file, parent }; (await import('./router.js')).router.push('/p/json/import') },
    }
  },
  // Importer nach Dateiname: der erste, dessen accept passt
  importerFor(name) { const ext = '.' + String(name ?? '').split('.').pop().toLowerCase(); return this.importers.find(i => (i.accept ?? []).map(a => a.toLowerCase()).includes(ext)) ?? null },
})
