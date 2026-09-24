// Was der Anwender liest. Kein Name, kein wörtliches Zitat: „also bitte nicht meinen Namen +
// wörtliche Kommentare in der Plugin-Beschreibung“. Und keine Ratschläge: „Diese Selbsterkenntnissachen gehören
// nirgendwo öffentlich im Programm — wir schreiben ja beim Backup auch nicht hin: es ist immer gut, mehrere davon zu
// haben.“ Ein Text sagt, was die Sache tut; nicht, warum sie gut ist, und nicht, wie sie entstanden ist.
// Im Quelltext bleibt beides stehen — Kommentare sind unsere Notizen, keine Anzeige. Geprüft wird darum: jedes
// Plugin-Manifest vollständig, und in den Ansichten alles ausser Kommentaren.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'vue/compiler-sfc'
import { entfalten } from './texte.mjs'   // $t('…') → der Text, den der Anwender liest (Oberflächensprache, 24.09.2026)

const NAMEN = /\bTaloan\b/
/// Wendungen, mit denen ein Programm anfängt zu raten, zu werben oder zu belehren
const RAT = /es ist (gut|besser|sinnvoll|ratsam|wichtig)|empfiehlt sich|sollte man|man sollte|am besten|nicht vergessen|ratsam|sinnvollerweise|erfahrungsgemäß|bekanntlich|wie man weiß/i
const root = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const pluginRoot = new URL('../../plugins', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const walk = (d, end) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name), end)) : e.name.endsWith(end) ? [path.join(d, e.name)] : [])

test('kein Name und kein Ratschlag in den Manifesten', () => {
  const misses = []
  for (const f of walk(pluginRoot, 'plugin.json')) {
    const roh = fs.readFileSync(f, 'utf8').replace(/^﻿/, '')
    const key = path.basename(path.dirname(f))
    const suche = (o, weg = '') => {
      if (typeof o === 'string') { if (NAMEN.test(o) || RAT.test(o)) misses.push(`${key}${weg}: „${o.slice(0, 80)}…“`) }
      else if (Array.isArray(o)) o.forEach(x => suche(x, weg + '[]'))
      else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) suche(v, weg + '.' + k)
    }
    suche(JSON.parse(roh))
  }
  assert.deepEqual(misses, [], 'Name oder Ratschlag im Manifest — der Anwender liest das')
})

test('kein Name und kein Ratschlag in den Ansichten', () => {
  const misses = []
  for (const f of walk(root, '.vue')) {
    const { descriptor } = parse(fs.readFileSync(f, 'utf8'), { filename: f })
    // Template ohne HTML-Kommentare: alles hier ist entweder Text oder Tooltip
    const tpl = entfalten((descriptor.template?.content ?? '').replace(/<!--[\s\S]*?-->/g, ''))
    if (NAMEN.test(tpl) || RAT.test(tpl)) misses.push(`${path.basename(f)}: im Template`)
    // Script: nur Zeichenketten, nicht die Kommentare daneben
    const script = (descriptor.scriptSetup?.content ?? '') + (descriptor.script?.content ?? '')
    for (const zeile of script.split('\n')) {
      const ohneKommentar = zeile.replace(/\/\/.*$/, '')
      for (const m of ohneKommentar.matchAll(/(['"`])((?:(?!\1)[\s\S])*)\1/g))
        if (NAMEN.test(m[2]) || RAT.test(m[2])) misses.push(`${path.basename(f)}: „${m[2].slice(0, 60)}…“`)
    }
  }
  assert.deepEqual(misses, [], 'Name oder Ratschlag in einem sichtbaren Text')
})

// Länge als Grenze. Ein Tooltip
// sagt, was geschieht — Bedingung und Folge, sonst nichts. Wer mehr braucht, schreibt es in die Dokumentation.
// Ausgenommen sind Referenzen, die wirklich eine Liste sind: Suchbedingungen, Vorlagen-Platzhalter, Gesten im
// Designer. Sie stehen hier namentlich, damit die Ausnahme eine Entscheidung bleibt und nicht einreisst.
const GRENZE = 140
const REFERENZEN = [
  /attr:function/,        // TreeView: die Suchbedingungen
  /\{#products\}/,        // xport: die Platzhalter einer Vorlage
  /Kachel von innen ziehen/,   // WorkflowSettings: die Gesten im Designer
  /m h tag monat/,        // Zeitplan: die Felder eines cron-Ausdrucks
  /Austauschvolumen \(mengenbasiert\)/,   // die Kennzahl oben: fester Wortlaut
]

test('kein sichtbarer Text laenger als die Grenze', () => {
  const misses = []
  for (const f of walk(root, '.vue')) pruefe(f, fs.readFileSync(f, 'utf8'), misses)
  for (const f of pluginDateien()) pruefe(f, fs.readFileSync(f, 'utf8'), misses)
  assert.deepEqual(misses, [], `sichtbarer Text laenger als ${GRENZE} Zeichen`)
})

// Sichtbarer Text ist höchstens ein Satz. Wer erklären will, schreibt es
// in title= — dort gilt die Grenze oben. Abkürzungen (z. B., u. a.) sind kein Satzende.
const ABK = /\b(z|u|d|o|i|s|g|ca|bzw|Nr|evtl|ggf|usw|etc|vgl|Abs|Art)\.\s*$/
test('sichtbarer Text ist hoechstens ein Satz — Erklaerungen gehoeren in den Tooltip', () => {
  const misses = []
  for (const f of walk(root, '.vue')) {
    const { descriptor } = parse(fs.readFileSync(f, 'utf8'), { filename: f })
    const tpl = entfalten((descriptor.template?.content ?? '').replace(/<!--[\s\S]*?-->/g, ''))
    for (const m of tpl.matchAll(/>([^<>]{40,})</g)) {
      const t = m[1].replace(/\{\{[^}]*\}\}/g, 'x').replace(/\s+/g, ' ').trim()
      for (const punkt of [...t.matchAll(/[.!?]["“»)]?\s+(?=[A-ZÄÖÜ])/g)]) {
        if (ABK.test(t.slice(0, punkt.index + punkt[0].length))) continue
        misses.push(`${path.basename(f)}: „${t.slice(0, 70)}…“`)
        break
      }
    }
  }
  assert.deepEqual(misses, [], 'zwei Sätze im sichtbaren Text — der zweite gehört in title=')
})

/// Alle Plugin-Dateien mit Oberfläche (entry.js und die .vue darunter)
function pluginDateien() {
  const dir = new URL('../../plugins', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
  return walk(dir, '.js').filter(f => f.endsWith('entry.js')).concat(walk(dir, '.vue'))
}

/// title= und placeholder= in Vorlagen wie in Skripten; Kommentarzeilen zählen nicht
function pruefe(f, txt, misses) {
  for (const zeile of entfalten(txt).split('\n')) {
    if (/^\s*\/\//.test(zeile)) continue
    for (const m of zeile.matchAll(/(?:title|placeholder)\s*[=:]\s*['"]([^'"]{100,})['"]/g)) {
      const s = satz(m[1])
      if (s.length <= GRENZE || REFERENZEN.some(r => r.test(s))) continue
      misses.push(`${path.basename(f)}: ${s.length} Zeichen — „${s.slice(0, 70)}…“`)
    }
  }
}

/// Der längste Satz in einem gebundenen Ausdruck: `${…}` wird zu einem Wort, an Verzweigungen wird getrennt.
/// Sonst misst der Prüfer den Code (`a ? `x` : `y``) statt dessen, was der Anwender liest.
function satz(roh) {
  return roh.replace(/\$\{[^}]*\}/g, 'x')
    .split(/[`?:]|&&|\|\|/)
    .map(s => s.trim())
    .sort((a, b) => b.length - a.length)[0] ?? ''
}

// Fester sichtbarer Text ist kurz. Was erklärt, gehört in title=; in der Zeile steht, was die Sache ist. Gerechnete Meldungen ({{ … }})
// sind Daten, keine Erklärung — sie zählen hier nicht mit.
const SICHTBAR = 60
test('fester sichtbarer Text bleibt kurz — Erklärungen stehen im Tooltip', () => {
  const lang = []
  for (const f of walk(root, '.vue')) {
    const { descriptor } = parse(fs.readFileSync(f, 'utf8'), { filename: f })
    const tpl = entfalten((descriptor.template?.content ?? '').replace(/<!--[\s\S]*?-->/g, ''))
    for (const m of tpl.matchAll(/>([^<>{}]{30,})</g)) {
      const t = m[1].replace(/\s+/g, ' ').trim()
      if (t.length > SICHTBAR) lang.push(`${path.basename(f)}: ${t.length} Zeichen — „${t.slice(0, 60)}…“`)
    }
  }
  assert.deepEqual(lang, [], `sichtbarer Text über ${SICHTBAR} Zeichen`)
})
