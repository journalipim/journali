// Die Team-Seite holt ihre Daten nach, wenn der Journalstand steigt (26.09.2026: ein Team, das auf einem anderen
// Server geändert wurde, stand hier veraltet — die Seite lud nur beim Öffnen). Währenddessen tippt niemand: hat ein
// Eingabefeld den Fokus, wird nicht nachgeladen, sonst verschwände die halbe Eingabe.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'

const TeamsSettings = (await import('../src/components/TeamsSettings.vue')).default

function server(teams) {
  const abrufe = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    abrufe.push(path)
    const body = path === '/api/teams' ? teams
      : path.endsWith('/members') ? []
      : path === '/api/teams/free' ? []
      : path === '/api/licence' ? { tarif: { key: 'pro', label: 'Pro' }, geprueft: true }
      : path.endsWith('/tokens/journali') ? { team: 'init', payer: 'init', payerLabel: 'Init Team', limits: { week: 1, month: 1 }, used: {}, mine: {}, head: 1, today: '2026-09-26', resetWeek: '2026-09-28', resetMonth: '2026-10-01', history: [] }
      : path.endsWith('/usage') ? { days: [] }
      : path === '/api/health' ? { head: store.head, nodes: 0, presence: [] }
      : path === '/api/model' ? { attributes: [], groups: [], locales: [], channels: [], views: [], lists: [] }
      : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
  return abrufe
}
const ruhe = async () => { for (let i = 0; i < 4; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }

test('ein neuer Journalstand lädt die Teams nach', async () => {
  const abrufe = server([{ key: 'init', label: 'Init Team', payer: 'init', managers: [], keys: [], primary: true }])
  store.auth = { known: true, enabled: true, user: 'u1', role: 'admin', rights: ['read', 'team', 'users'] }
  store.head = 100
  const w = mount(TeamsSettings); await ruhe()
  const vorher = abrufe.filter(p => p === '/api/teams').length
  store.head = 101; await ruhe()
  assert.ok(abrufe.filter(p => p === '/api/teams').length > vorher, 'die Teams wurden nicht neu geholt')
  w.unmount(); await ruhe()   // was noch unterwegs ist, darf ankommen, bevor der Mock verschwindet
})
