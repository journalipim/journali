// journali sagt nichts über fremde Token und Kosten (Taloan, 23.09.2026: „wir machen keine Aussagen über fremd
// entstandene und verbrauchte Tokens + Kosten“ · „was, wenn hier bei uns 2k steht — der ist happy, schaut in sein
// API-Konto, und dort stehen 2 Mio?“). Der Anwender gibt seinen Schlüssel ein und nutzt ihn; abgerechnet wird beim
// Anbieter. Geprüft wird, dass nichts davon zurückkommt — weder gezählt noch gezeigt.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { ai } from '../src/ai.js'

const STATE = { team: 'init', label: 'Init Team', payer: 'init', payerLabel: 'Init Team', providers: ['anthropic'], models: { anthropic: 'claude-sonnet-5' }, ready: true, volume: { today: 51200, todayIn: 40960, todayOut: 10240, month: 5242880 } }

function server({ state = STATE, antwort = { text: 'ok', sources: [] } } = {}) {
  const calls = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '')
    calls.push({ path, body: opts.body ? JSON.parse(opts.body) : null })
    const body = path === '/api/ai/state' ? state : path === '/api/ai/ask' ? antwort : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
  return calls
}

test('der Zustand sagt, wer stellt — nicht, was verbraucht wurde', async () => {
  server()
  const s = await ai.loadState()
  assert.equal(s.team, 'init')
  assert.deepEqual(s.providers, ['anthropic'])
  assert.equal(s.used, undefined, 'kein Verbrauch im Zustand')
  assert.equal(s.limits, undefined, 'und kein Limit — das ist Sache des Anbieters')
})

test('ein Aufruf hinterlässt keinen Zähler im Browser', async () => {
  server()
  await ai.loadState()
  await ai.ask({ user: 'hallo' })
  assert.equal(ai.used, undefined, 'journali zählt fremde Token nicht mit')
  assert.equal(typeof ai.teamUsed, 'undefined', 'und gibt auch keine Auskunft darüber')
})

test('ohne Team und ohne Schlüssel sagt journali nur, dass es nicht geht', async () => {
  server({ state: { team: null, ready: false } })
  await ai.loadState()
  await assert.rejects(() => ai.ask({ user: 'hallo' }), /Team/)
})

// Was journali sehr wohl sagen darf (Taloan, 23.09.2026: „wir können das Byte-Volumen zählen, das wir hinschicken, und
// das Byte-Volumen, das wir zurückkriegen … also KI-Austauschvolumen“): die eigene Messung. Bytes hin, Bytes zurück.
test('der Zustand nennt das Austauschvolumen — gemessen, nicht geschätzt', async () => {
  server()
  const s = await ai.loadState()
  assert.equal(s.volume.today, 51200, 'was heute über die Leitung ging')
  assert.equal(s.volume.todayIn + s.volume.todayOut, s.volume.today, 'hin und zurück ergeben zusammen das Volumen')
  assert.equal(s.used, undefined, 'und weiterhin keine Tokenzahl')
})

test('ein Aufruf sagt dem Server, wofür er war', async () => {
  const calls = server()
  await ai.loadState()
  await ai.ask({ user: 'hallo', purpose: 'Übersetzung' })
  const frage = calls.find(c => c.path === '/api/ai/ask')
  assert.equal(frage.body.purpose, 'Übersetzung', 'der Anlass geht mit')
  assert.equal(frage.body.maxTokens, 2000, 'die Obergrenze der Antwort bleibt eine Angabe an den Anbieter')
})
