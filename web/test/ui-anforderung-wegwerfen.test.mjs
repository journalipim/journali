// ⚙ Einstellungen → Lizenz: eine offene Schlüsselanforderung lässt sich wegwerfen — nach Rückfrage, weil ein Schlüssel
// dazu danach nicht mehr einlösbar ist. Eine eingelöste hat keinen Knopf; sie steht im Journal.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'

const LicenceSettings = (await import('../src/components/LicenceSettings.vue')).default

const OFFEN = { id: 'k-aaa', kind: 'limit', plan: 'pro', week: 50000, month: 250000, days: 30, created: '2026-09-23T10:00:00Z', who: 'u1', hash: 'h1', text: '{"anforderung":"…"}' }
const EINGELOEST = { ...OFFEN, id: 'k-bbb', team: 'init', teamLabel: 'Init Team' }

function server(routen = {}) {
  const calls = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '')
    calls.push({ path, method: opts.method ?? 'GET' })
    const feste = {
      '/api/licence': { lic: { plan: 'free' }, geprueft: false, vonHand: true },
      '/api/licence/requests': [OFFEN, EINGELOEST],
      '/api/licence/keys': [{ id: 'k-bbb', kind: 'limit', team: 'init', from: '2026-09-23', until: '2026-10-23' }],
      '/api/licence/packages': [{ key: 'pro', label: 'Pro', week: 50000, month: 250000, days: 30 }],
    }
    const a = routen[path] ?? feste[path] ?? {}
    const status = a.__status ?? 200
    return { ok: status < 400, status, statusText: 'x', text: async () => JSON.stringify(a) }
  }
  return calls
}
const zeile = (w, id) => w.findAll('table.anforderungen tbody tr').find(r => r.find('td').text() === id)

test('offene Anforderung wegwerfen — mit Rückfrage; eine eingelöste hat keinen Knopf', async () => {
  const calls = server()
  store.auth = { known: true, enabled: true, setup: false, user: 'u1', role: 'admin', name: 'U1', rights: ['users'] }
  const frage = []
  const orig = dialog.confirm
  dialog.confirm = async o => { frage.push(o); return true }
  try {
    const w = mount(LicenceSettings, { props: { team: { key: 'init', label: 'Init Team' } } })
    await flushPromises()
    // der Weg von Hand steht zugeklappt da (26.09.2026) — aufklappen wie der Anwender
    await w.find('button.von-hand').trigger('click'); await flushPromises()
    assert.ok(!zeile(w, 'k-bbb').find('button.neg').exists(), 'eine eingelöste Anforderung wirft niemand weg')
    await zeile(w, 'k-aaa').find('button.neg').trigger('click')
    await flushPromises()
    assert.match(frage[0].title, /k-aaa/)
    assert.match(frage[0].warn, /nicht mehr einlösen/)
    const weg = calls.find(c => c.method === 'DELETE')
    assert.equal(weg.path, '/api/licence/requests/k-aaa')
    assert.ok(calls.filter(c => c.path === '/api/licence/requests' && c.method === 'GET').length >= 2, 'danach neu gelesen')
  } finally { dialog.confirm = orig }
})

test('wer die Rückfrage abbricht, wirft nichts weg', async () => {
  const calls = server()
  store.auth = { known: true, enabled: true, setup: false, user: 'u1', role: 'admin', name: 'U1', rights: ['users'] }
  const orig = dialog.confirm
  dialog.confirm = async () => false
  try {
    const w = mount(LicenceSettings, { props: { team: { key: 'init', label: 'Init Team' } } })
    await flushPromises()
    // der Weg von Hand steht zugeklappt da (26.09.2026) — aufklappen wie der Anwender
    await w.find('button.von-hand').trigger('click'); await flushPromises()
    await zeile(w, 'k-aaa').find('button.neg').trigger('click')
    await flushPromises()
    assert.ok(!calls.some(c => c.method === 'DELETE'))
  } finally { dialog.confirm = orig }
})
