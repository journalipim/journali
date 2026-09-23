// Einstellungen → Teams → Lizenz → Schlüssel (Taloan, 23.09.2026): anfordern (die Instanz signiert), kopieren, den
// ausgestellten Schlüssel für ein Team einlösen. Geprüft wird, was die Oberfläche schickt und was sie danach zeigt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises, button } from './ui.mjs'
import { store } from '../src/store.js'

const LicenceSettings = (await import('../src/components/LicenceSettings.vue')).default

/// Server mit einer offenen und einer eingelösten Anforderung; zwei Teams, Italien rechnet über Deutschland ab
function server({ fehler = null } = {}) {
  const gesendet = []
  const anforderungen = [
    { id: 'k-1', kind: 'limit', week: 30000, month: 100000, days: 30, created: '2026-09-23T10:00:00Z', text: '{"anforderung":"…1","sig":"x"}', team: null },
    { id: 'k-0', kind: 'reset', week: 0, month: 0, days: 0, created: '2026-09-22T10:00:00Z', text: '{"anforderung":"…0","sig":"y"}', team: 'de', teamLabel: 'Deutschland' },
  ]
  globalThis.fetch = async (url, opt = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    const method = opt.method ?? 'GET'
    if (method !== 'GET') gesendet.push({ method, path, body: JSON.parse(opt.body) })
    let status = 200, body
    if (path === '/api/licence') body = { plan: 'Klein', instanz: 'abc', entriesWeek: 20000, entriesMonth: 100000 }
    else if (path === '/api/licence/requests' && method === 'GET') body = anforderungen
    else if (path === '/api/licence/requests') body = [{ id: 'k-2', hash: 'h', text: '{"anforderung":"neu","sig":"z"}' }]
    else if (path === '/api/licence/keys' && method === 'GET') body = [{ id: 'k-0', kind: 'reset', team: 'de', teamLabel: 'Deutschland', from: '2026-09-22', until: null, carried: 0 }]
    else if (path === '/api/licence/keys') body = fehler ? (status = 400, { error: fehler }) : { id: 'k-1', kind: 'limit', team: 'de', from: '2026-09-23', until: '2026-10-22', carried: 0, geprueft: true }
    else body = {}
    return { ok: status < 400, status, text: async () => JSON.stringify(body) }
  }
  return gesendet
}

function admin(rechte = ['users']) {
  store.auth = { known: true, enabled: true, setup: true, user: 'admin', role: 'admin', name: 'Admin', rights: rechte }
  store.actor = 'admin'
  store.poll = async () => {}
}

test('Anfordern schickt Art und Grenzen und zeigt die signierte Anforderung zum Kopieren', async () => {
  const gesendet = server(); admin()
  const w = mount(LicenceSettings); await flushPromises()
  await w.find('.anfordern select').setValue('limit')
  const [woche, monat, tage] = w.findAll('.anfordern input[type=number]')
  await woche.setValue('30000'); await monat.setValue('150000'); await tage.setValue('30')
  await button(w, 'Anfordern').trigger('click'); await flushPromises()
  const post = gesendet.find(g => g.path === '/api/licence/requests')
  assert.ok(post, 'keine Anforderung gesendet')
  assert.deepEqual({ ...post.body }, { kind: 'limit', entriesWeek: 30000, entriesMonth: 150000, days: 30, count: 1 })
  assert.equal(w.find('textarea.angefordert').element.value, '{"anforderung":"neu","sig":"z"}')
  w.unmount()
})

test('Anforderungen zeigen, was offen und was eingelöst ist', async () => {
  server(); admin()
  const w = mount(LicenceSettings); await flushPromises()
  const zeilen = w.findAll('table.anforderungen tbody tr')
  assert.equal(zeilen.length, 2)
  assert.match(zeilen[0].text(), /offen/)
  assert.ok(zeilen[0].find('button').exists(), 'offene Anforderung ohne Kopierknopf')
  assert.match(zeilen[1].text(), /Deutschland/)
  assert.equal(w.findAll('table.einloesungen tbody tr').length, 1)
  w.unmount()
})

const DE = { key: 'de', label: 'Deutschland', payer: 'de' }
const IT = { key: 'it', label: 'Italien', payer: 'de' }

test('Eingelöst wird für das Team, das oben gewählt ist — keine eigene Auswahl', async () => {
  const gesendet = server(); admin()
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  assert.equal(w.find('.einloesen select').exists(), false, 'eine zweite Teamauswahl steht da')
  assert.match(button(w, 'Einlösen').text(), /Einlösen · Deutschland/, 'das Team steht nicht im Knopf')
  assert.ok(button(w, 'Einlösen').attributes('disabled') !== undefined, 'ohne Schlüssel darf nichts einzulösen sein')
  await w.find('.einloesen textarea').setValue('{"id":"k-1"}')
  await button(w, 'Einlösen').trigger('click'); await flushPromises()
  const post = gesendet.find(g => g.path === '/api/licence/keys')
  assert.deepEqual({ ...post.body }, { key: '{"id":"k-1"}', team: 'de' })
  assert.match(w.find('.said-key').text(), /✓ k-1 bis 2026-10-22/)
  assert.equal(w.find('.einloesen textarea').element.value, '', 'der eingelöste Schlüssel bleibt stehen')
  w.unmount()
})

test('Text vor und nach dem Schlüssel geht nicht mit', async () => {
  // aus dem Konsolenfenster kopiert: Schlüssel und die Zeile darunter
  const gesendet = server(); admin()
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  await w.find('.einloesen textarea').setValue('C:\\> aussteller\n{"id":"k-1","sig":"a=="}\nJOURNALI_LICENCE_KEY=MFkw==\n')
  await button(w, 'Einlösen').trigger('click'); await flushPromises()
  assert.equal(gesendet.find(g => g.path === '/api/licence/keys').body.key, '{"id":"k-1","sig":"a=="}')
  w.unmount()
})

test('Wer über ein anderes Team abrechnet, hat kein Einlösen', async () => {
  server(); admin()
  const w = mount(LicenceSettings, { props: { team: IT } }); await flushPromises()
  assert.equal(w.find('.einloesen').exists(), false)
  w.unmount()
})

test('Ein abgelehnter Schlüssel sagt, warum', async () => {
  server({ fehler: 'Zu Schlüssel k-9 gibt es hier keine Anforderung.' }); admin()
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  await w.find('.einloesen textarea').setValue('{"id":"k-9"}')
  await button(w, 'Einlösen').trigger('click'); await flushPromises()
  assert.match(w.find('.said-key').text(), /✗ Zu Schlüssel k-9 gibt es hier keine Anforderung/)
  assert.ok(w.find('.said-key').classes().includes('fehler'), 'die Fehlermeldung ist nicht rot und fett')
  w.unmount()
})

test('Ohne Recht zur Benutzerverwaltung keine Schlüssel', async () => {
  server(); admin(['read'])
  const w = mount(LicenceSettings); await flushPromises()
  assert.equal(w.find('.schluessel').exists(), false)
  w.unmount()
})
