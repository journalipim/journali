// Abfrageparameter einer GET-Route müssen einen Standardwert haben. Ohne ihn verlangt ASP.NET Core sie, und ein
// Aufruf ohne den Parameter endet mit einem Serverfehler statt mit einer Antwort — so geschehen bei
// /api/plugins/catalog (bool fresh). Geprüft werden die Lambdas von MapGet in Journali.Server.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const server = new URL('../../Journali.Server/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const dateien = fs.readdirSync(server).filter(f => f.endsWith('.cs'))

/// Diese Typen kommen aus der Abfrage; alles andere (Catalog, HttpRequest, Body …) bindet der Server selbst
const AUS_DER_ABFRAGE = /^(bool|int|long|double|DateOnly|Guid)\??$/

/// Die Parameterliste eines Lambdas hinter MapGet("…", …) — roh, ohne den Rumpf. `pfad` nennt die Namen aus dem
/// Routenmuster: die kommen aus der Adresse und sind zu Recht Pflicht (/journal/{number:long}).
function parameter(zeile) {
  const m = /MapGet\(\s*"([^"]*)"\s*,\s*(?:async\s*)?\(([^)]*)\)\s*=>/.exec(zeile)
  if (!m) return null
  const liste = m[2].split(',').map(s => s.trim()).filter(Boolean)
  liste.pfad = new Set([...m[1].matchAll(/\{(\w+)/g)].map(x => x[1]))
  return liste
}

test('jeder Abfrageparameter einer GET-Route hat einen Standardwert', () => {
  const fehlt = []
  for (const f of dateien) {
    const text = fs.readFileSync(path.join(server, f), 'utf8')
    for (const zeile of text.split(/\r?\n/)) {
      for (const p of parameter(zeile) ?? []) {
        const [typ, name] = p.split(/\s+/)
        if (!AUS_DER_ABFRAGE.test(typ ?? '') || p.includes('=') || (parameter(zeile)?.pfad.has(name) ?? false)) continue
        fehlt.push(`${f}: ${typ} ${name}`)
      }
    }
  }
  assert.deepEqual(fehlt, [], 'ohne Standardwert verlangt der Server den Parameter und antwortet sonst mit einem Fehler')
})

test('der Prüfstand findet die Lambdas, die er prüfen soll', () => {
  const alle = dateien.flatMap(f => fs.readFileSync(path.join(server, f), 'utf8').split(/\r?\n/)).map(parameter).filter(Boolean)
  assert.ok(alle.length > 10, `nur ${alle.length} GET-Routen erkannt — das Muster passt nicht mehr`)
  assert.equal(parameter('api.MapGet("/x", async (CancellationToken ct, bool fresh = false) =>').length, 2)
  assert.deepEqual([...parameter('api.MapGet("/y", (string? path) => Files(path));')], ['string? path'])
  assert.ok(parameter('api.MapGet("/journal/{number:long}", (long number, IJournal j) =>').pfad.has('number'), 'ein Pfadparameter wird nicht als Abfrage gelesen')
})
