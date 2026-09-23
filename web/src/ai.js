// KI-Unterstützung (Taloan, 18.09.2026): wenn in den Einstellungen ein API-Schlüssel eines KI-Anbieters hinterlegt ist, dürfen
// Plugins (Datenqualität, DPP, PPWR, ETIM, Anreicherung, GEO, Editor) Vorschläge von der KI holen. Schlüssel bleiben im Browser
// (localStorage), nie im Journal, nie im Repo; journali bietet keine KI an. Ohne Schlüssel arbeiten die Plugins autark — regelbasiert.
// Kein Anbieter ist im Code bevorzugt (Taloan, 20.09.): Texte sagen „KI“; wo es auf den Anbieter ankommt, zählt ai.active() auf,
// welche eingerichtet sind, und ai.label() nennt den gewählten mit Modell.
//
// Zwei Wege (Taloan, 23.09.2026, Teams): liegt am Team ein Schlüssel, fragt der Server (POST /api/ai/ask) — der Schlüssel bleibt
// dort, jeder Aufruf wird beim zahlenden Team gezählt, Grenzen greifen, und auch Jobs können KI. Wer seinen eigenen Vertrag
// benutzen will, trägt hier einen Schlüssel ein: dann fragt der Browser wieder direkt, es zählt niemand mit, und er zahlt selbst.
import { reactive } from 'vue'
import { api } from './api.js'

const KEY = 'journali.ai'
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } })()

/// Die Anbieter: Schlüssel und Modell je Anbieter; call() spricht das Protokoll und liefert { text, sources }
export const PROVIDERS = [
  {
    key: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-…', endpoint: 'api.anthropic.com',
    // Stand 22.09.2026: Claude 5 (Fable 5.1, Opus 5, Sonnet 5) und Haiku 4.5 — Kurzbezeichnungen ohne Datum
    models: ['claude-sonnet-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-haiku-4-5', 'claude-haiku-4-5-20251001'],
    modelLabels: {
      'claude-sonnet-5': 'Sonnet 5 — schnell, günstig (Vorschläge, Zuordnung)',
      'claude-opus-5': 'Opus 5 — gründlich (schwierige Fälle, Recherche)',
      'claude-fable-5-1': 'Fable 5.1 — stärkstes Modell, teuer',
      'claude-haiku-4-5': 'Haiku 4.5 — am günstigsten, kurze Aufgaben',
      'claude-haiku-4-5-20251001': 'Haiku 4.5 (alte Kennung)',
    },
    hint: 'Sonnet 5 für Vorschläge, Opus 5 für schwierige Fälle, Haiku 4.5 für Masse, Fable 5.1 für das Schwerste',
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
    key: 'openai', label: 'OpenAI', placeholder: 'sk-…', endpoint: 'api.openai.com',
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
  // Verbrauch, seit wann (Taloan, 22.09.): Token kosten Geld — die Statuszeile zeigt sie; „zurücksetzen“ im Tooltip der Einstellungen
  used: { calls: 0, in: 0, out: 0, since: new Date().toISOString().slice(0, 10), per: {}, ...(saved.used ?? {}) },

  providers: PROVIDERS,
  // Was das Team stellt (GET /api/ai/state): { team, label, payer, providers[], ready, limits, used }
  server: null,
  async loadState() { try { this.server = await api.get('/api/ai/state') } catch { this.server = null } return this.server },
  /// Was das eigene Team diesen Monat verbraucht hat, und woran es gemessen wird (0 = keine Grenze).
  /// Das ist die Zahl, die zählt — der Zähler im Browser kennt nur diesen einen Rechner.
  teamUsed() {
    const s = this.server
    if (!s?.team) return null
    return { label: s.label ?? s.team, month: s.used?.month ?? 0, today: s.used?.today ?? 0, limit: s.limits?.included || s.limits?.monthly || 0, hard: !!s.limits?.included, ready: !!s.ready }
  },
  /// Fragt der Server für uns? Nur, wenn ein Team einen Schlüssel hat — ein eigener Schlüssel im Browser geht vor.
  viaServer() { return !!this.server?.ready && !this.accounts[this.provider]?.key },
  /// eingerichtete Anbieter (mit Schlüssel) — zum Aufzählen in Hilfen und Einstellungen
  active() { return PROVIDERS.filter(p => this.accounts[p.key]?.key) },
  available() { return this.active().length > 0 || !!this.server?.ready },
  /// der Anbieter, der gefragt wird: der gewählte, wenn er einen Schlüssel hat, sonst der erste eingerichtete
  current() { const p = byKey(this.provider); return p && this.accounts[p.key]?.key ? p : this.active()[0] ?? null },
  get model() { const p = this.current(); return p ? this.accounts[p.key].model : '' },
  /// „Anthropic · claude-sonnet-5“ — für Tooltips und Meldungen, wo es auf den Anbieter ankommt
  label() {
    const p = this.current()
    if (p) return `${p.label} · ${this.accounts[p.key].model}`
    if (this.server?.ready) return `KI · ${this.server.label ?? this.server.team}`
    return 'KI'
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify({ accounts: this.accounts, provider: this.provider, used: this.used })) } catch {} },
  /// Verbrauch eines Anbieters (oder ohne Angabe: alles) zurücksetzen — Einstellungen → KI
  resetUsed(key = null) {
    if (!key) { this.used = { calls: 0, in: 0, out: 0, since: new Date().toISOString().slice(0, 10), per: {} }; this.save(); return }
    const g = this.usedOf(key); const per = { ...(this.used.per ?? {}) }; delete per[key]
    this.used = { ...this.used, calls: Math.max(0, this.used.calls - g.calls), in: Math.max(0, this.used.in - g.in), out: Math.max(0, this.used.out - g.out), per }
    this.save()
  },
  /// Verbrauch eines Anbieters
  usedOf(key) { return this.used.per?.[key] ?? { calls: 0, in: 0, out: 0 } },

  // Eine Frage, eine Antwort. json: true → die Antwort wird als JSON gelesen (Code-Zäune werden entfernt).
  // web: true → die KI darf im Internet suchen (Herstellerseiten, Datenblätter — Taloan, 20.09.: Daten fremder Produkte ergänzen);
  // die Quellen der Antwort stehen danach in lastSources. Kostet je Suche extra beim Anbieter.
  async ask({ system = '', user, json = false, maxTokens = 2000, temperature = 0, web = false, maxSearches = 5 }) {
    const p = this.current()
    const ueberServer = !p && this.server?.ready
    if (!p && !ueberServer) throw new Error(this.server?.team ? `Für Team „${this.server.label ?? this.server.team}“ ist kein KI-Schlüssel hinterlegt` : 'Kein KI-Schlüssel — Einstellungen → KI')
    this.busy++
    try {
      const anbieter = ueberServer ? (this.server.providers.includes(this.provider) ? this.provider : this.server.providers[0]) : p.key
      const modell = this.accounts[anbieter]?.model ?? PROVIDERS.find(x => x.key === anbieter)?.models[0]
      const { text, sources, usage } = ueberServer
        ? await api.post('/api/ai/ask', { provider: anbieter, model: modell, system, user, maxTokens, web, maxSearches })
            .then(r => {
              if (r.warn) this.warn = r.warn
              // der Stand des Teams wächst mit — sonst stünde in der Leiste bis zum nächsten Laden eine alte Zahl
              const t = (r.usage?.in ?? 0) + (r.usage?.out ?? 0)
              if (this.server?.used) this.server = { ...this.server, used: { today: (this.server.used.today ?? 0) + t, month: (this.server.used.month ?? 0) + t } }
              return { text: r.text, sources: r.sources ?? [], usage: { in: r.usage?.in ?? 0, out: r.usage?.out ?? 0 } }
            })
        : await p.call({ key: this.accounts[p.key].key, model: this.accounts[p.key].model, system, user, maxTokens, temperature, web, maxSearches })
      // Verbrauch gesamt und je Anbieter (Taloan, 22.09.: „Zählung funktioniert noch nicht separat“)
      const add = (a, u) => ({ calls: (a?.calls ?? 0) + 1, in: (a?.in ?? 0) + (u?.in ?? 0), out: (a?.out ?? 0) + (u?.out ?? 0) })
      const t = add(this.used, usage)
      const pk = p ? p.key : (this.server?.providers?.[0] ?? 'team')
      this.used = { ...this.used, ...t, per: { ...(this.used.per ?? {}), [pk]: add(this.used.per?.[pk], usage) } }
      this.save()
      const seen = new Set(); this.lastSources = sources.filter(s => !seen.has(s.url) && seen.add(s.url))
      this.lastError = ''
      if (!json) return text
      const m = text.match(/```(?:json)?\s*([\s\S]*?)```/); const raw = (m ? m[1] : text).trim()
      try { return JSON.parse(raw) } catch { const o = raw.indexOf('{'), c = raw.lastIndexOf('}'); if (o >= 0 && c > o) { try { return JSON.parse(raw.slice(o, c + 1)) } catch {} } throw new Error('KI-Antwort war kein JSON: ' + raw.slice(0, 120)) }
    } catch (e) { this.lastError = e.message; throw e }
    finally { this.busy-- }
  },

  warn: '',   // Hinweis des Servers, z. B. „über der Monatsschwelle“ — die Arbeit läuft weiter

  // Verbindung eines Anbieters prüfen: eine winzige Anfrage
  async test(providerKey = null) {
    const keep = this.provider; if (providerKey) this.provider = providerKey
    try { const t = await this.ask({ user: 'Antworte nur mit dem Wort: ok', maxTokens: 16 }); return String(t).trim().toLowerCase().startsWith('ok') }
    finally { this.provider = keep }
  },
})
