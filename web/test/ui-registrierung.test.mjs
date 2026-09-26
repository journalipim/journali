// Registrierung beim Lizenzserver (26.09.2026): gefragt wird einmal, und nur, wer die Anlage verwaltet. Registriert
// holt sie dort das Tarifblatt und kennt damit die Aktionen des Shops; ohne spricht sie nicht mit ihm. Geprüft wird die
// Frage (registrierung.js) und die Zeile im Lizenzabschnitt, mit der sich die Antwort später ändern lässt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'
import { frageNachRegistrierung, _wiederFragen } from '../src/registrierung.js'

const LicenceSettings = (await import('../src/components/LicenceSettings.vue')).default

/// Der Server: /api/health sagt, ob schon gefragt wurde; /api/licence trägt dieselbe Antwort
function server({ registriert = null } = {}) {
  const gesendet = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    const method = opt.method ?? 'GET'
    if (method !== 'GET') gesendet.push({ pfad, body: JSON.parse(opt.body) })
    let body = {}
    if (pfad === '/api/health') body = { head: 1, nodes: 0, registriert }
    else if (pfad === '/api/licence' && method === 'GET')
      body = { plan: 'free', instanz: 'inst-7', geprueft: true, tarif: { key: 'free', label: 'Kostenlos' },
        instanzTarif: { key: 'free', label: 'Kostenlos', pubTrees: 1 }, pubTrees: 0, lizenzserver: true, registriert, rabatte: [], abos: [] }
    else if (pfad === '/api/licence/registrierung') body = { registriert: JSON.parse(opt.body).ja, tarifblatt: 3, fehler: null }
    else if (pfad === '/api/model') body = {}
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
  return gesendet
}

function anwender(rechte) {
  store.auth = { known: true, enabled: true, setup: true, user: 'admin', role: 'admin', name: 'Admin', rights: rechte }
  store.actor = 'admin'
}

/// Den Dialog beantworten, ohne ihn zu zeichnen — und festhalten, was er fragt
function antwortet(ja) {
  const gefragt = []
  dialog.confirm = async o => { gefragt.push(o); return ja }
  return gefragt
}

test('Gefragt wird einmal — und die Antwort geht hinaus', async () => {
  const gesendet = server(); anwender(['users']); _wiederFragen(); store.registriert = null
  const gefragt = antwortet(true)
  assert.equal(await frageNachRegistrierung(), true)
  assert.match(gefragt[0].title, /beim Lizenzserver registrieren\?/)
  assert.deepEqual([gefragt[0].ok, gefragt[0].cancel], ['Registrieren', 'Nicht registrieren'])
  assert.deepEqual(gesendet.find(g => g.pfad === '/api/licence/registrierung').body, { ja: true })

  // ein zweites Mal fragt niemand
  assert.equal(await frageNachRegistrierung(), false)
  assert.equal(gefragt.length, 1)
})

test('Ein Nein geht auch hinaus — und bleibt', async () => {
  const gesendet = server(); anwender(['users']); _wiederFragen(); store.registriert = null
  antwortet(false)
  await frageNachRegistrierung()
  assert.deepEqual(gesendet.find(g => g.pfad === '/api/licence/registrierung').body, { ja: false })
  // wer die Frage schon beantwortet hat, wird nicht wieder gefragt
  _wiederFragen(); store.registriert = false
  const nochmal = antwortet(true)
  assert.equal(await frageNachRegistrierung(), false)
  assert.equal(nochmal.length, 0)
})

test('Wer die Anlage nicht verwaltet, wird nicht gefragt', async () => {
  server(); anwender(['read', 'write']); _wiederFragen(); store.registriert = null
  const gefragt = antwortet(true)
  assert.equal(await frageNachRegistrierung(), false)
  assert.equal(gefragt.length, 0)
})

test('Die Zeile im Lizenzabschnitt stellt die Antwort um', async () => {
  const gesendet = server({ registriert: false }); anwender(['users'])
  store.poll = async () => {}
  const w = mount(LicenceSettings, { props: { team: { key: 'de', label: 'Deutschland', payer: 'de' } } }); await flushPromises()
  const knopf = w.find('tr.registrierung button')
  assert.match(knopf.text(), /nicht registriert/)
  await knopf.trigger('click'); await flushPromises()
  assert.deepEqual(gesendet.find(g => g.pfad === '/api/licence/registrierung').body, { ja: true })
  w.unmount()
})

test('Ohne Recht zur Anwenderverwaltung steht die Zeile nicht da', async () => {
  server({ registriert: true }); anwender(['read'])
  store.poll = async () => {}
  const w = mount(LicenceSettings, { props: { team: { key: 'de', label: 'Deutschland', payer: 'de' } } }); await flushPromises()
  assert.equal(w.find('tr.registrierung').exists(), false)
  w.unmount()
})
