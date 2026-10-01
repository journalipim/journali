import { reactive } from 'vue'
import { api } from './api.js'
import { setLang, browserLang, L } from './i18n.js'   // Oberflächensprache (24.09.2026); L = Bezeichnung des Modells in ihr

// Ein Zustand für die ganze Oberfläche. Einstellungen liegen im localStorage,
// der Serverstand (head) wird alle 3 s abgefragt — darauf hängen Live-Listen.
const saved = JSON.parse(localStorage.getItem('journali.settings') || '{}')

// Was der Person folgt und nicht dem Gerät:
// Darstellung, Sichtsprachen, Zellen, Sicht je Knotentyp, Anordnung, Umfang, Attributnamen. Sie stehen am Benutzer im
// Journal (UserPrefsSet) und kommen mit der Anmeldung an jedem Rechner mit. Alles andere ist Fensterzustand und bleibt
// im Browser: Serveradresse, Journal auf/zu, zugeklappte Abschnitte, Reihenfolge der Leiste, zuletzt gewählter Knoten.
const USER_PREFS = ['theme', 'lang', 'viewLocales', 'viewCells', 'viewKey', 'layout', 'scope', 'attrNames', 'bookmarks']   // bookmarks: Lesezeichen auf Knoten (01.10.2026)
/// So viele Lesezeichen hat eine Person höchstens: der Wert am Benutzer hat 4 000 Zeichen, eine Kennung braucht bis zu 16
export const MAX_BOOKMARKS = 150   // lang: Oberflächensprache (24.09.2026)

// Sprachen × Kanäle als Zellenliste (Stern je Achse dazu)
function cellsFrom(locales, channels) { const out = ['|']; for (const c of ['', ...channels]) for (const l of ['', ...locales]) out.push(`${l}|${c}`); return [...new Set(out)] }

export const store = reactive({
  pubBack: null,   // { path, label } — woher man aus der Publikation in den Pflegebaum kam (Schnellweg zurück)
  actor: saved.actor || '',
  // Die Oberfläche fragt immer den Server, der sie ausgeliefert hat — kein Feld, keine
  // gespeicherte Adresse. Was früher hier stand, wird beim Laden verworfen.
  server: '',
  theme: saved.theme || 'system',   // system | light | dark
  lang: saved.lang || null,          // Oberflächensprache der Person; null = die des Browsers (i18n.browserLang)
  viewLocales: saved.viewLocales || ['de', 'en'],   // erste Sprache: Bezeichnungen (store.name); die Spalten kommen aus viewCells
  // Spalten der Knotenansicht als Matrix Sprache × Kanal: Liste „sprache|kanal“, '' = Stern; '|' (der eine Wert) ist immer dabei.
  // Alte Einstellungen (Sprachen × Kanäle) werden beim ersten Start übernommen.
  viewCells: saved.viewCells ?? cellsFrom(saved.viewLocales || ['de', 'en'], saved.viewChannels ?? (saved.viewChannel ? [saved.viewChannel] : [])),
  journalOpen: saved.journalOpen ?? true,           // Journal neben dem Knoten auf- oder zugeklappt
  lastNode: sessionStorage.getItem('journali.lastNode') || null,
  progress: null,        // { done, total, text } — laufender Stapel; Balken oben in der Oberfläche (App.vue)   // zuletzt gewählter Knoten — ▣ Baum in der Leiste kehrt dorthin zurück
  viewKey: (saved.viewKey && typeof saved.viewKey === 'object') ? saved.viewKey : {},   // gewählte Sicht je Knotentyp
  layout: saved.layout ?? 'flat',                    // flat | tabs
  // Umfang am Knoten: 'all' = total (alles, was anliegt, gesperrtes sichtbar) · 'can' = auf dieser Ebene änderbar ·
  // 'only' = nur auf dieser Ebene änderbar (weder darüber noch darunter erlaubt). Drei Stufen, jede in der vorigen enthalten.
  scope: saved.scope ?? (saved.editableOnly ? 'can' : 'all'),
  attrNames: saved.attrNames ?? 'label',             // Attributnamen: label | key | both
  bookmarks: Array.isArray(saved.bookmarks) ? saved.bookmarks.filter(x => typeof x === 'string') : [],   // Lesezeichen: Kennungen der Knoten, in der Reihenfolge des Setzens
  railOrder: Array.isArray(saved.railOrder) ? saved.railOrder : null,   // Reihenfolge der Leiste links, 'spacer' trennt oben/unten
  railOff: Array.isArray(saved.railOff) ? saved.railOff : [],   // Plugins, die nicht in der Leiste sind
  undo: {},                                         // ↶/↷ je Knoten: id → { history, redo } — im Store, weil NodeView je Knoten neu gebaut wird
  pendingImport: null,                              // { file, parent } — JSON-Datei, die der JSON-Import gleich öffnen soll (Baum-Drop, Menü, Tabellenimport)
  pendingDocTables: null,                           // { node, media: [ids] } — Strg-Drop im Baum: die Knotenansicht öffnet den Dialog „Tabellen aus dem Dokument“
  attrFilter: '',                                   // Suchfeld im Knoten — bleibt beim Knotenwechsel, nicht gespeichert
  collapsed: Array.isArray(saved.collapsed) ? saved.collapsed : ['axes', 'groups', 'versions'],   // Organisatorisches zu, bis der Anwender es anders will   // zugeklappte Abschnitte am Knoten (attributes, media, relations, …)
  online: null,          // null = noch nicht gefragt, sonst true/false
  // Anmeldung: enabled = es gibt Benutzer (Server gesperrt), setup = noch keiner (ersten Admin anlegen), user/role aus der Sitzung
  auth: { known: false, enabled: false, setup: false, user: null, role: null, name: null, rights: null },
  dbDown: false,   // Datenbank im Betrieb nicht erreichbar (503 mit db: false)
  tarif: null,     // { key, label, schedules } aus /api/health
  // beim Lizenzserver registriert? undefined = noch nichts vom Server gehört, null = noch niemand gefragt, sonst die
  // Antwort. Der Unterschied zählt: mit null als Anfangswert fragte der Dialog bei jedem Laden, bevor /api/health
  // antwortete — auch bei einer längst registrierten Anlage (26.09.2026).
  registriert: undefined,
  // Darf ich das? Ohne Benutzer alles; sonst nach den Rechten der Rolle (Vokabular: read, write, retire, release, model, plugins, jobs, storage, users)
  can(right) { return !this.auth.enabled || !this.auth.user ? true : (this.auth.rights ?? []).includes(right) },
  head: 0,
  /// Wo dieser Anwender gerade steht (ein Knoten, eine Ansicht) — geht mit dem Puls hinaus
  ort: null,
  /// Wer sonst noch dort ist: [{ key, name }] — vom Server, alle 3 s frisch
  presence: [],
  nodes: 0,
  usage: null,
  version: '',      // Version des Servers — steht oben in der Leiste
  build: '',        // Bau kurz: TTMM.hhmm
  builtAt: '',      // dasselbe lang, für den Tooltip
  model: null,           // { locales, channels, attributes } vom Server
  toasts: [],
  error: '',
  etag: null,           // ETag der index.html beim Laden — ändert er sich, liegt eine neue Version
  stale: false,

  // Name eines Attributs/einer Gruppe/einer Liste in der Anzeige: Bezeichnung in der Oberflächensprache, technischer Key, oder beides — je attrNames
  label(def) {
    if (!def) return ''
    if (this.attrNames === 'key') return ''   // im Key-Modus steht nur der Key (die Ansicht zeigt ihn abgegraut daneben)
    return L(def.label) || def.key
  },
  // Status-Vokabular aus dem Modell: Definition, Text in der Sicht-Sprache, Symbol; Farbe als Token (pos, neg, muted, warn, accent)
  status(key) { return (this.model?.statuses ?? []).find(s => s.key === key) ?? null },
  statusLabel(key) { const s = this.status(key); return s ? (L(s.label) || s.key) : (key ?? '') },
  statusText(key) { const s = this.status(key); return s ? `${s.icon ? s.icon + ' ' : ''}${this.statusLabel(key)}` : (key ?? '') },
  statusStyle(key) { const s = this.status(key); return s?.color ? `color:var(--${s.color})` : '' },
  name(def) {
    if (!def) return ''
    const label = L(def.label) || def.key
    return this.attrNames === 'key' ? def.key : this.attrNames === 'both' ? `${label} ⟨${def.key}⟩` : label
  },
  save() {
    localStorage.setItem('journali.settings', JSON.stringify({ actor: this.actor, theme: this.theme, lang: this.lang, viewLocales: this.viewLocales, viewCells: this.viewCells, journalOpen: this.journalOpen, viewKey: this.viewKey, layout: this.layout, scope: this.scope, attrNames: this.attrNames, bookmarks: this.bookmarks, railOrder: this.railOrder, railOff: this.railOff, collapsed: this.collapsed }))
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

  /// Lesezeichen: ein Knoten, den die Person wiederfinden will. Sie stehen am Benutzer (mit der Anmeldung an jedem Rechner), ohne Anmeldung im Browser.
  isBookmarked(id) { return this.bookmarks.includes(id) },
  /// Setzt oder entfernt das Lesezeichen; liefert den Zustand danach, oder null, wenn die Höchstzahl erreicht ist
  toggleBookmark(id) {
    const i = this.bookmarks.indexOf(id)
    if (i >= 0) this.bookmarks.splice(i, 1)
    else { if (this.bookmarks.length >= MAX_BOOKMARKS) return null; this.bookmarks.push(id) }
    this.save()
    return i < 0
  },

  /// Oberflächensprache setzen: gewählt oder die des Browsers; die Sprachdatei holt i18n.setLang
  setLang(code) { this.lang = code; this.save(); this.savePrefs(); this.applyLang() },
  applyLang() { setLang(this.lang || browserLang()) },

  applyTheme() {
    if (this.theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = this.theme
  },

  async loadAuth() {
    try {
      const s = await api.get('/api/auth/state'); this.auth = { known: true, ...s }
      if (s.enabled && s.user) { this.actor = s.user; this.applyPrefs(s.prefs) }   // die Einstellungen der Person schlagen die des Browsers
    } catch { this.auth = { ...this.auth, known: true } }
    // Was das Team an KI stellt: Schlüssel am Team → der Server fragt für uns
    try { const { ai } = await import('./ai.js'); await ai.loadState() } catch {}
    return this.auth
  },
  async logout() { try { await api.post('/api/auth/logout', {}) } catch {} this._prefsSent = null; this.auth = { known: true, enabled: true, setup: false, user: null, role: null, name: null } },

  async poll(force = false) {
    try {
      const h = await api.get('/api/health' + (this.ort ? `?ort=${encodeURIComponent(this.ort)}` : ''))
      this.online = true
      // Ohne Sitzung kommt nur Version und Bau (abgemeldet: true, kein Journalstand): nichts von einer früheren Anmeldung bleibt stehen, und das Modell wird nicht geholt (401)
      if (h.abgemeldet === true) {
        this.head = null; this.nodes = null; this.usage = null; this.presence = []; this.tarif = null; this.registriert = null; this.model = null
        this.version = h.version ?? ''
        if (h.built) { const d = new Date(h.built); const zz = n => String(n).padStart(2, '0'); this.build = `${zz(d.getDate())}${zz(d.getMonth() + 1)}.${zz(d.getHours())}${zz(d.getMinutes())}`; this.builtAt = d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
        this.error = ''
        return
      }
      const changed = h.head !== this.head
      this.head = h.head
      this.nodes = h.nodes
      this.usage = h.usage ?? null   // Nutzung für die Statusleiste
      this.presence = h.presence ?? []   // wer sonst noch dort ist, wo dieser Anwender steht
      this.tarif = h.tarif ?? null   // Tarif der Instanz: was die Oberfläche überhaupt anbietet
      this.registriert = h.registriert ?? null   // beim Lizenzserver: null = noch nicht gefragt
      // Version und Bau: kurz oben, lang im Tooltip
      this.version = h.version ?? ''
      if (h.built) {
        const d = new Date(h.built)
        const zz = n => String(n).padStart(2, '0')
        this.build = `${zz(d.getDate())}${zz(d.getMonth() + 1)}.${zz(d.getHours())}${zz(d.getMinutes())}`
        this.builtAt = d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      }
      // der Stand des Teams — einmal je Minute, nicht bei jedem Puls: andere im Team verbrauchen auch
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

  // Neue Version der Oberfläche? index.html ohne Cache holen und den ETag vergleichen.
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
    // lange Meldungen (Listen) gehören in ein Fenster mit Scrollbar, nicht in einen Toast
    if (kind === 'error' && (String(text).length > 160 || String(text).includes('\n')) && this.longError) { this.longError(String(text)); return }
    const t = { id: Date.now() + Math.random(), text, kind, action }
    this.toasts.push(t)
    setTimeout(() => { const i = this.toasts.indexOf(t); if (i >= 0) this.toasts.splice(i, 1) }, action ? 12000 : 4000)
  },
  dismiss(t) { const i = this.toasts.indexOf(t); if (i >= 0) this.toasts.splice(i, 1) },
})
