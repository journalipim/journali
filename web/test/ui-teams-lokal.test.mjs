// KI API Keys (01.10.2026): eine Zeile je Anbieter — wird gefragt, Zugang (Schlüssel oder Adresse), Modell. Das lokale Modell ist ein Anbieter wie
// die anderen: Adresse eintragen, Modell aus der Liste des Dienstes wählen, aktivieren. Die Wahl steht am Team (models).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'

const TeamsSettings = (await import('../src/components/TeamsSettings.vue')).default

const TEAM = { key: 'init', label: 'Init Team', primary: true, entriesWeek: 20000, entriesMonth: 100000, keys: ['anthropic'], keysFrom: null, includedTokens: 0, monthlyTokens: 0, dailyTokens: 0, month: 0, today: 0, calls: 0, members: 1, managers: ['u1'], models: { anthropic: 'claude-sonnet-5', '*': 'lokal' }, enabled: true }

function server({ lokal = { ready: true, models: ['m-klein', 'm-gross'] }, team = TEAM } = {}) {
  const calls = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    calls.push({ path, method: opts.method ?? 'GET', body: opts.body ? JSON.parse(opts.body) : null })
    const body = path === '/api/ai/lokal/models' ? lokal
      : path === '/api/teams' ? [team]
      : path.endsWith('/members') ? [{ key: 'u1', name: 'U1', role: 'admin', enabled: true, own: true, lastAt: null }]
      : path.endsWith('/usage') ? { team: 'init', days: [] }
      : path.endsWith('/tokens/journali') ? { team: 'init', payer: 'init', payerLabel: 'Init Team', limits: { week: 1, month: 1 }, used: { week: 0, month: 0, day: 0 }, mine: { week: 0, month: 0, day: 0 }, days: [] }
      : path === '/api/licence' ? { plan: 'Testbetrieb', entriesWeek: 1, entriesMonth: 1, aiTokensMonth: 0, aiTokensDay: 0 }
      : path === '/api/ai/state' ? { team: 'init', ready: true, providers: ['anthropic', 'lokal'], chosen: 'lokal', models: TEAM.models }
      : opts.method === 'PUT' ? team : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
  return calls
}
const ruhe = async () => { for (let i = 0; i < 5; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }
const zeile = (w, name) => w.findAll('.ki-anbieter tbody tr').find(tr => tr.findAll('td')[1]?.text().trim() === name)
const admin = () => { store.auth = { known: true, enabled: true, user: 'u1', role: 'teamadmin', rights: ['read', 'team'] } }

test('eine Zeile je Anbieter: wird gefragt, Anbieter, Zugang, Modell — gewählt ist der, den das Team gewählt hat', async () => {
  server(); admin()
  const w = mount(TeamsSettings); await ruhe()
  const namen = w.findAll('.ki-anbieter tbody tr[class]').map(tr => tr.findAll('td')[1]?.text().trim()).filter(Boolean)
  assert.deepEqual(namen, ['Anthropic', 'OpenAI', 'lokal'])
  assert.equal(zeile(w, 'lokal').find('button.schalter').text(), '● aktiv', 'das Team fragt das lokale Modell')
  assert.equal(zeile(w, 'Anthropic').find('button.schalter').text(), '○ inaktiv')
  assert.match(zeile(w, 'Anthropic').text(), /✓ hinterlegt/)
  assert.ok(zeile(w, 'OpenAI').find('input[type=password]').exists(), 'OpenAI hat noch keinen Schlüssel: ein Feld dafür')
  w.unmount()
})

test('lokal aktivieren: der Schalter gehört zur Zeile und setzt die Wahl des Teams (models["*"])', async () => {
  const calls = server({ team: { ...TEAM, models: { anthropic: 'claude-sonnet-5-5', '*': 'anthropic' } } }); admin()
  const w = mount(TeamsSettings); await ruhe()
  assert.equal(zeile(w, 'Anthropic').find('button.schalter').text(), '● aktiv')
  await zeile(w, 'lokal').find('button.schalter').trigger('click'); await ruhe()
  const put = calls.find(c => c.method === 'PUT' && c.path === '/api/teams/init')
  assert.deepEqual(put.body, { models: { '*': 'lokal' } })
  w.unmount()
})

test('das lokale Modell: Modelle aus der Liste des Dienstes, die Wahl geht als models.lokal ans Team', async () => {
  const calls = server(); admin()
  const w = mount(TeamsSettings); await ruhe()
  const z = zeile(w, 'lokal')
  assert.match(z.text(), /2 Modelle/, 'der Dienst antwortet')
  assert.deepEqual(z.find('select').findAll('option').map(o => o.text()), ['— Vorgabe —', 'm-klein', 'm-gross'])
  await z.find('select').setValue('m-gross'); await ruhe()
  assert.deepEqual(calls.find(c => c.method === 'PUT' && c.path === '/api/teams/init').body, { models: { lokal: 'm-gross' } })
  assert.ok(calls.some(c => c.path === '/api/ai/lokal/models'), 'die Liste kommt vom Dienst')
  w.unmount()
})

test('die Adresse des lokalen Modells: als Text, nicht als Kennwort; sie geht an den Server und das Feld ist danach leer', async () => {
  const calls = server({ lokal: { ready: false, models: [] } }); admin()
  const w = mount(TeamsSettings); await ruhe()
  const z = zeile(w, 'lokal')
  const feld = z.find('input')
  assert.equal(feld.attributes('type'), 'text'); assert.equal(feld.attributes('placeholder'), 'http://localhost:11434')
  assert.equal(z.find('button.schalter').attributes('disabled') !== undefined, true, 'ohne Adresse lässt sich lokal nicht aktivieren')
  assert.equal(z.find('select').exists(), false, 'ohne Adresse gibt es keine Modelle zu wählen')
  await feld.setValue('http://localhost:11434')
  await z.findAll('button').find(b => b.text() === '⚿').trigger('click'); await ruhe()
  const put = calls.find(c => c.method === 'PUT' && c.path === '/api/teams/init/keys')
  assert.deepEqual(put.body, { keys: { lokal: 'http://localhost:11434' } })
  w.unmount()
})

test('antwortet der Dienst nicht, steht das in der Zeile — rot', async () => {
  server({ lokal: { ready: true, models: [] } }); admin()
  const w = mount(TeamsSettings); await ruhe()
  const z = zeile(w, 'lokal')
  assert.match(z.text(), /✗ nicht erreichbar/)
  assert.ok(z.find('.fehler').exists())
  w.unmount()
})

test('ohne Recht am Team nichts zu ändern: keine Felder, der Schalter ist gesperrt', async () => {
  server(); store.auth = { known: true, enabled: true, user: 'gast', role: 'reader', rights: ['read'] }
  const w = mount(TeamsSettings); await ruhe()
  assert.equal(w.findAll('.ki-anbieter input').length, 0)
  assert.equal(w.findAll('.ki-anbieter button.schalter').every(b => b.attributes('disabled') !== undefined), true)
  w.unmount()
})

test('die Seite beginnt beim Team der eigenen Mitgliedschaft — gefragt wird über dieses; ein fremdes Team trägt den Hinweis', async () => {
  const anderes = { ...TEAM, key: 'es', label: 'Spanien', primary: false, keys: ['openai'], models: {} }
  const calls = server({ team: TEAM })
  const abruf = globalThis.fetch
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    if (path === '/api/teams') return { ok: true, status: 200, text: async () => JSON.stringify([TEAM, anderes]) }
    return abruf(url, opts)
  }
  store.auth = { known: true, enabled: true, user: 'u1', role: 'admin', rights: ['read', 'team', 'users'], team: 'es' }
  const w = mount(TeamsSettings); await ruhe()
  assert.match(w.find('h2').text(), /Spanien/, 'das eigene Team steht da, nicht das erste der Liste')
  assert.equal(w.text().includes('Dein Team'), false, 'dieses Team ist das eigene')
  await w.find('select').setValue('init'); await ruhe()
  assert.match(w.text(), /Dein Team\s*Spanien/, 'das gezeigte Team ist ein anderes: der Hinweis nennt das eigene')
  assert.ok(calls.some(c => c.path === '/api/ai/lokal/models'), 'die Modelle des lokalen Dienstes kommen für das gezeigte Team')
  w.unmount()
})
