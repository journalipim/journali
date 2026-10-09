#!/usr/bin/env node
// Der Prüfstand des Produktberaters (docs/pflegestruktur.md 44): spielt die Dialoge in tools/berater-dialoge/*.json über den Kern
// (plugins/advisor/kern) gegen eine Instanz und legt Antwort, Erwartung und Vorbild nebeneinander. Er liest nur — mit dem Token eines Beraters
// (⇪ Export → Produktberatung → ＋ Token), ohne KI, ausser mit --mit-ki (das kostet beim Team des Beraters).
//
//   node tools/berater-dialoge/spiele.mjs --journali http://localhost:5000 --berater shop --token ja_… [--dialog zelt-leicht] [--mit-ki] [--locale de]
//
// Statt --token geht JOURNALI_ADVISOR_TOKEN in der Umgebung. Exit-Code 1, wenn ein Dialog abweicht.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { erstelleKern } from '../../plugins/advisor/kern/gespraech.mjs'
import { pruefe, handlung, gesagt } from './pruefe.mjs'

const hier = path.dirname(fileURLToPath(import.meta.url))

export function argumente(argv) {
  const a = { mitKi: false }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--mit-ki') a.mitKi = true
    else if (k.startsWith('--')) a[k.slice(2)] = argv[++i]
  }
  return a
}

/// Die Dialoge: alle Dateien im Verzeichnis, oder die eine mit --dialog
export function dialoge(verzeichnis = hier, nur = null) {
  return fs.readdirSync(verzeichnis).filter(f => f.endsWith('.json') && (!nur || f === nur || f === nur + '.json')).sort()
    .map(f => ({ datei: f, ...JSON.parse(fs.readFileSync(path.join(verzeichnis, f), 'utf8')) }))
}

/**
 * Einen Dialog spielen. `kern` ist ein Kern (erstelleKern) — gegen eine Instanz oder in Tests gegen eine Attrappe.
 * @returns {{ name: string, schritte: { handlung: string, gesagt: string, vorbild?: string, abweichungen: string[] }[] }}
 */
export async function spiele(kern, dialog, { mitKi = false, locale = null } = {}) {
  const gespraech = 'pruefstand-' + Math.random().toString(16).slice(2, 14)
  const aus = []
  // Öffnen, „Nicht das“ und „ein anderer erster Treffer“ beziehen sich auf die letzte Antwort mit Treffern — eine Antwort zum Produkt im Blick hat keine
  let letzte = null
  for (const s of dialog.schritte ?? []) {
    const loc = locale ?? dialog.locale ?? null
    let antwort = letzte
    if (s.oeffne) {
      const h = letzte?.hits?.[s.oeffne - 1]
      if (h) kern.merke(gespraech, { id: h.id, name: h.name })
      aus.push({ handlung: handlung(s), gesagt: h ? `(geöffnet: ${h.name})` : '(kein Treffer zum Öffnen)', abweichungen: h ? [] : ['kein Treffer zum Öffnen'] })
      continue
    }
    const vorher = letzte
    if (s.eingabe !== undefined) antwort = await kern.antworte({ gespraech, q: s.eingabe, locale: loc, ki: mitKi })
    else if (s.klick) antwort = await kern.antworte({ gespraech, schritt: s.klick, locale: loc, ki: mitKi })
    else if (s.ablehnen) {
      const h = letzte?.hits?.[s.ablehnen - 1]
      antwort = await kern.antworte({ gespraech, schritt: { art: 'ablehnen', id: h?.id, name: h?.name }, locale: loc, ki: mitKi })
    }
    if ((antwort?.hits ?? []).length || !letzte) letzte = antwort
    aus.push({ handlung: handlung(s), gesagt: gesagt(antwort), treffer: (antwort?.hits ?? []).slice(0, 3).map(h => h.name), vorbild: s.vorbild, abweichungen: pruefe(antwort, s.erwartet, vorher) })
  }
  return { name: dialog.name ?? dialog.datei, schritte: aus }
}

/// Der Bericht als Text: je Schritt Handlung, was der Berater gesagt hat, das Vorbild und die Abweichungen
export function bericht(ergebnisse) {
  const z = []
  let schlecht = 0
  for (const e of ergebnisse) {
    const ok = e.schritte.every(s => !s.abweichungen.length)
    if (!ok) schlecht++
    z.push(`${ok ? '✓' : '✗'} ${e.name}`)
    for (const s of e.schritte) {
      z.push(`  ${s.abweichungen.length ? '✗' : '·'} ${s.handlung}`)
      z.push(`      Berater: ${s.gesagt}${s.treffer?.length ? `  [${s.treffer.join(' | ')}]` : ''}`)
      if (s.vorbild) z.push(`      Vorbild: ${s.vorbild}`)
      for (const a of s.abweichungen) z.push(`      ✗ ${a}`)
    }
  }
  z.push('', `${ergebnisse.length - schlecht} von ${ergebnisse.length} Dialogen wie erwartet.`)
  return { text: z.join('\n'), schlecht }
}

async function main() {
  const a = argumente(process.argv.slice(2))
  const token = a.token ?? process.env.JOURNALI_ADVISOR_TOKEN
  if (!a.journali || !a.berater || !token) { console.error('Aufruf: spiele.mjs --journali <adresse> --berater <schlüssel> --token <ja_…> [--dialog <name>] [--mit-ki] [--locale <de|en>]'); process.exit(2) }
  const basis = a.journali.replace(/\/+$/, '') + '/api/advisor/' + encodeURIComponent(a.berater) + '/'
  const kern = erstelleKern({
    journali: async (pfad, body, kopf = {}) => {
      const r = await fetch(basis + pfad, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: 'Bearer ' + token, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...kopf }, body: body === undefined ? undefined : JSON.stringify(body) })
      const t = await r.text()
      let json = null; try { json = t ? JSON.parse(t) : null } catch { json = { error: t.slice(0, 200) } }
      return { status: r.status, json }
    },
  })
  const ergebnisse = []
  for (const d of dialoge(hier, a.dialog ?? null)) ergebnisse.push(await spiele(kern, d, { mitKi: a.mitKi, locale: a.locale ?? null }))
  const { text, schlecht } = bericht(ergebnisse)
  console.log(text)
  process.exit(schlecht ? 1 : 0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exit(2) })
