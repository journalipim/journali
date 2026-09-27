// Plugin embed: Abschnitte und Knoten ohne Vektor einbetten, bis nichts mehr offen ist (27.09.2026, pflegestruktur 35).
//
// Die offenen Posten sind eine Frage an den Server (GET /api/docs/embed/pending): Abschnitte des Dokumentindex ohne
// Vektor zu ihrem Hash und diesem Modell, Knoten, deren Text sich seit der Einbettung geändert hat. Ein abgebrochener
// Lauf lässt sie offen, der nächste findet dieselben — es gibt keinen Zustand, der mit diesem Prozess stirbt.
// Gerechnet wird hier, mit dem lokalen Modell (model.mjs); zurück geht ein PUT /api/docs/embed je Runde.
//
// Aufruf: node job.mjs <journali> <actor> [limit] [model] — der JobRunner setzt alles auch als JOURNALI_* in die Umgebung.
// Rückgabe 0 = nichts mehr offen, 2 = angehalten (der Tasker setzt fort), 1 = Abbruch.
import { embed, DEFAULT_MODEL } from './model.mjs'
import { batches } from './core.mjs'

const [, , serverArg, actorArg, limitArg, modelArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'job:embed'
const jobKey = E.JOURNALI_JOB || 'embed'
const limit = Math.min(1000, Math.max(1, parseInt(limitArg || E.JOURNALI_LIMIT || '64', 10) || 64))
const model = (modelArg || E.JOURNALI_MODEL || E.JOURNALI_EMBED_MODEL || DEFAULT_MODEL).trim()
const headers = { 'X-Actor': actor, ...(E.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + E.JOURNALI_TOKEN } : {}) }

async function call(method, pfad, body) {
  const r = await fetch(server + pfad, { method, headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers, body: body ? JSON.stringify(body) : undefined })
  if (!r.ok) throw new Error(`${pfad}: ${r.status} ${(await r.text()).slice(0, 300)}`)
  return r.json()
}

/// Hält der Tasker den Lauf an? Dann endet der Prozess; fortgesetzt wird er von Hand, und er findet dieselben Posten.
async function angehalten() {
  try { return (await call('GET', `/api/jobs/${encodeURIComponent(jobKey)}/signal`)).paused === true }
  catch { return false }
}

const stand = await call('GET', `/api/docs/embed?model=${encodeURIComponent(model)}`)
if (stand.ready === false) { console.error('✗ ' + (stand.reason ?? 'keine Vektoren')); process.exit(1) }
console.log(`${stand.chunks} Abschnitte, ${stand.embedded} mit Vektor · ${stand.nodesTotal} Knoten, ${stand.nodes} mit Vektor · ${stand.offen} offen · Modell ${model}`)

let abschnitte = 0, knoten = 0, runde = 0
for (;;) {
  if (await angehalten()) { console.log(`angehalten nach ${runde} Runden — ${abschnitte} Abschnitte, ${knoten} Knoten`); process.exit(2) }
  const offen = await call('GET', `/api/docs/embed/pending?limit=${limit}&model=${encodeURIComponent(model)}`)
  if (offen.ready === false) { console.error('✗ ' + (offen.reason ?? 'keine Vektoren')); process.exit(1) }
  const chunks = offen.chunks ?? [], nodes = offen.nodes ?? []
  if (!chunks.length && !nodes.length && !(offen.gone ?? []).length) break
  runde++
  const t0 = Date.now()
  const outChunks = [], outNodes = []
  for (const stapel of batches(chunks, 16)) {
    const vs = await embed(stapel.map(c => c.text), 'passage', model)
    stapel.forEach((c, i) => outChunks.push({ media: c.media, sha256: c.sha256, seq: c.seq, vector: vs[i] }))
  }
  for (const stapel of batches(nodes, 16)) {
    const vs = await embed(stapel.map(n => n.text), 'passage', model)
    stapel.forEach((n, i) => outNodes.push({ node: n.node, locale: n.locale, hash: n.hash, vector: vs[i] }))
  }
  const r = await call('PUT', '/api/docs/embed', { model, chunks: outChunks, nodes: outNodes, gone: offen.gone ?? [] })
  abschnitte += r.chunks ?? 0; knoten += r.nodes ?? 0
  console.log(`Runde ${runde}: ${r.chunks} Abschnitte, ${r.nodes} Knoten${(offen.gone ?? []).length ? `, ${offen.gone.length} Knoten weg` : ''} · ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  // Nichts kam voran, aber es war etwas offen: dann stimmt etwas nicht (leerer Text?) — aufhören statt kreisen
  if ((r.chunks ?? 0) + (r.nodes ?? 0) === 0 && (chunks.length + nodes.length) > 0) { console.error(`✗ ${chunks.length + nodes.length} Posten offen, aber nichts geschrieben`); process.exit(1) }
}
console.log(`fertig: ${abschnitte} Abschnitte, ${knoten} Knoten eingebettet`)
process.exit(0)
