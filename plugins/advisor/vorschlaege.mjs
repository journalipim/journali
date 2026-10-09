#!/usr/bin/env node
// Vorschläge aus dem Lernen des Produktberaters (docs/pflegestruktur.md 44): liest lernen.json des Dienstes (JOURNALI_ADVISOR_DATA) und zeigt, was
// sich in journali übernehmen liesse — ein Synonym im Wörterbuch, ein Attribut in der Sicht, ein Stichwort am Produkt. Übernommen wird nichts von
// selbst; das entscheidet ein Mensch in journali.
//
//   node vorschlaege.mjs /daten/lernen.json [--ab 3] [--json]
//   docker compose exec advisor-shop node /advisor/vorschlaege.mjs /daten/lernen.json
import fs from 'node:fs'
import { vorschlaege } from './kern/lernen.mjs'

/// Die Vorschläge als Text: je Art eine Überschrift, je Vorschlag eine Zeile mit Anzahl
export function alsText(v) {
  const z = []
  const block = (titel, liste, zeile) => { if (liste.length) z.push(titel, ...liste.map(x => '  ' + zeile(x)), '') }
  block('Wörter ohne Treffer', v.ohneTreffer, x => `${x.n}×  „${x.wort}“ — ${x.vorschlag}`)
  block('Gelesene Tippfehler', v.korrektur, x => `${x.n}×  „${x.von}“ → „${x.zu}“ — ${x.vorschlag}`)
  block('Nichts gefunden', v.nichts, x => `${x.n}×  ${x.woerter} — ${x.vorschlag}`)
  block('Geöffnet nach', v.geoeffnet, x => `${x.n}×  „${x.wort}“ → ${x.name ?? x.id} — ${x.vorschlag}`)
  block('Gemerkt nach', v.gemerkt, x => `${x.n}×  „${x.wort}“ → ${x.name ?? x.id}`)
  block('Abgelehnt nach', v.abgelehnt, x => `${x.n}×  „${x.wort}“ → ${x.name ?? x.id} — ${x.vorschlag}`)
  return z.length ? z.join('\n') : 'Noch keine Vorschläge.'
}

function main() {
  const args = process.argv.slice(2)
  const i = args.indexOf('--ab')
  const ab = i >= 0 ? Number(args[i + 1]) || 3 : 3
  const datei = args.find((a, k) => !a.startsWith('--') && (i < 0 || k !== i + 1))
  if (!datei) { console.error('Aufruf: vorschlaege.mjs <lernen.json> [--ab 3] [--json]'); process.exit(2) }
  const v = vorschlaege(JSON.parse(fs.readFileSync(datei, 'utf8')), { ab })
  console.log(args.includes('--json') ? JSON.stringify(v, null, 1) : alsText(v))
}

if (process.argv[1]?.endsWith('vorschlaege.mjs')) main()
