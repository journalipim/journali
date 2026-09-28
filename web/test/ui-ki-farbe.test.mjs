// Was die bezahlte KI tut, ist magenta (28.09.2026): jede Zeile, jeder Knopf, jeder Lauf, der Token kostet, trägt die
// Klasse „ai“ (--ai). Das Zeichen dafür ist ✦ — steht es sichtbar an einem Element (Vorlage oder el()), muss die Klasse
// dabeistehen. Ausgenommen sind ✦-Texte, die keine KI meinen („✦ aus“, „✦ journali Limits“ — die Wirkung eines
// Lizenzschlüssels), Tooltips und Kommentare; ein Status, der über say() gesetzt wird, muss in seiner Datei die Klasse
// nach dem ✦ setzen. Texte, die eine Vorlage erst später in ein Element setzt (ein ref, eine Funktion), prüft der
// Dialogtest selbst — hier zählt nur, was auf der Zeile ein Element ist.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const plugins = new URL('../../plugins', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const walk = (dir, ext) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(dir, e.name), ext)) : e.name.endsWith(ext) ? [path.join(dir, e.name)] : [])
/// Plugin-Quellen: die handgeschriebenen entry.js und die src/ der gebauten — nie ein gebautes entry.js neben src/
const pluginDateien = () => fs.readdirSync(plugins, { withFileTypes: true }).filter(e => e.isDirectory()).flatMap(e => {
  const d = path.join(plugins, e.name)
  return fs.existsSync(path.join(d, 'src')) ? walk(path.join(d, 'src'), '.js').concat(walk(path.join(d, 'src'), '.vue')) : fs.existsSync(path.join(d, 'entry.js')) ? [path.join(d, 'entry.js')] : []
})
const KEINE_KI = [/✦ aus\b/, /✦ journali Limits/, /'✦ ' \+ r\.text/, /brauchen einen KI-Schlüssel|brauchen einen Schlüssel/]   // Limits eines Schlüssels; „ohne Schlüssel“ ist keine KI
const HAT_AI = /\bclass(?:=|:)\s*(?:"[^"]*\bai\b[^"]*"|'[^']*\bai\b[^']*'|\{[^}]*\bai\b|[^,>]*\?[^,>]*'[^']*\bai\b)/
const ort = f => path.relative(path.dirname(plugins), f).replace(/\\/g, '/').replace(/^journali\//, '')

/// Die Zeile ohne Tooltips und Kommentare — ein ✦ in einer Erklärung ist kein Element
const bereinigt = z => z.replace(/:?title="[^"]*"/g, '').replace(/title:\s*t_?\([^)]*\)/g, '').replace(/^\s*(\/\/|<!--).*$/, '').replace(/\s\/\/.*$/, '').replace(/startsWith\('✦'\)/g, '')   // die Prüfung auf ✦ ist kein ✦
/// Nur Zeilen, die ein Element sind: ein Tag in der Vorlage oder ein el() im Skript
const istElement = z => /<[a-z]/i.test(z) || /\bel\(/.test(z)

test('jede sichtbare ✦-Stelle traegt die Klasse ai', () => {
  const misses = []
  for (const f of [...walk(root, '.vue'), ...walk(root, '.js'), ...pluginDateien()]) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((zeile, i) => {
      const z = bereinigt(zeile)
      if (!z.includes('✦') || !istElement(z) || KEINE_KI.some(re => re.test(z))) return
      if (!HAT_AI.test(z)) misses.push(`${ort(f)}:${i + 1}: ${z.trim().slice(0, 90)}`)
    })
  }
  assert.deepEqual(misses, [], 'sichtbares ✦ ohne Klasse ai')
})

test('ein Status, der mit ✦ gesetzt wird, bekommt die Klasse in seiner say-Funktion', () => {
  const misses = []
  for (const f of [...walk(root, '.js'), ...pluginDateien()]) {
    const src = fs.readFileSync(f, 'utf8')
    const setztKi = src.split(/\r?\n/).some(z => /\bsay\(/.test(z) && bereinigt(z).includes('✦') && !KEINE_KI.some(re => re.test(z)))
    if (setztKi && !/say = .*className = .*'ai'/.test(src)) misses.push(ort(f))
  }
  assert.deepEqual(misses, [], 'say() mit ✦, aber die Statuszeile wird nicht magenta')
})
