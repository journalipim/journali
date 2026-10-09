// Führt Teillisten von Assoziationen zur Grundausstattung zusammen (kern/assoziationen.mjs liest wissen/assoziationen.json).
//   node tools/advisor-wissen/zusammenfuehren.mjs <teil.json> [<teil.json> …]
// Je Teil { de: { stichwort: [wörter] }, en: { … } }. Klein geschrieben, ohne Doppelungen, ein Stichwort aus zwei Teilen bekommt beide Listen
// (höchstens MAX Wörter); Markennamen, die als Gattungswort umlaufen, fallen weg (Regel 3: keine fremden Produkte). Die vorhandene Datei
// bleibt die Grundlage: was dort steht, wird ergänzt, nicht ersetzt. Eine Zeile je Stichwort, damit ein Diff lesbar bleibt.
import fs from 'node:fs'

const MAX = 12
const ZIEL = new URL('../../plugins/advisor/wissen/assoziationen.json', import.meta.url)
const MARKEN = new Set(['tesa', 'tempo', 'velcro', 'thermos', 'styropor', 'teflon', 'gore-tex', 'goretex', 'lycra', 'kevlar', 'tupperware', 'jeep', 'vespa',
  'labello', 'frisbee', 'jacuzzi', 'post-it', 'plexiglas', 'plexiglass', 'nutella', 'ceran', 'cerankochfeld', 'aspirin', 'tixo', 'uhu', 'edding', 'zewa',
  'hansaplast', 'band-aid', 'kleenex', 'q-tip', 'sellotape', 'scotch', 'polaroid', 'walkman', 'xerox', 'hoover', 'bobby-car', 'lego', 'playmobil',
  'tamagotchi', 'thermomix', 'vileda', 'wd-40', 'isomatte®', 'primaloft', 'polartec', 'thinsulate', 'coolmax', 'sympatex', 'vibram', 'cordura', 'neopren®', 'oeko-tex', 'öko-tex', 'tüv', 'tuev'])

const ein = process.argv.slice(2)
if (!ein.length) { console.error('usage: node zusammenfuehren.mjs <teil.json> …'); process.exit(2) }
let alt = {}
try { alt = JSON.parse(fs.readFileSync(ZIEL, 'utf8')) } catch { }
const aus = {}
const sauber = x => String(x ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
let wegMarke = 0
for (const teil of [alt, ...ein.map(d => JSON.parse(fs.readFileSync(d, 'utf8')))]) {
  for (const [sprache, eintraege] of Object.entries(teil)) {
    const l = sprache.toLowerCase().slice(0, 2)
    aus[l] ??= {}
    for (const [w0, liste] of Object.entries(eintraege ?? {})) {
      const w = sauber(w0)
      if (!w || MARKEN.has(w) || !Array.isArray(liste)) { if (MARKEN.has(w)) wegMarke++; continue }
      // englische Mehrwortbegriffe stehen in Produkttexten getrennt („rain jacket“) — der Server sucht die Zeichenfolge
      const neu = liste.map(sauber).filter(x => x && !MARKEN.has(x)).map(x => l === 'en' ? x.replace(/-/g, ' ') : x).filter(x => x !== w)
      wegMarke += liste.length - neu.length
      aus[l][w] = [...new Set([...(aus[l][w] ?? []), ...neu])].slice(0, MAX)
    }
  }
}
for (const l of Object.keys(aus)) for (const w of Object.keys(aus[l])) if (!aus[l][w].length) delete aus[l][w]

// eine Zeile je Stichwort, Stichwörter sortiert
const zeilen = ['{']
const sprachen = Object.keys(aus).sort()
sprachen.forEach((l, i) => {
  const ws = Object.keys(aus[l]).sort((a, b) => a.localeCompare(b, l))
  zeilen.push(`  ${JSON.stringify(l)}: {`)
  ws.forEach((w, k) => zeilen.push(`    ${JSON.stringify(w)}: ${JSON.stringify(aus[l][w])}${k < ws.length - 1 ? ',' : ''}`))
  zeilen.push(`  }${i < sprachen.length - 1 ? ',' : ''}`)
})
zeilen.push('}')
fs.writeFileSync(ZIEL, zeilen.join('\n') + '\n')
for (const l of sprachen) console.log(l, Object.keys(aus[l]).length, 'Stichwörter,', Object.values(aus[l]).flat().length, 'Assoziationen')
console.log('ohne Markennamen:', wegMarke)
