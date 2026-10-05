// Nutzungsstatistik in der Journalansicht (05.10.2026): „▦ je Monat“ zeigt je Monat die Einträge nach Art — über das ganze Journal aus dem
// Abbild des Servers, nicht nur die geladenen Einträge — und speichert sie als CSV; ein zweiter Klick zeigt wieder die Einträge.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { createRouter, createMemoryHistory } from 'vue-router'
import { api } from '../src/api.js'
import { store } from '../src/store.js'

const JournalView = (await import('../src/views/JournalView.vue')).default
const MONATE = [
  { month: '2026-10', kinds: { data: 120, model: 4, setup: 2 }, total: 126 },
  { month: '2026-09', kinds: { data: 30, publish: 5 }, total: 35 },
]

test('je Monat: Tabelle nach Art, CSV zum Speichern, zurück zu den Einträgen', async () => {
  const orig = api.get
  const gefragt = []
  api.get = async p => {
    gefragt.push(p)
    if (p === '/api/usage/months') return MONATE
    if (p === '/api/health') return { head: store.head }
    return []
  }
  const origUrl = URL.createObjectURL, origClick = HTMLAnchorElement.prototype.click
  let blob = null, datei = null
  URL.createObjectURL = b => { blob = b; return 'blob:nutzung' }
  HTMLAnchorElement.prototype.click = function () { datei = this.download }
  store.head = 10
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/journal', component: JournalView }] })
  router.push('/journal'); await router.isReady()
  const w = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
  try {
    await flushPromises()
    assert.ok(!w.find('table.nutzung').exists())
    await w.find('.je-monat').trigger('click'); await flushPromises()
    assert.ok(gefragt.includes('/api/usage/months'))
    const zeilen = w.findAll('table.nutzung tbody tr')
    assert.equal(zeilen.length, 2)
    assert.match(zeilen[0].text(), /2026-10/)
    assert.match(zeilen[0].text(), /120/)
    assert.match(zeilen[0].text(), /126/)
    assert.match(w.find('.section h2').text(), /Nutzung · 2 Monate/)

    await w.find('button.csv').trigger('click')
    assert.match(datei ?? '', /^journali-nutzung-\d{4}-\d{2}-\d{2}\.csv$/)
    const text = await blob.text()
    assert.equal(text.split('\n')[0], 'month;data;publish;model;structure;reference;setup;ops;total')
    assert.equal(text.split('\n')[1], '2026-10;120;0;4;0;0;2;0;126')

    await w.find('.je-monat').trigger('click'); await flushPromises()
    assert.ok(!w.find('table.nutzung').exists(), 'zweiter Klick zeigt wieder die Einträge')
  } finally { w.unmount(); api.get = orig; URL.createObjectURL = origUrl; HTMLAnchorElement.prototype.click = origClick }
})

// Nutzungsberichte (05.10.2026): der Schalter steht bei der Tabelle; Einschalten fragt mit der Liste dessen, was gesendet wird — ohne Zustimmung
// geht keine Anfrage hinaus; Ausschalten fragt nicht.
test('Nutzungsberichte: einschalten nur nach Zustimmung, ausschalten ohne Frage', async () => {
  const { dialog } = await import('../src/dialog.js')
  const origGet = api.get, origPost = api.post, origConfirm = dialog.confirm
  let an = false, antwort = false
  const gesendet = [], gefragt = []
  api.get = async p => p === '/api/usage/months' ? MONATE : p === '/api/usage/report' ? { on: an, since: an ? '2026-10-05T08:00:00Z' : null, by: an ? 'admin' : null } : p === '/api/health' ? { head: store.head } : []
  api.post = async p => { gesendet.push(p); an = p.endsWith('on=true'); return {} }
  dialog.confirm = async o => { gefragt.push(o); return antwort }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/journal', component: JournalView }] })
  router.push('/journal'); await router.isReady()
  const w = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
  try {
    await flushPromises()
    await w.find('.je-monat').trigger('click'); await flushPromises()
    assert.match(w.find('button.bericht').text(), /Nutzungsberichte senden/)

    await w.find('button.bericht').trigger('click'); await flushPromises()
    assert.equal(gefragt.length, 1)
    assert.ok(gefragt[0].list.some(z => /keine Namen/.test(z)), 'die Liste sagt, was nicht gesendet wird')
    assert.ok(gefragt[0].list.some(z => /IP-Adresse/.test(z)))
    assert.deepEqual(gesendet, [], 'abgelehnt: keine Anfrage')

    antwort = true
    await w.find('button.bericht').trigger('click'); await flushPromises()
    assert.deepEqual(gesendet, ['/api/usage/report?on=true'])
    assert.match(w.find('button.bericht').text(), /Nutzungsberichte an/)
    assert.match(w.find('button.bericht').attributes('title') ?? '', /2026-10-05 · admin/)

    await w.find('button.bericht').trigger('click'); await flushPromises()
    assert.equal(gefragt.length, 2, 'Ausschalten fragt nicht')
    assert.deepEqual(gesendet.at(-1), '/api/usage/report?on=false')
  } finally { w.unmount(); api.get = origGet; api.post = origPost; dialog.confirm = origConfirm }
})
