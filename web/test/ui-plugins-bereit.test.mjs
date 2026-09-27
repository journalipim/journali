// ⑁ Plugins: kann ein eingeschaltetes Plugin überhaupt arbeiten? (27.09.2026) Wer Voraussetzungen hat, die niemand in
// journali setzt — eine Erweiterung der Datenbank, ein Modell, ein erreichbarer Dienst —, nennt im Manifest unter
// `health` einen Endpunkt, der { ready, reason } sagt. Vorher stand das nur als Satz in der Beschreibung, und wer ihn
// nicht las, wartete auf einen Job, der nichts tun konnte.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { plugins } from '../src/plugins.js'

/// Der Server antwortet je Adresse; alles andere gibt es nicht
function server(antworten) {
  const gefragt = []
  globalThis.fetch = async (url) => {
    const pfad = String(url).replace(/^https?:\/\/[^/]+/, '')
    gefragt.push(pfad)
    if (!(pfad in antworten)) return { ok: false, status: 404, text: async () => JSON.stringify({ error: 'gibt es nicht' }) }
    const a = antworten[pfad]
    if (a instanceof Error) throw a
    return { ok: true, status: 200, text: async () => JSON.stringify(a) }
  }
  return gefragt
}

const EMBED = { key: 'embed', onDisk: true, installed: true, enabled: true, manifest: { key: 'embed', health: '/api/docs/embed' } }
const CSV = { key: 'csv', onDisk: true, installed: true, enabled: true, manifest: { key: 'csv' } }

test('Ein Plugin ohne health wird nicht gefragt', async () => {
  plugins.list = [CSV]; plugins.zustand.clear()
  const gefragt = server({})
  await plugins.pruefeZustand()
  assert.deepEqual(gefragt, [])
  assert.equal(plugins.bereit('csv'), null)
})

test('Sagt der Endpunkt ready:false, steht der Grund beim Plugin', async () => {
  plugins.list = [EMBED]; plugins.zustand.clear()
  server({ '/api/docs/embed': { ready: false, reason: 'Erweiterung vector fehlt in dieser Datenbank' } })
  await plugins.pruefeZustand()
  assert.deepEqual(plugins.bereit('embed'), { ready: false, reason: 'Erweiterung vector fehlt in dieser Datenbank' })
})

test('Sagt er ready:true, ist nichts zu melden', async () => {
  plugins.list = [EMBED]; plugins.zustand.clear()
  server({ '/api/docs/embed': { ready: true, reason: null, chunks: 12 } })
  await plugins.pruefeZustand()
  assert.deepEqual(plugins.bereit('embed'), { ready: true, reason: '' })
})

test('Antwortet der Endpunkt gar nicht, gilt das Plugin als nicht bereit', async () => {
  plugins.list = [EMBED]; plugins.zustand.clear()
  server({})   // 404
  await plugins.pruefeZustand()
  assert.equal(plugins.bereit('embed').ready, false)
  assert.ok(plugins.bereit('embed').reason.length > 0, 'ohne Grund steht der Anwender wieder im Dunkeln')
})

test('Ein ausgeschaltetes Plugin wird nicht gefragt — und ein alter Stand fällt weg', async () => {
  plugins.list = [EMBED]; plugins.zustand.clear()
  server({ '/api/docs/embed': { ready: false, reason: 'fehlt' } })
  await plugins.pruefeZustand()
  assert.equal(plugins.bereit('embed').ready, false)

  plugins.list = [{ ...EMBED, enabled: false }]
  const gefragt = server({ '/api/docs/embed': { ready: false, reason: 'fehlt' } })
  await plugins.pruefeZustand()
  assert.deepEqual(gefragt, [], 'ein ausgeschaltetes Plugin wurde gefragt')
  assert.equal(plugins.bereit('embed'), null, 'der alte Stand stand noch da')
})

test('Ein Plugin, dessen Basis fehlt, wird nicht gefragt', async () => {
  plugins.list = [{ ...EMBED, manifest: { key: 'embed', health: '/api/docs/embed', requires: ['tasker'] } }]
  plugins.zustand.clear()
  const gefragt = server({ '/api/docs/embed': { ready: true } })
  await plugins.pruefeZustand()
  assert.deepEqual(gefragt, [], 'ohne wirkende Basis arbeitet es ohnehin nicht')
})
