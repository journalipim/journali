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
    const html = marked.parse(md, { gfm: true })
    fs.writeFileSync(path.join(OUT, code, slug + '.html'), html)
    index.push({ slug, title, nr: f.slice(0, 2) })
  }
  fs.writeFileSync(path.join(OUT, code, 'index.json'), JSON.stringify(index, null, 1) + '\n')
  console.log(`help/${code}: ${index.length} Kapitel`)
}
