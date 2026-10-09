// Startet den Dienst des Produktberaters (dienst.mjs) — im eigenen Container, ohne npm-Pakete:
//   docker run -v ./plugins/advisor:/advisor:ro -e JOURNALI=http://server:8080 -e JOURNALI_ADVISOR=shop -e JOURNALI_ADVISOR_TOKEN=ja_… -p 8090:8090 node:22-alpine node /advisor/serve.mjs
// Umgebung:
//   JOURNALI                 Adresse des journali-Servers, wie der Container ihn erreicht
//   JOURNALI_ADVISOR         Schlüssel des Beraters (⇪ Export → Produktberatung)
//   JOURNALI_ADVISOR_TOKEN   sein Token (ja_…, dort ausgegeben) — oder JOURNALI_ADVISOR_TOKEN_FILE mit dem Pfad einer Datei
//   PORT                     Vorgabe 8090
//   JOURNALI_PROXY=1         hinter einem Reverse Proxy: die Adresse des Besuchers aus X-Forwarded-For (nur dann setzen)
//   JOURNALI_ADVISOR_DATA    ein Verzeichnis (Volume) für das Lernen — lernen.json: Wörter ohne Treffer, gelesene Tippfehler, Wörter vor dem
//                            Öffnen, Merken oder Ablehnen; ohne Angabe zählt der Dienst nur im Arbeitsspeicher. Vorschläge: node vorschlaege.mjs <datei>
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { erstelle } from './dienst.mjs'
import { erstelleLernen } from './kern/lernen.mjs'

const env = process.env
const token = env.JOURNALI_ADVISOR_TOKEN || (env.JOURNALI_ADVISOR_TOKEN_FILE ? fs.readFileSync(env.JOURNALI_ADVISOR_TOKEN_FILE, 'utf8').trim() : '')
for (const [name, wert] of [['JOURNALI', env.JOURNALI], ['JOURNALI_ADVISOR', env.JOURNALI_ADVISOR], ['JOURNALI_ADVISOR_TOKEN', token]])
  if (!wert) { console.error(`advisor: ${name} fehlt.`); process.exit(2) }

const widget = fs.readFileSync(new URL('./widget.js', import.meta.url), 'utf8')
const lernen = erstelleLernen({ datei: env.JOURNALI_ADVISOR_DATA ? path.join(env.JOURNALI_ADVISOR_DATA, 'lernen.json') : null })
const handler = erstelle({ journali: env.JOURNALI, advisor: env.JOURNALI_ADVISOR, token, widget, proxy: env.JOURNALI_PROXY === '1', lernen })
const port = Number(env.PORT || 8090)
const server = http.createServer(handler)
server.headersTimeout = 10_000; server.requestTimeout = 30_000
server.listen(port, () => console.log(`advisor ${env.JOURNALI_ADVISOR}: Port ${port}, journali ${env.JOURNALI}`))
// beim Beenden das Gelernte schreiben (sonst höchstens eine Minute alt)
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { try { lernen.schreibe() } catch (e) { console.error(`advisor: lernen.json: ${e.message}`) } server.close(() => process.exit(0)) })
