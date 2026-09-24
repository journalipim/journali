// Import und Export je Format: CSV, Excel, JSON — dann die Zwischenablage. Eine Format-Kachel erscheint nur,
// solange ihr Plugin wirkt (needs); die Ansicht dahinter ist dieselbe, nur mit vorgewähltem Format.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { plugins } from '../src/plugins.js'

const TABLE = {
  views: [
    { path: 'import', topic: 'import', order: 10, needs: 'csv', label: 'CSV-Import', props: { nur: ['.csv'] } },
    { path: 'import-xlsx', topic: 'import', order: 11, needs: 'xlsx', label: 'Excel-Import', props: { nur: ['.xlsx'] } },
    { path: 'import-paste', topic: 'import', order: 20, label: 'Zwischenablage', props: { paste: true } },
    { path: 'export', topic: 'export', order: 10, needs: 'csv', label: 'CSV-Export', props: { festesFormat: 'csv' } },
  ],
}
async function welt(an) {
  plugins.list = ['table', 'csv', 'xlsx'].map(key => ({ key, installed: true, enabled: an.includes(key), allowed: true, manifest: { runs: 'browser', entry: 'entry.js', base: key === 'table' ? ['import'] : undefined } }))
  plugins.modules = new Map([['table', TABLE]])
  plugins.installNew = async () => {}
  const orig = plugins.list
  // _load holt die Liste vom Server; hier ist sie schon gesetzt
  const api = (await import('../src/api.js')).api
  const get = api.get; api.get = async () => orig
  try { await plugins._load() } finally { api.get = get }
  return plugins.views.map(v => v.label)
}

test('ohne das Format-Plugin fehlt seine Kachel; die Zwischenablage bleibt immer', async () => {
  assert.deepEqual(await welt(['table', 'csv', 'xlsx']), ['CSV-Import', 'Excel-Import', 'Zwischenablage', 'CSV-Export'])
  assert.deepEqual(await welt(['table', 'csv']), ['CSV-Import', 'Zwischenablage', 'CSV-Export'], 'Excel ist aus')
  assert.deepEqual(await welt(['table']), ['Zwischenablage'], 'ohne Formate bleibt nur die Zwischenablage')
})

test('jede Kachel bringt ihre festen Eigenschaften mit — daraus wird das vorgewählte Format', async () => {
  await welt(['table', 'csv', 'xlsx'])
  const v = l => plugins.views.find(x => x.label === l)
  assert.deepEqual(v('CSV-Import').props, { nur: ['.csv'] })
  assert.deepEqual(v('Zwischenablage').props, { paste: true })
  assert.deepEqual(v('CSV-Export').props, { festesFormat: 'csv' })
})
