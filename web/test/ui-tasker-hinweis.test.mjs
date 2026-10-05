// Job-Dialog (05.10.2026): ein Plugin kann im Manifest einen festen Satz mitgeben (process.notice, Tooltip noticeTitle) — die Sicherung
// sagt so, dass nur eine Probe zeigt, ob sich eine Sicherung einspielen lässt. Plugins ohne notice zeigen nichts.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { win } from './ui.mjs'

const plugin = (await import('../../plugins/tasker/entry.js')).default
const manifest = JSON.parse(fs.readFileSync(new URL('../../plugins/backup/plugin.json', import.meta.url), 'utf8'))
const SICHERUNG = { key: 'backup', service: '', label: manifest.label, description: manifest.process.description, params: manifest.process.params, notice: manifest.process.notice, noticeTitle: manifest.process.noticeTitle }
const ANDERES = { key: 'quelle', service: '', label: { de: 'Quelle lesen' }, description: 'liest eine Quelle', params: [] }

let ende
test.afterEach(() => { ende?.(); ende = null })

test('der Job-Dialog zeigt den Satz des Plugins Sicherung, bei einem anderen Plugin nichts', async () => {
  document.body.innerHTML = ''
  const api = { get: async p => p === '/api/jobs/plugins' ? [ANDERES, SICHERUNG] : [], post: async () => ({}), del: async () => ({}) }
  const ctx = {
    api, store: { toast() {}, can: () => true, tarif: { schedules: true }, server: '' }, dialog: { confirm: async () => true },
    tree: { loaded: true, byId: new Map(), load: async () => {} }, plugins: { active: () => true, list: [] }, treePicker() {}, filePicker() {},
  }
  const root = document.createElement('div'); document.body.append(root)
  ende = await plugin.views[0].mount(root, ctx)
  await new Promise(r => setTimeout(r, 0))
  ;[...root.querySelectorAll('button')].find(b => b.textContent === '+ Job').dispatchEvent(new win.Event('click'))
  await new Promise(r => setTimeout(r, 0))
  const dlg = document.querySelector('.overlay')
  const sel = [...dlg.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'backup|'))
  const hinweis = dlg.querySelector('.plugin-notice')
  sel.value = 'quelle|'; sel.dispatchEvent(new win.Event('change'))
  assert.equal(hinweis.style.display, 'none', 'ohne notice kein Satz')
  sel.value = 'backup|'; sel.dispatchEvent(new win.Event('change'))
  assert.equal(hinweis.textContent, 'Ob das Einspielen gelingt, zeigt nur eine Probe.')
  assert.match(hinweis.title, /liegen beim Betreiber/)
  assert.notEqual(hinweis.style.display, 'none')
})
