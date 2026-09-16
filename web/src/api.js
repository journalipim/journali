import { store } from './store.js'

// Alle Aufrufe gehen hier durch: Server aus den Einstellungen, X-Actor im Kopf,
// Fehler als Text aus { error } des Servers.
async function request(method, path, body) {
  const headers = { 'X-Actor': store.actor }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res
  try {
    res = await fetch(store.server + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new Error('Server nicht erreichbar')
  }
  if (res.status === 204) return null
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`)
  return data
}

export const api = {
  get: (path) => request('GET', path),
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
    case 'ListDefined': return `${p.key}: ${p.label?.de ?? ''}`
    case 'ListValueDefined': return `+ ${p.value}${p.label?.de ? ' = ' + p.label.de : ''}`
    case 'ListValueRetired': return `− ${p.value}`
    case 'UnitDefined': return `⚖ ${p.key} = ${p.factor} ${p.quantity}`
    case 'ViewDefined': return `◫ ${p.key}${p.level ? ' (' + p.level + ')' : ''}: ${(p.attributes || []).map(a => a.key).join(', ')}`
    case 'ViewRetired': return `− ◫ ${p.key}`
    case 'UnitRetired': return `− ⚖ ${p.key}`
    case 'FamilyDefined': return `${p.key}: ${(p.attributes || []).map(a => a.key).join(', ')}`
    case 'LocaleDefined': return `${p.code} = ${p.label}`
    case 'GroupCreated': return `▣ ${p.label?.de ?? ''}${p.parent ? ' unter ' + p.parent : ' (Wurzel)'}`
    case 'GroupRenamed': return `▣ ${p.label?.de ?? ''}`
    case 'ProductCreated': return `▦ ${p.family} unter ${p.group}${p.axes?.length ? ' · ' + p.axes.join(', ') : ''}`
    case 'VariantCreated': return `◆ ${Object.entries(p.axisValues || {}).map(([k, v]) => k + '=' + v).join(', ') || 'ohne Achsen'} unter ${p.product}`
    case 'NodeMoved': return `→ ${p.parent}`
    case 'NodeRetired': return '− Knoten'
    case 'StatusSet': return `Status ${p.status}`
    case 'ExternalLinked': return `⇩ ${p.system}: ${p.id}`
    case 'RowAdded': return `+ Zeile ${p.attribute} ${p.row}`
    case 'RowRemoved': return `− Zeile ${p.attribute} ${p.row}`
    case 'RowOrdered': return `↕ ${p.attribute}`
    case 'ExternalUnlinked': return `− ${p.system}`
    case 'ChannelDefined': return `${p.key} = ${p.label?.de ?? ''}`
    case 'CategoryAssigned': return `+ ${p.category}`
    case 'CategoryRemoved': return `− ${p.category}`
    case 'ReleaseGranted': return `✓ ${p.channel}${p.locale ? '/' + p.locale : ''}`
    case 'ReleaseRevoked': return `✗ ${p.channel}${p.locale ? '/' + p.locale : ''}`
    default: return JSON.stringify(p)
  }
}
