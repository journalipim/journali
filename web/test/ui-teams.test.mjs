// Einstellungen → 👥 Teams (Taloan, 23.09.2026: „je Team gibt es Limits und API-Keys, Benutzer gehören einem Team an“).
// Geprüft wird, was den Unterschied macht: das Grundkontingent steht nur am ersten Team, Schlüssel gehen zum Server und
// kommen nie zurück, und ein Team-Admin sieht nur sein eigenes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'

const TeamsSettings = (await import('../src/components/TeamsSettings.vue')).default

const TEAMS = [
  { key: 'zentral', label: 'Zentrale', primary: true, keys: ['anthropic'], keysFrom: null, includedTokens: 200000, monthlyTokens: 100000, dailyTokens: 50000, month: 80000, today: 1200, calls: 7, members: 3, payer: 'zentral' },
  { key: 'es', label: 'Spanien', primary: false, keys: [], keysFrom: 'zentral', includedTokens: 0, monthlyTokens: 0, dailyTokens: 0, month: 0, today: 0, calls: 0, members: 2, payer: 'zentral' },
]

function server(teams = TEAMS) {
  const calls = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '')
    calls.push({ path, method: opts.method ?? 'GET', body: opts.body ? JSON.parse(opts.body) : null })
    const body = path.startsWith('/api/teams') && path.includes('/usage') ? { team: 'zentral', days: [{ day: '2026-09-23', calls: 7, in: 800, out: 400, tokens: 1200, byProvider: { anthropic: 1200 }, byUser: { pablo: 900, taloan: 300 } }], dependents: ['es'] }
      : path.startsWith('/api/teams') && opts.method === 'PUT' ? teams[0]
      : teams
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
  return calls
}
const zeilen = w => w.findAll('tbody tr')
/// warten, bis auch die Nachläufer durch sind (die Tabelle lädt nach jeder Änderung neu)
const ruhe = async () => { for (let i = 0; i < 5; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }

test('jedes Team mit Schlüsseln, Grenzen und Verbrauch — das Grundkontingent nur bei Team 1', async () => {
  server(); store.auth = { known: true, enabled: true, user: 'taloan', role: 'admin', rights: ['users', 'team', 'read'] }
  const w = mount(TeamsSettings); await flushPromises()
  await ruhe()
  const namen = zeilen(w).map(r => r.find('input[type=text]').exists() ? r.find('input[type=text]').element.value : r.text())
  assert.ok(namen[0].includes('Zentrale'), `Team 1 fehlt: ${namen.join(' | ')}`)
  assert.ok(namen[1].includes('Spanien'), `zweites Team fehlt: ${namen.join(' | ')}`)
  const t = w.text().replace(/\s+/g, ' ')
  assert.match(t, /anthropic/, 'die eingerichteten Anbieter stehen da')
  assert.match(t, /↑ zentral/, 'Spanien hängt sichtbar am Zahler')
  // Grundkontingent: Eingabefeld nur in der Zeile von Team 1
  const felder = zeilen(w).map(r => r.findAll('input[type=number]').length)
  assert.equal(felder[0], 3, 'Team 1: Grundkontingent, Monat, Tag')
  assert.equal(felder[1], 2, 'jedes weitere Team hat kein eigenes Grundkontingent')
  assert.match(zeilen(w)[0].text(), /①/, 'Team 1 ist als solches zu erkennen')
  await ruhe(); w.unmount()
})

test('ein Schlüssel geht zum Server und kommt nie zurück', async () => {
  const calls = server(); store.auth = { known: true, enabled: true, user: 'taloan', role: 'admin', rights: ['users', 'read'] }
  const w = mount(TeamsSettings); await flushPromises()
  await ruhe()
  const zeile = zeilen(w)[1]
  await zeile.find('input[type=password]').setValue('sk-ant-geheim')
  await zeile.findAll('button').find(b => b.text() === '🔒').trigger('click'); await ruhe()
  const put = calls.find(c => c.path.includes('/keys') && c.method === 'PUT')
  assert.ok(put, 'der Schlüssel ging nicht hinaus')
  assert.equal(put.body.keys.anthropic, 'sk-ant-geheim')
  const nachher = zeilen(w)
  assert.ok(nachher.length >= 2, `nach dem Speichern stehen nur ${nachher.length} Zeilen da — die Tabelle hat sich verabschiedet: ${w.html().slice(0, 300)}`)
  assert.equal(nachher[1].find('input[type=password]').element.value, '', 'das Feld ist danach leer — der Schlüssel liegt beim Server')
  await ruhe(); w.unmount()
})

test('Verbrauch je Tag, Anbieter und Person — daraus wird die Rechnung, nicht die Sperre', async () => {
  server(); store.auth = { known: true, enabled: true, user: 'taloan', role: 'admin', rights: ['users', 'read'] }
  const w = mount(TeamsSettings); await flushPromises()
  await ruhe()
  await zeilen(w)[0].findAll('button').find(b => b.text() === '≡').trigger('click'); await ruhe()
  const t = w.text().replace(/\s+/g, ' ')
  assert.match(t, /pablo 900/, 'die Person steht in der Aufstellung')
  assert.match(t, /anthropic 1\.200/, 'und der Anbieter')
  assert.match(t, /Auf diese Rechnung gehen auch: es/, 'wer sonst noch auf diese Rechnung geht')
  await ruhe(); w.unmount()
})

test('ein Team-Admin bearbeitet keine Bezeichnungen fremder Teams und legt keine an', async () => {
  server([TEAMS[1]]); store.auth = { known: true, enabled: true, user: 'pablo', role: 'teamadmin', rights: ['read', 'write', 'team'] }
  const w = mount(TeamsSettings); await ruhe()
  assert.equal(w.findAll('input[placeholder="neues Team"]').length, 0, 'Teams anlegen bleibt bei „Benutzer und Rollen“')
  assert.equal(zeilen(w)[0].findAll('input[type=text]').length, 0, 'die Bezeichnung ändert nur, wer alle Teams verwaltet')
  assert.ok(zeilen(w)[0].find('input[type=password]').exists(), 'den eigenen Schlüssel darf er hinterlegen')
  await ruhe(); w.unmount()
})
