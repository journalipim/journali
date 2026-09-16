import { reactive } from 'vue'
import { api } from './api.js'

// Ein Zustand für die ganze Oberfläche. Einstellungen liegen im localStorage,
// der Serverstand (head) wird alle 3 s abgefragt — darauf hängen Live-Listen.
const saved = JSON.parse(localStorage.getItem('journali.settings') || '{}')

export const store = reactive({
  actor: saved.actor || '',
  server: saved.server || '',
  theme: saved.theme || 'system',   // system | light | dark
  online: null,          // null = noch nicht gefragt, sonst true/false
  head: 0,
  products: 0,
  model: null,           // { locales, channels, attributes } vom Server
  toasts: [],
  error: '',

  save() {
    localStorage.setItem('journali.settings', JSON.stringify({ actor: this.actor, server: this.server, theme: this.theme }))
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
      this.products = h.products
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
  },

  toast(text, kind = 'error') {
    const t = { id: Date.now() + Math.random(), text, kind }
    this.toasts.push(t)
    setTimeout(() => this.toasts.splice(this.toasts.indexOf(t), 1), 4000)
  },
})
