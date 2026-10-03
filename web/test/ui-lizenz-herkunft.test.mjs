// ⚿ journali Lizenz (03.10.2026): woher der Tarif kommt, ein entzogenes Abo zeigt zuerst seinen Zustand, und ein Schlüssel aus dem Journal
// zählt nicht, sobald das Team einen Stand vom Lizenzserver hat — es gilt, was der Lizenzserver sagt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'

const LicenceSettings = (await import('../src/components/LicenceSettings.vue')).default

function server(lic) {
  globalThis.fetch = async url => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    const body = path === '/api/licence' ? lic : path === '/api/licence/keys' ? [] : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
}
const INIT = { key: 'init', label: 'Init Team', payer: 'init', primary: true, managers: ['admin'] }
const basis = { plan: 'free', instanz: 'abc', entriesWeek: 10000, entriesMonth: 50000, geprueft: true, trial: false, lizenzserver: true, registriert: true, pubTrees: 2 }
store.auth = { known: true, enabled: true, setup: true, user: 'admin', role: 'admin', rights: ['users'] }

test('entzogenes Abo: erst der Zustand, der Schlüssel zählt nicht, der Tarif sagt, woher er kommt', async () => {
  server({ ...basis, instanzTarif: { key: 'free', label: 'Kostenlos', pubTrees: 1 }, quelle: { art: 'lizenz' },
    abos: [{ team: 'init', teamLabel: 'Init Team', plan: 'unlimited', planLabel: 'Unlimited', status: 'entzogen', paidUntil: '2026-10-02', issued: '2026-10-03T10:15:33Z', geprueft: true, gilt: false }],
    schluessel: [{ team: 'init', teamLabel: 'Init Team', id: 'k-3b12', plan: 'pro', planLabel: 'Pro', from: '2026-09-25', until: '2026-10-24', zaehlt: false }] })
  const w = mount(LicenceSettings, { props: { team: INIT } }); await flushPromises()
  assert.match(w.find('tr.tarif').text(), /Kostenlos\s*· aus der Lizenz/)
  const abo = w.find('tr.abo').text()
  assert.match(abo, /^.*✗ entzogen\s*· Unlimited bis 2026-10-02/, 'der Zustand steht vorn, der Tarif dahinter')
  assert.ok(w.find('tr.abo .abo-grund').classes().includes('neg'))
  const k = w.find('tr.schluessel')
  assert.match(k.text(), /Schlüssel · Init Team\s*Pro\s*· 2026-09-25 bis 2026-10-24\s*· zählt nicht/)
  w.unmount()
})

test('Tarif aus einem Schlüssel oder einem Abo nennt Team und Tag', async () => {
  server({ ...basis, instanzTarif: { key: 'pro', label: 'Pro', pubTrees: 5 }, quelle: { art: 'schluessel', team: 'init', teamLabel: 'Init Team', bis: '2026-10-24' }, abos: [],
    schluessel: [{ team: 'init', teamLabel: 'Init Team', id: 'k-3b12', plan: 'pro', planLabel: 'Pro', from: '2026-09-25', until: '2026-10-24', zaehlt: true }] })
  let w = mount(LicenceSettings, { props: { team: INIT } }); await flushPromises()
  assert.match(w.find('tr.tarif').text(), /Pro\s*· aus einem Schlüssel von Init Team bis 2026-10-24/)
  assert.ok(!w.find('tr.schluessel .zaehlt-nicht').exists())
  w.unmount()

  server({ ...basis, instanzTarif: { key: 'unlimited', label: 'Unlimited', pubTrees: null }, quelle: { art: 'abo', team: 'init', teamLabel: 'Init Team', bis: '2026-10-24' },
    abos: [{ team: 'init', teamLabel: 'Init Team', plan: 'unlimited', planLabel: 'Unlimited', status: 'active', paidUntil: '2026-10-24', issued: '2026-10-03T10:15:33Z', geprueft: true, gilt: true }], schluessel: [] })
  w = mount(LicenceSettings, { props: { team: INIT } }); await flushPromises()
  assert.match(w.find('tr.tarif').text(), /Unlimited\s*· aus dem Abo von Init Team bis 2026-10-24/)
  assert.match(w.find('tr.abo').text(), /Unlimited\s*· gültig bis 2026-10-24/)
  assert.ok(!w.find('tr.abo .abo-grund').exists())
  w.unmount()
})
