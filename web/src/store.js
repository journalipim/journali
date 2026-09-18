import { reactive } from 'vue'
import { api } from './api.js'

// Ein Zustand für die ganze Oberfläche. Einstellungen liegen im localStorage,
// der Serverstand (head) wird alle 3 s abgefragt — darauf hängen Live-Listen.
const saved = JSON.parse(localStorage.getItem('journali.settings') || '{}')

export const store = reactive({
  actor: saved.actor || '',
  server: saved.server || '',
  theme: saved.theme || 'system',   // system | light | dark
  viewLocales: saved.viewLocales || ['de', 'en'],   // Sicht: welche Sprachen als Spalten
  viewChannel: saved.viewChannel ?? null,          // Sicht: welcher Kanal (null = nur *)
  journalOpen: saved.journalOpen ?? true,           // Journal neben dem Knoten auf- oder zugeklappt
  viewKey: (saved.viewKey && typeof saved.viewKey === 'object') ? saved.viewKey : {},   // gewählte Sicht je Knotentyp
  layout: saved.layout ?? 'flat',                    // flat | tabs
  editableOnly: saved.editableOnly ?? false,         // nur Gruppen zeigen, die hier bearbeitbar sind
  attrNames: saved.attrNames ?? 'label',             // Attributnamen: label | key | both (Taloan: Vorlagen nutzen die Keys)
  railOrder: Array.isArray(saved.railOrder) ? saved.railOrder : null,   // Reihenfolge der Leiste links (Taloan: selbst sortieren), 'spacer' trennt oben/unten
  undo: {},                                         // ↶/↷ je Knoten: id → { history, redo } — im Store, weil NodeView je Knoten neu gebaut wird (Taloan)
  pendingImport: null,                              // { file, parent } — JSON-Datei, die der JSON-Import gleich öffnen soll (Baum-Drop, Menü, Tabellenimport)
  attrFilter: '',                                   // Suchfeld im Knoten — bleibt beim Knotenwechsel (Taloan), nicht gespeichert
  collapsed: Array.isArray(saved.collapsed) ? saved.collapsed : [],   // zugeklappte Abschnitte am Knoten (attributes, media, relations, …)
  online: null,          // null = noch nicht gefragt, sonst true/false
  head: 0,
  nodes: 0,
  model: null,           // { locales, channels, attributes } vom Server
  toasts: [],
  error: '',
  etag: null,           // ETag der index.html beim Laden — ändert er sich, liegt eine neue Fassung
  stale: false,

  // Name eines Attributs/einer Gruppe/einer Liste in der Anzeige: Bezeichnung in der ersten Sicht-Sprache (Rückfall de, Key),
  // technischer Key, oder beides — je Einstellung attrNames
  label(def) {
    if (!def) return ''
    if (this.attrNames === 'key') return ''   // im Key-Modus steht nur der Key (die Ansicht zeigt ihn abgegraut daneben)
    return def.label?.[this.viewLocales?.[0]] || def.label?.de || Object.values(def.label ?? {}).find(Boolean) || def.key
  },
  name(def) {
    if (!def) return ''
    const label = def.label?.[this.viewLocales?.[0]] || def.label?.de || Object.values(def.label ?? {}).find(Boolean) || def.key
    return this.attrNames === 'key' ? def.key : this.attrNames === 'both' ? `${label} ⟨${def.key}⟩` : label
  },
  save() {
    localStorage.setItem('journali.settings', JSON.stringify({ actor: this.actor, server: this.server, theme: this.theme, viewLocales: this.viewLocales, viewChannel: this.viewChannel, journalOpen: this.journalOpen, viewKey: this.viewKey, layout: this.layout, editableOnly: this.editableOnly, attrNames: this.attrNames, railOrder: this.railOrder, collapsed: this.collapsed }))
    this.applyTheme()
  },

  applyTheme() {
    if (this.theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = this.theme
  },

  async poll(force = false) {
    try {
      const h = await api.get('/api/health')
      this.online = true
      const changed = h.head !== this.head
      this.head = h.head
      this.nodes = h.nodes
      this.error = ''
      // Modell-Änderungen kommen durch dasselbe Journal — bei neuem Stand nachladen.
      if (!this.model || changed || force) this.model = await api.get('/api/model')
    } catch (e) {
      this.online = false
      this.error = e.message
    }
  },

  start() {
    this.applyTheme()
    this.poll()
    setInterval(() => this.poll(), 3000)
    this.checkVersion()
    setInterval(() => this.checkVersion(), 30000)
  },

  // Neue Fassung der Oberfläche? index.html ohne Cache holen und den ETag vergleichen.
  async checkVersion() {
    try {
      const res = await fetch('/index.html', { method: 'HEAD', cache: 'no-store' })
      const tag = res.headers.get('etag')
      if (!tag) return
      if (this.etag === null) this.etag = tag
      else if (tag !== this.etag) this.stale = true
    } catch { /* offline: egal */ }
  },

  // action: { label, run } — ein Knopf im Toast (↶ wiederherstellen); der Toast bleibt dann länger
  toast(text, kind = 'error', action = null) {
    const t = { id: Date.now() + Math.random(), text, kind, action }
    this.toasts.push(t)
    setTimeout(() => { const i = this.toasts.indexOf(t); if (i >= 0) this.toasts.splice(i, 1) }, action ? 12000 : 4000)
  },
  dismiss(t) { const i = this.toasts.indexOf(t); if (i >= 0) this.toasts.splice(i, 1) },
})
