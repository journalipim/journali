// Startphase (05.10.2026): alles ohne Grenzen — die Oberfläche zeigt nichts zu Lizenz, Limits und journali-Token, fragt nicht nach der
// Registrierung beim Lizenzserver und warnt vor keinem Kontingent. Ohne Startphase bleibt alles wie bisher.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'
import { api } from '../src/api.js'
import { frageNachRegistrierung } from '../src/registrierung.js'
import { reicht } from '../src/kontingent.js'

const TeamsSettings = (await import('../src/components/TeamsSettings.vue')).default
const TeamsAdmin = (await import('../src/components/TeamsAdmin.vue')).default

function server() {
  const abrufe = []
  globalThis.fetch = async url => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    abrufe.push(path)
    const body = path === '/api/teams' ? [{ key: 'init', label: 'Init Team', payer: 'init', managers: ['u1'], keys: [], primary: true, members: 1, entriesWeek: 100, entriesMonth: 400 }]
      : path.endsWith('/members') ? []
      : path === '/api/teams/free' ? []
      : path === '/api/licence' ? { tarif: { key: 'pro', label: 'Pro' }, geprueft: true, entriesWeek: 100, entriesMonth: 400 }
      : path.endsWith('/tokens/journali') ? { team: 'init', payer: 'init', payerLabel: 'Init Team', limits: { week: 1, month: 1 }, used: {}, mine: {}, head: 1, today: '2026-10-05', resetWeek: '2026-10-05', resetMonth: '2026-11-01', history: [] }
      : path.endsWith('/usage') ? { days: [] }
      : path === '/api/auth/people' || path === '/api/auth/users' ? [{ key: 'u1', name: 'U1' }]
      : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
  return abrufe
}
const ruhe = async () => { for (let i = 0; i < 4; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }

for (const startphase of [true, false]) {
  test(`Team-Reiter ${startphase ? 'in der Startphase: ohne' : 'ohne Startphase: mit'} Lizenz und Limits`, async () => {
    server()
    store.startphase = startphase
    store.auth = { known: true, enabled: true, user: 'u1', role: 'admin', rights: ['read', 'team', 'users'] }
    const w = mount(TeamsSettings); await ruhe()
    const text = w.text()
    assert.equal(/journali Limits/.test(text), !startphase, 'Limits')
    assert.equal(w.find('.limits').exists(), !startphase)
    assert.equal(/Lizenz/.test(w.html().replace(/<!--[\s\S]*?-->/g, '')), !startphase, 'nichts zur Lizenz, auch nicht im Tooltip')
    w.unmount(); await ruhe()
  })

  test(`Teams verwalten ${startphase ? 'in der Startphase: KI-Schlüssel statt Token, keine Spalten Woche und Monat' : 'ohne Startphase: Token, Woche, Monat'}`, async () => {
    server()
    store.startphase = startphase
    store.auth = { known: true, enabled: true, user: 'u1', role: 'admin', rights: ['read', 'team', 'users'] }
    const w = mount(TeamsAdmin); await ruhe()
    const koepfe = w.findAll('th').map(th => th.text())
    assert.equal(koepfe.includes('KI-Schlüssel'), startphase)
    assert.equal(koepfe.includes('Token'), !startphase)
    assert.equal(koepfe.some(k => /Woche/.test(k)), !startphase)
    assert.equal(/aus der Lizenz vergeben/.test(w.text()), !startphase)
    w.unmount(); await ruhe()
  })
}

test('Startphase: keine Frage nach der Registrierung, keine Abfrage des Kontingents', async () => {
  const abrufe = server()
  store.startphase = true
  store.registriert = null
  store.auth = { known: true, enabled: true, user: 'u1', role: 'admin', rights: ['read', 'users'] }
  assert.equal(await frageNachRegistrierung(), false)
  const get = api.get; let gefragt = 0
  api.get = async p => { gefragt++; return get(p) }
  try { assert.equal(await reicht({ label: 'Import', eintraege: 10 ** 9 }), true) } finally { api.get = get }
  assert.equal(gefragt, 0, 'kein /api/jobs/verfuegbar')
  assert.ok(!abrufe.some(p => p.startsWith('/api/licence')))
  store.startphase = false
})
