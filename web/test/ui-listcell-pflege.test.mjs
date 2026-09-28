// Der Listeneditor der Zelle (28.09.2026): bei einer Liste aus Sätzen („Funkentstörung“) ist die Zelle der Ort, an dem
// ein Tippfehler auffällt — ✎ je Zeile ändert den Text des Werts, mit Modell-Recht, die anderen Sprachen bleiben.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'
import { api } from '../src/api.js'
import { dialog } from '../src/dialog.js'

const ListCell = (await import('../src/components/ListCell.vue')).default

function welt({ rechte = ['write', 'model'] } = {}) {
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }, { code: 'en' }], lists: [{ key: 'emc', closed: false, values: [
    { value: 'nicht_kreuzen', label: { de: 'Netzleitung und Lampenleitung nicht kreuzen.', en: 'Do not cross mains and lamp wiring.' } },
    { value: 'verdrillen', label: { de: 'Lampenleitungen verdrillen.' } }] }] }
  store.auth = { enabled: true, user: 'u1', rights: rechte }
  store.poll = async () => {}
  const rufe = []
  api.post = async (url, body, method = 'POST') => { rufe.push({ url, body, method }); return {} }
  return rufe
}
const labelOf = v => store.model.lists[0].values.find(x => x.value === v)?.label?.de ?? v
const zelle = () => mount({ components: { ListCell }, template: '<table><tr><ListCell value="nicht_kreuzen,verdrillen" :options="[\'nicht_kreuzen\', \'verdrillen\']" :label-of="labelOf" list="emc" /></tr></table>', setup: () => ({ labelOf }) })

test('✎ ändert den Text eines Werts — die andere Sprache bleibt, das Modell wird neu geholt', async () => {
  const rufe = welt()
  let gefragt = null
  dialog.prompt = async args => { gefragt = args; return 'Netzleitung und Lampenleitung nie kreuzen.' }
  const w = zelle()
  await w.find('.cell-box').trigger('click'); await flushPromises()
  const stifte = w.findAll('.lrow button').filter(b => b.text() === '✎')
  assert.equal(stifte.length, 2, 'je gewähltem Wert ein ✎')
  await stifte[0].trigger('click'); await flushPromises()
  assert.equal(gefragt.value, 'Netzleitung und Lampenleitung nicht kreuzen.', 'der Dialog zeigt den heutigen Text')
  assert.equal(rufe.length, 1)
  assert.equal(rufe[0].method, 'PUT'); assert.match(rufe[0].url, /\/api\/model\/lists\/emc\/values\/nicht_kreuzen$/)
  assert.deepEqual(rufe[0].body.label, { de: 'Netzleitung und Lampenleitung nie kreuzen.', en: 'Do not cross mains and lamp wiring.' })
})

test('abgebrochen oder unverändert: nichts geht an den Server', async () => {
  const rufe = welt()
  dialog.prompt = async () => null
  const w = zelle()
  await w.find('.cell-box').trigger('click'); await flushPromises()
  await w.findAll('.lrow button').filter(b => b.text() === '✎')[0].trigger('click'); await flushPromises()
  dialog.prompt = async () => 'Netzleitung und Lampenleitung nicht kreuzen.'
  await w.findAll('.lrow button').filter(b => b.text() === '✎')[0].trigger('click'); await flushPromises()
  assert.equal(rufe.length, 0)
})

test('ohne Modell-Recht kein ✎ — wer das Modell nicht ändern darf, sieht den Knopf nicht', async () => {
  welt({ rechte: ['write'] })
  const w = zelle()
  await w.find('.cell-box').trigger('click'); await flushPromises()
  assert.equal(w.findAll('.lrow button').filter(b => b.text() === '✎').length, 0)
})
