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
function server({ fehler = null, lizenzserver = true, abos = [], lizenz = {} } = {}) {
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
    if (path === '/api/licence' && method === 'GET') body = { plan: 'enterprise', instanz: 'abc', entriesWeek: 200000, entriesMonth: 1000000, validUntil: '2026-12-23', trial: true, geprueft: true, tarif: { key: 'enterprise', label: 'Enterprise' }, instanzTarif: { key: 'enterprise', label: 'Enterprise', pubTrees: null }, pubTrees: 3, lizenzserver, abos, ...lizenz }
    else if (path === '/api/licence/abo') body = { team: 'de', plan: 'enterprise', planLabel: 'Enterprise', status: 'active', paidUntil: '2026-10-24', geprueft: true }
    else if (path === '/api/licence/abo/de/auffrischen') body = { team: 'de', plan: 'pro', planLabel: 'Pro', status: 'active', paidUntil: '2026-11-24', geprueft: true }
    else if (path === '/api/licence') body = { plan: 'Gross', geprueft: true }
    else if (path === '/api/licence/requests' && method === 'GET') body = anforderungen
    else if (path === '/api/licence/requests') body = [{ id: 'k-2', hash: 'h', text: '{"anforderung":"neu","sig":"z"}' }]
    else if (path === '/api/licence/packages') body = [{ key: 'pro', label: 'Pro', week: 50000, month: 250000, days: 30 }, { key: 'proplus', label: 'Pro+', week: 50000, month: 250000, days: 30, alle: true }, { key: 'enterprise', label: 'Enterprise', week: 200000, month: 1000000, days: 30, alle: true }, { key: 'unlimited', label: 'Unlimited', week: 2147483647, month: 2147483647, days: 30, alle: true }]
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
/// Der Weg von Hand steht zugeklappt da (26.09.2026) — im Prüfstand wird er aufgeklappt wie beim Anwender
async function montiere(props) {
  const w = mount(LicenceSettings, { props }); await flushPromises()
  if (w.find('button.von-hand').exists()) { await w.find('button.von-hand').trigger('click'); await flushPromises() }
  return w
}

test('Angefordert wird ein Paket — keine freien Zahlen', async () => {
  const gesendet = server(); admin()
  const w = await montiere({ team: DE })
  assert.equal(w.findAll('.anfordern input').length, 0, 'beim Anfordern stehen freie Eingabefelder')
  const wahl = w.find('.anfordern select.wahl')
  assert.deepEqual(wahl.findAll('option').map(o => o.text().replace(/\s+/g, ' ')), [
    '↺ Reset Pro',
    '↺ Reset Enterprise',
    '⇡ Pro · 50.000 / Woche · 250.000 / Monat · 30 Tage',
    '⇡ Pro+ · 50.000 / Woche · 250.000 / Monat · 30 Tage · alle Core-Plugins',
    '⇡ Enterprise · 200.000 / Woche · 1.000.000 / Monat · 30 Tage · alle Core-Plugins',
    '⇡ Unlimited · ∞ / Woche · ∞ / Monat · 30 Tage · alle Core-Plugins',
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

test('Token je Woche und Monat: das Kontingent des Teams, nicht die Lizenz allein', async () => {
  // 25.09.2026: Lizenz Kostenlos (10.000 / 50.000), Abo Pro am Init Team — oben stand 10.000, unter den Limits 50.000
  server(); admin()
  const w = await montiere({ team: DE, limits: { week: 50000, month: 250000 } })
  assert.equal(w.find('td.woche').text(), '50.000')
  assert.equal(w.find('td.monat').text(), '250.000')
  assert.match(w.find('td.woche').attributes('title'), /200\.000/, 'der Wert der Lizenz steht nicht im Tooltip')
  w.unmount()
  const ohne = await montiere({ team: DE })
  assert.equal(ohne.find('td.woche').text(), '200.000', 'ohne Kontingent gilt die Lizenz')
  ohne.unmount()
  // Italien rechnet über Deutschland ab: seine Limits sind die des Zahlers — oben stehen keine
  const it = await montiere({ team: IT, limits: { week: 50000, month: 250000 } })
  assert.equal(it.find('td.woche').exists(), false, 'Token je Woche bei einem Team, das über ein anderes abrechnet')
  assert.equal(it.find('td.monat').exists(), false, 'Token je Monat bei einem Team, das über ein anderes abrechnet')
  it.unmount()
})

test('Reset getrennt für Pro und Enterprise', async () => {
  const gesendet = server(); admin()
  const w = await montiere({ team: DE })
  await button(w, 'Anfordern').trigger('click'); await flushPromises()
  assert.deepEqual({ ...gesendet.find(g => g.path === '/api/licence/requests').body }, { kind: 'reset', plan: 'pro', count: 1 })
  await w.find('.anfordern select.wahl').setValue('reset:enterprise')
  await button(w, 'Anfordern').trigger('click'); await flushPromises()
  assert.deepEqual({ ...gesendet.filter(g => g.path === '/api/licence/requests')[1].body }, { kind: 'reset', plan: 'enterprise', count: 1 })
  w.unmount()
})

test('Tarif, Test und Publikationsbäume stehen bei der Lizenz', async () => {
  server(); admin()
  const w = await montiere({ team: DE })
  assert.equal(w.findAll('tr.tarif td')[1].text().replace(/\s+/g, ' '), 'Enterprise · Test')
  assert.match(w.find('tr.baeume').text().replace(/\s+/g, ' '), /3 \/ ∞/)
  w.unmount()
})

test('Eine Tabelle: je Anforderung eine Zeile, eingelöst steht in derselben Zeile', async () => {
  // „jedes Mal raten, welche Tabelle denn nun was für eine Tabelle ist“
  server(); admin()
  const w = await montiere({ team: DE })
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
  const w = await montiere({ team: DE })
  assert.equal(w.findAll('textarea:not(.angefordert)').length, 1, 'es stehen mehrere Eingabefelder da')
  assert.equal(w.findAll('button.primary').length, 1, 'es stehen mehrere Übernahmeknöpfe da')
  assert.equal(w.findAll('select:not(.wahl):not(.anzahl)').length, 0, 'eine Teamauswahl steht da — das Team ist oben gewählt')
  assert.ok(knopf(w).attributes('disabled') !== undefined, 'ohne Eingabe darf nichts zu übernehmen sein')
  w.unmount()
})

test('Ein Schlüssel wird für das oben gewählte Team eingelöst — das Team steht im Knopf', async () => {
  const gesendet = server(); admin()
  const w = await montiere({ team: DE })
  await w.find('.eingabe').setValue(SCHLUESSEL)
  assert.match(knopf(w).text(), /Einlösen · Deutschland/)
  await knopf(w).trigger('click'); await flushPromises()
  assert.deepEqual({ ...gesendet.find(g => g.path === '/api/licence/keys').body }, { key: SCHLUESSEL, team: 'de' })
  assert.equal(gesendet.some(g => g.path === '/api/licence'), false, 'der Schlüssel ging als Lizenz hinaus')
  assert.match(w.find('.said').text(), /✓ k-1 bis 2026-10-22/)
  assert.equal(w.find('.eingabe').element.value, '', 'der eingelöste Schlüssel bleibt stehen')
  w.unmount()
})

/// Ein Schlüssel, den der Lizenzserver von sich aus ausstellt, hat keine Anforderung — er nennt die Instanz (25.09.2026).
test('Ein Schlüssel ohne Anforderung wird eingelöst', async () => {
  const gesendet = server(); admin()
  const w = await montiere({ team: DE })
  const direkt = '{"id":"k-direkt","kind":"limit","instance":"abc","entriesWeek":50000,"days":30,"plan":"pro","sig":"a=="}'
  await w.find('.eingabe').setValue('-----BEGIN JOURNALI KEY-----\n' + direkt + '\n-----END JOURNALI KEY-----')
  assert.match(knopf(w).text(), /Einlösen · Deutschland/)
  await knopf(w).trigger('click'); await flushPromises()
  assert.deepEqual({ ...gesendet.find(g => g.path === '/api/licence/keys').body }, { key: direkt, team: 'de' })
  w.unmount()
})

/// Eine Lizenz für die ganze Instanz gibt es nicht (25.09.2026) — eine Lizenzdatei wird nicht angenommen.
test('Eine Lizenzdatei wird nicht angenommen', async () => {
  const gesendet = server(); admin()
  const w = await montiere({ team: DE })
  await w.find('.eingabe').setValue('{"plan":"unlimited","entriesWeek":50000,"sig":"x"}')
  assert.ok(knopf(w).attributes('disabled') !== undefined, 'eine Lizenzdatei lässt sich übernehmen')
  assert.match(knopf(w).attributes('title'), /kein Schlüssel/)
  await knopf(w).trigger('click'); await flushPromises()
  assert.equal(gesendet.some(g => g.path === '/api/licence' || g.path === '/api/licence/keys'), false)
  w.unmount()
})

test('Text vor und nach dem Schlüssel geht nicht mit', async () => {
  // aus dem Konsolenfenster kopiert: Marker davor und danach
  const gesendet = server(); admin()
  const w = await montiere({ team: DE })
  await w.find('.eingabe').setValue(`-----BEGIN JOURNALI KEY-----\n${SCHLUESSEL}\n-----END JOURNALI KEY-----\n`)
  await knopf(w).trigger('click'); await flushPromises()
  assert.equal(gesendet.find(g => g.path === '/api/licence/keys').body.key, SCHLUESSEL)
  w.unmount()
})

test('Eine zurückkopierte Anforderung wird nicht übernommen', async () => {
  server(); admin()
  const w = await montiere({ team: DE })
  await w.find('.eingabe').setValue('{"anforderung":"{}","sig":"z"}')
  assert.ok(knopf(w).attributes('disabled') !== undefined)
  w.unmount()
})

test('Wer über ein anderes Team abrechnet, kann keinen Schlüssel einlösen', async () => {
  server(); admin()
  const w = await montiere({ team: IT })
  await w.find('.eingabe').setValue(SCHLUESSEL)
  assert.ok(knopf(w).attributes('disabled') !== undefined)
  assert.match(knopf(w).attributes('title'), /rechnet über ein anderes Team ab/)
  w.unmount()
})

test('Ein abgelehnter Schlüssel sagt, warum — rot und fett', async () => {
  server({ fehler: 'Zu Schlüssel k-9 gibt es hier keine Anforderung.' }); admin()
  const w = await montiere({ team: DE })
  await w.find('.eingabe').setValue(SCHLUESSEL)
  await knopf(w).trigger('click'); await flushPromises()
  assert.match(w.find('.said').text(), /✗ Zu Schlüssel k-9 gibt es hier keine Anforderung/)
  assert.ok(w.find('.said').classes().includes('fehler'), 'die Fehlermeldung ist nicht rot und fett')
  w.unmount()
})

test('Ohne Recht zur Anwenderverwaltung weder Feld noch Schlüssel', async () => {
  server(); admin(['read'])
  const w = await montiere({ team: DE })
  assert.equal(w.find('.schluessel').exists(), false)
  assert.equal(w.find('.eingabe').exists(), false)
  w.unmount()
})

// Abo über den Lizenzserver (Taloan, 24.09.2026): der Lizenzschlüssel aus dem Shop kommt in dasselbe Feld
const ABO_KEY = '495C1AF0-1CFB-4C24-824E-A46A6242841D'

test('Ein Lizenzschlüssel aus dem Shop verbindet das Abo des oben gewählten Teams', async () => {
  const gesendet = server(); admin()
  const w = await montiere({ team: DE })
  await w.find('.eingabe').setValue('Ihr Lizenzschlüssel: ' + ABO_KEY + '\n')
  assert.match(knopf(w).text(), /Abo verbinden · Deutschland/)
  assert.equal(knopf(w).attributes('disabled'), undefined)
  await knopf(w).trigger('click'); await flushPromises()
  assert.deepEqual({ ...gesendet.find(g => g.path === '/api/licence/abo').body }, { team: 'de', key: ABO_KEY })
  assert.equal(gesendet.some(g => g.path === '/api/licence/keys' || g.path === '/api/licence'), false, 'das Abo ging als Schlüssel oder Lizenz hinaus')
  assert.match(w.find('.said').text(), /✓ Abo Enterprise · gültig bis 2026-10-24/)
  w.unmount()
})

test('Ohne Lizenzserver lässt sich kein Abo verbinden', async () => {
  server({ lizenzserver: false }); admin()
  const w = await montiere({ team: DE })
  await w.find('.eingabe').setValue(ABO_KEY)
  assert.ok(knopf(w).attributes('disabled') !== undefined)
  assert.match(knopf(w).attributes('title'), /Kein Lizenzserver/)
  w.unmount()
})

test('Wer über ein anderes Team abrechnet, verbindet kein Abo', async () => {
  server(); admin()
  const w = await montiere({ team: IT })
  await w.find('.eingabe').setValue(ABO_KEY)
  assert.ok(knopf(w).attributes('disabled') !== undefined)
  w.unmount()
})

test('↻ holt den Stand des Abos sofort neu — nach einem Eingriff auf dem Lizenzserver', async () => {
  const abo = { team: 'de', teamLabel: 'Deutschland', plan: 'enterprise', planLabel: 'Enterprise', status: 'active', paidUntil: '2026-10-24', issued: '2026-09-24T10:00:00Z', gilt: true, geprueft: true }
  const gesendet = server({ abos: [abo] }); admin()
  let eingespielt = 0
  const w = await montiere({ team: DE, onEingespielt: () => eingespielt++ })
  await w.find('tr.abo button.auffrischen').trigger('click'); await flushPromises()
  assert.ok(gesendet.some(g => g.method === 'POST' && g.path === '/api/licence/abo/de/auffrischen'), 'nicht aufgefrischt')
  assert.match(w.find('.said').text(), /✓ Abo Pro · gültig bis 2026-11-24/)
  assert.equal(eingespielt, 1, 'die Limits darunter werden nicht neu geladen')
  w.unmount()
  // ohne das Recht users, bei einem anderen Team oder ohne Lizenzserver: kein Knopf
  admin(['read'])
  const v = await montiere({ team: DE })
  assert.equal(v.find('tr.abo button.auffrischen').exists(), false)
  v.unmount()
})

/// Eine Instanz hat keine Lizenz — jede gehört einem Team (25.09.2026). Gemeldet: oben stand „ungeprüft“, dann
/// „Kostenlos“ über „Tarif Pro“, beides für eine Lizenz der Instanz. Übrig bleibt der Test, beim Init Team.
test('Keine Lizenz der Instanz — der Test steht beim Init Team', async () => {
  server({ lizenz: { geprueft: false, grund: 'keine Signatur', validUntil: '2026-10-23', trial: false } }); admin()
  const w = await montiere({ team: { ...DE, primary: true } })
  assert.doesNotMatch(w.text(), /ungeprüft|keine Signatur|Kostenlos|2026-10-23/)
  assert.equal(w.find('tr.test').exists(), false)
  w.unmount()
  // der laufende Test: beim Init Team, mit seinem Datum — bei einem anderen Team nicht
  server(); admin()
  const v = await montiere({ team: { ...DE, primary: true } })
  assert.match(v.find('tr.test').text().replace(/\s+/g, ' '), /Test · Deutschland.*Enterprise · gültig bis 2026-12-23/)
  v.unmount()
  const x = await montiere({ team: IT })
  assert.equal(x.find('tr.test').exists(), false)
  x.unmount()
})

test('Ein entzogenes oder ungeprüftes Abo steht rot da', async () => {
  const abo = { team: 'de', teamLabel: 'Deutschland', plan: 'pro', planLabel: 'Pro', paidUntil: '2026-09-23', issued: '2026-09-24T10:00:00Z' }
  server({ abos: [{ ...abo, status: 'entzogen', gilt: false, geprueft: true }] }); admin()
  const w = await montiere({ team: DE })
  assert.match(w.find('tr.abo .neg').text(), /entzogen/)
  w.unmount()
  server({ abos: [{ ...abo, status: 'active', gilt: false, geprueft: false }] })
  const v = await montiere({ team: DE })
  assert.match(v.find('tr.abo .neg').text(), /ungeprüft/)
  v.unmount()
})

test('Der Stand des Abos steht bei der Lizenz — abgelaufen rot', async () => {
  server({ abos: [{ team: 'de', teamLabel: 'Deutschland', plan: 'enterprise', planLabel: 'Enterprise', status: 'active', paidUntil: '2026-10-24', issued: '2026-09-24T10:00:00Z', gilt: true, geprueft: true }] }); admin()
  const w = await montiere({ team: DE })
  assert.match(w.find('tr.abo').text().replace(/\s+/g, ' '), /Abo · Deutschland.*Enterprise · gültig bis 2026-10-24/)
  w.unmount()
  server({ abos: [{ team: 'de', teamLabel: 'Deutschland', plan: 'enterprise', planLabel: 'Enterprise', status: 'expired', paidUntil: '2026-09-20', issued: '2026-09-24T10:00:00Z', gilt: false, geprueft: true }] })
  const v = await montiere({ team: DE })
  assert.ok(v.find('tr.abo .neg').exists(), 'ein abgelaufenes Abo steht nicht rot da')
  v.unmount()
})
