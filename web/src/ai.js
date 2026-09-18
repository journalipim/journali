// KI-Unterstützung (Taloan, 18.09.2026): wenn in den Einstellungen ein Claude-API-Schlüssel hinterlegt ist, dürfen
// Plugins (Datenqualität, DPP, PPWR …) Vorschläge von der KI holen. Der Schlüssel bleibt im Browser (localStorage),
// nie im Journal, nie im Repo. Ohne Schlüssel arbeiten die Plugins autark — regelbasiert.
// Aufruf direkt aus dem Browser (Anthropic erlaubt das mit dem Kopf anthropic-dangerous-direct-browser-access).
import { reactive } from 'vue'

const KEY = 'journali.ai'
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } })()

export const ai = reactive({
  key: saved.key || '',
  model: saved.model || 'claude-sonnet-5',
  models: ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'],
  busy: 0,
  lastError: '',

  available() { return !!this.key },
  save() { try { localStorage.setItem(KEY, JSON.stringify({ key: this.key, model: this.model })) } catch {} },

  // Eine Frage, eine Antwort. json: true → die Antwort wird als JSON gelesen (Code-Zäune werden entfernt).
  async ask({ system = '', user, json = false, maxTokens = 2000, temperature = 0 }) {
    if (!this.key) throw new Error('Kein KI-Schlüssel — Einstellungen → KI (Claude)')
    this.busy++
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: this.model, max_tokens: maxTokens, temperature, system: system || undefined, messages: [{ role: 'user', content: user }] }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error?.message || `${res.status} ${res.statusText}`)
      const text = (data?.content ?? []).filter(c => c.type === 'text').map(c => c.text).join('')
      this.lastError = ''
      if (!json) return text
      const m = text.match(/```(?:json)?\s*([\s\S]*?)```/); const raw = (m ? m[1] : text).trim()
      try { return JSON.parse(raw) } catch { throw new Error('KI-Antwort war kein JSON: ' + raw.slice(0, 120)) }
    } catch (e) { this.lastError = e.message; throw e }
    finally { this.busy-- }
  },

  // Verbindung prüfen: eine winzige Anfrage
  async test() { const t = await this.ask({ user: 'Antworte nur mit dem Wort: ok', maxTokens: 5 }); return String(t).trim().toLowerCase().startsWith('ok') },
})
