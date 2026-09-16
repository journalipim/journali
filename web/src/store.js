import { reactive } from 'vue'
import { api } from './api.js'

// Ein Zustand für die ganze Oberfläche. Einstellungen liegen im localStorage,
// der Serverstand (head) wird alle 3 s abgefragt — darauf hängen Live-Listen.
const saved = JSON.parse(localStorage.getItem('journali.settings') || '{}')

export const store = reactive({
  actor: saved.actor || '',
  server: saved.server || '',
  online: null,          // null = noch nicht gefragt, sonst true/false
  head: 0,
  products: 0,
  model: null,           // { locales, channels, attributes } vom Server
  toasts: [],
  error: '',

  save() {
    localStorage.setItem('journali.settings', JSON.stringify({ actor: this.actor, server: this.server }))
  },

  async poll() {
    try {
      const h = await api.get('/api/health')
      this.online = true
      this.head = h.head
      this.products = h.products
      this.error = ''
      if (!this.model) this.model = await api.get('/api/model')
    } catch (e) {
      this.online = false
      this.error = e.message
    }
  },

  start() {
    this.poll()
    setInterval(() => this.poll(), 3000)
  },

  toast(text, kind = 'error') {
    const t = { id: Date.now() + Math.random(), text, kind }
    this.toasts.push(t)
    setTimeout(() => this.toasts.splice(this.toasts.indexOf(t), 1), 4000)
  },
})
