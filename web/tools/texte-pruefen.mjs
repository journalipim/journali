// Stand der Übersetzungen (24.09.2026): welche Schlüssel aus den Quellen in einer Sprachdatei fehlen und welche
// Einträge dort keinen Schlüssel mehr haben (der deutsche Text hat sich geändert oder ist weg).
//   node tools/texte-pruefen.mjs                 alle Sprachen unter public/lang/
//   node tools/texte-pruefen.mjs en              eine
//   node tools/texte-pruefen.mjs en --fehlend    nur die fehlenden Schlüssel, einer je Zeile (zum Übersetzen)
//   node tools/texte-pruefen.mjs en --plugins    je Plugin (plugins/<key>/lang/<code>.json)
//   node tools/texte-pruefen.mjs en --plugin=da  ein Plugin
import fs from 'node:fs'
import path from 'node:path'
import { schluessel } from '../test/texte.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const PLUGINS = path.join(ROOT, '..', 'plugins')
const walk = d => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : /\.(vue|js)$/.test(e.name) ? [path.join(d, e.name)] : [])
const lies = f => fs.readFileSync(f, 'utf8').replace(/^﻿/, '')

/// Meldungen des Servers (Journali.Server/*.cs): Bad("…"), Err("…"), Outcome.Bad("…") — mit {0}, {1} … als Vorlage — und
/// error = "…" / template = "…" in Antwortobjekten; dazu die Ausnahmen mit festem Text, die als Meldung ankommen.
/// Der Schlüssel ist der deutsche Text; die Oberfläche übersetzt ihn (api.js) und setzt die Werte ein.
const SERVER = path.join(ROOT, '..', 'Journali.Server')
const csText = s => JSON.parse('"' + s.replace(/\\(.)/g, (m, c) => c === '"' ? '\\"' : m) + '"')
export function serverSchluessel() {
  const set = new Set()
  for (const f of fs.readdirSync(SERVER).filter(f => f.endsWith('.cs') && f !== 'JobRunner.cs')) {
    const src = lies(path.join(SERVER, f))
    for (const m of src.matchAll(/(?:\bBad|\bErr|Outcome\.Bad)\("((?:[^"\\]|\\.)*)"/g)) set.add(csText(m[1]))
    for (const m of src.matchAll(/(?:error|template) = "((?:[^"\\]|\\.)*)"/g)) set.add(csText(m[1]))
    for (const m of src.matchAll(/Exception\("((?:[^"\\]|\\.)*)"\)/g)) set.add(csText(m[1]))
  }
  return set
}

/// Alle Schlüssel der Oberfläche (src/) und des Servers — die Referenz, es gibt keine de.json
export function quellSchluessel() {
  const set = serverSchluessel()
  for (const f of walk(path.join(ROOT, 'src'))) for (const k of schluessel(lies(f))) set.add(k)
  return set
}

/// Browserdateien eines Plugins: src/** (gebaut), sonst entry.js; dazu browser.js — Prozess-Skripte bleiben draussen
export function pluginDateien(key) {
  const d = path.join(PLUGINS, key); const out = []
  if (fs.existsSync(path.join(d, 'src'))) out.push(...walk(path.join(d, 'src')))
  else if (fs.existsSync(path.join(d, 'entry.js'))) out.push(path.join(d, 'entry.js'))
  if (fs.existsSync(path.join(d, 'browser.js'))) out.push(path.join(d, 'browser.js'))
  return out
}

/// Schlüssel eines Plugins
export function pluginSchluessel(key) {
  const set = new Set()
  for (const f of pluginDateien(key)) for (const k of schluessel(lies(f))) set.add(k)
  return set
}

export const pluginKeys = () => fs.readdirSync(PLUGINS).filter(k => fs.existsSync(path.join(PLUGINS, k, 'plugin.json')))

/// Stand einer Sprache — für die Oberfläche (public/lang) oder ein Plugin (plugins/<key>/lang)
export function stand(code, plugin = null) {
  const file = plugin ? path.join(PLUGINS, plugin, 'lang', code + '.json') : path.join(ROOT, 'public', 'lang', code + '.json')
  const map = fs.existsSync(file) ? JSON.parse(lies(file)) : {}
  const quelle = plugin ? pluginSchluessel(plugin) : quellSchluessel()
  const fehlend = [...quelle].filter(k => !(k in map))
  const verwaist = Object.keys(map).filter(k => !quelle.has(k))
  const leer = Object.entries(map).filter(([, v]) => typeof v !== 'string' || !v.trim()).map(([k]) => k)
  return { code, plugin, gesamt: quelle.size, uebersetzt: quelle.size - fehlend.length, fehlend, verwaist, leer }
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith('texte-pruefen.mjs')) {
  const args = process.argv.slice(2)
  const nurFehlend = args.includes('--fehlend')
  const plugin = args.find(a => a.startsWith('--plugin='))?.slice(9) ?? null
  const allePlugins = args.includes('--plugins')
  const codes = args.filter(a => !a.startsWith('--'))
  const alle = codes.length ? codes : fs.readdirSync(path.join(ROOT, 'public', 'lang')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5))
  for (const code of alle) {
    for (const p of allePlugins ? pluginKeys() : [plugin]) {
      const s = stand(code, p)
      if (p && !s.gesamt) continue
      if (nurFehlend) { for (const k of s.fehlend) console.log(k); continue }
      console.log(`${p ? p + ' ' : ''}${code}: ${s.uebersetzt} / ${s.gesamt} übersetzt · ${s.fehlend.length} fehlen · ${s.verwaist.length} verwaist · ${s.leer.length} leer`)
    }
  }
}
