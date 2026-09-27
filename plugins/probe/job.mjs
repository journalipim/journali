// Plugin probe: die Köpfe der Dateien lesen lassen, bis nichts mehr offen ist.
//
// Gelesen wird im Server (Journali.Server/MediaProbe.cs) — dort liegen die Bytes und es braucht keine
// Bibliothek dafür. Dieser Job ist nur der Antrieb: er ruft POST /api/media/probe in Runden, damit der Tasker
// die Arbeit führen kann (anhalten, fortsetzen, abbrechen, Zeitplan) und ein Import nicht darauf wartet.
//
// Wiederaufnahme ist nichts, was hier gebaut wäre: die offenen Posten sind die Medien ohne MediaProbed, also
// eine Frage an das Journal. Ein abgebrochener oder abgestürzter Lauf lässt sie offen, der nächste findet
// dieselben. Es gibt keinen Zustand, der mit diesem Prozess stirbt.
//
// Aufruf: node job.mjs <journali> <actor> [limit] [again] — der JobRunner setzt alles auch als JOURNALI_* in die Umgebung.
// Rückgabe 0 = nichts mehr offen, 2 = angehalten (der Tasker setzt fort), 3 = einzelne Dateien fehlen im Store, 1 = Abbruch.

const [, , serverArg, actorArg, limitArg, againArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'job:probe'
const jobKey = E.JOURNALI_JOB || 'probe'
const limit = Math.min(5000, Math.max(1, parseInt(limitArg || E.JOURNALI_LIMIT || '200', 10) || 200))
const again = /^(1|true|ja)$/i.test(String(againArg ?? E.JOURNALI_AGAIN ?? ''))
const headers = { 'X-Actor': actor, ...(E.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + E.JOURNALI_TOKEN } : {}) }

async function call(method, pfad) {
  const r = await fetch(server + pfad, { method, headers })
  if (!r.ok) throw new Error(`${pfad}: ${r.status} ${(await r.text()).slice(0, 300)}`)
  return r.json()
}

/// Hält der Tasker den Lauf an? Dann endet der Prozess; fortgesetzt wird er von Hand, und er findet dieselben Posten.
async function angehalten() {
  try { return (await call('GET', `/api/jobs/${encodeURIComponent(jobKey)}/signal`)).paused === true }
  catch { return false }   // kein Signal zu holen ist kein Grund aufzuhören
}

const stand = await call('GET', '/api/media/probe')
console.log(`${stand.total} Assets, ${stand.gelesen} mit Mass, ${stand.offen} offen, ${stand.unbekannt} ohne bekanntes Format`)
if (again) console.log('again: auch die ohne bekanntes Format werden erneut gelesen')

let gelesen = 0, unbekannt = 0, fehlt = 0, runde = 0
for (;;) {
  if (await angehalten()) { console.log(`angehalten nach ${runde} Runden — ${gelesen} gelesen`); process.exit(2) }
  const r = await call('POST', `/api/media/probe?limit=${limit}&again=${again}`)
  runde++
  gelesen += r.gelesen; unbekannt += r.unbekannt; fehlt += r.fehlt
  console.log(`Runde ${runde}: ${r.gelesen} gelesen, ${r.unbekannt} ohne bekanntes Format, ${r.fehlt} fehlen im Store — ${r.offen} offen`)
  // Keine Runde kam voran und nichts ist mehr offen: fertig. Kam keine voran, ist aber noch etwas offen,
  // liegt es an Dateien, die im Store fehlen — dann hört der Job auf, statt ewig zu kreisen.
  if (r.offen === 0) break
  if (r.gelesen + r.unbekannt === 0) { console.error(`✗ ${r.offen} offen, aber nichts zu lesen — Dateien fehlen im Store (/api/media/missing)`); process.exit(3) }
}

console.log(`fertig: ${gelesen} mit Mass, ${unbekannt} ohne bekanntes Format, ${fehlt} fehlen im Store`)
process.exit(fehlt > 0 ? 3 : 0)
