// Hilfe in der Instanz: Kapitel als Markdown unter help/<code>/NN-<slug>.md, beim Bau nach HTML —
// public/help/<code>/<slug>.html plus index.json (Reihenfolge, Titel). Vite kopiert public/ nach wwwroot, der Server
// liefert es aus; zur Laufzeit braucht es kein Markdown-Paket. Fehlt ein Kapitel in einer Sprache, zeigt die Ansicht das
// deutsche. Übersetzungen kommen als weitere Ordner unter help/ — dieselbe Sprachliste wie die Oberfläche.
//   node build-help.mjs
import fs from 'node:fs'
import path from 'node:path'
import { marked } from 'marked'

const ROOT = path.resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const SRC = path.join(ROOT, '..', 'help')
const OUT = path.join(ROOT, 'public', 'help')

/// Blöcke für die Startphase (05.10.2026): <!-- lizenz --> … <!-- /lizenz --> gilt nur mit Lizenz, <!-- startphase --> … <!-- /startphase -->
/// nur in der Startphase. Jeder Teil wird für sich übersetzt und in <div class="nur-lizenz"> bzw. <div class="nur-startphase"> gelegt;
/// welcher sichtbar ist, entscheidet das Hilfefenster.
export function bloecke(md) {
  const teile = md.split(/<!-- (\/?)(lizenz|startphase) -->/)
  let html = marked.parse(teile[0], { gfm: true })
  for (let i = 1; i < teile.length; i += 3) {
    const zu = teile[i] === '/', art = teile[i + 1], text = teile[i + 2] ?? ''
    if (zu) html += marked.parse(text, { gfm: true })
    else html += `<div class="nur-${art}">\n${marked.parse(text, { gfm: true })}</div>\n`   // nicht geschachtelt: was nach dem Ende kommt, ist der nächste Teil
  }
  return html
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) bauen()

function bauen() {
fs.rmSync(OUT, { recursive: true, force: true })
const langs = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter(d => fs.statSync(path.join(SRC, d)).isDirectory()) : []
for (const code of langs) {
  const dir = path.join(SRC, code)
  const files = fs.readdirSync(dir).filter(f => /^\d\d-.+\.md$/.test(f)).sort()
  const index = []
  fs.mkdirSync(path.join(OUT, code), { recursive: true })
  for (const f of files) {
    const md = fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, '')
    const slug = f.replace(/^\d\d-/, '').replace(/\.md$/, '')
    const title = (md.match(/^#\s+(.+)$/m)?.[1] ?? slug).trim()
    const html = bloecke(md)
    fs.writeFileSync(path.join(OUT, code, slug + '.html'), html)
    // <!-- nur-mit-lizenz -->: das Kapitel gilt nur ausserhalb der Startphase (05.10.2026) — die Ansicht lässt es dann weg
    index.push({ slug, title, nr: f.slice(0, 2), ...(md.includes('<!-- nur-mit-lizenz -->') ? { lizenz: true } : {}) })
  }
  fs.writeFileSync(path.join(OUT, code, 'index.json'), JSON.stringify(index, null, 1) + '\n')
  console.log(`help/${code}: ${index.length} Kapitel`)
}
}
