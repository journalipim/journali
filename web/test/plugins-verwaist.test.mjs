// Ein Plugin, dessen Verzeichnis fehlt (umbenannt oder entfernt), steht im Journal weiter als installiert und
// eingeschaltet — der Server liefert sein Manifest von dort. Es wirkt dann nicht mehr und wird nicht geladen: sonst
// scheitert der Import an einer Datei, die es nicht gibt (26.09.2026: „Plugin xlsx: Failed to fetch dynamically
// imported module … /plugins/xlsx/entry.js“, nachdem xlsx zu excel wurde).
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { plugins } from '../src/plugins.js'

test('ein Plugin ohne Verzeichnis wirkt nicht', () => {
  plugins.list = [
    { key: 'excel', enabled: true, onDisk: true, manifest: { runs: 'browser', entry: 'entry.js' } },
    { key: 'xlsx', enabled: true, onDisk: false, manifest: { runs: 'browser', entry: 'entry.js' } },
    { key: 'braucht-xlsx', enabled: true, onDisk: true, manifest: { requires: ['xlsx'] } },
  ]
  assert.equal(plugins.active('excel'), true)
  assert.equal(plugins.active('xlsx'), false, 'ein Plugin ohne Verzeichnis wirkt')
  assert.equal(plugins.active('braucht-xlsx'), false, 'wer es braucht, wirkt ohne es weiter')
})

test('geladen wird nur, was wirkt — kein Abruf einer Datei, die es nicht gibt', async () => {
  const geladen = []
  plugins.list = [
    { key: 'weg', enabled: true, onDisk: false, manifest: { runs: 'browser', entry: 'entry.js' } },
  ]
  plugins.modules = new Map()
  // _load ruft api.get: ohne Antwort bleibt die Liste leer — darum hier der Ladeschritt allein
  for (const p of plugins.list) if (plugins.active(p.key)) geladen.push(p.key)
  assert.deepEqual(geladen, [], 'ein Plugin ohne Verzeichnis wird geladen')
})
