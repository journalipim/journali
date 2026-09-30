import { store } from './store.js'
import { t } from './i18n.js'
import { L } from './i18n.js'

// Alle Aufrufe gehen hier durch: Server aus den Einstellungen, X-Actor im Kopf,
// Fehler als Text aus { error } des Servers — mit { template, args } übersetzt in die Oberflächensprache.
/// Meldung des Servers in der Sprache der Oberfläche: die Vorlage ist der Schlüssel, die Werte füllen {0}, {1} …
export const serverText = d => d?.template ? t(d.template, d.args ?? []) : d?.error ?? d?.message
async function request(method, path, body) {
  const headers = { 'X-Actor': store.actor }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res
  try {
    res = await fetch(store.server + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new Error(t('Server nicht erreichbar'))
  }
  if (res.status === 204) return null
  const text = await res.text()
  // HTML statt JSON = der Server kennt diesen Pfad nicht und liefert die Oberfläche aus — fast immer eine alte Serverfassung.
  if (text.trimStart().startsWith('<')) throw new Error(t('Server kennt {0} {1} nicht', [method, path.split('?')[0]]))
  // kein JSON (Ausnahme oder 400 als Text vom Server): die erste Zeile als Meldung, nicht „Unexpected token“
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { throw new Error(`${res.status}: ${text.split(/\r?\n/)[0].slice(0, 200)}`) }
  // 401 mit login: Sitzung fehlt oder abgelaufen — zur Anmeldung, der Weg zurück wird gemerkt
  if (res.status === 401 && data?.login && !location.pathname.startsWith('/login')) { sessionStorage.setItem('journali.after', location.pathname + location.search); store.auth = { ...store.auth, known: true, enabled: true, user: null, role: null }; (await import('./router.js')).router.push('/login') }
  // Datenbank weg: oben anzeigen, bis wieder eine Anfrage durchgeht
  if (res.status === 503 && data?.db === false) store.dbDown = true
  else if (res.ok) store.dbDown = false
  if (!res.ok) throw new Error(serverText(data) || `${res.status} ${res.statusText}`)
  return data
}

export const api = {
  get: (path) => request('GET', path),
  // Grosser Stapel in Happen: je Happen ein POST /api/batch, dazwischen
  // Fortschritt (store.progress + onProgress). Refs (@n1) aus früheren Happen werden vor dem Senden durch die echten
  // Ids ersetzt — der Server kennt Refs nur innerhalb eines Aufrufs. Liefert dieselbe Form wie ein einzelner Stapel.
  // Solange ein Stapel läuft, warnt der Browser vor dem Schliessen (beforeunload); was gesendet ist, schreibt der Server zu Ende.
  // continueOnError: der fehlgeschlagene Befehl wird übersprungen (errors[] sammelt sie), der Rest wird geschrieben —
  // sonst verliert ein Import wegen EINES Fehlers alles danach. Das Überspringen
  // macht der Server (?skipErrors=true) — ein Aufruf je Happen, nicht eine Runde je Fehler.
  // maxErrorPercent (Regel im Import-Profil): scheitern mehr als so viel Prozent der bisher gesendeten Befehle (ab 5 Fehlern), wird abgebrochen
  batchChunked: async (commands, { batch = null, size = 500, onProgress = null, label = 'schreibe', continueOnError = false, maxErrorPercent = 0 } = {}) => {
    const refs = new Map()
    const results = []; let error = null; let batchId = batch; const errors = []
    const REF_KEYS = ['node', 'parent', 'group', 'product', 'from', 'to', 'relation', 'media']
    const sub = c => { const a = { ...c.args }; for (const k of REF_KEYS) if (typeof a[k] === 'string' && a[k].startsWith('@') && refs.has(a[k].slice(1))) a[k] = refs.get(a[k].slice(1)); return { ...c, args: a } }
    const guard = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    store.progress = { done: 0, total: commands.length, text: label }
    try {
      let i = 0
      while (i < commands.length) {
        const end = Math.min(i + size, commands.length)
        const chunk = commands.slice(i, end).map(sub)
        const res = await request('POST', '/api/batch' + (continueOnError ? '?skipErrors=true' : ''), { commands: chunk, batch: batchId })
        batchId = res.batch
        for (const r of res.results) { results.push({ ...r, index: r.index + i }); if (r.ref) refs.set(r.ref, r.node) }
        for (const s of res.skipped ?? []) errors.push({ ...s, message: serverText(s), index: s.index + i, command: commands[s.index + i] })
        if (!res.error && maxErrorPercent > 0 && errors.length >= 5 && errors.length * 100 / Math.max(1, end) > maxErrorPercent) { const last = errors[errors.length - 1]; error = { ...last, message: t('Fehleranteil über {0} % ({1} von {2}) — abgebrochen: {3}', [maxErrorPercent, errors.length, end, last.message]) }; break }
        if (res.error) {
          const at = i + res.error.index
          const e = { ...res.error, message: serverText(res.error), index: at, command: commands[at] }
          if (!continueOnError) { error = e; break }
          errors.push(e); i = at + 1   // den einen überspringen, hinter ihm weiter
          if (maxErrorPercent > 0 && errors.length >= 5 && errors.length * 100 / Math.max(1, i) > maxErrorPercent) { error = { ...e, message: t('Fehleranteil über {0} % ({1} von {2}) — abgebrochen: {3}', [maxErrorPercent, errors.length, i, e.message]) }; break }
        } else i = end
        store.progress = { done: i, total: commands.length, text: label + (errors.length ? ' ' + t('· {0} Fehler', [errors.length]) : '') }
        onProgress?.(store.progress)
      }
    } finally { window.removeEventListener('beforeunload', guard); store.progress = null }
    return { batch: batchId, results, error, errors, refs }
  },
  /// Datei hochladen (multipart, Feld file) — X-Actor wie bei jedem Befehl.
  /// fields: weitere Formularfelder — die Herkunft beim Anlegen (from, plugin, profile, job, ref)
  upload: async (path, file, fields = null) => {
    const fd = new FormData(); fd.append('file', file, file.name)
    for (const [k, v] of Object.entries(fields ?? {})) if (v != null && v !== '') fd.append(k, String(v))
    let res
    try { res = await fetch(store.server + path, { method: 'POST', headers: { 'X-Actor': store.actor }, body: fd }) } catch { throw new Error(t('Server nicht erreichbar')) }
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(serverText(data) || `${res.status} ${res.statusText}`)
    return data
  },
  post: (path, body, method = 'POST') => request(method, path, body),
  del: (path) => request('DELETE', path),
}

export function when(iso) {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return today
    ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/// Eintrag in einer Zeile: Typ + die Achsen + Wert, wie im Journal-Fenster.
export function describe(e) {
  const p = e.payload || {}
  const axis = [p.locale, p.channel].filter(Boolean).join('/')
  switch (e.type) {
    case 'AttributeSet': return `${p.attribute}${axis ? ' ' + axis : ''}${p.row ? ' [' + p.row + ']' : ''} = ${p.values ? p.values.join(', ') : (p.value == null || p.value === '' ? '∅' : String(p.value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80))}`
    case 'AttributeDefined': return `${p.key}: ${p.type}${p.unit ? ' ' + p.unit : ''}${p.axes?.length ? ' [' + p.axes.join(',') + ']' : ''}${p.list ? ' ← ' + p.list : ''}${p.multiple ? ' ≣' : ''}`
    case 'AttributeRetired': case 'FamilyRetired': return `− ${p.key}`
    case 'ListDefined': return `${p.key}: ${L(p.label) ?? ''}`
    case 'ListValueDefined': return `+ ${p.value}${L(p.label) ? ' = ' + L(p.label) : ''}`
    case 'ListValueRetired': return `− ${p.value}`
    case 'UnitDefined': return `⚖ ${p.key} = ${p.factor}${p.offset ? (p.offset < 0 ? ' − ' : ' + ') + Math.abs(p.offset) : ''} ${p.quantity}`
    case 'ViewDefined': return `◫ ${p.key}${p.level ? ' (' + p.level + ')' : ''}: ${(p.items || []).map(it => it.group ? '▤' + it.group : it.key).join(', ')}`
    case 'AttributeGroupDefined': return `▤ ${p.key}: ${(p.order || []).join(', ')}`
    case 'AttributeGroupRetired': return `− ▤ ${p.key}`
    case 'ViewRetired': return `− ◫ ${p.key}`
    case 'UnitRetired': return `− ⚖ ${p.key}`
    case 'ListRetired': return `− ☰ ${p.key}`
    case 'LocaleRetired': return `− 🗣 ${p.code}`
    case 'ChannelRetired': return `− ⇶ ${p.key}`
    case 'FamilyDefined': return `${p.key}: ${(p.attributes || []).map(a => a.key).join(', ')}`
    case 'LocaleDefined': return `${p.code} = ${p.label}`
    case 'GroupCreated': return `▣ ${p.name ?? L(p.label) ?? ''}${p.parent ? ' unter ' + p.parent : ' (Wurzel)'}`
    case 'GroupRenamed': return `▣ ${L(p.label) ?? ''}`
    case 'ProductAxesSet': return t('◆ variiert nach {0}', [(p.axes || []).join(', ') || 'nichts'])
    case 'PluginInstalled': return `⬡ ${p.version}`
    case 'PluginEnabled': return '⬡ ● an'
    case 'PluginDisabled': return '⬡ ○ aus'
    case 'PluginRemoved': return '− ⬡'
    case 'MediaCreated': return `🖼 ${p.name} · ${p.mime} · ${p.bytes} B`
    case 'MediaRetired': return t('− 🖼 Medium')
    case 'RelationCreated': return `⇄ ${p.type}: ${p.from} → ${p.to}`
    case 'RelationRetired': return t('− ⇄ Relation')
    case 'RelationTypeDefined': return `⇄ ${p.key}: ${L(p.label) ?? ''}${L(p.reverse) ? ' / ' + L(p.reverse) : ''}${p.group ? ' ▤' + p.group : ''}`
    case 'RelationTypeRetired': return `− ⇄ ${p.key}`
    case 'MasterLocaleDefined': return t('★ Mastersprache {0}', [p.code])
    case 'MasterChannelDefined': return t('★ Masterkanal {0}', [p.key])
    case 'SkuAttributeDefined': return t('🏷 Kennung {0} (ausser Kraft)', [p.key])
    case 'NodeNamed': return p.name ? `✎ ${p.name}` : t('✎ ∅ → Automatik')
    case 'LabelAttributeSet': return p.attribute ? `★ ${p.attribute}` : t('★ ∅ → von oben')
    case 'ProductCreated': return `▦ ${p.family ?? 'Produkt'} unter ${p.group}${p.axes?.length ? ' · ' + p.axes.join(', ') : ''}`   // family ist Altlast, meist null
    case 'VariantCreated': return `◆ ${Object.entries(p.axisValues || {}).map(([k, v]) => k + '=' + v).join(', ') || 'ohne Achsen'} unter ${p.product}`
    case 'NodeMoved': return `→ ${p.parent}`
    case 'NodeRetired': return t('− Knoten')
    case 'StatusSet': return t('Status {0}', [p.status])
    case 'ExternalLinked': return `⇩ ${p.system}: ${p.id}`
    case 'RowAdded': return t('+ Zeile {0} {1}', [p.attribute, p.row])
    case 'RowRemoved': return t('− Zeile {0} {1}', [p.attribute, p.row])
    case 'RowOrdered': return `↕ ${p.attribute}`
    case 'ExternalUnlinked': return `− ${p.system}`
    case 'ChannelDefined': return `${p.key} = ${L(p.label) ?? ''}`
    case 'CategoryAssigned': return `+ ${p.category}`
    case 'CategoryRemoved': return `− ${p.category}`
    case 'ReleaseGranted': return `✓ ${p.channel}${p.locale ? '/' + p.locale : ''}`
    case 'ReleaseRevoked': return `✗ ${p.channel}${p.locale ? '/' + p.locale : ''}`
    default: return JSON.stringify(p)
  }
}
