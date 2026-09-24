// Einstellungen → Team → Lizenz: anfordern (die Instanz signiert), kopieren, den ausgestellten
// Schlüssel für das oben gewählte Team einlösen. Lizenz und Schlüssel kommen in dasselbe Feld mit einem Knopf
// („ich habe zwei Eingabefelder mit jeweils einem Knopf — ich brauche eins“) — der Knopf sagt, was damit geschieht.
// Geprüft wird, was die Oberfläche schickt und was sie danach zeigt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises, button } from './ui.mjs'
import { store } from '../src/store.js'

const LicenceSettings = (await import('../src/components/LicenceSettings.vue')).default

/// Server mit einer offenen und einer eingelösten Anforderung
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
    if (path === '/api/licence' && method === 'GET') body = { plan: 'enterprise', instanz: 'abc', entriesWeek: 200000, entriesMonth: 1000000, validUntil: '2026-12-23', trial: true, tarif: { key: 'enterprise', label: 'Enterprise' }, instanzTarif: { key: 'enterprise', label: 'Enterprise', pubTrees: null }, pubTrees: 3 }
    else if (path === '/api/licence') body = { plan: 'Gross', geprueft: true }
    else if (path === '/api/licence/requests' && method === 'GET') body = anforderungen
    else if (path === '/api/licence/requests') body = [{ id: 'k-2', hash: 'h', text: '{"anforderung":"neu","sig":"z"}' }]
    else if (path === '/api/licence/packages') body = [{ key: 'pro', label: 'Pro', week: 50000, month: 250000, days: 30 }, { key: 'proplus', label: 'Pro+', week: 50000, month: 250000, days: 30 }, { key: 'enterprise', label: 'Enterprise', week: 200000, month: 1000000, days: 30 }, { key: 'unlimited', label: 'Unlimited', week: 2147483647, month: 2147483647, days: 30 }]
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

const DE = { key: 'de', label: 'Deutschland', payer: 'de' }
const IT = { key: 'it', label: 'Italien', payer: 'de' }
const SCHLUESSEL = '{"id":"k-1","kind":"limit","request":"ab12","sig":"a=="}'
const knopf = w => w.find('.uebernahme button')

test('Angefordert wird ein Paket — keine freien Zahlen', async () => {
  const gesendet = server(); admin()
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  assert.equal(w.findAll('.anfordern input').length, 0, 'beim Anfordern stehen freie Eingabefelder')
  const wahl = w.find('.anfordern select.wahl')
  assert.deepEqual(wahl.findAll('option').map(o => o.text().replace(/\s+/g, ' ')), [
    '↺ Reset Pro',
    '↺ Reset Enterprise',
    '⇡ Pro · 50.000 / Woche · 250.000 / Monat · 30 Tage',
    '⇡ Pro+ · 50.000 / Woche · 250.000 / Monat · 30 Tage',
    '⇡ Enterprise · 200.000 / Woche · 1.000.000 / Monat · 30 Tage',
    '⇡ Unlimited · ∞ / Woche · ∞ / Monat · 30 Tage',
  ], 'die Pakete stehen ohne ihre Werte da')
  await wahl.setValue('enterprise')
  await w.find('.anfordern select.anzahl').setValue('5')
  await button(w, 'Anfordern').trigger('click'); await flushPromises()
  const post = gesendet.find(g => g.path === '/api/licence/requests')
  assert.ok(post, 'keine Anforderung gesendet')
  assert.deepEqual({ ...post.body }, { kind: 'limit', plan: 'enterprise', count: 5 })
  assert.equal(w.find('textarea.angefordert').element.value, '{"anforderung":"neu","sig":"z"}')
  w.unmount()
})

test('Reset getrennt für Pro und Enterprise', async () => {
  const gesendet = server(); admin()
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  await button(w, 'Anfordern').trigger('click'); await flushPromises()
  assert.deepEqual({ ...gesendet.find(g => g.path === '/api/licence/requests').body }, { kind: 'reset', plan: 'pro', count: 1 })
  await w.find('.anfordern select.wahl').setValue('reset:enterprise')
  await button(w, 'Anfordern').trigger('click'); await flushPromises()
  assert.deepEqual({ ...gesendet.filter(g => g.path === '/api/licence/requests')[1].body }, { kind: 'reset', plan: 'enterprise', count: 1 })
  w.unmount()
})

test('Tarif, Test und Publikationsbäume stehen bei der Lizenz', async () => {
  server(); admin()
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  assert.equal(w.findAll('tr.tarif td')[1].text().replace(/\s+/g, ' '), 'Enterprise · Test')
  assert.match(w.find('tr.baeume').text().replace(/\s+/g, ' '), /3 \/ ∞/)
  w.unmount()
})

test('Eine Tabelle: je Anforderung eine Zeile, eingelöst steht in derselben Zeile', async () => {
  // „jedes Mal raten, welche Tabelle denn nun was für eine Tabelle ist“
  server(); admin()
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  assert.equal(w.findAll('table').length, 2, 'neben Lizenz und Anforderungen steht noch eine Tabelle')
  const zeilen = w.findAll('table.anforderungen tbody tr')
  assert.equal(zeilen.length, 2)
  assert.match(zeilen[0].text(), /offen/)
  assert.ok(zeilen[0].find('button').exists(), 'offene Anforderung ohne Kopierknopf')
  assert.match(zeilen[1].text(), /Reset.*✓ 2026-09-22.*Deutschland/)
  assert.equal(zeilen[1].find('button').exists(), false, 'eine eingelöste Anforderung lässt sich noch kopieren')
  w.unmount()
})

test('Ein Eingabefeld, ein Knopf — für Lizenz und Schlüssel', async () => {
  server(); admin()
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  assert.equal(w.findAll('textarea:not(.angefordert)').length, 1, 'es stehen mehrere Eingabefelder da')
  assert.equal(w.findAll('button.primary').length, 1, 'es stehen mehrere Übernahmeknöpfe da')
  assert.equal(w.findAll('select:not(.wahl):not(.anzahl)').length, 0, 'eine Teamauswahl steht da — das Team ist oben gewählt')
  assert.ok(knopf(w).attributes('disabled') !== undefined, 'ohne Eingabe darf nichts zu übernehmen sein')
  w.unmount()
})

test('Ein Schlüssel wird für das oben gewählte Team eingelöst — das Team steht im Knopf', async () => {
  const gesendet = server(); admin()
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  await w.find('.eingabe').setValue(SCHLUESSEL)
  assert.match(knopf(w).text(), /Einlösen · Deutschland/)
  await knopf(w).trigger('click'); await flushPromises()
  assert.deepEqual({ ...gesendet.find(g => g.path === '/api/licence/keys').body }, { key: SCHLUESSEL, team: 'de' })
  assert.equal(gesendet.some(g => g.path === '/api/licence'), false, 'der Schlüssel ging als Lizenz hinaus')
  assert.match(w.find('.said').text(), /✓ k-1 bis 2026-10-22/)
  assert.equal(w.find('.eingabe').element.value, '', 'der eingelöste Schlüssel bleibt stehen')
  w.unmount()
})

test('Eine Lizenz wird eingespielt, nicht eingelöst', async () => {
  const gesendet = server(); admin()
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  await w.find('.eingabe').setValue('{"plan":"Gross","entriesWeek":50000,"sig":"x"}')
  assert.match(knopf(w).text(), /Lizenz einspielen/)
  await knopf(w).trigger('click'); await flushPromises()
  const put = gesendet.find(g => g.path === '/api/licence')
  assert.equal(put?.method, 'PUT')
  assert.equal(put.body.plan, 'Gross')
  assert.equal(gesendet.some(g => g.path === '/api/licence/keys'), false)
  w.unmount()
})

test('Text vor und nach dem Schlüssel geht nicht mit', async () => {
  // aus dem Konsolenfenster kopiert: Marker davor und danach
  const gesendet = server(); admin()
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  await w.find('.eingabe').setValue(`-----BEGIN JOURNALI KEY-----\n${SCHLUESSEL}\n-----END JOURNALI KEY-----\n`)
  await knopf(w).trigger('click'); await flushPromises()
  assert.equal(gesendet.find(g => g.path === '/api/licence/keys').body.key, SCHLUESSEL)
  w.unmount()
})

test('Eine zurückkopierte Anforderung wird nicht übernommen', async () => {
  server(); admin()
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  await w.find('.eingabe').setValue('{"anforderung":"{}","sig":"z"}')
  assert.ok(knopf(w).attributes('disabled') !== undefined)
  w.unmount()
})

test('Wer über ein anderes Team abrechnet, kann keinen Schlüssel einlösen', async () => {
  server(); admin()
  const w = mount(LicenceSettings, { props: { team: IT } }); await flushPromises()
  await w.find('.eingabe').setValue(SCHLUESSEL)
  assert.ok(knopf(w).attributes('disabled') !== undefined)
  assert.match(knopf(w).attributes('title'), /rechnet über ein anderes Team ab/)
  w.unmount()
})

test('Ein abgelehnter Schlüssel sagt, warum — rot und fett', async () => {
  server({ fehler: 'Zu Schlüssel k-9 gibt es hier keine Anforderung.' }); admin()
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  await w.find('.eingabe').setValue(SCHLUESSEL)
  await knopf(w).trigger('click'); await flushPromises()
  assert.match(w.find('.said').text(), /✗ Zu Schlüssel k-9 gibt es hier keine Anforderung/)
  assert.ok(w.find('.said').classes().includes('fehler'), 'die Fehlermeldung ist nicht rot und fett')
  w.unmount()
})

test('Ohne Recht zur Anwenderverwaltung weder Feld noch Schlüssel', async () => {
  server(); admin(['read'])
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  assert.equal(w.find('.schluessel').exists(), false)
  assert.equal(w.find('.eingabe').exists(), false)
  w.unmount()
})
