// Die Teamseite (Taloan, 23.09.2026: „auf der Teamseite sehe ich alles, was zu meinem Team gehört, wer alles zu meinem Team
// gehört; wenn ich der Teamadministrator bin, kann ich da auch die API-Schlüssel eingeben. Teams anlegen kann man hier
// aber nicht“). Geprüft wird genau das: Mitglieder, Schlüssel, Token, Verbrauch, Nutzung — und kein Anlegen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'

const TeamsSettings = (await import('../src/components/TeamsSettings.vue')).default
const TeamsAdmin = (await import('../src/components/TeamsAdmin.vue')).default

const TEAMS = [
  { key: 'init', label: 'Init Team', primary: true, keys: ['anthropic'], keysFrom: null, includedTokens: 200000, monthlyTokens: 100000, dailyTokens: 50000, month: 80000, today: 1200, calls: 7, members: 3, payer: 'init', managers: ['taloan'], models: { anthropic: 'claude-sonnet-5' } },
  { key: 'es', label: 'Spanien', primary: false, keys: [], keysFrom: 'init', includedTokens: 0, monthlyTokens: 0, dailyTokens: 0, month: 0, today: 0, calls: 0, members: 2, payer: 'init', managers: ['pablo'], models: {} },
]
const MITGLIEDER = [
  { key: 'taloan', name: 'Taloan', role: 'admin', enabled: true, own: true, lastAt: '2026-09-23T07:00:00Z' },
  { key: 'gast', name: 'Gast', role: 'reader', enabled: true, own: false, lastAt: null },
]

function server(teams = TEAMS) {
  const calls = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    calls.push({ path, method: opts.method ?? 'GET', body: opts.body ? JSON.parse(opts.body) : null })
    const body = path.endsWith('/members') ? MITGLIEDER
      : path.endsWith('/tokens') ? [{ id: 'abc123def456', user: 'gast', label: 'Excel Laptop', at: '2026-09-20T08:00:00Z' }]
      : path.endsWith('/usage') ? { team: 'init', days: [{ day: '2026-09-23', calls: 7, bytesIn: 2_097_152, bytesOut: 131_072, bytes: 2_228_224, byProvider: { anthropic: 2_228_224 }, byUser: { gast: 2_000_000 }, byPurpose: { 'Übersetzung': 2_000_000, Editor: 228_224 } }], dependents: ['es'] }
      : path === '/api/usage' ? { week: { used: 1, max: 10 }, month: { used: 2, max: 20 }, history: [] }
      : path === '/api/teams/free' ? [{ key: 'neu', name: 'Neu Person', role: 'editor' }]
      : path === '/api/auth/people' ? [{ key: 'taloan', name: 'Taloan', role: 'admin' }, { key: 'pablo', name: 'Pablo', role: 'editor' }]
      : path === '/api/licence' ? { plan: 'Testbetrieb', entriesWeek: 20000, entriesMonth: 100000, aiTokensMonth: 0, aiTokensDay: 0, geprueft: false }
      : path === '/api/teams' ? teams
      : opts.method === 'PUT' ? teams[0] : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
  return calls
}
const ruhe = async () => { for (let i = 0; i < 5; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }

test('die Teamseite zeigt, wer dazugehört und womit gearbeitet wird — über KI-Kosten sagt sie nichts', async () => {
  server(); store.auth = { known: true, enabled: true, user: 'taloan', role: 'teamadmin', rights: ['read', 'team'] }
  const w = mount(TeamsSettings); await ruhe()
  const t = w.text().replace(/\s+/g, ' ')
  assert.match(t, /Init Team/)
  assert.match(t, /Taloan/, 'die Mitglieder stehen da')
  assert.match(t, /Gast/, 'auch wer kein eigenes Team trägt')
  assert.match(t, /anthropic/, 'die eingerichteten Anbieter')
  assert.ok(!/Excel Laptop/.test(t), 'API-Token gehören zur Person, nicht zum Team')
  assert.match(t, /journali PIM Token/, 'die Nutzung gegen die Limits hat ihren eigenen Abschnitt')
  assert.ok(!/Token diesen Monat/.test(t), 'journali sagt nichts über verbrauchte KI-Token')
  assert.ok(!/kostet/i.test(t), 'und nichts über Kosten')
  assert.match(t, /Verfügbar/, 'was dem Team noch zur Verfügung steht — Grenzen stehen positiv da')
  assert.match(t, /Genutzt/, 'und klein daneben, was schon geschrieben wurde')
  assert.match(t, /Lizenz/, 'die Limits kommen aus der Lizenz — sie steht hier')
  assert.ok(!t.includes('neues Team'), 'Teams anlegen gehört nicht auf die Teamseite')
  await ruhe(); w.unmount()
})

test('der Fragezeichen-Knopf sagt, was auf die Limits geht und was nicht', async () => {
  server(); store.auth = { known: true, enabled: true, user: 'taloan', role: 'teamadmin', rights: ['read', 'team'] }
  const w = mount(TeamsSettings); await ruhe()
  await w.findAll('button').find(b => b.text() === '?').trigger('click'); await ruhe()
  assert.match(dialog.title, /journali PIM Token/, 'die Hilfe gehört zu den journali-Token, nicht zur KI')
  const zeilen = dialog.list.flat().join(' ')
  assert.match(zeilen, /Anlegen/); assert.match(zeilen, /Ändern/); assert.match(zeilen, /Zurückziehen/)
  assert.match(zeilen, /Freigeben/); assert.match(zeilen, /Übersetzen/)
  assert.ok(!/[Nn]icht gezählt/.test(zeilen), 'über Nichtgezähltes sagt der Dialog nichts')
  assert.ok(!/KI|Token verbraucht/.test(zeilen), 'und nichts über fremde Token')
  dialog.done(true); await ruhe(); w.unmount()
})

test('das Austauschvolumen steht hin und zurück getrennt da — in Bytes, nie in Tokens', async () => {
  server(); store.auth = { known: true, enabled: true, user: 'taloan', role: 'teamadmin', rights: ['read', 'team'] }
  const w = mount(TeamsSettings); await ruhe()
  const t = w.text().replace(/\s+/g, ' ')
  assert.match(t, /Austauschvolumen/, 'der Abschnitt heißt so')
  assert.match(t, /2MB/, 'was hingeschickt wurde')
  assert.match(t, /128KB/, 'und was zurückkam')
  assert.match(t, /Übersetzung/, 'der Anlass steht dabei')
  assert.ok(!/KI-Token|Token verbraucht|Token diesen Monat/.test(t), 'eine Tokenzahl des Anbieters steht nirgends')
  await ruhe(); w.unmount()
})

test('die Lizenz steht vor den Token — sie erklärt das Kontingent', async () => {
  server(); store.auth = { known: true, enabled: true, user: 'taloan', role: 'teamadmin', rights: ['read', 'team'] }
  const w = mount(TeamsSettings); await ruhe()
  const h = w.findAll('h2').map(x => x.text().replace(/\s+/g, ' '))
  const lizenz = h.findIndex(x => /Lizenz/.test(x))
  const token = h.findIndex(x => /journali PIM Token/.test(x))
  assert.ok(lizenz >= 0 && token > lizenz, 'erst die Lizenz, dann das, was daraus folgt')
  assert.ok(!h.some(x => /Limits dieser Anlage|gemessen, nicht geschätzt/.test(x)), 'keine Beisätze, die anderswo schon stehen')
  await ruhe(); w.unmount()
})

test('der Team-Admin hinterlegt den Schlüssel; er kommt nie zurück', async () => {
  const calls = server(); store.auth = { known: true, enabled: true, user: 'taloan', role: 'teamadmin', rights: ['read', 'team'] }
  const w = mount(TeamsSettings); await ruhe()
  await w.find('input[type=password]').setValue('sk-ant-geheim')
  await w.findAll('button').find(b => b.text() === '🔒').trigger('click'); await ruhe()
  const put = calls.find(c => c.path.includes('/keys') && c.method === 'PUT')
  assert.ok(put, 'der Schlüssel ging nicht hinaus')
  assert.equal(put.body.keys.anthropic, 'sk-ant-geheim')
  assert.equal(w.find('input[type=password]').element.value, '', 'das Feld ist danach leer — der Schlüssel liegt beim Server')
  await ruhe(); w.unmount()
})

test('ein Leser sieht sein Team, ändert aber nichts', async () => {
  server(); store.auth = { known: true, enabled: true, user: 'gast', role: 'reader', rights: ['read'] }
  const w = mount(TeamsSettings); await ruhe()
  assert.match(w.text(), /Init Team/)
  assert.equal(w.findAll('input[type=password]').length, 0, 'kein Feld für einen Schlüssel')
  assert.equal(w.findAll('input[type=number]').length, 0, 'Grenzen gibt es hier nicht — sie stehen in der Lizenz')
  await ruhe(); w.unmount()
})

test('Teams anlegen steht bei den Personen — das erste Team lässt sich nicht entfernen', async () => {
  const calls = server(); store.auth = { known: true, enabled: true, user: 'taloan', role: 'admin', rights: ['read', 'users'] }
  const w = mount(TeamsAdmin); await ruhe()
  const zeilen = w.findAll('tbody tr')
  assert.match(zeilen[0].text(), /①/, 'das erste Team ist zu erkennen')
  assert.equal(zeilen[0].findAll('button').filter(b => b.text() === '✕').length, 0, 'es bleibt')
  assert.equal(zeilen[1].findAll('button').filter(b => b.text() === '✕').length, 1, 'jedes andere nicht')
  assert.equal(zeilen[0].findAll('input[type=number]').length, 2, 'je Team eine Woche und ein Monat — KI-Grenzen gibt es nicht')
  await w.find('input[placeholder="neues Team"]').setValue('Frankreich')
  await w.findAll('select').at(-1).setValue('taloan')   // ohne Führung legt der Server kein Team an
  await w.findAll('button').find(b => b.text() === '+').trigger('click'); await ruhe()
  const put = calls.find(c => c.path === '/api/teams/frankreich' && c.method === 'PUT')
  assert.ok(put, 'das Team wurde nicht angelegt')
  assert.equal(put.body.label, 'Frankreich')
  await ruhe(); w.unmount()
})
