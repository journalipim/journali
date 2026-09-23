// Kein Name, kein Zitat in dem, was der Anwender liest (Taloan, 23.09.2026: „also bitte nicht meinen Namen + wörtliche
// Kommentare in der Plugin-Beschreibung“). Der Grund gehört in den Text, der Urheber nicht: eine Beschreibung erklärt
// die Sache, nicht ihre Entstehung. Im Quelltext bleibt beides stehen — Kommentare sind unsere Notizen, keine Anzeige.
// Geprüft wird darum: jedes Plugin-Manifest vollständig, und in den Ansichten alles ausser Kommentaren.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'vue/compiler-sfc'

const NAMEN = /\bTaloan\b/
const root = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const pluginRoot = new URL('../../plugins', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const walk = (d, end) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name), end)) : e.name.endsWith(end) ? [path.join(d, e.name)] : [])

test('kein Name in den Plugin-Manifesten', () => {
  const misses = []
  for (const f of walk(pluginRoot, 'plugin.json')) {
    const roh = fs.readFileSync(f, 'utf8').replace(/^﻿/, '')
    const key = path.basename(path.dirname(f))
    const suche = (o, weg = '') => {
      if (typeof o === 'string') { if (NAMEN.test(o)) misses.push(`${key}${weg}: „${o.slice(0, 80)}…“`) }
      else if (Array.isArray(o)) o.forEach(x => suche(x, weg + '[]'))
      else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) suche(v, weg + '.' + k)
    }
    suche(JSON.parse(roh))
  }
  assert.deepEqual(misses, [], 'Name im Manifest — der Anwender liest das')
})

test('kein Name in den Texten der Ansichten', () => {
  const misses = []
  for (const f of walk(root, '.vue')) {
    const { descriptor } = parse(fs.readFileSync(f, 'utf8'), { filename: f })
    // Template ohne HTML-Kommentare: alles hier ist entweder Text oder Tooltip
    const tpl = (descriptor.template?.content ?? '').replace(/<!--[\s\S]*?-->/g, '')
    if (NAMEN.test(tpl)) misses.push(`${path.basename(f)}: im Template`)
    // Script: nur Zeichenketten, nicht die Kommentare daneben
    const script = (descriptor.scriptSetup?.content ?? '') + (descriptor.script?.content ?? '')
    for (const zeile of script.split('\n')) {
      const ohneKommentar = zeile.replace(/\/\/.*$/, '')
      for (const m of ohneKommentar.matchAll(/(['"`])((?:(?!\1)[\s\S])*)\1/g))
        if (NAMEN.test(m[2])) misses.push(`${path.basename(f)}: „${m[2].slice(0, 60)}…“`)
    }
  }
  assert.deepEqual(misses, [], 'Name in einem sichtbaren Text')
})
