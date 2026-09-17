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
  collapsed: Array.isArray(saved.collapsed) ? saved.collapsed : [],   // zugeklappte Abschnitte am Knoten (attributes, media, relations, …)
  online: null,          // null = noch nicht gefragt, sonst true/false
  head: 0,
  nodes: 0,
  model: null,           // { locales, channels, attributes } vom Server
  toasts: [],
  error: '',
  etag: null,           // ETag der index.html beim Laden — ändert er sich, liegt eine neue Fassung
  stale: false,

  save() {
    localStorage.setItem('journali.settings', JSON.stringify({ actor: this.actor, server: this.server, theme: this.theme, viewLocales: this.viewLocales, viewChannel: this.viewChannel, journalOpen: this.journalOpen, viewKey: this.viewKey, layout: this.layout, editableOnly: this.editableOnly, collapsed: this.collapsed }))
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

  toast(text, kind = 'error') {
    const t = { id: Date.now() + Math.random(), text, kind }
    this.toasts.push(t)
    setTimeout(() => this.toasts.splice(this.toasts.indexOf(t), 1), 4000)
  },
})
