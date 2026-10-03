// Jobs je Server (pflegestruktur 41): ein Job eines anderen Servers trägt dessen Namen, wird dort bearbeitet und lässt sich
// hierher holen. Die Ansicht wird wirklich geöffnet; geprüft wird, was beim Server ankommt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { win } from './ui.mjs'
import { fremd, serverMarke } from '../../plugins/tasker/entry.js'

const plugin = (await import('../../plugins/tasker/entry.js')).default
const mountView = plugin.views[0].mount

let ende
test.afterEach(() => { ende?.(); ende = null })

const job = o => ({ key: 'x', label: 'X', plugin: 'csv', service: 'export', params: {}, schedule: null, scheduleText: 'von Hand', enabled: true, timeoutMinutes: 60, secrets: [], runs: [], running: null, last: null, nextDue: null, fern: false, server: 'srv-a', serverName: 'pc', ...o })

async function oeffnen(jobs) {
  document.body.innerHTML = ''
  const rufe = []; const gefragt = []
  const api = {
    get: async p => { rufe.push(['GET', p]); return p === '/api/jobs' ? jobs : p === '/api/jobs/plugins' ? [] : {} },
    post: async (p, body, m = 'POST') => { rufe.push([m, p, body]); return {} },
    del: async p => { rufe.push(['DELETE', p]); return {} },
  }
  const ctx = {
    api, store: { toast() {}, can: () => true, tarif: { schedules: true }, server: '' }, dialog: { confirm: async o => { gefragt.push(o.title); return true } },
    tree: { loaded: true, byId: new Map(), load: async () => {} }, plugins: { active: () => true, list: [] }, treePicker() {}, filePicker() {},
  }
  const root = document.createElement('div'); document.body.append(root)
  ende = await mountView(root, ctx)
  await new Promise(r => setTimeout(r, 0))
  return { root, rufe, gefragt }
}

test('fremd und Marke: nur ein Job eines anderen Servers trägt dessen Namen', () => {
  assert.equal(fremd(job({ fern: true })), true)
  assert.equal(serverMarke(job({ fern: true, serverName: 'Unraid' })), '⧉ Unraid')
  assert.equal(serverMarke(job({ fern: false })), '')
  assert.equal(serverMarke(null), '')
})

test('ein fremder Job: Marke des Servers, ⇣ statt ✎, Herholen fragt und schickt POST', async () => {
  const { root, rufe, gefragt } = await oeffnen([job({ key: 'eigen', label: 'Eigen' }), job({ key: 'asien', label: 'Asien', fern: true, server: 'srv-b', serverName: 'Asien-Server' })])
  const zeilen = [...root.querySelectorAll('tbody tr')]
  const [eigen, asien] = ['Eigen', 'Asien'].map(n => zeilen.find(z => z.textContent.includes(n)))
  assert.ok(!eigen.querySelector('.server'))
  assert.equal(asien.querySelector('.server').textContent, '⧉ Asien-Server')
  assert.ok([...eigen.querySelectorAll('button')].some(b => b.textContent === '✎'))
  assert.ok(![...asien.querySelectorAll('button')].some(b => b.textContent === '✎'), 'bearbeitet wird er auf seinem Server')
  const holen = asien.querySelector('button.holen')
  assert.equal(holen.textContent, '⇣')
  holen.dispatchEvent(new win.Event('click'))
  await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0))
  assert.deepEqual(gefragt, ['Asien auf diesen Server holen'])
  assert.ok(rufe.some(r => r[0] === 'POST' && r[1] === '/api/jobs/asien/holen'))
})

test('ein fremder Job, der läuft, lässt sich nicht herholen', async () => {
  const { root } = await oeffnen([job({ key: 'asien', label: 'Asien', fern: true, running: 'r1' })])
  assert.equal(root.querySelector('button.holen').disabled, true)
})
