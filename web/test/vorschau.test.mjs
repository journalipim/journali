// Vorschaubilder im Browser (04.10.2026): nur kleine Bilder, eins nach dem anderen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { darfRechnen, einzeln, GROESSE } from '../src/vorschau.js'

test('gerechnet wird nur ein Bild bis 8 MB', () => {
  assert.equal(darfRechnen({ mime: 'image/jpeg', bytes: 2_000_000 }), true)
  assert.equal(darfRechnen({ mime: 'image/tiff', bytes: GROESSE + 1 }), false, 'zu gross: der Job rechnet')
  assert.equal(darfRechnen({ mime: 'application/pdf', bytes: 1000 }), false)
  assert.equal(darfRechnen(null), false)
  assert.equal(darfRechnen({ mime: 'image/png' }), false, 'ohne Grösse nicht')
})

test('einzeln: die Arbeiten laufen nacheinander, auch wenn eine scheitert', async () => {
  let gleichzeitig = 0, hoechstens = 0
  const arbeit = (fehler = false) => async () => { gleichzeitig++; hoechstens = Math.max(hoechstens, gleichzeitig); await new Promise(r => setTimeout(r, 5)); gleichzeitig--; if (fehler) throw new Error('x') }
  const laeufe = [einzeln(arbeit()), einzeln(arbeit(true)), einzeln(arbeit()), einzeln(arbeit())]
  const erg = await Promise.allSettled(laeufe)
  assert.equal(hoechstens, 1)
  assert.deepEqual(erg.map(e => e.status), ['fulfilled', 'rejected', 'fulfilled', 'fulfilled'])
})
