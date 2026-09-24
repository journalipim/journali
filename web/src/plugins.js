// Plugins in der Oberfläche (docs/pflegestruktur.md, 19): Liste vom Server (/api/plugins), eingeschaltete
// Browser-Plugins werden als ES-Modul von /plugins/<key>/<entry> geladen und tragen bei. Basis-Plugins (Manifest
// base: [Gruppen]) bringen die Grundfunktion einer Gruppe der Leiste mit (table: Import/Export, da: Datenanalyse,
// tasker: Jobs) und sind der Container für Plugins, die sie brauchen (requires). Gebaute Plugins (src/ + entry.js aus
// web/build-plugins.mjs) liefern Vue-Ansichten; sie teilen Vue, Router, Store, Baum mit der Oberfläche (host.js).
//
// Vertrag eines Browser-Plugins (default export), alles optional:
//   views:       [{ path: 'meine-ansicht', label, icon, hint?, topic?, needs?, props?, mount(el, ctx) → unmount? | component }]   Ansicht — in der Übersicht ihres Themas
//                (needs: Schlüssel eines Plugins, ohne das die Ansicht nicht erscheint — das Basis-Plugin table zeigt je
//                Format eine Kachel, aber nur solange das Format-Plugin an ist; props: feste Eigenschaften der Komponente)
//                (topic: import | export | datasheet | analysis | jobs | tools; sonst aus kind des Manifests); component = Vue-Komponente (gebaut)
//   nodeActions: [{ label | label(row, below) (null = hier nicht), icon, hint? | hint(row), roles?: ['group','product'], topic?: 'import'|'export'|'datasheet'|'analysis'|'tools', run(nodeId, ctx) }]
//                Kontextmenü des Baums, ein Untermenü je Thema (roles: nur an diesen; topic sonst aus kind des Manifests; below = „Subitems“)
//   importers:   [{ key, label, accept: ['.csv'], parse(file, ctx) → { columns, rows, sheets? } }]
//                Quellen für den Tabellenimport (⇩ Import → Tabelle); rows als Arrays in Spaltenreihenfolge
//   checks:      [{ key, label, run({ row, values, columns, model }) → [{ severity: 'error'|'warn'|'info', attribute?, message }] }]
//   install(ctx): einmal beim Einschalten des Plugins — legt an, was das Plugin braucht (ETIM: Gruppe und
//                Klassenattribut, an MasterTree gehängt). Läuft nicht bei jedem Seitenaufruf; der Lauf wird je Plugin gemerkt.
//   nodeViews:   [{ key, label(row, ctx) | label, roles?, items(row, ctx) → [{ group, order: [attrKey] }] | null,
//                blocks?(row, ctx) → [{ key, title, keys: [attrKey] }] | null, replaces?: 'gruppe' }]
//                Am Knoten berechnet, nie im Journal. Mit `label` steht es als eigene Sicht zur Wahl; mit
//                `replaces` gliedert es diese Attributgruppe: die Gruppe bleibt ein Reiter, die Teile werden zu
//                Zwischenüberschriften darin (ETIM: je Klassenmenge eine — „gilt für alle drei Klassen“ zuerst)
//   nodeBands:   [{ key, label, icon?, roles?, mount({ head, body }, nodeId, ctx) → unmount? }]   Band in der Knotenansicht
//   Manifest process {…} oder processes: [{ key, label, command, args, params, description }] — mehrere Dienste je Plugin; ein Job nennt plugin + service
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
import { registerPluginLang } from './i18n.js'
import { ai } from './ai.js'
import { t } from './i18n.js'
import { L } from './i18n.js'

export const plugins = reactive({
  list: [],
  loaded: false,
  modules: new Map(),     // key → default export
  views: [],              // { key, path, label, icon, mount }
  nodeActions: [],        // { key, label, icon, run }
  importers: [],          // { key (Plugin), source (importer.key), label, accept, parse }
  checks: [],             // { key (Plugin), check, label, run }
  nodeBands: [],          // { key (Plugin), band (band.key), label, icon, roles, mount }
  nodeViews: [],          // { key (Plugin), view (view.key), label, roles, items(row, ctx) } — flüchtig, nie im Journal
  rev: 0,                 // Zähler: ein Plugin meldet mit ctx.touch(), dass seine Daten stehen — Ansichten rechnen dann neu

  loading: null,          // laufender load() — wer gleichzeitig ruft, wartet darauf (sonst doppelte Einträge in der Leiste)
  load() { return this.loading ??= this._load().finally(() => { this.loading = null }) },
  async _load() {
    try { this.list = await api.get('/api/plugins') } catch (e) { this.list = []; this.loaded = true; return }
    // Basis-Plugins zuerst (ihre Einträge stehen dann vorn in der Gruppe), dann der Rest in Reihenfolge
    const order = [...this.list].sort((a, b) => (Array.isArray(b.manifest?.base) ? 1 : 0) - (Array.isArray(a.manifest?.base) ? 1 : 0))
    // erst laden, was neu dazugekommen ist (ein Modul bleibt geladen — ein ES-Modul lässt sich nicht entladen)
    for (const p of order) {
      const m = p.manifest ?? {}
      if (!this.active(p.key) || m.runs !== 'browser' || !m.entry || this.modules.has(p.key)) continue
      await registerPluginLang(p.key)   // Oberflächensprache (24.09.2026): plugins/<key>/lang/<code>.json vor dem Modul
      try { this.modules.set(p.key, (await import(/* @vite-ignore */ `/plugins/${p.key}/${m.entry}`)).default ?? {}) }
      catch (e) { store.toast(t('Plugin {0}: {1}', [p.key, e.message])) }
    }
    // dann die Beiträge NEU sammeln
    this.views = []; this.nodeActions = []; this.importers = []; this.checks = []; this.nodeBands = []; this.nodeViews = []
    for (const p of order) {
      if (!this.active(p.key)) continue
      const mod = this.modules.get(p.key); if (!mod) continue
      // needs: eine Ansicht, die ein anderes Plugin braucht, erscheint nur, solange das wirkt
      for (const v of mod.views ?? []) if (!v.needs || this.active(v.needs)) this.views.push({ key: p.key, ...v })
      for (const a of mod.nodeActions ?? []) this.nodeActions.push({ key: p.key, ...a })
      for (const i of mod.importers ?? []) this.importers.push({ key: p.key, source: i.key, ...i })
      for (const c of mod.checks ?? []) this.checks.push({ key: p.key, check: c.key, ...c })
      for (const b of mod.nodeBands ?? []) this.nodeBands.push({ key: p.key, band: b.key, ...b })
      for (const v of mod.nodeViews ?? []) this.nodeViews.push({ key: p.key, view: v.key, ...v })
    }
    // install() der frisch eingeschalteten Plugins
    await this.installNew()
    this.loaded = true   // erst jetzt: vorher sähe die Übersicht eines Themas nur den ersten Eintrag und leitete dorthin
  },
  enabled(key) { return this.active(key) },
  // Reihenfolge innerhalb eines Themas: 1. explizites order (Ansicht/Aktion, sonst Manifest; Vorgabe 50), 2. die Basis
  // des Themas, 3. Art: Prüfungen („… prüfen“) vor Vorschlägen („… vorschlagen“, „Anreichern“) vor dem Rest,
  // 4. Bezeichnung. Damit stehen die Kataloge (DPP, EmpCo, ETIM, PPWR) beisammen, und wer eine Reihenfolge nennt,
  // steht dort — auch vor der Basis (Import: CSV, Excel, JSON, dann die Zwischenablage).
  sorted(items, topic, labelOf = x => x.label) {
    const rank = x => { const l = String(typeof labelOf(x) === 'function' ? '' : labelOf(x) ?? '').toLowerCase(); return /prüfen$/.test(l) ? 1 : /vorschlagen$|anreichern$/.test(l) ? 2 : 3 }
    const base = x => (this.list.find(p => p.key === x.key)?.manifest?.base ?? []).includes(topic) ? 0 : 1
    const order = x => x.order ?? this.list.find(p => p.key === x.key)?.manifest?.order ?? 50
    return [...items].sort((a, b) => order(a) - order(b) || base(a) - base(b) || rank(a) - rank(b) || String(labelOf(a) ?? '').localeCompare(String(labelOf(b) ?? ''), 'de'))
  },
  // wirksam: an, und alles, was es braucht (requires), ist wirksam — eine ausgeschaltete Basis nimmt ihre Ergänzungen mit
  active(key, seen = new Set()) { const p = this.list.find(x => x.key === key); if (!p?.enabled || p.allowed === false || seen.has(key)) return false; seen.add(key); return (p.manifest?.requires ?? []).every(r => this.active(r, seen)) },
  requires(key) { return this.list.find(x => x.key === key)?.manifest?.requires ?? [] },
  dependents(key) { return this.list.filter(p => (p.manifest?.requires ?? []).includes(key)).map(p => p.key) },
  /// Welche Plugins schon eingerichtet sind (je Journal gemerkt — der Schlüssel nennt den Server, damit zwei Journale sich nicht stören)
  installedKey: () => `journali.installed.${store.server || 'local'}`,
  installedSet() { try { return new Set(JSON.parse(localStorage.getItem(this.installedKey()) || '[]')) } catch { return new Set() } },
  /// install(ctx) je Plugin genau einmal — beim ersten Einschalten; Fehler melden, aber nichts blockieren
  async installNew() {
    const done = this.installedSet()
    for (const p of this.list) {
      if (!this.active(p.key) || done.has(p.key)) continue
      const mod = this.modules.get(p.key)
      if (!mod?.install) { done.add(p.key); continue }
      try { await mod.install(this.ctx(p.key)); done.add(p.key); store.toast(`✓ ${L(p.manifest?.label) || p.key} eingerichtet`, 'ok') }
      catch (e) { store.toast(`${p.key}: ${e.message}`) }
    }
    try { localStorage.setItem(this.installedKey(), JSON.stringify([...done])) } catch {}
  },
  /// beim Ausschalten vergessen — ein erneutes Einschalten richtet wieder ein
  forgetInstalled(key) { const d = this.installedSet(); d.delete(key); try { localStorage.setItem(this.installedKey(), JSON.stringify([...d])) } catch {} },

  ctx(key) {
    const p = this.list.find(x => x.key === key)
    const base = `/api/plugins/${key}/data/`
    return {
      api, store, tree, mapper, dialog, orphans, compliance, ai, plugins: this, treePicker, filePicker,
      t,                                                                        // Oberflächensprache: Schlüssel ist der deutsche Text, dazu Werte für {0}
      touch: () => { this.rev++ },                                             // „meine Daten stehen“ — Ansichten neu rechnen
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
