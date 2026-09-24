import { reactive } from 'vue'
import { api } from './api.js'

// Ein Zustand für die ganze Oberfläche. Einstellungen liegen im localStorage,
// der Serverstand (head) wird alle 3 s abgefragt — darauf hängen Live-Listen.
const saved = JSON.parse(localStorage.getItem('journali.settings') || '{}')

// Was der Person folgt und nicht dem Gerät (Taloan, 23.09.2026: „Darstellung sollte auch userspezifisch sein“):
// Darstellung, Sichtsprachen, Zellen, Sicht je Knotentyp, Anordnung, Umfang, Attributnamen. Sie stehen am Benutzer im
// Journal (UserPrefsSet) und kommen mit der Anmeldung an jedem Rechner mit. Alles andere ist Fensterzustand und bleibt
// im Browser: Serveradresse, Journal auf/zu, zugeklappte Abschnitte, Reihenfolge der Leiste, zuletzt gewählter Knoten.
const USER_PREFS = ['theme', 'lang', 'viewLocales', 'viewCells', 'viewKey', 'layout', 'scope', 'attrNames']   // lang: Oberflächensprache (24.09.2026)

// Sprachen × Kanäle als Zellenliste (Stern je Achse dazu)
function cellsFrom(locales, channels) { const out = ['|']; for (const c of ['', ...channels]) for (const l of ['', ...locales]) out.push(`${l}|${c}`); return [...new Set(out)] }

export const store = reactive({
  pubBack: null,   // { path, label } — woher man aus der Publikation in den Pflegebaum kam (Schnellweg zurück, Taloan 21.09.)
  actor: saved.actor || '',
  // Die Oberfläche fragt immer den Server, der sie ausgeliefert hat (Taloan, 23.09.2026) — kein Feld, keine
  // gespeicherte Adresse. Was früher hier stand, wird beim Laden verworfen.
  server: '',
  theme: saved.theme || 'system',   // system | light | dark
  lang: saved.lang || null,          // Oberflächensprache der Person; null = die des Browsers (i18n.browserLang)
  viewLocales: saved.viewLocales || ['de', 'en'],   // erste Sprache: Bezeichnungen (store.name); die Spalten kommen aus viewCells
  // Spalten der Knotenansicht als Matrix Sprache × Kanal (Taloan, 20.09.): Liste „sprache|kanal“, '' = Stern; '|' (der eine Wert) ist immer dabei.
  // Alte Einstellungen (Sprachen × Kanäle) werden beim ersten Start übernommen.
  viewCells: saved.viewCells ?? cellsFrom(saved.viewLocales || ['de', 'en'], saved.viewChannels ?? (saved.viewChannel ? [saved.viewChannel] : [])),
  journalOpen: saved.journalOpen ?? true,           // Journal neben dem Knoten auf- oder zugeklappt
  lastNode: sessionStorage.getItem('journali.lastNode') || null,
  progress: null,        // { done, total, text } — laufender Stapel; Balken oben in der Oberfläche (App.vue)   // zuletzt gewählter Knoten — ▣ Baum in der Leiste kehrt dorthin zurück (Taloan, 18.09.)
  viewKey: (saved.viewKey && typeof saved.viewKey === 'object') ? saved.viewKey : {},   // gewählte Sicht je Knotentyp
  layout: saved.layout ?? 'flat',                    // flat | tabs
  // Umfang am Knoten (Taloan, 20.09.): 'all' = total (alles, was anliegt, gesperrtes sichtbar) · 'can' = auf dieser Ebene änderbar ·
  // 'only' = nur auf dieser Ebene änderbar (weder darüber noch darunter erlaubt). Drei Stufen, jede in der vorigen enthalten.
  scope: saved.scope ?? (saved.editableOnly ? 'can' : 'all'),
  attrNames: saved.attrNames ?? 'label',             // Attributnamen: label | key | both (Taloan: Vorlagen nutzen die Keys)
  railOrder: Array.isArray(saved.railOrder) ? saved.railOrder : null,   // Reihenfolge der Leiste links (Taloan: selbst sortieren), 'spacer' trennt oben/unten
  railOff: Array.isArray(saved.railOff) ? saved.railOff : [],   // Plugins, die nicht in der Leiste sind (Taloan, 19.09.: je Plugin einstellbar; aus = gar nicht in der Leiste, nur über ⌁ Plugins)
  undo: {},                                         // ↶/↷ je Knoten: id → { history, redo } — im Store, weil NodeView je Knoten neu gebaut wird (Taloan)
  pendingImport: null,                              // { file, parent } — JSON-Datei, die der JSON-Import gleich öffnen soll (Baum-Drop, Menü, Tabellenimport)
  attrFilter: '',                                   // Suchfeld im Knoten — bleibt beim Knotenwechsel (Taloan), nicht gespeichert
  collapsed: Array.isArray(saved.collapsed) ? saved.collapsed : ['axes', 'groups', 'versions'],   // Organisatorisches zu, bis der Anwender es anders will (Taloan, 20.09.)   // zugeklappte Abschnitte am Knoten (attributes, media, relations, …)
  online: null,          // null = noch nicht gefragt, sonst true/false
  // Anmeldung (Taloan, 19.09.): enabled = es gibt Benutzer (Server gesperrt), setup = noch keiner (ersten Admin anlegen), user/role aus der Sitzung
  auth: { known: false, enabled: false, setup: false, user: null, role: null, name: null, rights: null },
  // Darf ich das? Ohne Benutzer alles; sonst nach den Rechten der Rolle (Vokabular: read, write, retire, release, model, plugins, jobs, storage, users)
  can(right) { return !this.auth.enabled || !this.auth.user ? true : (this.auth.rights ?? []).includes(right) },
  head: 0,
  nodes: 0,
  usage: null,
  version: '',      // Fassung des Servers — steht oben in der Leiste
  build: '',        // Bau kurz: TTMM.hhmm
  builtAt: '',      // dasselbe lang, für den Tooltip
  model: null,           // { locales, channels, attributes } vom Server
  toasts: [],
  error: '',
  etag: null,           // ETag der index.html beim Laden — ändert er sich, liegt eine neue Fassung
  stale: false,

  // Name eines Attributs/einer Gruppe/einer Liste in der Anzeige: Bezeichnung in der ersten Sicht-Sprache (Fallback de, Key),
  // technischer Key, oder beides — je Einstellung attrNames
  label(def) {
    if (!def) return ''
    if (this.attrNames === 'key') return ''   // im Key-Modus steht nur der Key (die Ansicht zeigt ihn abgegraut daneben)
    return def.label?.[this.viewLocales?.[0]] || def.label?.de || Object.values(def.label ?? {}).find(Boolean) || def.key
  },
  // Status-Vokabular aus dem Modell (Taloan, 22.09.2026): Definition, Text in der Sicht-Sprache, Symbol; Farbe als Token (pos, neg, muted, warn, accent)
  status(key) { return (this.model?.statuses ?? []).find(s => s.key === key) ?? null },
  statusLabel(key) { const s = this.status(key); return s ? (s.label?.[this.viewLocales?.[0]] || s.label?.de || Object.values(s.label ?? {}).find(Boolean) || s.key) : (key ?? '') },
  statusText(key) { const s = this.status(key); return s ? `${s.icon ? s.icon + ' ' : ''}${this.statusLabel(key)}` : (key ?? '') },
  statusStyle(key) { const s = this.status(key); return s?.color ? `color:var(--${s.color})` : '' },
  name(def) {
    if (!def) return ''
    const label = def.label?.[this.viewLocales?.[0]] || def.label?.de || Object.values(def.label ?? {}).find(Boolean) || def.key
    return this.attrNames === 'key' ? def.key : this.attrNames === 'both' ? `${label} ⟨${def.key}⟩` : label
  },
  save() {
    localStorage.setItem('journali.settings', JSON.stringify({ actor: this.actor, theme: this.theme, lang: this.lang, viewLocales: this.viewLocales, viewCells: this.viewCells, journalOpen: this.journalOpen, viewKey: this.viewKey, layout: this.layout, scope: this.scope, attrNames: this.attrNames, railOrder: this.railOrder, railOff: this.railOff, collapsed: this.collapsed }))
    this.applyTheme()
    this.savePrefs()
  },

  // Eigene Einstellungen zum Benutzer schreiben — gesammelt, nicht bei jedem Tastendruck; nur was sich geändert hat.
  // Ohne Anmeldung gibt es keinen Benutzer: dann bleibt es beim Browser.
  _prefsSent: null,
  _prefsTimer: null,
  savePrefs() {
    if (!this.auth.enabled || !this.auth.user) return
    const now = Object.fromEntries(USER_PREFS.map(k => [k, JSON.stringify(this[k] ?? null)]))
    const changed = Object.fromEntries(Object.entries(now).filter(([k, v]) => v !== this._prefsSent?.[k]))
    if (!Object.keys(changed).length) return
    this._prefsSent = now
    clearTimeout(this._prefsTimer)
    this._prefsTimer = setTimeout(() => { api.post('/api/auth/me/prefs', { prefs: changed }, 'PUT').catch(() => { this._prefsSent = null }) }, 400)
  },
  // Was am Benutzer steht, gilt — er hat es zuletzt irgendwo gesetzt (Werte sind JSON als Text)
  applyPrefs(prefs) {
    if (!prefs) return
    for (const k of USER_PREFS) {
      if (!(k in prefs)) continue
      try { const v = JSON.parse(prefs[k]); if (v !== null) this[k] = v } catch {}
    }
    this._prefsSent = Object.fromEntries(USER_PREFS.map(k => [k, JSON.stringify(this[k] ?? null)]))
    this.applyTheme()
    this.applyLang()
  },

  /// Oberflächensprache setzen: gewählt oder die des Browsers; die Sprachdatei holt i18n.setLang
  setLang(code) { this.lang = code; this.save(); this.savePrefs(); this.applyLang() },
  applyLang() { import('./i18n.js').then(m => m.setLang(this.lang || m.browserLang())) },

  applyTheme() {
    if (this.theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = this.theme
  },

  async loadAuth() {
    try {
      const s = await api.get('/api/auth/state'); this.auth = { known: true, ...s }
      if (s.enabled && s.user) { this.actor = s.user; this.applyPrefs(s.prefs) }   // die Einstellungen der Person schlagen die des Browsers
    } catch { this.auth = { ...this.auth, known: true } }
    // Was das Team an KI stellt (Taloan, 23.09.): Schlüssel am Team → der Server fragt für uns
    try { const { ai } = await import('./ai.js'); await ai.loadState() } catch {}
    return this.auth
  },
  async logout() { try { await api.post('/api/auth/logout', {}) } catch {} this._prefsSent = null; this.auth = { known: true, enabled: true, setup: false, user: null, role: null, name: null } },

  async poll(force = false) {
    try {
      const h = await api.get('/api/health')
      this.online = true
      const changed = h.head !== this.head
      this.head = h.head
      this.nodes = h.nodes
      this.usage = h.usage ?? null   // Nutzung für die Statusleiste (Taloan, 22.09.)
      // Fassung und Bau (Taloan, 23.09.): kurz oben, lang im Tooltip
      this.version = h.version ?? ''
      if (h.built) {
        const d = new Date(h.built)
        const zz = n => String(n).padStart(2, '0')
        this.build = `${zz(d.getDate())}${zz(d.getMonth() + 1)}.${zz(d.getHours())}${zz(d.getMinutes())}`
        this.builtAt = d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      }
      // der Stand des Teams — einmal je Minute, nicht bei jedem Puls: andere im Team verbrauchen auch (Taloan, 23.09.)
      if (this.auth.enabled && this.auth.user && Date.now() - (this._aiAt ?? 0) > 60000) {
        this._aiAt = Date.now()
        import('./ai.js').then(({ ai }) => ai.loadState()).catch(() => {})
      }
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
    this.loadAuth()
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
    // lange Meldungen (Listen) gehören in ein Fenster mit Scrollbar, nicht in einen Toast (Taloan, 21.09.: „in den paar Sekunden lesen?“)
    if (kind === 'error' && (String(text).length > 160 || String(text).includes('\n')) && this.longError) { this.longError(String(text)); return }
    const t = { id: Date.now() + Math.random(), text, kind, action }
    this.toasts.push(t)
    setTimeout(() => { const i = this.toasts.indexOf(t); if (i >= 0) this.toasts.splice(i, 1) }, action ? 12000 : 4000)
  },
  dismiss(t) { const i = this.toasts.indexOf(t); if (i >= 0) this.toasts.splice(i, 1) },
})
