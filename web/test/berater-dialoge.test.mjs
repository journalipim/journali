// Der Prüfstand des Produktberaters (tools/berater-dialoge, pflegestruktur 44): die Dialoge sind gültig, der Vergleich von Antwort und Erwartung
// sagt, was abweicht, und das Spielen eines Dialogs (Eingaben, Klicks, Öffnen, „Nicht das“) läuft — hier gegen eine Attrappe von journali.
// Gegen eine Instanz spielt `node tools/berater-dialoge/spiele.mjs`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { pruefe, ERWARTUNGEN, handlung } from '../../tools/berater-dialoge/pruefe.mjs'
import { dialoge, spiele, bericht, argumente } from '../../tools/berater-dialoge/spiele.mjs'
import { erstelleKern } from '../../plugins/advisor/kern/gespraech.mjs'

test('jeder Dialog hat einen Namen, Schritte mit genau einer Handlung und nur bekannte Erwartungen', () => {
  const alle = dialoge()
  assert.ok(alle.length >= 5, `nur ${alle.length} Dialoge`)
  for (const d of alle) {
    assert.ok(d.name, d.datei)
    assert.ok(d.schritte?.length, d.datei)
    for (const s of d.schritte) {
      const handlungen = ['eingabe', 'klick', 'ablehnen', 'oeffne'].filter(k => s[k] !== undefined)
      assert.equal(handlungen.length, 1, `${d.datei}: ${JSON.stringify(s)}`)
      for (const k of Object.keys(s.erwartet ?? {})) assert.ok(k in ERWARTUNGEN, `${d.datei}: unbekannte Erwartung ${k}`)
    }
  }
})

test('der Vergleich nennt jede Abweichung und schweigt, wenn alles passt', () => {
  const a = { total: 2, hits: [{ id: 'z1', name: 'Odda Zelt' }, { id: 'z2', name: 'Ravik Zelt' }], words: ['zelt'], filter: [{ attribute: 'weight', op: 'low', value: 'leicht', valueLabel: 'leicht' }],
    texte: { satz: '2 Produkte passen zu „zelt“.', frage: 'Passt eines davon?', hinweise: ['„zeit“ habe ich als „zelt“ gelesen.'] }, corrected: [{ from: 'zeit', to: 'zelt' }], docs: [], unknown: [] }
  assert.deepEqual(pruefe(a, { alle_treffer_enthalten: 'Zelt', angaben: [['weight', 'low']], woerter: ['zelt'], korrigiert: [['zeit', 'zelt']], hinweis_enthaelt: 'gelesen', treffer_min: 2, statt: false }), [])
  const fehler = pruefe(a, { alle_treffer_enthalten: 'Hose', treffer_max: 1, unterlagen_min: 1, statt: true, ueber: true, frage_enthaelt: 'Grösse', gibtsnicht: 1 })
  assert.equal(fehler.length, 7)
  assert.ok(fehler.some(f => f.startsWith('jeder Treffer mit „Hose“ im Namen — ist: Odda Zelt, Ravik Zelt')))
  assert.ok(fehler.includes('unbekannte Erwartung „gibtsnicht“'))
  assert.deepEqual(pruefe({ hits: [{ id: 'z2' }] }, { erster_treffer_anders: true }, a), [])
  assert.equal(pruefe(a, { erster_treffer_anders: true }, a).length, 1)
  assert.equal(handlung({ klick: { art: 'filter', attribute: 'color', value: 'red' } }), 'Klick filter color=red')
})

test('ein Dialog spielt Eingaben, Öffnen und „Nicht das“ über den Kern; der Bericht legt Berater und Vorbild nebeneinander', async () => {
  const katalog = [{ id: 'z1', name: 'Odda Zelt' }, { id: 'z2', name: 'Ravik Zelt' }]
  const rufe = []
  const kern = erstelleKern({ journali: async (pfad, body) => {
    rufe.push({ pfad, body })
    if (pfad.startsWith('vocabulary')) return { status: 200, json: { locale: 'de', etag: '"1"', attributes: [], words: [{ word: 'zelt', n: 2 }, { word: 'odda', n: 1 }, { word: 'ravik', n: 1 }] } }
    if (pfad === 'docs') return { status: 200, json: { docs: [] } }
    const treffer = (body.art ?? []).includes('zelt') ? katalog : []
    const hinten = new Set(body.hinten ?? [])
    const reihe = [...treffer.filter(p => !hinten.has(p.id)), ...treffer.filter(p => hinten.has(p.id))]
    return { status: 200, json: { total: reihe.length, hits: reihe, facets: [], filter: [], relax: [], present: [], words: [...(body.art ?? []), ...(body.ordnen ?? [])].map(w => ({ word: w, n: w === 'zelt' ? 2 : 0 })),
      focus: body.fokus ? { id: body.fokus, name: 'Odda Zelt', values: [{ key: 'weight', label: 'Gewicht', value: '2,4 kg' }] } : null } }
  } })
  const ergebnis = await spiele(kern, { name: 'Probe', schritte: [
    { eingabe: 'Zelt', erwartet: { treffer_min: 2 }, vorbild: 'Zwei Zelte.' },
    { oeffne: 1 },
    { eingabe: 'wie schwer ist es?', erwartet: { ueber: true, werte_enthalten: ['Gewicht'] } },
    { ablehnen: 1, erwartet: { erster_treffer_anders: true } },
    { eingabe: 'Hose', erwartet: { alle_treffer_enthalten: 'Hose' } },
  ] })
  assert.deepEqual(ergebnis.schritte.map(s => s.abweichungen.length), [0, 0, 0, 0, 1], 'nur „Hose“ weicht ab')
  assert.deepEqual(rufe.filter(r => r.pfad === 'select').at(-2).body.hinten, ['z1'], '„Nicht das“ gilt dem ersten Treffer der letzten Liste')
  assert.ok(rufe.some(r => r.pfad === 'select' && r.body.fokus === 'z1'), 'das geöffnete Produkt ist im Blick')
  assert.ok(rufe.filter(r => r.pfad === 'select').every(r => r.body.probe || r.body.hinten !== undefined))
  const { text, schlecht } = bericht([ergebnis])
  assert.equal(schlecht, 1)
  assert.match(text, /✗ Probe/)
  assert.match(text, /Vorbild: Zwei Zelte\./)
  assert.match(text, /Berater: 2 Produkte passen zu „zelt“\./)
  assert.match(text, /0 von 1 Dialogen wie erwartet\./)
  assert.deepEqual(argumente(['--journali', 'http://x', '--mit-ki', '--berater', 'shop']), { journali: 'http://x', berater: 'shop', mitKi: true })
})
