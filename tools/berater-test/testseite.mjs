#!/usr/bin/env node
// Der Testaufbau des Produktberaters (tools/berater-test, gestartet mit tools\berater.cmd start): eine Testseite auf dem PC: eine leere Shop-Seite, die das Chat-Fenster des lokalen Dienstes
// einbindet — so, wie eine Website es täte. Ihre Adresse (http://localhost:8091) gehört unter „Websites“ des Beraters, sonst antwortet der
// Dienst dem Browser mit 403.
//
//   node tools/berater-test/testseite.mjs [--port 8091] [--dienst http://localhost:8090]
import http from 'node:http'

/// Die Seite: schwebend unten rechts, dazu ein eingebetteter Berater unter ?eingebettet, englisch mit ?en
export function seite(dienst, { eingebettet = false, englisch = false } = {}) {
  const attr = [englisch ? ' data-locale="en"' : '', eingebettet ? ' data-target="#berater"' : ''].join('')
  return `<!doctype html>
<html lang="${englisch ? 'en' : 'de'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Testseite Produktberater</title>
<style>body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 24px; background: #f6f6f4; color: #222; } main { max-width: 900px; margin: 0 auto; }
#berater { height: 640px; margin-top: 16px; } nav a { margin-right: 12px; }</style></head>
<body><main>
<h1>Testseite</h1>
<p>Diese Seite bindet das Chat-Fenster des Beraters ein, wie eine Website es täte.</p>
<nav><a href="/">schwebend</a><a href="/?eingebettet">eingebettet</a><a href="/?en">englisch</a></nav>
${eingebettet ? '<div id="berater"></div>' : ''}
</main>
<script src="${dienst.replace(/\/+$/, '')}/widget.js"${attr} async></script>
</body></html>`
}

function argument(name, vorgabe) {
  const i = process.argv.indexOf('--' + name)
  return i > 0 ? process.argv[i + 1] : vorgabe
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('berater-test/testseite.mjs')) {
  const port = Number(argument('port', 8091)), dienst = argument('dienst', 'http://localhost:8090')
  http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://seite')
    if (url.pathname !== '/') { res.writeHead(404); return res.end() }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    res.end(seite(dienst, { eingebettet: url.searchParams.has('eingebettet'), englisch: url.searchParams.has('en') }))
  }).listen(port, () => console.log(`test page: http://localhost:${port} (advisor service ${dienst})`))
}
