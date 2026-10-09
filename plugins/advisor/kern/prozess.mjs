// Der Kern als Kindprozess von journali (docs/pflegestruktur.md 44): für die Vorschau unter ⇪ Produktberatung (AdvisorKern.cs, Muster Embedder.cs).
// Je Zeile auf stdin eine Anfrage { id, journali, token, berater, eingabe }, je Zeile auf stdout die Antwort { id, antwort } oder { id, error }.
// Der Kern fragt journali über /api wie im Dienst — mit einem Token, das journali für diesen Prozess ausgibt und nur im Arbeitsspeicher hält.
import readline from 'node:readline'
import { erstelleKern } from './gespraech.mjs'

const kerne = new Map()   // journali|berater|token → Kern (mit seinem Gedächtnis)

function kernFuer(journali, berater, token) {
  const k = `${journali}|${berater}|${token}`
  if (!kerne.has(k)) {
    const basis = journali.replace(/\/+$/, '') + '/api/advisor/' + encodeURIComponent(berater) + '/'
    kerne.set(k, erstelleKern({
      journali: async (pfad, body, kopf = {}) => {
        const r = await fetch(basis + pfad, {
          method: body === undefined ? 'GET' : 'POST',
          headers: { authorization: 'Bearer ' + token, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...kopf },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
        const text = await r.text()
        let json = null; try { json = text ? JSON.parse(text) : null } catch { json = { error: text.slice(0, 200) } }
        return { status: r.status, json }
      },
    }))
  }
  return kerne.get(k)
}

const zeilen = readline.createInterface({ input: process.stdin })
zeilen.on('line', async zeile => {
  let id = null
  try {
    const a = JSON.parse(zeile)
    id = a.id
    const antwort = await kernFuer(a.journali, a.berater, a.token).antworte(a.eingabe ?? {})
    process.stdout.write(JSON.stringify({ id, antwort }) + '\n')
  } catch (e) {
    process.stdout.write(JSON.stringify({ id, error: e.message, status: e.status ?? 500 }) + '\n')
  }
})
