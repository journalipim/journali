// Der Solr-Import als Prozess gegen einen Stellvertreter für Solr und journali.
// 1. /api/tree liefert die Knoten als Liste: der Job erkennt, was ein früherer Lauf schon angelegt hat (sonst legt jeder Lauf alles noch einmal an —
//    und scheitert dann an Kennung und SKU, die es schon gibt).
// 2. Ein Probelauf schreibt nichts (der Rückgabewert allein hielt den Lauf nicht an).
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('../../plugins/solr/', import.meta.url))
const DOCS = [{ id: 'g1', master_id: 'G1', type: 'group', name: 'Gruppe', lang: 'de', main_parent_id: '' }]

function stellvertreter() {
  const gerufen = []
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x')
    gerufen.push(req.method + ' ' + u.pathname)
    res.setHeader('Content-Type', 'application/json')
    if (u.pathname.endsWith('/select')) {
      const erste = u.searchParams.get('cursorMark') === '*' && !(u.searchParams.get('q') ?? '').includes('type:property')
      return res.end(JSON.stringify({ response: { numFound: erste ? DOCS.length : 0, docs: erste ? DOCS : [] }, nextCursorMark: 'ende' }))
    }
    if (u.pathname === '/api/model') return res.end(JSON.stringify({ attributes: [{ key: 'name', type: 'text', group: 'stamm' }], groups: [{ key: 'stamm', label: { de: 'Stamm' } }] }))
    if (u.pathname === '/api/tree') return res.end(JSON.stringify([{ id: 'k-alt', role: 'group', external: { solr: 'G1' }, groups: 'stamm' }]))   // eine Liste, kein { rows }
    if (u.pathname === '/api/auth/me') { res.statusCode = 401; return res.end('{}') }
    if (u.pathname === '/api/batch') return res.end(JSON.stringify({ batch: 'b-1', results: [], error: null, skipped: [] }))
    res.end('{}')
  })
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({ server, gerufen, url: `http://127.0.0.1:${server.address().port}` })))
}

async function lauf(trocken) {
  const s = await stellvertreter()
  try {
    const out = await new Promise(ok => {
      const p = spawn(process.execPath, ['job.mjs', s.url, 'job:test'], {
        cwd, env: { ...process.env, JOURNALI_BASE: s.url + '/solr/products', JOURNALI_ROOTS: 'g1', JOURNALI_DRY_RUN: trocken ? 'true' : 'false' } })
      let text = ''; p.stdout.on('data', d => text += d); p.stderr.on('data', d => text += d)
      p.on('close', code => ok({ code, text }))
    })
    return { ...out, gerufen: s.gerufen }
  } finally { s.server.close() }
}

test('der Job erkennt Knoten, die es schon gibt — /api/tree ist eine Liste', async () => {
  const r = await lauf(true)
  assert.match(r.text, /analysiert: 1 Knoten \(1 vorhanden\)/, r.text)
})

test('ein Probelauf schreibt nichts', async () => {
  const r = await lauf(true)
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /Probelauf — nichts geschrieben/)
  assert.ok(!r.gerufen.some(g => g.startsWith('POST') || g.startsWith('PUT')), `nichts geschrieben: ${r.gerufen.join(' | ')}`)
})

test('ohne Probelauf wird geschrieben: der vorhandene Knoten bekommt keine Neuanlage', async () => {
  const r = await lauf(false)
  assert.match(r.text, /analysiert: 1 Knoten \(1 vorhanden\)/, r.text)
  assert.ok(!/group\.create/.test(r.text), r.text)
})
