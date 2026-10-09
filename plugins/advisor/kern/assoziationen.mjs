// Assoziationen (09.10.2026): ein Wort, das in keinem Produkt steht, sucht über die Wörter, die man damit verbindet — „winter“ → kalt, frost,
// gefüttert; „tennis“ → sport, schläger, ball. Die Grundausstattung liegt im Plugin, je Sprache Stichwort → Wörter: wissen/assoziationen.json
// (Eigenschaften, Einsatz, Anlässe) und wissen/wikidata.json (Unterbegriffe der Oberthemen aus Wikidata, tools/advisor-wissen/wikidata.mjs).
// Sprachwissen wie das Modell des Plugins embed, kein Modell des Shops. Was ein Shop ergänzt, gehört ins Journal (offen, pflegestruktur 44).
import fs from 'node:fs'
import { formen } from './woerter.mjs'

const DATEIEN = ['assoziationen.json', 'wikidata.json'].map(d => new URL('../wissen/' + d, import.meta.url))
let grundausstattung = null

/// Die Tabellen aus dem Plugin, einmal gelesen und zusammengelegt (die erste zuerst); fehlt eine Datei, zählt sie nicht
function ladeGrundausstattung() {
  if (grundausstattung) return grundausstattung
  grundausstattung = {}
  for (const d of DATEIEN) {
    let t = {}
    try { t = JSON.parse(fs.readFileSync(d, 'utf8')) } catch { continue }
    for (const [l, eintraege] of Object.entries(t)) {
      const z = (grundausstattung[l] ??= {})
      for (const [w, liste] of Object.entries(eintraege ?? {})) z[w] = [...new Set([...(z[w] ?? []), ...(Array.isArray(liste) ? liste : [])])]
    }
  }
  return grundausstattung
}

/// Schreibweise angleichen: „fussball“ findet „fußball“, „aepfel“ findet „äpfel“
export const gleiche = w => w.replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')

/**
 * @param {Record<string, Record<string, string[]>> | null} [tabelle] je Sprache Stichwort → Wörter; ohne Angabe die Grundausstattung
 * @returns {{ zu: (wort: string, locale: string) => string[], groesse: () => number }}
 */
export function erstelleAssoziationen(tabelle = null) {
  const quelle = tabelle ?? ladeGrundausstattung()
  const jeSprache = new Map()
  for (const [sprache, eintraege] of Object.entries(quelle ?? {})) {
    const m = new Map()
    for (const [wort, liste] of Object.entries(eintraege ?? {})) {
      if (!Array.isArray(liste)) continue
      const w = String(wort).toLowerCase()
      const l = [...new Set(liste.map(x => String(x).toLowerCase()).filter(x => x && x !== w))]
      for (const f of formen(w)) { const g = gleiche(f); if (!m.has(g) || f === w) m.set(g, l) }
    }
    jeSprache.set(sprache.toLowerCase(), m)
  }
  return {
    /// Die Wörter zu einem Wort in einer Sprache — auch gebeugt („winters“ → „winter“); leer, wenn es keine gibt
    zu(wort, locale) {
      const m = jeSprache.get(String(locale ?? '').toLowerCase().slice(0, 2))
      if (!m) return []
      const w = String(wort ?? '').toLowerCase()
      for (const f of formen(gleiche(w))) if (m.has(f)) return m.get(f)
      return []
    },
    groesse: () => [...jeSprache.values()].reduce((n, m) => n + [...m.values()].reduce((k, l) => k + l.length, 0), 0),
  }
}
