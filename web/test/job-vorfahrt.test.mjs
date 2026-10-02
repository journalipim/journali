// Ein Import hat Vorfahrt: der Server meldet den Systemjobs (Vektoren, Ableitungen, Dokumente lesen, Erkennen, Messen) über
// GET /api/jobs/<job>/signal, dass sie warten sollen. Der Prozess endet dann mit 2, ohne eine weitere Runde zu holen.
// Früher setzten embed, probe und ocr nur den Rückgabewert und liefen weiter; derive und docs fragten das Signal gar nicht.
// Der Server ist ein Stellvertreter, geprüft wird, was der Prozess ihm schickt und womit er endet.
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const wurzel = fileURLToPath(new URL('../../plugins/', import.meta.url))

function stellvertreter(pausiert) {
  const gerufen = []
  const server = http.createServer((req, res) => {
    gerufen.push(req.method + ' ' + req.url)
    res.setHeader('Content-Type', 'application/json')
    if (/\/api\/jobs\/[^/]+\/signal$/.test(req.url)) return res.end(JSON.stringify({ paused: pausiert, running: true, reason: pausiert ? 'Import' : null }))
    res.end(JSON.stringify({ ready: true, chunks: 0, embedded: 0, nodes: 0, nodesTotal: 0, offen: 0, total: 0, gelesen: 0, unbekannt: 0, items: [], presets: [], pending: [], scans: [], media: 0, fehlt: 0 }))
  })
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({ server, gerufen, url: `http://127.0.0.1:${server.address().port}` })))
}

async function lauf(plugin, pausiert) {
  const s = await stellvertreter(pausiert)
  try {
    const out = await new Promise(ok => {
      const p = spawn(process.execPath, ['job.mjs', s.url, 'job:test'], { cwd: wurzel + plugin, env: { ...process.env, JOURNALI_JOB: plugin } })
      let text = ''; p.stdout.on('data', d => text += d); p.stderr.on('data', d => text += d)
      p.on('close', code => ok({ code, text }))
    })
    return { ...out, gerufen: s.gerufen }
  } finally { s.server.close() }
}

// was ein Lauf als Nächstes holte, wenn er nicht angehalten wurde: die offenen Posten
const POSTEN = { embed: /\/pending/, probe: /^POST \/api\/media\/probe/, ocr: /\/api\/docs\/scans/, derive: /\/api\/media\/pending/, docs: /\/api\/docs\/status\?pending/ }

for (const plugin of Object.keys(POSTEN)) {
  test(`${plugin}: meldet der Server „anhalten“, endet der Lauf mit 2 und holt keine offenen Posten`, async () => {
    const r = await lauf(plugin, true)
    assert.equal(r.code, 2, r.text)
    assert.ok(r.gerufen.some(g => g.includes(`/api/jobs/${plugin}/signal`)), 'das Signal wurde gefragt')
    assert.ok(!r.gerufen.some(g => POSTEN[plugin].test(g)), `keine Runde geholt: ${r.gerufen.join(' | ')}`)
  })

  test(`${plugin}: ohne Anhalten fragt der Lauf die offenen Posten und endet nicht mit 2`, async () => {
    const r = await lauf(plugin, false)
    assert.notEqual(r.code, 2, r.text)
    assert.ok(r.gerufen.some(g => POSTEN[plugin].test(g)), `offene Posten gefragt: ${r.gerufen.join(' | ')}`)
  })
}
