// Ein Abschnitt sieht überall gleich aus (Taloan, 23.09.2026: „wieso sehen Schriften etc. hier komplett anders aus als in
// anderen Tabs?“). Die Regel stand vierfach scoped in einzelnen Ansichten; wer sie nicht kopiert hatte — Mail, Sicherung —
// bekam die Vorgabe des Browsers: riesige fette Überschrift. Jetzt steht sie einmal in style.css, und dieser Prüfstand
// hält sie dort: eine neue Einstellungsseite erbt sie, ohne dass jemand daran denken muss.
import test from 'node:test'
import assert from 'node:assert/strict'
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
