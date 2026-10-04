// Plugin embed — der vorgehaltene Prozess für Suchanfragen (27.09.2026). Der Server startet ihn beim ersten Bedarf
// (Journali.Server/Embedder.cs) und schreibt je Zeile eine Anfrage { text, kind } auf stdin; hier kommt je Zeile eine
// Antwort { model, dims, vector } oder { error } auf stdout zurück. Meldungen gehen nach stderr, damit stdout rein bleibt.
// Das Modell wird beim Start geladen, nicht erst bei der ersten Frage.
import readline from 'node:readline'
import { load, embed, DEFAULT_MODEL } from './model.mjs'
import { parseLine, replyLine, errorLine } from './core.mjs'

const model = process.env.JOURNALI_EMBED_MODEL || DEFAULT_MODEL
const t0 = Date.now()
try { await load(model); console.error(`model ${model} loaded (${((Date.now() - t0) / 1000).toFixed(1)} s)`) }
catch (e) { console.error('✗ ' + e.message); process.exit(1) }

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
let queue = Promise.resolve()   // eine Anfrage nach der anderen — der Server wartet je Zeile auf ihre Antwort
rl.on('line', line => {
  queue = queue.then(async () => {
    const req = parseLine(line)
    if (!req) { process.stdout.write(errorLine('Anfrage nicht lesbar') + '\n'); return }
    try { const [v] = await embed([req.text], req.kind, model); process.stdout.write(replyLine(model, v) + '\n') }
    catch (e) { process.stdout.write(errorLine(e.message) + '\n') }
  })
})
rl.on('close', () => process.exit(0))
