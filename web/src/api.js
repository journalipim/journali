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
  post: (path, body) => request('POST', path, body),
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
    case 'AttributeSet': return `${p.attribute}${axis ? ' ' + axis : ''} = ${p.value}`
    case 'CategoryAssigned': return `+ ${p.category}`
    case 'CategoryRemoved': return `− ${p.category}`
    case 'ReleaseGranted': return `✓ ${p.channel}${p.locale ? '/' + p.locale : ''}`
    case 'ReleaseRevoked': return `✗ ${p.channel}${p.locale ? '/' + p.locale : ''}`
    default: return JSON.stringify(p)
  }
}
