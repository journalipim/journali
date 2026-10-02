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

function stellvertreter(docs = DOCS) {
  const gerufen = []
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x')
    gerufen.push(req.method + ' ' + u.pathname)
    res.setHeader('Content-Type', 'application/json')
    if (u.pathname.endsWith('/select')) {
      const erste = u.searchParams.get('cursorMark') === '*' && !(u.searchParams.get('q') ?? '').includes('type:property')
      return res.end(JSON.stringify({ response: { numFound: erste ? docs.length : 0, docs: erste ? docs : [] }, nextCursorMark: 'ende' }))
    }
    if (u.pathname === '/api/model') return res.end(JSON.stringify({
      attributes: [{ key: 'name', type: 'text', group: 'stamm' }, ...Array.from({ length: 6 }, (_, i) => ({ key: 'abmessung_' + i, type: 'text', group: 'solr' }))],
      groups: [{ key: 'stamm', label: { de: 'Stamm' } }, { key: 'solr', label: { de: 'solr' } }] }))
    if (u.pathname === '/api/tree') return res.end(JSON.stringify([{ id: 'k-alt', role: 'group', external: { solr: 'G1' }, groups: 'stamm' }]))   // eine Liste, kein { rows }
    if (u.pathname === '/api/auth/me') { res.statusCode = 401; return res.end('{}') }
    if (u.pathname === '/api/batch') return res.end(JSON.stringify({ batch: 'b-1', results: [], error: null, skipped: [] }))
    res.end('{}')
  })
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({ server, gerufen, url: `http://127.0.0.1:${server.address().port}` })))
}

async function lauf(trocken, extra = {}, docs = DOCS) {
  const s = await stellvertreter(docs)
  try {
    const out = await new Promise(ok => {
      const p = spawn(process.execPath, ['job.mjs', s.url, 'job:test'], {
        cwd, env: { ...process.env, JOURNALI_BASE: s.url + '/solr/products', JOURNALI_ROOTS: 'g1', JOURNALI_DRY_RUN: trocken ? 'true' : 'false', ...extra } })
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

// Eine Quelle, in der abmessung_0–2 am Produkt und abmessung_3–5 an der Variante stehen: das Thema spannt zwei Ebenen
const MIT_EBENEN = [
  { id: 'g1', master_id: 'G1', type: 'group', name: 'Gruppe', lang: 'de', main_parent_id: '' },
  { id: 'p1', master_id: 'P1', type: 'product', name: 'Produkt', lang: 'de', main_parent_id: 'g1', property__abmessung_0__string: 'a', property__abmessung_1__string: 'b', property__abmessung_2__string: 'c' },
  { id: 'v1', master_id: 'V1', type: 'productVariant', name: 'Variante', lang: 'de', main_parent_id: 'p1', property__abmessung_3__string: 'd', property__abmessung_4__string: 'e', property__abmessung_5__string: 'f' },
]

test('regroup (Probelauf): Thema und Ebene der Werte in der Quelle ordnen die Attribute, nichts wird geschrieben', async () => {
  const r = await lauf(true, { JOURNALI_REGROUP: 'true' }, MIT_EBENEN)
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /6 Attribute der Gruppe solr → 2 Gruppen/)
  assert.match(r.text, /gruppe_product \(Gruppe · Produktmerkmale\) an Gruppe ab product: 3/)
  assert.match(r.text, /gruppe_variant \(Gruppe · Variantenmerkmale\) an Gruppe ab variant: 3/)
  assert.ok(!r.gerufen.some(g => g.startsWith('PUT') || g.startsWith('POST /api/batch')), r.gerufen.join(' | '))
})

test('regroup: schreibt Gruppen mit „aktiv ab“, vererbbare Attribute und lesbare Bezeichnungen', async () => {
  const r = await lauf(false, { JOURNALI_REGROUP: 'true' }, MIT_EBENEN)
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /✓ 6 Attribute in 2 Gruppen, 1 Knoten angepasst/)
})

test('regroup braucht die Quelle: ohne sie weiss der Job nicht, auf welcher Ebene die Werte stehen', async () => {
  const r = await lauf(true, { JOURNALI_REGROUP: 'true', JOURNALI_BASE: '', JOURNALI_ROOTS: '' })
  assert.equal(r.code, 1)
  assert.match(r.text, /Quelle oder Wurzel fehlt/)
})
