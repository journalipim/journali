// Wer nur liest, nimmt nicht die Schreibsperre (27.09.2026). `Catalog.With` hält `lock (_write)`, weil es prüfen und
// schreiben in einem Schritt erlaubt — es ist aber auch der bequemste Weg, an Modell und Baum zu kommen, und wurde
// darum an 130 Stellen benutzt, die gar nichts schreiben. Eine davon baute den Text aller Knoten neu, alle fünf
// Sekunden: die ganze Anlage stand. Für reines Lesen gibt es `Catalog.Lesen(model, tree)` — dieser Prüfstand hält das
// fest, weil es im Betrieb erst bei vielen Knoten auffällt und in keinem Test mit zehn Knoten.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const dir = new URL('../../Journali.Server', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const dateien = fs.readdirSync(dir).filter(f => f.endsWith('.cs'))

/// `.With((a, b, _) => …)`: der dritte Parameter ist der Writer — heisst er `_`, schreibt hier niemand
const NUR_LESEND = /\.With\(\(\s*\w+\s*,\s*\w+\s*,\s*_\s*\)\s*=>/g

test('kein With ohne Schreiben — dafür gibt es Lesen', () => {
  const treffer = []
  for (const f of dateien) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8')
    const zeilen = text.split('\n')
    zeilen.forEach((z, i) => { if (new RegExp(NUR_LESEND.source).test(z)) treffer.push(`${f}:${i + 1}`) })
  }
  assert.deepEqual(treffer, [], 'diese Stellen halten die Schreibsperre, obwohl sie nur lesen — c.Lesen((model, tree) => …) nehmen')
})

test('Lesen gibt es und liest unter der Lesesperre', () => {
  const catalog = fs.readFileSync(path.join(dir, 'Catalog.cs'), 'utf8')
  assert.match(catalog, /public TResult Lesen<TResult>\(Func<ModelCatalog, Tree, TResult> read\) => Lesend\(/)
  // und With schreibt weiterhin unter der Schreibsperre — sonst wäre die Trennung sinnlos
  assert.match(catalog, /public TResult With<TResult>\(Func<ModelCatalog, Tree, Writer, TResult> action\)\s*\n\s*\{\s*\n\s*lock \(_write\)/)
})
