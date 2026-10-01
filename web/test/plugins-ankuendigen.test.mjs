// Der Hinweis beim Einschalten (system.ankuendigen) erscheint aus load() heraus. Lehnt der Anwender ab, wird das Plugin ausgeschaltet und die Liste
// neu geholt — ohne load() (das auf den laufenden Ladevorgang wartet, der auf die Antwort wartet) —, sonst bliebe es in der Oberfläche eingeschaltet.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { plugins } from '../src/plugins.js'
import { dialog } from '../src/dialog.js'
import { store } from '../src/store.js'

const calls = []
let serverListe
globalThis.fetch = async (url, opts = {}) => {
  const path = String(url).replace(/^https?:\/\/[^/]+/, '')
  calls.push({ path, method: opts.method ?? 'GET' })
  if (path === '/api/plugins/dpp/disable') serverListe = [{ key: 'dpp', installed: true, enabled: false, onDisk: true, manifest: {} }]
  const out = path === '/api/plugins' ? serverListe : {}
  return { ok: true, status: 200, text: async () => JSON.stringify(out), json: async () => out }
}
store.poll = async () => {}

test('Ablehnen schaltet das Plugin aus, aktualisiert die Liste ohne load() und löscht den Wartezustand', async () => {
  serverListe = [{ key: 'dpp', installed: true, enabled: true, onDisk: true, manifest: {} }]
  plugins.list = serverListe
  plugins.loading = new Promise(() => {})   // ein Ladevorgang läuft und kommt nie zurück: load() wäre ein Hänger
  let wartend
  dialog.confirm = async () => { wartend = [...plugins.ausstehend]; return false }
  const ok = await Promise.race([plugins.ctx('dpp').system.ankuendigen({ label: 'DPP', text: 'x' }), new Promise(r => setTimeout(() => r('hängt'), 500))])
  plugins.loading = null
  assert.equal(ok, false)
  assert.deepEqual(wartend, ['dpp'], 'während der Frage steht das Plugin als wartend da')
  assert.deepEqual(plugins.ausstehend, [])
  assert.equal(plugins.list[0].enabled, false, 'die Liste zeigt den tatsächlichen Stand')
  assert.ok(calls.some(c => c.path === '/api/plugins/dpp/disable' && c.method === 'POST'))
  assert.equal(plugins.neuLaden, true, 'die Beiträge werden danach neu gesammelt')
})

test('Bestätigen lässt das Plugin an', async () => {
  calls.length = 0
  plugins.neuLaden = false
  dialog.confirm = async () => true
  assert.equal(await plugins.ctx('dpp').system.ankuendigen({ label: 'DPP', text: 'x' }), true)
  assert.equal(calls.some(c => c.path.endsWith('/disable')), false)
  assert.deepEqual(plugins.ausstehend, [])
  assert.equal(plugins.neuLaden, false)
})

test('lehnt install() ab (false), meldet installNew nichts als eingerichtet und merkt sich nichts', async () => {
  plugins.list = [{ key: 'dpp', installed: true, enabled: true, onDisk: true, manifest: { label: { de: 'DPP' } } }]
  plugins.active = () => true
  plugins.modules.set('dpp', { install: async () => false })
  plugins.forgetInstalled('dpp'); store.toasts = []
  await plugins.installNew()
  assert.equal(plugins.installedSet().has('dpp'), false)
  assert.equal(store.toasts.some(x => /eingerichtet/.test(x.text ?? x.message ?? String(x))), false)
  plugins.modules.set('dpp', { install: async () => true })
  await plugins.installNew()
  assert.equal(plugins.installedSet().has('dpp'), true)
})
