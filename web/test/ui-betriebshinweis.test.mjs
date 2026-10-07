// Hinweise zum Betrieb (05.10.2026): gefragt wird einmal je Laden, nur wer die Instanz verwaltet, und nur solange die geltende Version nicht
// bestätigt ist. Bestätigt geht die Version an den Server; „später“ schickt nichts.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'
import { frageNachBetriebshinweis, zeigeTesthinweis, _wiederFragen } from '../src/betriebshinweis.js'

const HINWEIS = { version: '2026-10-05', title: { de: 'Hinweise zum Betrieb' }, points: [{ de: 'Sicherung liegt beim Betreiber.' }, { de: 'Für Unternehmen.' }] }

async function frage({ bestaetigt = null, rechte = ['users'], antwort = true } = {}) {
  _wiederFragen()
  store.auth.known = true; store.auth.enabled = true; store.auth.user = 'admin'; store.auth.rights = rechte
  const gefragt = [], gesendet = []
  const get = api.get, post = api.post, confirm = dialog.confirm
  api.get = async p => p === '/api/notice' ? { ...HINWEIS, acknowledged: bestaetigt } : {}
  api.post = async p => { gesendet.push(p); return {} }
  dialog.confirm = async o => { gefragt.push(o); return antwort }
  try { await frageNachBetriebshinweis(); return { gefragt, gesendet } }
  finally { api.get = get; api.post = post; dialog.confirm = confirm }
}

test('offen: die Frage nennt die Punkte; bestätigt geht die Version an den Server', async () => {
  const { gefragt, gesendet } = await frage()
  assert.equal(gefragt.length, 1)
  assert.equal(gefragt[0].title, 'Hinweise zum Betrieb')
  assert.deepEqual(gefragt[0].list, ['Sicherung liegt beim Betreiber.', 'Für Unternehmen.'])
  assert.deepEqual(gesendet, ['/api/notice/acknowledge?version=2026-10-05'])
})

test('„später“ schickt nichts', async () => {
  const { gesendet } = await frage({ antwort: false })
  assert.deepEqual(gesendet, [])
})

test('schon bestätigt oder ohne Recht users: keine Frage', async () => {
  assert.equal((await frage({ bestaetigt: '2026-10-05' })).gefragt.length, 0)
  assert.equal((await frage({ rechte: ['read'] })).gefragt.length, 0)
})
// Testversion (07.10.2026): das rote Feld oben zeigt den Hinweis des Servers — ohne Anmeldung, ohne Recht
test('Testversion: ein Klick zeigt den Hinweis des Servers als Punkte', async () => {
  store.auth.known = true; store.auth.enabled = true; store.auth.user = null; store.auth.rights = []
  const geholt = [], gezeigt = []
  const get = api.get, help = dialog.help
  api.get = async p => { geholt.push(p); return { test: true, title: { de: 'Testversion' }, points: [{ de: 'Nur zum Testen.' }, { de: 'Ohne Haftung.' }] } }
  dialog.help = async o => { gezeigt.push(o) }
  try { assert.equal(await zeigeTesthinweis(), true) }
  finally { api.get = get; dialog.help = help }
  assert.deepEqual(geholt, ['/api/testversion'])
  assert.equal(gezeigt[0].title, 'Testversion')
  assert.deepEqual(gezeigt[0].rows, [['•', 'Nur zum Testen.'], ['•', 'Ohne Haftung.']])
})

test('Testversion: das Feld steht in der Statusleiste und ruft den Hinweis', async () => {
  const fs = await import('node:fs')
  const app = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  assert.match(app, /<button v-if="store\.testversion" class="testversion"[^>]*@click="zeigeTesthinweis">\{\{ \$t\("Testversion"\) \}\}<\/button>/)
})
