// Der Team-Tab mit einem lokalen Modell (29.09.2026): gibt es eines am Server, steht der Anbieter zur Wahl — ein bezahlter
// mit Schlüssel oder lokal — und das lokale Modell aus der Liste des Dienstes. Beides steht am Team (models).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'

const TeamsSettings = (await import('../src/components/TeamsSettings.vue')).default

const TEAM = { key: 'init', label: 'Init Team', primary: true, entriesWeek: 20000, entriesMonth: 100000, keys: ['anthropic'], keysFrom: null, includedTokens: 0, monthlyTokens: 0, dailyTokens: 0, month: 0, today: 0, calls: 0, members: 1, managers: ['u1'], models: { anthropic: 'claude-sonnet-5', '*': 'lokal' }, enabled: true }

function server({ lokal = { ready: true, models: ['m-klein', 'm-gross'] } } = {}) {
  const calls = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    calls.push({ path, method: opts.method ?? 'GET', body: opts.body ? JSON.parse(opts.body) : null })
    const body = path === '/api/ai/lokal/models' ? lokal
      : path === '/api/teams' ? [TEAM]
      : path.endsWith('/members') ? [{ key: 'u1', name: 'U1', role: 'admin', enabled: true, own: true, lastAt: null }]
      : path.endsWith('/usage') ? { team: 'init', days: [] }
      : path.endsWith('/tokens/journali') ? { team: 'init', payer: 'init', payerLabel: 'Init Team', limits: { week: 1, month: 1 }, used: { week: 0, month: 0, day: 0 }, mine: { week: 0, month: 0, day: 0 }, days: [] }
      : path === '/api/licence' ? { plan: 'Testbetrieb', entriesWeek: 1, entriesMonth: 1, aiTokensMonth: 0, aiTokensDay: 0 }
      : path === '/api/ai/state' ? { team: 'init', ready: true, providers: ['anthropic', 'lokal'], chosen: 'lokal', models: TEAM.models }
      : opts.method === 'PUT' ? TEAM : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
  return calls
}
const ruhe = async () => { for (let i = 0; i < 5; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }
const zeile = (w, label) => w.findAll('tr').find(tr => tr.find('td').exists() && tr.find('td').text().trim() === label)

test('mit lokalem Modell: Anbieter zur Wahl, das lokale Modell aus der Liste des Dienstes', async () => {
  const calls = server(); store.auth = { known: true, enabled: true, user: 'u1', role: 'teamadmin', rights: ['read', 'team'] }
  const w = mount(TeamsSettings); await ruhe()
  const anb = zeile(w, 'Anbieter')
  assert.ok(anb, 'die Zeile Anbieter steht da')
  assert.deepEqual(anb.find('select').findAll('option').map(o => o.text()), ['anthropic', 'lokal'])
  assert.equal(anb.find('select').element.value, 'lokal', 'die Wahl des Teams')
  const mod = zeile(w, 'Modell lokal')
  assert.ok(mod, 'das Modell des lokalen Dienstes'); assert.deepEqual(mod.find('select').findAll('option').map(o => o.text()), ['— Vorgabe —', 'm-klein', 'm-gross'])
  await mod.find('select').setValue('m-gross'); await ruhe()
  const put = calls.find(c => c.method === 'PUT' && c.path === '/api/teams/init')
  assert.deepEqual(put.body, { models: { lokal: 'm-gross' } })
  await anb.find('select').setValue('anthropic'); await ruhe()
  assert.ok(calls.some(c => c.method === 'PUT' && c.path === '/api/teams/init' && c.body.models?.['*'] === 'anthropic'), 'die Wahl geht als models["*"] ans Team')
  await ruhe(); w.unmount()
})

test('ohne lokales Modell steht keine Wahl da — nur der eine bezahlte Anbieter', async () => {
  server({ lokal: { ready: false, models: [] } }); store.auth = { known: true, enabled: true, user: 'u1', role: 'teamadmin', rights: ['read', 'team'] }
  const w = mount(TeamsSettings); await ruhe()
  assert.equal(zeile(w, 'Anbieter'), undefined)
  assert.equal(zeile(w, 'Modell lokal'), undefined)
  await ruhe(); w.unmount()
})
