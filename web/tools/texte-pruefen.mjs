// Stand der Übersetzungen (24.09.2026): welche Schlüssel aus den Quellen in einer Sprachdatei fehlen und welche
// Einträge dort keinen Schlüssel mehr haben (der deutsche Text hat sich geändert oder ist weg).
//   node tools/texte-pruefen.mjs           alle Sprachen unter public/lang/
//   node tools/texte-pruefen.mjs en        eine
//   node tools/texte-pruefen.mjs en --fehlend   nur die fehlenden Schlüssel, einer je Zeile (zum Übersetzen)
import fs from 'node:fs'
import path from 'node:path'
import { schluessel } from '../test/texte.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const walk = d => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : /\.(vue|js)$/.test(e.name) ? [path.join(d, e.name)] : [])

/// Alle Schlüssel der Oberfläche (src/) — die Referenz, es gibt keine de.json
export function quellSchluessel() {
  const set = new Set()
  for (const f of walk(path.join(ROOT, 'src'))) for (const k of schluessel(fs.readFileSync(f, 'utf8'))) set.add(k)
  return set
}

export function stand(code) {
  const file = path.join(ROOT, 'public', 'lang', code + '.json')
  const map = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''))
  const quelle = quellSchluessel()
  const fehlend = [...quelle].filter(k => !(k in map))
  const verwaist = Object.keys(map).filter(k => !quelle.has(k))
  const leer = Object.entries(map).filter(([, v]) => typeof v !== 'string' || !v.trim()).map(([k]) => k)
  return { code, gesamt: quelle.size, uebersetzt: quelle.size - fehlend.length, fehlend, verwaist, leer }
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith('texte-pruefen.mjs')) {
  const args = process.argv.slice(2)
  const nurFehlend = args.includes('--fehlend')
  const codes = args.filter(a => !a.startsWith('--'))
  const alle = codes.length ? codes : fs.readdirSync(path.join(ROOT, 'public', 'lang')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5))
  for (const code of alle) {
    const s = stand(code)
    if (nurFehlend) { for (const k of s.fehlend) console.log(k); continue }
    console.log(`${code}: ${s.uebersetzt} / ${s.gesamt} übersetzt · ${s.fehlend.length} fehlen · ${s.verwaist.length} verwaist · ${s.leer.length} leer`)
  }
}
