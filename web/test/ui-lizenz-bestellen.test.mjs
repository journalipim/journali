// Einstellungen → Team → ⚿ journali Lizenz: Kontingent bestellen (26.09.2026). Wer ein Team führt, öffnet den Shop;
// Instanz und Team hängen an der Adresse, und was gekauft wird, findet über den Lizenzserver zu diesem Team zurück; ↻
// holt den Stand. Es ist eine Adresse für alle Tarife — den Tarif wählt der Anwender im Shop. Geprüft wird, welche
// Adresse die Oberfläche öffnet und wer den Knopf sieht.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises, button } from './ui.mjs'
import { store } from '../src/store.js'

const LicenceSettings = (await import('../src/components/LicenceSettings.vue')).default

const KAUF = 'https://shop.example/checkout/buy/a92048e1'

function server({ kauf = KAUF, lizenzserver = true, abos = [] } = {}) {
  const gesendet = []
  globalThis.fetch = async (url, opt = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    const method = opt.method ?? 'GET'
    if (method !== 'GET') gesendet.push({ method, path })
    let body = {}
    if (path === '/api/licence' && method === 'GET')
      body = { plan: 'free', instanz: 'inst-7', entriesWeek: 10000, entriesMonth: 50000, geprueft: true, trial: false,
        tarif: { key: 'free', label: 'Kostenlos' }, instanzTarif: { key: 'free', label: 'Kostenlos', pubTrees: 1 }, pubTrees: 0, lizenzserver, kauf, abos }
    else if (path === '/api/licence/abo/de/auffrischen') body = { team: 'de', plan: 'pro', planLabel: 'Pro', status: 'active', paidUntil: '2026-10-26', geprueft: true }
    else if (path === '/api/licence/requests' || path === '/api/licence/keys' || path === '/api/licence/packages') body = []
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
  return gesendet
}

/// Wer hier arbeitet: ein Teammanager hat „team“, kein „users“
function anwender(rechte, user = 'mgr') {
  store.auth = { known: true, enabled: true, setup: true, user, role: user, name: user, rights: rechte }
  store.actor = user
  store.poll = async () => {}
}

/// Was window.open bekommt — der Shop wird in einem neuen Fenster geöffnet
function fenster() {
  const offen = []
  globalThis.window.open = (url, ziel) => { offen.push({ url, ziel }); return null }
  return offen
}

const DE = { key: 'de', label: 'Deutschland', payer: 'de', managers: ['mgr'] }
const IT = { key: 'it', label: 'Italien', payer: 'de', managers: ['mgr'] }

test('Der Teammanager bestellt Kontingent — Instanz und Team hängen an der Adresse', async () => {
  server(); anwender(['team', 'read']); const offen = fenster()
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  assert.equal(w.find('.bestellen select').exists(), false, 'eine Tarifwahl steht da — den Tarif wählt der Anwender im Shop')
  assert.match(button(w, 'Bestellen').text(), /Bestellen · Deutschland/)

  await button(w, 'Bestellen').trigger('click'); await flushPromises()
  assert.equal(offen.length, 1, 'der Shop wurde nicht geöffnet')
  const u = new URL(offen[0].url)
  assert.equal(u.origin + u.pathname, KAUF)
  assert.equal(u.searchParams.get('checkout[custom][instanz]'), 'inst-7')
  assert.equal(u.searchParams.get('checkout[custom][team]'), 'de')
  assert.match(w.find('.bestellen .said').text(), /Shop geöffnet/)
  w.unmount()

  // bei einem anderen Team trägt dieselbe Adresse dessen Schlüssel
  const it = mount(LicenceSettings, { props: { team: { ...IT, payer: 'it' } } }); await flushPromises()
  await button(it, 'Bestellen').trigger('click'); await flushPromises()
  assert.equal(new URL(offen[1].url).searchParams.get('checkout[custom][team]'), 'it')
  it.unmount()
})

/// Eine Adresse, die schon eine Frage trägt, behält ihre Werte
test('Eine Adresse mit eigenen Werten behält sie', async () => {
  server({ kauf: 'https://shop.example/checkout/buy/a9?embed=1' }); anwender(['team', 'read']); const offen = fenster()
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  await button(w, 'Bestellen').trigger('click'); await flushPromises()
  const u = new URL(offen[0].url)
  assert.equal(u.searchParams.get('embed'), '1')
  assert.equal(u.searchParams.get('checkout[custom][team]'), 'de')
  w.unmount()
})

test('↻ holt den Stand nach dem Kauf — auch ohne Abo und ohne Schlüssel', async () => {
  const gesendet = server(); anwender(['team', 'read']); fenster()
  let eingespielt = 0
  const w = mount(LicenceSettings, { props: { team: DE, onEingespielt: () => eingespielt++ } }); await flushPromises()
  await w.find('.bestellen button.holen').trigger('click'); await flushPromises()
  assert.ok(gesendet.some(g => g.method === 'POST' && g.path === '/api/licence/abo/de/auffrischen'), 'der Stand wurde nicht geholt')
  assert.match(w.find('.said').text(), /✓ Abo Pro · gültig bis 2026-10-26/)
  assert.equal(eingespielt, 1)
  w.unmount()
})

test('Wer das Team nicht führt, bestellt nicht — und wer über ein anderes Team abrechnet, auch nicht', async () => {
  server(); anwender(['team', 'read'], 'anna')      // Anna führt Deutschland nicht
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  assert.equal(w.find('.bestellen').exists(), false)
  w.unmount()

  anwender(['team', 'read'])
  const it = mount(LicenceSettings, { props: { team: IT } }); await flushPromises()
  assert.equal(it.find('.bestellen').exists(), false, 'ein Team, das über ein anderes abrechnet, bestellt selbst')
  it.unmount()
})

test('Ohne Kauf-Adresse im Tarifblatt und ohne Lizenzserver steht kein Knopf', async () => {
  server({ kauf: null }); anwender(['team', 'read'])
  const w = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  assert.equal(w.find('.bestellen').exists(), false)
  w.unmount()

  server({ lizenzserver: false })
  const v = mount(LicenceSettings, { props: { team: DE } }); await flushPromises()
  assert.equal(v.find('.bestellen').exists(), false)
  v.unmount()
})
