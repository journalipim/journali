// Hinweise zum Betrieb (05.10.2026): gefragt wird einmal je Laden, nur wer die Anlage verwaltet, und nur solange die geltende Version nicht
// bestätigt ist. Bestätigt geht die Version an den Server; „später“ schickt nichts.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'
import { frageNachBetriebshinweis, _wiederFragen } from '../src/betriebshinweis.js'

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
