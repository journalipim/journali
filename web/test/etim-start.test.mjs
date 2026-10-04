// ETIM beim Start (04.10.2026): vorher kamen bei jedem Seitenaufruf alle Klassen der Freigabe (gemessen 74 MB), der Baum ein zweites Mal und je Wurzel
// eine Tabelle. Jetzt: wo Klassen zugewiesen sind (/api/values/class_etim), und nur diese Klassen, einzeln. Die ganze Freigabe erst beim Suchen.
import test from 'node:test'
import assert from 'node:assert/strict'

const gefragt = []
const DATA = {
  settings: {}, release: { version: '10.0', number: 1, variant: 'ALL' }, 'release:10.0-ALL': { version: '10.0', variant: 'ALL' },
  'class:10.0-ALL:EC000001': { code: 'EC000001', name: { de: 'Eins' }, features: [] }, 'class:10.0-ALL:EC000002': { code: 'EC000002', name: { de: 'Zwei' }, features: [] },
}
for (let i = 3; i < 200; i++) DATA[`class:10.0-ALL:EC${String(i).padStart(6, '0')}`] = { code: `EC${String(i).padStart(6, '0')}`, features: [] }
const antwort = body => ({ ok: body !== undefined && body !== null, status: body == null ? 404 : 200, json: async () => body, text: async () => JSON.stringify(body) })
globalThis.fetch = async url => {
  const u = String(url); gefragt.push(u)
  if (u === '/api/plugins/etim/data') return antwort(Object.keys(DATA))
  if (u.startsWith('/api/values/')) return antwort({ values: [{ id: 'g-1', value: 'EC000002', label: 'G', role: 'group' }] })
  const m = u.match(/^\/api\/plugins\/etim\/data\/(.+)$/); if (m) return antwort(DATA[decodeURIComponent(m[1])] ?? null)
  return antwort({})
}

test('beim Start nur die zugewiesenen Klassen, weder die ganze Freigabe noch der Baum', async () => {
  await import('../../plugins/etim/entry.js')
  for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 5))
  assert.ok(gefragt.some(u => u === '/api/values/class_etim'), gefragt.join('\n'))
  assert.ok(gefragt.some(u => u.endsWith(encodeURIComponent('class:10.0-ALL:EC000002'))), 'die zugewiesene Klasse einzeln')
  assert.ok(!gefragt.some(u => u.includes('values=true')), 'nicht die ganze Freigabe')
  assert.ok(!gefragt.some(u => u === '/api/tree' || u.includes('/table')), 'weder Baum noch Tabelle')
  assert.ok(!gefragt.some(u => u.endsWith(encodeURIComponent('class:10.0-ALL:EC000001'))), 'nicht zugewiesene Klassen nicht')
})
