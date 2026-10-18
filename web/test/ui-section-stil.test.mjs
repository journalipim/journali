// Ein Abschnitt sieht überall gleich aus. Die Regel stand vierfach scoped in einzelnen Ansichten; wer sie nicht kopiert hatte — Mail, Sicherung —
// bekam die Vorgabe des Browsers: riesige fette Überschrift. Jetzt steht sie einmal in style.css, und dieser Prüfstand
// hält sie dort: eine neue Einstellungsseite erbt sie, ohne dass jemand daran denken muss.
import test from 'node:test'
import assert from 'node:assert/strict'
import { entfalten } from './texte.mjs'
import fs from 'node:fs'
import path from 'node:path'

const src = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const css = fs.readFileSync(path.join(src, 'style.css'), 'utf8')
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.vue') ? [path.join(d, e.name)] : [])
const stil = f => { const s = fs.readFileSync(f, 'utf8'); const i = s.indexOf('<style'); return i < 0 ? '' : s.slice(i) }

test('die Abschnittsüberschrift ist einmal beschrieben — in style.css', () => {
  assert.match(css, /\.section h2 \{[^}]*font-size: 12px/, '.section h2 fehlt in style.css')
  assert.match(css, /\.section \{[^}]*border-top/, '.section fehlt in style.css')
})

test('sie ist ein farbiges Band — nicht nur graue Schrift', () => {
  const regel = css.match(/\.section h2 \{[^}]*\}/)?.[0] ?? ''
  assert.match(regel, /background: var\(--accent-soft\)/, 'der Streifen fehlt')
  assert.match(regel, /border-top: 2px solid var\(--accent\)/, 'die Kante fehlt')
})

// Eine Überschrift ist ein Name und eine Zahl. Der Beisatz nach dem · zählt auf oder
// zählt ab. Wer erklären will, schreibt es in title= — dort gilt die Längengrenze aus sichtbare-texte.test.mjs.
// Erkannt wird ein Satzfragment an seinen Funktionswörtern und an Verben: beide haben in einem Namen nichts zu suchen.
const FRAGMENT = /(^|\s)(der|die|das|des|dem|den|dieser|diese|dieses|diesem|über|gegen|statt|nicht|sondern|bei|für|nach|ohne|hier|oben|unten|wie|als|gelten|ziehen|zählen|zählt|misst|gemessen|geschätzt|läuft|steht|gehört)(\s|$)/i
test('der Beisatz einer Überschrift zählt auf — er erklärt nicht', () => {
  const misses = []
  for (const f of walk(src)) {
    const roh = fs.readFileSync(f, 'utf8')
    const tpl = entfalten(roh.slice(0, roh.indexOf('<style') < 0 ? roh.length : roh.indexOf('<style')).replace(/<!--[\s\S]*?-->/g, ''))
    for (const kopf of tpl.match(/<h2[\s\S]*?<\/h2>/g) ?? []) {
      const sichtbar = kopf.replace(/\stitle="[^"]*"/g, '').replace(/\{\{[^}]*\}\}/g, '#').replace(/<[^>]*>/g, ' ')
      const bei = sichtbar.split('·').slice(1).join(' ').replace(/[#⊞▤▦◷✧✦⚿▨▩◍◈⚑↺⎘◆✓⇄👥👤⚠✉]/g, ' ').trim()
      if (bei && FRAGMENT.test(bei)) misses.push(`${path.basename(f)}: „· ${bei.slice(0, 60)}“`)
    }
  }
  assert.deepEqual(misses, [], 'Erklärung in einer Überschrift — sie gehört in title=')
})

test('keine Ansicht beschreibt sie noch einmal — ausser der Knotenansicht, die eine eigene Bandoptik hat', () => {
  const doppelt = walk(src).filter(f => /\.section h2/.test(stil(f))).map(f => path.basename(f))
  assert.deepEqual(doppelt, ['NodeView.vue'], 'hier steht die Regel ein zweites Mal — dann läuft die Optik wieder auseinander')
})

test('jede Einstellungsseite setzt ihre Überschriften in einen Abschnitt', () => {
  const seiten = ['MailSettings.vue', 'RestoreSettings.vue', 'StorageSettings.vue', 'UsersSettings.vue', 'TeamsSettings.vue']
  const ohne = []
  for (const name of seiten) {
    const f = walk(src).find(x => path.basename(x) === name)
    if (!f) continue
    const s = fs.readFileSync(f, 'utf8')
    const kopf = (s.match(/<h2/g) || []).length
    if (kopf > 0 && !s.includes('class="section"')) ohne.push(name)
  }
  assert.deepEqual(ohne, [], 'Überschrift ohne Abschnitt: sie bekommt dann die Vorgabe des Browsers')
})

test('ein Textfeld schreibt in der Schrift der Oberfläche wie ein Eingabefeld — eine Festbreitenschrift setzt nur, wer sie braucht (18.10.2026)', () => {
  const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
  assert.match(css, /input, button, select, textarea \{\s*font: inherit;/)
})
