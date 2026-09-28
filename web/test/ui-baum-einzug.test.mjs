// Der Einzug einer Baumzeile hängt nur von ihrer Tiefe ab (28.09.2026). Vorher schrumpften Pfeil und Symbol im Flex,
// sobald eine lange Bezeichnung die Zeile überlaufen liess — der leere Pfeil eines Blatts auf null. Lange Zeilen rückten
// nach links, kurze nicht, und Geschwister sahen aus wie Ebenen; eine Attributgruppe hing darum am falschen Knoten.
// happy-dom rechnet kein Layout — geprüft wird die Regel, die es verhindert: feste Breiten sind fest.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from '@vue/compiler-sfc'

const src = fs.readFileSync(new URL('../src/views/TreeView.vue', import.meta.url), 'utf8')
const css = parse(src).descriptor.styles.map(s => s.content).join('\n')
const regel = sel => { const m = css.match(new RegExp(`(?:^|\\n)\\s*${sel.replace('.', '\\.')}\\s*\\{([^}]*)\\}`)); return m ? m[1] : '' }

test('Pfeil und Symbol der Baumzeile schrumpfen nie — der Einzug bleibt bei jeder Breite gleich', () => {
  assert.match(regel('.twisty'), /flex:\s*0 0 14px/, 'der Pfeil hat eine feste Breite, auch leer')
  assert.match(regel('.icon'), /flex:\s*0 0 16px/, 'das Symbol hat eine feste Breite')
  assert.match(regel('.count'), /flex-shrink:\s*0/, 'die Zahl rechts auch')
})

test('nur die Bezeichnung darf schrumpfen — mit Auslassung, nicht mit Umbruch', () => {
  assert.match(regel('.label'), /text-overflow:\s*ellipsis/)
  assert.match(regel('.node'), /white-space:\s*nowrap/)
})
