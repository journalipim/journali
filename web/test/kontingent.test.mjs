// Warnung vor dem Kontingent bei der Übergabe aus einer Plugin-Ansicht (03.10.2026): reicht es nicht, fragt ein Dialog; reicht es, geht es ohne Frage.
import './ui.mjs'   // DOM und localStorage
import test from 'node:test'
import assert from 'node:assert/strict'
import { frage, reicht, OHNE } from '../src/kontingent.js'
import { dialog } from '../src/dialog.js'

test('frage: nur, wenn es nicht reicht', () => {
  assert.equal(frage({ label: 'X', eintraege: 100, verfuegbar: { woche: 500, monat: 900 } }), null)
  assert.equal(frage({ label: 'X', eintraege: 1e9, verfuegbar: { woche: OHNE, monat: OHNE } }), null)
  assert.equal(frage({ label: 'X', eintraege: 100, verfuegbar: null }), null)
  const f = frage({ label: 'Import (Solr)', eintraege: 1320000, verfuegbar: { woche: 5406, monat: 46147 }, hoechstens: true })
  assert.equal(f.title, 'Import (Solr) starten')
  assert.deepEqual(f.list, ['Verfügbar · 5.406 / Woche · 46.147 / Monat', 'Nötig · höchstens 1.320.000 Einträge'])
  assert.equal(f.ok, '▶ Trotzdem starten'); assert.equal(f.danger, true)
})

test('reicht: fragt den Server als Joblauf, und den Anwender nur, wenn es nicht reicht', async () => {
  const gerufen = []
  globalThis.fetch = async url => { gerufen.push(String(url).replace(/^https?:\/\/[^/]+/, '')); return { ok: true, status: 200, text: async () => JSON.stringify({ woche: 100, monat: 1000 }) } }
  const orig = dialog.confirm; const gefragt = []
  dialog.confirm = async o => { gefragt.push(o.title); return false }
  try {
    assert.equal(await reicht({ label: 'A', eintraege: 50 }), true)
    assert.equal(await reicht({ label: 'B', eintraege: 500 }), false, 'abgelehnt: nicht übergeben')
    assert.deepEqual(gefragt, ['B starten'])
    assert.ok(gerufen.every(u => u === '/api/jobs/verfuegbar?job=true'))
  } finally { dialog.confirm = orig }
})
