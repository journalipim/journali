// Modell-Zurückziehen rückgängig (Taloan, 20.09.2026): ein „…Retired“ wird nie gelöscht, sondern kompensiert — die letzte Definition
// vor dem Zurückziehen steht im Strom und wird noch einmal geschrieben. Wertelisten bekommen ihre Werte mit (Stand beim Zurückziehen).
// Benutzt vom Journal (Knopf am Eintrag) und vom Modell (↶ im Listenkopf: die letzten bis zu 5 je Bereich).
import { api } from './api.js'
import { store } from './store.js'

export const MODEL_RETIRE = {
  AttributeRetired: { kind: 'attributes', defined: 'AttributeDefined', path: k => `/api/model/attributes/${k}`, has: (m, k) => m.attributes.some(a => a.key === k) },
  AttributeGroupRetired: { kind: 'groups', defined: 'AttributeGroupDefined', path: k => `/api/model/groups/${k}`, has: (m, k) => m.groups.some(g => g.key === k && g.defined !== false) },
  ListRetired: { kind: 'lists', defined: 'ListDefined', path: k => `/api/model/lists/${k}`, has: (m, k) => m.lists.some(l => l.key === k), values: true },
  ViewRetired: { kind: 'views', defined: 'ViewDefined', path: k => `/api/model/views/${k}`, has: (m, k) => m.views.some(v => v.key === k) },
  UnitRetired: { kind: 'units', defined: 'UnitDefined', path: k => `/api/model/units/${encodeURIComponent(k)}`, has: (m, k) => m.units.some(u => u.key === k) },
  RelationTypeRetired: { kind: 'relationTypes', defined: 'RelationTypeDefined', path: k => `/api/model/relations/${k}`, has: (m, k) => m.relationTypes.some(r => r.key === k) },
  LocaleRetired: { kind: 'locales', defined: 'LocaleDefined', path: k => `/api/model/locales/${k}`, has: (m, k) => m.locales.some(l => l.code === k) },
  ChannelRetired: { kind: 'channels', defined: 'ChannelDefined', path: k => `/api/model/channels/${k}`, has: (m, k) => m.channels.some(c => c.key === k) },
}
export const modelKey = stream => stream.slice(stream.indexOf(':') + 1)
export const canRestoreModel = e => { const r = MODEL_RETIRE[e.type]; return !!r && !!store.model && !r.has(store.model, modelKey(e.stream)) }

/// Wer darf was wiederherstellen: ohne Benutzer alle; admin alles; sonst nur, was man selbst zurückgezogen hat
export const mayRestore = e => !store.auth?.enabled || store.auth.role === 'admin' || e.actor === store.auth.user

/// Die letzten bis zu n zurückgezogenen eines Bereichs (nur, was im Modell noch fehlt), gefiltert nach Recht
export async function recentRetired(kind, limit = 5) {
  const list = await api.get(`/api/model/retired?kind=${encodeURIComponent(kind)}&limit=${limit * 2}`)
  return list.filter(mayRestore).slice(0, limit)
}

export async function restoreModel(e) {
  const r = MODEL_RETIRE[e.type]; const key = modelKey(e.stream)
  const before = (await api.get(`/api/streams/${encodeURIComponent(e.stream)}`)).filter(x => x.number < e.number)
  const def = [...before].reverse().find(x => x.type === r.defined)
  if (!def) throw new Error(`${key}: keine Definition im Strom`)
  await api.post(r.path(key), def.payload, 'PUT')
  if (r.values) {   // Werte der Liste, Stand beim Zurückziehen: Defined/Retired der Reihe nach
    const vals = new Map(); for (const x of before) { if (x.type === 'ListValueDefined') vals.set(x.payload.value, x.payload); else if (x.type === 'ListValueRetired') vals.delete(x.payload.value) }
    for (const v of vals.values()) await api.post(`/api/model/lists/${key}/values/${encodeURIComponent(v.value)}`, v, 'PUT')
  }
  await store.poll(true)
  return key
}
