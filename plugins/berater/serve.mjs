// Startet den Dienst des Produktberaters (dienst.mjs) — im eigenen Container, ohne npm-Pakete:
//   docker run -v ./plugins/berater:/berater:ro -e JOURNALI=http://server:8080 -e JOURNALI_BERATER=shop -e JOURNALI_BERATER_TOKEN=jb_… -p 8090:8090 node:22-alpine node /berater/serve.mjs
// Umgebung:
//   JOURNALI                 Adresse des journali-Servers, wie der Container ihn erreicht
//   JOURNALI_BERATER         Schlüssel des Beraters (⇪ Export → Produktberatung)
//   JOURNALI_BERATER_TOKEN   sein Token (jb_…, dort ausgegeben) — oder JOURNALI_BERATER_TOKEN_FILE mit dem Pfad einer Datei
//   PORT                     Vorgabe 8090
//   JOURNALI_PROXY=1         hinter einem Reverse Proxy: die Adresse des Besuchers aus X-Forwarded-For (nur dann setzen)
import http from 'node:http'
import fs from 'node:fs'
import { erstelle } from './dienst.mjs'

const env = process.env
const token = env.JOURNALI_BERATER_TOKEN || (env.JOURNALI_BERATER_TOKEN_FILE ? fs.readFileSync(env.JOURNALI_BERATER_TOKEN_FILE, 'utf8').trim() : '')
for (const [name, wert] of [['JOURNALI', env.JOURNALI], ['JOURNALI_BERATER', env.JOURNALI_BERATER], ['JOURNALI_BERATER_TOKEN', token]])
  if (!wert) { console.error(`berater: ${name} fehlt.`); process.exit(2) }

const widget = fs.readFileSync(new URL('./widget.js', import.meta.url), 'utf8')
const handler = erstelle({ journali: env.JOURNALI, berater: env.JOURNALI_BERATER, token, widget, proxy: env.JOURNALI_PROXY === '1' })
const port = Number(env.PORT || 8090)
const server = http.createServer(handler)
server.headersTimeout = 10_000; server.requestTimeout = 30_000
server.listen(port, () => console.log(`berater ${env.JOURNALI_BERATER}: Port ${port}, journali ${env.JOURNALI}`))
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => server.close(() => process.exit(0)))
