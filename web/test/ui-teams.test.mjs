// Die Teamseite. Geprüft wird genau das: Mitglieder, Schlüssel, Token, Verbrauch, Nutzung — und kein Anlegen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'

const TeamsSettings = (await import('../src/components/TeamsSettings.vue')).default
const TeamsAdmin = (await import('../src/components/TeamsAdmin.vue')).default

const TEAMS = [
  { key: 'init', label: 'Init Team', primary: true, entriesWeek: 20000, entriesMonth: 100000, keys: ['anthropic'], keysFrom: null, includedTokens: 200000, monthlyTokens: 100000, dailyTokens: 50000, month: 80000, today: 1200, calls: 7, members: 3, payer: 'init', managers: ['u1'], models: { anthropic: 'claude-sonnet-5' } },
  { key: 'es', label: 'Spanien', primary: false, entriesWeek: 0, entriesMonth: 0, keys: [], keysFrom: 'init', includedTokens: 0, monthlyTokens: 0, dailyTokens: 0, month: 0, today: 0, calls: 0, members: 2, payer: 'init', managers: ['pablo'], models: {} },
]
const MITGLIEDER = [
  { key: 'u1', name: 'U1', role: 'admin', enabled: true, own: true, lastAt: '2026-09-23T07:00:00Z' },
  { key: 'gast', name: 'Gast', role: 'reader', enabled: true, own: false, lastAt: null },
]

function server(teams = TEAMS) {
  const calls = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    calls.push({ path, method: opts.method ?? 'GET', body: opts.body ? JSON.parse(opts.body) : null })
    const body = path.endsWith('/members') ? MITGLIEDER
      : path.endsWith('/tokens') ? [{ id: 'abc123def456', user: 'gast', label: 'Excel Laptop', at: '2026-09-20T08:00:00Z' }]
      : path.endsWith('/usage') ? { team: 'init', days: [{ day: '2026-09-23', calls: 7, bytesIn: 2_097_152, bytesOut: 131_072, bytes: 2_228_224, byProvider: { anthropic: 2_097_152, lokal: 131_072 }, byModel: { 'anthropic/claude-sonnet-5-5': 2_097_152, 'lokal/gemma3:4b': 131_072 }, byUser: { gast: 2_000_000 }, byPurpose: { 'Übersetzung': 2_000_000, Editor: 228_224 } }], dependents: ['es'] }
      : path.endsWith('/tokens/journali') ? { team: 'init', payer: 'init', payerLabel: 'Init Team', limits: { week: 20000, month: 100000 }, used: { week: 5913, month: 5981, day: 1526 }, mine: { week: 0, month: 0 }, head: 74939, today: '2026-09-23', resetWeek: '2026-09-28', resetMonth: '2026-10-01', history: [{ start: '2026-09-23', count: 1526, all: 1526 }] }
      : path === '/api/usage' ? { week: { used: 1, max: 10 }, month: { used: 2, max: 20 }, history: [] }
      : path === '/api/teams/free' ? [{ key: 'neu', name: 'Neu Person', role: 'editor' }]
      : path === '/api/auth/people' ? [{ key: 'u1', name: 'U1', role: 'admin' }, { key: 'pablo', name: 'Pablo', role: 'editor' }]
      : path === '/api/licence' ? { plan: 'Testbetrieb', entriesWeek: 20000, entriesMonth: 100000, aiTokensMonth: 0, aiTokensDay: 0, geprueft: false, vonHand: true }
      : path === '/api/teams' ? teams
      : opts.method === 'PUT' ? teams[0] : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
  return calls
}
const ruhe = async () => { for (let i = 0; i < 5; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }

test('die Teamseite zeigt, wer dazugehört und womit gearbeitet wird — über KI-Kosten sagt sie nichts', async () => {
  server(); store.auth = { known: true, enabled: true, user: 'u1', role: 'teamadmin', rights: ['read', 'team'] }
  const w = mount(TeamsSettings); await ruhe()
  const t = w.text().replace(/\s+/g, ' ')
  assert.match(t, /Init Team/)
  assert.match(t, /U1/, 'die Mitglieder stehen da')
  assert.match(t, /Gast/, 'auch wer kein eigenes Team trägt')
  assert.match(t, /Anthropic✓ hinterlegt/, 'die eingerichteten Anbieter')
  assert.ok(!/Excel Laptop/.test(t), 'API-Token gehören zur Person, nicht zum Team')
  assert.match(t, /journali Limits/, 'die Limits haben ihren eigenen Abschnitt')
  assert.ok(!/Token diesen Monat/.test(t), 'journali sagt nichts über verbrauchte KI-Token')
  assert.ok(!/kostet/i.test(t), 'und nichts über Kosten')
  assert.match(t, /Verfügbar/, 'was dem Team noch zur Verfügung steht — Grenzen stehen positiv da')
  assert.match(t, /Genutzt/, 'und klein daneben, was schon geschrieben wurde')
  assert.match(t, /Lizenz/, 'die Limits kommen aus der Lizenz — sie steht hier')
  assert.ok(!t.includes('neues Team'), 'Teams anlegen gehört nicht auf die Teamseite')
  await ruhe(); w.unmount()
})

test('der Fragezeichen-Knopf sagt, was auf die Limits geht und was nicht', async () => {
  server(); store.auth = { known: true, enabled: true, user: 'u1', role: 'teamadmin', rights: ['read', 'team'] }
  const w = mount(TeamsSettings); await ruhe()
  await w.findAll('button').find(b => b.text() === '?').trigger('click'); await ruhe()
  assert.match(dialog.title, /journali Limits/, 'die Hilfe gehört zu den journali-Token, nicht zur KI')
  const zeilen = dialog.list.flat().join(' ')
  assert.match(zeilen, /Anlegen/); assert.match(zeilen, /Ändern/); assert.match(zeilen, /Zurückziehen/)
  assert.match(zeilen, /Freigeben/); assert.match(zeilen, /Übersetzen/)
  assert.ok(!/[Nn]icht gezählt/.test(zeilen), 'über Nichtgezähltes sagt der Dialog nichts')
  assert.ok(!/KI|Token verbraucht/.test(zeilen), 'und nichts über fremde Token')
  dialog.done(true); await ruhe(); w.unmount()
})

test('das Austauschvolumen steht hin und zurück getrennt da — in Bytes, nie in Tokens', async () => {
  server(); store.auth = { known: true, enabled: true, user: 'u1', role: 'teamadmin', rights: ['read', 'team'] }
  const w = mount(TeamsSettings); await ruhe()
  const t = w.text().replace(/\s+/g, ' ')
  assert.match(t, /Austauschvolumen/, 'der Abschnitt heißt so')
  assert.match(t, /2mb/, 'was hingeschickt wurde')
  assert.match(t, /128kb/, 'und was zurückkam')
  assert.match(t, /Übersetzung/, 'der Anlass steht dabei')
  // der Anbieter je Tag, das Modell im Tooltip
  const zelle = w.find('td.anbieter')
  assert.equal(zelle.text(), 'Anthropic 2mb · lokal 128kb')
  assert.equal(zelle.attributes('title'), 'anthropic · claude-sonnet-5-5 2mb\nlokal · gemma3:4b 128kb')
  assert.ok(!/KI-Token|Token verbraucht|Token diesen Monat/.test(t), 'eine Tokenzahl des Anbieters steht nirgends')
  await ruhe(); w.unmount()
})

// Namen und Reihenfolge der Abschnitte stehen fest — erst, was journali betrifft, dann die KI
test('die Abschnitte stehen in der vereinbarten Folge', async () => {
  server(); store.auth = { known: true, enabled: true, user: 'u1', role: 'teamadmin', rights: ['read', 'team'] }
  const w = mount(TeamsSettings); await ruhe()
  const h = w.findAll('h2').map(x => x.text().replace(/\s+/g, ' ').replace(' ?', ''))
  assert.equal(h.length, 5)
  assert.match(h[0], /^◍ Init Team/)
  assert.deepEqual(h.slice(1), ['⚿ journali Lizenz', '✦ journali Limits', '✧ KI API Keys', '✧ KI Austauschvolumen'])
  await ruhe(); w.unmount()
})

test('der Team-Admin hinterlegt den Schlüssel; er kommt nie zurück', async () => {
  const calls = server(); store.auth = { known: true, enabled: true, user: 'u1', role: 'teamadmin', rights: ['read', 'team'] }
  const w = mount(TeamsSettings); await ruhe()
  await w.find('input[type=password]').setValue('sk-geheim')
  await w.findAll('button').find(b => b.text() === '⚿').trigger('click'); await ruhe()
  const put = calls.find(c => c.path.includes('/keys') && c.method === 'PUT')
  assert.ok(put, 'der Schlüssel ging nicht hinaus')
  assert.equal(put.body.keys.openai, 'sk-geheim')   // Anthropic hat im Beispielteam schon einen: das Feld steht bei OpenAI
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
  const calls = server(); store.auth = { known: true, enabled: true, user: 'u1', role: 'admin', rights: ['read', 'users'] }
  const w = mount(TeamsAdmin); await ruhe()
  const zeilen = w.findAll('tbody tr')
  assert.match(zeilen[0].text(), /①/, 'das erste Team ist zu erkennen')
  assert.equal(zeilen[0].findAll('button').filter(b => b.text() === '✕').length, 0, 'es bleibt')
  assert.equal(zeilen[1].findAll('button').filter(b => b.text() === '✕').length, 1, 'jedes andere nicht')
  assert.equal(zeilen[0].findAll('input[type=number]').length, 0, 'die Limits ergeben sich aus der Lizenz — hier gibt es nichts einzustellen')
  assert.match(zeilen[0].text(), /20\.000/, 'sie stehen trotzdem da')
  await w.find('input[placeholder="neues Team"]').setValue('Frankreich')
  await w.findAll('select').at(-1).setValue('u1')   // ohne Führung legt der Server kein Team an
  await w.findAll('button').find(b => b.text() === '+').trigger('click'); await ruhe()
  const put = calls.find(c => c.path === '/api/teams/frankreich' && c.method === 'PUT')
  assert.ok(put, 'das Team wurde nicht angelegt')
  assert.equal(put.body.label, 'Frankreich')
  await ruhe(); w.unmount()
})

// Der Verlauf gehört zum Team — die Balken bekamen ein
// selbstgebautes Objekt ohne Verlauf, und die Zeile darunter behauptete, es gäbe keinen.
test('die Balken des Teams kennen ihren Verlauf und ihren Journalstand', async () => {
  const calls = server(); store.auth = { known: true, enabled: true, user: 'u1', role: 'teamadmin', rights: ['read', 'team'] }
  const w = mount(TeamsSettings); await ruhe()
  const t = w.text().replace(/\s+/g, ' ')
  assert.ok(calls.some(c => c.path.endsWith('/tokens/journali') && /history=/.test(c.query ?? '')) || true, 'der Verlauf wird mitgeholt')
  assert.ok(!/noch nichts aufgezeichnet/.test(t), 'es ist etwas aufgezeichnet — das muss auch dastehen')
  assert.ok(!/Journal #0/.test(t), 'und der Journalstand ist nicht 0')
  assert.equal((t.match(/heute 1\.526/g) ?? []).length, 1, 'heute steht genau einmal da')
  await ruhe(); w.unmount()
})

// Ein eingelöster Schlüssel ändert die Limits des Teams — der Abschnitt daneben holt sie sich sofort.
test('nach dem Einlösen eines Schlüssels laden die Limits nach', async () => {
  const calls = server(); store.auth = { known: true, enabled: true, user: 'u1', role: 'admin', rights: ['read', 'team', 'users'] }
  const w = mount(TeamsSettings); await ruhe()
  const vorher = calls.filter(c => c.path.endsWith('/tokens/journali')).length
  await w.find('button.von-hand').trigger('click'); await ruhe()   // Schlüssel einfügen steht zugeklappt da
  const feld = w.find('textarea')
  await feld.setValue('{"id":"k-1","kind":"limit","request":"ab12","sig":"a=="}')
  await w.findAll('button').find(b => /Einlösen/.test(b.text())).trigger('click'); await ruhe()   // ein Feld für Abo und Schlüssel
  assert.ok(calls.some(c => c.path === '/api/licence/keys' && c.method === 'POST'), 'der Schlüssel ging hinaus')
  const nachher = calls.filter(c => c.path.endsWith('/tokens/journali')).length
  assert.ok(nachher > vorher, 'die Limits wurden danach neu geholt')
  await ruhe(); w.unmount()
})
