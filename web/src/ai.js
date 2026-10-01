// KI-Unterstützung: Plugins (Datenqualität, DPP, PPWR, ETIM, Anreicherung, GEO, Editor) holen Vorschläge
// von der KI, wenn ein Schlüssel hinterlegt ist. Der hängt seit dem 23.09.2026 am **Team** und liegt beim Server — nie im Journal, nie im Browser. Ohne Team und ohne
// Schlüssel arbeiten die Plugins autark, regelbasiert; journali selbst bietet keine KI an.
// Kein Anbieter ist im Code bevorzugt: Texte sagen „KI“; wo es auf den Anbieter ankommt, zählt ai.active() auf,
// welche eingerichtet sind, und ai.label() nennt den gewählten mit Modell.
//
// Zwei Wege: liegt am Team ein Schlüssel, fragt der Server (POST /api/ai/ask) — der Schlüssel bleibt
// dort, jeder Aufruf wird beim zahlenden Team gezählt, Grenzen greifen, und auch Jobs können KI. Wer seinen eigenen Vertrag
// benutzen will, trägt hier einen Schlüssel ein: dann fragt der Browser wieder direkt, es zählt niemand mit, und er zahlt selbst.
import { reactive } from 'vue'
import { api } from './api.js'
import { t as t_ } from './i18n.js'

const KEY = 'journali.ai'
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } })()

/// Die Anbieter: Schlüssel und Modell je Anbieter; call() spricht das Protokoll und liefert { text, sources }
export const PROVIDERS = [
  {
    key: 'anthropic', label: t_('Anthropic'), placeholder: 'sk-ant-…', endpoint: 'api.anthropic.com',
    // Stand 01.10.2026: Sonnet 5.5, Opus 5.5, Fable 5.1 und Haiku 4.5; Sonnet 5 und Opus 5 bleiben wählbar. Das erste ist die Voreinstellung
    models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-sonnet-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-haiku-4-5', 'claude-haiku-4-5-20251001'],
    modelLabels: {
      'claude-sonnet-5-5': t_('Sonnet 5.5 — schnell, günstig (Vorschläge, Zuordnung)'),
      'claude-opus-5-5': t_('Opus 5.5 — gründlich (schwierige Fälle, Recherche)'),
      'claude-sonnet-5': t_('Sonnet 5 — schnell, günstig (Vorschläge, Zuordnung)'),
      'claude-opus-5': t_('Opus 5 — gründlich (schwierige Fälle, Recherche)'),
      'claude-fable-5-1': t_('Fable 5.1 — stärkstes Modell, teuer'),
      'claude-haiku-4-5': t_('Haiku 4.5 — am günstigsten, kurze Aufgaben'),
      'claude-haiku-4-5-20251001': t_('Haiku 4.5 (alte Kennung)'),
    },
    hint: t_('Sonnet 5.5 für Vorschläge, Opus 5.5 für schwierige Fälle, Haiku 4.5 für Masse, Fable 5.1 für das Schwerste'),
    async call({ key, model, system, user, maxTokens, temperature, web, maxSearches }) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        // temperature gibt es bei Claude 5 und Opus 4.7/4.8 nicht mehr (die API lehnt es ab bzw. warnt) — nur an ältere Modelle schicken
        body: JSON.stringify({ model, max_tokens: maxTokens, ...(/^claude-(opus-5|sonnet-5|fable-5|mythos-5|opus-4-[78])/.test(model) ? {} : { temperature }), system: system || undefined, messages: [{ role: 'user', content: user }],
          ...(web ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxSearches }] } : {}) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error?.message || `${res.status} ${res.statusText}`)
      const blocks = data?.content ?? []
      return { text: blocks.filter(c => c.type === 'text').map(c => c.text).join(''), sources: blocks.flatMap(c => c.citations ?? []).filter(c => c.url).map(c => ({ url: c.url, title: c.title ?? c.url })),
        usage: { in: data?.usage?.input_tokens ?? 0, out: data?.usage?.output_tokens ?? 0 } }
    },
  },
  {
    key: 'openai', label: t_('OpenAI'), placeholder: 'sk-…', endpoint: 'api.openai.com',
    models: ['gpt-5', 'gpt-5-mini', 'gpt-4.1'],
    hint: 'mini: schnell und günstig; gpt-5: gründlicher',
    async call({ key, model, system, user, maxTokens, temperature, web, maxSearches }) {
      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
        body: JSON.stringify({ model, max_output_tokens: maxTokens, instructions: system || undefined, input: user, ...(web ? { tools: [{ type: 'web_search' }], max_tool_calls: maxSearches } : {}), ...(/^gpt-5/.test(model) ? {} : { temperature }) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error?.message || `${res.status} ${res.statusText}`)
      const parts = (data?.output ?? []).filter(o => o.type === 'message').flatMap(o => o.content ?? []).filter(c => c.type === 'output_text')
      return { usage: { in: data?.usage?.input_tokens ?? 0, out: data?.usage?.output_tokens ?? 0 }, text: parts.map(c => c.text).join(''), sources: parts.flatMap(c => c.annotations ?? []).filter(a => a.type === 'url_citation' && a.url).map(a => ({ url: a.url, title: a.title ?? a.url })) }
    },
  },
]
const byKey = k => PROVIDERS.find(p => p.key === k)

export const ai = reactive({
  // je Anbieter { key, model }; provider = der, den die Plugins fragen
  accounts: Object.fromEntries(PROVIDERS.map(p => [p.key, { key: saved.accounts?.[p.key]?.key ?? (p.key === 'anthropic' ? saved.key ?? '' : ''), model: saved.accounts?.[p.key]?.model ?? ((p.key === 'anthropic' && saved.model) || p.models[0]) }])),
  provider: saved.provider || 'anthropic',
  busy: 0,
  lastError: '',
  lastSources: [],      // Quellen (url, title) der letzten Antwort mit web: true
  // Verbrauch, seit wann: Token kosten Geld — die Statuszeile zeigt sie; „zurücksetzen“ im Tooltip der Einstellungen

  providers: PROVIDERS,
  // Was das Team stellt (GET /api/ai/state): { team, label, payer, providers[], models, ready }
  server: null,
  async loadState() { try { this.server = await api.get('/api/ai/state') } catch { this.server = null } return this.server },
  /// Der Server fragt für uns, sobald das Team einen Schlüssel hat — einen anderen Weg gibt es nicht mehr.
  viaServer() { return !!this.server?.ready },
  /// eingerichtete Anbieter (mit Schlüssel) — zum Aufzählen in Hilfen und Einstellungen
  active() { return PROVIDERS.filter(p => this.accounts[p.key]?.key) },
  available() { return !!this.server?.ready },
  /// Der Anbieter, den der Server fragen wird: die Wahl des Teams (models["*"]), sonst der erste — der Server rechnet gleich
  anbieter() { const s = this.server; if (!s?.ready) return null; const p = s.providers ?? []; return p.includes(s.chosen) ? s.chosen : p.includes(this.provider) ? this.provider : p[0] ?? null },
  /// Kostet die nächste Frage Token beim Anbieter? Das lokale Modell (29.09.2026) nicht — es ist darum nicht magenta und darf von selbst laufen
  bezahlt() { return this.anbieter() !== 'lokal' },
  /// der Anbieter, der gefragt wird: der gewählte, wenn er einen Schlüssel hat, sonst der erste eingerichtete
  current() { const p = byKey(this.provider); return p && this.accounts[p.key]?.key ? p : this.active()[0] ?? null },
  get model() { const p = this.current(); return p ? this.accounts[p.key].model : '' },
  /// „Anthropic · claude-sonnet-5“ — für Tooltips und Meldungen, wo es auf den Anbieter ankommt
  label() {
    const s = this.server
    if (!s?.ready) return 'KI'
    const a = this.anbieter() ?? ''
    return `${a} · ${s.models?.[a] ?? ''} · ${s.label ?? s.team}`.replace(/ · $/, '')
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify({ accounts: this.accounts, provider: this.provider })) } catch {} },

  // Eine Frage, eine Antwort. json: true → die Antwort wird als JSON gelesen (Code-Zäune werden entfernt).
  // web: true → die KI darf im Internet suchen (Herstellerseiten, Datenblätter);
  // die Quellen der Antwort stehen danach in lastSources. Kostet je Suche extra beim Anbieter.
  async ask({ system = '', user, json = false, maxTokens = 2000, temperature = 0, web = false, maxSearches = 5, purpose = '' }) {
    if (!this.server?.ready) throw new Error(this.server?.team ? t_('Für Team „{0}“ ist kein KI-Schlüssel hinterlegt', [this.server.label ?? this.server.team]) : t_('Kein Team — ohne Team keine KI'))
    this.busy++
    try {
      const anbieter = this.anbieter()
      const modell = this.server.models?.[anbieter]
      const { text, sources } = await api.post('/api/ai/ask', { provider: anbieter, model: modell, system, user, maxTokens, web, maxSearches, purpose })
        .then(r => ({ text: r.text, sources: r.sources ?? [] }))
      const seen = new Set(); this.lastSources = sources.filter(s => !seen.has(s.url) && seen.add(s.url))
      this.lastError = ''
      this.loadState()   // das gemessene Volumen wächst — die Kennzahl oben zieht nach
      if (!json) return text
      const m = text.match(/```(?:json)?\s*([\s\S]*?)```/); const raw = (m ? m[1] : text).trim()
      try { return JSON.parse(raw) } catch { const o = raw.indexOf('{'), c = raw.lastIndexOf('}'); if (o >= 0 && c > o) { try { return JSON.parse(raw.slice(o, c + 1)) } catch {} } throw new Error(t_('KI-Antwort war kein JSON:') + ' ' + raw.slice(0, 120)) }
    } catch (e) { this.lastError = e.message; throw e }
    finally { this.busy-- }
  },

  // Der Schlüssel des Teams antwortet? Eine winzige Anfrage über den Server.
  async test(providerKey = null) {
    const keep = this.provider; if (providerKey) this.provider = providerKey
    try { const t = await this.ask({ user: t_('Antworte nur mit dem Wort: ok'), maxTokens: 16, purpose: t_('Probe') }); return String(t).trim().toLowerCase().startsWith('ok') }
    finally { this.provider = keep }
  },
})
