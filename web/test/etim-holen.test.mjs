// ETIM holen (14.10.2026): keine Freigabe mehr im Journal. Der Prozess fetch.mjs liest sie von ihrer URL — index gibt die Suchliste zurück und
// merkt nur die Freigabe (mit URL), classes schreibt genau die genannten Klassen. Geprüft am echten Prozess gegen einen kleinen HTTP-Server, der
// die Freigabe (sample.xml) liefert und die Plugin-Daten von journali nachbildet.
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const etim = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'plugins', 'etim')
const sample = fs.readFileSync(path.join(etim, 'sample.xml'))

async function welt() {
  const daten = new Map(); const schreiben = []
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const t of req) body += t
    const u = decodeURIComponent(req.url)
    if (u === '/sample.xml') { res.end(sample); return }
    if (u.startsWith('/api/plugins/etim/data')) {
      const name = u.slice('/api/plugins/etim/data'.length).replace(/^\//, '')
      if (req.method === 'PUT' && name) { daten.set(name, JSON.parse(body)); schreiben.push(name); res.end('{}'); return }
      if (req.method === 'PUT') { for (const [n, v] of Object.entries(JSON.parse(body))) { daten.set(n, v); schreiben.push(n) } res.end('{}'); return }
      if (daten.has(name)) { res.end(JSON.stringify(daten.get(name))); return }
      res.statusCode = 404; res.end('{}'); return
    }
    res.statusCode = 404; res.end()
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${server.address().port}`
  // asynchron: der Server dieses Tests muss antworten können, während der Prozess läuft
  const lauf = (...args) => new Promise((ok, fehler) => {
    const p = spawn(process.execPath, ['fetch.mjs', url, 'test', ...args], { cwd: etim })
    let aus = '', err = ''
    p.stdout.on('data', d => aus += d); p.stderr.on('data', d => err += d)
    p.on('close', code => code === 0 ? ok(JSON.parse(aus.trim().split('\n').pop())) : fehler(new Error(err || `exit ${code}`)))
  })
  return { url, daten, schreiben, lauf, ende: () => server.close() }
}

test('index: die Suchliste kommt zurück, ins Journal nur die Freigabe mit ihrer URL — keine Klasse', async () => {
  const w = await welt()
  try {
    const j = await w.lauf('index', w.url + '/sample.xml', 'de,en', '')
    assert.deepEqual(j.liste.map(c => c.code).sort(), ['EC000001', 'EC000042'])
    for (const c of j.liste) {
      assert.equal(typeof c.features, 'number', 'die Suchliste nennt nur die Zahl der ETIM-Attribute')
      assert.ok(Object.keys(c.name).length)
    }
    assert.equal(j.url, w.url + '/sample.xml')
    assert.ok(w.schreiben.every(n => n === 'release' || n.startsWith('release:')), `geschrieben: ${w.schreiben.join(', ')}`)
    assert.equal(w.daten.get('release:' + j.key).url, w.url + '/sample.xml', 'die URL steht an der Freigabe — damit holt man sie wieder')
    assert.ok(w.daten.has('release'), 'die erste Freigabe wird die aktuelle')
  } finally { w.ende() }
})

test('classes: genau die genannten Klassen kommen vollständig ins Journal; was es nicht gibt, wird genannt', async () => {
  const w = await welt()
  try {
    const j = await w.lauf('classes', w.url + '/sample.xml', 'de,en', 'ec000042,EC999999')
    assert.equal(j.written, 1)
    assert.deepEqual(j.missing, ['EC999999'])
    assert.deepEqual(w.schreiben, [`class:${j.key}:EC000042`])
    const k = w.daten.get(`class:${j.key}:EC000042`)
    assert.ok(Array.isArray(k.features) && k.features.length > 0, 'vollständig: mit den ETIM-Attributen')
    await assert.rejects(() => w.lauf('classes', w.url + '/sample.xml', 'de', ''), /keine Klasse genannt/)
  } finally { w.ende() }
})
