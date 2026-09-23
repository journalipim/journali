// Was der Anwender liest (Taloan, 23.09.2026). Kein Name, kein wörtliches Zitat: „also bitte nicht meinen Namen +
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
    const tpl = (descriptor.template?.content ?? '').replace(/<!--[\s\S]*?-->/g, '')
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
